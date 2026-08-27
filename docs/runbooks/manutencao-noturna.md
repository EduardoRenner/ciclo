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

## 2026-08-27 03:12 (America/Sao_Paulo) — nova tática: consistência de UX

**O que foi olhado:** `loading.tsx` faltando em rota do `/admin` que faz fetch. Para cada
`page.tsx` sob `src/app/admin`, conferido se há `loading.tsx` irmão.

**Achado — inconsistência real:** de ~28 telas do `/admin`, só duas telas `async` com fetch de
banco não tinham `loading.tsx`: `config/modulos` (lê `listarModulos`) e `config/meu-plano` (lê
`contextoDePlano` + 2 counts). Todas as outras ~20 telas de `config/*` têm. As duas entraram
depois (Fase M/monetização, docs/18) e escaparam do padrão que a memória do projeto registra
("18 telas ficaram sem loading.tsx" → sistematizado com `esqueleto-tela.tsx`). Sem elas, o Next
não pinta nada entre o clique e o Server Component terminar — lê como travado (mesmo defeito de
2026-08-18). Nenhum teste-guarda cobre cobertura de `loading.tsx`, por isso escaparam.

**Ação:** criados os dois `loading.tsx` reusando `EsqueletoCabecalho`/`EsqueletoLista`/
`EsqueletoNumeros`, mesmo padrão dos irmãos. Commit `fix(config): adiciona loading.tsx em modulos
e meu-plano`. typecheck + eslint + 799 testes limpos. (Um teste-guarda de cobertura de
`loading.tsx` seria útil, mas é escopo de outra rodada — anotado.)

## 2026-08-27 03:25 (America/Sao_Paulo)

**O que foi feito:** criada a guarda que faltava — `tests/unit/design/telas-do-admin-tem-loading.test.ts`.
Para cada `page.tsx` sob `src/app/admin` que é `export default async function` + tem `await` no
corpo (Server Component que busca dados), exige um `loading.tsx` irmão. Casa com o que MUDA quando
o defeito volta (a combinação async+await), não com o nome. `admin/page.tsx` (redirect puro, não
`async`) e telas estáticas ficam de fora naturalmente. Sanity: ≥25 páginas, ≥20 que buscam —
não passa por vacuidade.

**Vista reprovando:** removi `config/modulos/loading.tsx` → vermelho com a mensagem certa;
removi `config/meu-plano/loading.tsx` → idem. Restaurados, 29/29 verde. Reproduz exatamente o
defeito da rodada anterior.

**Ação:** commit `test(design): guarda de cobertura de loading.tsx nas telas do /admin`.
typecheck + eslint + 828 testes limpos (era 799 + 29).

## 2026-08-27 03:40 (America/Sao_Paulo) — consistência de UX

**O que foi olhado:** `aria-hidden` em ícone lucide decorativo dentro de elemento que já tem nome
acessível (texto visível ou `aria-label`). O padrão dominante do projeto é `<Icon aria-hidden>`
nesses casos (`button.tsx:73`, dezenas de `<Plus aria-hidden>` etc.) — mas ~10 lugares escaparam.

**Achado — inconsistência real:** ícones sem `aria-hidden` dentro de botão/IconButton com texto,
em 5 arquivos: `campanhas/page.tsx` (Megaphone + "Nova campanha"), `clientes/[id]/ficha.tsx`
(Pencil no IconButton "Editar ficha"; CalendarDays "Horário"; MessageCircle "Mensagem"),
`clientes/[id]/fidelidade.tsx` (Minus "Resgatar"; Plus "Adicionar"), `clientes/[id]/saude.tsx`
(Lock e Camera decorativos em Card com texto completo), `config/mensagens/editor.tsx`
(MessageSquarePlus "Criar modelo"; Trash2 "Apagar modelo"), `orcamentos/novo/formulario.tsx`
(Trash2 no botão "Remover item"; Plus "Adicionar item"). Sem `aria-hidden`, o leitor de tela
anuncia o `<svg>` além do texto do botão — ruído redundante.

**Ficou de fora de propósito:** `caixa.tsx:89` e `bloqueio-plano.tsx:74` (pai já é `aria-hidden`);
`campanhas/nova/nova.tsx:198/200` (Check/Send são indicadores de ESTADO, não decoração —
esconder apagaria informação; precisariam de texto sr-only, é outra decisão).

**Ação:** `aria-hidden` adicionado nas 10 ocorrências decorativas. Commit
`fix(a11y): aria-hidden nos ícones decorativos dentro de botão com texto`. typecheck + eslint +
828 testes limpos. (Guarda para isto não foi criada: os casos legítimos de exceção — ícone de
estado como Check/Send — são difíceis de distinguir de decoração num regex sem falso positivo.)

