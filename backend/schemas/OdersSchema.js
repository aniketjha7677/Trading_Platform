const { Schema } = require("mongoose");

const OrdersSchema = new Schema(
  {
    user: String, // id of the logged-in user who placed the order
    name: String,
    qty: Number,
    price: Number,
    mode: String,
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = { OrdersSchema };