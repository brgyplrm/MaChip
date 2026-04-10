/**
 * Helper to fetch with the JWT token in the Authorization header.
 */
export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  
  const headers = {
    ...options.headers,
    "Authorization": token ? `Bearer ${token}` : "",
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Optional: Auto-logout on token expiration
    // localStorage.removeItem("token");
    // window.location.href = "/login";
  }

  return response;
};
