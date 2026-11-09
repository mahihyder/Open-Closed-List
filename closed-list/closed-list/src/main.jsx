import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { Analytics } from "@vercel/analytics/react";
import { configureAnalyticsPreference, filterAnalyticsEvent } from "./analytics-preference.js";

const analyticsPreference = configureAnalyticsPreference();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    {(analyticsPreference.choice === "off" || analyticsPreference.choice === "on") && (
      <div role="status" style={{ position: "fixed", bottom: 20, left: 20, right: 20, zIndex: 10000, padding: "12px 16px", borderRadius: 12, background: "#172b24", color: "#ffffff", boxShadow: "0 4px 20px #0004", fontFamily: "system-ui" }}>
        {analyticsPreference.excluded
          ? analyticsPreference.saved
            ? "Your visits are now excluded from analytics in this browser."
            : "Your visits are excluded for this page only. Browser storage is unavailable."
          : "Your visits are now included in analytics in this browser."}
      </div>
    )}
    <Analytics beforeSend={(event) => filterAnalyticsEvent(event, analyticsPreference)} />
  </React.StrictMode>
);
