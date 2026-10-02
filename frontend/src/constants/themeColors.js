/**
 * MaChip Unified Color Constants (JavaScript / Recharts / jsPDF / Canvas)
 * 
 * Provides centralized color values for components and libraries that cannot
 * directly consume Tailwind utility classes (e.g., Recharts fill props, MUI icon colors, jsPDF).
 */

export const THEME_COLORS = {
  // Primary Brand Purple
  brand: {
    primary: "var(--color-brand-primary, #2a174e)",
    hover: "var(--color-brand-primary-hover, #1a0e30)",
    light: "var(--color-brand-primary-light, #f0ebfa)",
    raw: {
      primary: "#2a174e",
      hover: "#1a0e30",
      light: "#f0ebfa",
    },
  },

  // Secondary Accent Green (Stat Widgets & Badges)
  accentGreen: {
    DEFAULT: "var(--color-accent-green, #abbb44)",
    hover: "var(--color-accent-green-hover, #8e9e2b)",
    light: "var(--color-accent-green-light, #f6f8ec)",
    raw: {
      DEFAULT: "#abbb44",
      hover: "#8e9e2b",
      light: "#f6f8ec",
    },
  },

  // Tertiary Accent Gold (Financials & Payroll Summaries)
  accentGold: {
    DEFAULT: "var(--color-accent-gold, #bb8b26)",
    hover: "var(--color-accent-gold-hover, #a0741c)",
    light: "var(--color-accent-gold-light, #fffbeb)",
    raw: {
      DEFAULT: "#bb8b26",
      hover: "#a0741c",
      light: "#fffbeb",
    },
  },

  // Semantic Status Colors
  status: {
    success: "var(--color-status-success, #16a34a)",
    warning: "var(--color-status-warning, #f59e0b)",
    danger: "var(--color-status-danger, #dc2626)",
    info: "var(--color-status-info, #0284c7)",
    raw: {
      success: "#16a34a",
      warning: "#f59e0b",
      danger: "#dc2626",
      info: "#0284c7",
    },
  },

  // Surfaces & Neutrals
  surface: {
    bg: "#f8fafc",
    card: "#ffffff",
    border: "#e2e8f0",
    textMain: "#1e293b",
    textMuted: "#64748b",
  },
};

export default THEME_COLORS;
