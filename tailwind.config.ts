import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  // `class` (not `media`) so Tailwind's `dark:` variant only fires when
  // <html class="dark"> is present — the app currently locks to light mode
  // via data-theme and nothing sets that class, so no `dark:` rules apply.
  // Prevents legacy dark: overrides from flipping inputs on OS dark-mode
  // users while our CSS-var theme stays light.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-2": "var(--paper-2)",
        ink: {
          100: "var(--ink-100)",
          200: "var(--ink-200)",
          300: "var(--ink-300)",
          400: "var(--ink-400)",
          500: "var(--ink-500)",
          600: "var(--ink-600)",
          700: "var(--ink-700)",
          900: "var(--ink-900)",
        },
        tide: {
          DEFAULT: "var(--tide)",
          2: "var(--tide-2)",
          soft: "var(--tide-soft)",
        },
        sand: {
          DEFAULT: "var(--sand)",
          2: "var(--sand-2)",
          shell: "var(--shell)",
        },
        warn: {
          DEFAULT: "var(--warn)",
          soft: "var(--warn-soft)",
        },
        ok: {
          DEFAULT: "var(--ok)",
          soft: "var(--ok-soft)",
        },
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "sans-serif"],
        serif: ["Fraunces", "Cormorant Garamond", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
