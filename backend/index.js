require('dotenv').config();

const express = require("express");
const mongoose = require("mongoose");

const bodyParser = require('body-parser');
const cors = require('cors');

const { HoldingsModel } = require('./model/HoldingsModels');
const { PositionsModel } = require('./model/PositionsModel');
const { OrdersModel } = require('./model/OrdersModels');
const { FundsModel } = require('./model/FundsModel');

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
const toYahooSymbol = (name) => `${SYMBOL_OVERRIDES[name] || name}.NS`;

// ---- live quotes, with a small cache so short internet drops don't break trading ----
const QUOTE_FRESH_MS = 10 * 1000;      // reuse a quote for 10 seconds
const QUOTE_STALE_MS = 5 * 60 * 1000;  // if Yahoo is unreachable, accept a quote up to 5 minutes old
const quoteCache = {};

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
                        time: now,
                    };
                    result[name] = quoteCache[name];
                }
            });
        } catch (err) {
            console.error("Quotes error:", err.cause?.code || err.message);
        }

        // Yahoo failed or skipped a symbol: fall back to a recent cached quote
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

// simple check used to wake up / monitor the hosted server
app.get("/health", (req, res) => res.send("ok"));

app.listen(PORT, () => {
    console.log("app started");
    mongoose.connect(uri);
    console.log("DBconnected!");
});