# Growth Opportunities — CICLO

> Oportunidades concretas, não ideias soltas. Cada uma cita evidência real. Agrupadas por etapa do
> funil (`market-intelligence.md`/`growth-map.md`/`segments.md`/`competitors/` são a base). Legenda
> de confiança: **alta** (múltiplas fontes independentes) · **média** (uma fonte sólida) · **baixa**
> (hipótese razoável, sem fonte direta).

---

## GO-0 · Instrumentar o funil com dado que já existe no banco

- **Problema:** quase toda etapa do funil (`funnel.md`) está marcada UNKNOWN — não por falta de
  dado, mas por falta de alguém consultá-lo. Não há visibilidade de quantos tenants completam
  onboarding, ativam (1º atendimento concluído), ou de quanto tempo isso leva.
- **Evidência:** leitura de código — `tenants`, `appointments`, `cycle_predictions` já têm tudo
  necessário para responder "quantos completaram onboarding", "quantos ativaram", "em quanto
  tempo". `package.json` confirma zero SDK de analytics de tráfego (não é o mesmo problema, não
  precisa ser resolvido junto).
- **Achado ao investigar: a ferramenta já existe.** `scripts/metricas-ativacao.mjs` já mede
  exatamente isto — ativação, 1º agendamento, "momento aha" (via página pública), retenção 30/90
  dias, sinais de churn — com um guard que detecta se o resultado é seed em vez de uso real. **GO-0
  não é "construir", é "rodar com acesso a produção".** Tentei rodar nesta sessão e o ambiente local
  aponta para Supabase não-iniciado, não produção — ver `experiments.md` EXP-01 para o raciocínio
  completo de por que não reconfigurei credenciais autonomamente.
- **Segmento:** todos.
- **Etapa do funil:** onboarding → ativação → retenção (mede todas de uma vez).
- **Impacto potencial:** alto — é pré-requisito para validar QUALQUER outra oportunidade deste
  documento com dado real em vez de suposição.
- **Esforço estimado:** ~zero — o script já existe, pronto, testado, documentado. O esforço restante
  é só rodar `node scripts/metricas-ativacao.mjs` com credenciais de produção.
- **Risco:** baixo para rodar (é leitura); a única parte sensível é garantir que quem roda já tem
  acesso legítimo às credenciais — não é uma decisão de produto, é uma ação operacional.
- **Confiança:** alta.
- **Hipótese:** ao medir, vamos descobrir que a maior perda está numa etapa específica (provável
  candidata: onboarding → primeiro agendamento, dado o tempo que o Motor leva para provar valor) —
  mas isto É a hipótese a testar, não uma conclusão.
- **Experimento sugerido:** já implementado — só falta executar (`experiments.md` EXP-01).
- **Métrica de sucesso:** relatório roda contra produção e produz números reais.
- **Dependências:** acesso a credenciais de produção (`SUPABASE_SERVICE_ROLE_KEY` real).
- **Status:** **bloqueado por acesso, não por trabalho pendente** — a única ação que falta em todo
  este documento é alguém com acesso configurado rodar um script que já existe.

---

## GO-1 · "Traga seus dados" — decisão sobre a feature (prioridade #10 pedida)

- **Problema investigado:** existe evidência suficiente para justificar construir uma feature de
  importação/migração de dados de concorrentes?
- **Evidência coletada (múltiplas fontes, ver `market-intelligence.md` §5):**
  1. Um concorrente relevante (Trinks, líder do mercado) nomeia "Migração assistida" como feature,
     mas como parte do tier enterprise/franquia — não uma oferta de massa **[EVIDENCE]**.
  2. Um concorrente relevante (Booksy) NÃO menciona migração em lugar nenhum da comunicação
     pesquisada **[EVIDENCE]** — evidência dividida, não convergente.
  3. Uma queixa de dono sobre "medo de dado ficar preso" existe (`docs/45` §1.5), mas a mesma fonte
     nota que a LGPD já resolve isso juridicamente — o medo é real, a resposta de produto óbvia
     (exportar) não é fosso nem urgência.
  4. **Achado desta rodada, decisivo: o CICLO já tem a feature.** `/admin/clientes/importar`
     (CSV, com preview/mapeamento de colunas/validação, 337 linhas) e `/admin/clientes/ja-atendo`
     (entrada em lote por memória, sem precisar de planilha) já existem, já alimentam o Motor de
     Ciclo com a data da última visita, e **já foram iterados duas vezes** (09/10 e 09/11) com
     raciocínio real sobre o público: a maioria de barbeiro/manicure/depiladora não tem CSV, então
     o caminho PRINCIPAL virou digitação assistida, com CSV como alternativa — não o contrário.
  5. **Colocação já é ótima:** "Traga quem você já atende" é uma das únicas DUAS ações sugeridas em
     `PRIMEIROS_PASSOS` — a primeira coisa que todo tenant novo vê na tela "Hoje" quando ainda não
     tem cliente nem agendamento.
  6. Já está comunicado na landing (FAQ: "Eu já tenho minha lista de clientes. Dá para trazer?").
