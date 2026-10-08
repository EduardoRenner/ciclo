# 101 · Anexo 02 · Segurança: modelo de ameaças, controles e provas

> Para cada ameaça: o controle, onde ele mora, o teste que prova, e como o teste é visto reprovando
> (mutação) antes do commit. Regra do `CLAUDE.md`: guarda que nunca foi vista reprovando é guarda
> que ninguém sabe se funciona.

## 1. Fronteiras e atores

Atores: escritório A e B (tenants), papéis `owner`/`manager`/`professional`/`reception`/`finance`
(`rbac.ts:12-29`), membro de caso sigiloso × não membro, pessoa com `legal_role = 'estagio'`, visitante
anônimo, ex-integrante com sessão viva, operador do CICLO, serviço externo (DJEN), navegador compartilhado.

## 2. Modelo de ameaças (STRIDE)

| # | Ameaça | Cat. | Controle | Onde | Teste que prova | Mutação a ver reprovar |
|---|---|---|---|---|---|---|
| A1 | Escritório B lê/altera dado do A por PostgREST | I/T | RLS forçada por `tenant_id` em toda tabela; `service_role` confinado | migrations `0103`-`0108`; `with-tenant.ts:7-20`; lint `ciclo/service-client-confinado` | `tests/rls/isolation.test.ts` (introspecção, `:89-101`; select/update/delete `:536-569`; insert alheio `:571-606`) | comentar `enable row level security` de uma tabela nova → "nenhuma tabela sem RLS" reprova; comentar a política → "sem política fora das listas" reprova |
| A2 | `service_role` em rota de usuário | E | chave só em `with-tenant.ts`; `withTenant` exige uuid | `with-tenant.ts:12-20,43-49` | lint existente; `service-role-nao-escapa-por-colchete.test.ts` | importar `createServiceClient` em `src/server/advocacia/*` → lint reprova |
| A3 | Secretaria lê estratégia, texto de intimação sigilosa ou documento sigiloso | I | duas camadas: permissão na rota (`exigirPermissao`) + `legal_can_access_case` na política; **privilégio por coluna** para `texto_sanitizado`/`destinatarios` | `rbac.ts:82-86`; `0104`; `0107` (padrão `0077:56-73`) | matriz persona × tabela × operação com **conjunto esperado** (anexo 05 §3); teste "reception lê 0 colunas sensíveis" | trocar `legal_can_access_case` por `true` → matriz reprova; `grant select (texto_sanitizado)` → teste de coluna reprova |
| A4 | Não membro abre caso sigiloso pela ficha (URL adivinhada) | I | RLS devolve 0 linhas → `NOT_FOUND`; contagem "restritos" só por função que devolve número | `0104`; `legal_count_restricted()` (padrão `0024:320`) | integração: `professional` não membro recebe 404 em `/admin/casos/[id]`; função devolve inteiro e nenhuma coluna | remover filtro de membro → 200 indevido |
| A5 | Estagiário cria prazo fatal com data errada que ninguém confere | T | fatal de `legal_role = 'estagio'` nasce sem `confirmed_by`; Hoje mostra "prazo a confirmar" para direção | gatilho em `0108` (`0020:132-133,152`) | integração: insert por estagiário → `confirmed_by is null` e item na fila do `owner` | gatilho removido → prazo nasce confirmado → teste reprova |
| A6 | Documento exposto por URL pública ou cache | I | bucket privado; leitura só por RPC que grava `legal_access_log` e devolve URL assinada curta; SW nega `/api` e `/admin`; `Cache-Control: no-store` | `0106`; `public/sw.js:29`; `middleware.ts` (NÃO LI o header) | integração: `GET` direto no objeto sem assinatura → 400/403; RPC grava linha; `sw-nao-cacheia-tela-privada.test.ts` | política de `storage.objects` aberta → `GET` direto devolve 200 → reprova |
| A7 | Dado do caso em log, Sentry, trilha de auditoria | I | listas de redação ampliadas; `before/after` redigidos; `console.error` com mensagem redigida | `redact.ts:14-58`; `write.ts:24-63`; novo `redigirMensagemDeErro` | unitário por **comportamento**: objeto com cada chave jurídica → `[redigido]`; texto com CNJ de 20 dígitos → redigido (padrão novo `PADRAO_CNJ`) | tirar `numero_processo` da lista → teste reprova |
| A8 | XSS via texto da intimação (HTML do DJEN) ou nome de arquivo | T | sanitização HTML → texto no domínio (`motores/intimacoes.ts`, "texto sem HTML"); React escapa; CSP com nonce (`layout.tsx:27-35`); nome de arquivo nunca ecoado cru | `src/core/advocacia/intimacoes.ts`; `guarda csp-nonce-exige-rota-dinamica` | unitário: `texto` com `<script>` vira texto puro; snapshot de CSP | remover sanitização → teste reprova |
| A9 | CSRF/replay em rota de escrita | T/R | sessão em cookie `httponly` (guarda `cookie-de-sessao-e-httponly`); `Idempotency-Key` em toda escrita (guarda `escrita-passa-por-idempotencia`); `writeAudit` dentro do fechamento idempotente (`writeaudit-dentro-do-idempotente-ast`) | `src/server/http/idempotency.ts`; rotas `v1/legal/*` | guardas existentes cobrem rotas novas automaticamente; integração: mesma chave duas vezes → uma linha | rota sem `comIdempotencia` → guarda reprova |
| A10 | Injeção SQL/JSON | T | PostgREST parametrizado; Zod `.strict()` na borda; `p jsonb` das RPCs validado dentro (`nomes_validos`, `0026:15-27`) | rotas; RPCs | unitário de schema (rejeita campo extra); integração com payload malformado → 400 | afrouxar `.strict()` → teste de campo extra reprova |
| A11 | Abuso da captura DJEN (SSRF, loop, custo) | D | URL base fixa; `redirect: "error"`; timeout 15 s; teto de 20 páginas; consulta por dia; job com `dedupeKey` e backoff | `djen.server.ts:3-5,45-50,76`; `job-queue.ts:49-85` | unitário com `fetchImpl` falso: 3 páginas repetidas param; `redirect` → `DjenErro`; integração: enfileirar duas vezes → 1 job | tirar `redirect: "error"` → teste reprova |
| A12 | Alguém cadastra OAB alheia para receber intimações de outro advogado | I | OAB é **dado público** (DJEN responde sem login, `11` §0), mas o produto só captura OAB de **membro ativo** do tenant com `legal_role = 'advogado'`; aviso ao `owner` quando uma OAB entra; **[DECISÃO PENDENTE]** exigir confirmação do `owner` para OAB nova | `src/core/advocacia/alvos.ts` (`alvosDaCaptura`, `intimacoes.ts:36-60`) | unitário: membro inativo não gera alvo; integração: OAB em `professionals` de outro tenant não é consultada neste | remover filtro `active` → teste reprova |
| A13 | Conta comprometida (senha vazada) | S | MFA obrigatória para o pacote; rate limit de login existente (`0035_rate_limit_compartilhado.sql`, NÃO LI); sessão `aal2` para `v1/legal/*` | `tenant.ts:197-202` (porta nova); `session.ts:76-81` | integração: sessão `aal1` em `/admin/hoje` de tenant advocacia → redireciona; `POST v1/legal/cases` com `aal1` → `MFA_REQUIRED` | remover `exigirAal2` da rota → teste reprova |
| A14 | Ex-integrante com sessão viva | S/E | membership revalidada **em toda requisição** (`tenant.ts:67-85,134-137`) | existente | integração existente (`memberships-write-policy.test.ts`) + caso novo: desativar membership → próxima requisição `TENANT_MISMATCH` | cachear além da requisição → reprova |
| A15 | Backup sem teste de restauração | D | Supabase PITR (plano Pro, **[DECISÃO PENDENTE]**); exercício trimestral de restauração em projeto descartável; `pg_dump` cifrado mensal fora da Supabase | runbook `docs/runbooks/` (NÃO LI a pasta) | checklist operacional (não automatizável no CI) | n/a |
| A16 | Ambiente de teste com dado real | I | `.env.local` aponta para local; `db:reset` bloqueado em produção (`CLAUDE.md`); `so-banco-local` (memória `teste-de-integracao-aponta-producao`) | scripts | guarda `verify-sobrevive-ao-banco-local.test.ts` | apontar URL remota → trava |
| A17 | Demo misturada com escritório real | T | `tenants.is_demo`; lista de slugs; `enviarComFallback` pula demo; conversão demo→real recusada no servidor; `ADVOCACIA_ABERTA` desligada | `0111`; `demonstracao.ts`; rota de onboarding | anexo 06 §4 | tirar o `if (is_demo)` da mensageria → teste reprova |
| A18 | IA/terceiro recebendo dado do caso | I | **não há IA no MVP**; o assistente existente (`AssistenteFlutuante`, `layout.tsx:171`) roda no Motor de Inteligência interno sem chave de terceiro (`layout.tsx:164-170`); ferramentas do assistente **não** ganham acesso a tabelas `legal_*` no MVP | `src/server/assistente/ferramentas.ts` (NÃO LI) | guarda nova: nenhum `from('legal_` em `src/server/assistente/**` | acrescentar → guarda reprova |
| A19 | Texto de WhatsApp com dado sigiloso (vai à Meta e ao histórico) | I | modelos do pacote sem placeholder de assunto/bem/processo/valor; guarda de build sobre `message_templates` semeados e sobre `src/core/advocacia/mensagens.ts` | `0109`; guarda `whatsapp-sem-dado-sigiloso` (nova) | guarda lê o seed e reprova `{processo}`, `{bem}`, `{valor}`, `{assunto}` | inserir `{processo}` num modelo → reprova |
| A20 | Dado de saúde ou criminal em campo livre do caso | I | campos livres curtos; aviso na tela ("não registre dado de saúde aqui"); `notes` fora da busca por texto; redação por chave `notes`/`instructions` | `0105`; `redact.ts:44-46` já cobre `note`/`observ` | unitário de redação | n/a |
| A21 | Migration aplicada fora de ordem ou produção atrás do código | T/D | `MIGRATIONS_ESPERADAS`/`ULTIMA_MIGRATION` + `/api/health` schema (`versao.ts:23-26`; `health.ts:2,48`) | existente | guarda `schema-esperado-bate-com-o-disco` | não bumpar a constante → reprova |
| A22 | Prazo sugerido errado tomado como certo | T | regra `validada: false` até gabarito; `podePreencher = false` sem confirmação do `owner`; confirmação humana; `calc_divergence` medido | `prazo-calculo.ts:9-13`; `0108` | `prazo-gabarito.test.ts` em dois modos (§6.5 do principal) | marcar uma regra `validada: true` sem gabarito → reprova |

