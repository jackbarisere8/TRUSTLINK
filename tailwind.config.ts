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
          50:  "#e8edf5",
          100: "#c5d1e8",
          200: "#9fb2d8",
          300: "#7893c7",
          400: "#5877b9",
          500: "#3c5dac",
          600: "#2d479d",
          700: "#1e3288",
          800: "#0f1f6e",
          900: "#0B1526",
          950: "#070d1a",
        },
        // ── Trust Teal — confirmed states, verified marks ───────────────
        teal: {
          DEFAULT: "#0d9488",
          50:  "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        // ── Surface Neutrals ────────────────────────────────────────────
        surface: {
          0:   "#ffffff",
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
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
        // Primary: system sans-serif stack — clean, legible, Nigerian-device friendly
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        // Serif: for high-impact headlines (job titles, hero text, amount displays)
        serif: [
          "Georgia",
          '"Times New Roman"',
          "Times",
          "serif",
        ],
        // Mono: for IDs, references, code
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          '"Fira Mono"',
          '"Roboto Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
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

