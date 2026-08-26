# CLAUDE.md · CICLO
Leia `docs/00-BRIEFING.md` antes de qualquer coisa. Este arquivo é o resumo operacional que vale para **toda** sessão.

---

#### Contexto em uma frase

CICLO é um SaaS multi-tenant de gestão para **qualquer profissional que tem agenda e clientes que voltam** — não só beleza (barbearia, unhas, estética), mas também faxineira, eletricista, personal trainer e afins (`docs/09-PLATAFORMA.md`). Mobile-first, pt-BR, Next.js + Supabase. O diferencial é o **Motor de Ciclo**, que prevê quando cada cliente volta e traz de volta automaticamente.

---

#### Comandos

```bash
pnpm dev            # sobe o app (precisa de `supabase start` antes)
pnpm verify         # typecheck + lint + test:unit + test:rls + build  ← rode antes de todo commit
pnpm test:unit      # Vitest em src/core
pnpm test:rls       # isolamento multi-tenant (NUNCA pule)
pnpm test:e2e       # Playwright
pnpm db:types       # regenera src/server/db/types.gen.ts
pnpm db:reset       # reset local + seed (bloqueado em produção)
pnpm db:new <nome>  # cria nova migration
```

---

#### Regras invioláveis

1. **RLS sempre.** Tabela nova sem `enable row level security` + `force row level security` + política + teste quebra o build. Nunca desabilite RLS para depurar; use `select set_tenant_context('<uuid>')` no psql.
2. **`service_role` só dentro de `src/server/db/with-tenant.ts`** e das Edge Functions. Há regra de lint. Não contorne.
3. **Dinheiro em centavos** (`bigint`, sufixo `_cents`). Percentual em basis points (`_bps`). Nunca float.
4. **Tempo em `timestamptz` UTC.** Conversão para o fuso do tenant só na apresentação. Nunca aritmética em horário local.
5. **Regra de negócio em `src/core/`**, funções puras, sem I/O. `core/` não importa de `server/` nem de `app/`.
6. **Escrita sempre por `/api/v1`** com `Idempotency-Key`. Server Action só em formulário simples que não precisa de offline.
7. **Zod na borda.** Toda entrada validada antes de tocar no banco.
8. **Nada de `any`.** Use `unknown` e refine.
9. **Dado de saúde nunca em log, Sentry ou analytics.** Redija antes.
10. **Segredo nunca no repositório** — nem em teste, nem em comentário, nem em seed.
11. **Nunca delete** agendamento, movimento de estoque ou registro de auditoria. Use estado/compensação.
12. **Um ticket, um commit**, mensagem em português: `feat(agenda): impedir agendamento sobreposto (TICKET-021)`.

---

#### Antes de considerar um ticket pronto

- [ ] Critério de aceite do ticket satisfeito
- [ ] `pnpm verify` passa
- [ ] Teste novo para o caminho feliz e um caminho de erro
- [ ] Tabela nova tem RLS + política + aparece no teste de isolamento
- [ ] Estados de carregamento, vazio e erro implementados
- [ ] Funciona a 390 px de largura, alvos ≥ 48 px
- [ ] Texto em pt-BR, sem jargão, erro explica o que fazer
- [ ] `audit_log` gravado nas mutações relevantes

---

#### Quando faltar informação

1. Procure em `docs/05-FAQ-DEV.md` (132 decisões já tomadas).
2. Não achou? Escolha a opção **mais simples** que atenda ao critério de aceite.
3. Registre em `docs/DECISOES.md`: `2026-08-20 · pergunta · decisão · motivo`.
4. Continue. **Não pare a implementação para perguntar.**

---

#### Estilo

- Código, tabelas e colunas em **inglês**. UI, mensagens ao usuário, comentários e commits em **português**.
- Componente: um arquivo, export default, props tipadas, sem `React.FC`.
- Server Component por padrão; `'use client'` só onde precisa de estado/evento.
- Nada de comentário óbvio. Comente **por que**, não **o que**.
- Nunca crie arquivo que o ticket não pediu. Nada de README extra, nada de `utils.ts` genérico.

---

#### Armadilhas conhecidas deste projeto

| Armadilha | O certo |
|---|---|
| Verificar conflito com `SELECT` antes do `INSERT` | A constraint `appointments_no_overlap` já resolve. Trate o erro e devolva 409 com alternativas. |
| Somar minutos em horário local para gerar slot | Converta para instante UTC. Dia de mudança de fuso tem 23 ou 25 horas — há teste. |
| Criar view sem `security_invoker = true` | A view fura a RLS. Sempre com `security_invoker`. |
| Cachear resposta de `/vault` ou mídia assinada no service worker | Proibido. Adicione à deny-list do Workbox. |
| Calcular desconto percentual e guardar o percentual | Guarde o valor em centavos. Preço muda; histórico não pode mudar. |
| Reconhecer receita de pacote na venda | Receita é por sessão consumida. Dinheiro entra em `payments`, receita em `ticket_items`. |
| Bloquear atendimento por estoque negativo | Alerte, não bloqueie. Bloquear faz o salão abandonar o sistema. |
| Marcar no-show automaticamente | O sistema **sugere**; quem marca é o profissional. |
| Deletar o movimento de estoque no estorno | Gere movimento compensatório do tipo `return`. |
| Confiar no `tenant_id` do corpo da requisição | Use sempre o do contexto validado. |
