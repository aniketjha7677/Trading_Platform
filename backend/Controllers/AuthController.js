const User = require("../model/UserModel");
const { createSecretToken } = require("../util/SecretToken");
const bcrypt = require("bcryptjs");

// In production the frontend, dashboard and backend live on different domains,
// so the browser only sends the login cookie if it is SameSite=None and Secure.
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  withCredentials: true,
  httpOnly: false,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days, same as the token
};
const clearCookieOptions = {
  httpOnly: false,
  sameSite: cookieOptions.sameSite,
  secure: cookieOptions.secure,
};

module.exports.Signup = async (req, res) => {
  try {
    const { email, password, username, createdAt } = req.body || {};

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User already exists", success: false });
    }

    // the password is hashed by the pre("save") hook in UserModel.js
    const user = await User.create({ email, password, username, createdAt });
    const token = createSecretToken(user._id);

    res.cookie("token", token, cookieOptions);

    res.status(201).json({
      message: "User signed up successfully",
      success: true,
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Signup failed", success: false });
  }
};

module.exports.Login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "All fields are required", success: false });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ message: "Incorrect password or email", success: false });
    }

    const auth = await bcrypt.compare(password, user.password);
    if (!auth) {
      return res
        .status(401)
        .json({ message: "Incorrect password or email", success: false });
    }

    const token = createSecretToken(user._id);

    res.cookie("token", token, cookieOptions);

    res
      .status(200)
      .json({ message: "User logged in successfully", success: true });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed", success: false });
  }
};

module.exports.Logout = (req, res) => {
  res.clearCookie("token", clearCookieOptions);
  res.json({ message: "Logged out", success: true });
};