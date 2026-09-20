# Mapa do produto — CICLO

> Mantido pelo agente autônomo de evolução do produto (missão iniciada 2026-09-20). Não é uma
> re-explicação do `docs/00-BRIEFING.md` (a intenção original) — é o estado ATUAL, com o que o
> produto virou depois de ~80 documentos de decisão. Atualizar quando o produto mudar de forma
> visível, não a cada commit.

## 1 · O que é

SaaS multi-tenant de gestão para profissionais com agenda e clientes que voltam — nasceu focado em
beleza (barbearia, unhas, cílios, estética), mas `docs/09-PLATAFORMA.md` generalizou para qualquer
prestador de serviço recorrente. Next.js 15 (App Router) + Supabase (Postgres/RLS) + Vercel (São
Paulo). PWA mobile-first, pt-BR. Produção: `seuciclo.com.br`.

O diferencial não é a agenda — é o **Motor de Ciclo** (`src/core/cycle/`): aprende o intervalo
pessoal de retorno de cada cliente, detecta quem está atrasado, calcula valor em risco e traz de
volta automaticamente (campanha) ou avisa o profissional (recuperar).

## 2 · Stack

- **Framework:** Next.js 15.5, React 19, TypeScript estrito, Tailwind.
- **Banco:** Supabase (Postgres) — RLS obrigatório em toda tabela, `service_role` só em
  `src/server/db/with-tenant.ts` e Edge Functions.
- **Pagamento:** Mercado Pago (sinal via Pix, assinatura de clube).
- **Mensageria:** WhatsApp Business Platform (lembrete, confirmação, campanha).
- **E-mail:** Resend.
- **IA:** Gemini (`src/server/providers/ai/`), usado no assistente — nunca recebe dado de saúde
  (regra inviolável, com guarda de teste).
- **Nativo:** Capacitor 8 (`ios/`, `android/`) — mesmo app Next.js, sem duplicar código.
- **Testes:** Vitest (`tests/unit` 290 arquivos / ~2500 casos, `tests/rls`, `tests/integration`).
  Sem Playwright/e2e ainda (`docs/DECISOES.md` 31/08).

## 3 · Rotas principais

### Público (sem login)
- `/` — landing.
- `/precos`, `/privacidade`, `/termos`.
- `/{slug}` — página do salão (vitrine).
- `/{slug}/agendar` — booking público (funil da CLIENTE final): serviço → profissional → dia/hora →
  nome+telefone → confirmar. Sinal via Pix opcional.
- `/{slug}/orcamento`, `/orcamento/{token}` — orçamento sob medida com link.
- `/confirmar/{token}`, `/avaliar/{token}`, `/lista-espera/{token}` — ações por link, sem conta.

### Autenticação
- `/cadastro`, `/entrar`, `/recuperar-senha`, `/nova-senha`, `/verificar`.

### Painel do profissional (`/admin/*`, autenticado, `topbar.tsx` + tab bar)
- `hoje` — resumo do dia (Central de Ações).
- `agenda`, `agenda/novo` — grade e criação de horário.
- `recuperar` — Motor de Ciclo: quem está atrasado, valor em risco.
- `clientes`, `clientes/[id]`, `clientes/nova`, `clientes/importar`, `clientes/ja-atendo` — CRM.
- `comanda/[id]` — atendimento em andamento (itens, desconto, fechamento).
- `caixa` — fechamento, receita, custo, lucro.
- `estoque` — produtos, consumo por serviço, ponto de pedido.
- `campanhas`, `campanhas/nova` — reativação em massa via WhatsApp.
- `orcamentos`, `orcamentos/novo` — orçamento sob medida (módulo pago `quotes`).
- `mes` — visão mensal.
- `series` — atendimentos recorrentes.
- `comissao` — comissão por profissional.
- `config/*` — serviços, profissionais (com expediente próprio, módulo `team`), horários, planos
  (fidelidade + clube de assinatura, módulos `loyalty`/`club`), custo fixo, taxas, cofre (LGPD),
  segurança (2FA), mensagens, notificações, automações, excluir conta, negócio.

## 4 · Entidades centrais (schema)

