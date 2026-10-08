# 101 · CICLO Advocacia: plano de implementação do MVP

> Escrito em 2026-10-07 a partir do prompt `.claude/ciclo/prompt-plano-mvp-advogado.md`. É um plano,
> não código: nada aqui foi implementado. Toda afirmação sobre o código traz `arquivo:linha` e um
> rótulo: **[FATO]** (lido), **[HIPÓTESE]** (inferência minha) ou **[DECISÃO PENDENTE]** (só o Eduardo
> decide). Onde não li, está escrito **NÃO LI**. Repositórios: CICLO em
> `C:\Users\Usuario\.claude\code\ciclo-verificacao` (branch `feat/cortesia-2026-10-03`, HEAD `c1dd6f41`)
> e LUBI em `C:\Users\Usuario\.claude\code\lubi-digital-office` (branch `execucao-plano-mestre`).
>
> Anexos em `docs/101-anexos/`: `01-modelo-de-dados.md`, `02-seguranca-e-ameacas.md`,
> `03-backlog.md`, `04-interface-e-copy.md`, `05-testes.md`, `06-amostra-demo.md`.

---

## 1. Resumo executivo

**Objetivo.** Entregar o primeiro pacote por nicho do CICLO fora de beleza: um escritório de
advocacia patrimonial e sucessória cria a conta, escolhe a profissão "Advocacia" e passa a usar o
mesmo app, no mesmo banco, com menu, vocabulário, campos e telas do nicho. O produto atual de beleza
não muda em nada.

**Promessa em uma frase.** Ao abrir o app, quem trabalha no escritório sabe em 5 segundos o que
fazer hoje (intimação a triar, prazo a cumprir, documento a cobrar) e, em cada cliente, o que falta,
de quem e até quando.

**Gancho e diferencial, na mesma tela.** O gancho de uso diário é **Hoje**: intimações capturadas
do DJEN e prazos com data interna antes da fatal. O diferencial é o **acompanhamento do caso
patrimonial**: o checklist "o que falta de você" por tipo de caso e a **Estrutura da família** (quem
controla o quê, com participação efetiva). Os dois se encontram em Hoje: um pedido ao cliente que
trava um prazo aparece ao lado do prazo, com a cobrança pronta.

**Escopo.** Dentro: profissão Advocacia como pacote, Cliente 360, Caso, Checklist, Estrutura da
família, Hoje com DJEN e prazos, mensagem pronta de WhatsApp (enviada por uma pessoa), papéis, MFA
para a equipe, auditoria, cofre de documentos. Fora: site público, portal do cliente, honorários, IA
generativa, assinatura eletrônica, pagamento, WhatsApp oficial, app nativo.

**O que já existe e é reaproveitado.** O CICLO já tem a mecânica de pacote (profissão como dado,
módulos com catálogo, vocabulário por tenant), isolamento multi-tenant provado por introspecção,
cofre com cifra por envelope, redação de PII, trilha de auditoria, fila de jobs com duas redes de
cron, pausa por tabela de rotas e aceite versionado de termos. O LUBI já tem o domínio jurídico
desenhado e testado em SQL e TypeScript puro: casos com sigilo, estrutura societária temporal com
participação efetiva, prazos blindados com memória de cálculo, documentos com quarentena e trilha
de acesso, captura do DJEN com reconciliação, e a função `prioridade()`. O trabalho é compor, não
inventar (§3).

**Os 5 maiores riscos.**
1. **Prazo errado.** Nenhuma data vem preenchida enquanto o gabarito de 50 intimações não existir e
   um sócio não confirmar as regras. A trava é por teste e permanece (§4.4, §12 R1).
2. **Vazamento entre escritórios ou entre papéis.** Toda tabela nova entra no teste de isolamento
   por introspecção e nos testes negativos por papel; caso sigiloso só para membros (§6, anexo 02).
3. **Portar o LUBI é reescrita, não cópia.** Stacks diferentes (Vite/TanStack × Next.js) e
   instalação única × multi-tenant: toda tabela ganha `tenant_id` e toda tela é refeita (§8).
4. **A tese não está validada.** Uma fonte (Dra. Katiane), entrevistas em andamento, uma venda
   anterior. O plano prevê onde as respostas mudam o escopo (§13) e um critério de morte (§11).
5. **Dado real antes da hora.** O ambiente aceita só dado fictício até o checklist "pode entrar dado
   real" estar 100% verde (anexo 02 §7).

---

## 2. Diagnóstico: o que já existe

Legenda de esforço relativo: **P** (cabe num ticket), **M** (dois a quatro tickets), **G** (fase).

### 2.1 CICLO (reaproveita como está, adapta, ou não serve)

