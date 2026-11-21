import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter,Routes,Route} from "react-router-dom";
import './index.css';

import HomePage from './landing_page/home/HomePage';
import Signup from './landing_page/signup/Signup';
import Login from './landing_page/login/Login';
import AboutPage from './landing_page/about/AboutPage';
import ProductPage from './landing_page/products/ProductsPage';
import PricingPage from './landing_page/pricing/PricingPage';
import SupportPage from './landing_page/support/SupportPage';
import Navbar from './landing_page/Navbar';
import Footer from './landing_page/Footer';
import NotFound from './landing_page/NotFound';
import ScrollToTop from './landing_page/ScrollToTop';

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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
  <ScrollToTop />
  <Navbar/>
    <Routes>
      <Route path='/' element={<HomePage/>}/>
      <Route path='/signup' element={<Signup/>}/>
      <Route path='/login' element={<Login/>}/>
      <Route path='/about' element={<AboutPage/>}/>
      <Route path='/products' element={<ProductPage/>}/>
      <Route path='/pricing' element={<PricingPage/>}/>
      <Route path='/support' element={<SupportPage/>}/>
      <Route path='/*' element={<NotFound/>}/>
    </Routes>
    <Footer/>
  </BrowserRouter>
);