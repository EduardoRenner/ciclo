# 65 · EXPANSÃO PRA ESPANHOL (LATAM) — PESQUISA E PLANO

> Pedido do Eduardo em 15/09: pesquisar se vale a pena colocar uma versão em inglês, mercado
> gringo. Pesquisa mostrou que inglês/EUA é a pior escolha; espanhol/LatAm é a que faz sentido
> pra este produto especificamente. Decisão do Eduardo: seguir com espanhol/LatAm.

| Tag | Significado |
|---|---|
| `[P]` | Pesquisa externa, com link, em 2026-09-15 |
| `[M]` | Medido neste repositório em 2026-09-15 |

---

## 1 · Por que NÃO inglês/EUA

**O canal principal do produto não existe lá.** O Motor de Ciclo fala com a cliente pelo WhatsApp
— mas nos EUA quem domina é o iMessage (Apple tem 55% do parque, resposta de 30-45%) contra só
~29% de penetração do WhatsApp e 15-25% de resposta `[P]`. Levar o CICLO pros EUA sem canal
significa reconstruir a espinha dorsal do produto inteira, não traduzir.

**O mercado está consolidado e é dominado por marketplace.** Vagaro, Booksy, Mindbody, Styleseat e
Fresha somam 76% do tráfego de agendamento; em janeiro/2026 Mindbody se fundiu com ClassPass e
EGYM formando uma empresa de US$ 7,5 bilhões `[P]`. Eles competem cobrando 20-30% de comissão em
cliente novo — um modelo de negócio oposto ao do CICLO (sem comissão, sem tocar no fluxo de
dinheiro do salão). Squire, especializado em barbearia, já levantou US$ 165 milhões só pra esse
nicho `[P]`. Entrar aí sem canal, sem marca e sem capital é brigar na pior mão possível.

## 2 · Por que espanhol/LatAm faz sentido

**O WhatsApp domina lá quase como no Brasil.** México 93% de penetração (74-95M usuários ativos),
Colômbia 92-94%, Argentina 93% — e 76-78% dos usuários já falam com empresa por WhatsApp `[P]`. O
Motor de Ciclo funciona no mesmo canal, sem reconstruir nada de canal.

**Mercado Pago já cobre os três países mais óbvios** — Argentina, México, Colômbia, mais Chile,
Peru, Uruguai `[P]`, com taxa parecida (3,79-3,99% no México, na mesma faixa do Brasil) — o
argumento de "o processador não te mostra o que a taxa realmente custou" (`docs/53`, a vantagem
0→1 já validada aqui) se traduz direto, sem reconstruir a tese comercial.

**Mas existe uma trava operacional real, do mesmo tipo que já travou o Brasil:** Mercado Pago exige
**conta própria em cada país** — presença legal local, não é só ligar uma flag no SDK `[P]`. É o
mesmo tipo de bloqueio que `CNPJ`/`Simples Nacional` já é pro lançamento brasileiro
([[ciclo-lancamento-o-que-falta]]), multiplicado por país. Isso não é uma decisão de código —
nenhuma sessão de IA abre empresa em outro país.

## 3 · O que o código está pronto pra fazer, e o que não está `[M]`

Medido no repositório, ponto a ponto:

| Frente | Esforço | Por quê |
|---|---|---|
| **Camada de i18n (traduzir a interface)** | 🔴 **Reescrita grande — meses, não dias** | Não existe `next-intl`, `react-i18next`, nem catálogo de mensagens. Texto está hardcoded direto no JSX em **~213 arquivos**. Não é "extrair pra um dicionário": precisa introduzir a lib do zero, envolver a árvore de componentes em provider de locale, e migrar string por string, sem convenção de chave nenhuma hoje. |
| Dinheiro (centavos) | 🟢 Já é moeda-agnóstico | `_cents` funciona pra peso mexicano/colombiano/argentino sem mudança estrutural — mas o símbolo `R$` está escrito como literal em vários lugares, não como config. |
| Formatação de número/data | 🟡 Configuração, mas espalhada | `'pt-BR'` hardcoded em **38 arquivos**, cada um com seu próprio `Intl.NumberFormat` — precisa centralizar de verdade (hoje só parcialmente) e parametrizar por locale do tenant. |
| Telefone | 🟡 Reescrita média | `formatarTelefone`/`mascaraTelefone` assumem `+55` via regex fixa — não tratam outro DDI. |
| Vocabulário de profissão (`core/text/vocabulario.ts`) | 🟡 Arquitetura já aponta o caminho certo | Já resolve termo por profissão (cliente/aluno) com precedência bem desenhada — mas pluralização (`-ão→ões`) é regra do português. Precisaria virar duas camadas: idioma + vocabulário, cada uma com sua pluralização. |
| Mercado Pago (núcleo) | 🟢 Portável | A lógica pura (`core/billing/mercado-pago.ts`) já é moeda-agnóstica e o SDK cobre os países-alvo. |
| Cobrança recorrente | 🟡 Reescrita média | A escolha do MP foi justificada especificamente pelo Pix (0,99%, Pix Automático) — **Pix não existe fora do Brasil**. Cartão/SPEI (México)/PSE (Colômbia) por país precisam de fluxo próprio. |
| LGPD → lei local | 🟡 Reescrita média, mas isolada | Citada em ~dezenas de arquivos e na página de privacidade inteira. Trocar pra LFPDPPP (México) ou Lei 1581 (Colômbia) é trabalho real, mas contido — não espalha pelo produto inteiro como a i18n. |
| CPF | 🟢 Esforço baixo | Já é campo opcional/texto livre no banco, sem máscara rígida — só o rótulo da UI e o redator de log estão hardcoded. |

