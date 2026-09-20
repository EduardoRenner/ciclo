# Growth Map — CICLO

> Mapa de aquisição → conversão → ativação → retenção → expansão → referral, como o produto
> funciona HOJE (não aspiracional). Fontes: leitura do código-fonte (`[FACT]`), `.claude/ciclo/
> product-map.md`, `market-intelligence.md`, `docs/09-PLATAFORMA.md`, `docs/18`, `docs/30`.

---

## Aquisição

**Como existe hoje `[FACT]`:**
- SEO orgânico — `sitemap.ts`, `robots.ts`, `llms.txt`, `metadataBase`, structured data já
  configurados (memória de sessão: "CICLO — SEO no lançamento").
- **Página do negócio (`/{slug}`) indexável no Google** — cada salão que usa o CICLO vira uma
  página pública, potencialmente um canal de aquisição para OUTROS donos que a encontrem buscando
  "sistema de agendamento" ou o nome do salão.
- **Indicação entre donos (B2B)** — laço de ponta a ponta desde 30/08 (`docs/30` §3,
  `core/billing/convite-do-ciclo.ts`), na tela "Meu plano".
- **Indicação entre clientes finais (B2C)** — cliente satisfeita indica outra cliente, ganha algo
  do salão (`docs/30`, ligado ao fluxo de avaliação pós-atendimento).
- Nenhum anúncio pago, nenhuma parceria, nenhuma comunidade ativa conhecida **[UNKNOWN se existe
  algo fora do código — este mapa só enxerga o que está no produto]**.

**O que NÃO existe:** conteúdo/blog institucional, ferramenta gratuita autônoma (ex.: calculadora
pública), integração com terceiros que traga tráfego, qualquer canal pago.

## Conversão (landing → cadastro)

**Como existe hoje `[FACT]`:**
- `h1` da home: "A lista de quem devia ter voltado e não voltou" — sobre o Motor de Ciclo, não
  sobre agenda.
- FAQ neutraliza objeções (não precisa app, não vê concorrência) — já reposicionado como
  diferencial estrutural, não só resposta defensiva (`docs/43` item A/B).
- `/precos` com os 4 tiers publicados, comparação honesta de custo com modelo de comissão
  (`docs/43` item C).
- CTA principal: "Criar minha conta grátis" — modelo **freemium permanente**, não trial com prazo
  (contraste com 2 de 2 concorrentes verificados nesta rodada — ver `market-intelligence.md` §2).

## Ativação (cadastro → primeiro valor)

**Como existe hoje `[FACT]`:**
- Onboarding de 3 perguntas (nome do negócio, profissão, endereço da página) — "Três respostas e
  sua página está no ar", decisão registrada em `docs/DECISOES.md` 24/08.
- Depois do onboarding: painel cai em `/admin/hoje`, que já tem Central de Ações sugerindo o que
  fazer ("Primeiros passos" quando não há cliente nem agendamento ainda).
- **Onde o valor de verdade aparece:** só depois de acumular histórico de atendimento — o Motor de
  Ciclo não tem o que prever sem pelo menos um atendimento concluído por cliente/serviço
  (`computeCycle`, exige `history.length > 0`).
- **Tensão estrutural, já identificada em `docs/46`:** a régua calibrada (a versão mais convincente
  da prova de valor) leva **2-3 meses de uso real** para um serviço de ciclo curto (barbearia). Não
  há atalho de engenharia para isso — é tempo de operação, não esforço de produto.

## Retenção (o que traz a pessoa de volta)

**Como existe hoje `[FACT]`:**
- Tela "Hoje" como hábito diário (resumo do dia, Central de Ações).
- Push notification (`docs/DECISOES.md`, TICKET-056) — opt-in, não automático.
- Nenhum e-mail de reengajamento identificado no código (fora do fluxo transacional).
- **O próprio Motor de Ciclo é o mecanismo de retenção do CLIENTE FINAL do salão** (traz a cliente
  de volta) — mas o mecanismo de retenção do DONO no CICLO (o que faz ELE continuar usando o
  produto) é mais fraco e menos instrumentado: hoje é "a tela Hoje é útil todo dia" e pouco mais.

## Expansão

**Como existe hoje `[FACT]`:** 4 tiers com módulos crescentes (estoque, campanhas, orçamentos,
equipe, fidelidade, clube) — `podeUsarModulo`, com `BloqueioPlano` mostrando o que o degrau de cima
faz. Central de Ações já sugere upgrade quando o tenant está perto do teto do plano
(`plano-perto-do-teto`, já corrigido nesta sessão — BL-11 anterior à missão de growth, não desta
rodada).

## Referral

**Como existe hoje `[FACT]`:** dois laços distintos, ambos já construídos —
1. **B2B** (dono indica dono) — `docs/30` §3, tela "Meu plano".
2. **B2C** (cliente indica cliente) — ligado ao fluxo pós-avaliação, moldura de presente (não
   "indique e ganhe" — pesquisa mostrou que essa moldura trava indicação por parecer venda).

**O que falta medir:** volume de indicações enviadas vs. convertidas em ambos os laços — mesmo
problema de instrumentação do `funnel.md`.

---

## Leitura geral: onde o mapa é forte e onde é fraco

**Forte, com mecanismo real construído:** conversão (positioning claro, pricing transparente),
referral (dois laços completos), o CONCEITO de ativação rápida (3 perguntas).

**Fraco, não por falta de ideia, mas por falta de MEDIÇÃO:** tudo que depende de saber "quantas
pessoas" e "quanto tempo" — aquisição, ativação real (vs. teórica), retenção do DONO (distinto da
retenção do cliente final, que o produto já ataca bem).

**A lacuna mais cara:** o tempo entre "onboarding completo" e "primeiro valor de verdade do Motor"
é estruturalmente longo (meses), e nada no produto hoje preenche essa espera com valor
intermediário perceptível — ver `growth-opportunities.md`, grupo Ativação.
