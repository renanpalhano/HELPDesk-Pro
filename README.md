# HelpDesk Pro

Sistema de gerenciamento de chamados de TI em **HTML + CSS + JavaScript puro**,
sem backend e sem build. Os dados ficam no `localStorage` do navegador.

## Como executar

Abra por **HTTP**, não por duplo clique (`file://`). Alguns navegadores
restringem o `localStorage` em `file://`; nesse caso o sistema avisa na barra
lateral ("Armazenamento indisponível") e trabalha só em memória.

```bash
python -m http.server 8080      # ou:  npx http-server . -p 8080
# abra http://localhost:8080
```

Publicação estática (GitHub Pages, Netlify, Vercel etc.) funciona sem ajustes.

## Estrutura

| Arquivo | Papel |
|---|---|
| `index.html` | Marcação. Textos traduzíveis usam `data-i18n*`. |
| `style.css` | Estilos, tokens de cor, responsivo (drawer ≤ 900px, cartões ≤ 1180px). |
| `script.js` | Toda a lógica, dentro de uma IIFE `"use strict"`. Só expõe `window.HelpDesk.refresh()`. |
| `i18n.js` | Dicionário PT/EN (única fonte de textos) e função `t()`. Idioma em memória. |
| `i18n-loader.js` | Aplica `data-i18n*` ao HTML e gerencia o seletor de idioma. |
| `tests/e2e_suite.py` | Testes de ponta a ponta (Playwright). |

Ordem dos scripts: `i18n.js` (head) → `script.js` → `i18n-loader.js`.

## Regras de negócio

**Status e transições permitidas** (definidas em `STATUS_TRANSITIONS`, em `script.js`):

| De | Para |
|---|---|
| Aberto | Em atendimento, Encerrado |
| Em atendimento | Aberto, Resolvido, Encerrado |
| Resolvido | Em atendimento, Encerrado |
| Encerrado | Aberto (reabertura) |

**Prioridades**

- **Baixa** – dúvida ou pedido sem urgência; nada está parado.
- **Média** – atrapalha o trabalho, mas existe alternativa.
- **Alta** – impede o trabalho de uma pessoa.
- **Crítica** – impede o trabalho de um setor inteiro ou da empresa.

**Número do chamado (`CH-1000`…)** vem de um contador persistido que só
incrementa. Excluir o último chamado **não** faz o número ser reutilizado.

**Exclusão** é física e irreversível (não há lixeira); a confirmação avisa.

**Auditoria** – cada chamado guarda `statusHistory` (todas as mudanças de
status com data) e `editLog` (campo, valor anterior e novo de cada edição).

**Dados de exemplo** – na primeira execução são criados 5 chamados marcados
como "Exemplo". Podem ser removidos ou recarregados a qualquer momento; apagar
tudo **não** os recria sozinho.

## Modelo de dados (schema v3)

```js
{
  id: 1005,                       // inteiro ≥ 1, único
  requester, department, category, title, description, priority, status,
  createdAt, updatedAt,           // ISO 8601
  statusHistory: [{ status, date }],
  editLog: [{ date, changes: [{ field, from, to }] }],
  isDemo: false
}
```

Valores de domínio são gravados sempre em português (`"Aberto"`, `"Alta"`…);
só a exibição é traduzida.

Chaves do `localStorage`: `helpdesk-pro-tickets`, `-last-id`, `-seeded`,
`-schema`, `-backup-corrupted`, `-backup-invalid` e `helpdesk-language`.

**Leitura defensiva:** cada registro é validado ao carregar. Campos essenciais
inválidos → registro descartado **e guardado** em `-backup-invalid`. Dados
ilegíveis → cópia em `-backup-corrupted` e lista vazia (nada é sobrescrito
em silêncio). Campos secundários inválidos recebem valores padrão seguros.

## Acessibilidade

Skip link; foco preso nos modais (com `inert` no fundo) e devolvido a quem os
abriu; foco movido ao título ao trocar de seção; erros de formulário com
`aria-invalid`, `aria-describedby`, resumo e foco no primeiro campo inválido;
`aria-current` na navegação; `lang` e `<title>` acompanham o idioma; anel de
foco de alto contraste; contraste AA nas cores de texto; fonte mínima de 12px;
`prefers-reduced-motion` respeitado.

## Limitações assumidas / NÃO IMPLEMENTADO

- **Sem autenticação, perfis ou permissões**: qualquer pessoa com acesso ao
  navegador vê e altera tudo. Não há "quem fez" nos registros.
- **Sem backend**: os dados não são compartilhados entre pessoas/dispositivos
  e podem ser apagados ao limpar os dados do navegador. Não há backup automático.
- **Sem responsável (técnico) por chamado, sem SLA/prazos, sem notificações,
  anexos ou comentários.** Regras de duplicidade e de fechamento automático
  também **não estão definidas**.
- Validação apenas no cliente. A checagem de "texto significativo" é uma
  heurística de forma (tamanho + variedade de caracteres), não de conteúdo.
- Cota do `localStorage` (~5 MB) limita o volume de chamados.
- Testado em Chromium. Firefox e Safari não foram exercitados nos testes automáticos.

## Decisões de arquitetura

- **Sem ES Modules**: módulos não carregam por `file://` (CORS), o que
  quebraria quem abre o arquivo direto. A IIFE isola o escopo sem exigir servidor.
- **Estrutura plana** mantida (5 arquivos) por simplicidade de publicação.
- Toda escrita passa por `commit()` (grava + redesenha) e todo acesso ao
  `localStorage` por um adaptador com `try/catch`.

## Qualidade

```bash
npm run check   # node --check nos 3 JS
npm run lint    # ESLint 9 (npm install antes)
npm test        # pip install playwright && playwright install chromium
```
