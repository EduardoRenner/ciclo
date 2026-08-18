# 00 · BRIEFING

> **Para quem é:** o agente de código (Claude Code) ou o dev que vai construir o CICLO.
> **Regra de ouro:** tudo neste pacote já é **decisão tomada**, não sugestão. Se algo não estiver aqui, procure em `05-FAQ-DEV.md` antes de perguntar — 130 perguntas já estão respondidas. Se ainda assim faltar, **decida você, registre a decisão em `docs/DECISOES.md` e siga** — não pare a implementação esperando resposta.

---

### 1. O que estamos construindo

**CICLO** — SaaS multi-tenant de gestão para profissionais da beleza (barbearia, unhas, cílios, sobrancelha, depilação, estética). Web app + PWA mobile-first, em português do Brasil.

O produto central **não é a agenda**. É o **Motor de Ciclo**: o sistema aprende de quanto em quanto tempo cada cliente volta, detecta quem está atrasado e traz de volta automaticamente. A agenda é o que sustenta isso.

Se você precisar cortar escopo, corte qualquer coisa **menos** estas quatro:
1. Agenda funcionando (criar, remarcar, cancelar, sem conflito de horário)
2. Motor de Ciclo + tela "Recuperar receita"
3. Lembrete e confirmação por WhatsApp
4. Sinal via Pix

---

### 2. Prompt de partida (cole isto no Claude Code)

```
Você vai construir o CICLO, um SaaS multi-tenant de gestão para profissionais
da beleza. Todo o contexto está em ./docs. Leia nesta ordem:

  docs/00-BRIEFING.md         ← escopo, regras do jogo, definição de pronto
  docs/01-ESPEC-TECNICA.md    ← arquitetura travada e algoritmos
  docs/02-API.md              ← contratos de endpoint
  docs/05-FAQ-DEV.md          ← 130 decisões já tomadas (consulte SEMPRE antes de perguntar)
  docs/06-BACKLOG.md          ← ordem exata de implementação
  db/schema.sql               ← schema completo, aplique como primeira migration
  CLAUDE.md                   ← regras obrigatórias do repositório

Comece pelo TICKET-001 do backlog e siga a ordem. Não pule tickets.
Ao terminar cada ticket: rode `pnpm verify` (typecheck + lint + testes + teste de RLS),
faça um commit atômico e passe para o próximo.
Se precisar de uma decisão que não está na documentação, tome a decisão mais
simples que atenda ao critério de aceite, registre em docs/DECISOES.md e continue.
Nunca invente credenciais nem dados de produção. Nunca desabilite RLS.
```

---

### 3. Escopo do MVP (10 semanas)

#### ✅ Está no MVP

| Área | Entrega |
|---|---|
| **Conta** | Cadastro, login, onboarding com escolha de vertical (aplica o pack), 1 tenant por conta |
| **Cadastros** | Serviços, profissionais, horário de funcionamento, bloqueios/folgas, produtos |
| **Clientes** | CRUD, importação por CSV, busca, ficha 360°, tags, notas |
| **Agenda** | Grade diária/semanal, criar/remarcar/cancelar, detecção de conflito, buffer, recorrência simples |
| **Booking público** | Página `/{slug}`, escolha de serviço → profissional → horário, com ou sem sinal |
| **Sinal via Pix** | Cobrança de sinal na reserva, confirmação por webhook, abatimento no atendimento |
| **WhatsApp** | Lembrete D-1 e D-0, confirmação com botão, remarcação |
| **Motor de Ciclo** | Cálculo de intervalo pessoal, estados, tela "Recuperar receita", campanha de reativação |
| **Comanda** | Abrir, adicionar serviço/produto, aplicar desconto, cobrar (Pix/cartão/dinheiro), fechar |
| **Caixa** | Fechamento diário, receita do mês, custo de material, lucro real |
| **Estoque** | Produtos, ficha de consumo por serviço, baixa automática, alerta de ponto de pedido |
| **Cofre/LGPD** | Anamnese por vertical, consentimentos assinados, fotos privadas, trilha de acesso, exportação e eliminação |
| **PWA** | Instalável, offline de leitura, fila de mutações, push |
| **Segurança** | RLS em 100% das tabelas, auditoria, MFA para owner, rate limit |

#### ❌ NÃO está no MVP (não implemente, nem "por cima")

Comissão avançada com faixas progressivas · cadeira alugada · multiunidade · NFS-e · IA recepcionista · clube de assinatura · marketplace · app nativo · antecipação de recebíveis · relatórios BI · integração Google Calendar · Instagram · gift card · white-label de domínio próprio.

> Esses entram na V1/V2. **Deixe os pontos de extensão preparados** (interfaces, colunas nullable, feature flags), mas não construa.

---

### 4. Ambientes

| Ambiente | Onde | Dado |
|---|---|---|
| `local` | Supabase CLI local + `pnpm dev` | Seed fake |
| `preview` | Vercel Preview + branch do Supabase | Seed fake, PSP sandbox, WhatsApp sandbox |
| `prod` | Vercel + Supabase região **South America (São Paulo)** | Real |

Nunca aponte `local` ou `preview` para credenciais de produção. O CI bloqueia se detectar.

---

### 5. Definição de pronto (Definition of Done)

Um ticket só está pronto quando **todos** estes itens são verdadeiros:

- [ ] Critério de aceite do ticket satisfeito e demonstrável
- [ ] `pnpm verify` passa (typecheck, lint, unit, RLS, build)
- [ ] Nenhuma tabela nova sem RLS habilitado + política + teste de isolamento
- [ ] Toda entrada de usuário validada por schema Zod na borda
- [ ] Toda escrita relevante gerou registro em `audit_log`
- [ ] Texto de interface em pt-BR, sem jargão técnico
- [ ] Funciona em viewport de 390 px de largura com uma mão
- [ ] Estado de carregamento, vazio e erro implementados (nada de tela branca)
- [ ] Valores monetários em centavos (inteiro), nunca float
- [ ] Datas gravadas em `timestamptz` UTC e exibidas no fuso do tenant