- **Segmento:** todos (mas a decisão de priorizar digitação sobre planilha já reflete o segmento
  real: barbearia/salão pequeno, não rede com sistema legado a exportar).
- **Etapa do funil:** ativação.
- **Veredito:** **não construir mais.** A evidência para o PROBLEMA (medo de ficar preso, fricção
  de troca) é real mas fraca-a-média, e — mais importante — **a resposta proporcional a essa
  evidência já existe, já foi validada por iteração, e já está bem posicionada**. Construir uma
  camada nova (importação de XLSX/PDF/screenshot, ou uma página dedicada "migre do Trinks") seria
  investir esforço numa evidência que não pede mais do que já foi dado. Isto é exatamente o cenário
  que a regra 6 do prompt de growth descreve: não copiar feature de concorrente sem prova de que
  resolve problema relevante — aqui a prova existe, e ela já resultou em algo mais simples e mais
  certeiro que "copiar a Migração Assistida do Trinks" teria produzido.
- **Confiança no veredito:** alta.
- **O que vale a pena, se algo:** confirmar com dado real (GO-0) se `ja-atendo`/`importar` têm taxa
  de conclusão baixa no onboarding — SE tiverem, o problema não é "falta a feature", é fricção
  dentro da feature que já existe, uma investigação totalmente diferente.
- **Status:** decidido — não construir. Registrado para não reabrir sem evidência nova.

---

## GO-2 · "WhatsApp incluído" — revisado: NÃO é copy pronta, é um produto incompleto

- **Problema original:** o CICLO incluiria lembrete/confirmação por WhatsApp no produto central,
  enquanto o maior concorrente do Brasil cobra isso como "recurso adicional". Ia virar 1 linha de
  copy em `/precos`.
- **Por que mudei de ideia ao tentar implementar:** verifiquei `src/core/cron/agendadas.ts` antes
  de escrever a copy (hábito deste projeto: nunca prometer canal sem rota agendada — está
  literalmente listado em `CLAUDE.md` como armadilha conhecida) e confirmei que a rota `reminders`
  **não dispara sozinha em produção** — só `recompute-cycles` e `segments` rodam automaticamente.
  O módulo está liberado em todo tier (não é upsell), mas a automação em si está desligada por
  decisão explícita e ainda pendente do dono do produto (`docs/25` F0 passo 4). A mesma tabela de
  preços já removeu essa linha de copy em 2026-08-24 pelo mesmo motivo (`lib/planos-cartoes.ts`).
- **Veredito:** **não escrever a copy comparativa agora** — seria prometer um canal que não roda,
  o erro mais caro que este produto pode cometer segundo o próprio `CLAUDE.md`. Fazer isso teria
  sido pior do que não pesquisar: uma promessa pública sobre algo que não funciona.
- **O que isso revela de mais valioso:** a decisão de ligar `reminders` em produção — que já está
  identificada, já tem o código pronto, só falta a decisão — é o item que DESBLOQUEIA ao mesmo
  tempo (a) uma automação real de retenção do cliente final do salão, e (b) o argumento de
  marketing "WhatsApp incluído" que este item tentou escrever cedo demais.
- **Segmento:** todos.
- **Etapa do funil:** retenção (o real) e conversão (a copy, só depois).
- **Impacto potencial:** alto — é o mecanismo mais citado deste documento inteiro (`market-
  intelligence.md` §4) como diferencial estrutural do Motor de Ciclo, e ele está com o motor
  desligado.
- **Esforço estimado:** a decisão em si é de negócio, não de código (código já existe). Ligar tem
  custo de engenharia baixo; a parte cara é operacional — mensagem real para cliente final de
  tenant real, que exige confiança no conteúdo/frequência antes de ligar.
- **Risco:** **alto para eu ligar sozinho** — mensagem para terceiro (cliente final do salão, não
  o dono do CICLO), decisão já marcada no próprio código como "decisão do dono do produto". Isto
  cai diretamente na categoria de ação que precisa de aprovação explícita, não de autonomia de
  pesquisa de mercado.
- **Confiança:** alta (é leitura direta de código, não interpretação).
- **Recomendação:** registrar como pendência de decisão do Eduardo, não como tarefa que eu executo.
  A copy de `/precos` só pode dizer "WhatsApp incluído" no dia em que isto for verdade em produção.
- **Status:** **corrigido e não implementado — dependência de decisão do produto, fora da minha
  autonomia de pesquisa de crescimento.**

---

## GO-3 · Medir e publicar o tempo real de ativação (benchmark contra o "<5min" do Booksy)

