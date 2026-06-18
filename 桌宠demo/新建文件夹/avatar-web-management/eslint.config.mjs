// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "storybook-static/**",
    "test-results/**",
    "public/vendor/**",
    "public/sw.js",
    "src/lib/live2d/cubism5.js",
  ]),
  {
    rules: {
      "@next/next/no-assign-module-variable": "warn",
      "@next/next/no-img-element": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "react/display-name": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "storybook/no-renderer-packages": "warn",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx,js,jsx}", "src/components/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@next/next/no-img-element": "off",
      "react/display-name": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    },
  },
  ...storybook.configs["flat/recommended"]
]);

export default eslintConfig;
