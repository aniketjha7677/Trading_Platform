require('dotenv').config();

const express = require("express");
const mongoose = require("mongoose");

const bodyParser = require('body-parser');
const cors = require('cors');

const { HoldingsModel } = require('./model/HoldingsModels');
const { PositionsModel } = require('./model/PositionsModel');
const { OrdersModel } = require('./model/OrdersModels');
const { FundsModel } = require('./model/FundsModel');
const { AlertModel } = require('./model/AlertModel');
const { WatchlistPrefModel } = require('./model/WatchlistPrefModel');
const { createChat, llmEnabled, ADVICE_DISCLAIMER } = require('./chatbot');

const cookieParser = require("cookie-parser");
const authRoute = require("./Routes/AuthRoute");
const { requireAuth } = require("./Middlewares/AuthMiddleware");

const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

const app = express();

// comma separated list of the frontend and dashboard addresses
const allowedOrigins = (
    process.env.CLIENT_ORIGINS || "http://localhost:3000,http://localhost:3001"
)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);
app.use(cookieParser());
app.use(bodyParser.json());
app.use("/", authRoute);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const round2 = (n) => Math.round(n * 100) / 100;

// an error we want to show to the user (insufficient funds, etc.)
class OrderError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

// watchlist names that differ from the NSE symbol
const SYMBOL_OVERRIDES = { HUL: "HINDUNILVR" };
// market indices use their own Yahoo symbols instead of "<NAME>.NS"
const INDEX_SYMBOLS = { NIFTY50: "^NSEI", SENSEX: "^BSESN" };
const toYahooSymbol = (name) =>
    INDEX_SYMBOLS[name] || `${SYMBOL_OVERRIDES[name] || name}.NS`;

// ---- live quotes, with a small cache so short internet drops don't break trading ----
const QUOTE_FRESH_MS = 20 * 1000;      // reuse a quote for 20 seconds
const QUOTE_STALE_MS = 5 * 60 * 1000;  // if Yahoo is unreachable, accept a quote up to 5 minutes old
const quoteCache = {};

// Fallback for servers where Yahoo blocks the batch quote call:
// one "chart" request per symbol (it needs no cookie or crumb).
async function fetchViaChart(name) {
    const result = await yahooFinance.chart(
        toYahooSymbol(name),
        { period1: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), interval: "1d" },
        { validateResult: false }
    );

    const closes = (result.quotes || [])
        .map((q) => q.close)
        .filter((c) => typeof c === "number");
    const price = result.meta?.regularMarketPrice ?? closes[closes.length - 1];
    if (typeof price !== "number") return null;

    // day change: latest price against the close before the latest trading day
    const previous = closes.length >= 2 ? closes[closes.length - 2] : null;
    const percent = previous ? ((price - previous) / previous) * 100 : 0;

    return { price, percent };
}

async function fetchQuotes(names) {
    const now = Date.now();
    const result = {};
    const needed = [];

    names.forEach((n) => {
        const cached = quoteCache[n];
        if (cached && now - cached.time < QUOTE_FRESH_MS) {
            result[n] = cached;
        } else {
            needed.push(n);
        }
    });

    if (needed.length > 0) {
        // 1) one batch request for all symbols
        try {
            const bySymbol = {};
            needed.forEach((n) => {
                bySymbol[toYahooSymbol(n)] = n;
            });

            const results = await yahooFinance.quote(
                Object.keys(bySymbol),
                {},
                { validateResult: false }
            );
            const list = Array.isArray(results) ? results : [results];

            list.forEach((q) => {
                const name = bySymbol[q.symbol];
                if (name && typeof q.regularMarketPrice === "number") {
                    quoteCache[name] = {
                        price: q.regularMarketPrice,
                        percent: q.regularMarketChangePercent || 0,
                        time: Date.now(),
                    };
                    result[name] = quoteCache[name];
                }
            });
        } catch (err) {
            console.error("Quotes batch error:", err.cause?.code || err.message);
        }

        // 2) anything still missing: try the chart endpoint, a few at a time
        const missing = needed.filter((n) => !result[n]);
        for (let i = 0; i < missing.length; i += 5) {
            const chunk = missing.slice(i, i + 5);
            const settled = await Promise.allSettled(chunk.map(fetchViaChart));
            let anySuccess = false;

            settled.forEach((s, idx) => {
                const name = chunk[idx];
                if (s.status === "fulfilled" && s.value) {
                    quoteCache[name] = { ...s.value, time: Date.now() };
                    result[name] = quoteCache[name];
                    anySuccess = true;
                } else if (s.status === "rejected") {
                    console.error(
                        `Chart error for ${name}:`,
                        s.reason?.cause?.code || s.reason?.message
                    );
                }
            });

            // if a whole group failed, Yahoo is blocking us: stop instead of waiting on every symbol
            if (!anySuccess) break;
        }

        // 3) still nothing: fall back to a recent cached quote
        needed.forEach((n) => {
            const cached = quoteCache[n];
            if (!result[n] && cached && now - cached.time < QUOTE_STALE_MS) {
                result[n] = cached;
            }
        });
    }

    return result;
}