| Item | Onde está | Classe | Esforço | Observação |
|---|---|---|---|---|
| Profissão como dado, com os 4 eixos, `vocab`, `modulos_padrao`, `campos_ficha`, `mensagens` | `supabase/migrations/0022_professions_catalog.sql:21-42` | reaproveita | P | `modulos_padrao`, `campos_ficha` e `mensagens` existem e **não têm leitor** [FATO: colunas criadas em 0022:36-38; não achei consumidor em `src/`, busca por nome]. O pacote Advocacia dá leitor a elas ou registra o pacote em código (§3.2). |
| Linha genérica "Outra profissão" e o cuidado de não copiar eixos | `0078_profissao_generica.sql:47-56`; `src/server/services/onboarding.ts:122-129` | reaproveita | P | Advocacia entra como linha nova no catálogo, no grupo `profissional` (`0022:25`). |
| `apply_profession_pack` (serviços e expediente padrão) | `0031_profession_onboarding.sql:22-39` | adapta | P | Para Advocacia os "serviços" são reuniões e consultas (duração e preço), não tipos de caso. |
| Vocabulário resolvido na borda (override do dono → pacote → padrão) | `src/core/text/vocabulario.ts:19-50`; `src/server/auth/tenant.ts:80,115` | reaproveita | P | Seis chaves fixas (`vocabulario.ts:19-26`). O pacote precisa de mais palavras (caso, prazo, pendência): §3.2 propõe vocabulário **do pacote** em código, sem mexer nas seis. |
| Módulos: catálogo com FK, três camadas eixo → plano → dono | `0025_tenant_modules.sql:17-33`; `0041_modules_catalogo.sql:25-57`; `src/core/billing/planos.ts:72-92,297-395` | adapta | M | Entra a quarta camada: **pacote**. Módulo jurídico some para quem não é do pacote (§3.3). Duas listas vigiadas por `tests/unit/core/modulos-catalogo.test.ts` (citado em `planos.ts:70`). |
| Trava de módulo no servidor | `src/server/services/planos.ts:257-278` (`exigirModulo`) | reaproveita | P | Toda rota jurídica chama `exigirModulo(db, tenantId, 'legal_*')`. |
| Contexto do tenant e revalidação de membership por requisição | `src/server/auth/tenant.ts:76-85,138-173` | adapta | P | O `select` da linha 80 passa a trazer `professions(vocab, pacote)`; `DadosDoTenant` ganha `pacote`. |
| Pausa por tabela de rotas, negar por padrão | `src/core/billing/pausa.ts:26-130,153-159`; guarda `tests/unit/billing/pausa-por-rota.test.ts:1-30` | reaproveita | P | Toda rota de escrita nova entra na tabela ou o build reprova. |
| Acesso aberto | `src/core/billing/acesso-aberto.ts`; DECISOES 2026-10-07 (`docs/DECISOES.md:13746`) | reaproveita | 0 | Enquanto ligado, não há plano a vender nem pausa: o pacote Advocacia nasce liberado para toda conta do pacote. |
| Papéis (`owner`, `manager`, `professional`, `reception`, `finance`) e duas camadas (permissão + RLS) | `src/server/auth/rbac.ts:5-29,68-86` | adapta | M | Mapeamento para o escritório em §3.4. Não existe "estagiário": vira atributo, não papel (§3.4). |
| MFA: `exigirAal2` por ação | `src/server/auth/session.ts:76-81`; rotas `v1/auth/mfa/*` (`pausa.ts:41-43`) | adapta | M | **Não há porta de MFA para o painel inteiro** [FATO: `grep -i "mfa\|aal" src/middleware.ts` sem resultado]. Para o pacote Advocacia a porta nasce em `contextoDoPainel` (§6.3). |
| Cofre: cifra por envelope, DEK em memória 5 min | `src/server/crypto/vault.ts:11-106`; `kek.ts` (NÃO LI o corpo) | reaproveita | P | Para CPF/CNPJ completo, se um dia entrar (MVP guarda só hash, §4.3). |
| Privilégio por coluna para dado sensível | `0077_cofre_por_coluna.sql:56-73` | reaproveita (padrão) | P | Mesmo padrão para `texto_sanitizado` da intimação e para `strategy_notes`. |
| Trilha de auditoria (sem política de insert; servidor grava; redige campos) | `src/server/audit/write.ts:24-46,88-128`; `0001_initial.sql:566-580` | reaproveita | P | A lista `REDIGIR` ganha chaves jurídicas (anexo 02 §4). |
| Trilha de acesso ao cofre | `vault_access_log` (`0001:478-489`); `src/server/services/trilha-cofre.ts:1-50` | adapta (padrão) | P | Documento jurídico ganha trilha própria `legal_access_log` com `document_id` (anexo 01). |
| Redação de PII para Sentry | `src/lib/observability/redact.ts:14-58,94-96` | adapta | P | Chaves novas: `numero_processo`, `cnj`, `oab`, `texto_sanitizado`, `strategy`, `estrategia`, `cnpj`. |
| Append-only por ausência de política | `0080_historico_nao_se_apaga_pelo_postgrest.sql:46-60`; `0095_aceite_versionado_dos_termos.sql:17-20` | reaproveita (padrão) | P | Prazos, alterações de prazo, alertas, intimações, versões de documento e trilha de acesso. |
| Isolamento por introspecção (toda tabela nova precisa de linha no seed do teste) | `tests/rls/isolation.test.ts:89-101,282-441,471-533` | reaproveita | M | Cada tabela nova com `tenant_id` entra em `restantes` (`isolation.test.ts:282`), ou o teste "sobrou linha do outro tenant" não tem o que sobrar. |
| View só com `security_invoker` | guarda `tests/unit/design/view-nao-fura-a-rls.test.ts` (citada em `0087:81-86`) | reaproveita | 0 | Fila "Hoje" jurídica como view invoker ou como consulta em `server/` (§3.5). |
| Fila de jobs com dedupe, backoff e `claim_jobs` | `src/server/services/job-queue.ts:49-145`; `0009_job_queue_claim.sql` (NÃO LI) | reaproveita | P | A captura do DJEN é um job por (tenant, OAB, dia). |
| Duas redes de cron (GitHub 6×/dia + pg_cron horário) e heartbeat | `.github/workflows/cron.yml:49-54,78-120`; `0087_pg_cron_como_segunda_rede_do_motor.sql:45-73`; `src/server/services/health.ts:26-70` | adapta | M | Rota nova `/api/cron/legal-intimacoes` nas duas redes; checagem nova no health. |
| Versão de schema esperada (produção atrás do código) | `src/core/schema/versao.ts:23-26` | reaproveita | 0 | Cada migration nova muda `MIGRATIONS_ESPERADAS` e `ULTIMA_MIGRATION`, ou a guarda reprova. |
| Aceite versionado de termos | `0095_aceite_versionado_dos_termos.sql:33-40`; `src/core/legal/versoes.ts:13-16` | adapta | P | `documento` aceita só `termos`/`privacidade` (0095:38): adendo do pacote exige ampliar o `check` (aditivo) e texto de advogado. **`src/core/legal/aceite.ts` e `aceite-legal.ts` não estão nesta branch** [FATO: `ls src/core/legal` só tem `versoes.ts`]; estão no PR #144. |
| `wa.me` com texto | `src/lib/mensagens.ts:64-69` | reaproveita | 0 | Mensagem pronta ao cliente, enviada pela pessoa. |
| Modelos de mensagem por tenant | tabela `message_templates` (seed em `isolation.test.ts:413-415`); `listarModelos` (`src/app/admin/clientes/[id]/page.tsx:14,53`) | reaproveita | P | O pacote semeia modelos de cobrança de documento sem dado do caso. |
| Agenda, conflito de horário, `appointments` | `0001` (NÃO LI o bloco); regra em `CLAUDE.md` (armadilhas) | reaproveita | P | Reunião com cliente = `appointment` com serviço "Reunião"; ligação ao caso por tabela de vínculo (anexo 01 §2.9). |
| Clientes (nome, telefone com hash, tags, opt-out) | `0001_initial.sql:223-250` | reaproveita | 0 | O `client` é a **conta** (família ou pessoa titular); as pessoas da família moram em `legal_persons`. |
| Demonstração: lista de slugs que o sitemap, o robots, o aviso e a mensageria leem | `src/core/tenants/demonstracao.ts:56-78` | adapta | P | O escritório-modelo entra na lista; a coluna `tenants.is_demo` (alvo registrado em `demonstracao.ts:11-16`) entra neste MVP (anexo 06 §4). |
| Seed de 6 negócios com histórico encadeado sem sobreposição | `scripts/seed-demo-6-negocios.mjs:1-19,265-318` | adapta (padrão) | M | O gerador do escritório-modelo segue o mesmo desenho (gera por linha do tempo, respeita constraints). |
| Hoje: Central de Ações com `catch` que loga | `src/app/admin/hoje/page.tsx:43-60` | adapta (padrão) | P | A fila jurídica segue a mesma regra: nunca derruba Hoje, nunca cala. |
| Tab bar de 5 slots e botão central | `src/components/shell/tabs.ts:27-46`; `tab-bar.tsx:33-105` | adapta | P | `ABAS` e `HREF_DO_CENTRO` passam a vir do pacote (§3.2). |
| Tema claro/escuro, tokens | `src/app/admin/layout.tsx:93-106`; tokens em `src/app/globals.css` (`--acc`, `--bg`, `--surface`, `--txt`, `--risk`, `--warn`, `--ok`, lista por `grep`) | reaproveita | P | Identidade do pacote por `data-pacote` no `#raiz-do-tema` (anexo 04 §2). |
| 111 guardas de design/segurança | `tests/unit/design/*.test.ts` (lista por `Glob`) | reaproveita | 0 | Em especial `copy-sem-travessao`, `copy-nao-supoe-genero`, `alvo-de-toque-tem-48`, `estado-vazio-tem-saida`, `telas-do-admin-tem-loading`, `sw-nao-cacheia-tela-privada`, `nunca-delete-o-que-e-historico`, `view-nao-fura-a-rls`. |
| Esteira de importação (planilha → clientes) | `docs/97-PLANO-CONVERSOR-DE-DADOS.md` §3-§5; rotas `POST v1/clients/import(/preview)` (`pausa.ts:62-63`) | adapta | M | Importar lista de clientes e checklist por planilha (§10 pergunta 4). |

### 2.2 LUBI (o que é cópia segura, o que é reescrita)

| Item | Onde está | Classe | Esforço | Observação |
|---|---|---|---|---|
| `prioridade()` e `ordenarFila()` | `src/lib/domain/prioridade.ts:1-234` (função pura, `hoje` por argumento) | **cópia segura** | P | Reaproveita as fontes `deadline`, `intimation`, `client_action`, `document_review`, `task`; descarta `lead`, `installment`, `request`, `message`, `obligation` no MVP. |
| `effectiveOwnership`, `validateOwnership` | `src/lib/domain/ownership.ts:1-40+` (TS puro) | **cópia segura** | P | Base da Estrutura da família. |
| Cálculo de prazo com regras versionadas e `validada: false` | `src/lib/domain/prazo-calculo.ts:1-50+`; `prazo-sugestao.ts:1-40+`; `prazo-leitura.ts` (NÃO LI) | **cópia segura** | P | Regras `[VALIDAR]` desligadas até confirmação (`prazo-calculo.ts:9-13,36-50`). |
| Cliente do DJEN (URL fixa, `redirect: "error"`, paginação com teto, `fetchImpl` injetável) | `src/lib/server/djen.server.ts:1-110`; `src/lib/domain/motores/intimacoes.ts:1-60+` | **cópia segura** (servidor) | P | Vira `src/server/advocacia/djen.ts` no CICLO; o domínio puro vai para `src/core/advocacia/`. |
| Casos com sigilo, membros, partes, `client_title` obrigatório | `supabase/migrations/0013_casos.sql:11-83` | reescrita (SQL) | M | Ganha `tenant_id`; `account_id` vira `client_id`; `staff_users` vira `professionals`/`memberships`. |
| Estrutura societária temporal (`entities`, `corporate_changes`, `ownerships` com exclusão GiST) | `0014_estrutura.sql:53-160` | reescrita (SQL) | M | Mesmas constraints; `apply_corporate_change` INVOKER (PM-D-009, `99-decisoes.md`). |
| Prazos blindados, alterações append-only, alertas | `0020_prazos.sql:121-190` | reescrita (SQL) | M | Mesmas regras (`deadlines_motivo_da_baixa`, `confirmacao_coerente`). |
| Prova do cálculo no prazo (`source`, `intimation_id`, `internal_due_on`, `calc_memo`, `suggested_due_on`, `calc_divergence`) e `prazo_regras_confirmadas()` | `0028_calculo_prazo.sql:17-73` | reescrita (SQL) | M | Regras confirmadas moram em `tenants.settings.advocacia`, não numa `settings` global. |
| Prazo interno D-N | `0029_prazo_interno.sql` (NÃO LI o corpo; descrito em `_progresso.md:250`) | reescrita | P | |
| Pedido ao cliente ("Precisamos de você") com rodada, escada de lembretes, aprovação | `0021_trabalho.sql:85-123` | reescrita (SQL) | M | Vira `legal_checklist_items` (anexo 01 §2.5). |
| Documentos com quarentena, versões imutáveis, vínculos e `access_log` | `0023_documentos.sql:60-177` | reescrita (SQL) | M | Lista de MIME e teto de 50 MB (`0023:115-120`). |
| Intimações e reconciliação | `0026_intimacoes.sql:37-110` | reescrita (SQL) | M | `alvo` passa a ser (tenant, OAB). |
| View `work_queue` (contrato de colunas) | `0024_work_queue.sql:143-278` | reescrita (SQL) | M | No CICLO, view `security_invoker = true` por tenant, ou consulta em `server/` (§3.5). |
| Telas: Hoje, Cliente 360, Estrutura, Simulador, Documentos | `src/components/admin/*.tsx` (TanStack) | **reescrita total** (Next.js) | G | O desenho vale; o código não. |
| Dados fictícios da demo (Família Ventura) | `src/demo/data.ts:1-60+`; `intimacoes-dados.ts:1-40+` | adapta (conteúdo) | P | Vira entrada do gerador do escritório-modelo (anexo 06). |
| Teste de matriz papel × tabela e mutação das defesas | `tests/security/matriz.test.ts:1-40+`; `scripts/mutation-security.ts:1-40+`; `scripts/arch-rules.ts` (AST) | adapta (prática) | M | O CICLO não tem matriz por persona nem mutação de política [FATO: `tests/rls/` tem 7 arquivos, nenhum de mutação]. O plano traz a prática (anexo 05 §4). |
| Decisões já tomadas que valem aqui | `docs/plano-mestre-lubi/99-decisoes.md` (PM-D-001…026); `07-seguranca.md` §1-§5; `06-motores.md` §0 | reaproveita (decisões) | 0 | Em especial: motores só preparam, pessoa envia; nada se apaga; prazo fatal não se adia; texto de WhatsApp sem dado do caso. |
| Gabarito de prazo (vazio) | `docs/gabarito/prazo-gabarito.json` (`validadoPor: null`) | reaproveita (trava) | P | **Não entra no repositório público do CICLO com texto real** (§6.5). |

