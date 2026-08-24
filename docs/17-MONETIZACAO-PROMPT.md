# 17 · PROMPT — MONETIZAÇÃO, PREÇO E CRESCIMENTO DO CICLO

> Briefing acordado com o Eduardo em 2026-08-24. Este arquivo **não é o plano** — é o contrato de
> como o plano tem que ser feito. O plano é `docs/18-MONETIZACAO-PLANO.md`, e só nasce depois
> deste ser aprovado.

---

## 0 · Papel

Atuar simultaneamente como:

- **Head de Monetização de SaaS B2B de ticket baixo** — autoatendimento, volume, margem apertada
- **Pesquisador de mercado brasileiro** de software para autônomo e micronegócio
- **Economista comportamental aplicado a preço** — ancoragem, enquadramento, aversão à perda
- **Growth engineer** — laços de crescimento (loops), não funil de anúncio
- **Engenheiro de billing** — recorrência, inadimplência, proração, idempotência, webhook
- **Advogado de contrato de consumo (CDC + LGPD)** na parte que muda o produto
- **Contador de guardanapo** — sabe fazer a conta antes de fazer a tese
- **Red teamer do próprio plano** — §8 é obrigatório, não decorativo

### 0.1 · O modo de falha número um deste trabalho

Um modelo de linguagem escrevendo estratégia de negócio produz, por padrão, **consultoria
plausível que concorda com quem pediu**: cinco alavancas, três pilares, uma matriz 2×2, tudo
correto em tese e inútil na segunda-feira. Isso é pior que não fazer, porque parece pronto.

O antídoto está espalhado em regras concretas neste documento (§2 padrão de evidência, §7
classificação, §8 red team, §11 previsões falsificáveis). **Se em algum momento a resposta
honesta for "não construa isso ainda", a resposta é essa** — e vale mais que qualquer plano.

---

## 1 · Contexto em uma frase

O CICLO é um SaaS multi-tenant em produção (`ciclo-umber.vercel.app`) para autônomos e
micronegócios de serviço no Brasil — 17 profissões no catálogo, de barbearia a eletricista — que
**nunca cobrou de ninguém**, não tem limite por plano, não tem cobrança e tem exatamente **dois
tenants reais e zero pagantes**.

---

## 2 · Como trabalhar — padrão de evidência

Esta seção é o que separa este plano de um texto bonito.

### 2.1 · Pesquisa é com ferramenta, não de memória

Preço de concorrente **muda**, e conhecimento treinado envelhece. Toda cifra de mercado sai de
`WebSearch` + `WebFetch` na página real, com **URL e data de consulta**. Sem exceção.

Se um concorrente **não publica preço** ("fale com um consultor"), isso **é um achado** e entra na
tabela como tal — diz muito sobre o segmento e sobre onde o CICLO pode se diferenciar sendo
transparente.

### 2.2 · Fato do próprio produto é lido, não lembrado

Antes de afirmar qualquer coisa sobre o CICLO, ler: o código, o schema, o banco de produção
(consulta só-leitura), `docs/09-PLATAFORMA.md`, `docs/DECISOES.md` e o `git log`. Este projeto já
teve caso de decisão registrada sendo redescoberta do zero — e caso de estrutura construída em
cima de suposição errada sobre o que existia.

### 2.3 · Conta é feita e mostrada

Nenhum número de receita, custo ou ponto de equilíbrio aparece sem a aritmética visível. "Precisa
de ~40 assinantes" sem a conta é chute com cara de análise.

### 2.4 · Três rótulos, nunca misturados

| Rótulo | Significa |
|---|---|
| **Medido** | Vem de fonte externa citada, ou do banco/código deste projeto |
| **Estimado** | Cálculo próprio a partir de coisas medidas — a fórmula aparece |
| **Suposto** | Não há base; é premissa de trabalho, e está marcada como tal |

Um "Suposto" apresentado como "Medido" é o defeito mais grave que este documento pode ter.

---

## 3 · O que JÁ existe — não reconstruir, não ignorar

Levantado no código e no banco de produção em 2026-08-24.

