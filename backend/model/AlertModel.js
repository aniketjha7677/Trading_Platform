const { Schema, model } = require("mongoose");

// a price alert: "tell me when NAME goes above / below TARGET"
const AlertSchema = new Schema(
  {
    user: { type: String, required: true, index: true },
    name: { type: String, required: true },
    condition: { type: String, enum: ["above", "below"], required: true },
    target: { type: Number, required: true },
    triggered: { type: Boolean, default: false },
    triggeredAt: Date,
    triggeredPrice: Number,
  },
  { timestamps: true }
);

const AlertModel = model("alert", AlertSchema);

module.exports = { AlertModel };