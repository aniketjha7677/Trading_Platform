require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("../model/UserModel");

// used by POST "/" : tells the frontend who is logged in
module.exports.userVerification = (req, res) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.json({ status: false });
  }

  jwt.verify(token, process.env.TOKEN_KEY, async (err, data) => {
    if (err) {
      return res.json({ status: false });
    }

    const user = await User.findById(data.id);
    if (user) {
      return res.json({
        status: true,
        user: user.username,
        email: user.email,
        id: user._id,
        createdAt: user.createdAt,
      });
    }
    return res.json({ status: false });
  });
};

// protects routes: reads the login cookie and sets req.userId
module.exports.requireAuth = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Not logged in", success: false });
  }

  jwt.verify(token, process.env.TOKEN_KEY, (err, data) => {
    if (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired login", success: false });
    }
    req.userId = data.id;
    next();
  });
};