// the price an order is executed at: always the live price, never user input
async function getLivePrice(name) {
    const quote = (await fetchQuotes([name]))[name];
    if (!quote) {
        throw new OrderError(
            "Live price is unavailable right now. Please try again in a moment.",
            503
        );
    }
    return round2(quote.price);
}

const getOrCreateFunds = (userId) =>
    FundsModel.findOneAndUpdate(
        { user: userId },
        { $setOnInsert: { user: userId } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

/* ------------------------------------------------------------------ */
/* quotes                                                              */
/* ------------------------------------------------------------------ */

app.get("/quotes", async (req, res) => {
    try {
        const names = (req.query.symbols || "")
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);

        const quotes = await fetchQuotes(names);

        const out = {};
        Object.keys(quotes).forEach((n) => {
            out[n] = { price: quotes[n].price, percent: quotes[n].percent };
        });
        res.json(out);
    } catch (err) {
        console.error("Quotes route error:", err);
        res.status(500).json({ message: "Failed to fetch quotes" });
    }
});

/* ------------------------------------------------------------------ */
/* holdings, positions                                                 */
/* ------------------------------------------------------------------ */

// the logged-in user's holdings, priced with live quotes
app.get('/allHoldings', requireAuth, async (req, res) => {
    try {
        const holdings = await HoldingsModel.find({ user: req.userId }).lean();
        const quotes = await fetchQuotes(holdings.map((h) => h.name));

        const enriched = holdings.map((h) => {
            const quote = quotes[h.name];
            const price = quote ? quote.price : h.price;
            const netPct = h.avg ? ((price - h.avg) / h.avg) * 100 : 0;
            const dayPct = quote ? quote.percent : 0;

            return {
                ...h,
                price,
                net: `${netPct >= 0 ? "+" : ""}${netPct.toFixed(2)}%`,
                day: `${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(2)}%`,
                isLoss: dayPct < 0,
            };
        });

        res.json(enriched);
    } catch (err) {
        console.error("Error fetching holdings:", err);
        res.status(500).json({ message: "Failed to fetch holdings" });
    }
});

app.get('/allPositions', async (req, res) => {
    let allPositions = await PositionsModel.find({});
    res.json(allPositions);
});

/* ------------------------------------------------------------------ */
/* orders                                                              */
/* ------------------------------------------------------------------ */

// order history of the logged-in user, newest first
app.get('/allOrders', requireAuth, async (req, res) => {
    try {
        const orders = await OrdersModel.find({ user: req.userId }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).json({ message: "Failed to fetch orders" });
    }
});

// Place a BUY or SELL at the live market price.
// Funds, holdings and the order record change together in one transaction.
app.post('/newOrder', requireAuth, async (req, res) => {
    const user = req.userId;
    const name = String(req.body.name || "").trim().toUpperCase();
    const mode = String(req.body.mode || "").toUpperCase();
    const qty = Number(req.body.qty);

    if (!name) {
        return res.status(400).json({ message: "Stock name is required." });
    }
    if (mode !== "BUY" && mode !== "SELL") {
        return res.status(400).json({ message: "Order type must be BUY or SELL." });
    }
    if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ message: "Quantity must be a whole number above 0." });
    }

    const session = await mongoose.startSession();
    try {
        const price = await getLivePrice(name);
        const total = round2(qty * price);
        let order;

        await session.withTransaction(async () => {
            const funds = await FundsModel.findOneAndUpdate(
                { user },
                { $setOnInsert: { user } },
                { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, session }
            );

            const existing = await HoldingsModel.findOne({ user, name }).session(session);

            if (mode === "BUY") {
                const available = funds.availableCash - funds.usedMargin;
                if (total > available) {
                    throw new OrderError(
                        `Insufficient funds. You need ₹${total.toFixed(2)} but only ₹${available.toFixed(2)} is available.`
                    );
                }

                await FundsModel.updateOne({ user }, { $inc: { availableCash: -total } }, { session });

                if (existing) {
                    const newQty = existing.qty + qty;
                    existing.avg = round2((existing.qty * existing.avg + qty * price) / newQty);
                    existing.qty = newQty;
                    existing.price = price;
                    await existing.save({ session });
                } else {
                    await HoldingsModel.create(
                        [{ user, name, qty, avg: price, price, net: "0.00%", day: "0.00%" }],
                        { session }
                    );
                }
            } else {
                if (!existing) {
                    throw new OrderError(`You don't hold ${name}, so it can't be sold.`);
                }
                if (qty > existing.qty) {
                    throw new OrderError(`You only hold ${existing.qty} share(s) of ${name}.`);
                }

                if (qty === existing.qty) {
                    await HoldingsModel.deleteOne({ _id: existing._id }, { session });
                } else {
                    existing.qty -= qty;
                    existing.price = price;
                    await existing.save({ session });
                }

                await FundsModel.updateOne({ user }, { $inc: { availableCash: total } }, { session });
            }

            const created = await OrdersModel.create([{ user, name, qty, price, mode }], { session });
            order = created[0];
        });

        res.status(201).json(order);
    } catch (err) {
        if (err instanceof OrderError) {
            return res.status(err.status).json({ message: err.message });
        }
        console.error("Error placing order:", err);
        res.status(500).json({ message: "Failed to place order" });
    } finally {
        session.endSession();
    }
});