- **Problema:** o CICLO promete "Três respostas e sua página está no ar" — mesma categoria de
  promessa que o "<5 minutos" do Booksy — mas nunca mediu quanto tempo isso leva de verdade.
- **Evidência:** `biz.booksy.com`, pesquisado ao vivo 2026-09-20 **[EVIDENCE]** — "up and running
  in less than 5 minutes" é promessa explícita e central da landing deles. CICLO: promessa
  qualitativa (3 perguntas), tempo real nunca instrumentado **[FACT + UNKNOWN]**.
- **Segmento:** todos.
- **Etapa do funil:** conversão → ativação (é a ponte entre as duas).
- **Impacto potencial:** médio — número medido e citável ("seu site fica pronto em N minutos") é
  mais forte que "três respostas" para quem está comparando ofertas.
- **Esforço estimado:** baixo — timestamp de início (clique em "criar conta") a fim (onboarding
  completo) já são momentos existentes no banco; falta só consultar.
- **Risco:** baixo, com ressalva: só publicar o número se ele for BOM. Se a mediana real for alta,
  isso é achado de produto (onde está a fricção), não achado de marketing.
- **Confiança:** média — depende de GO-0 estar feito primeiro.
- **Hipótese:** o tempo real de onboarding (as 3 perguntas em si) é provavelmente rápido — a
  pergunta mais interessante é quanto tempo até o PRIMEIRO AGENDAMENTO, que é o "up and running"
  real do Booksy (eles medem até "getting booked", não até o cadastro).
- **Experimento sugerido:** medir os dois momentos separadamente (onboarding completo vs. primeiro
  agendamento criado) antes de decidir qual publicar.
- **Métrica de sucesso:** mediana de tempo conhecida e documentada.
- **Dependências:** GO-0.
- **Status:** bloqueado por GO-0.

---

## GO-4 · A lacuna de tempo entre onboarding e prova de valor do Motor (2-3 meses)

- **Problema:** `docs/46` já documentou que a régua calibrada do Motor de Ciclo leva 2-3 meses
  (barbearia) para acumular amostra mínima (8 voltas por serviço). Nada no produto hoje preenche
  essa espera com valor intermediário perceptível.
- **Evidência:** `docs/46` §"Volume mínimo para deixar de ser demonstração" **[FACT, já
  documentado]**; `core/cycle/compute.ts` confirma `MINIMO_DE_AMOSTRA` como barreira real, não
  estimativa solta.
- **Segmento:** todos, mais agudo para ciclo longo (estética) que ciclo curto (barbearia).
- **Etapa do funil:** ativação → retenção (é literalmente o "vale da morte" entre as duas).
- **Impacto potencial:** alto, SE confirmado por GO-0 que é aqui que a perda acontece — hoje é
  hipótese razoável, não medida.
- **Esforço estimado:** médio — não é uma mudança de copy, é desenhar o que a tela "Hoje"/
  "Recuperar" mostra ANTES de a régua estar calibrada (hoje: `SEM_AMOSTRA` mostra "—", correto e
  honesto, mas não é VALOR intermediário, é ausência marcada com honestidade — coisas diferentes).
- **Risco:** médio — fácil de "inventar precisão que não existe" tentando preencher esse vazio, que
  é exatamente o erro que este projeto já se cobrou de evitar antes (regra 5.3 do CLAUDE.md).
- **Confiança:** baixa-média — a barreira de tempo é fato medido; que ela CAUSA abandono é
  hipótese, não confirmada por dado de comportamento real (que não existe, ver GO-0).
- **Hipótese:** um dono que importou clientes com data de última visita (`GO-1`/`ja-atendo`) já
  ativa o Motor no primeiro dia — a lacuna de 2-3 meses é principalmente para quem NÃO importou.
  Se verdade, a alavanca certa não é "inventar valor intermediário", é aumentar a TAXA de quem usa
  `ja-atendo`/`importar` no onboarding, que volta a fazer da GO-0 o próximo passo certo.
- **Experimento sugerido:** depois de GO-0, comparar tempo-até-primeira-prova-de-valor entre quem
  usou `ja-atendo`/`importar` vs. quem não usou.
