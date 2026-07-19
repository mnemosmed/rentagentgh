import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pop: "#FF5A5F",
        navy: "#0B132B",
        graybg: "#EDF2F7",
        background: "#FFFFFF",
        foreground: "#0B132B",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 40px rgba(11, 19, 43, 0.07)",
        card: "0 4px 18px rgba(11, 19, 43, 0.05)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