/* ------------------------------------------------------------------ */
/* funds: one document per logged-in user                              */
/* ------------------------------------------------------------------ */

app.get('/funds', requireAuth, async (req, res) => {
    try {
        res.json(await getOrCreateFunds(req.userId));
    } catch (err) {
        console.error("Error fetching funds:", err);
        res.status(500).json({ message: "Failed to fetch funds" });
    }
});

app.post('/funds/add', requireAuth, async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
            return res
                .status(400)
                .json({ message: "Enter an amount between 1 and 10,00,000." });
        }

        await getOrCreateFunds(req.userId);
        const funds = await FundsModel.findOneAndUpdate(
            { user: req.userId },
            { $inc: { availableCash: amount, payin: amount } },
            { returnDocument: "after" }
        );
        res.json(funds);
    } catch (err) {
        console.error("Error adding funds:", err);
        res.status(500).json({ message: "Failed to add funds" });
    }
});

app.post('/funds/withdraw', requireAuth, async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ message: "Enter a valid amount." });
        }

        const current = await getOrCreateFunds(req.userId);
        const withdrawable = current.availableCash - current.usedMargin;
        if (amount > withdrawable) {
            return res.status(400).json({
                message: `You can withdraw up to ₹${withdrawable.toFixed(2)}.`,
            });
        }

        const funds = await FundsModel.findOneAndUpdate(
            { user: req.userId },
            { $inc: { availableCash: -amount } },
            { returnDocument: "after" }
        );
        res.json(funds);
    } catch (err) {
        console.error("Error withdrawing funds:", err);
        res.status(500).json({ message: "Failed to withdraw funds" });
    }
});

