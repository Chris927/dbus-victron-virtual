import globals from "globals";
import pluginJs from "@eslint/js";
import jest from "eslint-plugin-jest"


export default [
  { languageOptions: { globals: { ...globals.browser, ...globals.jest } } },
  pluginJs.configs.recommended,
  { files: ["src/__tests__/*.js"], plugins: { jest: jest } }
];
