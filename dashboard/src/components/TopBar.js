import React, { useState, useEffect } from "react";
import axios from "axios";

import Menu from "./Menu";

const API = "http://localhost:3002";

const fmt = (n) =>
  Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// one index: name, live level and today's change
const IndexBox = ({ className, label, quote }) => {
  const up = !quote || quote.percent >= 0;
  const color = up ? "#1f9d5d" : "#d63b27";

  // points moved today, worked out from the percentage
  const points = quote ? quote.price - quote.price / (1 + quote.percent / 100) : 0;

  return (
    <div
      className={className}
      title={quote ? `${up ? "+" : "-"}${fmt(Math.abs(points))} points today` : ""}
    >
      <p className="index">{label}</p>
      <p className="index-points" style={{ color }}>
        {quote ? fmt(quote.price) : "—"}
      </p>
      <p className="percent" style={{ color, whiteSpace: "nowrap" }}>
        {quote ? `${up ? "▲" : "▼"} ${Math.abs(quote.percent).toFixed(2)}%` : ""}
      </p>
    </div>
  );
};

const TopBar = () => {
  const [quotes, setQuotes] = useState({});

  // live NIFTY 50 and SENSEX, refreshed every 10 seconds
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await axios.get(`${API}/quotes`, {
          params: { symbols: "NIFTY50,SENSEX" },
        });
        if (!cancelled) setQuotes(res.data);
      } catch (err) {
        // keep showing the last values
      }
    };

    load();
    const id = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="topbar-container">
      <div className="indices-container">
        <IndexBox className="nifty" label="NIFTY 50" quote={quotes.NIFTY50} />
        <IndexBox className="sensex" label="SENSEX" quote={quotes.SENSEX} />
      </div>

      <Menu />
    </div>
  );
};

export default TopBar;