import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom"; // Import this here
import { SystemTimeProvider } from "./context/SystemTimeContext";
import { RealTimeProvider } from "./context/RealTimeContext";
import { SidebarProvider } from "./components/ui/sidebar";
import './tailwind.css'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <RealTimeProvider>
      <SystemTimeProvider>
        <BrowserRouter 
          future={{ 
            v7_startTransition: true, 
            v7_relativeSplatPath: true 
          }}
        > 
          <SidebarProvider>
            <App />
          </SidebarProvider>
        </BrowserRouter>
      </SystemTimeProvider>
    </RealTimeProvider>
  </React.StrictMode>
);