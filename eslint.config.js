// ESLint 9 (flat config). Sem dependências extras: os globais do navegador
// usados pelo projeto são declarados aqui.
// Rodar:  npm install && npm run lint
const browserGlobals = {
    window: "readonly",
    document: "readonly",
    localStorage: "readonly",
    console: "readonly",
    Intl: "readonly",
    Set: "readonly",
    Date: "readonly",
    Number: "readonly",
    String: "readonly",
    Array: "readonly",
    Object: "readonly",
    Math: "readonly",
    JSON: "readonly",
    Error: "readonly",
    NodeFilter: "readonly"
};

module.exports = [
    {
        files: ["script.js", "i18n-loader.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                ...browserGlobals,
                // definidos em i18n.js (carregado antes)
                i18n: "readonly",
                t: "readonly",
                getCurrentLanguage: "readonly",
                setCurrentLanguage: "readonly"
            }
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": "warn",
            "no-var": "error",
            "prefer-const": "warn",
            "eqeqeq": "error"
        }
    },
    {
        files: ["i18n.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: browserGlobals
        },
        rules: {
            // i18n.js declara globais de propósito (consumidos por outros scripts)
            "no-unused-vars": "off",
            "no-var": "error",
            "eqeqeq": "error"
        }
    }
];
