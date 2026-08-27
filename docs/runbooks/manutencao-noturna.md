# Manutenção noturna do CICLO — log de execuções

> Cada execução do `/loop` overnight (branch `manutencao-noturna`, nunca `main`) escreve uma
> entrada aqui: o que foi checado, o que foi achado, se algo foi commitado. Formato: data/hora ·
> o que foi olhado · achado · ação.

---

## 2026-08-27 00:05–00:17 (America/Sao_Paulo)

**O que foi olhado:** varredura de `catch {}` vazios em `src/server/` (11 ocorrências) e de
chamadas de escrita (`insert`/`update`/`upsert`/`delete`/`rpc`) sem checagem de `{ error }`
próxima — o padrão que a auditoria de 2026-08-23 já tinha achado 9 vezes.

**Achado:** nada de novo. Os 11 `catch {}` vazios são todos legítimos — ou relançam como
`AppError`, ou têm comentário explícito justificando o retorno de sentinela (`null`/`false`) para
falha de parse (data, base64, JSON, timezone), o mesmo padrão já documentado no
`CLAUDE.md`. Nenhuma chamada de escrita sem checagem de erro apareceu na varredura — a auditoria
anterior já tinha fechado isso ("hoje não resta nenhum no projeto").

**Segunda checagem:** mutação de `tests/unit/design/landing-e-estatica.test.ts` (guarda nova,
mesclada em 26/08, nunca vista reprovando). Três mutações, uma por asserção:
1. Reintroduzir `sessaoAtual` em `src/app/page.tsx` → guarda reprovou. ✅
2. Tornar `Home` async → guarda reprovou. ✅
3. Desativar a condição de redirecionamento em `src/middleware.ts` (`data.user && false`) →
   guarda reprovou, com a mensagem certa. ✅

Todas as três mutações revertidas com `git checkout --` (árvore limpa antes de cada uma —
sem edição não commitada por perto, então o `checkout` não corria o risco documentado no
`CLAUDE.md`). Suíte confirmada verde depois.

**Ação:** nenhum commit. A guarda não é cega — não havia nada para corrigir. Preferível reportar
"verificado, sem defeito" a inventar um refactor cosmético só para ter o que commitar.

**Próxima rodada, sugestão:** mutação semelhante em outras guardas ainda não verificadas desta
forma — `preco-em-um-lugar-so.test.ts`, `titulos-de-tela.test.ts`, `home-nao-promete-demais.test.ts`
— ou varredura de export morto com `ts-prune`/busca manual por símbolo exportado sem nenhum
`import` correspondente fora do próprio arquivo.

## 2026-08-27 00:18 (America/Sao_Paulo)

**O que foi olhado:** mutação das 2 asserções de varredura de `tests/unit/design/preco-em-um-lugar-so.test.ts`
(a guarda que documenta ter sido cega uma vez — "passava vazio para sempre" antes de normalizar o
NBSP). Arquivo temporário `src/_mutacao_teste_tmp.ts` criado fora de `core/billing/planos.ts`
com (1) a tabela de nomes redeclarada e (2) `'R$ 49'` escrito à mão com espaço comum.

**Achado:** as duas reprovam certo. A guarda não está mais cega — a normalização de NBSP que já
foi aplicada continua funcionando.

**Ação:** nenhum commit de correção — arquivo temporário apagado, árvore limpa, suíte verde.
Sessão pausada aqui a pedido do usuário (vai testar com outra IA); log deixado pra quem continuar.

## 2026-08-27 00:22 (America/Sao_Paulo)

**O que foi olhado:** mutação das asserções de `tests/unit/design/titulos-de-tela.test.ts`
(guarda que varre os `page.tsx` de `/admin`, `(auth)`, `onboarding`, `(public)` exigindo
`metadata.title` próprio e não repetindo a marca — nunca vista reprovando desta forma).
Alvo: `src/app/admin/agenda/page.tsx`.

**Achado:** as duas asserções reprovam certo.
1. `title: "CICLO"` (repete a marca) → reprova em `not.toContain('ciclo')`. ✅
2. `export const metadata` removido inteiro → reprova em "não exporta metadata.title nem
   generateMetadata". ✅

A guarda não está cega. Mutações revertidas com `git checkout --` (árvore limpa antes de cada
uma), suíte confirmada verde (79 arquivos / 811 testes).

**Ação:** nenhum commit — nada a corrigir.

**Próxima rodada, sugestão:** `home-nao-promete-demais.test.ts` e
`runbook-aponta-pro-agendador-certo.test.ts` ainda não verificadas por mutação; ou varredura de
export morto.

