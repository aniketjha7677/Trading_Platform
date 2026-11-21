const { Schema } = require("mongoose");

const HoldingsSchema = new Schema(
  {
    user: String, // owner of this holding
    name: String,
    qty: Number,
    avg: Number,
    price: Number,
    net: String,
    day: String,
    isLoss: Boolean,
  },
  { timestamps: true }
);

module.exports = { HoldingsSchema };