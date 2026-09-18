# 73 · MOTOR DE CICLO — PRÓXIMA FASE, PLANO

> Continuação de `docs/46-VANTAGEM-PLANO.md` (a escolha do mecanismo: D + E, "o Motor aprende com
> os próprios erros") e `docs/48-INOVACAO-PLANO.md` (C1–C8, a tese do lucro). As duas rodadas
> escolheram o QUE construir; esta pergunta é diferente — **o que já está construído, e onde ele
> ainda mente ou desperdiça o que já mede.** As regras invioláveis do `CLAUDE.md` continuam
> valendo integralmente e não são repetidas aqui.
>
> Pedido do Eduardo, 2026-09-18: "aprimorar o nosso maior diferencial, o Motor de Ciclo, seja
> funcionalidade, tudo" — sem escopo mais estreito que esse. Este documento interpreta "tudo" como
> licença para olhar código, dado medido e produto juntos, não como licença para inventar recurso
> sem lastro.

---

## 0 · O que já está construído (não repetir sem motivo novo)

Medido no repositório em 2026-09-18, depois de uma sessão inteira mexendo nesses arquivos:

| Peça do mecanismo | Onde | Status |
|---|---|---|
| Previsão determinística por (cliente, serviço) | `core/cycle/compute.ts` (`computeCycle`) | Maduro, ~80 linhas, sem ML |
| Registro append-only de previsão × versão do algoritmo | `cycle_predictions` (0064), `server/services/previsao.ts` | Maduro |
| Régua MEDIDA ao lado da configurada, nunca por cima | `cycle_days_observado*` (0065), `core/cycle/calibracao.ts`, `core/ciclo/regua-do-servico.ts` | Maduro — recência corrigida nesta mesma noite (achado de coluna sem leitor) |
| Prestação de contas (C5): acerto medido, com piso de amostra e sem viés de sobrevivência | `core/cycle/prestacao-de-contas.ts` | Maduro, bem guardado |
| Fila de recuperação por LUCRO, uma linha por cliente | `core/ciclo/quem-recuperar.ts`, `core/cycle/valor-em-risco.ts` | Maduro |
| Ciclo individual explícito na ficha (C4) | `core/ciclo/ritmo-do-cliente.ts` | Maduro |
| Comparação "hoje vs. costume" | `core/ciclo/comparacao-com-costume.ts` | Maduro |
| Atribuição de receita a campanha/recuperação | `core/attribution/compute.ts` | Maduro |
| CICLO Clube (assinatura recorrente) | `core/loyalty/motor-de-precificacao.ts` e afins | Maduro, trava de plano corrigida nesta noite |

Nenhum destes entra na lista de candidatos abaixo. O que segue é o que sobrou depois de excluir o
que já existe — e boa parte veio de **ler os números que o próprio Motor já calcula e nunca usa
contra si mesmo**.

---

## 1 · Os candidatos

### F1 · Calibrar a PROBABILIDADE de retorno por estado — não só a DATA

**O achado.** `core/cycle/valor-em-risco.ts` tem esta tabela, sem comentário de origem:

```ts
export const PROBABILIDADE_POR_ESTADO: Record<EstadoCiclo, number> = {
  on_track: 0, due: 0.85, late: 0.65, at_risk: 0.35, lost: 0.12,
}
```

Estes cinco números **nunca foram medidos** — são palpite de lançamento, e é exatamente o defeito
que o `docs/46` descreveu para `cycle_days` antes da calibração existir: *"21 por padrão, ou o que
veio do pack da profissão"*. A diferença é que aqui ninguém percebeu, porque o número não aparece
sozinho na tela — ele vira ORDEM da fila de recuperação (`lucroEmRiscoCents`) e VALOR anunciado
("R$ X em risco"). Se `late` na vida real volta 40% das vezes e não 65%, a fila prioriza errado e a
landing promete um número que a prestação de contas (C5) poderia desmentir — e ninguém olha.

**Por que dá para medir.** `prestacaoDeContas` já resolve exatamente a pergunta complementar
("dado que a data prevista passou por N dias, a pessoa voltou?") — só falta um agrupamento por
FAIXA de atraso em vez de por acerto/erro absoluto. `estadoPorAtraso` (`compute.ts`) já é a função
que converte `lateDays` em estado; rodar a MESMA função sobre o `lateDays` que cada previsão tinha
**no momento em que ficou aberta** dá a probabilidade real de conversão por estado, por tenant.

**O que muda de verdade:**
- a fila de "Recuperar receita" passa a ordenar pelo que aquele salão especificamente vive, não
  por um palpite igual para todo mundo;
- "R$ X em risco" deixa de ser uma extrapolação e vira um número com procedência — mesmo padrão de
  honestidade que `regua-do-servico.ts` já aplica à data;
- fecha o D+E um nível mais fundo: hoje só a DATA se autocorrige; a CHANCE continua fixa desde o
  dia 1 do produto.

**Risco.** Amostra pequena por tenant nos primeiros meses — précisa do mesmo piso de
`MINIMO_PARA_AFIRMAR` (8) já usado em `prestacao-de-contas.ts`, com fallback para a tabela global
atual enquanto a amostra do tenant não sustenta. Sem isso, um salão novo teria "chance de `lost`"
calculada sobre três casos.

**Custo estimado `[E]`:** 2-3 tickets. Não muda `computeCycle` nem `calibrarCiclo` — é aditivo,
só troca de onde `PROBABILIDADE_POR_ESTADO` vem.

---

### F2 · Faixa de confiança na data prevista, não um ponto só

**O problema.** `computeCycle` devolve uma data única (`predictedDate`). A tela mostra "atrasada há
12 dias" com a mesma convicção para um cliente com 40 visitas regulares e um com 2. `calibrarCiclo`
já teria os dados para isto — a dispersão dos `gaps` usados na mediana é informação descartada
depois do cálculo.

**A ideia.** Quando a amostra é pequena (2-4 gaps), a régua já é uma mistura amortecida com o
padrão (`0.6 × mediana + 0.4 × default` — passo 3 do `computeCycle`); o que falta é DIZER isso.
Uma frase como "atrasada há 12 dias, com 3 visitas de histórico" já muda a leitura sem exigir
intervalo estatístico formal — é o mesmo espírito de `procedência` em `regua-do-servico.ts`,
aplicado à ficha do cliente em vez de à tela de serviços.

**Risco.** Baixo — é só texto, nenhum número novo entra na decisão de estado (`estadoPorAtraso`
continua igual). O risco real é inflar a UI com estatística que ninguém lê (o próprio `docs/46`
Fase 3 avisa: *"a tela nunca mostra 'acurácia de 78%' como manchete"*) — então a frase precisa
nascer como CONSEQUÊNCIA ("é por isso que o Motor ainda não está confiante"), não como número solto.

**Achado ao começar T5, 2026-09-18: a ficha já tem isso — a lista não.** `core/ciclo/
ritmo-do-cliente.ts` (marcado "Maduro" no §0) já calcula `procedencia` ("medido em N voltas") e a
ficha do cliente (`admin/clientes/[id]/ficha.tsx`) já exibe. **O que falta é diferente do T5
original**: a tela "Recuperar receita" (`recuperar.tsx`, a lista, não a ficha individual) mostra
"Nd de atraso" sem NENHUMA confiança — nem para um cliente com 2 visitas nem para um com 40.

Por que isso não dá para construir esta noite: `ItemRecuperar`/`v_recover_revenue` não expõem
quantidade de visitas por combinação (cliente, serviço) — só `personal_cycle_days`, que é o
RESULTADO calibrado, não a AMOSTRA que o sustenta. Fechar isso exigiria uma coluna nova em
`client_cycles` (ex.: `sample_size`, escrita por `recomputarCiclosDoTenant` a partir de
`history.length`, que a função já calcula) — uma MIGRATION. Esta sessão não tem Docker/Supabase
local (indisponibilidade crônica já registrada) para aplicar e validar uma migration com
segurança — `test:rls`/`test:integration` precisam de banco de verdade, e `pnpm db:types` precisa
rodar contra ele depois. Registrado como **T5-revisado**, abaixo, para quando Docker local voltar
ou o Eduardo revisar.

**Custo estimado `[E]`:** 1-2 tickets, depois de F1 (compartilha a mesma leitura de amostra).

---

### F3 · Amortecimento entre recalibrações sucessivas do mesmo serviço

**O risco não resolvido do `docs/46`.** A Fase 3 daquele plano já nomeou o perigo: *"corrigir
demais / oscilar. Precisa de amortecimento e de piso de amostra."* O piso de amostra
(`MINIMO_DE_AMOSTRA = 8`, `DESVIO_MINIMO_DIAS = 3`) foi construído. **O amortecimento, não** —
`calibrarCiclo` roda toda noite, sobre a mediana das últimas voltas resolvidas, sem memória da
calibração anterior. Se a composição da clientela mudar por um mês (uma promoção atrai um público
diferente, um profissional novo muda o ritmo), a régua pode pular de um valor calibrado para outro
de uma noite para a seguinte, dentro do mesmo piso de amostra — sem qualquer viés que puxe de
volta ao valor anterior.

**Investigar antes de construir.** Não está confirmado que isto já aconteceu em produção — é um
risco identificado por leitura de código, não um incidente medido. **Primeiro passo:** consultar
`cycle_predictions`/o histórico de `cycle_days_observado` (se houver) por tenants reais e medir se
a régua já oscilou mês a mês. Só constrói amortecimento (ex.: média móvel exponencial entre a
régua antiga e a nova, com peso maior para mais amostra) se a medição confirmar oscilação real —
adicionar suavização sem sintoma medido seria a mesma classe de erro que motivou o candidato A do
`docs/46` a ser rejeitado (mecanismo bonito sem problema real por trás).

**Custo estimado `[E]`:** 1 ticket de medição + 2-3 de construção, condicional ao resultado.

---

### F4 · Aquecimento do número de WhatsApp — o canal do Motor inteiro

**Achado de uma auditoria anterior nesta mesma base** (não novo nesta sessão, mas nunca virou
ticket): não existe plano de rampa/aquecimento para o número de WhatsApp que carrega TODA a
mensagem automática do Motor — lembrete, confirmação, recuperação. A única proteção hoje é teto
diário de envio + pausa manual, que impede LOOP, não BANIMENTO por volume súbito num número novo.

**Por que isto é Motor de Ciclo, não infraestrutura genérica.** O mecanismo inteiro (D+E, C3, C4)
depende de a mensagem CHEGAR. Um número banido ou restrito pela Meta silenciosamente transforma o
diferencial inteiro em uma tela bonita que ninguém recebe — e, pelo padrão desta base ("verde não
é prova"), provavelmente sem alarme nenhum tocando.

**A ideia.** Rampa de volume nos primeiros dias de um número novo (ex.: teto crescente por 7-14
dias antes do teto normal valer), e um sinal de saúde do número (taxa de entrega/qualidade que a
própria API do WhatsApp expõe) no mesmo `/api/health` que já cobre os outros jobs.

**Risco.** Depende de F0 (WhatsApp ligado) já estar em produção com tráfego real para ter o que
aquecer — e F0 continua sendo decisão do Eduardo, fora do escopo deste documento. Registrado aqui
para não ficar esquecido quando F0 avançar, não para construir antes disso.

**Custo estimado `[E]`:** 2 tickets, só depois de F0.

---

### F5 · Reabrir C8 (yield management) para avaliação — não para construção

`docs/48` adiou C8 explicitamente: *"é 10x de verdade, mas é o mais caro e o mais delicado com o
veto de preço"* — sugestão de preço para horário ocioso, sempre como proposta que o dono aprova,
nunca automática. Àquela altura o produto tinha zero tenants pagantes de verdade; hoje a base de
código amadureceu (comissão, taxa, margem por serviço, calibração de ciclo — tudo que C8
precisaria como insumo já existe). **Isto não é uma recomendação para construir** — é uma
recomendação para rodar uma rodada de avaliação nos mesmos moldes do `docs/46`/`docs/48` (Blue
Ocean, 7 Powers, teste de Christensen, red team), com o inventário de pré-requisitos técnicos já
pronto que não existia na rodada anterior.

**Por que está na lista e não excluído:** ignorá-lo de novo sem reavaliar seria tratar uma decisão
de 2026-09-05 como permanente sem revisitar a premissa que mudou (maturidade da base).

**Custo estimado `[E]`:** 0 tickets de construção agora — 1 rodada de avaliação estratégica,
separada deste documento, se o Eduardo quiser priorizá-la.

---

## 2 · Por que a ordem é F1 → F2 → F3 → (F4 condicional a F0) → (F5 fora deste plano)

- **F1 é o maior valor pelo menor risco.** Não toca `computeCycle` (o algoritmo que decide a DATA,
  testado e em produção) — só o número que decide ORDEM e VALOR anunciado. Reaproveita
  `estadoPorAtraso` e o piso de amostra já existentes. É a continuação mais direta e mais honesta
  do próprio D+E: fecha a metade do mecanismo que ficou incompleta.
- **F2 é barato e depende da mesma leitura de amostra de F1** — faz sentido em sequência, não
  antes.
- **F3 é a única entrada da lista que pede medição ANTES de decisão de construir** — é tratada como
  tal, para não repetir o erro que o `docs/46` já preveniu no candidato A (construir para um
  problema hipotético).
- **F4 é o mais importante em impacto potencial** (sem canal, o Motor inteiro para de valer) **e o
  mais bloqueado** (depende de F0, decisão do Eduardo). Fica registrado, não construído agora.
- **F5 explicitamente não é ticket de construção** — é recomendação de processo (reabrir avaliação),
  separada da lista de tickets abaixo.

---

## 3 · Tickets, em ordem de construção

| # | Ticket | Depende de | Critério de aceite | Status |
|---|---|---|---|---|
| T1 | Medir: agrupar previsões resolvidas por estado-no-momento-do-atraso e comparar com `PROBABILIDADE_POR_ESTADO` atual, por tenant e global | nada | Número real ao lado do palpite, para pelo menos os tenants de demonstração com histórico suficiente | ✅ 2026-09-18 |
| T2 | Calcular probabilidade por estado a partir de `cycle_predictions` resolvidas, com piso de amostra e fallback para a tabela global | T1 | Tenant com amostra insuficiente continua usando a tabela fixa; tenant com amostra suficiente usa a medida; guarda mutation-tested nos dois casos | ✅ 2026-09-18 |
| T3 | Trocar `valorEmRiscoCents`/`lucroEmRiscoCents` para consultar a probabilidade calibrada em vez da constante | T2 | `tests/unit/core/valor-em-risco.test.ts` (criar, se não existir) cobre o caminho calibrado e o caminho de fallback | ✅ 2026-09-18 — provado contra Postgres real em CI (`tests/integration/ciclo.test.ts`) |
| T4 | Expor a procedência da probabilidade na tela "Recuperar receita" (mesmo padrão de `regua-do-servico.ts`: o número calibrado, e de onde veio) | T3 | Frase visível, nunca "acurácia X%" como manchete — segue o veto do `docs/46` Fase 3 | ⏸ pausado — ver §5 |
| T5 | ~~Amostra de histórico na ficha do cliente~~ — já existia (`ritmo-do-cliente.ts`, "Maduro") | — | — | ✅ já estava feito antes deste plano |
| T5b | Amostra de histórico na LISTA "Recuperar receita" (não só na ficha): coluna nova em `client_cycles` (`sample_size`), escrita pelo recompute, exposta em `v_recover_revenue` | migration + T3 | Guarda mutation-tested para a escrita; `test:rls`/`test:integration` verdes contra banco real | ⏸ bloqueado — precisa de Docker/Supabase local ou revisão do Eduardo para aplicar migration com segurança |
| T6 | Medição de oscilação de régua mês a mês, por tenant real (F3) | nada, mas depois de T1-T5 por prioridade | Relatório objetivo: oscilou ou não, com números — decide se T7 existe | não iniciado |
| T7 | Amortecimento entre calibrações (condicional ao resultado de T6) | T6 confirmando o problema | A definir no momento, se T6 confirmar | não iniciado |

T4 em diante é onde uma mudança de UI aparece — cada um passa pela verificação de navegador
quando o Docker/Supabase local estiver disponível (indisponibilidade crônica registrada
anteriormente nesta base); até lá, verificação por tipo, lint e teste comportamental, como o resto
desta sessão já vem fazendo.

---

## 4 · O que este plano explicitamente NÃO propõe

- Não propõe IA/ML em lugar do algoritmo determinístico. `computeCycle` continua sendo ~80 linhas
  explicáveis — a calibração de F1 é uma segunda tabela medida, não uma rede treinada.
- Não propõe preço automático em lugar nenhum — F5 é reavaliação, não construção, e mesmo se
  avançar continua "sugestão que o dono aprova" por veto do `CLAUDE.md`.
- Não propõe comparação entre tenants nem benchmark de mercado — o `docs/46` já rejeitou esse eixo
  (candidato A) porque o fosso cresceria a favor de quem tem mais base, e o CICLO não tem.
- Não propõe mexer no F0 (ligar WhatsApp automático) — decisão do Eduardo, fora deste documento.

---

## 5 · Checkpoint, 2026-09-18 — por que T4/T5 pausaram

T1-T3 estão em `main`, provados contra Postgres real em CI (não só unitariamente): a probabilidade
de retorno por estado passa a se calibrar por tenant, com o mesmo piso de amostra e a mesma
filosofia de rollout autolimitado que a régua já usa desde o `docs/46`. Nenhum tenant existente
muda de comportamento até acumular histórico — mas T3 é a primeira mudança desta rodada que altera
um NÚMERO que a tela principal do produto mostra (mesmo que só meses depois do deploy).

**Por que parei antes de T4/T5, em vez de seguir direto:**
1. Todo trabalho desta sessão foi direto para `main` (sem branch de PR) — é o padrão que a sessão
   inteira já vinha usando para achado-e-conserto de bug. T3 é qualitativamente diferente: não é
   consertar algo quebrado, é mudar o CRITÉRIO de um número que o dono vê. Vale uma pausa para
   revisão antes de empilhar T4 (UI) em cima.
2. T4 e T5 são mudança de tela, e esta sessão não tem Docker/Supabase local disponível
   (indisponibilidade crônica já registrada) — verificação visual de verdade não é possível agora.
   Construir T4/T5 "às cegas" (só tipo + lint + teste comportamental) empilharia uma SEGUNDA
   categoria de risco (UI não vista) em cima da primeira (número recém-calibrado).
3. Não existe branch separado para abrir PR — commitar T1-T3 direto em `main`, como todo o resto
   da sessão, significa que a revisão humana precisa acontecer OLHANDO o que já está em `main`
   (este documento, `docs/DECISOES.md`, e o diff dos commits), não através de um PR formal.

**O que fica para quando o Eduardo revisar (ou quando Docker local voltar):** T4 e T5, na mesma
ordem e com o mesmo critério de aceite já escritos acima. T6 (medição de oscilação) pode rodar
antes disso, quando houver acesso a dado de produção real — é medição, não mudança de comportamento.
