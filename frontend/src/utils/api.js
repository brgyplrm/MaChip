/**
 * Helper to fetch using HttpOnly cookies.
 * 'credentials: include' ensures the machip_token cookie is sent automatically.
 */
export const fetchWithAuth = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
    },
    credentials: "include", // Required for HttpOnly cookies to be sent
  });

  if (response.status === 401) {
    // Session likely expired or missing cookie
    console.warn("[AUTH] 401 Unauthorized: Session may be expired.");
    
    // Optionally clear user data and redirect to login
    // localStorage.removeItem("userData");
    // if (!window.location.pathname.includes("/login")) {
    //   window.location.href = "/login";
    // }
  }

  return response;
};
