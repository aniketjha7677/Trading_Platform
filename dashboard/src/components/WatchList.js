import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

import { Tooltip, Grow } from "@mui/material";
import axios from "axios";

import {
  BarChartOutlined,
  KeyboardArrowDown,
  KeyboardArrowUp,
  MoreHoriz,
} from "@mui/icons-material";

import GeneralContext from "./GeneralContext";
import { watchlist } from "../data/data";
import { DoughnutChart } from "./DoughnoutChart";

import "./WatchListExtras.css";

const API = "http://localhost:3002";

// company names, so searching "infosys" or "tata power" finds the stock
const COMPANY_NAMES = {
  INFY: "infosys",
  ONGC: "oil and natural gas",
  TCS: "tata consultancy services",
  KPITTECH: "kpit technologies",
  QUICKHEAL: "quick heal technologies",
  WIPRO: "wipro",
  "M&M": "mahindra and mahindra",
  RELIANCE: "reliance industries",
  HUL: "hindustan unilever",
  TATAPOWER: "tata power",
  ADANIPOWER: "adani power",
  COCHINSHIP: "cochin shipyard",
  HAL: "hindustan aeronautics",
  BDL: "bharat dynamics",
  HUDCO: "housing and urban development corporation",
  BEL: "bharat electronics",
  MAZDOCK: "mazagon dock shipbuilders",
  GRSE: "garden reach shipbuilders",
  IRFC: "indian railway finance corporation",
  RVNL: "rail vikas nigam",
  NTPC: "ntpc",
  SBIN: "state bank of india",
  HDFCBANK: "hdfc bank",
  ITC: "itc",
  BHARTIARTL: "bharti airtel",
};

const matchesSearch = (stock, q) =>
  stock.name.toUpperCase().includes(q) ||
  (COMPANY_NAMES[stock.name] || "").toUpperCase().includes(q);

