# O Motor não esquece serviço arquivado nem cliente eliminada — CICLO

Rode sozinho, sem pausar e sem perguntar nada, até terminar ou até acabar o orçamento de tokens.
Não peça confirmação: onde faltar decisão, escolha a opção mais simples e segura, registre em
`docs/DECISOES.md` e siga (regra do `CLAUDE.md`, seção "Quando faltar informação").

**AUTORIZO PUBLICAR = NÃO**

- Só commits locais, na branch `fix/motor-nao-esquece-<data-de-hoje>` (crie a partir de `main`
  atualizada).
- **Nunca** `git push`, nunca abrir PR, nunca `vercel deploy`, nunca escrever em produção (Supabase
  ou Vercel de produção são só leitura, se precisar consultar algo).
- Nunca imprimir segredo/credencial em nenhum arquivo, log ou commit.
- Sem agente em background: uma sessão, um fio de execução.
- **Precisa de Docker/Supabase local rodando** (`supabase status` confirma). Sem isso, os dois
  achados abaixo (BL-47/BL-48) não são verificáveis de verdade — pare e registre a falta, não tente
  "às cegas".

---

## Quem você é nesta tarefa

Um engenheiro entrando no repositório pela primeira vez, sem o histórico de conversa que gerou este
pedido. Tudo que você precisa está no repositório: leia `CLAUDE.md` e `docs/00-BRIEFING.md`
primeiro. O achado que esta missão existe para fechar já está documentado por inteiro em
`.claude/ciclo/autonomous-backlog.md`, itens **BL-47** e **BL-48** — leia os dois INTEIROS antes de
tocar em qualquer arquivo. Eles têm a investigação completa, a causa raiz, o desenho do conserto
certo em três partes, e — o mais importante — o registro de uma **tentativa anterior que foi
revertida pela CI** (commit `f6f46acf`, revertido em `9bf0d1b8`). Leia essa seção com atenção
redobrada antes de escrever uma linha: ela existe para você não repetir o mesmo erro.

## O que já se sabe (não reinvestigue do zero — confirme e construa em cima)

**BL-48, o bug real:** `arquivarServico` (marcar um serviço como `active: false`) e `eliminarCliente`
(o botão de "esquecer esta cliente" da LGPD) são os dois jeitos de tirar algo do catálogo/base ativa
do salão. Nenhum dos dois toca `client_cycles`. Resultado: o job noturno (`recomputarCiclosDoTenant`)
continua recalculando previsão para serviço arquivado e para cliente eliminada, para sempre, e duas
telas de dinheiro (`/admin/recuperar` via `v_recover_revenue`, e o alerta do "Hoje" via
`v_clientes_a_recuperar`) continuam mostrando/contando esse "fantasma" — às vezes as duas se
contradizendo entre si (mesmo sintoma que motivou a `0058` a existir, por outra causa).

**O conserto certo tem três partes, e o BL-48 já avisa: fazer só uma deixa o estado PIOR que hoje.**
Não pule para a parte 1 sozinha.

1. **`recomputarCiclosDoTenant` (`server/services/ciclo.ts`) para de ler serviço arquivado.**
   TypeScript puro, testável sem banco — mas sozinha, esta parte só CONGELA os números errados em
   vez de mantê-los atualizados-mas-errados. Não é o conserto, é a base para as próximas duas.
2. **Migration em `v_recover_revenue`:** acrescentar `and s.active` ao `join services` (0067 já é a
   última versão dessa view — `create or replace view`, coluna nenhuma muda de posição, `security_
   invoker = true` tem que ser repetido, a armadilha de sempre).
3. **Redesenhar `v_clientes_a_recuperar` (`0058_view_clientes_a_recuperar.sql`)** para também
   excluir: (a) linhas cujo único estado não-`on_track` seja de serviço arquivado, e (b) cliente com
   `deleted_at` preenchido. Esta é a parte mais arriscada das três — a view hoje não tem `clients`
   nem `services` no escopo, então é mudança de FORMA, não só de filtro. É também a parte que a
   tentativa revertida nunca chegou a tocar (a reversão foi antes disso, na parte da eliminação de
   cliente).

**Por que a tentativa anterior foi revertida, e o que investigar ANTES de tentar de novo:** a
reversão foi ao tentar fechar só o gatilho da eliminação LGPD, adicionando `client_cycles` a
`TABELAS_APAGADAS` em `lgpd.ts`. A hipótese era que `eliminarCliente` roda com `service_role`
(confirmado, via `withTenant`/`withNovoTenant`) e que RLS sem política de `DELETE` em
`client_cycles` bloquearia em silêncio (zero linhas) para sessão de usuário, mas não para
`service_role`. **Essa segunda parte da hipótese estava errada**: a CI (`Banco e RLS`, Postgres
real) reprovou 5 testes em `lgpd.test.ts`, todos com `AppError('INTERNAL')` — um erro real de
Postgres, não um no-op silencioso — ao tentar `DELETE` em `client_cycles`, que tem `force row level
security` (`0001_initial.sql`) e nenhuma política de `DELETE`. A causa exata (`force row level
security` bloqueando `service_role` do jeito que os testes chamam, versus produção de verdade, ou
algo mais específico do ambiente) **nunca foi determinada** — é o primeiro passo desta missão.