## 3. Controles em detalhe

### 3.1 Isolamento por tenant

Nada novo além do padrão: toda tabela em `0103`-`0108` nasce com `enable` + `force` e política `has_tenant(tenant_id)` (ou função
derivada). O `isolation.test.ts` descobre as tabelas por `tenant_rls_report` (`:89`) e exige linha de seed em `restantes` (`:282-436`)
para cada uma. As quatro tabelas só do servidor (`legal_access_log`, `legal_intimation_sync`, `legal_intimation_suggestions`,
`legal_deadline_changes`, `legal_deadline_alerts`) entram em `NEGADAS_POR_DESIGN` (`:30`), e a conferência "lista = estado real"
(`:515-533`) garante que a exceção não vira folclore.

### 3.2 Papéis e sigilo

- `legal_can_access_case(case_id uuid) returns boolean`, `security definer`, `set search_path = public, pg_temp`, `stable`:
  `owner`/`manager` do tenant → true; caso `normal` → qualquer membership ativa do tenant; caso `sigiloso` → só `legal_case_members`
  do `professionals` ligado a `auth.uid()`. Revogada de `anon`; concedida a `authenticated`.
- Políticas de `legal_cases`, `legal_checklist_items`, `legal_documents`, `legal_deadlines` e `legal_intimations` (com caso) usam a
  função. Documento sem caso: `has_tenant` e papel ≠ `finance`.
