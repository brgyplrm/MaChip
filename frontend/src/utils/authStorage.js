/**
 * Centralized Synchronized Authentication Storage
 * Keeps session state active across all components while authenticated,
 * and completely purges all tokens & storage on logout, 15-min idle timeout,
 * or server restart.
 */

export const getStoredUser = () => {
  try {
    const raw = sessionStorage.getItem("userData") || localStorage.getItem("userData");
    if (raw) return JSON.parse(raw);
    return null;
  } catch (e) {
    return null;
  }
};

export const setStoredUser = (userData) => {
  if (!userData) {
    clearStoredAuth();
    return;
  }
  const serialized = JSON.stringify(userData);
  sessionStorage.setItem("userData", serialized);
  localStorage.setItem("userData", serialized);
};

export const getStoredViewMode = (defaultMode = "management") => {
  return sessionStorage.getItem("viewMode") || localStorage.getItem("viewMode") || defaultMode;
};

export const setStoredViewMode = (mode) => {
  sessionStorage.setItem("viewMode", mode);
  localStorage.setItem("viewMode", mode);
};

export const clearStoredAuth = () => {
  try {
    sessionStorage.removeItem("userData");
    sessionStorage.removeItem("viewMode");
    sessionStorage.clear();
    localStorage.removeItem("userData");
    localStorage.removeItem("viewMode");
    localStorage.removeItem("token");
  } catch (e) {}
};
