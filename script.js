/*
 * ============================================================================
 * HELPDesk Pro
 * Sistema de gerenciamento de chamados de TI
 * HTML + CSS + JavaScript puro + localStorage (sem backend, sem build)
 *
 * LIMITAÇÕES ASSUMIDAS (ver README.md):
 *  - Sem autenticação/autorização e sem backend: os dados vivem no navegador.
 *  - Validação apenas no cliente.
 *
 * Todo o código está em uma IIFE com "use strict" real: nenhuma variável da
 * aplicação vaza para `window`. A única interface pública é window.HelpDesk
 * (usada pelo i18n-loader.js para redesenhar o conteúdo dinâmico).
 * ============================================================================
 */

(function () {
    "use strict";

    /* ==========================================================================
    CONFIGURAÇÕES E REGRAS DE NEGÓCIO
    ========================================================================== */

    const STORAGE_KEYS = {
        tickets: "helpdesk-pro-tickets",
        // Contador do número do chamado. SÓ INCREMENTA: excluir o último
        // chamado nunca faz o número ser reutilizado.
        lastId: "helpdesk-pro-last-id",
        // Marca que os dados de exemplo já foram semeados uma vez.
        seeded: "helpdesk-pro-seeded",
        schema: "helpdesk-pro-schema",
        backupCorrupted: "helpdesk-pro-backup-corrupted",
        backupInvalid: "helpdesk-pro-backup-invalid"
    };

    // Versão do formato dos dados gravados. Subir ao mudar o modelo.
    // v3: isDemo, editLog, validação de schema na leitura.
    const SCHEMA_VERSION = 3;

    const FIRST_TICKET_ID = 1000;

    const MAX_EDIT_LOG_ENTRIES = 50;

    // Valores de domínio: gravados SEMPRE em português, independentes do idioma.
    const STATUS = {
        ABERTO: "Aberto",
        ATENDIMENTO: "Em atendimento",
        RESOLVIDO: "Resolvido",
        ENCERRADO: "Encerrado"
    };

    const STATUS_LIST = [
        STATUS.ABERTO,
        STATUS.ATENDIMENTO,
        STATUS.RESOLVIDO,
        STATUS.ENCERRADO
    ];

    /*
     * TRANSIÇÕES DE STATUS PERMITIDAS (regra de negócio explícita).
     *
     *   Aberto          → Em atendimento | Encerrado (cancelado/duplicado)
     *   Em atendimento  → Aberto (devolvido à fila) | Resolvido | Encerrado
     *   Resolvido       → Em atendimento (solicitante recusou) | Encerrado
     *   Encerrado       → Aberto (reabertura)
     *
     * Para mudar a regra, edite somente este objeto.
     */
    const STATUS_TRANSITIONS = {
        [STATUS.ABERTO]: [STATUS.ATENDIMENTO, STATUS.ENCERRADO],
        [STATUS.ATENDIMENTO]: [STATUS.ABERTO, STATUS.RESOLVIDO, STATUS.ENCERRADO],
        [STATUS.RESOLVIDO]: [STATUS.ATENDIMENTO, STATUS.ENCERRADO],
        [STATUS.ENCERRADO]: [STATUS.ABERTO]
    };

    const PRIORITY = {
        BAIXA: "Baixa",
        MEDIA: "Média",
        ALTA: "Alta",
        CRITICA: "Crítica"
    };

    const PRIORITY_LIST = [
        PRIORITY.BAIXA,
        PRIORITY.MEDIA,
        PRIORITY.ALTA,
        PRIORITY.CRITICA
    ];

    const PRIORITY_WEIGHT = {
        "Baixa": 1,
        "Média": 2,
        "Alta": 3,
        "Crítica": 4
    };

    const DEPARTMENTS = [
        "Administrativo",
        "Comercial",
        "Financeiro",
        "Marketing",
        "Recursos Humanos",
        "Operações",
        "Tecnologia",
        "Outro"
    ];

    const CATEGORIES = [
        "Hardware",
        "Software",
        "Rede",
        "Acesso",
        "E-mail",
        "Impressão",
        "Sistemas",
        "Segurança"
    ];

    const DEFAULT_CATEGORY = "Sistemas";
    const DEFAULT_DEPARTMENT = "Outro";
    const DEFAULT_PRIORITY = PRIORITY.MEDIA;

    // Campos cuja alteração é registrada em editLog (auditoria)
    const TRACKED_FIELDS = [
        "requester",
        "department",
        "category",
        "title",
        "description",
        "priority"
    ];

    const LIMITS = {
        requester: 80,
        title: 120,
        description: 1000
    };

    /* ==========================================================================
    HELPERS DE IDIOMA (i18n)
    --------------------------------------------------------------------------
    Os valores gravados nos chamados continuam SEMPRE em português
    ("Aberto", "Alta", "Financeiro"...). Só o texto exibido é traduzido.
    Todos os textos vêm do dicionário i18n.js (única fonte de verdade).
    ========================================================================== */

    function tr(key, replacements) {

        if (typeof t !== "function") {
            return key;
        }

        return t(key, replacements || {});
    }

    function getLocale() {

        const lang =
            typeof getCurrentLanguage === "function"
                ? getCurrentLanguage()
                : "pt";

        return lang === "en" ? "en-US" : "pt-BR";
    }

    function labelStatus(status) {

        const keys = {
            "Aberto": "status.open",
            "Em atendimento": "status.inProgress",
            "Resolvido": "status.resolved",
            "Encerrado": "status.closed"
        };

        return keys[status] ? tr(keys[status]) : status;
    }

    function labelPriority(priority) {

        const keys = {
            "Baixa": "form.priorities.low",
            "Média": "form.priorities.medium",
            "Alta": "form.priorities.high",
            "Crítica": "form.priorities.critical"
        };

        return keys[priority] ? tr(keys[priority]) : priority;
    }

    function labelDepartment(department) {

        const keys = {
            "Tecnologia": "form.departments.it",
            "Recursos Humanos": "form.departments.hr",
            "Financeiro": "form.departments.finance",
            "Comercial": "form.departments.sales",
            "Marketing": "form.departments.marketing",
            "Administrativo": "form.departments.administrative",
            "Operações": "form.departments.operations",
            "Outro": "form.departments.other"
        };

        return keys[department] ? tr(keys[department]) : department;
    }

    function labelCategory(category) {

        const keys = {
            "Hardware": "form.categories.hardware",
            "Software": "form.categories.software",
            "Rede": "form.categories.network",
            "Acesso": "form.categories.access",
            "E-mail": "form.categories.email",
            "Impressão": "form.categories.printing",
            "Sistemas": "form.categories.systems",
            "Segurança": "form.categories.security"
        };

        return keys[category] ? tr(keys[category]) : category;
    }

    /* ==========================================================================
    ARMAZENAMENTO SEGURO
    --------------------------------------------------------------------------
    localStorage pode lançar exceção (modo privado, cota cheia, bloqueio em
    file://). TODO acesso passa por aqui, sempre com try/catch.
    ========================================================================== */

    const storage = {

        get(key) {
            try {
                return window.localStorage.getItem(key);
            } catch (error) {
                return null;
            }
        },

        set(key, value) {
            try {
                window.localStorage.setItem(key, value);
                return true;
            } catch (error) {
                return false;
            }
        },

        remove(key) {
            try {
                window.localStorage.removeItem(key);
            } catch (error) {
                // nada a fazer
            }
        },

        isAvailable() {
            try {
                const probe = "__helpdesk_probe__";
                window.localStorage.setItem(probe, "1");
                window.localStorage.removeItem(probe);
                return true;
            } catch (error) {
                return false;
            }
        }
    };

    /* ==========================================================================
    ESTADO DA APLICAÇÃO
    ========================================================================== */

    let tickets = [];
    let selectedTicketId = null;
    let ticketToDeleteId = null;
    let storageAvailable = true;
    let lastIssuedId = 0;

    /* Modal atualmente ativo (focus trap).
       { element, opener, openerAction, openerId } */
    let activeModal = null;

    const drawerQuery = window.matchMedia("(max-width: 900px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* ==========================================================================
    ELEMENTOS DOM
    ========================================================================== */

    const elements = {
        sidebar: document.getElementById("sidebar"),
        mobileOverlay: document.getElementById("mobileOverlay"),
        mobileMenuButton: document.getElementById("mobileMenuButton"),

        currentDate: document.getElementById("currentDate"),
        breadcrumbCurrent: document.getElementById("breadcrumbCurrent"),

        navItems: document.querySelectorAll(".nav-item"),
        sectionButtons: document.querySelectorAll("[data-section]"),
        pageSections: document.querySelectorAll(".page-section"),
        statCards: document.querySelectorAll("[data-stat-filter]"),

        storageStatus: document.getElementById("storageStatus"),
        storageStatusDot: document.getElementById("storageStatusDot"),
        storageStatusTitle: document.getElementById("storageStatusTitle"),
        storageStatusHint: document.getElementById("storageStatusHint"),
        loadDemoButton: document.getElementById("loadDemoButton"),
        demoBanner: document.getElementById("demoBanner"),
        removeDemoButton: document.getElementById("removeDemoButton"),

        statTotal: document.getElementById("statTotal"),
        statOpen: document.getElementById("statOpen"),
        statProgress: document.getElementById("statProgress"),
        statResolved: document.getElementById("statResolved"),

        recentTickets: document.getElementById("recentTickets"),
        statusSummary: document.getElementById("statusSummary"),

        searchInput: document.getElementById("searchInput"),
        statusFilter: document.getElementById("statusFilter"),
        priorityFilter: document.getElementById("priorityFilter"),
        categoryFilter: document.getElementById("categoryFilter"),
        sortSelect: document.getElementById("sortSelect"),
        resultsCount: document.getElementById("resultsCount"),

        tableWrapper: document.getElementById("tableWrapper"),
        ticketsTableBody: document.getElementById("ticketsTableBody"),
        ticketsEmpty: document.getElementById("ticketsEmpty"),
        ticketsEmptyTitle: document.getElementById("ticketsEmptyTitle"),
        ticketsEmptyText: document.getElementById("ticketsEmptyText"),
        clearFiltersButton: document.getElementById("clearFiltersButton"),
        emptyNewButton: document.getElementById("emptyNewButton"),

        formEyebrow: document.getElementById("formEyebrow"),
        formTitle: document.getElementById("novo-chamado-title"),
        formSubtitle: document.getElementById("formSubtitle"),
        editBanner: document.getElementById("editBanner"),
        formErrorSummary: document.getElementById("formErrorSummary"),
        ticketForm: document.getElementById("ticketForm"),
        requester: document.getElementById("requester"),
        department: document.getElementById("department"),
        category: document.getElementById("category"),
        title: document.getElementById("title"),
        description: document.getElementById("description"),
        priority: document.getElementById("priority"),
        characterCount: document.getElementById("characterCount"),
        cancelFormButton: document.getElementById("cancelFormButton"),
        submitTicketButton: document.getElementById("submitTicketButton"),

        ticketModal: document.getElementById("ticketModal"),
        closeModalButton: document.getElementById("closeModalButton"),
        modalCloseFooter: document.getElementById("modalCloseFooter"),
        modalEditButton: document.getElementById("modalEditButton"),
        modalTicketNumber: document.getElementById("modalTicketNumber"),
        modalTitle: document.getElementById("modalTitle"),
        modalContent: document.getElementById("modalContent"),

        confirmModal: document.getElementById("confirmModal"),
        closeConfirmButton: document.getElementById("closeConfirmButton"),
        cancelDeleteButton: document.getElementById("cancelDeleteButton"),
        confirmDeleteButton: document.getElementById("confirmDeleteButton"),
        confirmMessage: document.getElementById("confirmMessage"),

        toast: document.getElementById("toast"),
        toastTitle: document.getElementById("toastTitle"),
        toastMessage: document.getElementById("toastMessage")
    };

    /* ==========================================================================
    TRATAMENTO GLOBAL DE ERROS
    Falhas inesperadas deixam de ser invisíveis: o usuário é avisado e o
    detalhe vai para o console.
    ========================================================================== */

    let lastUnexpectedErrorAt = 0;

    function reportUnexpectedError(error) {

        console.error("Erro inesperado:", error);

        const now = Date.now();

        // Evita "tempestade" de toasts se o mesmo erro se repetir
        if (now - lastUnexpectedErrorAt < 5000) {
            return;
        }

        lastUnexpectedErrorAt = now;

        try {
            showToast(
                tr("toast.unexpected"),
                tr("toast.unexpectedMsg"),
                "error"
            );
        } catch (toastError) {
            console.error("Falha ao exibir o aviso de erro:", toastError);
        }
    }

    window.addEventListener("error", (event) => {

        // Erros de scripts de outra origem chegam sem detalhe (event.error nulo)
        if (event.error) {
            reportUnexpectedError(event.error);
        }
    });

    window.addEventListener("unhandledrejection", (event) => {
        reportUnexpectedError(event.reason);
    });

    /* ==========================================================================
    INICIALIZAÇÃO
    ========================================================================== */

    document.addEventListener("DOMContentLoaded", initializeApp);

    function initializeApp() {

        storageAvailable = storage.isAvailable();

        loadTickets();
        setupEventListeners();
        syncSidebarAccessibility();
        updateCurrentDate();
        updateStorageStatus();
        updateFormMode();
        updateDashboard();
        renderTickets();
    }

    /*
     * API pública usada pelo i18n-loader.js para redesenhar o conteúdo
     * dinâmico quando o idioma muda. É o único ponto de contato entre os
     * dois arquivos (contrato explícito, não variável global acidental).
     */
    window.HelpDesk = {
        refresh() {
            updateCurrentDate();
            updateBreadcrumb(getActiveSectionName());
            updateStorageStatus();
            updateFormMode();
            updateDashboard();
            renderTickets();
            updateCharacterCount();
        }
    };

    function getActiveSectionName() {

        const active = document.querySelector(".page-section.active");

        if (!active) {
            return "dashboard";
        }

        return active.id.replace("section-", "");
    }

    /* ==========================================================================
    EVENTOS
    ========================================================================== */

    function debounce(callback, delay) {

        let timer = null;

        return function debounced(...args) {
            window.clearTimeout(timer);

            timer = window.setTimeout(() => {
                callback.apply(null, args);
            }, delay);
        };
    }

    function setupEventListeners() {

        elements.sectionButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const section = button.dataset.section;

                if (!section) {
                    return;
                }

                // Clicar em "Novo chamado" durante uma edição abre um
                // formulário limpo, em vez de continuar editando.
                if (section === "novo-chamado" && isEditing()) {
                    resetTicketForm();
                }

                navigateTo(section);
            });
        });

        elements.statCards.forEach((card) => {
            card.addEventListener("click", () => {
                showTicketsWithStatus(card.dataset.statFilter);
            });
        });

        elements.mobileMenuButton.addEventListener("click", toggleMobileMenu);

        elements.mobileOverlay.addEventListener("click", () => closeMobileMenu(true));

        elements.ticketForm.addEventListener("submit", handleFormSubmit);

        elements.cancelFormButton.addEventListener("click", () => {
            resetTicketForm();
            navigateTo("dashboard");
        });

        elements.description.addEventListener("input", updateCharacterCount);

        // Ao corrigir um campo, o erro dele some na hora
        ["requester", "department", "category", "title", "description", "priority"]
            .forEach((field) => {
                const input = elements[field];
                const eventName = input.tagName === "SELECT" ? "change" : "input";

                input.addEventListener(eventName, () => {
                    clearFieldError(field);
                    hideErrorSummaryIfClean();
                });
            });

        // Busca com debounce: evita redesenhar a tabela a cada tecla
        elements.searchInput.addEventListener("input", debounce(renderTickets, 200));
        elements.statusFilter.addEventListener("change", renderTickets);
        elements.priorityFilter.addEventListener("change", renderTickets);
        elements.categoryFilter.addEventListener("change", renderTickets);
        elements.sortSelect.addEventListener("change", renderTickets);

        elements.clearFiltersButton.addEventListener("click", clearFilters);

        // Delegação de eventos: UM listener no <tbody> sobrevive à
        // substituição do conteúdo a cada renderização.
        elements.ticketsTableBody.addEventListener("click", handleTableClick);

        elements.removeDemoButton.addEventListener("click", removeDemoTickets);
        elements.loadDemoButton.addEventListener("click", addDemoTickets);

        elements.closeModalButton.addEventListener("click", () => closeTicketModal());
        elements.modalCloseFooter.addEventListener("click", () => closeTicketModal());
        elements.modalEditButton.addEventListener("click", handleModalEdit);

        elements.closeConfirmButton.addEventListener("click", () => closeConfirmModal());
        elements.cancelDeleteButton.addEventListener("click", () => closeConfirmModal());
        elements.confirmDeleteButton.addEventListener("click", confirmDelete);

        // Clicar fora do painel (no fundo escuro) fecha o modal
        elements.ticketModal.addEventListener("click", (event) => {
            if (event.target === elements.ticketModal) {
                closeTicketModal();
            }
        });

        elements.confirmModal.addEventListener("click", (event) => {
            if (event.target === elements.confirmModal) {
                closeConfirmModal();
            }
        });

        document.addEventListener("keydown", handleKeyboard);

        window.addEventListener("resize", handleWindowResize);
    }

    /* ==========================================================================
    NAVEGAÇÃO
    ========================================================================== */

    function scrollBehavior() {
        return reducedMotionQuery.matches ? "auto" : "smooth";
    }

    function navigateTo(sectionName) {

        const targetSection = document.getElementById(`section-${sectionName}`);

        if (!targetSection) {
            return;
        }

        // Saiu do formulário durante uma edição: descarta o modo edição
        // para não deixar o formulário "preso" em um chamado antigo.
        if (sectionName !== "novo-chamado" && isEditing()) {
            resetTicketForm();
        }

        elements.pageSections.forEach((section) => {
            section.classList.remove("active");
        });

        targetSection.classList.add("active");

        elements.navItems.forEach((item) => {
            const isCurrent = item.dataset.section === sectionName;

            item.classList.toggle("active", isCurrent);

            if (isCurrent) {
                item.setAttribute("aria-current", "page");
            } else {
                item.removeAttribute("aria-current");
            }
        });

        updateBreadcrumb(sectionName);
        closeMobileMenu(false);

        window.scrollTo({
            top: 0,
            behavior: scrollBehavior()
        });

        if (sectionName === "chamados") {
            renderTickets();
        }

        if (sectionName === "dashboard") {
            updateDashboard();
        }

        // Leitores de tela e teclado: o foco vai para o título da nova seção
        const heading = targetSection.querySelector("h1");

        if (heading) {
            heading.focus({ preventScroll: true });
        }
    }

    function updateBreadcrumb(sectionName) {

        const labels = {
            dashboard: tr("nav.dashboard"),
            chamados: tr("nav.tickets"),
            "novo-chamado": tr("nav.newTicket")
        };

        elements.breadcrumbCurrent.textContent =
            labels[sectionName] || labels.dashboard;
    }

    /*
     * Cartões do dashboard: aplicam o filtro correspondente e levam à lista,
     * para que o número do painel sempre confira com a lista filtrada.
     */
    function showTicketsWithStatus(status) {

        elements.searchInput.value = "";
        elements.priorityFilter.value = "todas";
        elements.categoryFilter.value = "todas";
        elements.statusFilter.value = status;

        navigateTo("chamados");
    }

    /* ==========================================================================
    MENU MOBILE / DRAWER (≤ 900px)
    ========================================================================== */

    /*
     * No modo drawer a sidebar fica fora da tela, mas continuaria focável
     * por Tab. `inert` a remove da ordem de foco enquanto está fechada.
     */
    function syncSidebarAccessibility() {

        const isOpen = elements.sidebar.classList.contains("mobile-open");

        if (drawerQuery.matches && !isOpen) {
            elements.sidebar.setAttribute("inert", "");
        } else {
            elements.sidebar.removeAttribute("inert");
        }
    }

    function toggleMobileMenu() {

        const isOpen = elements.sidebar.classList.toggle("mobile-open");

        elements.mobileOverlay.classList.toggle("active", isOpen);

        elements.mobileMenuButton.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        syncSidebarAccessibility();

        if (isOpen) {
            const firstItem = elements.sidebar.querySelector(".nav-item");

            if (firstItem) {
                firstItem.focus();
            }
        }
    }

    function closeMobileMenu(restoreFocus) {

        const wasOpen = elements.sidebar.classList.contains("mobile-open");

        elements.sidebar.classList.remove("mobile-open");
        elements.mobileOverlay.classList.remove("active");

        elements.mobileMenuButton.setAttribute(
            "aria-expanded",
            "false"
        );

        syncSidebarAccessibility();

        if (wasOpen && restoreFocus) {
            elements.mobileMenuButton.focus();
        }
    }

    function handleWindowResize() {

        if (!drawerQuery.matches) {
            closeMobileMenu(false);
        }

        syncSidebarAccessibility();
    }

    /* ==========================================================================
    STATUS REAL DO ARMAZENAMENTO
    (substitui o antigo "Sistema operacional", que era decorativo e falso)
    ========================================================================== */

    function updateStorageStatus() {

        elements.storageStatusTitle.textContent =
            storageAvailable
                ? tr("storage.okTitle")
                : tr("storage.errorTitle");

        elements.storageStatusHint.textContent =
            storageAvailable
                ? tr("storage.okHint")
                : tr("storage.errorHint");

        elements.storageStatusDot.classList.toggle("error", !storageAvailable);
    }

    /* ==========================================================================
    VALIDAÇÃO E NORMALIZAÇÃO DE DADOS LIDOS DO localStorage
    --------------------------------------------------------------------------
    O localStorage é entrada NÃO confiável (editável pelo DevTools, versões
    antigas do sistema). Cada registro é validado campo a campo:
      - campos essenciais ausentes/inválidos  → registro descartado
        (guardado em cópia de segurança, nunca apagado em silêncio);
      - campos secundários inválidos          → recebem valor padrão seguro.
    ========================================================================== */

    function cleanText(value, maxLength) {

        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value).slice(0, maxLength);
        }

        if (typeof value !== "string") {
            return "";
        }

        return value.trim().slice(0, maxLength);
    }

    function toIsoDate(value) {

        if (typeof value !== "string") {
            return null;
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    function normalizeStatusHistory(rawHistory, status, createdAt, updatedAt) {

        const history = Array.isArray(rawHistory)
            ? rawHistory
                .filter((entry) =>
                    entry &&
                    STATUS_LIST.includes(entry.status) &&
                    toIsoDate(entry.date)
                )
                .map((entry) => ({
                    status: entry.status,
                    date: toIsoDate(entry.date)
                }))
            : [];

        if (history.length === 0) {
            return [{ status, date: createdAt }];
        }

        // O último item do histórico precisa coincidir com o status atual
        if (history[history.length - 1].status !== status) {
            history.push({ status, date: updatedAt });
        }

        return history;
    }

    function normalizeEditLog(rawLog) {

        if (!Array.isArray(rawLog)) {
            return [];
        }

        return rawLog
            .filter((entry) =>
                entry &&
                toIsoDate(entry.date) &&
                Array.isArray(entry.changes)
            )
            .map((entry) => ({
                date: toIsoDate(entry.date),
                changes: entry.changes
                    .filter((change) =>
                        change &&
                        TRACKED_FIELDS.includes(change.field) &&
                        typeof change.from === "string" &&
                        typeof change.to === "string"
                    )
                    .map((change) => ({
                        field: change.field,
                        from: change.from.slice(0, LIMITS.description),
                        to: change.to.slice(0, LIMITS.description)
                    }))
            }))
            .filter((entry) => entry.changes.length > 0)
            .slice(-MAX_EDIT_LOG_ENTRIES);
    }

    /**
     * Devolve um chamado válido e normalizado, ou null se o registro não
     * puder ser aproveitado.
     */
    function normalizeTicket(raw) {

        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            return null;
        }

        const id = Number(raw.id);

        if (!Number.isInteger(id) || id < 1) {
            return null;
        }

        const requester = cleanText(raw.requester, LIMITS.requester);
        const title = cleanText(raw.title, LIMITS.title);
        const description = cleanText(raw.description, LIMITS.description);

        // Sem estes campos o chamado não tem utilidade
        if (!requester || !title || !description) {
            return null;
        }

        const now = new Date().toISOString();
        const createdAt = toIsoDate(raw.createdAt) || toIsoDate(raw.updatedAt) || now;
        const updatedAt = toIsoDate(raw.updatedAt) || createdAt;

        const status = STATUS_LIST.includes(raw.status)
            ? raw.status
            : STATUS.ABERTO;

        return {
            id,
            requester,
            department: DEPARTMENTS.includes(raw.department)
                ? raw.department
                : DEFAULT_DEPARTMENT,
            category: CATEGORIES.includes(raw.category)
                ? raw.category
                : DEFAULT_CATEGORY,
            title,
            description,
            priority: PRIORITY_LIST.includes(raw.priority)
                ? raw.priority
                : DEFAULT_PRIORITY,
            status,
            createdAt,
            updatedAt,
            statusHistory: normalizeStatusHistory(
                raw.statusHistory,
                status,
                createdAt,
                updatedAt
            ),
            editLog: normalizeEditLog(raw.editLog),
            isDemo: raw.isDemo === true
        };
    }

    /* ==========================================================================
    DATA / LOCAL STORAGE
    ========================================================================== */

    function loadTickets() {

        if (!storageAvailable) {

            // Sem armazenamento: o sistema roda só em memória, com aviso.
            tickets = buildDemoTickets();

            showToast(
                tr("storage.errorTitle"),
                tr("storage.errorHint"),
                "error"
            );

            return;
        }

        const rawTickets = storage.get(STORAGE_KEYS.tickets);

        // Nenhum dado gravado
        if (rawTickets === null) {

            // Primeira execução: semeia UMA vez os dados de exemplo.
            // Se a flag já existe, o usuário apagou tudo de propósito.
            if (storage.get(STORAGE_KEYS.seeded) === null) {
                tickets = buildDemoTickets();
                storage.set(STORAGE_KEYS.seeded, "1");
                saveTickets();
            } else {
                tickets = [];
            }

            return;
        }

        let parsed;

        try {
            parsed = JSON.parse(rawTickets);
        } catch (error) {
            console.error("Erro ao ler chamados salvos:", error);
            parsed = null;
        }

        if (!Array.isArray(parsed)) {

            // Dados ilegíveis: NUNCA sobrescrever sem guardar uma cópia.
            storage.set(STORAGE_KEYS.backupCorrupted, rawTickets);

            tickets = [];

            showToast(
                tr("toast.dataCorrupted"),
                tr("toast.dataCorruptedMsg"),
                "error"
            );

            return;
        }

        const seenIds = new Set();
        const validTickets = [];
        const invalidRecords = [];

        parsed.forEach((record) => {

            const ticket = normalizeTicket(record);

            if (!ticket || seenIds.has(ticket.id)) {
                invalidRecords.push(record);
                return;
            }

            seenIds.add(ticket.id);
            validTickets.push(ticket);
        });

        tickets = validTickets;

        // Contador nunca fica atrás do maior número existente
        const highestId = tickets.reduce(
            (highest, ticket) => Math.max(highest, ticket.id),
            0
        );

        const storedLastId = Number(storage.get(STORAGE_KEYS.lastId)) || 0;

        if (highestId > storedLastId) {
            storage.set(STORAGE_KEYS.lastId, String(highestId));
        }

        if (invalidRecords.length > 0) {

            storage.set(
                STORAGE_KEYS.backupInvalid,
                JSON.stringify(invalidRecords)
            );

            showToast(
                tr("toast.dataRecovered"),
                tr("toast.dataRecoveredMsg", { count: invalidRecords.length }),
                "error"
            );
        }

        const storedSchema = Number(storage.get(STORAGE_KEYS.schema)) || 0;

        // Regrava só se algo foi migrado/normalizado
        if (storedSchema !== SCHEMA_VERSION || invalidRecords.length > 0) {
            saveTickets();
        }
    }

    function saveTickets() {

        const saved =
            storage.set(STORAGE_KEYS.tickets, JSON.stringify(tickets)) &&
            storage.set(STORAGE_KEYS.schema, String(SCHEMA_VERSION));

        storageAvailable = saved;
        updateStorageStatus();

        if (!saved) {

            showToast(
                tr("toast.saveError"),
                tr("toast.saveErrorMsg"),
                "error"
            );
        }

        return saved;
    }

    /*
     * Ponto ÚNICO de gravação + redesenho. Toda mudança nos chamados passa
     * por aqui, então é impossível gravar sem atualizar as telas (ou o
     * contrário). Devolve true se a gravação persistiu.
     */
    function commit() {

        const saved = saveTickets();

        updateDashboard();
        renderTickets();

        return saved;
    }

    /* ==========================================================================
    NÚMERO DO CHAMADO (identificador)
    --------------------------------------------------------------------------
    Contador persistido que SÓ INCREMENTA. O modelo antigo (maior id + 1)
    reaproveitava o número ao excluir o último chamado.
    ========================================================================== */

    function getNextTicketId() {

        const storedLastId = Number(storage.get(STORAGE_KEYS.lastId)) || 0;

        const highestExisting = tickets.reduce(
            (highest, ticket) => Math.max(highest, ticket.id),
            0
        );

        const nextId =
            Math.max(
                storedLastId,
                highestExisting,
                lastIssuedId,
                FIRST_TICKET_ID - 1
            ) + 1;

        lastIssuedId = nextId;

        // Reserva o número imediatamente, mesmo que a gravação do chamado falhe
        storage.set(STORAGE_KEYS.lastId, String(nextId));

        return nextId;
    }

    /* ==========================================================================
    DADOS DE EXEMPLO (rotulados como "Exemplo" na interface)
    ========================================================================== */

    const DEMO_DEFINITIONS = [
        // Do mais antigo para o mais novo
        {
            requester: "Ana Ferreira",
            department: "Administrativo",
            category: "Impressão",
            title: "Impressora não reconhecida",
            description: "A impressora do setor não aparece disponível para impressão.",
            priority: PRIORITY.ALTA,
            status: STATUS.ATENDIMENTO,
            daysAgo: 5
        },
        {
            requester: "Rafael Almeida",
            department: "Recursos Humanos",
            category: "Software",
            title: "Solicitação de instalação de software",
            description: "Necessário instalar o software utilizado para edição dos documentos do setor.",
            priority: PRIORITY.BAIXA,
            status: STATUS.ENCERRADO,
            daysAgo: 4
        },
        {
            requester: "Camila Souza",
            department: "Marketing",
            category: "Rede",
            title: "Computador sem conexão com a internet",
            description: "O computador perdeu a conexão com a rede e não consegue acessar os sistemas internos.",
            priority: PRIORITY.MEDIA,
            status: STATUS.RESOLVIDO,
            daysAgo: 2
        },
        {
            requester: "Lucas Martins",
            department: "Comercial",
            category: "Acesso",
            title: "Acesso ao sistema de vendas",
            description: "Não consigo acessar o sistema de vendas desde o início da manhã.",
            priority: PRIORITY.ALTA,
            status: STATUS.ABERTO,
            daysAgo: 1
        },
        {
            requester: "Mariana Costa",
            department: "Financeiro",
            category: "Sistemas",
            title: "Sistema financeiro não está sincronizando",
            description: "O sistema financeiro apresenta erro ao tentar sincronizar os lançamentos do dia.",
            priority: PRIORITY.CRITICA,
            status: STATUS.ATENDIMENTO,
            daysAgo: 0
        }
    ];

    function buildDemoTickets() {

        const now = Date.now();
        const HOUR = 60 * 60 * 1000;
        const DAY = 24 * HOUR;
        const STEP = 10 * 60 * 1000;

        // Caminho de status coerente com STATUS_TRANSITIONS
        const path = {
            [STATUS.ABERTO]: [STATUS.ABERTO],
            [STATUS.ATENDIMENTO]: [STATUS.ABERTO, STATUS.ATENDIMENTO],
            [STATUS.RESOLVIDO]: [STATUS.ABERTO, STATUS.ATENDIMENTO, STATUS.RESOLVIDO],
            [STATUS.ENCERRADO]: [STATUS.ABERTO, STATUS.ATENDIMENTO, STATUS.RESOLVIDO, STATUS.ENCERRADO]
        };

        return DEMO_DEFINITIONS
            .map((definition) => {

                const createdMs = now - definition.daysAgo * DAY - 2 * HOUR;

                const statusHistory = path[definition.status].map((status, index) => ({
                    status,
                    date: new Date(createdMs + index * STEP).toISOString()
                }));

                return {
                    id: getNextTicketId(),
                    requester: definition.requester,
                    department: definition.department,
                    category: definition.category,
                    title: definition.title,
                    description: definition.description,
                    priority: definition.priority,
                    status: definition.status,
                    createdAt: statusHistory[0].date,
                    updatedAt: statusHistory[statusHistory.length - 1].date,
                    statusHistory,
                    editLog: [],
                    isDemo: true
                };
            })
            .reverse(); // mais novos primeiro
    }

    function addDemoTickets() {

        if (tickets.some((ticket) => ticket.isDemo)) {
            return;
        }

        const demoTickets = buildDemoTickets();

        tickets = [...tickets, ...demoTickets];

        const persisted = commit();

        if (persisted) {
            showToast(
                tr("demo.loadedTitle"),
                tr("demo.loadedMsg", { count: demoTickets.length })
            );
        }
    }

    function removeDemoTickets() {

        const before = tickets.length;

        tickets = tickets.filter((ticket) => !ticket.isDemo);

        const removed = before - tickets.length;

        if (removed === 0) {
            return;
        }

        const persisted = commit();

        if (persisted) {
            showToast(
                tr("demo.removedTitle"),
                tr("demo.removedMsg", { count: removed })
            );
        }
    }

    function updateDemoUI() {

        const hasDemo = tickets.some((ticket) => ticket.isDemo);

        elements.demoBanner.classList.toggle("hidden", !hasDemo);
        elements.loadDemoButton.classList.toggle("hidden", hasDemo);
    }

    /* ==========================================================================
    CRUD
    ========================================================================== */

    function canTransition(fromStatus, toStatus) {

        return (
            Array.isArray(STATUS_TRANSITIONS[fromStatus]) &&
            STATUS_TRANSITIONS[fromStatus].includes(toStatus)
        );
    }

    function createTicket(ticketData) {

        const now = new Date().toISOString();

        const ticket = {
            id: getNextTicketId(),
            requester: ticketData.requester,
            department: ticketData.department,
            category: ticketData.category,
            title: ticketData.title,
            description: ticketData.description,
            priority: ticketData.priority,
            status: STATUS.ABERTO,
            createdAt: now,
            updatedAt: now,
            statusHistory: [
                { status: STATUS.ABERTO, date: now }
            ],
            editLog: [],
            isDemo: false
        };

        tickets.unshift(ticket);

        const persisted = commit();

        return { ticket, persisted };
    }

    /**
     * Atualiza campos e/ou status.
     * Devolve { ok, changed, persisted } ou { ok:false, reason }.
     * Mudanças de status só passam se estiverem em STATUS_TRANSITIONS.
     */
    function updateTicket(ticketId, updatedData) {

        const index = tickets.findIndex(
            (ticket) => ticket.id === ticketId
        );

        if (index === -1) {
            return { ok: false, reason: "notFound" };
        }

        const current = tickets[index];
        const now = new Date().toISOString();
        const next = { ...current };
        const changes = [];
        let statusChanged = false;

        TRACKED_FIELDS.forEach((field) => {

            if (
                Object.prototype.hasOwnProperty.call(updatedData, field) &&
                updatedData[field] !== current[field]
            ) {
                changes.push({
                    field,
                    from: String(current[field]),
                    to: String(updatedData[field])
                });

                next[field] = updatedData[field];
            }
        });

        if (
            Object.prototype.hasOwnProperty.call(updatedData, "status") &&
            updatedData.status !== current.status
        ) {

            if (!canTransition(current.status, updatedData.status)) {
                return {
                    ok: false,
                    reason: "transition",
                    from: current.status
                };
            }

            next.status = updatedData.status;
            statusChanged = true;

            next.statusHistory = [
                ...(current.statusHistory || []),
                { status: updatedData.status, date: now }
            ];
        }

        if (changes.length === 0 && !statusChanged) {
            return { ok: true, changed: false, persisted: true };
        }

        if (changes.length > 0) {
            next.editLog = [
                ...(current.editLog || []),
                { date: now, changes }
            ].slice(-MAX_EDIT_LOG_ENTRIES);
        }

        next.updatedAt = now;

        tickets[index] = next;

        const persisted = commit();

        return { ok: true, changed: true, persisted };
    }

    /*
     * DECISÃO DE PROJETO: a exclusão é FÍSICA e irreversível (não há lixeira).
     * Por isso a confirmação avisa explicitamente que não pode ser desfeita.
     * Uma versão com backend deveria usar exclusão lógica + auditoria.
     */
    function deleteTicket(ticketId) {

        const originalLength = tickets.length;

        tickets = tickets.filter(
            (ticket) => ticket.id !== ticketId
        );

        if (tickets.length === originalLength) {
            return { ok: false };
        }

        const persisted = commit();

        return { ok: true, persisted };
    }

    /* ==========================================================================
    DASHBOARD
    ========================================================================== */

    function updateDashboard() {

        const total = tickets.length;

        // "Resolvidos e encerrados" = Resolvido + Encerrado (rótulo honesto;
        // o cartão leva à lista com o filtro "Concluídos", que soma os dois).
        const completed =
            countByStatus(STATUS.RESOLVIDO) +
            countByStatus(STATUS.ENCERRADO);

        elements.statTotal.textContent = total;
        elements.statOpen.textContent = countByStatus(STATUS.ABERTO);
        elements.statProgress.textContent = countByStatus(STATUS.ATENDIMENTO);
        elements.statResolved.textContent = completed;

        renderRecentTickets();
        renderStatusSummary();
        updateDemoUI();
    }

    function countByStatus(status) {

        return tickets.filter(
            (ticket) => ticket.status === status
        ).length;
    }

    function demoBadgeHtml(ticket) {

        if (!ticket.isDemo) {
            return "";
        }

        return `<span class="demo-badge">${escapeHtml(tr("demo.badge"))}</span>`;
    }

    function renderRecentTickets() {

        if (tickets.length === 0) {

            elements.recentTickets.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon" aria-hidden="true">⌕</div>
                    <h3>${escapeHtml(tr("dashboard.recentTickets.empty"))}</h3>
                    <p>${escapeHtml(tr("dashboard.recentTickets.emptyHint"))}</p>
                </div>
            `;

            return;
        }

        const recentTickets = [...tickets]
            .sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            )
            .slice(0, 5);

        elements.recentTickets.innerHTML = recentTickets
            .map((ticket) => `
                <article class="recent-ticket">

                    <span class="recent-number">
                        ${escapeHtml(formatTicketNumber(ticket.id))}
                    </span>

                    <div>
                        <div class="recent-ticket-title">
                            ${escapeHtml(ticket.title)}
                            ${demoBadgeHtml(ticket)}
                        </div>

                        <div class="recent-ticket-meta">
                            ${escapeHtml(ticket.requester)}
                            ·
                            ${escapeHtml(labelDepartment(ticket.department))}
                        </div>
                    </div>

                    <span class="status-badge ${getStatusClass(ticket.status)}">
                        ${escapeHtml(labelStatus(ticket.status))}
                    </span>

                </article>
            `)
            .join("");
    }

    function renderStatusSummary() {

        if (tickets.length === 0) {
            elements.statusSummary.innerHTML = `
                <div class="empty-state">
                    <p>${escapeHtml(tr("dashboard.statusSummary.empty"))}</p>
                </div>
            `;

            return;
        }

        elements.statusSummary.innerHTML = STATUS_LIST
            .map((status) => {

                const count = countByStatus(status);

                const percentage = (count / tickets.length) * 100;

                return `
                    <div class="status-row">

                        <span class="status-row-label">
                            ${escapeHtml(labelStatus(status))}
                        </span>

                        <div class="status-bar" aria-hidden="true">
                            <div
                                class="status-bar-fill ${getStatusClass(status)}"
                                style="width: ${percentage}%"
                            ></div>
                        </div>

                        <span class="status-row-count">
                            ${count}
                        </span>

                    </div>
                `;
            })
            .join("");
    }

    /* ==========================================================================
    LISTAGEM / FILTROS
    ========================================================================== */

    const ICONS = {
        view: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
        edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        delete: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>'
    };

    /*
     * Botão de ação da linha: ícone + RÓTULO VISÍVEL (não depende de hover).
     * "Excluir" tem ícone de lixeira e cor própria, diferente do "×" que
     * apenas fecha janelas. aria-label inclui o número do chamado.
     */
    function actionButtonHtml(action, ticket, shortKey, fullKey, extraClass) {

        const ticketNumber = formatTicketNumber(ticket.id);
        const fullLabel = tr(fullKey, { ticketNumber });

        return `
            <button
                class="action-button ${extraClass}"
                type="button"
                data-action="${action}"
                data-id="${ticket.id}"
                aria-label="${escapeHtml(fullLabel)}"
                title="${escapeHtml(fullLabel)}"
            >
                ${ICONS[action]}
                <span class="action-label">${escapeHtml(tr(shortKey))}</span>
            </button>
        `;
    }

    function buildTicketRow(ticket) {

        return `
            <tr>
                <td data-label="${escapeHtml(tr("tickets.table.number"))}">
                    <div class="cell-group">
                        <span class="ticket-number">
                            ${escapeHtml(formatTicketNumber(ticket.id))}
                        </span>
                        ${demoBadgeHtml(ticket)}
                    </div>
                </td>

                <td data-label="${escapeHtml(tr("tickets.table.requester"))}">
                    <span class="ticket-requester">
                        ${escapeHtml(ticket.requester)}
                    </span>
                </td>

                <td data-label="${escapeHtml(tr("tickets.table.title"))}">
                    <div class="cell-group">
                        <div class="ticket-title" title="${escapeHtml(ticket.title)}">
                            ${escapeHtml(ticket.title)}
                        </div>
                        <div class="ticket-category">
                            ${escapeHtml(labelCategory(ticket.category))}
                        </div>
                    </div>
                </td>

                <td data-label="${escapeHtml(tr("tickets.table.priority"))}">
                    <span class="priority-badge ${getPriorityClass(ticket.priority)}">
                        ${escapeHtml(labelPriority(ticket.priority))}
                    </span>
                </td>

                <td data-label="${escapeHtml(tr("tickets.table.status"))}">
                    <span class="status-badge ${getStatusClass(ticket.status)}">
                        ${escapeHtml(labelStatus(ticket.status))}
                    </span>
                </td>

                <td data-label="${escapeHtml(tr("tickets.table.date"))}">
                    <span class="ticket-date">
                        ${escapeHtml(formatDate(ticket.createdAt))}
                    </span>
                </td>

                <td data-label="${escapeHtml(tr("tickets.table.actions"))}">
                    <div class="action-group">
                        ${actionButtonHtml("view", ticket, "tickets.actions.viewShort", "tickets.actions.viewTicket", "")}
                        ${actionButtonHtml("edit", ticket, "tickets.actions.editShort", "tickets.actions.editTicket", "")}
                        ${actionButtonHtml("delete", ticket, "tickets.actions.deleteShort", "tickets.actions.deleteTicket", "delete")}
                    </div>
                </td>
            </tr>
        `;
    }

    function updateResultsCount(count) {

        let text;

        if (count === 0) {
            text = tr("tickets.results.none");
        } else if (count === tickets.length) {
            text = count === 1
                ? tr("tickets.results.one")
                : tr("tickets.results.all", { count });
        } else {
            text = tr("tickets.results.filtered", {
                count,
                total: tickets.length
            });
        }

        elements.resultsCount.textContent = text;
    }

    function renderEmptyState() {

        const hasNoTickets = tickets.length === 0;

        elements.ticketsEmptyTitle.textContent = hasNoTickets
            ? tr("tickets.emptyAll.title")
            : tr("tickets.empty.title");

        elements.ticketsEmptyText.textContent = hasNoTickets
            ? tr("tickets.emptyAll.subtitle")
            : tr("tickets.empty.subtitle");

        // Sem chamados nenhum: "Limpar filtros" não faz sentido
        elements.clearFiltersButton.classList.toggle("hidden", hasNoTickets);
        elements.emptyNewButton.classList.toggle("hidden", !hasNoTickets);

        elements.ticketsEmpty.classList.remove("hidden");
    }

    function renderTickets() {

        const filteredTickets = getFilteredTickets();

        updateResultsCount(filteredTickets.length);

        if (filteredTickets.length === 0) {

            elements.ticketsTableBody.innerHTML = "";

            // Sem resultados: esconde também o cabeçalho da tabela
            elements.tableWrapper.classList.add("hidden");

            renderEmptyState();

            return;
        }

        elements.ticketsEmpty.classList.add("hidden");
        elements.tableWrapper.classList.remove("hidden");

        elements.ticketsTableBody.innerHTML =
            filteredTickets.map(buildTicketRow).join("");
    }

    function matchesStatusFilter(ticket, statusFilter) {

        if (statusFilter === "todos") {
            return true;
        }

        if (statusFilter === "concluidos") {
            return (
                ticket.status === STATUS.RESOLVIDO ||
                ticket.status === STATUS.ENCERRADO
            );
        }

        return ticket.status === statusFilter;
    }

    function getFilteredTickets() {

        const searchTerm =
            elements.searchInput.value
                .trim()
                .toLowerCase();

        const status = elements.statusFilter.value;
        const priority = elements.priorityFilter.value;
        const category = elements.categoryFilter.value;
        const sort = elements.sortSelect.value;

        const result = tickets.filter((ticket) => {

            // Busca no valor gravado (PT) e no texto traduzido exibido
            const searchableText = [
                ticket.id,
                formatTicketNumber(ticket.id),
                ticket.requester,
                ticket.department,
                labelDepartment(ticket.department),
                ticket.category,
                labelCategory(ticket.category),
                ticket.title,
                ticket.description
            ]
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !searchTerm ||
                searchableText.includes(searchTerm);

            const matchesPriority =
                priority === "todas" ||
                ticket.priority === priority;

            const matchesCategory =
                category === "todas" ||
                ticket.category === category;

            return (
                matchesSearch &&
                matchesStatusFilter(ticket, status) &&
                matchesPriority &&
                matchesCategory
            );
        });

        return sortTickets(result, sort);
    }

    function sortTickets(ticketList, sort) {

        const sorted = [...ticketList];

        const byNewest = (a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt);

        switch (sort) {

            case "antigos":
                return sorted.sort(
                    (a, b) =>
                        new Date(a.createdAt) -
                        new Date(b.createdAt)
                );

            case "prioridade":
                // `?? 0`: prioridade desconhecida nunca gera NaN no comparador
                return sorted.sort(
                    (a, b) =>
                        (PRIORITY_WEIGHT[b.priority] ?? 0) -
                        (PRIORITY_WEIGHT[a.priority] ?? 0) ||
                        byNewest(a, b)
                );

            case "titulo":
                return sorted.sort(
                    (a, b) =>
                        a.title.localeCompare(
                            b.title,
                            getLocale()
                        )
                );

            case "recentes":
            default:
                return sorted.sort(byNewest);
        }
    }

    function clearFilters() {

        elements.searchInput.value = "";
        elements.statusFilter.value = "todos";
        elements.priorityFilter.value = "todas";
        elements.categoryFilter.value = "todas";
        elements.sortSelect.value = "recentes";

        renderTickets();
    }

    /* ==========================================================================
    AÇÕES DOS CHAMADOS (delegação de eventos no <tbody>)
    ========================================================================== */

    function handleTableClick(event) {

        const button = event.target.closest("[data-action]");

        if (!button || !elements.ticketsTableBody.contains(button)) {
            return;
        }

        const action = button.dataset.action;
        const id = Number(button.dataset.id);

        if (action === "view") {
            openTicketModal(id);
        }

        if (action === "edit") {
            editTicket(id);
        }

        if (action === "delete") {
            openConfirmModal(id);
        }
    }

    /* ==========================================================================
    MODAL DE DETALHES
    ========================================================================== */

    function renderStatusHistoryItems(statusHistory) {

        const history =
            Array.isArray(statusHistory) && statusHistory.length > 0
                ? [...statusHistory].reverse()
                : [];

        if (history.length === 0) {
            return `<li class="status-history-empty">${escapeHtml(tr("modal.history.empty"))}</li>`;
        }

        return history
            .map((entry, index) => `
                <li class="status-history-item">
                    <span class="status-badge ${getStatusClass(entry.status)}">
                        ${escapeHtml(labelStatus(entry.status))}
                    </span>
                    <span class="status-history-date">
                        ${escapeHtml(formatDateTime(entry.date))}
                        ${index === 0 ? `<em>${escapeHtml(tr("modal.history.current"))}</em>` : ""}
                    </span>
                </li>
            `)
            .join("");
    }

    function truncateText(text, maxLength) {

        const value = String(text);

        return value.length > maxLength
            ? `${value.slice(0, maxLength - 1)}…`
            : value;
    }

    function formatChangeValue(field, value) {

        if (field === "department") {
            return labelDepartment(value);
        }

        if (field === "category") {
            return labelCategory(value);
        }

        if (field === "priority") {
            return labelPriority(value);
        }

        return `“${truncateText(value, 60)}”`;
    }

    /*
     * Trilha de auditoria das edições: o que mudou, de quê para quê e quando.
     * (Antes, editar sobrescrevia o valor original sem deixar rastro.)
     */
    function renderChangeLog(editLog) {

        if (!Array.isArray(editLog) || editLog.length === 0) {
            return "";
        }

        const entries = [...editLog].reverse()
            .map((entry) => `
                <li class="change-log-entry">
                    <span class="status-history-date">
                        ${escapeHtml(formatDateTime(entry.date))}
                    </span>
                    <ul class="change-log-changes">
                        ${entry.changes.map((change) => `
                            <li>${escapeHtml(tr("modal.changes.item", {
                                field: tr(`modal.changes.fields.${change.field}`),
                                from: formatChangeValue(change.field, change.from),
                                to: formatChangeValue(change.field, change.to)
                            }))}</li>
                        `).join("")}
                    </ul>
                </li>
            `)
            .join("");

        return `
            <div class="detail-item full">
                <span class="detail-label">${escapeHtml(tr("modal.changes.title"))}</span>
                <ul class="change-log">${entries}</ul>
            </div>
        `;
    }

    function renderStatusOptions(currentStatus) {

        // Só o status atual + os destinos permitidos por STATUS_TRANSITIONS
        const allowed = STATUS_TRANSITIONS[currentStatus] || [];

        return STATUS_LIST
            .filter((status) => status === currentStatus || allowed.includes(status))
            .map((status) => `
                <option
                    value="${escapeHtml(status)}"
                    ${status === currentStatus ? "selected" : ""}
                >${escapeHtml(labelStatus(status))}</option>
            `)
            .join("");
    }

    function openTicketModal(ticketId) {

        const ticket = findTicket(ticketId);

        if (!ticket) {
            return;
        }

        selectedTicketId = ticketId;

        elements.modalTicketNumber.textContent =
            formatTicketNumber(ticket.id);

        elements.modalTitle.textContent =
            ticket.title;

        /* O modal é re-renderizado ao trocar o status (innerHTML novo).
           Guardamos se o foco estava no select para devolvê-lo depois. */
        const statusSelectHadFocus =
            document.activeElement &&
            document.activeElement.id === "modalStatusSelect";

        elements.modalContent.innerHTML = `
            <div class="detail-grid">

                <div class="detail-item">
                    <span class="detail-label">${escapeHtml(tr("modal.fields.requester"))}</span>
                    <span class="detail-value">
                        ${escapeHtml(ticket.requester)}
                    </span>
                </div>

                <div class="detail-item">
                    <span class="detail-label">${escapeHtml(tr("modal.fields.department"))}</span>
                    <span class="detail-value">
                        ${escapeHtml(labelDepartment(ticket.department))}
                    </span>
                </div>

                <div class="detail-item">
                    <span class="detail-label">${escapeHtml(tr("modal.fields.category"))}</span>
                    <span class="detail-value">
                        ${escapeHtml(ticket.category ? labelCategory(ticket.category) : tr("modal.notSpecified"))}
                    </span>
                </div>

                <div class="detail-item">
                    <span class="detail-label">${escapeHtml(tr("modal.fields.priority"))}</span>
                    <span class="detail-value">
                        <span class="priority-badge ${getPriorityClass(ticket.priority)}">
                            ${escapeHtml(labelPriority(ticket.priority))}
                        </span>
                        ${demoBadgeHtml(ticket)}
                    </span>
                </div>

                <div class="detail-item">
                    <label class="detail-label" for="modalStatusSelect">${escapeHtml(tr("modal.fields.status"))}</label>
                    <span class="detail-value">
                        <select
                            id="modalStatusSelect"
                            class="status-select ${getStatusClass(ticket.status)}"
                            aria-label="${escapeHtml(tr("modal.fields.statusChange"))}"
                        >
                            ${renderStatusOptions(ticket.status)}
                        </select>
                    </span>
                </div>

                <div class="detail-item">
                    <span class="detail-label">${escapeHtml(tr("modal.fields.createdAt"))}</span>
                    <span class="detail-value">
                        ${escapeHtml(formatDateTime(ticket.createdAt))}
                    </span>
                </div>

                <div class="detail-item">
                    <span class="detail-label">${escapeHtml(tr("modal.fields.updatedAt"))}</span>
                    <span class="detail-value">
                        ${escapeHtml(formatDateTime(ticket.updatedAt || ticket.createdAt))}
                    </span>
                </div>

                <div class="detail-item full">
                    <span class="detail-label">${escapeHtml(tr("modal.fields.description"))}</span>

                    <div class="detail-description">
                        ${escapeHtml(ticket.description)}
                    </div>
                </div>

                <div class="detail-item full">
                    <span class="detail-label">${escapeHtml(tr("modal.fields.history"))}</span>

                    <ul class="status-history">
                        ${renderStatusHistoryItems(ticket.statusHistory)}
                    </ul>
                </div>

                ${renderChangeLog(ticket.editLog)}

            </div>
        `;

        elements.ticketModal.classList.remove("hidden");

        const statusSelect = elements.modalContent.querySelector("#modalStatusSelect");

        if (statusSelect) {
            statusSelect.addEventListener("change", handleModalStatusChange);
        }

        /* Na primeira abertura captura o foco; em re-renderizações
           (activateModal detecta que já está ativo) só restaura o select. */
        activateModal(elements.ticketModal);

        if (statusSelectHadFocus && statusSelect) {
            statusSelect.focus();
        }
    }

    function handleModalStatusChange(event) {

        if (!selectedTicketId) {
            return;
        }

        const newStatus = event.target.value;
        const ticketId = selectedTicketId;

        const result = updateTicket(ticketId, { status: newStatus });

        if (!result.ok) {

            if (result.reason === "transition") {

                const allowed = (STATUS_TRANSITIONS[result.from] || [])
                    .map(labelStatus)
                    .join(", ");

                showToast(
                    tr("toast.statusInvalid"),
                    tr("toast.statusInvalidMsg", {
                        from: labelStatus(result.from),
                        allowed
                    }),
                    "error"
                );
            }

            // Redesenha para o select voltar ao status real
            openTicketModal(ticketId);

            return;
        }

        openTicketModal(ticketId);

        if (result.persisted) {
            showToast(
                tr("toast.statusUpdated"),
                tr("toast.statusUpdatedMsg", { status: labelStatus(newStatus) })
            );
        }
    }

    function closeTicketModal(options) {

        elements.ticketModal.classList.add("hidden");
        selectedTicketId = null;

        // Restaura o título estático (antes ficava com o título do último chamado)
        elements.modalTitle.textContent = tr("modal.ticketDetails");

        deactivateModal(elements.ticketModal, options);
    }

    function handleModalEdit() {

        if (!selectedTicketId) {
            return;
        }

        const ticketId = selectedTicketId;

        /* O foco será movido para o formulário por editTicket(),
           então não devolvemos o foco ao botão que abriu o modal. */
        closeTicketModal({ restoreFocus: false });
        editTicket(ticketId);
    }

    /* ==========================================================================
    FORMULÁRIO (criação e edição)
    ========================================================================== */

    function getEditingId() {

        const editingId = Number(elements.ticketForm.dataset.editingId);

        return editingId > 0 ? editingId : null;
    }

    function isEditing() {
        return getEditingId() !== null;
    }

    /*
     * O modo edição é visualmente distinto do modo criação: título,
     * subtítulo, botão e um aviso com o número do chamado.
     */
    function updateFormMode() {

        const editingId = getEditingId();

        if (editingId) {

            const ticketNumber = formatTicketNumber(editingId);

            elements.formEyebrow.textContent = tr("form.editing.eyebrow");
            elements.formTitle.textContent = tr("form.editing.title");
            elements.formSubtitle.textContent = tr("form.editing.subtitle");
            elements.submitTicketButton.textContent = tr("form.buttons.save");

            elements.editBanner.textContent =
                tr("form.editing.banner", { ticketNumber });

            elements.editBanner.classList.remove("hidden");

            return;
        }

        elements.formEyebrow.textContent = tr("form.section");
        elements.formTitle.textContent = tr("form.title");
        elements.formSubtitle.textContent = tr("form.subtitle");
        elements.submitTicketButton.textContent = tr("form.buttons.create");

        elements.editBanner.textContent = "";
        elements.editBanner.classList.add("hidden");
    }

    function editTicket(ticketId) {

        const ticket = findTicket(ticketId);

        if (!ticket) {
            return;
        }

        elements.requester.value = ticket.requester;
        elements.department.value = ticket.department;
        elements.category.value = ticket.category;
        elements.title.value = ticket.title;
        elements.description.value = ticket.description;
        elements.priority.value = ticket.priority;

        elements.ticketForm.dataset.editingId = String(ticket.id);

        updateCharacterCount();
        clearFormErrors();
        updateFormMode();

        navigateTo("novo-chamado");

        elements.requester.focus({ preventScroll: true });
    }

    function handleFormSubmit(event) {

        event.preventDefault();

        clearFormErrors();

        const formData = {
            requester: elements.requester.value.trim(),
            department: elements.department.value,
            category: elements.category.value,
            title: elements.title.value.trim(),
            description: elements.description.value.trim(),
            priority: elements.priority.value
        };

        const errors = validateForm(formData);

        if (errors.length > 0) {

            errors.forEach((error) => {
                setFieldError(error.field, error.message);
            });

            showErrorSummary(errors.length);

            // Foco (e rolagem) no primeiro campo inválido
            const firstInvalid = elements[errors[0].field];

            firstInvalid.focus({ preventScroll: true });

            firstInvalid.scrollIntoView({
                block: "center",
                behavior: scrollBehavior()
            });

            return;
        }

        const editingId = getEditingId();

        if (editingId) {

            const result = updateTicket(editingId, formData);

            if (!result.ok) {
                reportUnexpectedError(
                    new Error(`Chamado ${editingId} não encontrado para edição.`)
                );
            } else if (!result.changed) {
                showToast(
                    tr("toast.noChanges"),
                    tr("toast.noChangesMsg")
                );
            } else if (result.persisted) {
                showToast(
                    tr("toast.ticketUpdated"),
                    tr("toast.ticketUpdatedMsg")
                );
            }

        } else {

            const { ticket, persisted } = createTicket(formData);

            // O número do chamado (protocolo) aparece na confirmação
            if (persisted) {
                showToast(
                    tr("toast.ticketCreated"),
                    tr("toast.ticketCreatedMsg", {
                        ticketNumber: formatTicketNumber(ticket.id)
                    })
                );
            }
        }

        resetTicketForm();

        navigateTo("chamados");
    }

    /*
     * "aaaaa" não é um título. Além do tamanho mínimo, exige uma variedade
     * mínima de caracteres distintos. É uma heurística simples: valida
     * forma, não significado (ver README, "Limitações").
     */
    function countDistinctCharacters(text) {

        return new Set(text.toLowerCase().replace(/\s+/g, "")).size;
    }

    /**
     * Devolve uma lista ordenada de { field, message }; vazia se válido.
     */
    function validateForm(data) {

        const errors = [];

        const addError = (field, key) => {
            errors.push({ field, message: tr(key) });
        };

        if (!data.requester) {
            addError("requester", "validation.requesterEmpty");
        }

        if (!data.department) {
            addError("department", "validation.departmentEmpty");
        }

        if (!data.category) {
            addError("category", "validation.categoryEmpty");
        }

        if (!data.title) {
            addError("title", "validation.titleEmpty");
        } else if (data.title.length < 5) {
            addError("title", "validation.titleTooShort");
        } else if (countDistinctCharacters(data.title) < 3) {
            addError("title", "validation.titleNotMeaningful");
        }

        if (!data.description) {
            addError("description", "validation.descriptionEmpty");
        } else if (data.description.length < 10) {
            addError("description", "validation.descriptionTooShort");
        } else if (countDistinctCharacters(data.description) < 5) {
            addError("description", "validation.descriptionNotMeaningful");
        }

        if (!data.priority) {
            addError("priority", "validation.priorityEmpty");
        }

        return errors;
    }

    /*
     * Erro acessível: aria-invalid + aria-describedby ligam o campo à
     * mensagem, e o foco vai para o primeiro campo inválido.
     */
    // aria-describedby original do campo (ex.: dica de prioridade), capturado
    // uma única vez, ANTES de qualquer erro ser anexado.
    function getBaseDescribedby(input) {

        if (input.dataset.baseDescribedby === undefined) {
            input.dataset.baseDescribedby =
                input.getAttribute("aria-describedby") || "";
        }

        return input.dataset.baseDescribedby;
    }

    function setFieldError(fieldName, message) {

        const input = document.getElementById(fieldName);
        const error = document.getElementById(`${fieldName}Error`);

        if (!input || !error) {
            return;
        }

        const field = input.closest(".form-field");

        if (field) {
            field.classList.add("has-error");
        }

        error.textContent = message;

        const base = getBaseDescribedby(input);

        input.setAttribute("aria-invalid", "true");

        input.setAttribute(
            "aria-describedby",
            [base, error.id].filter(Boolean).join(" ")
        );
    }

    function clearFieldError(fieldName) {

        const input = document.getElementById(fieldName);
        const error = document.getElementById(`${fieldName}Error`);

        if (!input || !error) {
            return;
        }

        const field = input.closest(".form-field");

        if (field) {
            field.classList.remove("has-error");
        }

        error.textContent = "";

        input.removeAttribute("aria-invalid");

        const base = getBaseDescribedby(input);

        if (base) {
            input.setAttribute("aria-describedby", base);
        } else {
            input.removeAttribute("aria-describedby");
        }
    }

    function showErrorSummary(count) {

        elements.formErrorSummary.textContent =
            count === 1
                ? tr("validation.summaryOne")
                : tr("validation.summaryMany", { count });

        elements.formErrorSummary.classList.remove("hidden");
    }

    function hideErrorSummaryIfClean() {

        const hasErrors =
            elements.ticketForm.querySelector(".form-field.has-error") !== null;

        if (!hasErrors) {
            elements.formErrorSummary.classList.add("hidden");
            elements.formErrorSummary.textContent = "";
        }
    }

    function clearFormErrors() {

        ["requester", "department", "category", "title", "description", "priority"]
            .forEach(clearFieldError);

        elements.formErrorSummary.classList.add("hidden");
        elements.formErrorSummary.textContent = "";
    }

    function resetTicketForm() {

        elements.ticketForm.reset();

        delete elements.ticketForm.dataset.editingId;

        clearFormErrors();

        updateCharacterCount();

        updateFormMode();
    }

    function updateCharacterCount() {

        const length =
            elements.description.value.length;

        elements.characterCount.textContent =
            tr("form.characterCount", { count: length });
    }

    /* ==========================================================================
    EXCLUSÃO (física e irreversível — a confirmação avisa)
    ========================================================================== */

    function openConfirmModal(ticketId) {

        const ticket = findTicket(ticketId);

        if (!ticket) {
            return;
        }

        ticketToDeleteId = ticketId;

        elements.confirmMessage.textContent = tr("confirm.message", {
            ticketNumber: formatTicketNumber(ticket.id),
            ticketTitle: ticket.title
        });

        elements.confirmModal.classList.remove("hidden");

        /* Ação destrutiva: o foco inicial vai para "Cancelar" (opção segura). */
        activateModal(elements.confirmModal, elements.cancelDeleteButton);
    }

    function closeConfirmModal(options) {

        elements.confirmModal.classList.add("hidden");
        ticketToDeleteId = null;

        deactivateModal(elements.confirmModal, options);
    }

    function confirmDelete() {

        if (!ticketToDeleteId) {
            return;
        }

        const result = deleteTicket(ticketToDeleteId);

        if (result.ok && result.persisted) {

            showToast(
                tr("toast.ticketDeleted"),
                tr("toast.ticketDeletedMsg")
            );
        }

        closeConfirmModal();
    }

    /* ==========================================================================
    UTILITÁRIOS
    ========================================================================== */

    function findTicket(ticketId) {

        return tickets.find(
            (ticket) => ticket.id === ticketId
        );
    }

    function formatTicketNumber(id) {

        return `CH-${String(id).padStart(4, "0")}`;
    }

    function formatDate(dateString) {

        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return tr("common.invalidDate");
        }

        return new Intl.DateTimeFormat(
            getLocale(),
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        ).format(date);
    }

    function formatDateTime(dateString) {

        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return tr("common.invalidDate");
        }

        return new Intl.DateTimeFormat(
            getLocale(),
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);
    }

    function updateCurrentDate() {

        elements.currentDate.textContent =
            new Intl.DateTimeFormat(
                getLocale(),
                {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            ).format(new Date());
    }

    function getStatusClass(status) {

        const classes = {
            "Aberto": "status-aberto",
            "Em atendimento": "status-em-atendimento",
            "Resolvido": "status-resolvido",
            "Encerrado": "status-encerrado"
        };

        return classes[status] || "status-encerrado";
    }

    function getPriorityClass(priority) {

        const classes = {
            "Baixa": "priority-baixa",
            "Média": "priority-media",
            "Alta": "priority-alta",
            "Crítica": "priority-critica"
        };

        return classes[priority] || "priority-baixa";
    }

    function escapeHtml(value) {

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    /* ==========================================================================
    TOAST COM FILA
    --------------------------------------------------------------------------
    Antes, um toast sobrescrevia o anterior. Agora as mensagens entram numa
    fila e aparecem uma de cada vez; duplicatas consecutivas são ignoradas e
    a exibição encurta se há mensagens esperando.
    ========================================================================== */

    const toastQueue = [];
    let toastActive = false;
    let currentToast = null;
    let toastTimer = null;

    function showToast(title, message, type) {

        const toastType = type === "error" ? "error" : "success";

        const isSame = (item) =>
            item &&
            item.title === title &&
            item.message === message &&
            item.type === toastType;

        if (isSame(currentToast) || isSame(toastQueue[toastQueue.length - 1])) {
            return;
        }

        toastQueue.push({ title, message, type: toastType });

        if (!toastActive) {
            processToastQueue();
        }
    }

    function processToastQueue() {

        const next = toastQueue.shift();

        if (!next) {
            toastActive = false;
            currentToast = null;
            return;
        }

        toastActive = true;
        currentToast = next;

        const toastIcon = elements.toast.querySelector(".toast-icon");

        elements.toastTitle.textContent = next.title;
        elements.toastMessage.textContent = next.message;

        elements.toast.classList.toggle("toast-error", next.type === "error");

        if (toastIcon) {
            toastIcon.textContent = next.type === "error" ? "!" : "✓";
        }

        elements.toast.classList.add("show");

        const baseDuration = next.type === "error" ? 6000 : 3500;

        const duration = toastQueue.length > 0
            ? Math.min(baseDuration, 2200)
            : baseDuration;

        window.clearTimeout(toastTimer);

        toastTimer = window.setTimeout(() => {

            elements.toast.classList.remove("show");

            // Aguarda a animação de saída antes de mostrar o próximo
            toastTimer = window.setTimeout(processToastQueue, 250);

        }, duration);
    }

    /* ==========================================================================
    FOCUS TRAP DOS MODAIS (acessibilidade)

    Ao abrir um modal:
      1. guarda quem estava com o foco (opener);
      2. move o foco para dentro do modal;
      3. torna o restante da pagina inerte (atributo `inert`);
      4. mantem Tab/Shift+Tab circulando so dentro do modal.

    Ao fechar: remove o inert e devolve o foco ao opener. Se o opener
    nao existir mais no DOM (ex.: linha excluida ou tabela re-renderizada
    apos mudanca de status), procura o botao equivalente pelo
    data-action/data-id; em ultimo caso usa um elemento seguro.
    ========================================================================== */

    const FOCUSABLE_SELECTOR = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled]):not([type='hidden'])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
    ].join(",");

    function getFocusableElements(container) {

        return Array.from(
            container.querySelectorAll(FOCUSABLE_SELECTOR)
        ).filter((element) => {
            // ignora elementos ocultos (display:none / dentro de .hidden)
            return element.getClientRects().length > 0;
        });
    }

    function setBackgroundInert(isInert) {

        const appShell = document.querySelector(".app-shell");

        if (!appShell) {
            return;
        }

        if (isInert) {
            appShell.setAttribute("inert", "");
            appShell.setAttribute("aria-hidden", "true");
        } else {
            appShell.removeAttribute("inert");
            appShell.removeAttribute("aria-hidden");
        }
    }

    function activateModal(modalElement, initialFocusElement) {

        // Re-renderizacao do mesmo modal (ex.: troca de status):
        // nao recapturar o opener nem mexer no foco.
        if (activeModal && activeModal.element === modalElement) {
            return;
        }

        const opener = document.activeElement;

        const openerIsUsable =
            opener &&
            opener !== document.body &&
            !modalElement.contains(opener);

        activeModal = {
            element: modalElement,
            opener: openerIsUsable ? opener : null,
            openerAction: openerIsUsable && opener.dataset
                ? opener.dataset.action || null
                : null,
            openerId: openerIsUsable && opener.dataset
                ? opener.dataset.id || null
                : null
        };

        setBackgroundInert(true);

        const panel = modalElement.querySelector(".modal");

        if (panel && !panel.hasAttribute("tabindex")) {
            panel.setAttribute("tabindex", "-1");
        }

        const target =
            initialFocusElement || panel || modalElement;

        target.focus();
    }

    function deactivateModal(modalElement, options) {

        if (!activeModal || activeModal.element !== modalElement) {
            return;
        }

        const { opener, openerAction, openerId } = activeModal;

        activeModal = null;

        setBackgroundInert(false);

        const restoreFocus = !options || options.restoreFocus !== false;

        if (!restoreFocus) {
            return;
        }

        let target = null;

        if (opener && opener.isConnected && opener.getClientRects().length > 0) {
            target = opener;
        }

        // Tabela foi re-renderizada: procura o botao equivalente
        if (!target && openerAction && openerId) {
            target = elements.ticketsTableBody.querySelector(
                `[data-action="${openerAction}"][data-id="${openerId}"]`
            );
        }

        // Fallback: campo de busca (se visivel) ou o conteudo principal
        if (!target || target.getClientRects().length === 0) {

            target =
                elements.searchInput.getClientRects().length > 0
                    ? elements.searchInput
                    : document.getElementById("main-content");
        }

        if (target) {
            target.focus();
        }
    }

    function trapTabKey(event) {

        if (!activeModal) {
            return;
        }

        const focusable = getFocusableElements(activeModal.element);
        const panel = activeModal.element.querySelector(".modal");

        if (focusable.length === 0) {
            event.preventDefault();
            (panel || activeModal.element).focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement;

        // Foco fora do modal (ou no proprio painel): puxa para dentro
        if (!activeModal.element.contains(current) || current === panel) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
            return;
        }

        if (event.shiftKey && current === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && current === last) {
            event.preventDefault();
            first.focus();
        }
    }

    // Rede de seguranca: se algo tirar o foco do modal (ex.: navegador
    // sem suporte a `inert`), traz o foco de volta.
    document.addEventListener("focusin", (event) => {

        if (!activeModal) {
            return;
        }

        if (!activeModal.element.contains(event.target)) {

            const focusable = getFocusableElements(activeModal.element);
            const fallback =
                focusable[0] || activeModal.element.querySelector(".modal");

            if (fallback) {
                fallback.focus();
            }
        }
    });

    /* ==========================================================================
    TECLADO
    ========================================================================== */

    function handleKeyboard(event) {

        if (event.key === "Tab") {
            trapTabKey(event);
            return;
        }

        if (event.key !== "Escape") {
            return;
        }

        if (!elements.confirmModal.classList.contains("hidden")) {
            closeConfirmModal();
            return;
        }

        if (!elements.ticketModal.classList.contains("hidden")) {
            closeTicketModal();
            return;
        }

        if (elements.sidebar.classList.contains("mobile-open")) {
            closeMobileMenu(true);
        }
    }

})();
