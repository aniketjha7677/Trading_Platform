const { Schema, model } = require("mongoose");

// stocks a user has removed from their own watchlist
const WatchlistPrefSchema = new Schema(
  {
    user: { type: String, required: true, unique: true },
    hidden: { type: [String], default: [] },
  },
  { timestamps: true }
);

const WatchlistPrefModel = model("watchlistpref", WatchlistPrefSchema);

module.exports = { WatchlistPrefModel };