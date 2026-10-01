# PROMPT · Revisar e aprimorar o Motor de Retorno, a plataforma de dados e o Motor Preditivo do CICLO

Cole este arquivo inteiro no modelo revisor. Ele tem todo o contexto. Data de referência: 2026-09-30.

---

## 1. Seu papel
Você é um revisor sênior (produto, dados/estatística, SaaS vertical, privacidade/LGPD, WhatsApp Business
Platform). Sua missão: **revisar criticamente, pesquisar a fundo e aprimorar** o plano abaixo, com **pesquisa
na web de tudo que for afirmação de fato**, e entregar um plano executável. Seja cético. Procure o que
está errado, exagerado ou faltando. Melhor apontar um furo agora do que o Vitor descobrir depois.

## 2. Quem é o usuário
**Vitor**, fundador do CICLO, leigo em finanças e direito, fala de forma informal e direta, quer rapidez
e custo baixo. É **MEI** hoje (limite R$ 81 mil por ano; software não consta na lista de atividades do
MEI, então vira ME mais cedo do que o planejado). Escreva em **português do Brasil, simples, sem
jargão**; quando usar termo técnico, explique numa frase. Não floreie.

## 3. O produto (estado real)
**CICLO** é um SaaS multi-tenant para quem tem agenda e cliente que volta (barbearia, salão, unhas,
estética, e também faxina, eletricista, personal). **Diferencial: o Motor de Ciclo**, que aprende o
ritmo de cada cliente e lista quem passou da hora e quanto isso vale em reais (valor e lucro em risco).
- Stack: Next.js 15 / React 19 / TypeScript, Supabase (Postgres com RLS forçada), Vercel (gru1),
  Mercado Pago (cartão recorrente), Resend (e-mail), Capacitor (apps, adiado).
- Regras do repositório (`CLAUDE.md`): regra de negócio em `src/core/` (funções puras), dinheiro em
  centavos, RLS sempre, escrita por `/api/v1` com Idempotency-Key, Zod na borda, nunca apagar
  agendamento/estoque/auditoria, dado de saúde nunca em log.
- **Já existe:** Motor de Ciclo (ritmo, valor/lucro em risco, previsão **auditada** append-only), lista
  "Recuperar" ordenada por lucro (uma linha por cliente; regra de 7 dias; janela 8h–21h; opt-out; 200 por
  rodada), atribuição de receita **por tempo** (não por link), Motor de Inteligência (assistente
  determinístico, 18 ferramentas; "preparar_*" exige confirmação do dono), dial de autonomia (3 níveis,
  teto decidido no servidor), experimentos do dono, mapa de vazamento, demanda não atendida, pontos de
  fidelidade automáticos, importação/exportação de planilha, serviço canônico, vocabulário por profissão.
- **Não roda sozinho em produção:** das 8 rotinas de cron só `recompute-cycles` e `segments` estão
  agendadas (cron-job.org). Lembrete, campanha e alerta de estoque estão prontos e **desligados** (mandam
  mensagem ao cliente final, e não há canal verificado).
- **Produção:** `seuciclo.com.br` (Vercel + Supabase `eqzlvthzdjnsbogymcsw`). Em 30/09/2026 foi publicado
  o PR #133 (126 commits) e as migrations 0092–0098 já estavam aplicadas. **Zero clientes pagantes.**
  Só contas de demonstração. Resend com domínio verificado e chaves na Vercel.
- Documentos de apoio no repositório: `docs/88`–`93`, `docs/runbooks/*`, `docs/modelo-financeiro-ciclo.xlsx`,
  `docs/plano-de-escala-ciclo.html` (página para investidor).

## 4. Decisões já tomadas pelo Vitor
- Prospectar já. Ficar MEI no início (aceita o risco de desenquadramento).
- Plano barato de entrada (ex.: R$ 37/mês, antes R$ 49 Solo e R$ 99 Equipe), 1 mês grátis sem cartão.
- Investimento inicial R$ 0, sem contador no começo, Vercel/Supabase Pro só a partir do 1º pagante.
- **Quer campanha de retenção e recuperação como o produto principal** (lembrete "qualquer um faz").
- Plano premium de **recuperação** em faixa de R$ 149 a R$ 199/mês (hipótese).
- Quer **API oficial do WhatsApp** e mensagem **incluída no plano**; aceita pagar mais desde que a margem
  em reais se mantenha. Não quer risco de banimento.
- Quer **aprendizado entre salões, tudo junto**, e abrir para **qualquer negócio de recorrência**, com
  estética "pique Palantir". Mínimo de grupo: **zero para aprender**, com limite apenas para o que é
  mostrado a outro cliente (ver seção 7).
