/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--ui-border, 240 5.9% 90%))",
        input: "hsl(var(--ui-input, 240 5.9% 90%))",
        ring: "hsl(var(--ui-ring, 240 5.9% 10%))",
        background: "hsl(var(--ui-background, 0 0% 100%))",
        foreground: "hsl(var(--ui-foreground, 240 10% 3.9%))",
        primary: {
          DEFAULT: "hsl(var(--ui-primary, 240 5.9% 10%))",
          foreground: "hsl(var(--ui-primary-foreground, 0 0% 98%))",
        },
        secondary: {
          DEFAULT: "hsl(var(--ui-secondary, 240 4.8% 95.9%))",
          foreground: "hsl(var(--ui-secondary-foreground, 240 5.9% 10%))",
        },
        destructive: {
          DEFAULT: "hsl(var(--ui-destructive, 0 84.2% 60.2%))",
          foreground: "hsl(var(--ui-destructive-foreground, 0 0% 98%))",
        },
        muted: {
          DEFAULT: "hsl(var(--ui-muted, 240 4.8% 95.9%))",
          foreground: "hsl(var(--ui-muted-foreground, 240 3.8% 46.1%))",
        },
        accent: {
          DEFAULT: "hsl(var(--ui-accent, 240 4.8% 95.9%))",
          foreground: "hsl(var(--ui-accent-foreground, 240 5.9% 10%))",
        },
        popover: {
          DEFAULT: "hsl(var(--ui-popover, 0 0% 100%))",
          foreground: "hsl(var(--ui-popover-foreground, 240 10% 3.9%))",
        },
        card: {
          DEFAULT: "hsl(var(--ui-card, 0 0% 100%))",
          foreground: "hsl(var(--ui-card-foreground, 240 10% 3.9%))",
        },
      },
      borderRadius: {
        lg: "var(--radius, 0.5rem)",
        md: "calc(var(--radius, 0.5rem) - 2px)",
        sm: "calc(var(--radius, 0.5rem) - 4px)",
      },
    },
  },
  plugins: [],
};
