import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

import GeneralContext from "./GeneralContext";

import "./StockWindows.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

const API = "http://localhost:3002";
const RANGES = ["1D", "1W", "1M", "6M", "1Y"];
const IST = "Asia/Kolkata";

const fmt = (n) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? "—"
    : Number(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const fmtInt = (n) =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString("en-IN");

// text under the chart's x axis
const axisLabel = (t, range) => {
  const d = new Date(t);
  if (range === "1D") {
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: IST,
    });
  }
  if (range === "1W") {
    return d.toLocaleString("en-IN", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: IST,
    });
  }
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: IST,
  });
};

// text shown when you hover a point
const tooltipTitle = (t, range) => {
  const d = new Date(t);
  if (range === "1D" || range === "1W") {
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: IST,
    });
  }
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: IST,
  });
};

const AnalyticsWindow = ({ uid }) => {
  const { closeAnalyticsWindow, openBuyWindow, openSellWindow, openAlertWindow } =
    useContext(GeneralContext);

  const [range, setRange] = useState("1D");
  const [points, setPoints] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState("");
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [live, setLive] = useState(null); // { price, percent }

  // key numbers (open, high, low, 52 week range...) once
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/stats`, { params: { symbol: uid } })
      .then((res) => {
        if (!cancelled) setStats(res.data);
      })
      .catch(() => {
        if (!cancelled) setStatsError("Stock details are unavailable right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // live price, refreshed every 10 seconds
  useEffect(() => {
    let cancelled = false;

    const loadLive = async () => {
      try {
        const res = await axios.get(`${API}/quotes`, {
          params: { symbols: uid },
        });
        const quote = res.data[uid.toUpperCase()];
        if (quote && !cancelled) setLive(quote);
      } catch (err) {
        // keep the last price
      }
    };

    loadLive();
    const id = setInterval(loadLive, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [uid]);

  // the chart, whenever the range changes
  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    setChartError("");

    axios
      .get(`${API}/chart`, { params: { symbol: uid, range } })
      .then((res) => {
        if (!cancelled) setPoints(res.data.points);
      })
      .catch(() => {
        if (!cancelled) {
          setPoints([]);
          setChartError("Chart data is unavailable right now.");
        }
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, range]);

  const price = live ? live.price : stats?.price;
  const dayPct = live
    ? live.percent
    : stats && stats.prevClose
    ? ((stats.price - stats.prevClose) / stats.prevClose) * 100
    : null;

  const first = points[0]?.v;
  const last = points[points.length - 1]?.v;
  const rangeChange = first && last ? ((last - first) / first) * 100 : null;

  const isUp = rangeChange !== null ? rangeChange >= 0 : (dayPct ?? 0) >= 0;
  const color = isUp ? "#2eb872" : "#e8452c";

  const chartData = {
    labels: points.map((p) => axisLabel(p.t, range)),
    datasets: [
      {
        data: points.map((p) => p.v),
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        fill: true,
        backgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) return "transparent";
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, isUp ? "rgba(46,184,114,0.25)" : "rgba(232,69,44,0.25)");
          gradient.addColorStop(1, "rgba(255,255,255,0)");
          return gradient;
        },
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => tooltipTitle(points[items[0].dataIndex].t, range),
          label: (item) => `₹${fmt(item.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 6, maxRotation: 0 },
      },
      y: {
        grid: { color: "#f0f0f0" },
        ticks: { callback: (v) => `₹${Number(v).toLocaleString("en-IN")}` },
      },
    },
  };

  // where today's price sits inside the 52 week range (0 to 100%)
  let rangePos = null;
  if (stats && price && stats.high52 && stats.low52 && stats.high52 > stats.low52) {
    rangePos = Math.min(
      100,
      Math.max(0, ((price - stats.low52) / (stats.high52 - stats.low52)) * 100)
    );
  }

  const statItems = stats
    ? [
        ["Open", fmt(stats.open)],
        ["Prev. close", fmt(stats.prevClose)],
        ["Day high", fmt(stats.high)],
        ["Day low", fmt(stats.low)],
        ["52W high", fmt(stats.high52)],
        ["52W low", fmt(stats.low52)],
        ["Volume", fmtInt(stats.volume)],
        [
          `${range} change`,
          rangeChange === null
            ? "—"
            : `${rangeChange >= 0 ? "+" : ""}${rangeChange.toFixed(2)}%`,
        ],
      ]
    : [];

  return (
    <div className="sw-backdrop" onClick={closeAnalyticsWindow}>
      <div
        className="sw-window sw-analytics"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sw-head">
          <div>
            <h3>{uid}</h3>
            <p className="sw-sub">
              {stats ? `${stats.longName} · ${stats.exchange}` : "NSE"}
            </p>
          </div>

          <div className="sw-head-right">
            <div className="sw-price">{price ? `₹${fmt(price)}` : "—"}</div>
            {dayPct !== null && (
              <div className={dayPct >= 0 ? "sw-up" : "sw-down"}>
                {dayPct >= 0 ? "▲" : "▼"} {Math.abs(dayPct).toFixed(2)}% today
              </div>
            )}
          </div>

          <button className="sw-close" onClick={closeAnalyticsWindow} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sw-actions">
          <button className="sw-btn sw-btn-buy" onClick={() => openBuyWindow(uid)}>
            Buy
          </button>
          <button className="sw-btn sw-btn-sell" onClick={() => openSellWindow(uid)}>
            Sell
          </button>
          <button className="sw-btn sw-btn-outline" onClick={() => openAlertWindow(uid)}>
            Create alert
          </button>
        </div>

        <div className="sw-ranges">
          {RANGES.map((r) => (
            <button
              key={r}
              className={`sw-range ${r === range ? "sw-range-active" : ""}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="sw-chart">
          {chartLoading && <div className="sw-chart-note">Loading chart...</div>}
          {!chartLoading && chartError && (
            <div className="sw-chart-note sw-chart-error">{chartError}</div>
          )}
          {!chartLoading && !chartError && points.length === 0 && (
            <div className="sw-chart-note">No data for this period.</div>
          )}
          {!chartLoading && !chartError && points.length > 0 && (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>

        {statsError && <p className="sw-error">{statsError}</p>}

        {stats && (
          <>
            <div className="sw-stats">
              {statItems.map(([label, value]) => (
                <div className="sw-stat" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            {rangePos !== null && (
              <div className="sw-52">
                <div className="sw-52-labels">
                  <span>₹{fmt(stats.low52)}</span>
                  <span>52-week range</span>
                  <span>₹{fmt(stats.high52)}</span>
                </div>
                <div className="sw-52-bar">
                  <div className="sw-52-marker" style={{ left: `${rangePos}%` }} />
                </div>
              </div>
            )}
          </>
        )}

        <p className="sw-note">
          Data from Yahoo Finance and may be delayed. This is not investment advice.
        </p>
      </div>
    </div>
  );
};

export default AnalyticsWindow;