### 2.3 O que NÃO existe em nenhum dos dois e precisa nascer

- O mecanismo de **pacote** que troca menu, centro, vocabulário extra, campos e modelos por profissão (§3.2).
- A quarta camada de módulo (**pacote**) em `podeUsarModulo` (§3.3).
- A **porta de MFA** para o painel inteiro de um tenant do pacote (§6.3).
- **Modelos de checklist por tipo de caso** (LUBI planejou `workflow_templates`, `11` §4, mas não implementou; `_progresso.md` para em T4.1).
- **Modo demonstração seguro** no painel (faixa, reinício, guarda no servidor), além da lista de slugs (anexo 06 §4).
- O **gerador do escritório-modelo** por linha do tempo (anexo 06 §2).

---

## 3. Arquitetura

### 3.1 A regra que organiza tudo

Um núcleo, vários pacotes. O núcleo é o que as profissões têm em comum e já existe: conta, equipe,
papéis, clientes, agenda, módulos, vocabulário, cofre, auditoria, jobs, mensageria, pausa, aceite.
O pacote é o que muda por profissão: menu, botão central, vocabulário extra, campos do cliente,
tipos de caso e seus checklists, modelos de mensagem, módulos próprios. Beleza fica no pacote
`base`, que é exatamente o comportamento de hoje.

Tudo que é regra pura vai para `src/core/advocacia/` (sem I/O, regra 5 do `CLAUDE.md`); tudo que lê
banco vai para `src/server/advocacia/`; telas em `src/app/admin/(advocacia)/...` ou nas rotas atuais
condicionadas ao pacote (anexo 04 decide tela a tela).

### 3.2 Como a profissão liga o pacote

**[HIPÓTESE, recomendada]** Registro em código + uma coluna no catálogo.