- `finance`: no MVP só lê `clients.name`/`phone_e164` (já lê, pelo `client:read`? **[FATO]**: `finance` tem `payment:*`,
  `commission:*`, `report:*` e nada de `client:` em `rbac.ts:28`; então não lê clientes hoje). Fica como está: `finance` fora do pacote
  até haver honorários.
- `legal_role = 'estagio'`: lido pela política de insert de `legal_deadlines` (fatal nasce sem confirmação) e por `legal_checklist_items`
  (`rascunho`). Rota: `exigirPermissao(ctx.papel, 'legal_case:write')`, com `legal_case:*` acrescentado a `PERMISSIONS` para
  `owner`, `manager`, `professional`, `reception` (reception sem `legal_deadline:fatal`).

### 3.3 MFA obrigatória para o pacote

- Porta: em `contextoDoPainel` (`tenant.ts:197-202`), após resolver o contexto, se `ctx.tenant.pacote === 'advocacia'` e a chave
  `settings.advocacia.mfa_obrigatoria` (lida junto de `cortesia` no mesmo `select`, como `cortesia:settings->cortesia`, `tenant.ts:80`)
  e `ctx.sessao.aal !== 'aal2'` → `redirect('/admin/config/seguranca?motivo=pacote')`, exceto nessa própria rota e em `/admin/sair`.
