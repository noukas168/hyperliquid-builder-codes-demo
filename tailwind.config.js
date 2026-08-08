/** @type {import('tailwindcss').Config} */

function withAlpha(varName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${varName}), ${opacityValue})`;
    }
    return `rgb(var(${varName}))`;
  };
}

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-family-heading)"],
        body: ["var(--font-family-body)"],
        // Basis: interface text and numerals are deliberately different faces.
        ui: ["var(--bs-font-ui)"],
        num: ["var(--bs-font-num)"],
      },
      /**
       * Basis type scale. Explicit sizes paired with explicit line heights,
       * rather than Tailwind's defaults, so vertical rhythm is a decision
       * instead of an accident. Sized for a dense trading surface: the base
       * interface size is 13px and labels sit below it.
       */
      fontSize: {
        "bs-2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.01em" }],
        "bs-xs": ["11px", { lineHeight: "16px" }],
        "bs-sm": ["12px", { lineHeight: "18px" }],
        "bs-base": ["13px", { lineHeight: "20px" }],
        "bs-md": ["15px", { lineHeight: "22px" }],
        "bs-lg": ["17px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        // The two amount fields, the largest figures on the page.
        "bs-num": ["26px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
      },
      colors: {
        bs: {
          n0: "var(--bs-n0)",
          n1: "var(--bs-n1)",
          n2: "var(--bs-n2)",
          n3: "var(--bs-n3)",
          n4: "var(--bs-n4)",
          n5: "var(--bs-n5)",
          n6: "var(--bs-n6)",
          n7: "var(--bs-n7)",
          n8: "var(--bs-n8)",
          n9: "var(--bs-n9)",
          brand: "var(--bs-brand)",
          success: "var(--bs-success)",
          alarm: "var(--bs-alarm)",
          warn: "var(--bs-warn)",
        },
        hl: {
          green: withAlpha("--primary"),
          red: withAlpha("--errorColor"),
          bg: withAlpha("--background"),
          card: withAlpha("--cardBackground"),
          border: withAlpha("--borderColor"),
          text: withAlpha("--text"),
          muted: withAlpha("--inputPlaceholder"),
          "primary-light": withAlpha("--primary-light"),
          "primary-dark": withAlpha("--primary-dark"),
          secondary: withAlpha("--secondary"),
          warning: withAlpha("--warningColor"),
          "input-bg": withAlpha("--inputBackground"),
        },
      },
      boxShadow: {
        "dw-md": "var(--shadow-md)",
        "dw-lg": "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};
