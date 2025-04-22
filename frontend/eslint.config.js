import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import {defineConfig} from "eslint/config";


export default defineConfig([
    {files: ["**/*.{js,mjs,cjs,ts,vue}"], plugins: {js}, extends: ["js/recommended"]},
    {files: ["**/*.{js,mjs,cjs,ts,vue}"], languageOptions: {globals: {...globals.browser, ...globals.node}}},
    tseslint.configs.recommended,
    pluginVue.configs["flat/essential"],
    {files: ["**/*.vue"], languageOptions: {parserOptions: {parser: tseslint.parser}}},
    {
        rules: {
            semi: "error",
            "@typescript-eslint/no-explicit-any": "off",
            "vue/multi-word-component-names": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "caughtErrors": "all",
                    "caughtErrorsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "ignoreRestSiblings": true
                }
            ],
        }
    }, {
        ignores: [
            '**/dist',
            './src/main.ts',
            '.vscode',
            '.idea',
            '*.sh',
            '**/node_modules',
            '*.md',
            '*.woff',
            '*.woff',
            '*.ttf',
            'yarn.lock',
            'package-lock.json',
            '/public',
            '/docs',
            '**/output',
            '.husky',
            '.local',
            '/bin',
            'Dockerfile',
        ],
    }
]);