- API: toda rota `v1/legal/*` chama `exigirAal2()` (`session.ts:77-81`) antes de `contextoAtual`.
- Enroll guiado no primeiro acesso (tela já existe: `src/app/admin/config/seguranca`).
- Recuperação: `owner` remove fator de membro (`DELETE v1/auth/mfa/factors/[id]`); o membro refaz. `owner` sem fator não acessa o
  próprio painel do pacote até fazer o enroll (não há exceção).
- Supabase Auth: `max_enrolled_factors` e política de senha conferidas em `supabase/config.toml` (NÃO LI; o LUBI apontou S14 em
  `07-seguranca.md:48`).

### 3.4 Cofre de documentos

- Bucket `legal-docs` privado, criado na `0106` com política de `storage.objects` que **não** concede `select` a `authenticated`;
  leitura só via URL assinada criada pela RPC/rota com `service_role` dentro de `withTenant`.
- Envio: `POST v1/legal/documents` recebe metadados; `POST v1/legal/documents/[id]/versions` recebe o arquivo (multipart ou upload
  assinado), valida bytes mágicos (PDF `%PDF`, JPEG `FFD8`, PNG `89504E47`, WEBP `RIFF....WEBP`, HEIC `ftyp`, DOCX/XLSX `PK` + conteúdo,
  ODT `PK`, TXT UTF-8), extensão × MIME, tamanho ≤ 50 MB, calcula `sha256`, grava versão `validated = true` só após as checagens.
- Leitura: `legal_abrir_documento(document_id, kind)` grava `legal_access_log` e devolve `storage_path`; a rota assina por 60 s
  **[HIPÓTESE]** com `download` forçado (`Content-Disposition: attachment`) para tudo que não for miniatura gerada pelo servidor.
- Miniatura: só de imagem, gerada no servidor, sem metadados EXIF, guardada no mesmo bucket.
- Antivírus: não existe nativo. Mitigações acima + nenhuma execução/renderização de conteúdo no servidor. ClamAV em Edge Function é P2
  **[DECISÃO PENDENTE: custo]**.
- Nome de arquivo original só em `note` (redigível); `storage_path` só com uuids.

### 3.5 Auditoria imutável

- `audit_log` (sem política de insert; servidor grava; `write.ts:80-128`) em toda mutação `v1/legal/*`, com `before/after`
  redigidos (`REDIGIR` ampliada: `texto_sanitizado`, `destinatarios`, `strategy_notes`, `instructions`, `document_hash`, `cnpj_hash`, `calc_memo`).
- `legal_access_log` para leitura sensível (documento, caso sigiloso, texto de intimação).
- `legal_deadline_changes` para mudança de prazo (motivo obrigatório em fatal).
- Nada disso aceita UPDATE/DELETE pelo PostgREST (`0112`), e a eliminação LGPD **anonimiza** (função com `service_role`, única exceção, testada).

### 3.6 Eliminação e portabilidade

- `POST v1/clients/[id]/erase` (existe) passa a: anonimizar `legal_persons` (nome → "Pessoa removida", telefone/e-mail/hash nulos),
  apagar objetos do bucket das versões do cliente e marcar `legal_document_versions.storage_path` como removido (coluna `removed_at`
  **[acrescentar ao modelo]**), anonimizar `legal_intimations.case_id` não (vínculo ao caso fica; o caso é anonimizado em título e
  `client_title`), manter `legal_deadlines` (obrigação do escritório) com título anonimizado.
- `GET v1/clients/[id]/data-export` (existe) inclui só dados do titular; herdeiros e cônjuge **não** (são terceiros).
- Retenção por job `lgpd-retention` (rota existe) com as regras do anexo 01 §6.

### 3.7 Limites de taxa e login

- Rate limit compartilhado existe (`0035`, NÃO LI). Rotas novas com custo (captura manual `POST v1/legal/intimations/capturar`,
  upload) entram no mesmo mecanismo com teto por tenant e por usuário **[HIPÓTESE: 10/min upload, 2/h captura manual]**.
- Login: o que já existe no CICLO (`v1/auth/login`, `rate-limit.test.ts`).

### 3.8 Segredos

- Nenhum segredo novo no repositório. `CRON_SECRET` e `CRON_BASE_URL` já existem (GitHub Secrets e Vault do Supabase, `0087:30-36`).
- Sal do hash de CPF/CNPJ: variável `DOCUMENT_HASH_SALT` (separada de `PHONE_HASH_SALT`), rotação com recálculo (job) **[P2]**.
- Chave de assinatura de URL: a do Storage (Supabase). Nada de HMAC próprio no MVP.