const WatchList = () => {
  const [quotes, setQuotes] = useState({});
  const [hidden, setHidden] = useState([]); // stocks this user removed from the list
  const [query, setQuery] = useState("");
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((text, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 8000);
  }, []);

  // live prices
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/quotes`, {
          params: { symbols: watchlist.map((s) => s.name).join(",") },
        });
        setQuotes(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  // this user's removed stocks
  useEffect(() => {
    axios
      .get(`${API}/watchlist/hidden`, { withCredentials: true })
      .then((res) => setHidden(res.data))
      .catch(() => {});
  }, []);

  // price alerts: ask the server every 15 seconds which ones just fired
  useEffect(() => {
    let stopped = false;

    const check = async () => {
      try {
        const res = await axios.post(
          `${API}/alerts/check`,
          {},
          { withCredentials: true }
        );
        res.data.forEach((a) =>
          pushToast(
            `${a.name} is now ${a.condition === "above" ? "above" : "below"} ₹${a.target.toFixed(
              2
            )} (₹${a.triggeredPrice.toFixed(2)})`,
            "alert"
          )
        );
      } catch (err) {
        if (err.response?.status === 401) stopped = true; // not logged in
      }
    };

    check();
    const id = setInterval(() => {
      if (!stopped) check();
    }, 15000);
    return () => clearInterval(id);
  }, [pushToast]);

  const hideStock = async (name) => {
    setHidden((h) => [...h, name]);
    try {
      await axios.post(
        `${API}/watchlist/hide`,
        { name },
        { withCredentials: true }
      );
      pushToast(`${name} removed from your watchlist.`);
    } catch (err) {
      setHidden((h) => h.filter((n) => n !== name));
      pushToast(
        err.response?.status === 401
          ? "Please log in to edit your watchlist."
          : "Could not remove it. Please try again.",
        "error"
      );
    }
  };

  const showStock = async (name) => {
    setHidden((h) => h.filter((n) => n !== name));
    try {
      await axios.post(
        `${API}/watchlist/show`,
        { name },
        { withCredentials: true }
      );
      pushToast(`${name} added back to your watchlist.`);
    } catch (err) {
      setHidden((h) => [...h, name]);
      pushToast(
        err.response?.status === 401
          ? "Please log in to edit your watchlist."
          : "Could not add it. Please try again.",
        "error"
      );
    }
  };

  const q = query.trim().toUpperCase();
  const visible = watchlist.filter((s) => !hidden.includes(s.name));
  // while searching, removed stocks show up too so they can be added back
  const shown = q
    ? watchlist.filter((s) => matchesSearch(s, q))
    : visible;

  const data = {
    labels: visible.map((s) => s.name),
    datasets: [
      {
        label: "Price",
        data: visible.map((s) => quotes[s.name]?.price ?? s.price),
        backgroundColor: [
          "rgba(255, 99, 132, 0.5)",
          "rgba(54, 162, 235, 0.5)",
          "rgba(255, 206, 86, 0.5)",
          "rgba(75, 192, 192, 0.5)",
          "rgba(153, 102, 255, 0.5)",
          "rgba(255, 159, 64, 0.5)",
        ],
        borderColor: [
          "rgba(255, 99, 132, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(255, 206, 86, 1)",
          "rgba(75, 192, 192, 1)",
          "rgba(153, 102, 255, 1)",
          "rgba(255, 159, 64, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="watchlist-container">
      <div className="search-container">
        <input
          type="text"
          name="search"
          id="search"
          placeholder="Search eg:infy, bse, nifty fut weekly, gold mcx"
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <span className="counts">{visible.length} / 50</span>
      </div>

      <ul className="list">
        {shown.map((stock) => (
          <WatchListItem
            key={stock.name}
            stock={stock}
            quote={quotes[stock.name]}
            isHidden={hidden.includes(stock.name)}
            onHide={hideStock}
            onShow={showStock}
          />
        ))}

        {shown.length === 0 && (
          <li className="wl-empty">
            {q
              ? `No stocks match "${query}"`
              : "Your watchlist is empty. Search for a stock to add it back."}
          </li>
        )}
      </ul>

      <DoughnutChart data={data} />

      {createPortal(
        <div className="wl-toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`wl-toast wl-toast-${t.type}`}>
              {t.type === "alert" && <strong>🔔 Price alert</strong>}
              <span>{t.text}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default WatchList;

const WatchListItem = ({ stock, quote, isHidden, onHide, onShow }) => {
  // show a dash until the live price arrives
  const price = quote ? quote.price.toFixed(2) : stock.price || "—";
  const percent = quote ? `${quote.percent.toFixed(2)}%` : stock.percent;
  const isDown = quote ? quote.percent < 0 : stock.isDown;

  const [hover, setHover] = useState(false);
  const [menu, setMenu] = useState(null); // { top, left } while the More menu is open

  return (
    <li
      className={isHidden ? "wl-hidden" : ""}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="item">
        <p className={isDown ? "down" : "up"}>{stock.name}</p>

        <div className="itemInfo">
          <span className="percent">{percent}</span>
          {isDown ? (
            <KeyboardArrowDown className="down" />
          ) : (
            <KeyboardArrowUp className="up" />
          )}
          <span className="price">{price}</span>
        </div>
      </div>

      {isHidden
        ? hover && (
            <button className="wl-add" onClick={() => onShow(stock.name)}>
              + Add
            </button>
          )
        : (hover || menu) && (
            <WatchListActions
              uid={stock.name}
              menuOpen={!!menu}
              onToggleMenu={setMenu}
            />
          )}

      {menu &&
        createPortal(
          <MoreMenu
            uid={stock.name}
            pos={menu}
            onClose={() => setMenu(null)}
            onHide={onHide}
          />,
          document.body
        )}
    </li>
  );
};

const WatchListActions = ({ uid, menuOpen, onToggleMenu }) => {
  const generalContext = useContext(GeneralContext);

  const handleBuyClick = () => {
    generalContext.openBuyWindow(uid);
  };

  const handleSellClick = () => {
    generalContext.openSellWindow(uid);
  };

  const handleAnalyticsClick = () => {
    generalContext.openAnalyticsWindow(uid);
  };

  // open the More menu under the button (or above it if there is no room below)
  const handleMoreClick = (e) => {
    if (menuOpen) {
      onToggleMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 150;
    const menuWidth = 210;
    const top =
      rect.bottom + menuHeight > window.innerHeight
        ? rect.top - menuHeight - 4
        : rect.bottom + 4;
    const left = Math.max(8, rect.right - menuWidth);
    onToggleMenu({ top, left });
  };

  return (
    <span className="actions">
      <span>
        <Tooltip title="Buy (B)" placement="top" arrow slots={{ transition: Grow }}>
          <button className="buy" onClick={handleBuyClick}>Buy</button>
        </Tooltip>

        <Tooltip title="Sell (S)" placement="top" arrow slots={{ transition: Grow }}>
          <button className="sell" onClick={handleSellClick}>Sell</button>
        </Tooltip>

        <Tooltip title="Analytics (A)" placement="top" arrow slots={{ transition: Grow }}>
          <button className="action" onClick={handleAnalyticsClick}>
            <BarChartOutlined className="icon" />
          </button>
        </Tooltip>

        <Tooltip title="More" placement="top" arrow slots={{ transition: Grow }}>
          <button className="action" data-wl-more onClick={handleMoreClick}>
            <MoreHoriz className="icon" />
          </button>
        </Tooltip>
      </span>
    </span>
  );
};

const MoreMenu = ({ uid, pos, onClose, onHide }) => {
  const generalContext = useContext(GeneralContext);
  const ref = useRef(null);

  // close when clicking anywhere else or pressing Escape
  useEffect(() => {
    const handleDown = (e) => {
      if (e.target.closest && e.target.closest("[data-wl-more]")) return;
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="wl-menu"
      style={{ top: pos.top, left: pos.left }}
      role="menu"
    >
      <button
        onClick={() => {
          onClose();
          generalContext.openAlertWindow(uid);
        }}
      >
        <span className="wl-menu-icon">🔔</span> Create alert
      </button>
      <button
        onClick={() => {
          onClose();
          generalContext.openAnalyticsWindow(uid);
        }}
      >
        <span className="wl-menu-icon">📈</span> View chart
      </button>
      <button
        className="wl-menu-danger"
        onClick={() => {
          onClose();
          onHide(uid);
        }}
      >
        <span className="wl-menu-icon">✕</span> Remove from watchlist
      </button>
    </div>
  );
};