- Ideia de serviço: pegar a base exportada do AppBarber/Belasis, gerar relatório e lista de quem chamar
  (diagnóstico), como isca para assinar o CICLO.

## 5. Fatos pesquisados (com fonte; confirme e atualize)
- **Mercado:** >1,1 milhão de pequenos negócios de beleza; <30% usam sistema de gestão; a maioria fatura
  <R$ 50 mil/mês (EM, UAI 09/2026). 6 em 10 clientes novos não voltam (Gendo, fonte de fornecedor).
- **Reativação:** mensagem pessoal ~22%, sem contato ~3%; conversão cai com o tempo de inatividade
  (30–60 dias: 15–25%; 120–180: 3–8%; >6 meses: 1–3%) (BonifiQ, SocialHub; blogs de fornecedor).
- **API oficial no Brasil (por mensagem):** marketing US$ 0,0625; utilidade/autenticação US$ 0,0068.
  Fontes divergem em reais (utilidade R$ 0,04–0,10; marketing R$ 0,34–0,45). Conferir tabela oficial.
- **Tech Provider vs BSP:** Tech Provider não tem linha de crédito (o cliente cadastra cartão na Meta);
  Solution Partner/BSP tem e pode incluir a mensagem no plano. Tech Provider exige CNPJ, site HTTPS,
  verificação da empresa, App Review com vídeo, Embedded Signup v4.
- **BSPs (a confirmar direto):** Gupshup ISV (~US$ 0,001/msg, sem mensalidade), Twilio (US$ 0,005/msg),
  360dialog (€ 49/número/mês), Zenvia (R$ 0,02–0,15/conversa), Blip/Infobip (sem tabela pública).
- **Opt-in (Meta):** exige opt-in para marketing; precisa nomear o negócio e o tipo de mensagem, com data e
  origem registradas; pode ser coletado fora do WhatsApp; só ter o número não é opt-in; template de
  marketing precisa de botão de sair. Nota de qualidade depende de bloqueios e denúncias (7 dias);
  número novo começa em 250 destinatários únicos/24 h.
- **Não oficial:** AppBarber usa o WhatsApp Web do dono (lembretes sem custo adicional); Belasis conecta por
  QR Code. Automação fora da API oficial contraria os termos da Meta.
- **Concorrência:** Zenoti/Fresha (preço dinâmico), Boulevard (otimização de horário, nota de retenção),
  Phorest (reativação), Belasis/Trinks (recuperação de inativos, reduzir horário vago).
- **Estatística:** ~1.000 pessoas por grupo para detectar 10% de diferença; modelos hierárquicos bayesianos e
  X-learner para amostra pequena; previsão probabilística e reconciliação hierárquica para demanda
  intermitente.
- **Imobiliária (blogs):** lead→contato 40–50%, contato→visita 35–45%, visita→proposta 35–45%,
  proposta→fechamento 30–40%, conversão fim a fim 2–4%; gargalos: resposta >30 min e falta de follow-up.
- **Palantir:** cinco camadas (Conectar, Pipeline, Ontologia, Aplicações, IA) + linhagem, segurança por marcas,
  cenários, writeback; críticas dizem que a ontologia sozinha não gera valor.

## 6. O que está em avaliação (leia os arquivos)
- `docs/91-ROTEIRO-MOTOR-DE-RETORNO.md` (canal oficial, consentimento, medição, decisão, estatística).
- `docs/92-PLATAFORMA-DE-DADOS-E-DECISAO.md` (ontologia genérica, camadas, aprendizado conjunto, 19 módulos).
- `docs/93-MOTOR-PREDITIVO-E-NOVOS-VERTICAIS.md` (10 previsões, desenho técnico, imobiliária e outros).
- Ideias: **link pessoal** (primeiro toque humano pelo WhatsApp do dono; link assinado registra opt-in e
  atribuição); **casamento vaga × cliente**; **orçamento de atenção**; **controle atrasado** em vez de
  "nunca mandar"; **plano de meta**; **gêmeo digital**; **cobrança por resultado**; planos R$ 37 / R$ 149 /
  R$ 199 (margem do básico ≈ R$ 35; 250 mensagens de marketing custam ≈ R$ 88–98 com BSP barato).

## 7. Regras que você não pode quebrar
1. **Não invente número.** Tudo que não tiver fonte vai marcado como *(estimativa)* ou *(hipótese)*, com o
   método. Diga quando as fontes divergirem. Prefira fonte primária (Meta, LGPD/ANPD, contratos de BSP).
