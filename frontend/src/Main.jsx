import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom"; // Import this here
import { SystemTimeProvider } from "./context/SystemTimeContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <SystemTimeProvider>
      <BrowserRouter 
        future={{ 
          v7_startTransition: true, 
          v7_relativeSplatPath: true 
        }}
      > 
        <App />
      </BrowserRouter>
    </SystemTimeProvider>
  </React.StrictMode>
);