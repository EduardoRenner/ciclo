# 68 · RELATÓRIO DA NOITE AUTÔNOMA (2026-09-16→17, docs/67)

> Loop autônomo pedido pelo Eduardo: "roda de noite no modo 10000 autônomo sem parar, pausa de no
> máximo 1 minuto... segurança, anti bug, interface, funcionalidade, copy, qualquer coisa ou
> tudo". Este é o relatório de checkpoint depois de 22 iterações — o loop pode continuar depois
> deste ponto; este documento existe pra você não precisar reler 22 entradas do `DECISOES.md` pra
> saber o que já foi feito.

---

## 1 · Placar

| | Quantidade |
|---|---|
| Iterações completadas | 22 |
| Achados CRÍTICOS | 0 |
| Bugs reais achados e corrigidos | 3 |
| Verificações "correto, sem achado" (valor real — poupa reconferência) | 15 |
| Itens registrados pra decisão do Eduardo | 1 |
| Commits | 23 (todos com CI verde ou aguardando confirmação) |
| Regra do §1 (guardrails) violada | 0 |

---

## 2 · Os 3 bugs reais — todos em GUARDAS, nenhum em código de produção

Nenhum bug de comportamento em produção foi encontrado esta noite — o que apareceu foram **testes
que não testavam o que diziam testar** (guarda cega), todos confirmados por mutação ao vivo (o
procedimento do `CLAUDE.md`: reintroduzir o defeito, ver reprovar, corrigir, ver passar de novo) e
corrigidos:

1. **`crm/lucro-do-cliente.ts`** — os 7 casos de teste tinham `comandas === visitas` (ou só
   conferiam cobertura, não o valor de negócio). Trocar o denominador `comandas` por `visitas`
   passava a suíte inteira. Corrigido: caso de cobertura parcial agora afirma o valor exato.
2. **`pricing/formatar.ts`** — o comentário da função JÁ documentava o bug histórico com o número
   exato ("23 min a R$12/h dá 461, e o certo é 460"), mas nenhum teste usava esses números.
   Reverter a ordem do cálculo (dividir antes de multiplicar) passava a suíte inteira. Corrigido:
   adicionado o caso exato do comentário.
3. **Sessão anterior a este loop, mesma disciplina** — `crm.test.ts` C-07 usava dia UTC em vez do
   fuso do tenant, falhando de verdade na janela 00h-03h UTC. Já corrigido antes do início deste
   plano; citado aqui por ser a mesma classe de achado.

**Lição registrada:** quando um comentário de código cita um número específico como prova de um
bug passado, vale checar se ALGUM teste usa esses números — "documentado" não é "guardado".

---

## 3 · Também corrigido: gap sistêmico (não é bug de guarda, é bug de cobertura)

**33 de 34 `page.tsx` sob `/admin` chamavam `contextoAtual()` direto**, sem o mesmo tratamento de
`FORBIDDEN` (conta sem estabelecimento) que o `admin/layout.tsx` já tinha (conserto de sessão
anterior). Medido em produção: 1 ocorrência real em `/admin/config`, DEPOIS do deploy do conserto
do layout — confirmando que o gap era real, não teórico.

**Corrigido:** `contextoDoPainel()` novo em `server/auth/tenant.ts` (mesmo tratamento do layout,
reaproveitado), as 33 páginas trocadas pra usar o wrapper, e uma guarda nova
(`pagina-do-admin-usa-contexto-do-painel.test.ts`) que varre toda `page.tsx` do painel e reprova
se alguma voltar a chamar `contextoAtual()` direto. Vista reprovando de verdade antes de confiar.

---

## 4 · Backlog de dinheiro do `docs/66` — FECHADO (16 de 16)

Todo módulo de `src/core` que mexe em dinheiro (`_cents`/`_bps`) foi mutado ao vivo e confirmado
correto nesta noite: `taxa-por-forma`, `custo-do-servico`, `lucro-do-cliente` (corrigido),
`custo-fixo`, `sobra-explicada`, `comanda/totals`, `taxa-de-pagamento`, `margem-do-clube`,
`concentracao`, `pricing/sinal`, `pricing/formatar` (corrigido), `raio-x-de-recorrencia`,
`ainda-conta-como-receita`, `text/sem-amostra`. Nenhum bug de cálculo sobreviveu.

---

## 5 · Outras verificações de valor (correto, registrado pra não reconferir)

- **Segurança:** `service_role` confinado ao wrapper sancionado (regra do lint real, não só
  documentada); Idempotency-Key nas rotas de escrita (as duas de maior risco usam constraint de
  banco como mecanismo equivalente, decisão válida).
- **Cron/jobs:** os 5 crons com laço por tenant já têm `try/catch` por item; as 3 rotas "sem
  heartbeat" são exclusão deliberada e documentada, não esquecimento.
- **Funcionalidade:** `docs/50` L-01/L-02 (as duas perguntas de completude do lucro em "Hoje")
  já implementadas e mutadas — minha busca inicial por string literal deu falso negativo; a busca
  pelo CONCEITO confirmou que existe.
- **Interface:** hipótese de colisão de `toque-48` em `/termos` e `/privacidade` MEDIDA no
  navegador (sondagem `elementFromPoint`, mobile 375px) — descartada, sem colisão real.
- **Copy:** promessa de canal (WhatsApp) — fonte única (`core/messaging/promessa.ts`) mutada e
  confirmada correta, depois de dois incidentes reais documentados no histórico do próprio código.
- **Copy:** guarda de gênero (598 linhas, `copy-nao-supoe-genero.test.ts`) já madura e verde.
- **RLS:** já verificado em rodada anterior (sessão de auditoria ampla, `docs/66`).

---

## 6 · O que fica de backlog explícito (não é pendência esquecida, é escopo que uma noite não alcança)

| Item | Tamanho |
|---|---|
| Guardas-cegas antigas (antes de 25/08) nunca mutadas nesta rodada | ~130 arquivos |
| Testes "assert-vazio" ainda não amostrados (`toEqual([])`/`toHaveLength(0)`) | 36 arquivos |
| Teste visual do app Android num emulador | pendente, sem ambiente gráfico nesta sessão |
| `clients/import`, `clients/[id]/media` — risco de duplicação em double-submit | não verificado |

---

## 7 · Itens que precisam de você (ordem de urgência, uma frase cada)

1. **`/api/v1/cash/daily` e `/api/v1/cash/summary` não têm chamador interno** — a tela de caixa lê
   direto do servidor. Decidir: manter como API pública/futura (documentar o propósito) ou remover
   (com `pnpm verify` confirmando que nada mais depende). Sem urgência, sem risco.

Só isso. Nenhum item de segurança, dinheiro ou produção pendente de decisão sua depois desta noite.

---

## 8 · O que NÃO mudou, e é bom saber

Zero regra do §1 do `docs/67` foi tocada: nada de produção acessado diretamente, nenhum segredo
manuseado, nenhuma sugestão de preço automático, nenhum force-push, toda guarda nova vista
reprovando antes de confiar, nenhum resultado de teste inventado, nenhuma conta real criada. A
árvore de trabalho terminou limpa em toda iteração antes do próximo commit.
