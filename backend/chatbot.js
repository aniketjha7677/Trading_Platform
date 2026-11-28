// The assistant behind the chat icon on the dashboard.
// It reads the user's holdings and funds, pulls price history, and answers with
// a buy / hold / sell view. If an LLM is configured (see LLM_* variables) it
// also puts the same facts into more natural language; otherwise the built-in
// wording is used, so the chat works without any paid key.

const {
  ADVICE_DISCLAIMER,
  STOCKS,
  HORIZON_TEXT,
  detectStocks,
  detectHorizon,
  analyze,
  outlook,
  decide,
  describe,
  brief,
} = require("./advisor");

const HISTORY_TTL = 15 * 60 * 1000; // reuse price history for 15 minutes

const HELP_TEXT = [
  "Hi! I can give you a view on stocks from your watchlist, based on their price trend, momentum and your own holdings.",
  "",
  "Try asking:",
  "• Should I buy TCS?",
  "• I already have INFY. Should I sell or hold?",
  "• Is HAL good for 1 year?",
  "• Which stocks look good now?",
  "• Review my portfolio",
].join("\n");

const NOT_SURE_TEXT = [
  "I wasn't sure which stock you mean. Please mention a stock from your watchlist, for example:",
  "• Should I buy Tata Power?",
  "• Is Cochin Shipyard good for 6 months?",
  "• Which stocks look good now?",
].join("\n");

/* ---------------- optional LLM ---------------- */

// ready-made settings, so you only need LLM_PROVIDER, LLM_API_KEY and LLM_MODEL
const PRESETS = {
  anthropic: "https://api.anthropic.com/v1/messages",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
};

function llmConfig() {
  const provider = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  const url = process.env.LLM_API_URL || PRESETS[provider];

  if (!key || !model || !url) return null;
  return { provider: provider || "custom", url, key, model };
}

const llmEnabled = () => llmConfig() !== null;

// small clean-up so the answer reads well in the chat window
const tidy = (text) =>
  text
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