/* ------------------------------------------------------------------ */
/* stock details: key stats and price charts                           */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;
const chartCache = {};

// load from Yahoo, keep the result for a while, and if Yahoo is unreachable
// serve an older copy (up to 30 minutes old) instead of failing
async function cachedChart(key, ttlMs, loader) {
    const cached = chartCache[key];
    if (cached && Date.now() - cached.time < ttlMs) return cached.data;

    try {
        const data = await loader();
        chartCache[key] = { time: Date.now(), data };
        return data;
    } catch (err) {
        if (cached && Date.now() - cached.time < 30 * 60 * 1000) return cached.data;
        throw err;
    }
}

const toBars = (result) =>
    (result.quotes || [])
        .filter((q) => typeof q.close === "number")
        .map((q) => ({
            t: new Date(q.date).getTime(),
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume,
        }));

// about a year of daily candles: used for the stats and for the 1M / 6M / 1Y charts
const getDaily = (name, ttlMs = 60 * 1000) =>
    cachedChart(`daily:${name}`, ttlMs, async () => {
        const result = await yahooFinance.chart(
            toYahooSymbol(name),
            { period1: new Date(Date.now() - 370 * DAY_MS), interval: "1d" },
            { validateResult: false }
        );
        const bars = toBars(result);
        if (bars.length === 0) throw new Error("No chart data");
        return { bars, meta: result.meta || {} };
    });

// intraday candles for the 1D and 1W charts
const getIntraday = (name, days, interval) =>
    cachedChart(`intra:${name}:${days}:${interval}`, 60 * 1000, async () => {
        const result = await yahooFinance.chart(
            toYahooSymbol(name),
            { period1: new Date(Date.now() - days * DAY_MS), interval },
            { validateResult: false }
        );
        const bars = toBars(result);
        if (bars.length === 0) throw new Error("No chart data");
        return bars;
    });

const istDate = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// keep only the last N trading days that actually have data
const lastTradingDays = (bars, n) => {
    const days = [...new Set(bars.map((b) => istDate(b.t)))].slice(-n);
    return bars.filter((b) => days.includes(istDate(b.t)));
};

const symbolFrom = (req) => String(req.query.symbol || "").trim().toUpperCase();

app.get("/stats", async (req, res) => {
    const name = symbolFrom(req);
    if (!name) return res.status(400).json({ message: "symbol is required" });

    try {
        const { bars, meta } = await getDaily(name);
        const last = bars[bars.length - 1];
        const prev = bars.length > 1 ? bars[bars.length - 2] : null;

        const yearBars = bars.filter((b) => b.t >= Date.now() - 365 * DAY_MS);
        const highs = yearBars.map((b) => b.high).filter((v) => typeof v === "number");
        const lows = yearBars.map((b) => b.low).filter((v) => typeof v === "number");

        res.json({
            name,
            longName: meta.longName || meta.shortName || name,
            exchange: meta.fullExchangeName || "NSE",
            price: typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : last.close,
            open: last.open ?? null,
            high: last.high ?? null,
            low: last.low ?? null,
            prevClose: prev ? prev.close : null,
            volume: last.volume ?? null,
            high52: highs.length ? Math.max(...highs) : null,
            low52: lows.length ? Math.min(...lows) : null,
        });
    } catch (err) {
        console.error(`Stats error for ${name}:`, err.cause?.code || err.message);
        res.status(503).json({ message: "Stock details are unavailable right now." });
    }
});

const RANGES = {
    "1D": { type: "intraday", days: 6, interval: "5m", tradingDays: 1 },
    "1W": { type: "intraday", days: 10, interval: "30m", tradingDays: 5 },
    "1M": { type: "daily", days: 31 },
    "6M": { type: "daily", days: 183 },
    "1Y": { type: "daily", days: 366 },
};

