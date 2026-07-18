import officeAddins from "eslint-plugin-office-addins";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["src/pkg/**", "dist/**", "build/**"],
  },
  ...officeAddins.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "office-addins": officeAddins,
    },
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser,
        Word: "readonly",
        RequestInit: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-redeclare": "off",
      "no-unused-vars": "off",
    },
  },
];