- Migration aditiva: `professions.pacote text not null default 'base' check (pacote in ('base', 'advocacia'))`
  e a linha `('advocacia', 'Advocacia', 'profissional', ...)` no catálogo. Eixos da linha: `onde = 'hibrido'`,
  `cobranca = 'orcamento'`, `inicio = 'solicitacao'`, `ritmo = 'sob_demanda'` **[HIPÓTESE]**: `inicio =
  'solicitacao'` é o que `docs/09-PLATAFORMA.md:415-417` diz sobre advogado ("não deixam desconhecido
  marcar direto"). Vocab das seis chaves: `cliente: cliente`, `atendimento: reunião`, `servico: serviço`,
  `profissional: profissional`, `local: escritório`, `agenda: agenda`.
- `src/core/pacotes/index.ts` exporta `PACOTES: Record<'base' | 'advocacia', Pacote>`, com
  `Pacote = { slug, abas: Aba[], centro: string, modulosProprios: ModuloKey[], vocabularioExtra:
  Record<string, string>, camposDoCliente: Campo[], tiposDeCaso: TipoDeCaso[], modelosDeMensagem:
  Modelo[], identidade: { acento: string } }`. `base` reproduz `ABAS` e `HREF_DO_CENTRO` de hoje
  (`tabs.ts:27-46`) e tudo o mais vazio.
- `src/server/auth/tenant.ts:80` passa a selecionar `professions(vocab, pacote)`; `DadosDoTenant`
  (`tenant.ts:18-44`) ganha `pacote: 'base' | 'advocacia'` com `'base'` quando `professions` vem nulo
  (mesma defesa de `dadosDoTenant`, `tenant.ts:104-117`).
- `TabBar` (`tab-bar.tsx:33`) recebe `abas` e `hrefFab` do pacote em vez de importar `ABAS`. Como
  `tabs.ts` é puro, a função `hrefDaAbaAtiva(pathname, abas)` já aceita lista por parâmetro
  (`tabs.ts:64`).
- Guarda `pacote-tem-registro`: lê os valores do `check` da migration e exige que `PACOTES` tenha
  exatamente esses slugs (mesmo padrão de `modulos-catalogo`, `planos.ts:69-70`). Vista reprovando ao
  remover a entrada `advocacia` do registro.

Por que em código e não só nas colunas `jsonb` de `professions` (`0022:36-38`): menu e campos têm
tipo, rota e componente; `jsonb` sem leitor é a armadilha que a `0022` já deixou e ninguém usou. As
colunas `modulos_padrao`/`campos_ficha`/`mensagens` ficam como estão (sem leitor novo) ou são
preenchidas pelo mesmo registro no seed: **[DECISÃO PENDENTE, minha recomendação é não ler delas no MVP]**.

Por que não um `tenants.pacote` próprio: o pacote é propriedade da profissão escolhida, não do
negócio; um tenant que troca de profissão troca de pacote. Reverter: coluna em `tenants` que sobrepõe.

### 3.3 Módulos do pacote (quarta camada)

Módulos novos no catálogo (`0041:35-51` e `planos.ts:72-92`, as duas listas): `legal_cases`
("Casos"), `legal_checklists` ("Pendências do cliente"), `legal_structure` ("Estrutura da família"),
`legal_deadlines` ("Prazos e intimações"), `legal_documents` ("Documentos do caso"). Todos entram
no degrau `essencial` (`planos.ts:135-152`), que é o degrau de entrada; com `ACESSO_ABERTO` ligado
isso não muda nada para ninguém.

`ContextoDoTenant` (`planos.ts:306-327`) ganha `pacote`. `podeUsarModulo` (`planos.ts:362`) ganha a
camada **pacote antes do eixo**: `CONDICAO_DE_PACOTE: Partial<Record<ModuloKey, readonly string[]>>`
(`legal_*: ['advocacia']`). Módulo fora do pacote devolve um `Veredito` novo, `{ estado:
'fora_do_pacote' }`, que a interface trata como "some, sem oferta" (mesmo tratamento de
`fora_do_eixo`). O `tsc` aponta todos os `switch` sobre `Veredito` que precisam do ramo novo.

`exigirModulo` (`planos.ts:257-278`) é a porta no servidor: toda rota `v1/legal/*` chama
`exigirModulo(db, tenantId, 'legal_cases')` (ou o módulo certo) antes de qualquer leitura. Tenant de
beleza chamando rota jurídica recebe `FORBIDDEN` e nunca enxerga tabela jurídica (que, pela RLS,
estaria vazia para ele de qualquer jeito).

### 3.4 Papéis do escritório sobre o enum atual

`user_role` tem cinco valores (`rbac.ts:5,12-29`). Mapa para Advocacia, com rótulo de interface sem
gênero (guarda `copy-nao-supoe-genero`):

| Enum | Rótulo no pacote | O que alcança (além do que já alcança) |
|---|---|---|
| `owner` | Direção | tudo; único que confirma regras de prazo, muda sigilo para baixo e liga MFA obrigatória |
| `manager` | Direção adjunta | tudo de operação; não exporta base (`rbac.ts:65`), não muda regras de prazo |
| `professional` | Advocacia | casos não sigilosos e os seus (membro); cria prazo fatal; confirma prazo de estágio |
| `reception` | Secretaria | cadastro, agenda, checklist e documentos de casos não sigilosos; não lê estratégia nem cria prazo fatal |
| `finance` | Financeiro | fora do MVP (sem honorários): só lê nome e telefone do cliente |

**Estagiário não vira papel novo.** Mexer no enum `user_role` exige `ALTER TYPE ... ADD VALUE`, que
não pode ser usado na mesma transação (armadilha registrada em `0022:7-9`), e multiplica a matriz
de testes. Vira atributo: `professionals.legal_role text check (legal_role in ('advogado',
'estagio'))`, nulo fora do pacote. Prazo fatal criado por quem tem `legal_role = 'estagio'` nasce sem
`confirmed_by` (LUBI `0020:132-133,152`) e aparece em Hoje como "prazo a confirmar". A RLS lê o
atributo por `professionals` do próprio `auth.uid()`.

**Caso sigiloso**: `legal_cases.sensitivity = 'sigiloso'` restringe a `owner` e a quem está em
`legal_case_members`. Documentos, checklist, prazos e intimações do caso herdam pela função
`legal_can_access_case(case_id)` (porta do LUBI `0013:90`, reescrita com `tenant_id`). Quem não
alcança vê "1 item restrito" (contagem por função `security definer` que devolve só um número, como
`count_restricted` do LUBI, `0024:320`).

**[DECISÃO PENDENTE]** Intimação **sem caso** (ainda não vinculada) é sigilosa? Recomendação: visível
a `owner`, `manager` e `professional`; `reception` não vê o texto, só o aviso "N intimações a triar".
O LUBI deixou a mesma pergunta para o Dr. Miguel (`_progresso.md:244`).

### 3.5 Fluxo de dados da fila Hoje

```mermaid
flowchart LR
  A[cron: GitHub 6x/dia + pg_cron horario] --> B[/api/cron/legal-intimacoes]
  B --> C[enfileira job por tenant x OAB x dia]
  C --> D[handler: consulta DJEN dia a dia, pagina, deduplica por djen_id]
  D --> E[(legal_intimations + legal_intimation_sync)]
  E --> F{numero_processo = legal_cases.cnj_number?}
  F -- sim --> G[status vinculada]
  F -- nao --> H[status nova: item 'triar' na fila]
  G --> I[sugestao de prazo: core/advocacia/prazo-sugestao]
  I --> J{regras confirmadas pelo owner?}
  J -- sim --> K[data pre-preenchida + memoria]
  J -- nao --> L[so a memoria; pessoa digita a data]
  K --> M[pessoa confirma ou corrige]
  L --> M
  M --> N[(legal_deadlines com prova do calculo)]
  N --> O[prazo interno D-N]
  O --> P[Hoje: fila ordenada por prioridade]
  Q[(legal_checklist_items)] --> P
  R[(appointments: reunioes)] --> P
```

- A fila é montada em `src/server/advocacia/fila.ts` a partir de uma view `legal_work_queue` com
  `security_invoker = true` filtrada por `tenant_id` (guarda `view-nao-fura-a-rls`), com o contrato de
  colunas do LUBI (`0024:145-149`: `item_key, source, source_id, client_id, case_id, title,
  owner_kind, owner_professional_id, due_on, raw, sensitivity, link, created_at`). A ordem é a função
  pura `prioridade()` copiada para `src/core/advocacia/prioridade.ts` (`hoje` por argumento, no fuso do
  tenant, nunca `new Date()` escondido).
- Hoje nunca cai por causa da fila: `catch` que loga e mostra "Não consegui carregar a fila. Tentar de
  novo", mesmo padrão de `hoje/page.tsx:43-60` e regra do `CLAUDE.md` sobre `catch` que descarta.
- Onde o job roda: `job_queue` (`job-queue.ts:65-85`) com `dedupeKey = legal.djen:{tenant}:{oab}:{dia}`.
  O cron só **enfileira**; quem processa é `/api/cron/jobs` (já existe em `src/app/api/cron/jobs`). As
  duas redes já existem (`cron.yml:49-54`; `0087:45-73`): a rota nova entra na `matrix` do workflow e
  numa migration irmã da `0087`. Atraso do GitHub em horas (`cron.yml:14,32-38`) é tolerado porque a
  consulta é **por dia** e faz catch-up natural (`djen.server.ts:37-45`; `11` §8.1).
- Heartbeat `legal_intimacoes` em `cron_heartbeats` e checagem nova em `verificarSaude`
  (`health.ts:59-70`) com limiar de 3 h **[HIPÓTESE]** e **reconciliação**: `legal_intimation_sync.ok =
  false` em qualquer dia dos últimos 3 → vermelho "faltam intimações de <data>, confira em
  comunica.pje.jus.br". Regra do LUBI `06` §0 ("saúde de verdade"): processados = 0 com fonte > 0 não é ok.

### 3.6 Offline e PWA

O service worker já recusa cachear `/api`, `/admin` e tudo que exige sessão (`public/sw.js:29`) e
guarda `sw-nao-cacheia-tela-privada`. Documento jurídico sai por URL assinada de curta duração (anexo
02 §3.4) e nunca por rota cacheável. A fila offline de mutações (`src/lib/offline/api-client.ts`) não
recebe escrita jurídica no MVP: criar prazo ou confirmar intimação offline e sincronizar depois é
risco de prazo com data velha. **[HIPÓTESE]**: rotas `v1/legal/*` ficam fora da fila (`apiFetch` com
opção `semFila`), e a tela avisa "sem conexão: não dá para gravar prazo agora". NÃO LI `api-client.ts`
além do cabeçalho (linhas 1-30): confirmar no ticket se existe a opção.

---

## 4. Modelo de dados (resumo; completo no anexo 01)

Prefixo `legal_` em toda tabela nova. Todas com `tenant_id`, `enable` + `force row level security`,
política por `has_tenant(tenant_id)` e, onde o papel importa, função de acesso; linha no seed do
teste de isolamento; `audit_log` nas mutações; `created_at`/`updated_at`; dinheiro em centavos; datas
de prazo em `date` (dia civil do tribunal), carimbos em `timestamptz`.

| Tabela | Papel no produto | Origem |
|---|---|---|
| `legal_persons` | pessoas físicas da conta (titular, cônjuge, herdeiros): nome, vínculo, regime, `document_hash`, nascimento | LUBI `people` (0007, NÃO LI) + `0013:69-83` |
| `legal_entities` | empresas: razão social, `cnpj_hash`, tipo (holding patrimonial/participações/mista/operacional), regime, capital, quotas, `is_external` | `0014:53-82` |
| `legal_corporate_changes` | o ato que fecha e abre participações | `0014:87-104` |
| `legal_ownerships` | participação temporal (`valid_from`/`valid_to`, exclusão GiST sem sobreposição, exatamente um dono, sem ciclo de si) | `0014:109-160` |
| `legal_cases` | caso: tipo, título interno, `client_title` obrigatório, estado, sigilo, responsável, `cnj_number`, `rito`, `prazo_em_dobro`, `comarca` | `0013:11-43`; `0028:17-21` |
| `legal_case_members` | equipe do caso (sigilo) | `0013:58-66` |
| `legal_case_meetings` | vínculo caso ↔ `appointments` (reunião) | novo |
| `legal_checklist_templates` + `_items` | modelos por tipo de caso (plataforma: `tenant_id` nulo; do escritório: com `tenant_id`), versionados | novo (LUBI `11` §4 `workflow_templates`, não implementado) |
| `legal_checklist_items` | "o que falta de você": item, quem deve (pessoa da conta ou equipe), prazo combinado, estado, rodada, escada de lembretes, documento | `0021:85-123` |
| `legal_documents`, `legal_document_versions`, `legal_document_links` | metadados, versão imutável, vínculo a pessoa/empresa/ato/pendência; objeto no bucket privado `legal-docs` | `0023:60-157` |
| `legal_access_log` | trilha append-only de view/download e de abertura de caso sigiloso | `0023:161-177`; padrão `vault_access_log` |
| `legal_intimations`, `legal_intimation_sync` | o que o DJEN publicou; prova de reconciliação por (tenant, OAB, dia) | `0026:37-94` |
| `legal_intimation_suggestions` | sugestão do servidor (vale 15 min); a decisão lê daqui | `0028:109-118` |
| `legal_deadlines`, `legal_deadline_changes`, `legal_deadline_alerts` | prazo blindado, histórico append-only, prova de alerta | `0020:121-190`; `0028:54-73` |
| `legal_holidays` | feriados por tribunal/comarca (plataforma + escritório), com `fonte_url` e `conferido_por` | `0020:74-116`; `0028:24-26`; PM-D-025 |
| `professionals` (+ colunas) | `oab_number`, `oab_uf`, `legal_role` | `0026:12-13` |
| `tenants.settings.advocacia` (jsonb) | `prazo_regras_confirmadas`, `internal_days` (padrão 2), `djen_names`, `mfa_obrigatoria` | `0028:30-33`; `0026:31-32` |
| `tenants.is_demo` | a coluna que `demonstracao.ts:11-16` registra como alvo | novo |
| `terms_acceptances.documento` += `adendo_advocacia` | aceite do adendo do pacote (texto de advogado) | `0095:38` ampliado |
| `message_templates` (seed do pacote) | cobranças de documento sem dado do caso | existente |

Diagrama, colunas, políticas, escritor de cada coluna, índices, retenção e a **ordem das 12
migrations** (`0101` a `0112`, todas aditivas; a única restritiva, revogar `DELETE` de tabelas
jurídicas que já nascem sem política, não precisa esperar deploy porque nenhum código antigo as usa)
estão no anexo 01. Regras herdadas da memória do projeto que o anexo aplica: segunda FK para a mesma
tabela quebra o embed do PostgREST (vínculo por tabela própria, não por duas colunas); view com
`security_invoker`; coluna nova sem escritor é defeito (anexo 01 §4 lista o escritor de cada uma);
migration aditiva antes, restritiva depois.

---

## 5. Decisões de produto que o plano fixa (reversíveis)

| # | Decisão | Motivo | Reverter |
|---|---|---|---|
| D1 | `clients` é a **conta** (família/titular); pessoas em `legal_persons` | o CICLO já tem telefone, hash, opt-out, importação e fila de chamadas em `clients`; a família tem várias pessoas e um telefone de contato | tabela `legal_accounts` à parte |
| D2 | CPF/CNPJ só em **hash** no MVP | conflito de interesses e dedupe funcionam com hash; o dado completo só com cofre e necessidade real | coluna cifrada via `vault.ts` |
| D3 | Reunião = `appointment` + vínculo ao caso | reaproveita agenda, conflito de horário e lembrete | tabela própria de reuniões |
| D4 | Prazo fatal não se adia nem se apaga; mudar data exige motivo e grava histórico | PM-D-006 e `0020:140-152` | nunca (é a regra do produto) |
| D5 | Nenhum envio automático: o sistema prepara, a pessoa envia e confirma | PM-D-016; `CLAUDE.md` (sistema sugere, pessoa decide) | só com WhatsApp oficial e RIPD |
| D6 | Texto de WhatsApp sem nome de bem, assunto, processo ou valor | sigilo e histórico do navegador (LUBI S11) | nunca |
| D7 | Sem honorários, sem "lucro", sem portal, sem site no MVP | escopo da seção 2 do prompt; Doulhe e PM-D-008 | fases seguintes |
| D8 | Hoje do pacote = fila única com 5 fontes (intimação, prazo, pendência do cliente, documento a conferir, reunião) | PM-D-003: uma lista na tela, várias fontes no banco | acrescentar fontes com `create or replace view` (colunas no fim) |
| D9 | Botão central do pacote = **Pendências** (o que falta de cada cliente) | é o diferencial; o centro é o slot que o polegar alcança (`tabs.ts:35-45`) | trocar `centro` no registro |
| D10 | Data de prazo pré-preenchida só com gabarito validado e regra confirmada por `owner` | R16 do LUBI; `prazo-calculo.ts:9-13` | nunca |

---

## 6. Segurança (resumo; modelo de ameaças completo no anexo 02)

### 6.1 As quatro fronteiras

1. **Escritório A × escritório B.** RLS por `tenant_id` em toda tabela, descoberta por introspecção
   (`isolation.test.ts:89-101`); `service_role` só em `with-tenant.ts` (`with-tenant.ts:7-20`, regra
   de lint `ciclo/service-client-confinado`). Teste: as três baterias do `isolation.test.ts`
   (`select`, `update`, `delete`) sobre toda tabela nova, mais `insert` com `tenant_id` alheio.
2. **Papel × recurso dentro do escritório.** Permissão na rota (`rbac.ts:82-86`) **e** política no
   banco (duas camadas, `rbac.ts:7-11`). Teste novo: matriz persona × tabela × operação com
   **conjunto** de linhas esperado (prática do LUBI `matriz.test.ts:1-5`; S13 do `07-seguranca.md`).
3. **Caso sigiloso × quem não é membro.** Função `legal_can_access_case` nas políticas de casos,
   documentos, checklist, prazos e intimações vinculadas; `legal_access_log` em toda abertura.
   Teste: `professional` não membro lê 0 linhas; `owner` lê; a contagem "restritos" devolve só número.
4. **Dado × mundo.** Documento só por URL assinada curta; texto de intimação e estratégia fora do
   `SELECT` de quem não precisa (privilégio por coluna, padrão `0077:56-73`); nada de dado do caso em
   log, Sentry, analytics, cache do SW ou texto de WhatsApp.

### 6.2 O que muda nos pontos de passagem existentes

- `redact.ts:14-58` e `write.ts:24-46` ganham `numero_processo`, `cnj`, `oab`, `texto_sanitizado`,
  `calc_memo`, `strategy`, `estrategia`, `cnpj`, `document_hash`, `instructions`, `client_title`?
  (não: `client_title` é feito para o cliente ver; fica fora). Guarda: teste de comportamento que
  passa um objeto com cada chave e exige `[redigido]` (como o `redigirParaTrilha` exportado para
  teste, `write.ts:48-53`).
- `ROTAS_DE_ESCRITA` (`pausa.ts:26`) ganha toda rota `v1/legal/*` (anexo 03 lista a classificação
  de cada uma); o cron é `fora`.
- `MIGRATIONS_ESPERADAS`/`ULTIMA_MIGRATION` (`versao.ts:23-26`) sobem a cada migration.
- `SLUGS_DE_DEMONSTRACAO` (`demonstracao.ts:56-70`) ganha o escritório-modelo; a mensageria já pula
  demo em `enviarComFallback` (`demonstracao.ts:25-27`).

### 6.3 MFA obrigatória para a equipe do pacote

**[FATO]** O CICLO tem `exigirAal2` por ação (`session.ts:76-81`) e rotas de enroll/verify
(`pausa.ts:41-43`), e nenhuma porta de MFA no `middleware.ts`. **Proposta:** em `contextoDoPainel`
(`tenant.ts:197-202`), quando `tenant.pacote === 'advocacia'` e `settings.advocacia.mfa_obrigatoria`
(padrão `true`) e `sessao.aal !== 'aal2'`, redirecionar para `/admin/config/seguranca` com aviso
"Este escritório exige segundo fator. Ative para continuar." As rotas de API `v1/legal/*` chamam
`exigirAal2()` diretamente (não dependem do redirecionamento de tela). Recuperação: `owner` pode
remover o fator de um membro (`DELETE v1/auth/mfa/factors/[id]`, `pausa.ts:42`) e o membro refaz o
enroll; **[DECISÃO PENDENTE]** se `owner` sem MFA pode desligar a obrigatoriedade (recomendação: não;
a chave só muda com MFA ativa).

### 6.4 Cofre de documentos

Bucket privado `legal-docs` (mesmo padrão do bucket de mídia, `0013_media_bucket.sql`, NÃO LI o
corpo). Caminho `{tenant}/{client}/{document}/{version}`; nome de arquivo nunca com dado pessoal (o
original fica em `legal_document_versions.note`, redigível). Envio: a rota valida MIME por bytes
mágicos e por extensão (lista fechada, `0023:115-119`), tamanho ≤ 50 MB (`0023:120`), grava `sha256`,
entra em `recebido` (quarentena) e só vira `aceito` com conferência. Leitura: só pela RPC
`legal_abrir_documento(id, kind)` que grava `legal_access_log` e devolve URL assinada de 60 s
**[HIPÓTESE sobre o TTL]**, com `Content-Disposition: attachment` para PDF e imagens que não sejam
miniatura. Antivírus: não há no Supabase; mitigação por tipo, tamanho, sem execução no servidor, sem
renderização inline de desconhecido; ClamAV em Edge Function fica como P2 **[DECISÃO PENDENTE: custo]**.

### 6.5 O gabarito e o repositório público

O repositório do CICLO é público. O gabarito de 50 intimações, mesmo anonimizado, pode carregar
texto de decisão judicial identificável. **Regra:** o gabarito **não** entra no repositório; fica num
caminho privado (variável `LEGAL_GABARITO_PATH` no CI, como segredo, ou fixture fora do repo). O
teste `tests/unit/legal/prazo-gabarito.test.ts` tem dois modos: com o arquivo, exige 100% de
concordância em cada rito; **sem o arquivo, exige que nenhuma regra de rito esteja `validada: true`**
(a trava do LUBI, `prazo-gabarito.json` observação). Nenhum dos dois modos pula: os dois afirmam algo.

### 6.6 Critério "pode entrar dado real"

Lista no anexo 02 §7. Enquanto não estiver 100% verde, o único tenant do pacote em produção é o
escritório-modelo com `is_demo = true`, e o cadastro de uma conta Advocacia real fica atrás de uma
chave `ADVOCACIA_ABERTA` (mesmo desenho de `ACESSO_ABERTO`, `acesso-aberto.ts`) desligada.

---

## 7. Interface e experiência (resumo; telas, wireframes e as 40 frases no anexo 04)

**Princípio.** Quem abre o app quer saber **o que fazer agora** e **o que está parado e com quem**.
Densidade alta, ruído zero, tom sóbrio. O CICLO já abandonou a "cara de app gerado" (preto quente,
acento como luz, sem gradiente: `docs/08-REDESIGN-E-IDENTIDADE.md` II.3) e é a base certa; o pacote
só troca o acento e o vocabulário.

**Menu do pacote (5 slots, `tabs.ts:17-22`):** Hoje · Casos · **[Pendências]** · Agenda · Clientes.
Configurações continua a um toque de Hoje (`Topbar`, NÃO LI). "Casos" entra no lugar de "Marcar";
marcar reunião continua a um toque em Agenda e em Hoje.

**Telas:** Hoje (fila com prazo fatal no topo, D-2 úteis, intimações a triar, pendências vencidas,
reuniões do dia; filtro Meus · Exige direção · Equipe; uma ação primária por linha), Clientes
(lista com fase, responsável, próximo item, selo de sigilo e "tem holding"), Cliente 360 (topo fixo
com "Próximo passo: <item>, de <quem>, até <data>"; seções Resumo · Pendências · Casos · Pessoas e
empresas · Documentos · Linha do tempo), Caso (prazos, pendências, documentos, equipe, estratégia só
equipe), Estrutura da família (grafo com zoom e arraste no desktop, lista indentada no celular e
para leitor de tela, participação efetiva por pessoa, inconsistência marcada, simulador "e se" sem
gravar), Configurações do pacote (OAB da equipe, regras de prazo confirmadas, feriados da comarca,
modelos de checklist, MFA obrigatória).

**Estados obrigatórios em toda tela:** esqueleto (nunca branco), vazio que ensina o próximo passo e
nunca é tela morta ("Tudo em dia. Próximo prazo: 24/10, Inventário (exemplo)."), erro que diz o que
fazer e loga, offline (leitura ok, escrita jurídica avisa), conflito de edição (`row_version`),
sessão expirada sem perder o digitado (guarda `formulario-nao-apaga-o-que-foi-digitado`).

**Acessibilidade e toque:** alvos de 48 px (guardas `alvo-de-toque-tem-48` e `-tem-largura`;
cuidado com `toque-48` em dois links na mesma linha, `CLAUDE.md`), foco visível, região `aria-live`
que vive sempre no DOM para filtro e troca de dia, contraste AA (guarda `contraste`), `prefers-reduced-motion`.

**Copy:** sem travessão e sem gênero presumido (guardas `copy-sem-travessao`, `copy-nao-supoe-genero`);
proibidas: "especialista", "garantimos", promessa de resultado, "o sistema calculou o prazo" (o certo
é "sugestão a confirmar"). Rótulos de papel sem gênero (§3.4). As 40 frases principais estão no anexo 04 §6.

**Verificação visual:** varredura de telas × larguras (390, 768, 1280) no navegador, nos dois temas,
com `elementFromPoint` para alvo de toque, antes de qualquer apresentação (protocolo em
`C:\Users\Usuario\.claude\code\DESIGN-E-INTERFACE.md` §15, segundo a memória `design-interface-protocolo`).

---

## 8. Portabilidade do LUBI para o CICLO

| Módulo | Origem | Lógica pura (copiar com teste) | UI (reescrever em Next.js) | Depende de instalação única (reescrever com `tenant_id`) | Ordem para manter o CICLO verde |
|---|---|---|---|---|---|
| Prioridade | `prioridade.ts` | tudo (`ordenarFila`, `compararFila`, pesos) | lista de Hoje | nada | Fase 4, antes da view |
| Estrutura societária | `ownership.ts`; `0014` | `effectiveOwnership`, `validateOwnership` | grafo, lista, simulador | DDL inteira; `apply_corporate_change` INVOKER | Fase 3 |
| Prazo | `prazo-calculo.ts`, `prazo-sugestao.ts`, `prazo-leitura.ts`; `0020`, `0028`, `0029` | cálculo, leitura, memória, regras com `validada` | confirmação da intimação, ficha do prazo | DDL; regras confirmadas em `tenants.settings` | Fase 4, com o gabarito fora do repo |
| DJEN | `djen.server.ts`, `motores/intimacoes.ts`; `0026`, `0027` | normalização, alvos, dedupe | triagem na fila | DDL; alvo (tenant, OAB); job na `job_queue` | Fase 4 |
| Checklist | `0021` (`client_actions`) | regras de estado e rodada | Cliente 360, Caso, Pendências | DDL; modelos por tipo (novo) | Fase 2 |
| Documentos | `0023` | validação de MIME/tamanho | Documentos do caso | DDL; bucket; RPC de abertura | Fase 2 (metadados) e 5 (polimento) |
| Casos | `0013` | máquina de estados | Casos e ficha | DDL; sigilo por `legal_case_members` | Fase 2 |

Armadilhas já pagas (memória `lubi-armadilhas-de-execucao`) e como o plano as evita: script Python
que trunca arquivo (toda escrita grande pela ferramenta `Write`, nunca `open(p,'w')` com transformação
dentro); `\b` em regex vira backspace (regex PT-BR com `\p{L}` e flag `u`, escrita por `Edit`/`Write`;
guarda `sem-byte-de-controle-no-codigo` existe no CICLO); GUC nulo em comparação (`coalesce` dos dois
lados e `current_user`); mutação com tabela auxiliar fora de `public`; `service_role` só em
`with-tenant.ts` (regra de lint já existe no CICLO); tabela nova que referencia outra quebra o
`truncate` do harness (truncar juntas); `git add` por nome.

Como manter as duas bases: **cópia versionada** com cabeçalho `// Origem: LUBI <caminho> @ <commit>`
e teste próprio no CICLO (PM-D-005 do LUBI, pelo mesmo motivo: stacks diferentes). O LUBI continua
como está; se o pacote vingar, o LUBI vira um tenant do CICLO e a instalação única é desligada
**[DECISÃO PENDENTE, do Eduardo e do Dr. Miguel]**.

---

## 9. Fases e ponto de parada (backlog ticket a ticket no anexo 03)

Cada fase termina com o produto de beleza igual ao de antes, `pnpm verify` verde, e uma demo
possível com dado fictício.

| Fase | Entrega demonstrável | Ainda é só fictício | Ordem de grandeza **[HIPÓTESE, uma sessão por vez]** |
|---|---|---|---|
| 0 Alicerce | profissão Advocacia no cadastro; menu, centro e vocabulário do pacote; módulos `legal_*` fora do pacote somem; MFA obrigatória; adendo de aceite (texto placeholder `precisa_revisao`) | tudo | 1 semana |
| 1 Dados e segurança | 12 migrations locais; RLS; isolamento; matriz por papel; cofre; trilha; redação; `is_demo` | tudo | 2 semanas |
| 2 Cliente 360 + Caso + Checklist | criar caso por tipo com checklist gerado do modelo; cobrar documento com mensagem pronta; receber e conferir | escritório-modelo | 2 semanas |
| 3 Estrutura da família | pessoas, empresas, participações temporais, participação efetiva, inconsistência, simulador | escritório-modelo | 1 a 2 semanas |
| 4 Hoje | captura DJEN (com stub nos testes), triagem, sugestão com memória e trava, prazo interno, fila ordenada, health | escritório-modelo (captura real só com OAB cadastrada em conta real) | 2 a 3 semanas |
| 5 Polimento | mensagem pronta em todo item, varredura visual e de acessibilidade, estados, atalhos | | 1 a 2 semanas |
| 5b Amostra (paralela desde a Fase 2) | gerador do escritório-modelo, modo demonstração seguro, roteiro e kit | | 1 semana espalhada |
| 6 Verificação final | 15 gates, dossiê para o advogado, checklist "pode entrar dado real", `ADVOCACIA_ABERTA` pronta para ligar | | 1 semana |

**Menor recorte que já permite uma demo com valor:** Fases 0, 1 (só as tabelas das fases 2 e 3) e 2,
mais o gerador da amostra. Em torno de **5 semanas [HIPÓTESE]**: um advogado vê Cliente 360 com "o
que falta de você", cobra um documento com um toque e vê o documento chegar. Sem DJEN ainda.

**Primeiro ticket que prova que o pacote liga e desliga sem afetar beleza:** T0.1 (anexo 03): a
linha `advocacia` no catálogo, a coluna `pacote`, o registro `PACOTES`, `DadosDoTenant.pacote`, e o
teste que fixa, por snapshot, que todo tenant com `pacote = 'base'` recebe exatamente `ABAS` e
`HREF_DO_CENTRO` de hoje, e que o tenant `advocacia` recebe os seus. Mutação: trocar `'base'` por
`'advocacia'` no padrão da coluna faz o snapshot de beleza reprovar.

---

## 10. Perguntas do prompt, respondidas

1. **Semanas por fase e menor recorte**: tabela da §9. Total em torno de 10 a 13 semanas de uma sessão
   por vez **[HIPÓTESE]**; menor recorte com valor em 5.
2. **Primeiro ticket**: T0.1 (§9).
3. **Cópia segura × reescrita**: §8. Maior risco de regressão: a quarta camada em `podeUsarModulo`
   (`planos.ts:362`) e a mudança do `select` em `tenant.ts:80`, porque tocam todo tenant. Mitigação:
   snapshot do veredito de todos os módulos para um tenant de beleza antes e depois (T0.2) e
   snapshot de `DadosDoTenant` (T0.1).
4. **Transição sem digitar tudo de novo**: importação de clientes por planilha já existe
   (`POST v1/clients/import/preview` e `/import`, `pausa.ts:62-63`; `docs/97` §5 define as estações). O
   pacote acrescenta duas colunas reconhecidas ("tipo de caso", "pessoas da família") e um modelo de
   planilha para baixar; o checklist nasce do modelo do tipo de caso, não da planilha. Migração
   sempre gratuita (decisão de `docs/83`, mantida em `docs/99` v3). Importar documentos em lote fica
   fora do MVP (upload um a um pela ficha).
5. **Primeiro minuto, primeiro dia, por que volta amanhã**: no primeiro minuto a pessoa vê o
   escritório-modelo ou cria o primeiro caso a partir de um modelo e o checklist aparece pronto; no
   primeiro dia cadastra a OAB e vê a captura começar (ou o aviso de que a OAB falta); volta amanhã
   porque a intimação de hoje já está em Hoje com o prazo interno, e a cobrança de documento está
   pronta para enviar. Medida: aberturas por dia útil por pessoa (anexo 05 §6).
6. **Métrica única de sucesso e critério de morte**: sucesso em 4 semanas com 1 escritório real =
   **abre sem ninguém pedir em ≥ 4 de 5 dias úteis** e **≥ 70% das intimações triadas no mesmo dia
   útil** **[HIPÓTESE sobre os números]**; morte = em 30 dias nenhum escritório aceita usar com dado
   real ou se comprometer com preço por escrito (§11).
7. **Se a dor for outra**: §13.

---

## 11. Validação com o mercado (anexo 06 traz o roteiro de demo e o kit)

**O que mostrar na demo:** o escritório-modelo, nos 8 cenários do anexo 06 §3, em 5 a 7 minutos, sem
dado real, com a faixa "dados fictícios" visível. **O que não mostrar:** site, portal, honorários, IA,
qualquer número de ganho fixo. **Perguntas que fecham:** "qual item você usaria amanhã?", "o que faria
você não usar?", "quanto pagaria por mês para o escritório inteiro?", "quem mais precisa disso?".

**Medir uso real em 4 semanas com 1 escritório:** eventos de produto já existem (`registrarEvento`,
`onboarding.ts:225-237`): aberturas por pessoa e dia, intimações triadas no dia, pendências criadas e
concluídas, mediana pedido → recebimento, prazos com data confirmada × corrigida (divergência sobre
todas). Nada disso leva conteúdo do caso.

**Experimento de preço.** Venda anterior: R$ 2.500 de implantação + R$ 200/mês, "acharam barato"
(relato do Eduardo). Hipótese a testar sem queimar relação: oferecer **duas** opções ao próximo
escritório, (a) implantação R$ 4.900 + R$ 390/mês e (b) sem implantação + R$ 690/mês por 12 meses,
e observar qual escolhem e onde hesitam **[HIPÓTESE: valores só para ancorar; o Eduardo decide]**.
Para quem já comprou a R$ 2.500/200, o preço não muda; a condição de "fundador" é dita por escrito.
Sinal forte é pagar, não dizer "barato"; sinal fraco é "interessante".

**Como as entrevistas reordenam o backlog:** §13.

---

## 12. Riscos, premissas e perguntas em aberto

| ID | Risco | Prob. | Impacto | Sinal de alerta | Mitigação |
|---|---|---|---|---|---|
| R1 | Data de prazo errada apresentada como certa | M | A | correção após confirmação (`calc_divergence`) | regra `validada: false` até gabarito 100%; confirmação humana; prazo interno D-2; teste que exige trava sem gabarito (§6.5) |
| R2 | Vazamento entre escritórios por tabela nova sem política ou sem linha no seed | M | A | `isolation.test.ts` reprova | toda migration com RLS na mesma transação; linha em `restantes`; matriz por papel |
| R3 | Vazamento entre papéis (secretaria lendo estratégia ou texto sigiloso) | M | A | matriz reprova | privilégio por coluna; `legal_can_access_case`; mutação da política (anexo 05 §4) |
| R4 | Dado do caso em log, Sentry ou trilha | M | M | teste de redação reprova | listas de redação ampliadas e testadas por comportamento |
| R5 | Captura do DJEN para em silêncio (GitHub atrasa horas; pg_cron inerte sem segredo no Vault) | A | A | health vermelho; `intimation_sync.ok = false` | duas redes; consulta por dia com catch-up; reconciliação; limiar 3 h; monitor externo |
| R6 | Pesos da prioridade errados, pessoa ignora Hoje | M | A | % concluído na ordem mostrada cai | `motivo` visível; `PRIORIDADE_V1` versionado; ajuste com o primeiro escritório |
| R7 | Portar o LUBI quebra o CICLO de beleza | M | A | snapshots de T0.1/T0.2 reprovam | pacote `base` idêntico ao de hoje; toda fase termina verde |
| R8 | Repositório público expõe texto jurídico (gabarito, seed) | M | A | revisão de PR | gabarito fora do repo; seed 100% fictício com teste de sanidade |
| R9 | Demo misturada com escritório real | B | A | `is_demo` em tenant com dado real | guarda no servidor e no banco; `ADVOCACIA_ABERTA` desligada |
| R10 | A tese não se confirma | M | A | ninguém paga nem compromete | critério de morte (§10.6); entrevistas antes da Fase 2 |
| R11 | MFA obrigatória trava a equipe no primeiro dia | M | M | ninguém entra | enroll guiado no primeiro acesso; `owner` remove fator |
| R12 | Texto legal (adendo, política) sem revisão de advogado | A | M | `precisa_revisao` no ar | dossiê do PR #144; chave `ADVOCACIA_ABERTA` desligada até revisão |
| R13 | PRs #143/#144 não mergeados mudam a base | M | M | conflito no rebase | branch nasce de `feat/cortesia-2026-10-03`; rebase ao mergear; `POST v1/legal/accept` já precisa de `'permite'` em `pausa.ts` |
| R14 | Suíte de banco intermitente (rate limit) | A | B | falhas que mudam de arquivo | `--no-file-parallelism` (memória `suite-de-banco-intermitente-por-rate-limit`) |

**Depende de quem:** Eduardo (lista da §16); Dr. Miguel (gabarito de 50; regras cível/trabalhista/JEC/
penal/recesso; OAB/UF da equipe; feriados de Maravilha); Dra. Katiane (entrevista; o que não resolve
hoje); advogado revisor externo (adendo, privacidade, Provimento 205/2021).

---

## 13. Onde as entrevistas mudam o escopo

| Se a dor central for | O que sobe | O que desce | Fase que muda |
|---|---|---|---|
| documento e acompanhamento ("corremos atrás do cliente") | Fase 2 inteira, escada de lembretes, modelos por tipo | DJEN vira Fase 5 | ordem 2 → 3 → 5 → 4 |
| prazo e intimação | Fase 4 sobe para depois da 1; `Exige direção`; feriados por comarca | Estrutura vira P2 | ordem 1 → 4 → 2 → 3; **reavaliar a tese**: Astrea e Projuris já fazem isso (`11` §0) |
| comunicação com o cliente ("em que pé está?") | `client_title`, `client_status_note`, mensagem pronta de andamento; antecipar portal (fora do MVP hoje) | Estrutura | nova fase 2b |
| estrutura societária e tributária | Fase 3 vira 2; simulador; módulo de conteúdo da reforma `precisa_revisao` | DJEN | ordem 1 → 3 → 2 |
| ninguém paga | encerrar antes da Fase 2 | tudo | registrar evidência em `docs/DECISOES.md` |

---

## 14. Plano de testes (resumo; anexo 05)

Unitário em `src/core/advocacia/*` (prioridade, ownership, prazo, leitura, estados); integração em
`tests/integration/legal-*.test.ts` com banco local, sem paralelismo de arquivos; RLS por
introspecção + matriz persona × tabela com conjunto esperado + mutação de política em banco
descartável; guardas de código (pacote, rotas na pausa, catálogo de módulos, redação, demo, versão de
schema); calendário e fuso (dias 29 a 31, mudança de horário, feriado por comarca, `TZ=UTC` e
`America/Sao_Paulo`); navegador para tudo que a pessoa vê; seed do escritório-modelo com teste de
sanidade do agregado; gabarito em dois modos (§6.5). Todo teste-guarda novo é visto reprovando antes
do commit (procedimento do `CLAUDE.md`: commitar antes de mutar, confirmar a mutação, guarda que grita).

---

## 15. Operação e observabilidade

- Logs estruturados sem dado do caso (lista de redação ampliada); `request_id` em toda trilha.
- Métricas de produto por `product_events` (sem conteúdo): `legal.hoje_aberto`, `legal.intimacao_triada`,
  `legal.pendencia_criada`, `legal.pendencia_recebida`, `legal.prazo_confirmado`, `legal.prazo_corrigido`.
- Health: checagem `legalIntimacoes` (heartbeat + reconciliação), `legalFila` (view responde),
  `legalMfa` (tenant do pacote com membro sem fator há > 7 dias → amarelo).
- Alertas: captura parada > 3 h; `intimation_sync.ok = false`; fila `job_queue` com `legal.djen.*`
  parado > 15 min (já coberto por `checarFila`, `health.ts:61`); erro de MFA repetido.
- "Verde não é prova": o cron de captura responde `200` com `{ enfileirados, processados, dias_ok,
  dias_falhos }` e o health compara `processados` com `fonte_pendente` (regra do LUBI `06` §0).

---

## 16. Decisões que só o Eduardo toma (recomendação e custo)

1. **Aplicar as migrations `0101`-`0112` em produção e quando.** Recomendação: só depois da Fase 6 e
   com `ADVOCACIA_ABERTA` desligada; antes disso o pacote existe só no local. Custo de esperar: nenhum.
2. **Mergear #143 e #144 antes ou depois.** Recomendação: antes, para a branch nascer da `main` e o
   aceite legal (`aceite.ts`) existir. Custo de depois: um rebase e a linha de `pausa.ts`.
3. **Mesmo projeto Supabase para advocacia e beleza, ou projeto separado por bloco.** Recomendação:
   **mesmo projeto no MVP** (1 escritório; o isolamento é o mesmo que já protege dado de saúde) e
   decidir bloco separado quando houver 10 escritórios ou um que exija. Custo de separar agora: duas
   infra, dois deploys, duas vigias; custo de não separar depois: migração de dados sob sigilo.
4. **Preço e cobrança do pacote.** §11.
5. **Revisão jurídica externa** do adendo, da privacidade e da publicidade (Provimento 205/2021).
   Sem ela, `ADVOCACIA_ABERTA` não liga.
6. **Quando liberar dado real.** Só com o checklist do anexo 02 §7 inteiro.
7. **Quem confirma as regras de prazo e o prazo do gabarito** (Dr. Miguel).
8. **Contas pagas**: Supabase Pro (bucket e backup PITR), domínio/e-mail transacional (fora do MVP),
   ClamAV (P2).
9. **O LUBI vira tenant do CICLO ou segue como instalação única** (§8).
10. **Intimação sem caso é sigilosa para a secretaria?** (§3.4).

---

## 17. Autoauditoria (seção 6 do prompt)

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Tabela sem RLS, sem política ou sem teste de isolamento? | Não: anexo 01 §3 lista política e linha de seed para cada uma; `legal_access_log`, `legal_deadline_changes`, `legal_deadline_alerts`, `legal_intimation_sync` nascem **sem política** de propósito (só servidor), e por isso entram em `NEGADAS_POR_DESIGN` (`isolation.test.ts:30`) com a conferência das linhas 515-533. |
| 2 | Rota de escrita fora de `ROTAS_DE_ESCRITA`? | Não: anexo 03 §1 classifica as 19 rotas novas; a guarda `pausa-por-rota` reprova se faltar. |
| 3 | Coluna sem escritor? | Anexo 01 §4 nomeia o escritor; duas colunas ficaram **sem escritor no MVP** e foram **removidas** do modelo: `legal_cases.client_next_step` (portal fora) e `legal_documents.visibility` (sem portal, só `interno`). |
| 4 | Dado do caso em log, Sentry, analytics ou cache? | Listas de redação ampliadas (anexo 02 §4); eventos de produto sem conteúdo (§15); SW já nega `/admin` e `/api`. Ponto que **não consegui fechar**: `console.error` com `erro` cru em `writeAudit` (`write.ts:117-126`) pode carregar mensagem do Postgres com valor de coluna; anexo 02 §4 propõe redigir a mensagem antes. |
| 5 | Prazo certo sem gabarito e confirmação? | Não: D10, §6.5, `prazo-calculo.ts:9-13`. |
| 6 | Ticket que depende de outro posterior? | Conferido no anexo 03 §3 (grafo de dependências); a amostra 5b depende só de 2. |
| 7 | Ticket que piora beleza se parar ali? | T0.2 (quarta camada) é o único que toca todo tenant; o snapshot de vereditos é critério de aceite dele. |
| 8 | Promessa de canal sem rota agendada e credencial? | Não: nenhum envio automático (D5); copy diz "copiar e enviar", nunca "vai receber". |
| 9 | Travessão ou gênero presumido na copy? | Anexo 04 §6 foi escrito sem travessão e com rótulos sem gênero; as guardas existentes conferem. |
| 10 | [FATO] que não li? | Marquei NÃO LI em: `kek.ts` (corpo), `0009_job_queue_claim.sql`, `0013_media_bucket.sql`, `0001` bloco de `appointments`, `Topbar`, `api-client.ts` além do cabeçalho, `0029_prazo_interno.sql` (corpo), `prazo-leitura.ts`, `0007_pessoas.sql` do LUBI, `docs/03-DESIGN-SYSTEM.md` (só títulos). Nenhuma afirmação sobre esses arquivos está rotulada como fato. |
| 11 | Ticket constrói do zero o que já existe? | Não achei: cada ticket do anexo 03 cita a peça de origem; os seis itens realmente novos estão em §2.3. |
| 12 | Amostra com dado real, ganho inventado ou promessa proibida? Agregado com sanidade? | Anexo 06: nomes fictícios; números de ganho só com premissa editável; teste de sanidade do agregado (§2.4). |
| 13 | É possível misturar demo com real? Onde a guarda impede? | `tenants.is_demo` + lista de slugs + recusa no servidor de converter demo em real e de criar conta Advocacia real com `ADVOCACIA_ABERTA` desligada; testes no anexo 06 §4. |
| 14 | A demo impacta em 2 minutos? | O roteiro curto (anexo 06 §5.2) abre em Hoje com a intimação que teria sido perdida e vai direto à Estrutura. Não medi com ninguém: é a primeira coisa a medir nas entrevistas. |

---

## 18. Primeiros 10 passos amanhã

1. Confirmar com o Eduardo a decisão 2 (merge de #143/#144) e criar a branch `feat/advocacia-mvp` a
   partir de `feat/cortesia-2026-10-03` (ou da `main` após o merge).
2. T0.1: migration `0101_pacote_advocacia.sql` (coluna `pacote`, linha `advocacia`), `src/core/pacotes/`,
   `DadosDoTenant.pacote`, snapshot de beleza. Bump de `versao.ts`. Ver o snapshot reprovar com a mutação.
3. T0.2: quarta camada em `podeUsarModulo`, módulos `legal_*` nas duas listas, `fora_do_pacote`,
   snapshot de vereditos de um tenant de beleza antes/depois.
4. T0.3: `TabBar` e `HREF_DO_CENTRO` pelo pacote; rotas placeholder de Casos e Pendências com `loading.tsx`.
5. T0.4: porta de MFA em `contextoDoPainel` para o pacote; teste de integração com sessão `aal1`.
6. T1.1: `0103_legal_pessoas_e_estrutura.sql` com RLS, seed em `isolation.test.ts`, matriz inicial.
7. T1.2: `0104_legal_casos.sql` com sigilo e `legal_can_access_case`; mutação da política em banco clonado.
8. Rodar `pnpm verify` completo em segundo plano e, em paralelo, escrever o gerador mínimo do
   escritório-modelo (só pessoas e empresas) para a Fase 3 ter dado.
9. Mandar ao Dr. Miguel, por escrito, o pedido do gabarito de 50 e das OABs da equipe (texto no anexo 06 §7).
10. Registrar em `docs/DECISOES.md` as decisões D1-D10 desta seção 5 e a entrada do pacote.

---

## 19. Achados fora do escopo (não corrigidos aqui)

- `professions.modulos_padrao`, `campos_ficha` e `mensagens` (`0022:36-38`) sem leitor desde a criação.
- `console.error(..., erro)` em `write.ts:117-126` e `onboarding.ts:214-217` pode levar mensagem crua
  do Postgres ao log; não é dado de saúde hoje, mas vira risco com texto jurídico.
- Não há porta de MFA para o painel (só por ação), mesmo com "MFA para owner" no briefing
  (`docs/00-BRIEFING.md:65`).
- `src/core/legal/` só tem `versoes.ts` nesta branch; o aceite (`aceite.ts`) está em outro PR, e a
  pasta `legal` vai dividir nome com o pacote jurídico: recomendo `src/core/advocacia/` para o pacote,
  para não confundir "legal" (termos de uso) com "jurídico" (produto). Os anexos usam `advocacia/`.