**Investigue com o banco local antes de escrever qualquer migration:**
- Reproduza o erro: rode `eliminarCliente` (ou um `DELETE` direto via `psql`/script, com o MESMO
  client `service_role` que os testes de integração usam) contra `client_cycles` no Supabase local,
  e leia a mensagem de erro completa — `reproduza-o-erro-antes-de-atribuir-causa` (`CLAUDE.md`
  família de lições) vale aqui tanto quanto em qualquer bug de aplicação.
- Confirme se `force row level security` bloqueia `service_role` por desenho do Postgres (bloqueia:
  é assim que `force` funciona — a diferença é que a maioria das tabelas desta base TEM política
  para `service_role`, e `client_cycles` pode não ter uma de `DELETE`) ou se é outra coisa.
- Se for isso, o conserto não é "adicionar a tabela à lista de apagadas" — é adicionar a POLÍTICA de
  `DELETE` que falta (ou decidir que `client_cycles` nunca deve aceitar `DELETE`, nem de
  `service_role`, e em vez disso fazer o eixo (b) acima — cliente eliminada não conta no dinheiro —
  só pela view, sem tentar apagar a linha de `client_cycles`). Registre a decisão tomada e por quê.

## BL-47 (secundário, se sobrar orçamento depois de fechar o BL-48)

`tests/integration/importacao-clientes.test.ts` (porta CSV) não testa `profit_at_risk_cents` nem os
casos de preço zerado (assinante ativo, pacote com saldo) que `tests/integration/
quem-ja-atendo.test.ts` (porta "memória") já testa para a MESMA função compartilhada
(`preverEPersistirCiclos`, `ciclo-de-quem-ja-atende.ts`). Não há divergência ativa hoje — é risco de
regressão silenciosa. Espelhe os três casos que já existem no describe `'preverEPersistirCiclos
grava o dinheiro certo (não só o estado)'` de `quem-ja-atendo.test.ts` para dentro de
`importacao-clientes.test.ts`, contra o banco local. Mecânico, baixo risco — mas só depois do BL-48
estar fechado e commitado.

## Requisitos não-negociáveis

- `pnpm verify` (typecheck + lint + test:unit + test:rls + build) verde antes de cada commit.
- Toda migration nova: RLS já correta desde o nascimento, `security_invoker = true` em toda view
  tocada, teste de isolamento (`tests/rls/`) cobrindo o comportamento novo se ele mudar quem vê o
  quê.
- Teste-guarda visto REPROVANDO antes de aceito como prova (procedimento do `CLAUDE.md`: commite
  antes de mutar, reintroduza o defeito, confirme a mutação aplicada, veja reprovar, restaure).
- Depois de qualquer commit que toque um arquivo NOVO: rode `pnpm test:unit` de novo — pelo menos
  uma guarda deste projeto (`copy-sem-travessao.test.ts`) só enxerga arquivo rastreado pelo git
  (`git ls-files`), então verificar antes do primeiro `git add` não é garantia.
- Um ticket (ou uma das três partes do BL-48), um commit, mensagem em português.

## Método

1. Leia `CLAUDE.md`, `docs/00-BRIEFING.md`, os itens BL-47/BL-48 inteiros em
   `.claude/ciclo/autonomous-backlog.md`.
2. Confirme `supabase status` — banco local respondendo. Sem isso, pare e registre.
3. Investigue a causa da reversão anterior (seção acima) ANTES de qualquer migration.
4. Implemente as três partes do BL-48, nesta ordem, cada uma com commit e `pnpm verify` próprios.
5. Se sobrar orçamento, feche o BL-47.
6. Registre cada passo em `.claude/ciclo/discoveries.md` — o que foi medido, o que mudou, o que NÃO
   está no ar.
7. Atualize o status do BL-47/BL-48 em `autonomous-backlog.md` (FEITO, ou o que ficou pendente e
   por quê).

## Quando parar

Pare quando as três partes do BL-48 estiverem implementadas, testadas (`test:rls` cobrindo o
comportamento novo das duas views) e commitadas — ou quando esbarrar de novo num erro de Postgres
que exija decisão do Eduardo (ex.: se a política de `DELETE` certa para `client_cycles` for uma
escolha de produto, não só técnica). Nesse caso, **não tente um segundo `force`** — reverta a
tentativa (`git checkout --` ou um commit de revert), documente exatamente o erro e a hipótese
descartada (mesmo padrão desta vez: causa real, não suposição), e pare limpo. Antes de parar:
árvore de trabalho limpa, `pnpm verify` verde na branch, tudo commitado em
`fix/motor-nao-esquece-<data>`, e um resumo curto (5 linhas): o que foi fechado, o que ficou
pendente, e — se parou por decisão do Eduardo — qual é exatamente a pergunta que só ele responde.
