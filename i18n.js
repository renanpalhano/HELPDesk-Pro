/*
 * ============================================================================
 * HELPDesk Pro - Internacionalização (i18n)
 * Suporte a: Português (pt) e Inglês (en)
 *
 * REGRAS:
 *  - Este arquivo é a ÚNICA fonte de textos da interface (HTML usa data-i18n,
 *    script.js usa t()).
 *  - PT e EN devem ter exatamente as mesmas chaves (verificado nos testes).
 *  - O IDIOMA fica em memória; o localStorage só persiste a escolha entre
 *    sessões (com try/catch, pois pode estar indisponível).
 *  - Valores de domínio gravados nos chamados (status, prioridade, setor,
 *    categoria) NUNCA são traduzidos; só o texto exibido.
 * ============================================================================
 */

const i18n = {
    pt: {
        brand: {
            name: "HelpDesk Pro",
            subtitle: "Sistema de Gestão de Chamados"
        },
        nav: {
            dashboard: "Dashboard",
            tickets: "Chamados",
            newTicket: "Novo chamado"
        },
        dashboard: {
            section: "Visão geral",
            title: "Olá, equipe.",
            subtitle: "Acompanhe o status dos chamados e mantenha as demandas em dia.",
            newButton: "Novo chamado",
            stats: {
                total: "Total de chamados",
                open: "Chamados abertos",
                progress: "Em atendimento",
                resolved: "Resolvidos e encerrados",
                openList: "Ver na lista"
            },
            recentTickets: {
                section: "Acompanhamento",
                title: "Chamados recentes",
                viewAll: "Ver todos",
                empty: "Você ainda não possui chamados.",
                emptyHint: "Os chamados recentes aparecerão aqui."
            },
            statusSummary: {
                section: "Resumo",
                title: "Status dos chamados",
                empty: "Sem dados para exibir."
            }
        },
        tickets: {
            section: "Central de atendimento",
            title: "Chamados",
            subtitle: "Encontre e gerencie todos os chamados da sua equipe.",
            table: {
                number: "Número",
                requester: "Solicitante",
                title: "Título",
                priority: "Prioridade",
                status: "Status",
                date: "Data",
                actions: "Ações",
                category: "Categoria"
            },
            filters: {
                search: "Pesquisar chamados...",
                status: "Status",
                allStatus: "Todos os status",
                priority: "Prioridade",
                allPriority: "Todas as prioridades",
                category: "Categoria",
                allCategories: "Todas as categorias",
                sort: "Ordenar por",
                recent: "Mais recentes",
                oldest: "Mais antigos",
                byPriority: "Por prioridade",
                byTitle: "Por título",
                clear: "Limpar filtros",
                completed: "Concluídos (resolvido + encerrado)",
                searchLabel: "Pesquisar chamados"
            },
            empty: {
                title: "Nenhum chamado encontrado.",
                subtitle: "Experimente alterar os filtros ou criar um novo chamado."
            },
            actions: {
                view: "Visualizar",
                edit: "Editar",
                delete: "Excluir",
                viewShort: "Ver",
                editShort: "Editar",
                deleteShort: "Excluir",
                viewTicket: "Visualizar chamado {ticketNumber}",
                editTicket: "Editar chamado {ticketNumber}",
                deleteTicket: "Excluir chamado {ticketNumber}"
            },
            results: {
                none: "Nenhum chamado",
                one: "1 chamado",
                all: "{count} chamados",
                filtered: "{count} de {total} chamados"
            },
            emptyAll: {
                title: "Nenhum chamado registrado",
                subtitle: "Crie o primeiro chamado ou carregue os exemplos."
            }
        },
        form: {
            section: "Abrir um chamado",
            title: "Novo chamado",
            subtitle: "Descreva o problema para que a equipe de TI possa ajudá-lo rapidamente.",
            fields: {
                requester: "Seu nome",
                requesterPlaceholder: "João Silva",
                department: "Setor",
                departmentSelect: "Selecione o setor",
                category: "Categoria do problema",
                categorySelect: "Selecione a categoria",
                title: "Título do chamado",
                titlePlaceholder: "Descreva resumidamente o problema",
                description: "Descrição detalhada",
                descriptionPlaceholder: "Explique o problema, o que aconteceu e, se possível, quando começou.",
                priority: "Prioridade",
                prioritySelect: "Selecione a prioridade",
                priorityHint: "Considere o impacto para definir a prioridade."
            },
            priorities: {
                low: "Baixa",
                medium: "Média",
                high: "Alta",
                critical: "Crítica"
            },
            departments: {
                it: "Tecnologia da Informação",
                hr: "Recursos Humanos",
                finance: "Financeiro",
                sales: "Comercial",
                marketing: "Marketing",
                administrative: "Administrativo",
                operations: "Operações",
                other: "Outro"
            },
            categories: {
                hardware: "Hardware",
                software: "Software",
                network: "Rede",
                access: "Acesso",
                email: "E-mail",
                printing: "Impressão",
                systems: "Sistemas",
                security: "Segurança"
            },
            buttons: {
                create: "Criar chamado",
                save: "Salvar alterações",
                cancel: "Cancelar"
            },
            info: {
                title: "Antes de enviar",
                description: "Uma descrição clara ajuda a equipe de TI a entender o problema e reduzir o tempo de atendimento.",
                tips: {
                    "0": "Explique o que aconteceu.",
                    "1": "Informe quando o problema começou.",
                    "2": "Descreva qualquer mensagem de erro."
                }
            },
            characterCount: "{count} / 1000",
            sectionTitle: "Informações do chamado",
            sectionSubtitle: "Preencha os dados principais da solicitação.",
            editing: {
                eyebrow: "Edição",
                title: "Editar chamado",
                subtitle: "Altere os dados do chamado. O status é alterado na tela de detalhes.",
                banner: "Você está editando o chamado {ticketNumber}. Nada é salvo até você confirmar."
            },
            priorityGuide: {
                title: "O que cada prioridade significa",
                low: "Baixa: dúvida ou pedido sem urgência; nada está parado.",
                medium: "Média: atrapalha o trabalho, mas existe alternativa.",
                high: "Alta: impede o trabalho de uma pessoa.",
                critical: "Crítica: impede o trabalho de um setor inteiro ou da empresa."
            }
        },
        validation: {
            requesterEmpty: "Informe o nome do solicitante.",
            departmentEmpty: "Selecione o setor.",
            titleEmpty: "Informe um título para o chamado.",
            titleTooShort: "O título deve ter pelo menos 5 caracteres.",
            descriptionEmpty: "Descreva o problema.",
            descriptionTooShort: "A descrição deve ter pelo menos 10 caracteres.",
            priorityEmpty: "Selecione a prioridade.",
            categoryEmpty: "Selecione a categoria.",
            titleNotMeaningful: "Descreva o problema no título; evite caracteres repetidos.",
            descriptionNotMeaningful: "Descreva o problema com mais detalhes; evite caracteres repetidos.",
            summaryOne: "Corrija o campo destacado antes de enviar.",
            summaryMany: "Corrija {count} campos antes de enviar."
        },
        modal: {
            ticketDetails: "Detalhes do chamado",
            edit: "Editar chamado",
            close: "Fechar",
            fields: {
                number: "Número",
                title: "Título",
                requester: "Solicitante",
                department: "Setor",
                priority: "Prioridade",
                status: "Status",
                statusChange: "Alterar status do chamado",
                createdAt: "Data de abertura",
                updatedAt: "Última atualização",
                description: "Descrição",
                history: "Histórico de status",
                category: "Categoria"
            },
            history: {
                empty: "Sem histórico registrado.",
                current: "(atual)"
            },
            notSpecified: "Não especificada",
            changes: {
                title: "Alterações registradas",
                item: "{field}: {from} → {to}",
                fields: {
                    requester: "Solicitante",
                    department: "Setor",
                    category: "Categoria",
                    title: "Título",
                    description: "Descrição",
                    priority: "Prioridade"
                }
            }
        },
        confirm: {
            title: "Excluir chamado?",
            message: "O chamado {ticketNumber} — \"{ticketTitle}\" será excluído. Essa ação não poderá ser desfeita.",
            cancel: "Cancelar",
            delete: "Excluir chamado",
            eyebrow: "Confirmação"
        },
        toast: {
            ticketCreated: "Chamado criado",
            ticketCreatedMsg: "O chamado {ticketNumber} foi registrado. Anote o número para acompanhar.",
            ticketUpdated: "Chamado atualizado",
            ticketUpdatedMsg: "As alterações foram salvas.",
            ticketDeleted: "Chamado excluído",
            ticketDeletedMsg: "O chamado foi removido com sucesso.",
            saveError: "Não foi possível salvar",
            saveErrorMsg: "O navegador recusou gravar os dados (armazenamento cheio ou navegação privada). Suas últimas alterações podem não persistir.",
            statusUpdated: "Status atualizado",
            statusUpdatedMsg: "O chamado foi movido para \"{status}\".",
            noChanges: "Nenhuma alteração",
            noChangesMsg: "Você não alterou nenhum campo.",
            statusInvalid: "Mudança não permitida",
            statusInvalidMsg: "De “{from}” o chamado só pode ir para: {allowed}.",
            dataCorrupted: "Dados ilegíveis",
            dataCorruptedMsg: "Os dados salvos estavam corrompidos. Guardamos uma cópia de segurança e iniciamos uma lista vazia.",
            dataRecovered: "Registros ignorados",
            dataRecoveredMsg: "{count} registro(s) fora do padrão foram ignorados e guardados em cópia de segurança.",
            unexpected: "Algo deu errado",
            unexpectedMsg: "Ocorreu um erro inesperado. Se continuar, recarregue a página."
        },
        status: {
            open: "Aberto",
            inProgress: "Em atendimento",
            resolved: "Resolvido",
            closed: "Encerrado"
        },
        breadcrumb: {
            home: "HelpDesk Pro"
        },
        mobile: {
            menuButton: "Abrir menu"
        },
        meta: {
            title: "HelpDesk Pro | Gestão de Chamados",
            description: "HelpDesk Pro — sistema de gerenciamento de chamados de TI."
        },
        a11y: {
            skipToContent: "Ir para o conteúdo principal",
            mainNav: "Navegação principal",
            language: "Idioma",
            langPt: "Português",
            langEn: "English"
        },
        storage: {
            okTitle: "Armazenamento local ativo",
            okHint: "Os chamados ficam salvos neste navegador.",
            errorTitle: "Armazenamento indisponível",
            errorHint: "Nada será salvo. Abra por HTTP (não file://) e saia da navegação privada."
        },
        demo: {
            badge: "Exemplo",
            banner: "Há chamados de exemplo (criados automaticamente) misturados com os seus.",
            remove: "Remover exemplos",
            load: "Carregar exemplos",
            removedTitle: "Exemplos removidos",
            removedMsg: "Foram removidos {count} chamado(s) de exemplo.",
            loadedTitle: "Exemplos carregados",
            loadedMsg: "Foram adicionados {count} chamados de exemplo, marcados como “Exemplo”."
        },
        common: {
            invalidDate: "Data inválida"
        }
    },

    en: {
        brand: {
            name: "HelpDesk Pro",
            subtitle: "Ticket Management System"
        },
        nav: {
            dashboard: "Dashboard",
            tickets: "Tickets",
            newTicket: "New Ticket"
        },
        dashboard: {
            section: "Overview",
            title: "Hello, team.",
            subtitle: "Track ticket status and keep daily demands on schedule.",
            newButton: "New Ticket",
            stats: {
                total: "Total tickets",
                open: "Open tickets",
                progress: "In progress",
                resolved: "Resolved and closed",
                openList: "View in list"
            },
            recentTickets: {
                section: "Tracking",
                title: "Recent tickets",
                viewAll: "View all",
                empty: "You don't have any tickets yet.",
                emptyHint: "Recent tickets will appear here."
            },
            statusSummary: {
                section: "Summary",
                title: "Ticket status",
                empty: "No data to display."
            }
        },
        tickets: {
            section: "Support Center",
            title: "Tickets",
            subtitle: "Find and manage all tickets from your team.",
            table: {
                number: "Number",
                requester: "Requester",
                title: "Title",
                priority: "Priority",
                status: "Status",
                date: "Date",
                actions: "Actions",
                category: "Category"
            },
            filters: {
                search: "Search tickets...",
                status: "Status",
                allStatus: "All statuses",
                priority: "Priority",
                allPriority: "All priorities",
                category: "Category",
                allCategories: "All categories",
                sort: "Sort by",
                recent: "Most recent",
                oldest: "Oldest",
                byPriority: "By priority",
                byTitle: "By title",
                clear: "Clear filters",
                completed: "Completed (resolved + closed)",
                searchLabel: "Search tickets"
            },
            empty: {
                title: "No tickets found.",
                subtitle: "Try changing filters or creating a new ticket."
            },
            actions: {
                view: "View",
                edit: "Edit",
                delete: "Delete",
                viewShort: "View",
                editShort: "Edit",
                deleteShort: "Delete",
                viewTicket: "View ticket {ticketNumber}",
                editTicket: "Edit ticket {ticketNumber}",
                deleteTicket: "Delete ticket {ticketNumber}"
            },
            results: {
                none: "No tickets",
                one: "1 ticket",
                all: "{count} tickets",
                filtered: "{count} of {total} tickets"
            },
            emptyAll: {
                title: "No tickets registered",
                subtitle: "Create the first ticket or load the samples."
            }
        },
        form: {
            section: "Open a ticket",
            title: "New Ticket",
            subtitle: "Describe the problem so our IT team can help you quickly.",
            fields: {
                requester: "Your name",
                requesterPlaceholder: "John Smith",
                department: "Department",
                departmentSelect: "Select a department",
                category: "Problem category",
                categorySelect: "Select a category",
                title: "Ticket title",
                titlePlaceholder: "Briefly describe the problem",
                description: "Detailed description",
                descriptionPlaceholder: "Explain the problem, what happened, and if possible, when it started.",
                priority: "Priority",
                prioritySelect: "Select a priority",
                priorityHint: "Consider the impact when setting the priority."
            },
            priorities: {
                low: "Low",
                medium: "Medium",
                high: "High",
                critical: "Critical"
            },
            departments: {
                it: "Information Technology",
                hr: "Human Resources",
                finance: "Finance",
                sales: "Sales",
                marketing: "Marketing",
                administrative: "Administrative",
                operations: "Operations",
                other: "Other"
            },
            categories: {
                hardware: "Hardware",
                software: "Software",
                network: "Network",
                access: "Access",
                email: "E-mail",
                printing: "Printing",
                systems: "Systems",
                security: "Security"
            },
            buttons: {
                create: "Create Ticket",
                save: "Save Changes",
                cancel: "Cancel"
            },
            info: {
                title: "Before sending",
                description: "A clear description helps the IT team understand the problem and reduce response time.",
                tips: {
                    "0": "Explain what happened.",
                    "1": "Tell us when the problem started.",
                    "2": "Describe any error messages you see."
                }
            },
            characterCount: "{count} / 1000",
            sectionTitle: "Ticket information",
            sectionSubtitle: "Fill in the main request details.",
            editing: {
                eyebrow: "Editing",
                title: "Edit ticket",
                subtitle: "Change the ticket data. Status is changed in the details view.",
                banner: "You are editing ticket {ticketNumber}. Nothing is saved until you confirm."
            },
            priorityGuide: {
                title: "What each priority means",
                low: "Low: question or non-urgent request; nothing is blocked.",
                medium: "Medium: slows work down, but a workaround exists.",
                high: "High: blocks one person from working.",
                critical: "Critical: blocks an entire department or the company."
            }
        },
        validation: {
            requesterEmpty: "Please enter your name.",
            departmentEmpty: "Please select a department.",
            titleEmpty: "Please enter a ticket title.",
            titleTooShort: "The title must be at least 5 characters long.",
            descriptionEmpty: "Please describe the problem.",
            descriptionTooShort: "The description must be at least 10 characters long.",
            priorityEmpty: "Please select a priority.",
            categoryEmpty: "Select the category.",
            titleNotMeaningful: "Describe the problem in the title; avoid repeated characters.",
            descriptionNotMeaningful: "Describe the problem in more detail; avoid repeated characters.",
            summaryOne: "Fix the highlighted field before submitting.",
            summaryMany: "Fix {count} fields before submitting."
        },
        modal: {
            ticketDetails: "Ticket Details",
            edit: "Edit Ticket",
            close: "Close",
            fields: {
                number: "Number",
                title: "Title",
                requester: "Requester",
                department: "Department",
                priority: "Priority",
                status: "Status",
                statusChange: "Change ticket status",
                createdAt: "Opening date",
                updatedAt: "Last updated",
                description: "Description",
                history: "Status history",
                category: "Category"
            },
            history: {
                empty: "No history recorded yet.",
                current: "(current)"
            },
            notSpecified: "Not specified",
            changes: {
                title: "Recorded changes",
                item: "{field}: {from} → {to}",
                fields: {
                    requester: "Requester",
                    department: "Department",
                    category: "Category",
                    title: "Title",
                    description: "Description",
                    priority: "Priority"
                }
            }
        },
        confirm: {
            title: "Delete ticket?",
            message: "Ticket {ticketNumber} — \"{ticketTitle}\" will be deleted. This action cannot be undone.",
            cancel: "Cancel",
            delete: "Delete Ticket",
            eyebrow: "Confirmation"
        },
        toast: {
            ticketCreated: "Ticket created",
            ticketCreatedMsg: "Ticket {ticketNumber} was registered. Note the number to follow up.",
            ticketUpdated: "Ticket updated",
            ticketUpdatedMsg: "Your changes have been saved.",
            ticketDeleted: "Ticket deleted",
            ticketDeletedMsg: "The ticket has been removed successfully.",
            saveError: "Could not save",
            saveErrorMsg: "The browser refused to write the data (storage full or private browsing). Your latest changes may not persist.",
            statusUpdated: "Status updated",
            statusUpdatedMsg: "The ticket was moved to \"{status}\".",
            noChanges: "No changes",
            noChangesMsg: "You did not change any field.",
            statusInvalid: "Change not allowed",
            statusInvalidMsg: "From “{from}” the ticket can only go to: {allowed}.",
            dataCorrupted: "Unreadable data",
            dataCorruptedMsg: "The saved data was corrupted. We kept a backup copy and started an empty list.",
            dataRecovered: "Records ignored",
            dataRecoveredMsg: "{count} nonconforming record(s) were ignored and kept in a backup copy.",
            unexpected: "Something went wrong",
            unexpectedMsg: "An unexpected error occurred. If it continues, reload the page."
        },
        status: {
            open: "Open",
            inProgress: "In Progress",
            resolved: "Resolved",
            closed: "Closed"
        },
        breadcrumb: {
            home: "HelpDesk Pro"
        },
        mobile: {
            menuButton: "Open menu"
        },
        meta: {
            title: "HelpDesk Pro | Ticket Management",
            description: "HelpDesk Pro — IT ticket management system."
        },
        a11y: {
            skipToContent: "Skip to main content",
            mainNav: "Main navigation",
            language: "Language",
            langPt: "Portuguese",
            langEn: "English"
        },
        storage: {
            okTitle: "Local storage active",
            okHint: "Tickets are saved in this browser.",
            errorTitle: "Storage unavailable",
            errorHint: "Nothing will be saved. Open via HTTP (not file://) and leave private browsing."
        },
        demo: {
            badge: "Sample",
            banner: "Sample tickets (created automatically) are mixed with your own.",
            remove: "Remove samples",
            load: "Load samples",
            removedTitle: "Samples removed",
            removedMsg: "{count} sample ticket(s) were removed.",
            loadedTitle: "Samples loaded",
            loadedMsg: "{count} sample tickets were added, marked as “Sample”."
        },
        common: {
            invalidDate: "Invalid date"
        }
    }
};

