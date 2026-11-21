import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

import "./UserMenu.css";

const API = "http://localhost:3002";
const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || "http://localhost:3000/login";

const UserMenu = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapperRef = useRef(null);

  // who is logged in? (uses the login cookie)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await axios.post(`${API}/`, {}, { withCredentials: true });
        if (res.data.status) {
          setUser(res.data);
        }
      } catch (err) {
        console.error("Could not check login:", err);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // close the window when clicking outside it or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await axios.post(`${API}/logout`, {}, { withCredentials: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
    window.location.href = LOGIN_URL;
  };

  if (loading) {
    return <div className="um-wrapper" />;
  }

  // not logged in: show a login link instead
  if (!user) {
    return (
      <div className="um-wrapper">
        <a href={LOGIN_URL} className="um-login">
          Login
        </a>
      </div>
    );
  }

  const username = user.user || "User";
  const initial = username.charAt(0).toUpperCase();
  const shortId = user.id ? String(user.id).slice(-8).toUpperCase() : "-";
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

  return (
    <div className="um-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="um-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="um-avatar">{initial}</span>
        <span className="um-name">{username}</span>
        <span className={`um-caret ${open ? "um-caret-open" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="um-dropdown" role="menu">
          <div className="um-head">
            <span className="um-avatar um-avatar-lg">{initial}</span>
            <p className="um-head-name">{username}</p>
            <p className="um-head-email">{user.email}</p>
          </div>

          <div className="um-info">
            <div className="um-info-row">
              <span>User ID</span>
              <span className="um-mono">{shortId}</span>
            </div>
            <div className="um-info-row">
              <span>Member since</span>
              <span>{memberSince}</span>
            </div>
          </div>

          <div className="um-links">
            <Link to="/orders" onClick={() => setOpen(false)}>
              My orders
            </Link>
            <Link to="/funds" onClick={() => setOpen(false)}>
              Funds
            </Link>
          </div>

          <button
            type="button"
            className="um-logout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;