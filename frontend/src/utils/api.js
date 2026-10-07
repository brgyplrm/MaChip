import { clearStoredAuth } from "./authStorage";

/**
 * Helper to fetch using HttpOnly cookies.
 * 'credentials: include' ensures the machip_token cookie is sent automatically.
 */
export const fetchWithAuth = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    cache: options.cache || "no-store",
    headers: {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      ...options.headers,
    },
    credentials: "include", // Required for HttpOnly cookies to be sent
  });

  if (response.status === 401) {
    // Session likely expired or missing cookie
    console.warn("[AUTH] 401 Unauthorized: Session may be expired.");
    
    // Clear user data and redirect to login
    clearStoredAuth();
    
    if (!window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    }
  }

  return response;
};