- **Métrica de sucesso:** diferença mensurável entre os dois grupos.
- **Dependências:** GO-0.
- **Status:** **causa raiz encontrada e corrigida, 2026-09-20/21** (missão de onboarding/ativação,
  pedido direto do Eduardo). A hipótese acima já apontava a alavanca certa — "aumentar a TAXA de
  quem usa `ja-atendo`" — mas a causa de a taxa ser baixa não era falta de destaque na copy: era
  que `/admin/clientes/ja-atendo` **não tinha NENHUM link em lugar nenhum do painel**. A própria
  página já dizia, no próprio código, ser "a porta da base para quem NÃO tem planilha — que é a
  MAIORIA do público do produto" — e ainda assim só era alcançável digitando a URL de cabeça.
  `admin/clientes/importar` (a porta para a MINORIA, quem já tem CSV) estava linkada de
  `clientes/lista.tsx`; `ja-atendo` não estava em lugar nenhum. Corrigido: link adicionado ao
  estado vazio de `clientes/lista.tsx`, ANTES do link de CSV (mesma prioridade que o docstring da
  própria página já estabelecia). Ver `.claude/ciclo/autonomous-backlog.md` BL-37 para a mudança
  completa. GO-0 continua sendo o próximo passo para MEDIR o efeito — este achado não substitui a
  instrumentação, só remove um bloqueio mecânico que a instrumentação, sozinha, não teria explicado
  (a taxa seria baixa por um motivo que nenhum evento de analytics apontaria: a porta não existia).

---

## GO-5 · Segmentação fora de beleza é hipótese não testada, não é lacuna a preencher às pressas

- **Problema investigado:** o catálogo suporta 8 grupos de profissão (`segments.md`), mas toda
  pesquisa competitiva e todo cliente demo são do grupo beleza.
- **Evidência:** `segments.md` §2-4 — zero concorrente pesquisado fora de beleza, catálogo fino
  (1 profissão) nos grupos casa/fitness/saúde/educação/eventos, dois grupos (pet/profissional) sem
  nenhuma profissão seedada ainda.
- **Segmento:** casa, fitness, saúde, educação, eventos, pet, profissional.
- **Etapa do funil:** aquisição (é sobre QUEM buscar, não sobre otimizar quem já chegou).
- **Impacto potencial:** desconhecido — pode ser alto (mercado adjacente sem concorrente mapeado)
  ou baixo (schema generalizado num grupo que nunca teve demanda real testada).
- **Esforço estimado:** o de PESQUISA é baixo (mesma forma deste documento, aplicada a um grupo);
  o de PRODUTO seria alto se a pesquisa achar que vale investir.
- **Risco:** médio — dividir foco de marketing/pesquisa entre 8 grupos quando beleza ainda tem
  zero pagante (`docs/43`) é espalhar esforço antes de provar o primeiro segmento.
- **Confiança:** baixa — é puramente hipótese, marcada como tal deliberadamente.
- **Recomendação:** **não investigar agora.** Não é porque a hipótese seja ruim — é porque o
  produto ainda não tem NENHUM pagante no segmento onde já investiu pesquisa pesada (beleza). Abrir
  uma frente de pesquisa nova antes de validar a primeira dilui o "não faça pesquisa infinita" para
  o lado errado: mais amplitude em vez de mais profundidade onde já há tração de conhecimento.
- **Status:** registrado, explicitamente não priorizado — para não desaparecer da memória do
  projeto nem para ser perseguido sem motivo.

---

## Agrupamento por área (visão consolidada)

| Área | Oportunidades |
|---|---|
| **Medição/fundação** | GO-0 (instrumentar funil) — bloqueia GO-3 e GO-4 |
| **Retenção (produto, não copy)** | GO-2 revisado — ligar `reminders` em produção é decisão do Eduardo, não tarefa de pesquisa |
| **Ativação** | GO-3 (tempo real de onboarding), GO-4 (lacuna de prova de valor) |
| **Migração/importação** | GO-1 (decidido: não construir mais) |
| **Aquisição** | GO-5 (registrado, não priorizado) |
| **Conversão, Expansão, Referral** | Sem oportunidade concreta nova nesta rodada — `growth-map.md`
  já documenta os mecanismos existentes; nenhuma evidência desta pesquisa aponta lacuna específica
  aqui ainda. Não forçado. |

## Próximo passo recomendado

**Duas pendências, ambas fora da minha autonomia de pesquisa, ambas para o usuário:**

1. Rodar `node scripts/metricas-ativacao.mjs` com credenciais de produção. Três das cinco
   oportunidades de medição (GO-0, GO-3, GO-4) dependem só disto para sair de hipótese para decisão
   — a ferramenta já está pronta, só falta acesso.
2. Decidir se liga a rota `reminders` em produção (`docs/25` F0 passo 4, já pendente antes desta
   pesquisa) — hoje é a ação de maior impacto potencial deste documento (GO-2 revisado), mas é
   mensagem automática para cliente final de tenant real, então fica com o dono do produto.

**Dentro da minha autonomia, nada neste lote ficou pronto para eu implementar sozinho sem uma
dessas duas decisões primeiro** — cada oportunidade de maior impacto (GO-0, GO-2, GO-3, GO-4)
esbarrou em acesso a produção ou em decisão de negócio ao ser verificada com rigor, não em falta de
ideia. Isso não invalida a pesquisa — é exatamente o tipo de achado que a valida: melhor descobrir
o bloqueio agora do que implementar algo que não pode rodar ou não deveria ser prometido.