---

### 6. As 12 regras invioláveis

1. **RLS sempre.** Tabela sem `ENABLE ROW LEVEL SECURITY` quebra o build. Sem exceção, sem "depois eu ligo".
2. **`service_role` nunca em rota de usuário.** Só em worker, e sempre dentro do wrapper `withTenant()`.
3. **Dinheiro em centavos.** `bigint`, nunca `float`/`numeric` com casas soltas. Formatação só na UI.
4. **Tempo em UTC.** `timestamptz` no banco; conversão para o fuso do tenant só na apresentação.
5. **Toda mutação é idempotente.** Header `Idempotency-Key` obrigatório em POST/PUT/PATCH que mexe em dinheiro ou agenda.
6. **Nada de `any`.** TypeScript em modo estrito; tipos gerados do banco.
7. **Nada de SQL concatenado.** Sempre parametrizado.
8. **Segredo nunca no repositório.** Nem em teste, nem em comentário, nem em seed.
9. **Dado de saúde nunca em log.** Nem em Sentry, nem em console, nem em breadcrumb. Redija antes.
10. **Feature nova = teste novo.** No mínimo o caminho feliz e um caminho de erro.
11. **Commit atômico** por ticket, mensagem em português no imperativo, referenciando o ticket.
12. **Se der ambiguidade, escolha o mais simples.** Depois registre em `docs/DECISOES.md`.

---

### 7. Estrutura de pastas

```
ciclo/
├─ CLAUDE.md
├─ .env.example
├─ package.json
├─ docs/                      ← este pacote
├─ supabase/
│  ├─ migrations/             ← SQL versionado (schema.sql vira a 0001)
│  ├─ seed.sql                ← packs de vertical + dados demo
│  └─ functions/              ← Edge Functions (workers)
├─ src/
│  ├─ app/
│  │  ├─ (auth)/              ← login, cadastro, recuperar senha
│  │  ├─ (app)/               ← app do profissional (autenticado)
│  │  │  ├─ hoje/
│  │  │  ├─ agenda/
│  │  │  ├─ clientes/[id]/
│  │  │  ├─ recuperar/
│  │  │  ├─ comanda/[id]/
│  │  │  ├─ caixa/
│  │  │  └─ config/
│  │  ├─ (public)/[slug]/     ← booking público
│  │  ├─ (client)/minha-conta/← área da cliente final
│  │  └─ api/
│  │     ├─ v1/               ← endpoints REST (único caminho de escrita)
│  │     └─ webhooks/         ← psp, whatsapp
│  ├─ core/                   ← REGRA DE NEGÓCIO PURA, sem I/O, 100% testável
│  │  ├─ scheduling/          ← slots, conflito, buffer
│  │  ├─ cycle/               ← motor de ciclo
│  │  ├─ pricing/             ← comanda, desconto, imposto
│  │  ├─ commission/
│  │  ├─ inventory/
│  │  └─ risk/                ← score de no-show
│  ├─ server/
│  │  ├─ db/                  ← client, withTenant, tipos gerados
│  │  ├─ services/            ← orquestração (usa core + db + providers)
│  │  ├─ providers/           ← payments/, messaging/, storage/, ai/  (interfaces + impl)
│  │  ├─ auth/                ← sessão, RBAC, guards
│  │  ├─ crypto/              ← cofre (envelope encryption)
│  │  └─ audit/
│  ├─ components/             ← UI compartilhada (shadcn + próprios)
│  ├─ features/               ← componentes por domínio
│  └─ lib/                    ← utils, formatadores, fetch client com fila offline
└─ tests/
   ├─ unit/                   ← core/
   ├─ rls/                    ← isolamento multi-tenant (OBRIGATÓRIO)
   └─ e2e/                    ← Playwright
```

**Regra de dependência:** `core/` não importa nada de `server/`, `app/` ou de biblioteca de I/O. Isso é o que torna a regra de negócio testável sem banco. O CI verifica.

---

### 8. Ordem de trabalho

Siga `06-BACKLOG.md`. Resumo:

```
Sprint 0  Fundação: repo, Supabase, schema, RLS, auth, CI, design system
Sprint 1  Cadastros + agenda funcionando
Sprint 2  Booking público + WhatsApp + sinal via Pix
Sprint 3  Motor de Ciclo + Recuperar receita
Sprint 4  Comanda, caixa, estoque
Sprint 5  Cofre/LGPD + PWA + endurecimento de segurança
```

---

### 9. Índice do pacote

| Arquivo | Conteúdo |
|---|---|
| `docs/00-BRIEFING.md` | Este documento |
| `docs/01-ESPEC-TECNICA.md` | Arquitetura travada, algoritmos, máquinas de estado |
| `docs/02-API.md` | Contratos de endpoint, erros, webhooks |
| `docs/03-DESIGN-SYSTEM.md` | Tokens, componentes, padrões mobile |
| `docs/04-SEGURANCA-LGPD.md` | Checklist executável de segurança e privacidade |
| `docs/05-FAQ-DEV.md` | **130 perguntas do dev já respondidas** |
| `docs/06-BACKLOG.md` | Tickets com critério de aceite |
| `db/schema.sql` | DDL + RLS + índices + triggers |
| `db/seed.sql` | Packs de vertical + dados de demonstração |
| `repo/CLAUDE.md` | Regras do repositório para o agente |
| `repo/.env.example` | Variáveis de ambiente |


---