## 2026-08-27 03:55 (America/Sao_Paulo) — consistência de UX

**O que foi olhado:** cobertura de `EmptyState` nas telas de lista do `/admin`. Cruzei os
consumidores de `@/components/ui/empty-state` com todas as telas que renderizam `.map()` numa
lista.

**Achado — inconsistência real:** 13 telas de lista usam `EmptyState` (clientes, campanhas,
orçamentos, séries, estoque, serviços, profissionais, planos, recuperar, agenda, hoje, caixa,
trilha do cofre). Só `config/mensagens/editor.tsx` renderizava `{modelos.map(...)}` num `<ul>`
sem tratamento de lista vazia — quem apagasse o último modelo na sessão ficava com espaço em
branco embaixo do botão até recarregar (o re-seed de `listarModelos` só roda na leitura do
servidor). É a única tela de lista fora do padrão.

**Ação:** adicionado `EmptyState` (ícone `MessageSquare`, ação "Criar modelo" abrindo o mesmo
Sheet), e o botão "Criar modelo" do topo passou a esconder quando a lista está vazia — senão
seriam dois CTAs iguais. Mesmo padrão de `config/servicos/lista.tsx`. Commit
`fix(mensagens): estado vazio na lista de modelos`. typecheck + eslint + 828 testes limpos.

## 2026-08-27 07:12 (America/Sao_Paulo) — consistência de UX

**O que foi olhado:** todas as ~40 mensagens de `AppError('NOT_FOUND', { message })` e
`AppError.validacao` nas rotas `/api` e nos services, comparando o fraseado de situações
equivalentes.

**Achado — um único fora do padrão:** o projeto é rígido na voz — "Esse/Essa X não existe mais",
2ª pessoa, "não está mais na sua lista / no seu time / no seu catálogo". A única exceção era
`recorrencia.ts:279` → `'Série não encontrada.'` (impessoal, seco) — e a MESMA entidade em
`appointments/series/[id]/cancel/route.ts:15` já dizia `'Essa série não existe mais.'`. Dois
textos para o mesmo caso.

**Ação:** `recorrencia.ts:279` alinhado para `'Essa série não existe mais.'`. Nenhum teste
afirmava a string antiga. Commit `fix(recorrencia): mensagem de série não encontrada na voz da
casa`. typecheck + eslint + 828 testes limpos. O resto das ~40 mensagens está consistente —
sem mais achados nesta categoria.

## 2026-08-27 07:22 (America/Sao_Paulo) — consistência de UX

**O que foi olhado:** todos os ~45 `mostrarToast({ tom: 'ok', ... })` do app, comparando o
padrão de título entre telas.

**Achado — o único fora do padrão:** o padrão é "título = o que aconteceu" ("Cliente cadastrado",
"Serviço atualizado", "Comanda fechada", "Agendamento cancelado", "Agendamento remarcado"). Duas
telas de agenda fugiam disso com um "Prontinho" genérico:
- `agenda/detalhe.tsx:84` — `executar()` cobre confirmar/chegou/concluir/faltou e disparava um
  `titulo: 'Prontinho'` sem dizer QUAL transição — no mesmo arquivo, cancelar/remarcar já diziam
  o específico;
- `agenda/novo/formulario.tsx:146` — `titulo: 'Prontinho', descricao: 'Agendamento criado.'`, com
  a informação relegada à descrição (todo outro "criar" põe o fato no título).

**Ação:** adicionado `TITULO_FEITO` (estado → "Agendamento confirmado" / "Chegada registrada" /
"Atendimento concluído" / "Falta registrada") em `detalhe.tsx`; `formulario.tsx` passou a
`titulo: 'Agendamento criado'` direto. `dev/ui/vitrine.tsx` (vitrine do design system) mantém
"Prontinho" — é ilustrativo, não fluxo real. Commit `fix(agenda): toast de sucesso diz o que
aconteceu, não 'Prontinho' genérico`. typecheck + eslint + 828 testes limpos.

## 2026-08-27 07:26 (America/Sao_Paulo) — consistência de UX

**O que foi olhado:** todos os ~30 formatadores de data/hora do app (`Intl.DateTimeFormat`,
`toLocaleString`/`toLocaleDateString`/`toLocaleTimeString`), comparando as opções passadas para
o mesmo tipo de dado.