| Peça | Estado real |
|---|---|
| `tenants.plan` (enum `plan_tier`) | **Existe**: `gratis`, `pro`, `profissional`, `avancado`. **Zero linhas leem essa coluna.** |
| `tenant_modules` (0025) | **Existe**: `(tenant_id, modulo, ligado, origem)`, `origem in ('plano','dono')` — feita para distinguir "bloqueado pelo plano" de "você desligou". **Nenhuma tela lê.** |
| `payments` (0001) | **Existe** com `psp`, `psp_charge_id`, `psp_payload`, `pix_qr`, `pix_copy_paste`, `installments`, `fee_cents`, `net_cents`. Nenhum PSP integrado. |
| `webhook_events` | **Existe**, RLS ligada, zero políticas (só `service_role`). **Nada escreve nela.** |
| `FEATURE_*` (4 flags) | **Existem no Vercel de produção**, **nenhuma é lida**, e são **globais** — não conseguem, por natureza, ligar coisa por tenant. |
| `subscription_plans` / `client_subscriptions` (0019) | **Existem e funcionam** — são o **salão vendendo plano para a CLIENTE dele**. Nada a ver com o CICLO cobrar do salão. ⚠️ Colisão de nome (§5.6). |
| `clients.referred_by` + bônus | **Existe** — cliente indicando cliente **para o salão**. Indicação tenant→tenant é mecanismo **novo**. |
| Selo "Feito com CICLO" | **Existe sem condição nenhuma.** Não amarrar a plano foi decisão consciente (P6), tomada quando cobrança estava bloqueada. |
| `09-PLATAFORMA.md §6` | **16 módulos** já desenhados, com padrão por eixo de profissão. |
| `09-PLATAFORMA.md §13` | **4 regras de engenharia de cobrança já decididas** (§5.1–5.4). |
| `09-PLATAFORMA.md §13.1` | Já decidido: grátis é **canal de distribuição**; indicação **dos dois lados, um mês cada**. |
| `09-PLATAFORMA.md §13.2` | Métricas de ativação/retenção definidas, **nenhuma instrumentada**. |
| Base real | `dom-rocha` (demo real) e `ruivo-barber` (teste). **Zero pagantes.** |
| CI | Existe e roda desde 2026-08-24. |

---

## 4 · As tensões que o plano tem que RESOLVER

### 4.1 · Zero clientes pagantes — a tensão central

Escada de 3 planos, proração, inadimplência e portal de autoatendimento **antes do primeiro
R$ 1** é o erro mais caro desta categoria. Separar, sem misturar:

- **O mínimo para cobrar do cliente nº 1** — pode ser vergonhosamente manual (link de pagamento
  no WhatsApp + `update` no banco);
- **A máquina de planos**, que só se paga com dezenas de assinantes.

Se as duas caírem na mesma fase, o plano está errado.

### 4.2 · Não existe cron em produção

`vercel.json` está com `crons: []`. Cobrança recorrente **é** trabalho agendado: retentativa de
cartão, expiração de carência, rebaixamento, aviso de renovação. Escolher e justificar: Vercel Pro
(US$ 20/mês), cron externo grátis (o endpoint já tem `CRON_SECRET` com comparação de tempo
seguro), ou desenho preguiçoso que dispense agendamento. **Não pode fingir que resolve.**

### 4.3 · `pro` e `profissional` são dois planos diferentes hoje

Ninguém distingue os dois numa tabela de preço. Defeito herdado da migration 0030. Renomear é
grátis agora (nada lê a coluna) e caro depois.

### 4.4 · O pedido fala em 3 planos; o enum tem 4 valores

`gratis` + 3 pagos fecha em 4. Se a intenção for 3 no total, o enum muda. Decidir de propósito.

### 4.5 · Preço tem que ser pesquisado

Já houve neste projeto preço "plausível de mercado" inventado e registrado honestamente como
pendência. Não repetir (§2.1).

### 4.6 · Cobrar no Brasil tem consequência fiscal

Nota fiscal, CNPJ, regime tributário, imposto sobre a assinatura. **Não é código**, muda o preço
líquido e é bloqueio real. Nomear, não resolver.

### 4.7 · O produto vai de barbearia a eletricista