## 2026-08-27 00:40 (America/Sao_Paulo)

**O que foi olhado:** (a) mutação de `tests/unit/design/runbook-aponta-pro-agendador-certo.test.ts`
— guarda nunca vista reprovando; (b) varredura de export morto com `ts-prune`.

**Achado (a):** guarda não está cega. Duas mutações em `docs/runbooks/incidente.md`:
1. Linha "Desabilite o cron no vercel.json e faça redeploy" → reprova ("manda mexer no vercel.json"). ✅
2. `.github/workflows/cron.yml` trocado por texto genérico → reprova ("nomeia o arquivo que realmente agenda"). ✅
Ambas revertidas, suíte verde.

**Achado (b) — export morto real:** `listarAvaliacoesRecentes` + o tipo `AvaliacaoRecente` em
`src/server/services/avaliacoes.ts` nasceram no commit `dc8cce5` e nunca tiveram consumidor —
nenhum import em `src/`, nenhum teste. A página pública calcula a média/lista de reviews dentro de
`perfilPublico()`; o painel admin usa `resumoAvaliacoes` (esse tem teste de integração). A função
recente ficou órfã. Removida.

**Ação:** commit `fix(avaliacoes): remove listarAvaliacoesRecentes, export sem consumidor`.
typecheck + eslint + 811 testes unitários limpos.

## 2026-08-27 00:48 (America/Sao_Paulo)

**O que foi olhado:** regra de RBAC duplicada entre `src/server/assistente/ferramentas.ts`
(`ferramentasPermitidas`) e `src/server/services/assistente.ts` (`ferramentasDisponiveisAgora`).

**Achado:** `ferramentasPermitidas` só era exercitada pelos próprios testes — produção nunca
importava (usava `avaliarPermissao(papel, f.permissao) !== null` reescrito à mão dentro de
`ferramentasDisponiveisAgora`). Dois lugares com o mesmo predicado de permissão: se um ganhar
nuance (ex.: tratar `null` diferente), o outro diverge calado — e o teste continuaria verde
porque cobre só a cópia não usada.

**Ação:** `ferramentasDisponiveisAgora` agora compõe sobre `ferramentasPermitidas` (RBAC) e só
adiciona o filtro de módulo do plano. Predicado de permissão num lugar só, e a função testada
passou a ter consumidor de produção real. Commit
`refactor(assistente): ferramentasDisponiveisAgora reusa ferramentasPermitidas`.
typecheck + eslint + 811 testes limpos.

## 2026-08-27 00:55 (America/Sao_Paulo)

**O que foi olhado:** componente `src/components/ui/marca-ciclo.tsx` (`MarcaCiclo`), apontado
por `ts-prune`.

**Achado — componente morto:** desde o commit `b320f97` (#20, wordmark PNG substitui texto solto)
`Selo` e `Topbar` passaram a usar `ciclo-wordmark-aqua.png`; `tab-bar`/`badge`/`alert-banner` usam
`IconeAnel`. `MarcaCiclo` ficou sem nenhum import — nem em `src/`, nem em teste. O próprio comentário
do arquivo estava desatualizado ("usado em topbar, header da landing, `Selo`").

**Ação:** `git rm` do componente + correção das duas menções obsoletas a `MarcaCiclo` em
comentários (`selo.tsx`, `globals.css`). Commit
`chore(marca): remove MarcaCiclo, componente sem uso desde o wordmark PNG`.
typecheck + eslint + 811 testes limpos.

## 2026-08-27 01:05 (America/Sao_Paulo)

**O que foi olhado:** (a) `ts-prune` completo de novo — confirmar que não resta export morto fora
de `src/app/`; (b) mutação de `tests/unit/design/home-nao-promete-demais.test.ts` (guarda com 12
asserções, nunca verificada por mutação).

**Achado (a):** nada. O que `ts-prune` ainda lista é 100% handler de rota do Next (`GET`/`POST`/
`PATCH`/`DELETE`), `generateMetadata`/`generateViewport`, `default`/`metadata`/`config` de página,
e falsos-positivos de parser (`satisfies`/`Record`/`readonly`). A varredura de export/componente
morto está esgotada por ora (2 achados reais nas rodadas anteriores: `listarAvaliacoesRecentes`,
`MarcaCiclo`).

**Achado (b):** guarda não está cega. Mutações em `src/app/page.tsx`:
1. "Avisamos sua cliente automaticamente" → reprova (promessa de mensagem automática sem `reminders` no schedule). ✅
2. "Criar a conta leva menos de três minutos" → reprova (tempo não medido). ✅
3. "Veja a Barbearia Dom Rocha" → reprova (nomeia tenant de demonstração fictício). ✅
4. Trocar `${NOME_DO_PLANO.essencial}` por "Consulte os planos" (mantendo "caixa" na copy) → reprova
   ("fala de register sem dizer que é do Essencial"). ✅
Todas revertidas, suíte verde (79 arquivos / 811 testes).

**Ação:** nenhum commit de código — nada a corrigir. Só esta entrada.

## 2026-08-27 01:15 (America/Sao_Paulo)

**O que foi olhado:** guarda `tests/unit/core/modulos-catalogo.test.ts` (varre o SQL das
migrations e compara com `CATALOGO` do core).

**Achado (a) — guarda não está cega:** removida a chave `assistant` de `CATALOGO` em
`src/core/billing/planos.ts` → reprova em duas asserções (`toEqual(naMigration)` e "assistant está
no plano gratis e fora do catálogo"). Mutação revertida. (Primeira tentativa de mutação via
`node -e` com `.replace` não aplicou — confirmei com `grep` antes de ler o resultado, conforme
`CLAUDE.md`; refeita com `sed -i`.)

**Achado (b) — inconsistência real, corrigida:** o `describe` dizia "core e migration 0041" e o
`it` "as mesmas 16 chaves", mas a própria asserção logo abaixo é `toHaveLength(17)` e lê de
`0041` **e** `0043` (o 17º módulo, `assistant`, entrou na 0043). Rótulo do teste contradizia o
que o teste faz. Corrigido `describe`/`it`/comentário do topo para 17 chaves e migrations
0041/0043.

**Ação:** commit `test(catalogo): corrige rótulo obsoleto — 17 módulos, migrations 0041/0043`.
eslint + testes do arquivo limpos.

## 2026-08-27 01:28 (America/Sao_Paulo)

**O que foi olhado:** (a) varredura própria de escrita `supabase-js` (`insert`/`update`/`upsert`/
`delete`) em `src/` sem checagem de `{ error }` — o padrão que a auditoria de 2026-08-23 achou 9x;
(b) mutação de `tests/unit/server/cron-cobre-os-fusos.test.ts`.

**Achado (a):** nada. Script varreu todos os `.from(...).insert/update/upsert/delete` e conferiu se
`erro`/`error`/`throwOnError` aparece na janela do statement — zero ocorrências sem checagem. (A
primeira passada deu vários falsos-positivos porque o regex só procurava `error`; o código usa
`erro*` em português — `erroInsert`, `erroUpdate`. Corrigido o regex, resultado limpou.) Confirma
a conclusão da auditoria anterior: "hoje não resta nenhum no projeto".

**Achado (b):** guarda não está cega. Duas mutações:
1. `dentroDaJanela(horaLocalDe(...), 4)` → `13` em `segments/route.ts` → reprova ("segments exige
   hora local 13; o schedule nunca chega nesses fusos"). ✅
2. Linha `- cron: '5 5 * * *' # reminders` adicionada dentro de `schedule:` no `cron.yml` → reprova
   ("reminders apareceu dentro de schedule: — manda mensagem para cliente final"). ✅
Ambas revertidas, suíte verde.

**Ação:** nenhum commit de código — nada a corrigir. Só esta entrada.

## 2026-08-27 01:40 (America/Sao_Paulo)

**O que foi olhado:** comentário grande do bloco `schedule:` em `.github/workflows/cron.yml` vs.
estado real do arquivo.

**Achado — comentário contradiz o próprio arquivo, em dois pontos:**
1. Abria com "CINCO horários" mas o `schedule:` tem SEIS linhas de `cron:` (5–10 UTC), e o próprio
   adendo mais abaixo ("Entrou um SEXTO horário") já dizia isso. Idem "Estas cinco horas ... por
   ~9%" — o adendo corrige para ~11% com o sexto.
2. Dizia "o comentário no topo de `recompute-cycles/route.ts` ainda descreve esse mundo [de cron a
   cada 15 min]" — mas esse comentário foi reescrito na auditoria de 26/08 e hoje fala de janela,
   atraso do agendador e do incidente de 25/08. Referência cruzada apontando para um texto que não
   existe mais.

**Ação:** comentário atualizado (SEIS horários / ~11%, com nota do que era antes; parêntese morto
sobre o route.ts removido). Só comentário YAML — sem mudança estrutural. Commit
`docs(cron): corrige comentário do schedule — seis horários, referência cruzada morta`.
eslint + 811 testes + guarda `cron-cobre-os-fusos` limpos.

## 2026-08-27 01:52 (America/Sao_Paulo)

**O que foi olhado:** mutação de `tests/unit/design/precos-tem-trava-no-servidor.test.ts` — guarda
de SEGURANÇA (todo módulo pago tem `exigirModulo` numa rota de escrita; todo recurso de teto `duro`
tem `exigirLimite`), nunca verificada por mutação.

**Achado:** guarda não está cega, nos dois blocos.
1. Removido `exigirModulo(db, ctx.tenantId, 'register')` de `tickets/[id]/items/route.ts` → reprova
   ("estes módulos são anunciados num degrau pago e nenhuma rota chama `exigirModulo`... `register`"). ✅
2. Removido `exigirLimite(db, ctx.tenantId, 'profissionais')` de `professionals/route.ts` → reprova
   ("recursos com teto DURO... nenhuma rota chama `exigirLimite`... `profissionais`"). ✅
Ambas revertidas, suíte do arquivo verde (6/6).

Também verifiquei consistência do teto de chamadas do assistente (`MAX_CHAMADAS_DE_FERRAMENTA = 3`)
e dos tetos de uso da rota (`LIMITE_POR_TENANT_DIA`/`LIMITE_POR_USUARIO_HORA`) — número único por
constante, sem duplicação divergente.

**Ação:** nenhum commit de código — nada a corrigir. Só esta entrada.

## 2026-08-27 02:05 (America/Sao_Paulo)

**O que foi olhado:** (a) mutação de `tests/unit/server/actions-fixadas.test.ts`; (b) o bloco
`describe('acento de cada vertical')` de `tests/unit/design/contraste.test.ts`.

**Achado (a) — guarda não está cega:** troquei um SHA por `@v4` em `ci.yml` → reprova ("action
presa em ref móvel"); tirei o comentário `# v4` de um SHA → reprova ("SHA sem comentário"). ✅

**Achado (b) — cobertura de teste morta + comentários obsoletos:** a migration `0033_cor_do_site_
por_tenant.sql` zerou todos os `vertical_packs.accent_color` e tornou a coluna nullable; a cor do
site público passou a vir só de `settings.site.accent` (escolha do dono) com fallback osso
(`public-booking.ts:145`, `site.ts:20`). O bloco `describe('acento de cada vertical')` continuava
testando 6 pares `(acc, acc2)` cravados de cores por profissão que não existem mais em lugar
nenhum — os valores de `acc2` (`#c084fc` etc.) nunca existiram fora desse teste. O comentário
"A tabela de §1 troca --acc por pack" descrevia o mecanismo que a 0033 removeu. Idem o comentário
de `[slug]/layout.tsx:36` ("Fallback se o pack não tiver accent_color válido").

**Ação:** removido o bloco morto (12 casos, 811→799 testes) + comentário de `layout.tsx` corrigido
para refletir o fluxo real (cor é escolha do dono; roxo por profissão removido na 0033). Commit
`test(contraste): remove bloco de acento por vertical — mecanismo removido na migration 0033`.
typecheck + eslint + 799 testes limpos.

## 2026-08-27 02:18 (America/Sao_Paulo)

**O que foi olhado:** (a) evolução do enum `plan_tier` pelas migrations 0030 e 0040 vs. core e
`types.gen.ts`; (b) mutação de `tests/unit/server/saude-vigia-so-o-que-roda.test.ts`.

**Achado (a):** consistente ponta a ponta. 0030 (`start/studio/network` → `gratis/profissional/
avancado`, `pro` intacto) + 0040 (`pro` → `essencial`, `profissional` → `equipe`) → estado final
`gratis | essencial | equipe | avancado`, que bate exatamente com `PlanoTier` em
`src/core/billing/planos.ts:13` e com `types.gen.ts:3367/3565`. Comentários das migrations
descrevem a história corretamente. Referências a `start/studio/network` em `docs/09-PLATAFORMA.md`
e `docs/ESPECIFICACAO-COMPLETA.md` são citações históricas (o handoff congelado), não afirmações
stale.

**Achado (b) — guarda não está cega, nas duas direções:**
1. Removi `'segments'` de `ROTAS_DE_CRON` → reprova ("ROTAS_DE_CRON é exatamente o que existe em
   src/app/api/cron"). ✅
2. Troquei `send_campaigns: 'campaigns'` por `'segments'` em `ROTA_DO_HEARTBEAT` → reprova
   ("segments/route.ts não grava o heartbeat 'send_campaigns'"). ✅
Ambas revertidas, suíte do arquivo verde (11/11).

**Ação:** nenhum commit de código — nada a corrigir. Só esta entrada.

## 2026-08-27 02:32 (America/Sao_Paulo)

**O que foi olhado:** (a) mutação de `tests/unit/server/motor-de-ciclo-observavel.test.ts`;
(b) consistência do `pricing_model` (migration 0029) entre migration, `core/pricing/formatar.ts`,
o teste `formatar-preco.test.ts` e a UI; (c) varredura de `TODO`/`FIXME`/`@deprecated` em `src/`.

**Achado (a) — guarda não está cega:** troquei `if (processados > 0)` por `if (true)` em
`recompute-cycles/route.ts` → reprova ("o heartbeat de recompute_cycles precisa ficar DENTRO de
`if (processados > 0)`"). ✅ (Primeira mutação via `node -e` não aplicou — conferido com `grep`
antes de ler o resultado; refeita com `sed -i`.)

**Achado (b):** consistente. Os 4 modelos (`fixed`/`hourly`/`visit_hourly`/`daily`) + `half_day_
price_cents` aparecem iguais na migration 0029, no enum `ModeloDePreco` do core, nos 6 casos do
teste e no `formatarPreco` chamado pela página pública e pelo formulário de agenda.

**Achado (c):** nenhum `TODO`/`FIXME`/`XXX`/`HACK`/`@deprecated` real em `src/` — as ocorrências de
"TODO" são a palavra portuguesa "todo" ("todo deploy", "todo tenant") em comentário.

**Ação:** nenhum commit de código — nada a corrigir. Só esta entrada.

## 2026-08-27 02:45 (America/Sao_Paulo)

**O que foi olhado:** (a) mutação de `tests/unit/server/lgpd-cobertura.test.ts` — guarda de
COMPLIANCE (toda coluna de dado pessoal nas migrations tem tratamento declarado em
`TRATAMENTO_NA_ELIMINACAO`); (b) comentários de código ligados à migration 0034 (débito de
carteira atômico).

**Achado (a) — guarda não está cega, nas duas direções:**
1. Removi a entrada `clients.document` de `TRATAMENTO_NA_ELIMINACAO` → reprova ("Coluna nova capaz
   de carregar dado pessoal, sem tratamento na eliminação... `clients.document`"). ✅
2. Adicionei entrada `clients.coluna_que_nao_existe` → reprova ("Declaração sobrando: a coluna saiu
   do schema... `clients.coluna_que_nao_existe`"). ✅
Ambas revertidas, suíte do arquivo verde (11/11).

**Achado (b):** nenhum comentário stale. `pacotes.ts:163/170/173`, `rate-limit.ts:57` e o cabeçalho
da própria 0034 referenciam `debitar_carteira` (RPC) e o achado S11 corretamente — descrevem o
estado atual, não o antigo `if` de JavaScript.

**Ação:** nenhum commit de código — nada a corrigir. Só esta entrada.

## 2026-08-27 02:58 (America/Sao_Paulo)

**O que foi olhado:** (a) mutação de `tests/unit/design/erro-nao-manda-cliente-pro-admin.test.ts`;
(b) comentários de código ligados às migrations 0036 (`can_see_appointment`) e 0037 (`claim_jobs`
retoma job preso em `running`).

**Achado (a) — guarda não está cega:** frase "Seus dados estão salvos" solta fora do condicional
`noPainel` → reprova ("a frase precisa estar condicionada ao painel"); `href={voltarPara}` trocado
por `href="/admin/hoje"` fixo → reprova ("o link para o painel está fixo"). ✅

**Achado (b):** aceitável. `rbac.ts:31` e `health.ts:87` descrevem 0036/0037 corretamente.
`job-queue.ts:53` cita só "migration 0009" para `claim_jobs` (a 0037 depois acrescentou a retomada
de job travado) — comentário incompleto, mas não errado, e o comportamento novo está documentado
em `health.ts:87` e nas próprias migrations. Não vale um commit só pra isso (evitar polimento
cosmético — regra do prompt).

**Ação:** nenhum commit de código — nada a corrigir. Só esta entrada.

**Nota de estado:** 13 guardas de varredura de fonte já verificadas por mutação, todas íntegras;
varreduras de export morto, escrita sem checar erro, enum de plano e modelo de preço todas limpas.
A dívida técnica encontrável por leitura está bem baixa — os 3 achados reais até aqui (rótulo de
teste, comentário de cron.yml, bloco de teste morto) foram todos "documentação que envelheceu",
não bug. Próximas rodadas: guardas restantes + rastrear cada migration 0026–0043 por comentário
de código que ela tornou obsoleto.
