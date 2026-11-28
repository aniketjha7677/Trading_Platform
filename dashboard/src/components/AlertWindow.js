import React, { useState, useEffect, useContext, useCallback } from "react";
import axios from "axios";

import GeneralContext from "./GeneralContext";

import "./StockWindows.css";

const API = "http://localhost:3002";
const QUICK_PERCENTS = [-5, -2, -1, 1, 2, 5];

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const when = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });

const AlertWindow = ({ uid }) => {
  const { closeAlertWindow } = useContext(GeneralContext);

  const [price, setPrice] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [condition, setCondition] = useState("above");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/alerts`, { withCredentials: true });
      setAlerts(res.data.filter((a) => a.name === uid.toUpperCase()));
    } catch (err) {
      if (err.response?.status === 401) {
        setNotLoggedIn(true);
      } else {
        setMessage("Could not load your alerts. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // live price, refreshed every 10 seconds
  useEffect(() => {
    let cancelled = false;

    const loadPrice = async () => {
      try {
        const res = await axios.get(`${API}/quotes`, {
          params: { symbols: uid },
        });
        const quote = res.data[uid.toUpperCase()];
        if (quote && !cancelled) setPrice(quote.price);
      } catch (err) {
        // keep the last price
      }
    };

    loadPrice();
    const id = setInterval(loadPrice, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [uid]);

  // suggest a target 2% above the price the first time it loads
  useEffect(() => {
    if (price) {
      setTarget((t) => (t === "" ? (price * 1.02).toFixed(2) : t));
    }
  }, [price]);

  const applyPercent = (percent) => {
    if (!price) return;
    setCondition(percent > 0 ? "above" : "below");
    setTarget((price * (1 + percent / 100)).toFixed(2));
    setMessage("");
    setSuccess("");
  };

  const createAlert = async () => {
    const value = Number(target);
    setSuccess("");

    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Enter a valid target price.");
      return;
    }
    if (price && condition === "above" && value <= price) {
      setMessage("For an 'above' alert the target must be higher than the current price.");
      return;
    }
    if (price && condition === "below" && value >= price) {
      setMessage("For a 'below' alert the target must be lower than the current price.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await axios.post(
        `${API}/alerts`,
        { name: uid, condition, target: value },
        { withCredentials: true }
      );
      setSuccess(
        `Alert set: you'll be notified when ${uid} goes ${condition} ₹${fmt(value)}.`
      );
      await loadAlerts();
    } catch (err) {
      if (err.response?.status === 401) {
        setNotLoggedIn(true);
      } else {
        setMessage(err.response?.data?.message || "Could not create the alert.");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteAlert = async (id) => {
    try {
      await axios.delete(`${API}/alerts/${id}`, { withCredentials: true });
      await loadAlerts();
    } catch (err) {
      setMessage("Could not delete the alert. Please try again.");
    }
  };

  const active = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  return (
    <div className="sw-backdrop" onClick={closeAlertWindow}>
      <div className="sw-window sw-alert" onClick={(e) => e.stopPropagation()}>
        <div className="sw-head">
          <div>
            <h3>Price alert · {uid}</h3>
            <p className="sw-sub">
              Current price {price ? `₹${fmt(price)}` : "—"}
            </p>
          </div>
          <button className="sw-close" onClick={closeAlertWindow} aria-label="Close">
            ✕
          </button>
        </div>

        {notLoggedIn ? (
          <div className="sw-body sw-center">
            <p>Please log in to create alerts.</p>
            <a href="http://localhost:3000/login" className="sw-btn sw-btn-buy">
              Login
            </a>
          </div>
        ) : (
          <div className="sw-body">
            <div className="sw-toggle">
              <button
                className={condition === "above" ? "sw-toggle-on" : ""}
                onClick={() => setCondition("above")}
              >
                Goes above
              </button>
              <button
                className={condition === "below" ? "sw-toggle-on" : ""}
                onClick={() => setCondition("below")}
              >
                Falls below
              </button>
            </div>

            <label className="sw-label" htmlFor="sw-target">
              Target price
            </label>
            <div className="sw-input">
              <span>₹</span>
              <input
                id="sw-target"
                type="number"
                step="0.05"
                min="0"
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setMessage("");
                  setSuccess("");
                }}
              />
            </div>

            <div className="sw-chips">
              {QUICK_PERCENTS.map((p) => (
                <button key={p} className="sw-chip" onClick={() => applyPercent(p)}>
                  {p > 0 ? "+" : ""}
                  {p}%
                </button>
              ))}
            </div>

            {message && <p className="sw-error">{message}</p>}
            {success && <p className="sw-success">{success}</p>}

            <button
              className="sw-btn sw-btn-alert"
              onClick={createAlert}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : "Create alert"}
            </button>

            <h4 className="sw-list-title">Active alerts</h4>
            {loading && <p className="sw-muted">Loading...</p>}
            {!loading && active.length === 0 && (
              <p className="sw-muted">No active alerts for {uid}.</p>
            )}
            {active.map((a) => (
              <div className="sw-alert-row" key={a._id}>
                <span>
                  {a.condition === "above" ? "Above" : "Below"} ₹{fmt(a.target)}
                </span>
                <button
                  className="sw-link-danger"
                  onClick={() => deleteAlert(a._id)}
                >
                  Delete
                </button>
              </div>
            ))}

            {triggered.length > 0 && (
              <>
                <h4 className="sw-list-title">Triggered</h4>
                {triggered.map((a) => (
                  <div className="sw-alert-row sw-alert-done" key={a._id}>
                    <span>
                      {a.condition === "above" ? "Above" : "Below"} ₹{fmt(a.target)}
                      <small>
                        hit at ₹{fmt(a.triggeredPrice)} · {when(a.triggeredAt)}
                      </small>
                    </span>
                    <button
                      className="sw-link-danger"
                      onClick={() => deleteAlert(a._id)}
                    >
                      Clear
                    </button>
                  </div>
                ))}
              </>
            )}

            <p className="sw-note">
              Alerts are checked while your dashboard is open.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertWindow;