module.exports = {
    parser: "@typescript-eslint/parser",
    extends: [
        "plugin:@typescript-eslint/recommended",
    ],
    plugins: [
        "@typescript-eslint",
    ],
    rules: {
        // Add your custom rules here
    },
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
    },
};
