import React, { useState, useEffect, useContext, useCallback } from "react";
import axios from "axios";

import GeneralContext from "./GeneralContext";

import "./TradeWindow.css";

const API = "http://localhost:3002";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const TradeWindow = ({ uid, mode }) => {
  const isBuy = mode === "BUY";
  const { closeBuyWindow, closeSellWindow } = useContext(GeneralContext);
  const close = isBuy ? closeBuyWindow : closeSellWindow;

  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState(null); // live market price
  const [priceFailed, setPriceFailed] = useState(false);
  const [funds, setFunds] = useState(null);
  const [holding, setHolding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState("");
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  const loadPrice = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/quotes`, {
        params: { symbols: uid },
      });
      const quote = res.data[uid.toUpperCase()];
      if (quote) {
        setPrice(quote.price);
        setPriceFailed(false);
      } else {
        setPriceFailed(true);
      }
    } catch (err) {
      setPriceFailed(true);
    }
  }, [uid]);

  // load funds (and holdings for a sell) once, and refresh the price every 5 seconds
  useEffect(() => {
    let cancelled = false;

    const loadAccount = async () => {
      try {
        const requests = [axios.get(`${API}/funds`, { withCredentials: true })];
        if (!isBuy) {
          requests.push(
            axios.get(`${API}/allHoldings`, { withCredentials: true })
          );
        }
        const [fundsRes, holdingsRes] = await Promise.all(requests);
        if (cancelled) return;

        setFunds(fundsRes.data);

        if (!isBuy) {
          const found = holdingsRes.data.find(
            (h) => h.name.toUpperCase() === uid.toUpperCase()
          );
          setHolding(found || null);
          if (!found) {
            setMessage(`You don't hold ${uid}, so it can't be sold.`);
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 401) {
          setNotLoggedIn(true);
        } else {
          setMessage("Could not load your account details. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAccount();
    loadPrice();
    const id = setInterval(loadPrice, 5000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [uid, isBuy, loadPrice]);

  const q = Number(qty);
  const validQty = Number.isInteger(q) && q > 0;
  const total = price && validQty ? q * price : 0;
  const available = funds ? funds.availableCash - funds.usedMargin : 0;
  const balanceAfter = isBuy ? available - total : available + total;
  const insufficient = isBuy && total > available;
  const tooMany = !isBuy && holding && validQty && q > holding.qty;

  const canSubmit =
    !loading &&
    !placing &&
    !notLoggedIn &&
    price &&
    validQty &&
    !insufficient &&
    !tooMany &&
    (isBuy || holding);

  const step = (delta) => {
    const current = validQty ? q : 0;
    setQty(String(Math.max(1, current + delta)));
    setMessage("");
  };

  const placeOrder = async () => {
    setPlacing(true);
    setMessage("");
    try {
      await axios.post(
        `${API}/newOrder`,
        { name: uid, qty: q, mode },
        { withCredentials: true }
      );
      close();
    } catch (err) {
      if (err.response?.status === 401) {
        setNotLoggedIn(true);
      } else {
        setMessage(
          err.response?.data?.message || "Order failed. Please try again."
        );
      }
      setPlacing(false);
    }
  };

  return (
    <div className="tw-backdrop" onClick={close}>
      <div
        className={`tw-window ${isBuy ? "tw-theme-buy" : "tw-theme-sell"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tw-header">
          <span className="tw-action">{isBuy ? "Buy" : "Sell"}</span>
          <span className="tw-stock">{uid}</span>
          <span className="tw-tag">NSE · Delivery</span>
        </div>

        {notLoggedIn ? (
          <div className="tw-body">
            <p className="tw-notice">Please log in to place orders.</p>
            <a href="http://localhost:3000/login" className="tw-login">
              Login
            </a>
          </div>
        ) : (
          <>
            <div className="tw-body">
              <div className="tw-price-box">
                <span className="tw-label">Market price</span>
                <span className="tw-price">
                  {price ? `₹${fmt(price)}` : "—"}
                </span>
                <span className={`tw-live ${priceFailed ? "tw-live-off" : ""}`}>
                  {priceFailed ? "Price unavailable" : "● Live"}
                </span>
              </div>

              <label className="tw-label" htmlFor="tw-qty">
                Quantity
              </label>
              <div className="tw-stepper">
                <button type="button" onClick={() => step(-1)}>
                  −
                </button>
                <input
                  id="tw-qty"
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => {
                    setQty(e.target.value);
                    setMessage("");
                  }}
                  disabled={!isBuy && !holding}
                />
                <button type="button" onClick={() => step(1)}>
                  +
                </button>
              </div>

              <div className="tw-summary">
                <div className="tw-row">
                  <span>Order value</span>
                  <span>₹{fmt(total)}</span>
                </div>
                {isBuy ? (
                  <div className="tw-row">
                    <span>Available funds</span>
                    <span>₹{fmt(available)}</span>
                  </div>
                ) : (
                  <div className="tw-row">
                    <span>Shares you hold</span>
                    <span>{holding ? holding.qty : 0}</span>
                  </div>
                )}
                <div
                  className={`tw-row tw-row-strong ${
                    insufficient ? "tw-negative" : ""
                  }`}
                >
                  <span>Balance after order</span>
                  <span>₹{fmt(balanceAfter)}</span>
                </div>
              </div>

              {insufficient && (
                <p className="tw-message">
                  Not enough funds for this order. Add funds or reduce the
                  quantity.
                </p>
              )}
              {tooMany && (
                <p className="tw-message">
                  You only hold {holding.qty} share(s) of {uid}.
                </p>
              )}
              {message && <p className="tw-message">{message}</p>}
              {loading && <p className="tw-info">Loading your account...</p>}
              <p className="tw-info">
                Orders are executed at the live market price.
              </p>
            </div>

            <div className="tw-footer">
              <button
                className="tw-confirm"
                onClick={placeOrder}
                disabled={!canSubmit}
              >
                {placing ? "Placing..." : isBuy ? "Buy" : "Sell"}
              </button>
              <button className="tw-cancel" onClick={close}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TradeWindow;