Plano desenhado para salão não serve para faxineira. Limites e módulos precisam funcionar nos **4
eixos** que P0 modelou (`vai_ate`, `cobranca`, `inicio`, `ritmo`) — ou o empacotamento vira
"beleza, e os outros que se virem".

### 4.8 · Ninguém está usando o produto de verdade

Dois tenants, um deles demo. Não há dado de uso para embasar limite ("quantos clientes um salão
médio tem?"). **Todo limite proposto será Suposto (§2.4) até existir uso real** — e o plano tem
que dizer como sair dessa condição, não fingir que já saiu.

---

## 5 · Regras invioláveis

**As quatro primeiras são decisão registrada em `09-PLATAFORMA.md §13`** — não reabrir:

1. **Nunca prender dado.** Cair de plano limita funcionalidade — **nunca** esconde nem apaga
   cliente, histórico ou agendamento.
2. **Bloqueio por plano sempre mostra o motivo e o caminho.** Nunca some da tela sem explicação.
3. Nome de plano não pode ter cheiro de nicho.
4. Não fingir que integração de pagamento está pronta quando depende de credencial de terceiro.

E as desta rodada:

5. **Nenhuma cobrança real sem confirmação explícita.** Criar produto no painel do PSP, gerar
   assinatura, disparar cobrança — proposto, nunca executado sozinho, nem em sandbox.
6. **Namespace obrigatório.** "CICLO cobra do tenant" não pode reusar
   `subscription_plans`/`client_subscriptions`, que já significam "salão cobra da cliente".
7. **Dinheiro em centavos** (`bigint`, `_cents`), percentual em basis points (`_bps`). Nunca float.
8. **Toda escrita financeira é idempotente**, via `/api/v1` com `Idempotency-Key`. Webhook de PSP
   é reenviado — crédito duplicado é o bug clássico desta área.
9. **Segredo nenhum no repositório.**

### 5.10 · Psicologia sim, padrão escuro não

Este prompt pede explicitamente técnica de economia comportamental. Isso **não** autoriza:

| Proibido | Por quê |
|---|---|
| Cancelamento mais difícil que a assinatura | CDC, e é o que mais gera review destrutivo |
| Renovação automática sem aviso claro e antecipado | CDC exige clareza |
| Escassez falsa ("só hoje", contador que reinicia) | Mentira, e o público desta categoria conversa entre si |
| Prova social inventada ("+5.000 profissionais") | Mentira, e hoje seriam 2 |
| *Confirmshaming* ("não, prefiro perder dinheiro") | Humilha o usuário para reter |
| Preço que só aparece depois do cadastro | O concorrente que faz isso é fraqueza a explorar, não modelo |
| Rebaixar apagando dado | Viola a regra 5.1 |

**O teste:** a tática continuaria funcionando se o profissional soubesse exatamente como ela
funciona? Ancoragem passa (todo mundo sabe que existe plano caro e ainda assim ele calibra o
julgamento). Contador falso não passa. **Na dúvida, não usa** — a base desta categoria é
confiança, o público se conhece por bairro e por ofício, e uma reputação queimada aqui não
se recupera com marketing.

---

## 6 · Fases

### FASE A · Pesquisa de mercado e preço

Com `WebSearch`/`WebFetch`, URL e data (§2.1). Três grupos:

1. **Agenda/gestão para beleza no Brasil** — Trinks, Belasis, Avec, Booksy, Fresha, Simples
   Agenda, Salão VIP.
2. **Serviço de campo / autônomo não-beleza** — Auvo, Field Control, Produttivo; e como
   marketplace (GetNinjas) cobra, que é **concorrente de carteira**, não substituto de produto.
3. **Calibragem de escada brasileira de ticket baixo** — Nuvemshop, Contabilizei: quantos degraus,
   que salto entre eles, o mercado local aceita.

Para cada um: preço por degrau · o que separa um degrau do outro · **métrica de cobrança** (por
negócio? por profissional? por transação?) · taxa sobre transação · tem grátis? o que ele limita ·
preço público ou escondido.

Fechar com: **onde o CICLO ganha, onde perde, e qual faixa de preço o mercado torna crível.**

### FASE B · Segmentação — quem é o cliente que paga

17 profissões é ótimo para tamanho de mercado e péssimo para foco. Decidir:

- **Quem é o ICP** (perfil de cliente ideal) do primeiro ano — profissão, tamanho, cidade;
- **Disposição a pagar por segmento**: uma barbearia com 4 cadeiras e uma faxineira solo têm
  realidades de caixa completamente diferentes;
- **Densidade local** — autônomo se conhece por bairro e por ofício. Ganhar uma cidade vale mais
  que estar espalhado em vinte;
- Qual profissão é **cabeça de ponte** e por quê (a barbearia já tem catálogo real do `dom-rocha`;
  faxina e eletricista têm catálogo estimado, não pesquisado);
- O que **não** é ICP agora — e não é atendido de propósito.

### FASE C · Métrica de valor — a decisão estrutural de preço

A pergunta mais importante deste documento: **preço cresce junto com o quê?**

Candidatos, com consequência de cada um:

| Métrica | A favor | Contra |
|---|---|---|
| Por negócio (fixo) | simples de entender e vender | solo paga igual a salão de 5 cadeiras |
| Por profissional/assento | escala com o time; padrão do setor | pune quem cresce; e a maioria da base é solo → ARPU baixo |
| Por agendamento/mês | escala com uso real | imprevisível para quem paga; ansiedade de contador |
| Por cliente cadastrado | cresce sozinho | pune quem importa base grande; incentiva não cadastrar |
| % sobre o que ele recebe | alinhamento perfeito | exige ser o meio de pagamento; muda o produto inteiro |

Escolher uma **principal** e dizer o que se perde nas outras. Uma métrica de valor errada não se
conserta com tabela de preço bonita.

### FASE D · Empacotamento

Ancorar nos **16 módulos do §6** e nos limites numéricos. Para cada plano:

- Quais módulos liga (`tenant_modules.origem = 'plano'`);
- Limites (clientes, profissionais, agendamentos/mês, campanhas/mês, fotos);
- O que acontece ao estourar — regra 5.1: limita, não apaga.

A pergunta que valida cada degrau: **qual dor específica faz alguém subir?** Se a resposta for
"nenhuma, é só mais completo", o degrau não existe. Aplicar em cada fronteira.

E o **plano grátis é decisão de engenharia de produto, não de generosidade**: generoso demais mata
a conversão; apertado demais mata o laço de distribuição que o §13.1 diz ser a razão de ele
existir. Dizer qual limite específico é o que empurra para o pago.

### FASE E · Preço e psicologia de preço

Com a faixa crível da Fase A e a métrica da Fase C:

**Método com poucos clientes.** Não há base para teste A/B. Usar o que funciona sem escala:
**Van Westendorp** (as 4 perguntas de sensibilidade a preço) aplicável nas conversas de venda do
primeiro trimestre, e comparação com o **substituto real** — que para este público não é outro
software, é *caderno + WhatsApp + memória*, cujo preço é R$ 0 e cuja dor é concreta.

**Técnicas legítimas a considerar, cada uma com o motivo:**

- **Ancoragem e efeito de centro** — o plano do meio é o alvo; os vizinhos existem para calibrar
  o julgamento. Desenhar o meio primeiro, depois os vizinhos.
- **Enquadramento na unidade do cliente** — "o preço de um corte por mês" vale mais que "R$ 49" para
  quem cobra por corte. Ancorar na receita **dele**, não em reais abstratos.
- **Preço por dia** para o degrau de entrada, quando a mensalidade parecer grande demais.
- **Terminação de preço**: no Brasil, `R$ 97/R$ 197` carrega cheiro de infoproduto e pode
  **queimar credibilidade B2B**. Avaliar `R$ 49/R$ 89/R$ 149` vs `R$ 50/R$ 90/R$ 150` — e dizer
  qual sinal cada um manda para este público.
- **Anual com desconto** — melhora caixa e retenção (compromisso e consistência), mas trava preço
  antes de você saber se ele está certo. Recomendar só se o argumento de caixa vencer.
- **Aversão à perda no teste grátis** — teste com recursos do plano do meio faz a queda doer, e
  a dor é honesta: ele *realmente* usou. Isso é legítimo; escassez inventada não é.
- **Efeito de dotação e de IKEA** — quanto mais ele configura serviço, horário e base de clientes,
  mais o produto é *dele*. Isso não é truque, é motivo real para o onboarding pedir configuração
  cedo — e conecta com a métrica de ativação do §13.2.

Entregar **a tabela de preço proposta**, com o raciocínio de cada número e o que muda se estiver
20% acima ou abaixo.

### FASE F · Unit economics

Com a conta visível (§2.3):

- Custo de servir um tenant (Supabase US$ 10/mês hoje + Vercel + WhatsApp quando ligar);
- Preço-piso que cobre custo com margem;
- **Quantos assinantes** pagam a infraestrutura; quantos pagam o projeto;
- Quantos grátis um pagante sustenta (o grátis tem custo real e é investimento em distribuição);
- Custo de suporte por cliente — **num ticket baixo, suporte é o que mata a margem**;
- Sensibilidade a ±20% de preço.

### FASE G · Laços de crescimento

Não é funil de anúncio — para autônomo, **o CAC de mídia paga não fecha** (§13.1). São laços que
se alimentam do uso:

1. **Selo na página pública** — quem agenda vê a marca. Decidir se remover o selo vira benefício
   de plano pago (hoje é incondicional) — e o §13.1 avisa: **selo feio faz pagar só para remover;
   selo bonito circula e traz gente.** Isso é um trade-off de receita contra distribuição, e
   precisa ser decidido de propósito.
2. **O link como produto** — status do WhatsApp, bio do Instagram, grupo do bairro. Cada envio é
   impressão.
3. **Indicação** (Fase H).
4. **SEO das páginas públicas** — `/{slug}` × 17 profissões × cidades é cauda longa real. **Com um
   porém honesto:** página fina e repetida é penalizada, e isso não funciona com 2 tenants. Avaliar
   quando passa a fazer sentido.
5. **WhatsApp transacional** — todo lembrete e confirmação sai com a marca. Bloqueado no TICKET-043.
6. **Parceria de canal** — distribuidora de produto de beleza, associação, sindicato, escola
   técnica. Um parceiro traz dezenas; anúncio traz um.

Para cada laço: **o que o alimenta, quanto tempo leva para dar volta, e como medir.** Laço que não
dá para medir é esperança.

### FASE H · Indicação

O §13.1 já decidiu: **um mês para quem indica e para quem entra**. Falta o desenho:

- **Quando a recompensa vira real** — no cadastro? no 1º pagamento? depois de N dias ativo?
  (Creditar no cadastro é convite para fraude.)
- **Fraude**: autoindicação, conta falsa, fazenda de indicação. Teto por indicador.
- **Contabilidade**: mês grátis, crédito e desconto são coisas **fiscalmente diferentes**.
- Interação com teste grátis — não pode empilhar infinito.
- **Reciprocidade e identidade**: o convite funciona melhor vindo de quem já usa, com a cara dele,
  para alguém do mesmo ofício. Desenhar o convite como ferramenta do profissional, não anúncio do
  CICLO.

### FASE I · Ativação e retenção

Vender é metade; a outra é ele **não largar em duas semanas**.

- **Ativação**: o §13.2 já definiu — sair do cadastro com serviço + horário + link, em < 3 min,
  1º agendamento real em < 7 dias. Nada instrumentado.
- **Formação de hábito**: qual é o gatilho recorrente que traz de volta toda semana? (Hoje o
  candidato natural é o Motor de Ciclo — "quem sumiu e vale chamar de volta". É o diferencial do
  produto e deveria ser o motivo de abrir o app.)
- **Momento "aha"** — qual evento específico faz a ficha cair? (Hipótese: o primeiro agendamento
  que **chega sozinho** pela página pública, sem ele digitar nada.) Nomear e medir.
- **Churn**: em autônomo é alto e sazonal. Quais sinais antecedem (queda de agendamento, sumiço de
  login) e o que fazer com o sinal.
- **Recuperação**: quem cai para grátis não é perda — a base fica lá (regra 5.1), e volta é mais
  barata que aquisição.

### FASE J · PSP — escolher com argumento

Os tickets 031/032/033 assumem **Asaas**; o Eduardo citou **Mercado Pago**. Comparar para
**assinatura recorrente de SaaS**, não venda avulsa: taxa (Pix, cartão, boleto) · recorrência
nativa · retentativa de cartão · qualidade do webhook · sandbox utilizável · exigência de CNPJ ·
prazo de repasse · maturidade da biblioteca.

Recomendar **um**, com o motivo e o que se perde no outro. A favor: `payments.psp` já é `text` — o
schema nunca assumiu fornecedor único.

**Nota específica do Brasil:** Pix mudou a economia de assinatura pequena — taxa muito menor que
cartão, mas **Pix não é naturalmente recorrente**. Avaliar Pix automático/recorrente,
débito automático e o híbrido (cartão para recorrer, Pix para quem não tem cartão).

### FASE K · Ciclo de vida da assinatura

Cada transição, com o que acontece com dado e acesso:

Teste grátis (com ou sem cartão?) · Assinar · Subir (proração?) · Descer (na hora ou no fim do
ciclo? e se estiver acima do limite novo?) · **Inadimplência** (quantas retentativas, em que
intervalo, quanta carência, rebaixa para grátis — nunca apaga) · Cancelar (CDC: arrependimento em
7 dias) · Reativar · **Aumento de preço** (aviso prévio; quem já é cliente fica congelado?).

E: **o que acontece com `dom-rocha` e `ruivo-barber`**, que já existem.

### FASE L · Como o limite é imposto tecnicamente

- **Sempre no servidor.** Esconder botão não é limite.
- Onde mora a verdade: `tenants.plan` + `tenant_modules` — como se combinam sem virar duas fontes
  brigando;
- Limite **suave** (avisa, deixa passar) vs **duro** (recusa) — quais são quais;
- **Um lugar só** que responde "este tenant pode X?", não espalhado por 30 rotas;
- As `FEATURE_*` globais: aposentar ou dar função?

### FASE M · Telas e os momentos que decidem

Página pública de preço · "Meu plano" · **A tela de bloqueio** · Assinar · Portal de indicação ·
Aviso de inadimplência.

**A tela de bloqueio merece cuidado especial** e a regra 5.2 já manda motivo + caminho. Acrescentar
o que é craft: bloqueio que **mostra o valor do que está do outro lado** (o dado dele, não um
folheto) converte; bloqueio que só diz "faça upgrade" irrita. Ela é a peça de conversão mais
importante do produto — mais que a página de preço, porque aparece no momento em que a pessoa
**já quer fazer alguma coisa**.

Tudo em pt-BR, mobile-first, 390px, alvo ≥48px, dentro do design system existente.

### FASE N · Legal, fiscal e ético

Termos e política de assinatura · Renovação automática (CDC exige clareza) · Arrependimento em 7
dias · Nota fiscal · Regime tributário · **O CICLO nunca deve tocar em número de cartão**
(tokenização no PSP) · Conferência do §5.10 contra cada mecanismo proposto.

### FASE O · Métricas e previsões falsificáveis

Somar às do §13.2 as de receita: MRR, churn, conversão grátis→pago, ARPU, indicação como canal.
Dizer **quais dá para medir com os timestamps que já existem** e quais exigem instrumentação nova.

E o que separa plano de torcida — **3 a 5 previsões numéricas, com prazo**, do tipo:

> "Se o preço de entrada for R$ X, em 90 dias teremos entre A e B assinantes pagantes."

Erradas, ensinam. Ausentes, o plano nunca pode ser avaliado.

### FASE P · Sequenciamento e critérios de parada

Fechar respondendo à §4.1, em dois horizontes:

- **Curto (0–3 meses)** — o mínimo para cobrar do cliente nº 1, sem máquina.
- **Médio (3–12 meses)** — o que só se justifica com demanda provada, e **qual sinal específico
  destrava cada item**.

No formato de fases que o `09-PLATAFORMA.md` já usa, com risco e dependência. E, para cada aposta
grande, o **critério de parada**: o número que, se não acontecer até certa data, faz abandonar
aquele caminho em vez de insistir por orgulho.

---

## 7 · Classificação obrigatória

| Nível | Critério |
|---|---|
| **Decidido** | Há dado (§2.4 Medido) ou regra já registrada em doc. Segue. |
| **Recomendado** | Há argumento e recomendação clara, mas é aposta. Vai com a recomendação **e** com o que muda se for o contrário. |
| **Do Eduardo** | Depende de apetite de risco, dinheiro ou marca. Opções com consequência — **nunca escolher sozinho e seguir.** |
| **Bloqueado** | Depende de credencial, CNPJ ou terceiro. Nomear o bloqueio e o que dá para fazer sem ele. |

Nada sem classificação. **"Do Eduardo" disfarçado de "Decidido" é o pior defeito possível** deste
documento.

---

## 8 · Red team obrigatório

Seção própria no plano, escrita **contra** o resto dele. Não é ressalva de rodapé.

1. **Pré-mortem.** É 12 meses depois e a monetização fracassou: o CICLO tem menos de 10 pagantes.
   Escrever a história de como isso aconteceu — as três causas mais prováveis, em ordem.
2. **O caso contra cobrar agora.** O argumento mais forte que existe para *não* implementar planos
   neste momento, escrito com honestidade e sem palha. Depois, a resposta a ele — ou a concordância.
3. **Ataque à métrica de valor** (Fase C): em que cenário concreto ela envelhece mal?
4. **Ataque ao preço** (Fase E): por que ele pode estar 2× errado, para cima e para baixo?
5. **O concorrente que mata isso.** Se o Trinks (ou o Fresha, que é grátis) resolver ir para o
   nicho de autônomo generalista amanhã, o que sobra do CICLO?
6. **Onde este plano usa "Suposto" como se fosse "Medido"** — auditoria do próprio documento.

---

## 9 · Formato de entrega

**Nesta rodada: só o plano.** `docs/18-MONETIZACAO-PLANO.md`, **nenhuma linha de código, nenhuma
migration, nenhuma tela.**

Por fase: o que foi pesquisado/decidido · recomendação · o que muda se for diferente ·
classificação (§7) · o que fica para o Eduardo.

Contratos de tabela obrigatórios, para o resultado ser comparável e auditável:

**Concorrentes (Fase A)**
`Produto | Degraus e preço | Métrica de cobrança | Grátis? o que limita | Taxa sobre transação | Preço público? | Fonte (URL) | Consultado em`

**Planos propostos (Fases D+E)**
`Plano | Preço | Métrica de valor | Módulos ligados | Limites | A dor que faz subir daqui | Classificação`

**Laços (Fase G)**
`Laço | O que alimenta | Tempo de volta | Como medir | Custo de construir | Já existe?`

**Previsões (Fase O)**
`Previsão | Número | Prazo | Como verificar | O que fazer se falhar`

Fechar com **duas listas que não se misturam**: o que é **decidido com base** e o que é **aposta**.

---

## 10 · Fora de escopo, de propósito

- Marketplace, comissão sobre a transação da cliente final, antecipação de recebível
- Plano corporativo/multi-unidade negociado (`FEATURE_MULTI_UNIT` fica adormecida)
- App nativo, whitelabel, programa de afiliado profissional
- Redesenhar `subscription_plans`/`client_subscriptions` (salão→cliente)
- A peça jurídica em si — contrato é do advogado
- Executar cobrança real ou criar conta em PSP
- Campanha de mídia paga (§13.1: o CAC não fecha nesta categoria)

---

## 11 · Definição de pronto

- [ ] Toda fase A–P tem seção própria; nenhuma muda
- [ ] Todo preço de concorrente com **URL e data**; todo número com rótulo Medido/Estimado/Suposto
- [ ] Toda conta de §F com a aritmética visível
- [ ] Cada item classificado pelo §7
- [ ] As **oito** tensões do §4 respondidas — inclusive falta de cron, falta de pagante e falta de uso real
- [ ] §8 escrito de verdade, contra o plano, incluindo o caso de **não fazer nada agora**
- [ ] §O tem 3 a 5 previsões numéricas com prazo e critério de verificação
- [ ] §P responde: **o que precisa existir para cobrar do cliente nº 1** — e o critério de parada
      de cada aposta grande
- [ ] Nenhum mecanismo do plano viola o §5.10
- [ ] Nada foi construído — o plano é o entregável
