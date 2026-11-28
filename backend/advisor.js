// Turns a stock's daily price history into a plain-language buy / hold / sell view.
// Pure functions only: no network, no database. All the numbers come from the price history.

const DAY_MS = 24 * 60 * 60 * 1000;

const ADVICE_DISCLAIMER =
  "⚠️ This is only an advice based on past price data. It is not a guarantee and not a personal recommendation. " +
  "Markets can go against any view, so do your own research and invest only what you can afford to lose.";

// the stocks the assistant knows by name, with the ways people write them
const STOCKS = {
  INFY: ["infosys", "infy"],
  ONGC: ["ongc", "oil and natural gas"],
  TCS: ["tcs", "tata consultancy"],
  KPITTECH: ["kpittech", "kpit tech", "kpit"],
  QUICKHEAL: ["quickheal", "quick heal"],
  WIPRO: ["wipro"],
  "M&M": ["m&m", "mahindra"],
  RELIANCE: ["reliance", "ril"],
  HUL: ["hul", "hindustan unilever", "hindunilvr"],
  TATAPOWER: ["tatapower", "tata power"],
  ADANIPOWER: ["adanipower", "adani power"],
  COCHINSHIP: ["cochinship", "cochin shipyard", "cochin ship"],
  HAL: ["hal", "hindustan aeronautics"],
  BDL: ["bdl", "bharat dynamics"],
  HUDCO: ["hudco"],
  BEL: ["bel", "bharat electronics"],
  MAZDOCK: ["mazdock", "mazagon dock", "mazagon"],
  GRSE: ["grse", "garden reach"],
  IRFC: ["irfc"],
  RVNL: ["rvnl", "rail vikas"],
  NTPC: ["ntpc"],
  SBIN: ["sbin", "sbi", "state bank"],
  HDFCBANK: ["hdfcbank", "hdfc bank", "hdfc"],
  ITC: ["itc"],
  BHARTIARTL: ["bhartiartl", "bharti airtel", "airtel"],
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// edit distance that counts a swapped pair of letters ("relaince") as one mistake
function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[rows - 1][cols - 1];
}

// short names (like HAL or ITC) must match exactly, longer names may have typos
const allowedMistakes = (len) => (len <= 4 ? 0 : Math.min(3, Math.max(1, Math.floor(len / 6))));

// which stocks does the message talk about? (in the order they appear, at most 3)
function detectStocks(text) {
  const lower = text.toLowerCase();
  const found = new Map(); // symbol -> position in the message

  // 1) exact names
  Object.entries(STOCKS).forEach(([symbol, aliases]) => {
    aliases.forEach((alias) => {
      const re = new RegExp(`(^|[^a-z0-9&])${escapeRegex(alias)}($|[^a-z0-9&])`);
      const m = re.exec(lower);
      if (m && (!found.has(symbol) || m.index < found.get(symbol))) found.set(symbol, m.index);
    });
  });

  // 2) names with typos, e.g. "cochine shipward", "relaince", "tata powr"
  const tokens = lower.split(/[^a-z0-9&]+/).filter(Boolean);
  Object.entries(STOCKS).forEach(([symbol, aliases]) => {
    if (found.has(symbol)) return;

    aliases.forEach((alias) => {
      const mistakes = allowedMistakes(alias.length);
      if (mistakes === 0) return;

      const words = alias.split(" ").length;
      for (let i = 0; i + words <= tokens.length; i++) {
        const candidate = tokens.slice(i, i + words).join(" ");
        if (Math.abs(candidate.length - alias.length) > mistakes) continue;
        if (editDistance(candidate, alias) <= mistakes) {
          if (!found.has(symbol) || i < found.get(symbol)) found.set(symbol, i * 100);
        }
      }
    });
  });

  return [...found.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([symbol]) => symbol);
}

// which time period does the user care about? "short" | "medium" | "long" | null
function detectHorizon(text) {
  const t = text.toLowerCase();
  if (/(long[- ]?term|\byears?\b|decade|retire)/.test(t)) return "long";
  if (/(intraday|today|tomorrow|short[- ]?term|\bweeks?\b|\bdays?\b|\b1 ?months?\b|one month)/.test(t)) return "short";
  if (/(medium|\bmonths?\b)/.test(t)) return "medium";
  return null;
}

