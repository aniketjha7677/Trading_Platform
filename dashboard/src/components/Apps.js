import React from "react";

import "./Apps.css";

const upcomingApps = [
  {
    icon: "📊",
    name: "Mutual funds",
    text: "Invest in direct mutual funds with zero commission and track them next to your stocks.",
    progress: 70,
  },
  {
    icon: "🏢",
    name: "Unlisted shares",
    text: "Get access to pre-IPO and unlisted companies before they reach the exchange.",
    progress: 45,
  },
  {
    icon: "🏦",
    name: "Bonds",
    text: "Government and corporate bonds for steady, predictable returns.",
    progress: 55,
  },
  {
    icon: "🚀",
    name: "IPO",
    text: "Apply for upcoming IPOs directly from your dashboard using UPI.",
    progress: 60,
  },
];

const Apps = () => {
  return (
    <div className="ap-page">
      <div className="ap-hero">
        <span className="ap-hero-tag">In progress</span>
        <h2>More apps are on the way</h2>
        <p>
          We're working on launching many more apps to help you grow your
          wealth, all in one place. Here's what we're building next.
        </p>
      </div>

      <div className="ap-grid">
        {upcomingApps.map((app) => (
          <div className="ap-card" key={app.name}>
            <div className="ap-card-top">
              <span className="ap-icon">{app.icon}</span>
              <span className="ap-badge">In progress</span>
            </div>

            <h3>{app.name}</h3>
            <p>{app.text}</p>

            <div className="ap-progress">
              <div className="ap-bar">
                <div
                  className="ap-bar-fill"
                  style={{ width: `${app.progress}%` }}
                />
              </div>
              <span className="ap-soon">Coming soon</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Apps;