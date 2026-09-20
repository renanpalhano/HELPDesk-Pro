/*
 * ============================================================================
 * HelpDesk Pro — Carregador de Idioma (i18n-loader.js)
 *
 * Aplica as traduções do dicionário (i18n.js) ao HTML de forma GENÉRICA,
 * lendo atributos declarados no próprio elemento:
 *
 *   data-i18n="chave"              → textContent
 *   data-i18n-placeholder="chave"  → placeholder
 *   data-i18n-aria-label="chave"   → aria-label
 *   data-i18n-title="chave"        → title
 *   data-i18n-content="chave"      → content (meta description)
 *
 * Como o vínculo viaja junto com a tag, o HTML não pode mais mudar sem que
 * a tradução acompanhe (acabaram os seletores frágeis do loader antigo).
 * Chave inexistente => o texto original do HTML é preservado.
 *
 * Deve ser carregado DEPOIS de i18n.js e DEPOIS de script.js.
 * O conteúdo dinâmico (tabela, dashboard, formulário em modo edição, datas)
 * é redesenhado por window.HelpDesk.refresh(), exposto pelo script.js.
 * ============================================================================
 */

(function () {
    "use strict";

    /* ======================================================================
       GERENCIADOR DE IDIOMA
       O idioma vive em memória (i18n.js); o localStorage só persiste a
       escolha e é acessado com try/catch dentro de setCurrentLanguage().
       ====================================================================== */

    class LanguageManager {

        constructor() {
            this.currentLang = getCurrentLanguage();
            this.observers = [];
        }

        setLanguage(lang) {
            if (!setCurrentLanguage(lang)) {
                console.warn(`Idioma "${lang}" não suportado.`);
                return false;
            }

            this.currentLang = lang;
            this.notifyObservers();

            return true;
        }

        getLanguage() {
            return this.currentLang;
        }

        getLocale() {
            return this.currentLang === "en" ? "en-US" : "pt-BR";
        }

        onLanguageChange(callback) {
            this.observers.push(callback);
        }

        notifyObservers() {
            this.observers.forEach((callback) => {
                try {
                    callback(this.currentLang);
                } catch (error) {
                    console.error("Erro ao notificar observador de idioma:", error);
                }
            });
        }
    }

    const languageManager = new LanguageManager();

    window.languageManager = languageManager;

    /* ======================================================================
       TRADUÇÃO GENÉRICA DO DOCUMENTO
       ====================================================================== */

    const ATTRIBUTE_BINDINGS = [
        ["data-i18n-placeholder", "placeholder"],
        ["data-i18n-aria-label", "aria-label"],
        ["data-i18n-title", "title"],
        ["data-i18n-content", "content"]
    ];

    function translateDocument() {

        document.querySelectorAll("[data-i18n]").forEach((element) => {
            const key = element.getAttribute("data-i18n");
            const value = t(key);

            if (value !== key) {
                element.textContent = value;
            }
        });

        ATTRIBUTE_BINDINGS.forEach(([dataAttribute, targetAttribute]) => {
            document.querySelectorAll(`[${dataAttribute}]`).forEach((element) => {
                const key = element.getAttribute(dataAttribute);
                const value = t(key);

                if (value !== key) {
                    element.setAttribute(targetAttribute, value);
                }
            });
        });

        // <title> e lang: o leitor de tela usa o lang para escolher a pronúncia
        document.title = t("meta.title");
        document.documentElement.lang =
            languageManager.getLanguage() === "en" ? "en" : "pt-BR";
    }

    function applyTranslations() {

        translateDocument();
        updateLanguageSelector();

        // Redesenha o conteúdo dinâmico (tabela, dashboard, formulário, datas)
        if (window.HelpDesk && typeof window.HelpDesk.refresh === "function") {
            window.HelpDesk.refresh();
        }
    }

    /* ======================================================================
       SELETOR DE IDIOMA (botões já existem no HTML)
       ====================================================================== */

    function updateLanguageSelector() {

        document.querySelectorAll("#languageSelector .lang-button").forEach((button) => {
            const isActive = button.dataset.lang === languageManager.getLanguage();

            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    }

    function bindLanguageSelector() {

        document.querySelectorAll("#languageSelector .lang-button").forEach((button) => {
            button.addEventListener("click", () => {
                languageManager.setLanguage(button.dataset.lang);
            });
        });
    }

    /* ======================================================================
       INICIALIZAÇÃO
       ====================================================================== */

    languageManager.onLanguageChange(applyTranslations);

    function boot() {

        if (typeof i18n === "undefined" || typeof t !== "function") {
            console.error("i18n.js não foi carregado antes de i18n-loader.js.");
            return;
        }

        bindLanguageSelector();
        applyTranslations();
    }

    if (document.readyState === "loading") {
        // Registrado DEPOIS do DOMContentLoaded do script.js, logo roda depois
        // do initializeApp().
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
