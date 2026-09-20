# Booksy

> Marketplace global de agendamento em beleza/barbearia, ativo no Brasil. Posicionamento e preço
> já mapeados em `docs/43`/`docs/45` (2026-09-05); esta entrada acrescenta pesquisa fresca de
> conversão/ativação/onboarding, feita ao vivo em `biz.booksy.com` (site americano — Booksy
> também opera com site/preço próprio por país; o valor abaixo é o do mercado US, usado aqui como
> proxy de estratégia global, não necessariamente o preço cobrado no Brasil) **[P, 2026-09-20]**.

---

## Posicionamento

- **Promessa:** "All-in-One Booking & Scheduling Software" — plataforma completa (agenda,
  pagamento, marketing, equipe) + acesso a um marketplace de clientes locais buscando ativamente
  **[P, 2026-09-20]**.
- **Público:** desde profissional autônomo ("solo barber") até salão completo — mesma amplitude de
  segmento que Trinks, oposto ao foco do CICLO.
- **Escala declarada:** 330.000+ profissionais, 44+ milhões de clientes finais no marketplace
  global **[P, 2026-09-20]** — mesma ordem de grandeza de rede que Trinks, ambos MUITO maiores que
  qualquer coisa que o CICLO possa competir por volume.
- **Métrica de resultado como prova social:** "20% MORE BOOKINGS per customer" e "25% DROP IN
  NO-SHOWS and cancellations" **[P, 2026-09-20]** — números agregados de toda a base, não por
  salão. **[HYPOTHESIS]** é o padrão do setor mostrar resultado agregado da plataforma; o CICLO
  mostrar resultado POR SALÃO (prestação de contas do Motor) é uma categoria diferente de prova,
  mais pessoal e mais verificável por quem já usa — mas não tem o peso de "44 milhões de reservas"
  atrás.

## Produto

Agenda, pagamentos integrados (Tap to Pay, maquininha própria), gestão de equipe (turnos,
comissão, permissão por cargo), marketing (mensagem em massa, e-mail/SMS com templates), programa
de fidelidade digital (cartão de carimbo), pacotes pré-pagos, lista de espera automática, proteção
contra no-show (política de cancelamento configurável, cobrança de depósito/taxa) **[P,
2026-09-20]**. "Ver todas as 60+ funcionalidades" — catálogo amplo, não um produto enxuto.

## Conversão

- **CTA dominante:** "Start free now" / "Try free for 14 days" — **trial de 14 dias, sem cartão de
  crédito** **[P, 2026-09-20]**. Mais longo que o trial de 5 dias do Trinks.
- **Pricing:** **plano único, "every feature included"** — US$ 29,99/mês + US$ 20 por usuário
  adicional **[P, confirma valor de `docs/43`, 15 dias depois]**. Sem matriz de tiers por
  funcionalidade como o Trinks — packaging por NÚMERO DE PESSOAS, não por recurso.
  **[INFERENCE]** essa é uma filosofia de pricing genuinamente diferente da do Trinks (que trava
  feature por tier) e da do CICLO (que trava MÓDULO por tier, incluindo pessoas). Três modelos de
  packaging coexistindo no mesmo mercado — não há um "padrão do setor" único aqui.
- **Prova social:** depoimentos com nome, foto, link de perfil real no Booksy — mistura prova
  social com demonstração do próprio produto (o perfil citado É o produto).

## Ativação

Passo a passo publicado explicitamente na landing **[P, 2026-09-20]**:
1. "Set up your profile — Start for free, no credit card... up and running in less than 5
   minutes."
2. "Share your booking link" — WhatsApp/redes sociais/QR code.
3. "Start getting booked" — cliente agenda sozinho no mesmo dia.

**Isto é uma promessa explícita de tempo-até-primeiro-valor: menos de 5 minutos até a página estar
pronta para receber agendamento** **[P, 2026-09-20]**. É o benchmark mais direto e citável que
existe para comparar com o onboarding do CICLO ("Três respostas e sua página está no ar" — mesma
categoria de promessa, vale medir o tempo real de cada um lado a lado — ver
`growth-opportunities.md`).

## Retenção

"Automated rebooking reminders" citado, sem detalhar se é janela fixa ou personalizada — **[UNKNOWN]**,
não há evidência direta aqui (diferente do Trinks, onde o blog do próprio concorrente confirmou
janela fixa). Cartão de fidelidade digital como mecanismo de retorno — mecanismo de recompensa,
não de PREVISÃO de quando a pessoa deveria voltar.

## Modelo comercial

Plano único global, sem gate de funcionalidade por preço (a única variável é nº de usuários) — ver
nota acima sobre packaging. Pagamento processado via Stripe; taxas de processamento cobradas à
parte ("*Payment processing & hardware not included").

## UX — pontos fortes e fricções observáveis

- **Forte:** a landing conta uma HISTÓRIA de 3 passos, não uma lista de recursos — reduz a
  pergunta "por onde eu começo" antes mesmo do cadastro.
- **Forte:** FAQ extenso e específico (segurança/compliance, como funciona o marketplace, como
  aparece na busca do Google) — antecipa objeção, não só explica funcionalidade.
- **Nada de "migração"/"importar dados de outro sistema" na home, produto ou FAQ pesquisados** —
  ausência notável, contraste direto com o Trinks. **[P, 2026-09-20]**

## O que isso sugere para o CICLO

1. **Segundo ponto de dado sobre o modelo de trial**: dois dos cinco concorrentes pesquisados usam
   trial com prazo (Trinks 5 dias, Booksy 14 dias) em vez de freemium permanente. Vale como
   HIPÓTESE a investigar, não decisão — ver `market-intelligence.md` §Conversão.
2. **Ausência de "migração" na comunicação do Booksy** enfraquece (não descarta) a tese de que
   migração é demanda universal do setor — é dividida: um concorrente relevante nomeia, outro
   relevante não menciona.
3. **"< 5 minutos até a página pronta"** é uma promessa medível e comparável — dá para medir o
   tempo real do onboarding do CICLO contra essa referência concreta, em vez de comparação vaga.