**Achado — um defeito real:** `agenda/detalhe.tsx:151` — o cabeçalho da folha de detalhe do
agendamento (o horário, em destaque) usava `toLocaleString('pt-BR')` **sem opções** → renderiza
com SEGUNDOS ("12/09/2026 15:30:00"). Todo o resto da agenda formata explícito e sem segundos
(`agenda.tsx:50`, `hoje.tsx:25`, `novo/formulario.tsx:34`).

**Ficou de fora, por decisão:** `profissionais/lista.tsx:192` e `editor-expediente.tsx:204` usam
`toLocaleDateString('pt-BR')` sem opções → "dd/mm/aaaa". É formato válido e legível em pt-BR para
os contextos secundários deles (vencimento de convite, intervalo de folga); trocar seria cosmético,
não conserto.

**Ação:** `detalhe.tsx` alinhado a `{ weekday: 'short', day: '2-digit', month: '2-digit',
hour: '2-digit', minute: '2-digit' }` (o mesmo formato de `novo/formulario.tsx`). Commit
`fix(agenda): data do detalhe sem segundos`. typecheck + eslint + 828 testes limpos.

## 2026-08-27 07:35 (America/Sao_Paulo) — nova tática: cobertura de teste em funções puras

A pedido do Eduardo ("acha outra coisa para fazer"), a fase de consistência de UX (6 achados
seguidos, todos corrigidos) cede lugar a: **backfill de teste unitário para função pura de
`src/core/` sem cobertura direta, uma por rodada, cada teste visto reprovando por mutação.**

**Rodada 1 — `src/core/cron/janela.ts`:** `dentroDaJanela` já era exercitada em
`cron-sobrevive-a-atraso.test.ts`, mas os dois wrappers de `Intl` (`horaLocalDe`, `dataLocalDe`)
não tinham teste nenhum — e é neles que moram as duas armadilhas que o comentário do arquivo
descreve sem medir: (1) sem `hourCycle: 'h23'`, meia-noite volta como "24" e a comparação
`horaLocal === 3` erra em silêncio; (2) a hora/data tem que ser a do fuso do tenant, não a de UTC.

**Visto reprovando:** removi `hourCycle: 'h23'` de `horaLocalDe` → teste de meia-noite vermelho;
troquei o `timeZone` de `dataLocalDe` para `'UTC'` → teste de fuso do tenant vermelho. Revertido,
5/5 verde.

**Ação:** commit `test(core): cobre horaLocalDe e dataLocalDe de cron/janela.ts`. typecheck +
eslint + 833 testes limpos (era 828 + 5).

## 2026-08-27 07:31 (America/Sao_Paulo) — cobertura, rodada 2

**`src/core/cron/agendadas.ts`:** `heartbeatVigiado` (o que decide se o `/api/health` cobra
execução recente de um job) e `rodaSozinha` só eram exercitados por dentro de `verificarSaude`
em `saude-vigia-so-o-que-roda.test.ts`. Faltava o teste direto dos três ramos:
kind desconhecido → vigiado (padrão seguro); kind de rota agendada → vigiado; kind de rota fora
do schedule (`reminders`/`campaigns`) → NÃO vigiado.

**Visto reprovando:** `heartbeatVigiado` forçado a `return true` → ramo "não vigiado" vermelho;
`rodaSozinha` forçado a `return true` → "só é verdade para rota em ROTAS_AGENDADAS" vermelho.
Revertido, 5/5 verde.

**Ação:** commit `test(core): cobre os tres ramos de heartbeatVigiado + rodaSozinha`. typecheck
+ eslint + 838 testes limpos (era 833 + 5).

## 2026-08-27 07:34 (America/Sao_Paulo) — cobertura, rodada 3

**`src/core/pricing/formatar.ts`:** o teste existente cobria bem `formatarPreco` mas deixava 3
ramos de fora: (1) `estimativaParaDuracao` com `pricingModel: 'daily'` (cai no fall-through —
"a diária é a diária, ignora a duração"); (2) `estimativaParaDuracao` `visit_hourly` com
`hourlyRateCents: null` (o `?? 0` defensivo); (3) `formatarPreco` `visit_hourly` com
`hourlyRateCents: null` (mesmo `?? 0`). Os dois últimos são a rede que existe caso a constraint
`services_visit_hourly_tem_taxa` do banco fosse burlada — sem teste, ninguém sabia se a rede
segurava.

**Visto reprovando:** `?? 0` → `?? 999`/`?? 777` nos dois pontos → testes de "sem taxa" vermelhos;
ramo `daily` trocado por `Math.ceil((duracaoMin/60) * priceCents)` → teste "a diária é a diária"
vermelho. Revertido, 12/12 verde.