## 4. Redação de log: o que é proibido emitir

Chaves (comparação por `includes`, como `redact.ts:99-102`): `numero_processo`, `cnj`, `processo`, `oab`, `texto_sanitizado`,
`texto`, `destinatarios`, `strategy`, `estrategia`, `risk_notes`, `fee_notes`, `instructions`, `document_hash`, `cnpj`, `cpf`
(já existe), `calc_memo` e `client_title`. Sobre `client_title`: é texto escrito para o cliente ler, mas pode carregar nome de
pessoa, e não existe padrão de texto que detecte nome; entrar na lista custa zero e erra para o lado seguro.
Padrões de texto novos: `PADRAO_CNJ` (`\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}` com bordas), `PADRAO_CNPJ`.
Mensagem de erro do Postgres em `console.error` (`write.ts:117-126`): passar por `redigirTexto` antes de logar.
Teste: por comportamento, com controle positivo (chave inofensiva **não** é redigida, para a redação não virar "tudo vira [redigido]").

## 5. Backup e restauração

**[DECISÃO PENDENTE]** plano Supabase. Recomendação: Pro com PITR (RPO minutos, RTO ~1 h). Sem PITR: backup diário da Supabase
(RPO 24 h). Exercício trimestral: restaurar num projeto descartável e rodar `conferir-schema-prod.mjs` + contagem por tabela.
Documentar em `docs/runbooks/restauracao.md`.

## 6. Resposta a incidente (uma página)

1. **Detectar**: health vermelho, alerta de `audit_falhou`, denúncia de usuário, acesso inesperado em `legal_access_log`.
2. **Conter** (até 1 h): desligar `ADVOCACIA_ABERTA`; revogar sessões do tenant afetado (`auth.admin.signOut` por usuário);
   rotacionar segredo exposto; pausar o cron de captura se a origem for ele.
3. **Avaliar** (até 24 h): o que vazou, de quem, para quem; trilhas `audit_log`/`legal_access_log`.
4. **Comunicar**: o escritório afetado em até 24 h; ANPD e titulares conforme LGPD art. 48 (prazo "razoável"; a ANPD orienta
   3 dias úteis **[VERIFICAR com o advogado]**), com o que se sabe e o que se fez.
5. **Corrigir e provar**: teste que reproduz o defeito, visto reprovando, depois verde; registro em `docs/DECISOES.md`.
6. **Quem**: Eduardo decide e comunica; a sessão técnica executa; o advogado revisor orienta a comunicação.

## 7. Checklist "pode entrar dado real"

Só quando **todos** estiverem verdadeiros. Até lá, só o escritório-modelo (`is_demo = true`) existe no pacote.

- [ ] `pnpm verify` verde na branch, com a suíte de banco sem paralelismo de arquivos.
- [ ] `isolation.test.ts` cobre toda tabela `legal_*` (linha no seed) e as listas de exceção batem com o banco.
- [ ] Matriz persona × tabela × operação com conjunto esperado, verde, e **mutação** de cada política vista reprovando (anexo 05 §4).
- [ ] Privilégio por coluna de `texto_sanitizado`/`destinatarios` testado (secretaria não lê).
- [ ] MFA obrigatória ativa e testada (sessão `aal1` não entra).
- [ ] Redação de log e trilha com as chaves jurídicas, testada por comportamento e com controle positivo.
- [ ] Bucket privado; leitura só por RPC com trilha; `GET` direto negado; SW não cacheia.
- [ ] Nenhuma data de prazo pré-preenchida (gabarito ausente → trava verde no modo "sem arquivo").
- [ ] Toda rota `v1/legal/*` em `ROTAS_DE_ESCRITA`, com `exigirAal2`, `exigirModulo`, `exigirPermissao`, `comIdempotencia`, `writeAudit`.
- [ ] Health com `legalIntimacoes`, `legalFila`, `legalMfa`; monitor externo configurado.
- [ ] Migrations aplicadas em produção e `/api/health` sem "schema atrás".
- [ ] Adendo do pacote, política de privacidade e textos de publicidade revisados pelo advogado (dossiê do #144).
- [ ] Texto de todo modelo de WhatsApp sem dado do caso (guarda verde).
- [ ] Runbook de incidente e de restauração escritos; exercício de restauração feito uma vez.
- [ ] `ADVOCACIA_ABERTA` continua desligada até o Eduardo ligar por decisão registrada.