`tenants` · `clients` · `professionals` · `services` · `appointments` (constraint de não-sobreposição
no banco) · `tickets`/`ticket_items` (comanda) · `products`/`inventory_movements` · `payments` ·
`client_cycles`/`cycle_predictions` (Motor de Ciclo, `cycle_predictions` append-only) ·
`subscription_plans`/assinaturas de clube · `campaigns` · `quotes` · `vault` (anamnese/LGPD,
`security_invoker` nas views) · `audit_log`.

## 5 · Planos e módulos pagos

`podeUsarModulo(ctx, modulo)` (`src/core/billing/planos.ts`) decide o degrau. Módulos identificados
com checagem no código: `stock`, `campaigns`, `quotes`, `team`, `loyalty`, `club`, `register`,
`recurrence`. Regra do produto (`docs/30` §5.2): bloqueio nunca esconde a tela, mostra o que o plano
de cima faz E o caminho pra fazer sem ele quando existe — pressão de upgrade vem de VER o recurso,
não de adivinhar que ele existe. `BloqueioPlano` é o componente padrão; `motivoDesabilitado` é o
padrão pra botão travado inline. Trava de verdade é sempre no SERVIDOR (`exigirModulo`/
`podeUsarModulo` na rota) — a tela só avisa antes, nunca é a única barreira.

## 6 · Disciplinas do repositório (já estabelecidas, ver `CLAUDE.md`)

- **RLS sempre**, dinheiro em centavos, tempo em UTC, `core/` sem I/O, escrita por `/api/v1` com
  `Idempotency-Key`, Zod na borda, sem `any`.
- **Guarda de varredura** (testes que leem o código-fonte, não só o comportamento): usados quando o
  defeito é "esqueceram de fazer X em algum lugar", não "X está errado". Documentado extensamente em
  `CLAUDE.md` — casar com o que MUDA, nunca com nome solto/comentário/import; toda guarda nova
  precisa ser VISTA reprovando (mutação) antes de confiar nela.
- **`docs/DECISOES.md`** — log append-only de decisões, ~13.500 linhas, é a fonte de verdade sobre
  "por que isto é assim" quando o código sozinho não explica.

## 7 · Estado conhecido (desta sessão e anteriores, resumido)

- **App Store / Capacitor:** scaffold iOS+Android completo, builda no Windows sem Mac (achado desta
  sessão). Bloqueado em: decisão de onde compilar/assinar iOS (T0, precisa Mac/Codemagic) e compra
  de conta Apple Developer/Google Play (decisão + pagamento do Eduardo). Ver `APP_STORE_READINESS.md`.
- **Web Experience:** auditoria completa 2026-09-19, achou e consertou bug real de `next/image` sem
  `sizes` (wordmark + print de exemplo, 3 arquivos) e estendeu 2 guardas de varredura que tinham
  cobertura incompleta (`imagem-da-marca-diz-o-tamanho`, `recurso-pago-avisa-antes`). Ver
  `WEB_EXPERIENCE_AUDIT.md`.
- **Ambiente local:** Docker indisponível nesta máquina/sessão — `pnpm dev` e `test:rls`/
  `test:integration` não rodam aqui. Verificação usa `tsc`/`eslint`/`vitest run tests/unit`/
  `pnpm build` + teste manual contra `seuciclo.com.br` (produção, só leitura/inspeção, nunca mutação
  sem autorização explícita).
- **CI:** GitHub Actions, `concurrency: cancel-in-progress` — empurrar commits em sequência cancela
  o run anterior; agrupar antes de empurrar.

## 8 · Pontos de entrada para investigação futura

- `docs/07-CONTEXTO-PRODUTO.md` / `CONTEXTO-CICLO-PARA-IA.md` — visão de produto mais recente.
- `docs/03-DESIGN-SYSTEM.md` — tokens, componentes, padrão mobile.
- `docs/61-EXPERIENCIA-DE-USO-PLANO.md`, `71/72` — auditorias de copy/interface já feitas.
- `docs/70-RELATORIO-LOOP-PERFORMANCE.md` — 6 bugs de performance já achados/consertados.
- `docs/23` — auditoria de módulos pagos sem aviso (origem do padrão que a seção 5 descreve).
