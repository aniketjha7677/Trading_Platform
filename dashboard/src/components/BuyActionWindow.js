import React from "react";

import TradeWindow from "./TradeWindow";

const BuyActionWindow = ({ uid }) => {
  return <TradeWindow uid={uid} mode="BUY" />;
};

export default BuyActionWindow;