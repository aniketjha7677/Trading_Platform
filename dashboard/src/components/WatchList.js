import React, { useState, useContext, useEffect } from "react";

import { Tooltip, Grow } from "@mui/material";
import axios from "axios";

import { BarChartOutlined, KeyboardArrowDown, KeyboardArrowUp, MoreHoriz } from '@mui/icons-material';

import GeneralContext from "./GeneralContext";
import { watchlist } from "../data/data";
import { DoughnutChart } from "./DoughnoutChart";


const labels = watchlist.map((subArray) => subArray["name"]);


const WatchList = () => {

  const [quotes, setQuotes] = useState({});

  const data = {
    labels,
    datasets: [
      {
        label: "Price",
        data: watchlist.map((stock) => quotes[stock.name]?.price ?? stock.price),
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


  

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get("http://localhost:3002/quotes", {
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



  return (
    <div className="watchlist-container">
      <div className="search-container">
        <input
          type="text"
          name="search"
          id="search"
          placeholder="Search eg:infy, bse, nifty fut weekly, gold mcx"
          className="search"
        />

        <span className="counts">{watchlist.length} / 50</span>
      </div>

      <ul className="list">
        {watchlist.map((stock, index) => {
          return (
            <WatchListItem
              stock={stock}
              quote={quotes[stock.name]}
              key={index}
            />
          );
        })}
      </ul>
      <DoughnutChart data={data} />
    </div>
  );
};

export default WatchList;

const WatchListItem = ({ stock, quote }) => {

  // in WatchListItem: show a dash until the live price arrives
  const price = quote ? quote.price.toFixed(2) : stock.price || "—";
  const percent = quote ? `${quote.percent.toFixed(2)}%` : stock.percent;
  const isDown = quote ? quote.percent < 0 : stock.isDown;


  const [showWatchlistActions, setShowWatchlistAction] = useState(false);

  const handleMouseEnter = (e) => {
    setShowWatchlistAction(true);
  };

  const handleMouseLeave = (e) => {
    setShowWatchlistAction(false);
  };

  return (
    <li onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>

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


      {showWatchlistActions && <WatchListActions uid={stock.name} />}
    </li>
  );
};

const WatchListActions = ({ uid }) => {
  const generalContext = useContext(GeneralContext);

  const handleBuyClick = () => {
    generalContext.openBuyWindow(uid);
  };


  const handleSellClick = () => {
    generalContext.openSellWindow(uid);
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
          <button className="action"><BarChartOutlined className="icon" /></button>
        </Tooltip>

        <Tooltip title="More" placement="top" arrow slots={{ transition: Grow }}>
          <button className="action"><MoreHoriz className="icon" /></button>
        </Tooltip>
      </span>
    </span>
  );
};