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