2. **Não proponha burlar** regra da Meta, LGPD ou termos do WhatsApp. Se uma ideia depender disso, diga
   que não serve e dê a alternativa legítima.
3. **Privacidade:** *aprender* com tudo junto (linhas sem identificação, sem nome, telefone, e-mail ou
   texto livre) é permitido; *mostrar* a outro cliente só o nível que reúna vários negócios (senão a
   "média" é o dado de um concorrente). Dado de saúde fica fora. Avalie se isso basta para o art. 12 da LGPD.
4. O repositório segue o `CLAUDE.md`. Toda sugestão de código respeita as regras (RLS, centavos, núcleo puro).
5. Marque o que já existe no CICLO e o que é novo. Não descreva como pronto o que está desligado.
6. Seja honesto sobre amostra pequena: um salão sozinho não permite A/B conclusivo.

## 8. O que eu quero de você (entregáveis)
**A. Revisão crítica** dos docs 91, 92 e 93: erros, exageros, riscos, o que contradiz as fontes, o que
está faltando. Liste por gravidade.
**B. Pesquisa a fundo** (com links), pelo menos:
  1. Tabela **oficial** de preços da Meta para o Brasil e a regra de cobrança por mensagem em 2026,
     incluindo mudanças de 01/10/2026; limites por pessoa para marketing; regra de templates.
  2. Condições **reais** de BSP/ISV (Gupshup, Twilio, Zenvia, Infobip, 360dialog, outros): taxa, markup,
     linha de crédito compartilhada, onboarding de cada negócio, prazo, exigências. O que dá para
     "incluir no plano".
  3. **Embedded Signup e coexistência** no Brasil (número do dono no app e na API ao mesmo tempo).
  4. Verificação da empresa na Meta para **MEI** e mudança para ME; exigências de Tech Provider; prazo e
     taxa de aprovação reais (relatos).
  5. **LGPD:** base legal para marketing a cliente antigo (legítimo interesse vs. consentimento), requisitos
     de anonimização para aprender com dados de vários negócios, o que a ANPD exige, o que precisa de RIPD.
  6. **Estatística prática para pouco dado:** modelos (BG/NBD, sobrevivência, hierárquico bayesiano,
     uplift X-learner, bandido) — o que funciona com ~100 clientes por negócio e quando.
  7. **Concorrentes** (Brasil e exterior) — o que cada um realmente faz em retenção, previsão e
     benchmark; confirme se alguém junta decisão conjunta + medição causal + aprendizado entre negócios.
  8. **Verticais de recorrência** para expandir (imobiliária, contabilidade, academia, pet, manutenção):
     tamanho, dor, dados disponíveis, concorrentes, risco regulatório. Recomende **a ordem**.
  9. **Preço:** benchmarks de quanto dono de salão/barbearia paga por software e por "serviço de
     recuperação"; teste de aceitabilidade de R$ 37 / R$ 149 / R$ 199.
**C. Arquitetura de dados** proposta: tabelas novas (consentimento, exposição, variantes, resultado,
forecasts, forecast_outcomes, etc.) com colunas, chaves, RLS e como respeitar a regra de aprender × mostrar.
**D. Especificação das funcionalidades** priorizadas (propósito, insumos, saída, métrica, critério de
aceite, dependência, esforço em semanas *(estimativa)*). Corte o que não compensa.
**E. Unit economics** por plano, com as hipóteses à mostra (atendimentos/mês, mensagens, taxa de retorno,
cotação do dólar, taxas do Mercado Pago), cenário pessimista/base/otimista, e ponto de equilíbrio.
**F. Plano de 90 dias** com portões de parar/seguir e o que depende do Vitor (papelada Meta, advogado,
contador, cotações de BSP, salões-piloto).
**G. Lista de perguntas em aberto** para o Vitor, por ordem de impacto.

## 9. Método sugerido
Pesquise antes de opinar. Para cada afirmação importante, traga a fonte e diga se é oficial, blog de
fornecedor ou relato. Faça um passo de **verificação cruzada** das suas próprias conclusões (procure o
que as desmente). Se usar vários agentes, peça a um deles para atacar o plano (advogado do diabo).

## 10. Formato da resposta
1. Resumo em 10 linhas (o que muda no plano).  2. Revisão crítica (por gravidade).  3. Pesquisa, com
tabela de fatos, fonte e grau de confiança.  4. Arquitetura e funcionalidades.  5. Economia.
6. Plano de 90 dias.  7. Perguntas em aberto.  Sem enrolação; tabelas onde ajudar.