**Ação:** commit `test(core): cobre ramos daily e hourlyRate-nulo de estimativaParaDuracao/
formatarPreco`. typecheck + eslint + 841 testes limpos (era 838 + 3).

## 2026-08-27 07:38 (America/Sao_Paulo) — cobertura, rodada 4

Conferidos e já **bem cobertos** (sem gap real): `core/recurrence/descrever.ts` (todos os 3 tipos
+ ordinal 5 + concordância de gênero), `core/estoque/alertas.ts` (todos os ramos + limites =30/D+0/
≤vs<), `core/comanda/totals.ts` (clamps, as duas bases de comissão, drift de ponto flutuante).

**`src/core/reminders/schedule.ts`:** o teste cobria o clamp da manhã (`T-3h < 8h` → gruda nas 8h)
mas NÃO o clamp da noite (`T-3h >= 21h` → gruda nas 20h) — só alcançável com agendamento de
madrugada (ex.: 1h da manhã → T-3h natural 22h do dia anterior). Ramo de código sem nenhum teste.

**Visto reprovando:** removido o `if (bruto.hour >= FIM_JANELA)` → o novo teste (agendamento à 1h,
lembrete devido só a partir das 20h) fica vermelho. Revertido, 8/8 verde.

**Ação:** commit `test(core): cobre o clamp noturno (T-3h > 21h) de lembretesDevidos`. typecheck
+ eslint + 842 testes limpos (era 841 + 1).

## 2026-08-27 07:42 (America/Sao_Paulo) — cobertura, rodada 5

**`src/core/attribution/compute.ts`:** cobertura muito boa (janela antes/depois/=30, trava 1:1,
cross-client, vazio) — só faltava um: a garantia de ORDEM. As campanhas são processadas ordenadas
por `sentAt` (a mais antiga reivindica primeiro), mas nenhum teste passava campanhas fora de ordem
no array; um `[...campanhas].sort(...)` removido num refactor não seria pego.

**Visto reprovando:** removido o `.sort()` de `campanhasOrdenadas` → o novo teste (duas campanhas
em ordem cronológica inversa no array, a de 01/08 tem que reivindicar, não a de 10/08) fica
vermelho. Revertido, 9/9 verde.

**Ação:** commit `test(core): cobre o sort de campanhas por sentAt em atribuirReceita`. typecheck
+ eslint + 843 testes limpos (era 842 + 1).

## 2026-08-27 07:46 (America/Sao_Paulo) — cobertura, rodada 6

**`src/core/cycle/compute.ts`:** cobertura excepcional (3 ramos de contagem de gaps, os dois
clamps, descarte de outlier, janela dos últimos 5, override de agendamento futuro, tabela inteira
de `estadoPorAtraso`). Faltava só o ramo PAR de `mediana` — a média dos dois valores do meio —,
que só é atingido com nº par de gaps; e nenhum teste tinha exatamente 2 gaps (o `gaps.length <= 2`
com 2, não 1).

**Visto reprovando:** `mediana` par trocado por "devolve o do meio superior" → o novo teste
(2 gaps [20,30] → mediana 25 → blend 23,4) fica vermelho. Revertido, 20/20 verde.

**Ação:** commit `test(core): cobre o ramo par de mediana + gaps.length==2 em computeCycle`.
typecheck + eslint + 844 testes limpos (era 843 + 1).

## 2026-08-27 07:50 (America/Sao_Paulo) — cobertura, rodada 7 (sem achado)

Conferidos: `core/risk/no-show-score.ts` (todos os pesos, os dois clamps, limites =14/4-vs-5+, "ou"
de sábado/18h, features passthrough — exaustivo); `core/offline/queue.ts` (os 4 desfechos, ordem,
vazio, all-conflict — completo); `core/scheduling/available-slots.ts` (expediente, múltiplas
janelas, serviço grande, buffer nos dois lados, folga, lead-time min/max nos limites, paralelismo
1/2/over, e uma seção inteira de DST 23h/25h — modelar).

Tentei cobrir o `continue` de "janela invertida/vazia" em `available-slots.ts`, mas **a mutação
não é observável**: o `if (fimServico > fechaInstant) break` interno já trata janela invertida e
janela vazia sozinho — o `continue` é defensivo redundante, não há comportamento que o distinga.
Testes que não podem ser vistos reprovando não entram (regra do `CLAUDE.md`). Descartados.

