# Market Intelligence — CICLO

> Síntese cross-cutting da pesquisa de mercado. Detalhe por concorrente em `competitors/`. Fontes:
> `docs/43-POSICIONAMENTO-10X.md`/`docs/45-VANTAGEM-PESQUISA.md`/`docs/46-VANTAGEM-PLANO.md`
> (2026-09-05, pesquisa original) + pesquisa fresca ao vivo em Trinks e Booksy (2026-09-20). Cinco
> concorrentes cobertos: AppBarber, BestBarbers, Trinks, Fresha, Booksy — todos ativos no nicho de
> beleza/barbearia/estética, os dois primeiros focados em barbearia, os três últimos amplos.
>
> Legenda: **[FACT]** verificado no código/banco do CICLO · **[EVIDENCE]** fonte pública citada ·
> **[HYPOTHESIS]** interpretação minha, não verificada · **[UNKNOWN]** sem dado · **[INFERENCE]**
> dedução a partir de evidência, marcada como tal.

---

## 1 · O mercado, por modelo de negócio

| Concorrente | Modelo | Mensalidade de entrada | Comissão/add-on |
|---|---|---|---|
| CICLO | SaaS, preço fixo por tier | R$0 / 49 / 99 / 179 **[FACT]** | Nenhuma |
| AppBarber | App do cliente + painel | R$79,90 (1 prof.) **[EVIDENCE, 09/05]** | — |
| BestBarbers | App + clube de assinatura | **[UNKNOWN]** | — |
| Trinks | Painel + marketplace + conta digital | R$76/mês (1-2 prof., anual) **[EVIDENCE, 20/09]** | WhatsApp/SMS/e-mail marketing são add-on pago **[EVIDENCE, 20/09]** |
| Fresha | Marketplace | US$19,95 (solo) **[EVIDENCE, 09/05]** | **20% de comissão (mín. US$6) por cliente novo do marketplace** **[EVIDENCE, 09/05]** |
| Booksy | Marketplace | US$29,99 (plano único, "tudo incluso") **[EVIDENCE, 20/09]** | Taxa de processamento de pagamento à parte |

**[INFERENCE]** três famílias de modelo coexistem no mesmo mercado: (a) marketplace com comissão
por lead (Fresha), (b) plano fixo com upsell por funcionalidade (Trinks), (c) plano fixo "tudo
incluso" por usuário (Booksy). O CICLO é uma quarta variação: plano fixo por MÓDULO (não por
usuário nem por funcionalidade individual), sem marketplace. Não há um único "padrão do setor" a
seguir — há pelo menos quatro filosofias de pricing testadas em produção por concorrentes reais.

---

## 2 · Conversão: trial com prazo é mais comum que freemium permanente

| Concorrente | Modelo de entrada |
|---|---|
| CICLO | **Freemium permanente** (plano Grátis sem prazo, com teto de uso) **[FACT]** |
| Trinks | Trial de **5 dias** **[EVIDENCE, 20/09]** |
| Booksy | Trial de **14 dias**, sem cartão **[EVIDENCE, 20/09]** |
| AppBarber / BestBarbers / Fresha | **[UNKNOWN]** — não verificado nesta rodada |

**[HYPOTHESIS], não fato:** dos concorrentes com modelo de entrada confirmado, 2 de 2 usam trial
com prazo, não freemium permanente. Isso NÃO prova que freemium é pior — só que o CICLO está numa
posição estruturalmente diferente da maioria observada. Duas leituras possíveis, e não escolho
entre elas sem mais evidência:

- **A favor do freemium do CICLO:** menos pressão de urgência artificial, mais tempo para o Motor
  de Ciclo acumular histórico suficiente para provar valor (que leva semanas, não dias — ver
  `docs/46` "volume mínimo para deixar de ser demonstração": 2-3 meses para a primeira régua
  calibrada). Um trial de 5-14 dias **estruturalmente não dá tempo** do Motor de Ciclo provar nada
  — o visitante sairia do trial antes de ver a previsão funcionar.
- **Contra o freemium:** sem prazo, não há urgência para o visitante DECIDIR — freemium pode virar
  "conta zumbi" que nunca converte, e a pessoa nunca sente o relógio correndo.

**Isso é uma oportunidade de investigação, não uma feature clara** — ver `growth-opportunities.md`
"reduzir tempo até primeira prova de valor do Motor", que ataca o problema de fundo (o Motor
demora a provar) em vez de copiar trial artificial.

---

## 3 · Ativação: tempo-até-primeiro-valor é comunicado explicitamente pelos concorrentes

Booksy promete, em texto, na própria landing: "up and running in less than 5 minutes" + 3 passos
(perfil → compartilhar link → primeiro agendamento) **[EVIDENCE, 20/09]**. Trinks promete
"onboarding personalizado" (assistido, não necessariamente mais rápido) **[EVIDENCE, 20/09]**.

O CICLO promete "Três respostas e sua página está no ar" (`onboarding/page.tsx`, já decidido e
implementado, `docs/DECISOES.md` 24/08) **[FACT]** — mesma categoria de promessa que o Booksy, mas
**o tempo real nunca foi medido** **[UNKNOWN]**. Ver `growth-opportunities.md` — medir e publicar
o tempo real é uma oportunidade de baixo esforço.

---

## 4 · Retenção: o setor usa janela fixa, e sabe que está errada

Achado já registrado em `docs/45` §1.1, com duas citações públicas do próprio setor:

> "Se um cliente não agenda há 45 dias, o sistema de gestão envia um lembrete..." **[EVIDENCE]** —
> Barbeiro.app, guia 2026.

> "O ideal é enviar o convite entre 7 e 15 dias após o atendimento, **dependendo do tipo de corte e
> da frequência de cada cliente**." **[EVIDENCE]** — Blog Trinks.

O próprio blog do maior concorrente do Brasil admite, por escrito, que a régua fixa é a resposta
errada — e vende a régua fixa mesmo assim (não há evidência de que a Trinks tenha um mecanismo de
cadência pessoal; "lembretes e convite de retorno" está descrito como funcionalidade genérica na
matriz de planos). Isso não é um vazio de mercado (ninguém pensou nisso) — é uma posição melhor
para atacar: todo mundo sabe e ninguém entrega **[INFERENCE]**.

O Motor de Ciclo do CICLO já ataca isso por arquitetura (`personal_cycle_days`, por cliente e por
serviço) **[FACT]**. O que falta, e já identificado em `docs/45`/`docs/46` e construído em
`docs/DECISOES.md` (prestação de contas), é a PROVA de que funciona melhor — isso já está em
produção (`/admin/recuperar`, card "Motor acertou X%").

**Comunicação (WhatsApp) incluída vs. add-on pago — achado corrigido, não vira copy.** A Trinks
cobra "recurso adicional ao valor contratado" por rotina de mensagens via WhatsApp
**[EVIDENCE, 20/09]**. O módulo de lembrete/confirmação do CICLO está liberado em todos os tiers
sem upsell **[FACT]** — mas verificação em `src/core/cron/agendadas.ts` (20/09) confirma que a
rota que DISPARA o lembrete (`reminders`) **não roda sozinha em produção**: só `recompute-cycles` e
`segments` estão em `ROTAS_AGENDADAS`. Ligar isso é decisão explícita do dono do produto (`docs/25`
F0 passo 4), ainda não tomada. **Conclusão: não é uma comparação honesta hoje.** O CICLO não pode
alegar "WhatsApp incluído" para uma automação que não roda, pelo mesmo motivo que a própria tabela
de preços já tirou essa linha em 2026-08-24 (`lib/planos-cartoes.ts`, comentário no card do plano
Grátis) e que o CLAUDE.md lista como armadilha conhecida ("Prometer canal... só se houver rota
agendada e credencial existente"). Registrado como oportunidade bloqueada, não como copy pronta —
ver `growth-opportunities.md` GO-2 (revisado).

---

## 5 · Migração/importação: evidência dividida, não conclusiva

| Concorrente | Menciona migração/importação? |
|---|---|
| Trinks | **Sim** — "Migração assistida" é linha nomeada na matriz de planos, e "implementação assistida com migração" é destaque do tier Redes/Franquias **[EVIDENCE, 20/09]** |
| Booksy | **Não** — ausente da home, do catálogo de 60+ features citado e do FAQ pesquisado **[EVIDENCE, 20/09]** |
| AppBarber / BestBarbers / Fresha | **[UNKNOWN]** — não pesquisado |

**Queixa de dono já registrada (`docs/45` §1.5, queixa 5):** medo de dado ficar preso ao trocar de
sistema — "você usa seis meses, cadastra 300 clientes, e na hora de migrar descobre que o dado fica
preso" **[EVIDENCE]** (Blog Belio). Mas a mesma fonte nota que a LGPD já obriga portabilidade (o
salão é controlador, o sistema é operador) — o medo é real, mas o REMÉDIO LEGAL já existe
independente de o CICLO construir algo.

**Leitura honesta, não forçada:** há UM concorrente relevante (o líder do mercado, Trinks) tratando
migração como feature vendável, e um sinal de queixa de dono sobre medo de ficar preso. Isso é
evidência real, mas **parcial e não conclusiva** — não é "3 fontes independentes convergindo", é
"1 concorrente + 1 queixa genérica sobre medo de aprisionamento, não especificamente sobre migrar
PARA um concorrente". A decisão sobre construir a feature "traga seus dados" está em
`growth-opportunities.md`, tratada com o rigor de evidência que o tamanho da decisão pede.

---

## 6 · O que já está bem coberto e não precisa de nova pesquisa

- **Posicionamento e moat** (`docs/43`, `docs/45`, `docs/46`) — pesquisa completa, decisão tomada
  (prestação de contas do Motor), implementada e em produção.
- **Preço e modelo comercial dos 5 concorrentes** — coberto, com 2 confirmados ainda válidos 15
  dias depois (Trinks R$76, Booksy US$29,99).
- **A ferida estrutural do AppBarber/BestBarbers** (app próprio, vitrine de concorrentes) —
  pesquisa rica, já virou argumento de produto.

## 7 · Onde a pesquisa ainda é fraca, e não vale forçar agora

- **UX detalhada de conversão dos formulários de cadastro dos concorrentes** — evitei testar a
  fundo para não arriscar criar contas reais em serviços de terceiro sem necessidade clara.
- **Reviews/reclamações de Trinks, Booksy, Fresha, BestBarbers especificamente** — só o AppBarber
  tem essa camada de evidência. Vale revisitar SE uma oportunidade específica depender disso —
  não pesquisar "porque falta", per a regra de não fazer pesquisa infinita.
- **BestBarbers e Fresha em profundidade** — baixa prioridade: o achado mais acionável de cada um
  já está capturado (mesma limitação estrutural do líder; modelo de comissão), mais detalhe não
  muda decisão nenhuma hoje.
