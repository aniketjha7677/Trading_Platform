import React from "react";

import TradeWindow from "./TradeWindow";

const SellActionWindow = ({ uid }) => {
  return <TradeWindow uid={uid} mode="SELL" />;
};

export default SellActionWindow;