**Conclusão:** a cobertura de `src/core/` está **madura**. 6 gaps reais fechados nas rodadas 1–6
(janela, agendadas, pricing, reminders, attribution, cycle), todos vistos reprovando por mutação;
agora 3 arquivos seguidos sem gap mutável. Próxima rodada decide o pivô (ver sugestão no fim).

## 2026-08-27 07:55 (America/Sao_Paulo) — pivô: revisão de RLS nas migrations

**O que foi olhado:** as 18 tabelas criadas depois da 0001, mais as globais da 0001 — `enable` +
`force` RLS + política; `security_invoker` em views; `revoke execute` em função `security definer`
que escreve.

**Íntegro:** todas as 18 tabelas novas têm `enable row level security` + `force row level
security` + pelo menos uma política (ou estão corretamente sem política, sendo globais). As 4
views (`v_recover_revenue`, `v_daily_cash`, `v_client_segments`, `v_carteira_resumo`) têm
`security_invoker = true`. `consumir_rate_limit` e `tenant_rls_report` têm `revoke execute from
public, anon, authenticated`. Os GRANT de base do PostgREST (0038) são explícitos e comentados.

**Achado — lacuna de teste, não buraco de segurança:** `tenant_rls_report()` (migration 0005) só
enxerga tabelas com coluna `tenant_id`. As 3 tabelas globais que seguem o padrão deny-all
(`rate_limits`, `webhook_events`, `cron_heartbeats`) nunca entram no relatório, e `tests/rls/
isolation.test.ts` só verifica deny-all para 2 das 5 tabelas "negadas por design"
(`idempotency_keys`, `job_queue`). Uma política permissiva adicionada por engano a uma das 3
globais não seria pega por teste nenhum. O comentário de `0038` ("é o comportamento que o teste
de isolamento já cobra") superdeclara.

**Ação:** registrado em `docs/DECISOES.md` como pendência pro Eduardo — o conserto é um `it` novo
em `tests/rls/`, que roda contra o Supabase de PRODUÇÃO (fora do escopo seguro do loop). Nenhum
commit de código.

## 2026-08-27 08:00 (America/Sao_Paulo) — revisão de políticas RLS: íntegra. Manutenção concluída.

**O que foi olhado:** toda `create policy` das migrations, e toda função `security definer` que
escreve.

**Íntegro, sem exceção:**
- Toda política de `for update` e `for all` tem `with check` além de `using` — o template
  `%1$s_tenant_all` da 0001, `appointments_update`, `appointment_series_update`, `quotes_update`,
  `quote_items_update`, `tenants_update`, `memberships_write`, `profiles_self`, e todas as
  `_tenant_all` das migrations de CRM (0015–0025). Nenhuma deixa mover linha pra outro tenant.
- As 3 funções `security definer` que escrevem — `handle_new_user` (0006), `apply_vertical_pack`
  (0008), `apply_profession_pack` (0031) — têm `revoke ... from public, anon, authenticated`.
- `debitar_carteira` (0034) NÃO é `security definer` (só o comentário discute o porquê da escolha)
  — roda como invoker, RLS de `wallet_entries`/`clients` aplica inteira; `grant ... to
  authenticated` é correto ali.
- As funções `security definer` de leitura usadas em política (`has_tenant`, `tenant_role`,
  `can_see_appointment`, `my_professional_id`) seguem executáveis de propósito (revogar quebra a
  RLS); as de introspecção/infra (`tenant_rls_report`, `fk_sem_indice_report`, `claim_jobs`,
  `finish_job`) têm `revoke`.

**Conclusão — manutenção noturna concluída por ora.** Nada mais seguro e delimitado a fazer sem
tocar produção. O branch `manutencao-noturna` tem ~22 commits para revisão manual do Eduardo:
guardas verificadas (docs), 6 correções de consistência de UX, 1 guarda nova (loading.tsx),
6 testes de cobertura de core, 2 achados registrados em `DECISOES.md` (lacuna de teste RLS das
tabelas globais; ver também a entrada do assistente). Recomendação: revisar, fazer merge manual,
e reativar o loop quando quiser. Loop pausado.

**Nota de estado:** 13 guardas de varredura de fonte já verificadas por mutação, todas íntegras;
varreduras de export morto, escrita sem checar erro, enum de plano e modelo de preço todas limpas.
A dívida técnica encontrável por leitura está bem baixa — os 3 achados reais até aqui (rótulo de
teste, comentário de cron.yml, bloco de teste morto) foram todos "documentação que envelheceu",
não bug. Próximas rodadas: guardas restantes + rastrear cada migration 0026–0043 por comentário
de código que ela tornou obsoleto.