app.get("/chart", async (req, res) => {
    const name = symbolFrom(req);
    const range = String(req.query.range || "1D").toUpperCase();
    const config = RANGES[range];
    if (!name || !config) {
        return res.status(400).json({ message: "A valid symbol and range are required." });
    }

    try {
        let bars;
        if (config.type === "intraday") {
            const all = await getIntraday(name, config.days, config.interval);
            bars = lastTradingDays(all, config.tradingDays);
        } else {
            const { bars: daily } = await getDaily(name);
            bars = daily.filter((b) => b.t >= Date.now() - config.days * DAY_MS);
        }

        res.json({ name, range, points: bars.map((b) => ({ t: b.t, v: b.close })) });
    } catch (err) {
        console.error(`Chart error for ${name} (${range}):`, err.cause?.code || err.message);
        res.status(503).json({ message: "Chart data is unavailable right now." });
    }
});

/* ------------------------------------------------------------------ */
/* price alerts (per user)                                             */
/* ------------------------------------------------------------------ */

const MAX_ACTIVE_ALERTS = 20;

app.get('/alerts', requireAuth, async (req, res) => {
    try {
        const alerts = await AlertModel.find({ user: req.userId }).sort({ createdAt: -1 });
        res.json(alerts);
    } catch (err) {
        console.error("Error fetching alerts:", err);
        res.status(500).json({ message: "Failed to fetch alerts" });
    }
});

app.post('/alerts', requireAuth, async (req, res) => {
    try {
        const name = String(req.body.name || "").trim().toUpperCase();
        const condition = req.body.condition;
        const target = Number(req.body.target);

        if (!name) {
            return res.status(400).json({ message: "Stock name is required." });
        }
        if (condition !== "above" && condition !== "below") {
            return res.status(400).json({ message: "Alert must be 'above' or 'below'." });
        }
        if (!Number.isFinite(target) || target <= 0) {
            return res.status(400).json({ message: "Enter a valid target price." });
        }

        const active = await AlertModel.countDocuments({ user: req.userId, triggered: false });
        if (active >= MAX_ACTIVE_ALERTS) {
            return res.status(400).json({
                message: `You can have up to ${MAX_ACTIVE_ALERTS} active alerts. Delete one first.`,
            });
        }

        // an alert that is already true would fire immediately, so refuse it
        const quote = (await fetchQuotes([name]))[name];
        if (quote) {
            if (condition === "above" && quote.price >= target) {
                return res.status(400).json({
                    message: `${name} is already at ₹${quote.price.toFixed(2)}. Choose a higher target.`,
                });
            }
            if (condition === "below" && quote.price <= target) {
                return res.status(400).json({
                    message: `${name} is already at ₹${quote.price.toFixed(2)}. Choose a lower target.`,
                });
            }
        }

        const alert = await AlertModel.create({
            user: req.userId,
            name,
            condition,
            target: round2(target),
        });
        res.status(201).json(alert);
    } catch (err) {
        console.error("Error creating alert:", err);
        res.status(500).json({ message: "Failed to create alert" });
    }
});

app.delete('/alerts/:id', requireAuth, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid alert id." });
        }
        const result = await AlertModel.deleteOne({ _id: req.params.id, user: req.userId });
        res.json({ deleted: result.deletedCount });
    } catch (err) {
        console.error("Error deleting alert:", err);
        res.status(500).json({ message: "Failed to delete alert" });
    }
});

// the dashboard calls this every few seconds: it returns the alerts that just fired
app.post('/alerts/check', requireAuth, async (req, res) => {
    try {
        const active = await AlertModel.find({ user: req.userId, triggered: false });
        if (active.length === 0) return res.json([]);

        const quotes = await fetchQuotes([...new Set(active.map((a) => a.name))]);
        const fired = [];

        for (const alert of active) {
            const quote = quotes[alert.name];
            if (!quote) continue;

            const hit = alert.condition === "above"
                ? quote.price >= alert.target
                : quote.price <= alert.target;
            if (!hit) continue;

            // the triggered:false filter stops two open tabs from firing the same alert twice
            const updated = await AlertModel.findOneAndUpdate(
                { _id: alert._id, triggered: false },
                { triggered: true, triggeredAt: new Date(), triggeredPrice: round2(quote.price) },
                { returnDocument: "after" }
            );
            if (updated) fired.push(updated);
        }

        res.json(fired);
    } catch (err) {
        console.error("Error checking alerts:", err);
        res.status(500).json({ message: "Failed to check alerts" });
    }
});