async function askLLM(system, user) {
  const cfg = llmConfig();
  if (!cfg) return null;

  const isAnthropic = cfg.provider === "anthropic";
  const headers = { "Content-Type": "application/json" };
  let body;

  if (isAnthropic) {
    headers["x-api-key"] = cfg.key;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: cfg.model,
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: user }],
    };
  } else {
    // OpenAI-style endpoint (Groq, Gemini, OpenRouter, OpenAI and others)
    headers.Authorization = `Bearer ${cfg.key}`;
    body = {
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    if (cfg.provider === "openai") {
      body.max_completion_tokens = 600;
    } else {
      body.max_tokens = 600;
      body.temperature = 0.3;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`status ${res.status} ${detail.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = isAnthropic
      ? (data.content || [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("")
      : data?.choices?.[0]?.message?.content;

    return typeof text === "string" && text.trim() ? tidy(text) : null;
  } catch (err) {
    console.error(`LLM error (${cfg.provider}):`, err.message);
    return null; // the built-in answer is used instead
  } finally {
    clearTimeout(timer);
  }
}

const STOCK_SYSTEM_PROMPT = [
  "You are the VeloTrade assistant for Indian retail investors (NSE stocks).",
  "Answer ONLY from the data provided. Never invent prices, news, targets or events.",
  "Give a clear verdict that matches rule_verdict (BUY, HOLD, SELL, WAIT or AVOID), a suggested time period, 3 to 5 short reasons, and the main risks.",
  "If the user already holds the stock, say whether to hold, add or sell, using their average cost and profit or loss.",
  "If asked_horizon is given, speak to that time period.",
  "Plain text only, simple language, under 170 words. Never promise returns.",
  "Do not add a disclaimer, the app adds one.",
].join(" ");

const GENERAL_SYSTEM_PROMPT = [
  "You are the VeloTrade assistant for Indian retail investors.",
  "Answer questions about investing concepts and how to use a trading dashboard in simple language, in under 120 words.",
  "Do not give specific buy or sell calls on stocks here. If the user wants that, tell them to name a stock.",
  "Never promise returns. Do not add a disclaimer, the app adds one.",
].join(" ");

const round = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);

function factsFor(a, horizon, account) {
  return {
    stock: a.name,
    price: round(a.m.price),
    rule_verdict: a.d.verdict,
    rule_note: a.d.note,
    outlook: { short: a.o.short.label, medium: a.o.medium.label, long: a.o.long.label },
    average_20_day: round(a.m.sma20),
    average_50_day: round(a.m.sma50),
    average_200_day: round(a.m.sma200),
    rsi: round(a.m.rsi),
    return_1m_pct: round(a.m.ret1m),
    return_3m_pct: round(a.m.ret3m),
    return_6m_pct: round(a.m.ret6m),
    high_52w: round(a.m.high52),
    low_52w: round(a.m.low52),
    volatility_pct: round(a.m.vol),
    holding: a.holding
      ? { qty: a.holding.qty, average_cost: round(a.holding.avg), pnl_pct: round(a.holding.pnlPct) }
      : "not held",
    asked_horizon: horizon ? HORIZON_TEXT[horizon] : "not specified",
    available_funds: round(account.available),
  };
}

/* ---------------- the assistant ---------------- */

function createChat({ getDaily, fetchQuotes, HoldingsModel, FundsModel }) {
  const cfg = llmConfig();
  console.log(
    cfg
      ? `AI assistant: connected to ${cfg.provider} (${cfg.model})`
      : "AI assistant: running without an LLM (set LLM_PROVIDER, LLM_API_KEY and LLM_MODEL to enable one)"
  );

  async function loadAccount(userId) {
    const [holdings, funds] = await Promise.all([
      HoldingsModel.find({ user: userId }).lean(),
      FundsModel.findOne({ user: userId }).lean(),
    ]);
    return {
      holdings,
      available: funds ? funds.availableCash - funds.usedMargin : 0,
      portfolioValue: holdings.reduce((s, h) => s + h.qty * (h.price || h.avg || 0), 0),
    };
  }

  async function analyzeStock(name, account, { live = true } = {}) {
    const { bars } = await getDaily(name, HISTORY_TTL);
    const m = analyze(bars);

    if (live) {
      const quote = (await fetchQuotes([name]))[name];
      if (quote) m.price = quote.price;
    }

    const o = outlook(m);
    const h = account.holdings.find((x) => x.name === name && x.qty > 0);
    const holding = h
      ? {
          qty: h.qty,
          avg: h.avg,
          pnlPct: ((m.price - h.avg) / h.avg) * 100,
          pnlAmt: (m.price - h.avg) * h.qty,
        }
      : null;

    return { name, m, o, d: decide(m, o, holding), holding };
  }

  // analyse many stocks, a few at a time
  async function analyzeMany(names, account) {
    const results = [];
    for (let i = 0; i < names.length; i += 5) {
      const chunk = names.slice(i, i + 5);
      const settled = await Promise.allSettled(
        chunk.map((n) => analyzeStock(n, account, { live: false }))
      );
      settled.forEach((s, idx) => {
        if (s.status === "fulfilled") results.push(s.value);
        else console.error(`Advisor error for ${chunk[idx]}:`, s.reason?.cause?.code || s.reason?.message);
      });
      if (settled.every((s) => s.status === "rejected")) break; // data source is blocked
    }
    return results;
  }

  async function reviewPortfolio(account, horizon) {
    const names = account.holdings.filter((h) => h.qty > 0).map((h) => h.name).slice(0, 10);

    if (names.length === 0) {
      return {
        reply:
          "You don't hold any stocks yet, so there is nothing to review. Ask me \"Which stocks look good now?\" for ideas, or \"Should I buy TCS?\" for a specific stock.",
      };
    }

    const results = await analyzeMany(names, account);
    if (results.length === 0) {
      return { reply: "I couldn't load market data for your holdings right now. Please try again in a moment." };
    }

    const lines = [`Here is how your ${results.length} holding(s) look:`, ""];
    results.forEach((r) => {
      lines.push(
        `• ${r.name}: ${r.d.verdict}. ${r.holding.qty} share(s) at ${r.holding.avg.toFixed(2)}, P&L ${r.holding.pnlPct >= 0 ? "+" : ""}${r.holding.pnlPct.toFixed(1)}%. Outlook: short ${r.o.short.label}, medium ${r.o.medium.label}, long ${r.o.long.label}.`
      );
    });

    const sells = results.filter((r) => r.d.verdict === "SELL").map((r) => r.name);
    lines.push("");
    lines.push(
      sells.length
        ? `Worth a closer look: ${sells.join(", ")}. Ask me about any of them for the full reasoning.`
        : "Nothing looks urgent right now. Ask me about any stock for the full reasoning."
    );
    if (horizon) lines.push(`Outlook lines above show all periods; focus on the ${HORIZON_TEXT[horizon]} one.`);

    return { reply: lines.join("\n") };
  }

  async function rankWatchlist(account, horizon) {
    const results = await analyzeMany(Object.keys(STOCKS), account);
    if (results.length === 0) {
      return { reply: "I couldn't load market data right now. Please try again in a moment." };
    }

    const key = (r) => (horizon ? r.o[horizon].score * 10 + r.o.total : r.o.total);
    results.sort((a, b) => key(b) - key(a));

    const top = results.filter((r) => r.o.total >= 1.5 && r.d.verdict !== "AVOID").slice(0, 3);
    const weak = results.filter((r) => r.o.total <= -1.5).slice(-2).reverse();

    const lines = [];
    if (top.length) {
      lines.push(
        `Strongest on your watchlist right now${horizon ? ` for a ${HORIZON_TEXT[horizon]} view` : ""}:`
      );
      top.forEach((r) => lines.push(brief(r.name, r.m, r.o, r.d)));
    } else {
      lines.push("Nothing on your watchlist shows a strong setup right now. Waiting is a perfectly valid choice.");
    }

    if (weak.length) {
      lines.push("", "Weakest right now (better to avoid for the moment):");
      weak.forEach((r) => lines.push(brief(r.name, r.m, r.o, r.d)));
    }

    lines.push("", "Ask me about any of them, for example \"Should I buy " + (top[0] ? top[0].name : "TCS") + "?\", for the full reasoning.");
    return { reply: lines.join("\n") };
  }

  async function answerStocks(stocks, text, horizon, account) {
    const results = [];
    for (const name of stocks) {
      try {
        results.push(await analyzeStock(name, account));
      } catch (err) {
        console.error(`Advisor error for ${name}:`, err.cause?.code || err.message);
      }
    }

    if (results.length === 0) {
      return {
        reply: `I couldn't load market data for ${stocks.join(", ")} right now. Please try again in a moment.`,
      };
    }

    const ctx = { horizon, available: account.available, portfolioValue: account.portfolioValue };

    // several stocks: a short comparison
    if (results.length > 1) {
      const lines = [];
      results.forEach((r) => {
        lines.push(`${r.name}: ${r.d.verdict}`);
        lines.push(`Outlook: short ${r.o.short.label}, medium ${r.o.medium.label}, long ${r.o.long.label}.`);
        if (r.holding) lines.push(`You hold ${r.holding.qty} share(s), P&L ${r.holding.pnlPct >= 0 ? "+" : ""}${r.holding.pnlPct.toFixed(1)}%.`);
        lines.push("");
      });
      const best = [...results].sort((a, b) => b.o.total - a.o.total)[0];
      lines.push(`On the numbers, ${best.name} looks the strongest of these right now. Ask about one stock to see the full reasoning.`);
      return { reply: lines.join("\n"), stock: best.name };
    }

    // one stock: the full answer
    const r = results[0];
    let reply = describe(r.name, r.m, r.o, r.d, r.holding, ctx);

    const wantsToSell = /\b(sell|exit|book profit|dump)\b/.test(text);
    if (wantsToSell && !r.holding) {
      reply =
        `You don't hold ${r.name}, so there is nothing to sell right now. If you are thinking of buying it, here is how it looks:\n\n` +
        reply;
    }

    // optionally let the LLM word it more naturally, using the same facts
    const llmText = await askLLM(
      STOCK_SYSTEM_PROMPT,
      `User question: ${text}\n\nData:\n${JSON.stringify(factsFor(r, horizon, account))}`
    );

    return { reply: llmText || reply, verdict: r.d.verdict, stock: r.name };
  }

  // main entry
  return async function handleChat({ userId, message, lastStock }) {
    const text = message.toLowerCase().trim();
    let stocks = detectStocks(text);
    const horizon = detectHorizon(text);

    // follow-ups such as "and for 1 year?" or "what about it?"
    const followUp =
      /\b(it|this|that|same|also|again)\b|what about|how about/.test(text) ||
      (horizon && stocks.length === 0);
    if (stocks.length === 0 && lastStock && followUp) stocks = [lastStock];

    if (stocks.length === 0 && /^(hi|hii|hello|hey|namaste|help|what can you do)\b/.test(text)) {
      return { reply: HELP_TEXT };
    }

    const account = await loadAccount(userId);

    if (stocks.length === 0 && /(portfolio|my (holdings|stocks|shares)|all my)/.test(text)) {
      return reviewPortfolio(account, horizon);
    }

    if (stocks.length > 0) {
      return answerStocks(stocks, text, horizon, account);
    }

    if (/(which|what|best|top|good|recommend|suggest|pick)/.test(text) && /(stock|share|buy|invest|watchlist)/.test(text)) {
      return rankWatchlist(account, horizon);
    }

    // anything else: a general answer if an LLM is set up, otherwise a hint
    const general = await askLLM(GENERAL_SYSTEM_PROMPT, message);
    return { reply: general || NOT_SURE_TEXT };
  };
}

module.exports = { createChat, llmEnabled, ADVICE_DISCLAIMER };