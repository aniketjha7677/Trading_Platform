import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_URL = "http://localhost:3002";
// change this to the port your dashboard app runs on
const DASHBOARD_URL = process.env.REACT_APP_DASHBOARD_URL || "http://localhost:3001";

function Signup() {
  const [inputValue, setInputValue] = useState({
    email: "",
    username: "",
    password: "",
  });
  const { email, username, password } = inputValue;

  const handleOnChange = (e) => {
    const { name, value } = e.target;
    setInputValue({ ...inputValue, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_URL}/signup`, inputValue, {
        withCredentials: true,
      });

      if (data.success) {
        toast.success(data.message, { position: "bottom-left" });
        setTimeout(() => {
          window.location.href = DASHBOARD_URL;
        }, 1000);
      } else {
        toast.error(data.message, { position: "bottom-left" });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong", {
        position: "bottom-left",
      });
    }
    setInputValue({ email: "", username: "", password: "" });
  };

  return (
    <div className="container p-5 mb-5">
      <div className="row">
        <div className="col-12 col-md-6 offset-md-3 p-4 border rounded shadow-sm">
          <h2 className="mb-4 text-center">Signup Account</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                value={email}
                placeholder="Enter your email"
                onChange={handleOnChange}
                className="form-control"
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                type="text"
                name="username"
                id="username"
                value={username}
                placeholder="Enter your username"
                onChange={handleOnChange}
                className="form-control"
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                name="password"
                id="password"
                value={password}
                placeholder="Enter your password"
                onChange={handleOnChange}
                className="form-control"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-100">
              Submit
            </button>

            <p className="mt-3 text-center text-muted">
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </form>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}

export default Signup;