const { Schema } = require("mongoose");

// one document per user; the defaults give every new user a starting balance
const FundsSchema = new Schema(
  {
    user: { type: String, required: true, unique: true },
    availableCash: { type: Number, default: 100000 },
    usedMargin: { type: Number, default: 0 },
    openingBalance: { type: Number, default: 100000 },
    payin: { type: Number, default: 0 },
    span: { type: Number, default: 0 },
    deliveryMargin: { type: Number, default: 0 },
    exposure: { type: Number, default: 0 },
    optionsPremium: { type: Number, default: 0 },
    collateralLiquid: { type: Number, default: 0 },
    collateralEquity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = { FundsSchema };