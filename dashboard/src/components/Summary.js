import React, { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:3002";

// 3,740 -> 3.74k, 1,05,000 -> 1.05L, 2,50,00,000 -> 2.50Cr
const compact = (n) => {
  const value = Number(n || 0);
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${(value / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  return value.toFixed(2);
};

const full = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const Summary = () => {
  const [username, setUsername] = useState("");
  const [funds, setFunds] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [me, fundsRes, holdingsRes] = await Promise.all([
          axios.post(`${API}/`, {}, { withCredentials: true }),
          axios.get(`${API}/funds`, { withCredentials: true }),
          axios.get(`${API}/allHoldings`, { withCredentials: true }),
        ]);
        if (cancelled) return;

        if (!me.data.status) {
          setNotLoggedIn(true);
          return;
        }

        setUsername(me.data.user);
        setFunds(fundsRes.data);
        setHoldings(holdingsRes.data);
        setLoadError(false);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 401) {
          setNotLoggedIn(true);
        } else {
          console.error("Could not load the dashboard:", err);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    // keep the numbers fresh as live prices move
    const id = setInterval(load, 15000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="username">
        <h6>Loading your dashboard...</h6>
      </div>
    );
  }

  if (notLoggedIn) {
    return (
      <div className="username">
        <h6>Please log in to see your dashboard</h6>
        <a
          href={process.env.REACT_APP_LOGIN_URL || "http://localhost:3000/login"}
          className="btn btn-blue"
          style={{ display: "inline-block", marginTop: "16px" }}
        >
          Login
        </a>
      </div>
    );
  }

  if (loadError || !funds) {
    return (
      <div className="username">
        <h6>Could not load your dashboard. Is the backend running?</h6>
      </div>
    );
  }

  const availableMargin = funds.availableCash - funds.usedMargin;

  const investment = holdings.reduce((sum, h) => sum + h.avg * h.qty, 0);
  const currentValue = holdings.reduce((sum, h) => sum + h.price * h.qty, 0);
  const pnl = currentValue - investment;
  const pnlPercent = investment ? (pnl / investment) * 100 : 0;
  const pnlClass = pnl >= 0 ? "profit" : "loss";

  return (
    <>
      <div className="username">
        <h6>Hi, {username}!</h6>
        <hr className="divider" />
      </div>

      <div className="section">
        <span>
          <p>Equity</p>
        </span>

        <div className="data">
          <div className="first">
            <h3 title={`₹${full(availableMargin)}`}>
              {compact(availableMargin)}
            </h3>
            <p>Margin available</p>
          </div>
          <hr />

          <div className="second">
            <p>
              Margins used <span>{compact(funds.usedMargin)}</span>
            </p>
            <p>
              Opening balance <span>{compact(funds.openingBalance)}</span>
            </p>
          </div>
        </div>
        <hr className="divider" />
      </div>

      <div className="section">
        <span>
          <p>Holdings ({holdings.length})</p>
        </span>

        <div className="data">
          <div className="first">
            <h3 className={pnlClass} title={`₹${full(pnl)}`}>
              {compact(pnl)}{" "}
              <small>
                {pnl >= 0 ? "+" : ""}
                {pnlPercent.toFixed(2)}%
              </small>
            </h3>
            <p>P&L</p>
          </div>
          <hr />

          <div className="second">
            <p>
              Current Value <span>{compact(currentValue)}</span>
            </p>
            <p>
              Investment <span>{compact(investment)}</span>
            </p>
          </div>
        </div>
        <hr className="divider" />
      </div>
    </>
  );
};

export default Summary;