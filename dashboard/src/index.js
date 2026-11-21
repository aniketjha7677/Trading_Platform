import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import Home from "./components/Home";

import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;
if (API_URL) {
  axios.interceptors.request.use((config) => {
    if (config.url && config.url.startsWith("http://localhost:3002")) {
      config.url = config.url.replace("http://localhost:3002", API_URL);
    }
    return config;
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);