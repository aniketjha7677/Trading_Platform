import React, { useState } from "react";

import BuyActionWindow from "./BuyActionWindow";
import SellActionWindow from "./SellActionWindow";
import AnalyticsWindow from "./AnalyticsWindow";
import AlertWindow from "./AlertWindow";

const GeneralContext = React.createContext({
  openBuyWindow: (uid) => {},
  closeBuyWindow: () => {},
  openSellWindow: (uid) => {},
  closeSellWindow: () => {},
  openAnalyticsWindow: (uid) => {},
  closeAnalyticsWindow: () => {},
  openAlertWindow: (uid) => {},
  closeAlertWindow: () => {},
});

export const GeneralContextProvider = (props) => {
  // only one window is open at a time: "buy" | "sell" | "analytics" | "alert" | null
  const [openWindow, setOpenWindow] = useState(null);
  const [selectedStockUID, setSelectedStockUID] = useState("");

  const open = (type) => (uid) => {
    setOpenWindow(type);
    setSelectedStockUID(uid);
  };

  const close = () => {
    setOpenWindow(null);
    setSelectedStockUID("");
  };

  return (
    <GeneralContext.Provider
      value={{
        openBuyWindow: open("buy"),
        closeBuyWindow: close,
        openSellWindow: open("sell"),
        closeSellWindow: close,
        openAnalyticsWindow: open("analytics"),
        closeAnalyticsWindow: close,
        openAlertWindow: open("alert"),
        closeAlertWindow: close,
      }}
    >
      {props.children}
      {openWindow === "buy" && (
        <BuyActionWindow key={selectedStockUID} uid={selectedStockUID} />
      )}
      {openWindow === "sell" && (
        <SellActionWindow key={selectedStockUID} uid={selectedStockUID} />
      )}
      {openWindow === "analytics" && (
        <AnalyticsWindow key={selectedStockUID} uid={selectedStockUID} />
      )}
      {openWindow === "alert" && (
        <AlertWindow key={selectedStockUID} uid={selectedStockUID} />
      )}
    </GeneralContext.Provider>
  );
};

export default GeneralContext;