**A conclusão que organiza tudo: o maior bloqueador, de longe, não é pagamento nem lei — é a
ausência total de camada de i18n.** É esse item que dita o cronograma inteiro.

## 4 · Recomendação: NÃO começar pela tradução

A ordem errada é abrir uma pasta `es/` e começar a traduzir componente por componente — vira
retrabalho constante enquanto o produto continua evoluindo em português (toda feature nova nasceria
em pt-BR e precisaria de segunda passada).

**A ordem certa, em três fases:**

1. **Fase 0 — decisão de negócio, do Eduardo, antes de qualquer código:** qual país primeiro
   (México é o maior mercado e tem WhatsApp+MP fortes; Colômbia é mais barato de testar). Decidir
   isso ANTES evita construir i18n genérico demais ou específico demais pro país errado.
2. **Fase 1 — construir a camada de i18n em cima do produto atual, sem traduzir nada ainda.**
   Introduzir `next-intl` (ou equivalente), migrar strings pra um catálogo `pt-BR.json` **mantendo
   o produto 100% em português** — é o trabalho mecânico e arriscado (213 arquivos), mas não decide
   nada de mercado, só destrava a Fase 2. Sai testável e reversível: o produto continua exatamente
   como é, só que agora TEM onde colocar uma segunda língua.
3. **Fase 2 — tradução de verdade + conta Mercado Pago no país escolhido + adaptação de
   LGPD→lei local + fluxo de cobrança sem Pix**, só depois da Fase 1 estar no ar e estável.

**Prazo honesto: Fase 1 sozinha é de semanas a poucos meses** — não é o tipo de ticket que cabe
numa sessão autônoma como os do `docs/64`. É trabalho real de arquitetura, tocando quase todo
arquivo de UI do produto.

## 5 · O que fazer agora, se for pra frente

Nada de código ainda — a Fase 0 é decisão do Eduardo (qual país, quando). Se a resposta for "sim,
seguir": o próximo passo é um plano técnico detalhado da Fase 1 (escolha de lib de i18n, estratégia
de migração arquivo por arquivo, ordem de prioridade pelas telas mais usadas primeiro), no mesmo
formato de tickets do `docs/64` — mas só depois dessa decisão, pra não construir genérico demais.

## 6 · Sources

- [WhatsApp in the U.S.: Complete 2026 Guide — Message Central](https://www.messagecentral.com/blog/whatsapp-in-the-us)
- [iMessage vs WhatsApp Business API — Sendblue](https://www.sendblue.com/blog/imessage-vs-whatsapp-business)
- [Salon & Spa Software Market Report — Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/spa-and-salon-software-market)
- [Best Barbershop Software 2026 — Fresha](https://www.fresha.com/for-business/barber/best-barbershop-software)
- [Payment Gateways in Mexico 2026 — Rebill](https://www.rebill.com/en/blog/payment-gateways-mexico)
- [WhatsApp Penetration in Latin America 2026 — Mazkara Studio](https://mazkara.studio/en/newsletter/whatsapp-penetration-latin-america-2026/)
- [Adoption of WhatsApp Business in Latin America — Aurora Inbox](https://www.aurorainbox.com/en/2026/03/05/whatsapp-business-latam-adoption/)
