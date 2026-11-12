import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  // Reset scroll to top on every route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Also reset nested scroll containers used by layout or dashboards
    const scrollables = document.querySelectorAll(
      '.overflow-y-auto, [data-sidebar="inset"], main, .app'
    );
    scrollables.forEach((el) => {
      el.scrollTop = 0;
    });
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 250) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-brand-primary text-white shadow-xl hover:bg-brand-primary-hover active:scale-95 transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-primary/50 animate-in fade-in zoom-in-75"
    >
      <KeyboardArrowUpIcon className="!text-[24px]" />
    </button>
  );
};

export default ScrollToTop;
