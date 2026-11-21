import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

import "./Funds.css";

const API = "http://localhost:3002";
const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const Funds = () => {
  const [funds, setFunds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [action, setAction] = useState(null); // "add" | "withdraw" | null
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState(null); // { type, text }
  const [busy, setBusy] = useState(false);

  const loadFunds = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/funds`, { withCredentials: true });
      setFunds(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setNotLoggedIn(true);
      } else {
        console.error("Could not load funds:", err);
        setLoadError("Could not load your funds. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFunds();
  }, [loadFunds]);

  const openAction = (type) => {
    setAction(type);
    setAmount("");
    setMessage(null);
  };

  const closeAction = () => {
    setAction(null);
    setAmount("");
  };

  const submitAction = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage({ type: "error", text: "Enter an amount greater than 0." });
      return;
    }

    setBusy(true);
    try {
      const res = await axios.post(
        `${API}/funds/${action}`,
        { amount: value },
        { withCredentials: true }
      );
      setFunds(res.data);
      setMessage({
        type: "success",
        text:
          action === "add"
            ? `₹${fmt(value)} added to your account.`
            : `₹${fmt(value)} withdrawn from your account.`,
      });
      closeAction();
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Something went wrong. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="fp-page">
        <p className="fp-muted">Loading your funds...</p>
      </div>
    );
  }

  if (notLoggedIn) {
    return (
      <div className="fp-page">
        <div className="fp-empty">
          <p>Please log in to see your funds</p>
          <a href="http://localhost:3000/login" className="fp-btn fp-btn-blue">
            Login
          </a>
        </div>
      </div>
    );
  }

  if (loadError || !funds) {
    return (
      <div className="fp-page">
        <div className="fp-banner fp-banner-error">{loadError}</div>
      </div>
    );
  }

  const availableMargin = funds.availableCash - funds.usedMargin;
  const totalCollateral = funds.collateralLiquid + funds.collateralEquity;

  const detailRows = [
    ["Opening balance", funds.openingBalance],
    ["Payin", funds.payin],
    ["SPAN", funds.span],
    ["Delivery margin", funds.deliveryMargin],
    ["Exposure", funds.exposure],
    ["Options premium", funds.optionsPremium],
    ["Collateral (Liquid funds)", funds.collateralLiquid],
    ["Collateral (Equity)", funds.collateralEquity],
    ["Total collateral", totalCollateral],
  ];

  return (
    <div className="fp-page">
      <div className="fp-header">
        <div className="fp-title">
          <h2>Funds</h2>
          <p>Instant, zero-cost fund transfers with UPI</p>
        </div>
        <div className="fp-actions">
          <button
            className="fp-btn fp-btn-green"
            onClick={() => openAction("add")}
          >
            + Add funds
          </button>
          <button
            className="fp-btn fp-btn-blue"
            onClick={() => openAction("withdraw")}
          >
            Withdraw
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`fp-banner ${
            message.type === "success" ? "fp-banner-success" : "fp-banner-error"
          }`}
        >
          {message.text}
        </div>
      )}

      {action && (
        <div className="fp-panel">
          <h4>{action === "add" ? "Add funds" : "Withdraw funds"}</h4>
          <div className="fp-panel-row">
            <span className="fp-rupee">₹</span>
            <input
              type="number"
              min="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setMessage(null);
              }}
              autoFocus
            />
          </div>

          {action === "add" && (
            <div className="fp-chips">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="fp-chip"
                  onClick={() => setAmount(String(q))}
                >
                  +₹{q.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          )}

          {action === "withdraw" && (
            <p className="fp-muted">
              You can withdraw up to ₹{fmt(availableMargin)}
            </p>
          )}

          <div className="fp-panel-actions">
            <button
              className={`fp-btn ${
                action === "add" ? "fp-btn-green" : "fp-btn-blue"
              }`}
              onClick={submitAction}
              disabled={busy}
            >
              {busy ? "Please wait..." : "Confirm"}
            </button>
            <button className="fp-btn fp-btn-grey" onClick={closeAction}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="fp-cards">
        <div className="fp-card fp-card-green">
          <span className="fp-card-label">Available margin</span>
          <span className="fp-card-value">₹{fmt(availableMargin)}</span>
        </div>
        <div className="fp-card fp-card-orange">
          <span className="fp-card-label">Used margin</span>
          <span className="fp-card-value">₹{fmt(funds.usedMargin)}</span>
        </div>
        <div className="fp-card fp-card-blue">
          <span className="fp-card-label">Available cash</span>
          <span className="fp-card-value">₹{fmt(funds.availableCash)}</span>
        </div>
      </div>

      <div className="fp-grid">
        <div className="fp-box">
          <h3>Equity</h3>
          {detailRows.map(([label, value]) => (
            <div className="fp-row" key={label}>
              <span>{label}</span>
              <span>{fmt(value)}</span>
            </div>
          ))}
        </div>

        <div className="fp-box fp-commodity">
          <h3>Commodity</h3>
          <p>You don't have a commodity account</p>
          <button className="fp-btn fp-btn-blue">Open Account</button>
        </div>
      </div>
    </div>
  );
};

export default Funds;