const HORIZON_TEXT = {
  short: "short-term (1–4 weeks)",
  medium: "medium-term (3–6 months)",
  long: "long-term (1+ year)",
};

/* ---------------- indicators ---------------- */

const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sma = (closes, n) => (closes.length >= n ? avg(closes.slice(-n)) : null);

// Relative Strength Index (Wilder). Above 70 is "overbought", below 30 "oversold".
function rsi(closes, period = 14) {
  if (closes.length <= period) return null;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

const returnOver = (closes, bars) =>
  closes.length > bars
    ? (closes[closes.length - 1] / closes[closes.length - 1 - bars] - 1) * 100
    : null;

// yearly volatility in % (how much the price typically swings)
function volatility(closes, n = 60) {
  const slice = closes.slice(-(n + 1));
  if (slice.length < 20) return null;
  const rets = [];
  for (let i = 1; i < slice.length; i++) rets.push(Math.log(slice[i] / slice[i - 1]));
  const mean = avg(rets);
  const variance = avg(rets.map((r) => (r - mean) ** 2));
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

// bars: [{ t, open, high, low, close, volume }], oldest first
function analyze(bars) {
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => (typeof b.high === "number" ? b.high : b.close));
  const lows = bars.map((b) => (typeof b.low === "number" ? b.low : b.close));

  const high52 = Math.max(...highs);
  const low52 = Math.min(...lows);
  const price = closes[closes.length - 1];

  return {
    price,
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    rsi: rsi(closes),
    ret1m: returnOver(closes, 21),
    ret3m: returnOver(closes, 63),
    ret6m: returnOver(closes, 126),
    high52,
    low52,
    pos52: high52 > low52 ? ((price - low52) / (high52 - low52)) * 100 : null,
    low20: Math.min(...lows.slice(-20)),
    high20: Math.max(...highs.slice(-20)),
    vol: volatility(closes),
  };
}

const outlookLabel = (s) => (s >= 1 ? "Positive" : s <= -1 ? "Negative" : "Neutral");

// score the outlook for three time periods
function outlook(m) {
  const above = (a, b) => (a !== null && b !== null ? (a > b ? 1 : -1) : 0);

  const short =
    above(m.price, m.sma20) +
    (m.rsi !== null ? (m.rsi < 30 ? 1 : m.rsi > 70 ? -1 : 0) : 0) +
    (m.ret1m !== null ? (m.ret1m > 2 ? 0.5 : m.ret1m < -2 ? -0.5 : 0) : 0);

  const medium =
    above(m.price, m.sma50) +
    (m.ret3m !== null ? (m.ret3m > 5 ? 1 : m.ret3m < -5 ? -1 : 0) : 0) +
    above(m.sma20, m.sma50) * 0.5;

  const long =
    above(m.price, m.sma200) +
    above(m.sma50, m.sma200) +
    (m.ret6m !== null ? (m.ret6m > 10 ? 0.5 : m.ret6m < -10 ? -0.5 : 0) : 0);

  return {
    short: { score: short, label: outlookLabel(short) },
    medium: { score: medium, label: outlookLabel(medium) },
    long: { score: long, label: outlookLabel(long) },
    total: short + medium + long, // roughly -7.5 to +7.5
  };
}

// holding: null, or { qty, avg, pnlPct }
function decide(m, o, holding) {
  const total = o.total;
  const overbought = m.rsi !== null && m.rsi > 72;

  if (!holding) {
    if (total >= 3.5) return overbought ? { verdict: "WAIT", note: "stretched" } : { verdict: "BUY", note: "strong" };
    if (total >= 1.5) return overbought ? { verdict: "WAIT", note: "stretched" } : { verdict: "BUY", note: "cautious" };
    if (total > -1.5) return { verdict: "WAIT", note: "mixed" };
    return { verdict: "AVOID", note: "weak" };
  }

  const pnl = holding.pnlPct;
  if (pnl >= 25 && overbought) return { verdict: "SELL", note: "book-profit" };
  if (pnl <= -15 && total <= -1.5) return { verdict: "SELL", note: "cut-loss" };
  if (total <= -3.5) return { verdict: "SELL", note: "weak" };
  if (total <= -1.5) return { verdict: "HOLD", note: "weak-hold" };
  if (total >= 1.5) return { verdict: "HOLD", note: "strong-hold" };
  return { verdict: "HOLD", note: "mixed" };
}

/* ---------------- wording ---------------- */

const inr = (n) =>
  "₹" +
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function headline(name, m, d, holding) {
  const rsiText = m.rsi !== null ? m.rsi.toFixed(0) : "high";

  if (!holding) {
    switch (`${d.verdict}/${d.note}`) {
      case "BUY/strong":
        return `${name} looks strong right now: the trend, momentum and long-term picture all support it. It can be a buy.`;
      case "BUY/cautious":
        return `${name} looks reasonably positive, but not every signal agrees. If you buy, do it in small parts rather than all at once.`;
      case "WAIT/stretched":
        return `${name} is in an uptrend, but it has run up fast (RSI ${rsiText}). Waiting for a small dip usually gives a better entry price.`;
      case "WAIT/mixed":
        return `The signals for ${name} are mixed, so there is no clear edge right now. Waiting is reasonable.`;
      default:
        return `${name} is in a downtrend right now. It is better to stay away until the trend improves.`;
    }
  }

  switch (`${d.verdict}/${d.note}`) {
    case "SELL/book-profit":
      return `You are up ${pct(holding.pnlPct)} on ${name} and it looks overbought. Booking part of the profit (say a third to half) is sensible.`;
    case "SELL/cut-loss":
      return `${name} is down ${Math.abs(holding.pnlPct).toFixed(1)}% for you and the trend is still weak. Cutting the loss to protect your money is reasonable.`;
    case "SELL/weak":
      return `${name} has turned clearly weak. Selling or reducing your position makes sense.`;
    case "HOLD/weak-hold":
      return `${name} looks weak, but there is no strong sell signal yet. Hold with a stop-loss and watch it closely.`;
    case "HOLD/strong-hold":
      return `${name} looks healthy. Holding makes sense, and you may add on small dips.`;
    default:
      return `The signals for ${name} are mixed. Holding is fine, and there is no need to act in a hurry.`;
  }
}

function reasons(m) {
  const out = [];

  if (m.sma50 !== null && m.sma200 !== null) {
    const a50 = m.price > m.sma50;
    const a200 = m.price > m.sma200;
    if (a50 && a200) {
      out.push(`Trading above its 50-day (${inr(m.sma50)}) and 200-day (${inr(m.sma200)}) averages, a healthy uptrend.`);
    } else if (!a50 && !a200) {
      out.push(`Trading below its 50-day (${inr(m.sma50)}) and 200-day (${inr(m.sma200)}) averages, a downtrend.`);
    } else {
      out.push(
        `Mixed trend: ${a50 ? "above" : "below"} the 50-day average (${inr(m.sma50)}) but ${a200 ? "above" : "below"} the 200-day (${inr(m.sma200)}).`
      );
    }
  } else if (m.sma20 !== null) {
    out.push(`Trading ${m.price > m.sma20 ? "above" : "below"} its 20-day average (${inr(m.sma20)}).`);
  }

  const rets = [];
  if (m.ret1m !== null) rets.push(`1 month ${pct(m.ret1m)}`);
  if (m.ret3m !== null) rets.push(`3 months ${pct(m.ret3m)}`);
  if (m.ret6m !== null) rets.push(`6 months ${pct(m.ret6m)}`);
  if (rets.length) out.push(`Returns: ${rets.join(", ")}.`);

  if (m.rsi !== null) {
    if (m.rsi > 70) out.push(`RSI is ${m.rsi.toFixed(0)}: overbought, so a pullback is possible.`);
    else if (m.rsi < 30) out.push(`RSI is ${m.rsi.toFixed(0)}: oversold. Bounces are possible, but it can also stay weak.`);
    else out.push(`RSI is ${m.rsi.toFixed(0)}: neither overbought nor oversold.`);
  }

  if (m.pos52 !== null) {
    out.push(`It is ${m.pos52.toFixed(0)}% of the way up its 52-week range (${inr(m.low52)} to ${inr(m.high52)}).`);
  }

  return out;
}

function plan(name, m, d, holding) {
  const key = `${d.verdict}/${d.note}`;
  switch (key) {
    case "BUY/strong":
      return "Suggested holding period: 6–12 months. Review it once a month.";
    case "BUY/cautious":
      return "Suggested holding period: 3–6 months. Buy in 2–3 parts, not all at once.";
    case "WAIT/stretched":
      return `Check again in 1–2 weeks, or buy after a dip toward ${m.sma20 ? inr(m.sma20) : "its recent average"}.`;
    case "WAIT/mixed":
      return m.sma50
        ? `Check again in 2–4 weeks. A close above its 50-day average (${inr(m.sma50)}) would be a better sign.`
        : "Check again in 2–4 weeks.";
    case "AVOID/weak":
      return m.sma50
        ? `Revisit in 4–6 weeks, or when it climbs back above its 50-day average (${inr(m.sma50)}).`
        : "Revisit in 4–6 weeks.";
    case "HOLD/strong-hold":
      return `Hold for 6 months or more. Consider a stop-loss below ${inr(m.sma50 || m.low20)}.`;
    case "HOLD/weak-hold":
      return `Hold for now, but exit if it closes below ${inr(m.low20)} (its 20-day low).`;
    case "HOLD/mixed":
      return `Hold for 3–6 months. Exit if it falls below ${inr(m.sma200 || m.low20)}.`;
    case "SELL/book-profit":
      return `Sell part of it now and keep the rest with a stop-loss near ${inr(m.sma20 || m.low20)}.`;
    default:
      return `Sell in parts rather than all at once. A bounce toward ${inr(m.sma20 || m.high20)} can be used to exit.`;
  }
}

// full answer for one stock
// ctx: { horizon, available, portfolioValue }
function describe(name, m, o, d, holding, ctx = {}) {
  const lines = [];
  lines.push(`${name} is at ${inr(m.price)}.`);
  lines.push(headline(name, m, d, holding));

  if (holding) {
    lines.push(
      `Your position: ${holding.qty} share(s) bought at an average of ${inr(holding.avg)}, now ${pct(holding.pnlPct)} (${holding.pnlAmt >= 0 ? "+" : "-"}${inr(Math.abs(holding.pnlAmt))}).`
    );
  }

  lines.push("", "Why:");
  reasons(m).forEach((r) => lines.push(`• ${r}`));

  lines.push("", "Outlook by time period:");
  lines.push(`• Short term (1–4 weeks): ${o.short.label}`);
  lines.push(`• Medium term (3–6 months): ${o.medium.label}`);
  lines.push(`• Long term (1+ year): ${o.long.label}`);
  if (ctx.horizon) {
    lines.push(`For your ${HORIZON_TEXT[ctx.horizon]} view, the outlook is ${o[ctx.horizon].label}.`);
  }

  lines.push("", plan(name, m, d, holding));

  if (m.vol !== null) {
    const level = m.vol < 25 ? "low" : m.vol < 40 ? "medium" : "high";
    lines.push(`Risk: ${level} volatility (about ${m.vol.toFixed(0)}% a year). Avoid putting more than about 10% of your money in one stock.`);
  }
  lines.push(`Reference levels: support ${inr(m.low20)} (20-day low), resistance ${inr(m.high52)} (52-week high).`);

  if (!holding && d.verdict === "BUY" && typeof ctx.available === "number") {
    const cap = 0.1 * (ctx.available + (ctx.portfolioValue || 0));
    const shares = Math.floor(cap / m.price);
    lines.push(
      shares >= 1
        ? `Position size: 10% of your money is about ${inr(cap)}, roughly ${shares} share(s) at ${inr(m.price)}.`
        : `Position size: one share costs more than 10% of your money, so go slowly or add funds first.`
    );
  }

  return lines.join("\n");
}

// one short line, used when ranking many stocks
function brief(name, m, o, d) {
  const bits = [];
  if (m.sma50 !== null) bits.push(m.price > m.sma50 ? "above 50-day avg" : "below 50-day avg");
  if (m.ret3m !== null) bits.push(`3M ${pct(m.ret3m)}`);
  if (m.rsi !== null) bits.push(`RSI ${m.rsi.toFixed(0)}`);
  return `• ${name} (${d.verdict}): ${bits.join(", ")}`;
}

module.exports = {
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
  DAY_MS,
};