/* ==========================================================================
   IDIOMA ATUAL (em memória)
   ========================================================================== */

const LANGUAGE_STORAGE_KEY = "helpdesk-language";
const SUPPORTED_LANGUAGES = ["pt", "en"];

let currentLanguage = (function readSavedLanguage() {
    try {
        const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        return SUPPORTED_LANGUAGES.includes(saved) ? saved : "pt";
    } catch (error) {
        // localStorage bloqueado (modo privado, file:// restrito etc.)
        return "pt";
    }
})();

function getCurrentLanguage() {
    return currentLanguage;
}

function setCurrentLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
        return false;
    }

    currentLanguage = lang;

    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (error) {
        // Sem persistência: a escolha vale apenas para esta sessão.
    }

    return true;
}

/*
 * FUNÇÃO HELPER PARA OBTER STRING TRADUZIDA
 * Uso: t('dashboard.title') → string no idioma atual.
 * Se a chave não existir, devolve a própria chave.
 */
function t(key, replacements = {}) {
    const keys = key.split(".");
    let value = i18n[currentLanguage];

    for (const k of keys) {
        if (value && typeof value === "object") {
            value = value[k];
        } else {
            return key;
        }
    }

    if (typeof value !== "string") {
        return key;
    }

    let result = value;

    Object.keys(replacements).forEach((k) => {
        result = result.split("{" + k + "}").join(String(replacements[k]));
    });

    return result;
}
