import { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import { shadcnPlugin } from './src/lib/shadcn-plugin';
import { Fragment } from "react";

// Define our custom animations
const animations = {
  keyframes: {
    "accordion-down": {
      from: { height: "0", opacity: "0" },
      to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
    },
    "accordion-up": {
      from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
      to: { height: "0", opacity: "0" },
    },
    "fade-in": {
      "0%": {
        opacity: "0",
        transform: "translateY(10px)",
      },
      "100%": {
        opacity: "1",
        transform: "translateY(0)",
      },
    },
    "fade-out": {
      "0%": {
        opacity: "1",
        transform: "translateY(0)",
      },
      "100%": {
        opacity: "0",
        transform: "translateY(10px)",
      },
    },
    "scale-in": {
      "0%": {
        transform: "scale(0.95)",
        opacity: "0",
      },
      "100%": {
        transform: "scale(1)",
        opacity: "1",
      },
    },
    "scale-out": {
      from: { transform: "scale(1)", opacity: "1" },
      to: { transform: "scale(0.95)", opacity: "0" },
    },
    "pulse-gentle": {
      "0%, 100%": {
        opacity: "1",
      },
      "50%": {
        opacity: "0.5",
      },
    },
  },
  animation: {
    "accordion-down": "accordion-down 0.2s ease-out",
    "accordion-up": "accordion-up 0.2s ease-out",
    "fade-in": "fade-in 0.3s ease-out",
    "fade-out": "fade-out 0.3s ease-out",
    "scale-in": "scale-in 0.2s ease-out",
    "scale-out": "scale-out 0.2s ease-out",
    "pulse-gentle": "pulse-gentle 1.5s infinite",
  },
};

const config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        mama: {
          mustard: "#FFD95D",
          dark: "#1A1F2C",
          eggshell: "#F0EADC",
          button: "#2F6726FF",
          fern:"#4CAF50",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter var", ...fontFamily.sans],
      },
      ...animations,
    },
  },
  plugins: [
    shadcnPlugin,
    require("tailwindcss-animate"),
  ],
} satisfies Config;

export default config;
