import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./lib/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand Foundation ────────────────────────────────────────────
        // Deep navy used for primary surfaces, headings, and strong CTAs.
        // Do NOT use generic Tailwind slate-900; use these named tokens.
        navy: {
          DEFAULT: "#0B1526",
          50:  "#eef2f4",
          100: "#dbe4e8",
          200: "#bccbd2",
          300: "#94aab5",
          400: "#6f8b9a",
          500: "#506c7c",
          600: "#365566",
          700: "#253f51",
          800: "#172b3e",
          900: "#0B1526",
          950: "#070d1a",
        },
        // ── Trust Teal — confirmed states, verified marks ───────────────
        teal: {
          DEFAULT: "#087f79",
          50:  "#edf7f5",
          100: "#d6eae6",
          200: "#acd6cf",
          300: "#7dbdb3",
          400: "#4ca69b",
          500: "#168f85",
          600: "#087f79",
          700: "#0a6f69",
          800: "#105a56",
          900: "#134b49",
        },
        // ── Surface Neutrals ────────────────────────────────────────────
        surface: {
          0:   "#ffffff",
          50:  "#f7f8f6",
          100: "#eef2f0",
          200: "#dbe2e3",
          300: "#cbd6d9",
          400: "#687b86",
          500: "#5b6d78",
          600: "#516372",
          700: "#334e5c",
          800: "#1f3442",
          900: "#0b1526",
        },
        // ── Status Palette ──────────────────────────────────────────────
        success: {
          DEFAULT: "#059669",
          light: "#d1fae5",
          text:  "#065f46",
        },
        warning: {
          DEFAULT: "#d97706",
          light: "#fef3c7",
          text:  "#92400e",
        },
        danger: {
          DEFAULT: "#dc2626",
          light: "#fee2e2",
          text:  "#991b1b",
        },
        info: {
          DEFAULT: "#2563eb",
          light: "#dbeafe",
          text:  "#1e40af",
        },
      },

      fontFamily: {
        // Primary interface stack; keep aligned with --font-sans in globals.css.
        sans: [
          "Aptos",
          "Inter",
          '"Segoe UI"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        // Serif is reserved for display moments, not product headings or amounts.
        serif: [
          "Georgia",
          '"Times New Roman"',
          "Times",
          "serif",
        ],
        // Mono is reserved for IDs, dates, timestamps and references.
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        xs:   ["0.75rem",  { lineHeight: "1rem" }],
        sm:   ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem",     { lineHeight: "1.5rem" }],
        lg:   ["1.125rem", { lineHeight: "1.75rem" }],
        xl:   ["1.25rem",  { lineHeight: "1.75rem" }],
        "2xl":["1.5rem",   { lineHeight: "2rem" }],
        "3xl":["1.875rem", { lineHeight: "2.25rem" }],
        "4xl":["2.25rem",  { lineHeight: "2.5rem" }],
        "5xl":["3rem",     { lineHeight: "1.1" }],
        "6xl":["3.75rem",  { lineHeight: "1.05" }],
        "7xl":["4.5rem",   { lineHeight: "1" }],
        "8xl":["6rem",     { lineHeight: "1" }],
      },

      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem",
        "34": "8.5rem",
        "38": "9.5rem",
      },

      maxWidth: {
        "8xl": "88rem",
        "9xl": "96rem",
      },

      borderRadius: {
        "none": "0",
        "sm":   "0.25rem",
        DEFAULT:"0.375rem",
        "md":   "0.5rem",
        "lg":   "0.5rem",
        "xl":   "0.5rem",
        "2xl":  "0.75rem",
        "3xl":  "0.75rem",
        "full": "9999px",
      },

      boxShadow: {
        // Subtle, tactile elevation — not glossy AI shadows
        "card":    "0 1px 3px 0 rgba(11, 21, 38, 0.06), 0 1px 2px -1px rgba(11, 21, 38, 0.04)",
        "card-md": "0 4px 8px -2px rgba(11, 21, 38, 0.08), 0 2px 4px -2px rgba(11, 21, 38, 0.04)",
        "card-lg": "0 10px 24px -4px rgba(11, 21, 38, 0.10), 0 4px 8px -4px rgba(11, 21, 38, 0.06)",
        "lifted":  "0 16px 48px -8px rgba(11, 21, 38, 0.15)",
        "inset":   "inset 0 2px 4px 0 rgba(11, 21, 38, 0.06)",
        "focus":   "0 0 0 3px rgba(13, 148, 136, 0.25)",
        "none":    "none",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.4" },
        },
      },

      animation: {
        "fade-in":   "fade-in 0.3s ease-out both",
        "slide-up":  "slide-up 0.4s ease-out both",
        "shimmer":   "shimmer 1.5s infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },

      transitionDuration: {
        "150": "150ms",
        "200": "200ms",
        "300": "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
