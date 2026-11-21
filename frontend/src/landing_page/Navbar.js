import React from "react";
import { Link } from "react-router-dom";

function Navbar() {
    return (
        <nav
            className="navbar navbar-expand-lg bg-white border-bottom shadow-sm sticky-top"
            style={{ minHeight: "70px", padding: "0" }}
        >
            <div className="container" style={{ minHeight: "70px", paddingTop: "0", paddingBottom: "0" }}>

                {/* Logo */}
                <Link className="navbar-brand me-auto" to="/">
                    <img
                        src="/media/images/logo.png"
                        alt="VeloTrade"
                        style={{ width: "170px", height: "auto" }}
                    />
                </Link>

                {/* Mobile hamburger */}
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarContent"
                    aria-controls="navbarContent"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>

                {/* Navigation links */}
                <div
                    className="collapse navbar-collapse justify-content-end"
                    id="navbarContent"
                >
                    <ul className="navbar-nav align-items-lg-center gap-lg-4">

                        <li className="nav-item">
                            <Link className="nav-link text-secondary fs-5" to="/signup">
                                Signup
                            </Link>
                        </li>

                        <li className="nav-item">
                            <Link className="nav-link text-secondary fs-5" to="/about">
                                About
                            </Link>
                        </li>

                        <li className="nav-item">
                            <Link className="nav-link text-secondary fs-5" to="/products">
                                Products
                            </Link>
                        </li>

                        <li className="nav-item">
                            <Link className="nav-link text-secondary fs-5" to="/pricing">
                                Pricing
                            </Link>
                        </li>

                        <li className="nav-item">
                            <Link className="nav-link text-secondary fs-5" to="/support">
                                Support
                            </Link>
                        </li>

                        {/* Hamburger menu on desktop */}
                        <li className="nav-item dropdown">
                            <button
                                className="btn p-2 border-0"
                                type="button"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                                aria-label="More options"
                            >
                                <svg
                                    width="30"
                                    height="30"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                >
                                    <path d="M3 6h18M3 12h18M3 18h18" />
                                </svg>
                            </button>

                            <ul className="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a className="dropdown-item" href="#login">Login</a>
                                </li>
                                <li>
                                    <a className="dropdown-item" href="#support">Support</a>
                                </li>
                                <li>
                                    <a className="dropdown-item" href="#contact">Contact</a>
                                </li>
                            </ul>
                        </li>

                    </ul>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
