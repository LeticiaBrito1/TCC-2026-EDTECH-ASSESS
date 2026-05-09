import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

const sharedPlugins = {
  react: pluginReact,
  "react-hooks": pluginReactHooks,
  "unused-imports": pluginUnusedImports,
};

const sharedRules = {
  "no-unused-vars": "off",
  "react/jsx-uses-vars": "error",
  "react/jsx-uses-react": "error",
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": [
    "warn",
    {
      vars: "all",
      varsIgnorePattern: "^_",
      args: "after-used",
      argsIgnorePattern: "^_",
    },
  ],
  "react/prop-types": "off",
  "react/react-in-jsx-scope": "off",
  "react-hooks/rules-of-hooks": "error",
};

const sharedLanguageOptions = {
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
};

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "backend/node_modules/**",
      "mobile/node_modules/**",
      "Project Web/**",
      "**/*.docx",
    ],
  },
  {
    files: ["src/**/*.{js,mjs,cjs,jsx}"],
    ignores: ["src/components/ui/**/*"],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...sharedLanguageOptions,
      globals: globals.browser,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: sharedPlugins,
    rules: {
      ...sharedRules,
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
    },
  },
  {
    files: ["mobile/**/*.{js,mjs,cjs,jsx}"],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...sharedLanguageOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: sharedPlugins,
    rules: sharedRules,
  },
];