/* ------------------------------------------------------------------ */
/* watchlist: stocks a user has removed from their own list            */
/* ------------------------------------------------------------------ */

app.get('/watchlist/hidden', requireAuth, async (req, res) => {
    try {
        const prefs = await WatchlistPrefModel.findOne({ user: req.userId });
        res.json(prefs ? prefs.hidden : []);
    } catch (err) {
        console.error("Error fetching watchlist:", err);
        res.status(500).json({ message: "Failed to fetch watchlist" });
    }
});

app.post('/watchlist/hide', requireAuth, async (req, res) => {
    try {
        const name = String(req.body.name || "").trim().toUpperCase();
        if (!name) return res.status(400).json({ message: "Stock name is required." });

        const prefs = await WatchlistPrefModel.findOneAndUpdate(
            { user: req.userId },
            { $addToSet: { hidden: name } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );
        res.json(prefs.hidden);
    } catch (err) {
        console.error("Error updating watchlist:", err);
        res.status(500).json({ message: "Failed to update watchlist" });
    }
});

app.post('/watchlist/show', requireAuth, async (req, res) => {
    try {
        const name = String(req.body.name || "").trim().toUpperCase();
        if (!name) return res.status(400).json({ message: "Stock name is required." });

        const prefs = await WatchlistPrefModel.findOneAndUpdate(
            { user: req.userId },
            { $pull: { hidden: name } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );
        res.json(prefs.hidden);
    } catch (err) {
        console.error("Error updating watchlist:", err);
        res.status(500).json({ message: "Failed to update watchlist" });
    }
});

/* ------------------------------------------------------------------ */
/* AI assistant                                                        */
/* ------------------------------------------------------------------ */

const handleChat = createChat({ getDaily, fetchQuotes, HoldingsModel, FundsModel });

// at most 15 messages a minute per user (protects the price source and any LLM key)
const chatHits = {};
const MAX_CHATS_PER_MINUTE = 15;
const MAX_CHATS_PER_DAY = 100; // keeps a paid API key from being run up
const allowChat = (userId) => {
    const now = Date.now();
    const day = (chatHits[userId] || []).filter((t) => now - t < 24 * 60 * 60 * 1000);
    const lastMinute = day.filter((t) => now - t < 60 * 1000);

    if (lastMinute.length >= MAX_CHATS_PER_MINUTE || day.length >= MAX_CHATS_PER_DAY) {
        chatHits[userId] = day;
        return false;
    }
    day.push(now);
    chatHits[userId] = day;
    return true;
};

// tells the chat window whether an AI model is connected
app.get('/chat/status', (req, res) => {
    res.json({ aiEnabled: llmEnabled() });
});

app.post('/chat', requireAuth, async (req, res) => {
    try {
        if (!allowChat(req.userId)) {
            return res
                .status(429)
                .json({ message: "You've reached the chat limit for now. Please wait a little and try again." });
        }

        const message = String(req.body.message || "").trim().slice(0, 500);
        if (!message) {
            return res.status(400).json({ message: "Please type a question." });
        }

        const lastStock = String(req.body.lastStock || "").trim().toUpperCase().slice(0, 15);
        const answer = await handleChat({ userId: req.userId, message, lastStock });

        // the advice notice is added here, so every answer ends with it
        res.json({ ...answer, disclaimer: ADVICE_DISCLAIMER });
    } catch (err) {
        console.error("Chat error:", err);
        res.status(500).json({ message: "Sorry, I couldn't answer that right now. Please try again." });
    }
});

// simple check used to wake up / monitor the hosted server
app.get("/health", (req, res) => res.send("ok"));

app.listen(PORT, () => {
    console.log("app started");
    mongoose.connect(uri);
    console.log("DBconnected!");
});