# 82 · MOTOR DE DISTRIBUIÇÃO — do zero às primeiras contas que usam

> Primeira missão do prompt "Autonomous Distribution & Launch Engine" (2026-09-23). Este documento
> não repete o que já existe: o roteiro de visita está no `docs/56`, o posicionamento no `docs/43`,
> a economia de CAC na memória de mercado (`docs/31`, `docs/55`). Aqui está o que faltava — o
> sistema que liga essas peças e as MEDE.
>
> Legenda: **[FATO]** medido no código/banco · **[FONTE]** pesquisa pública citada ·
> **[HIPÓTESE]** precisa de validação em campo.

---

## 0 · A frase que organiza tudo

**O CICLO não tem problema de produto nem de canal. Tem zero conversas com dono de salão.**

- Produção em 2026-09-23 **[FATO]**: 8 contas — 6 demonstração, 1 revisão da Apple, 1 cadastro
  real (`ciclos-ana`, 09/09) com zero cliente e zero agendamento. Zero pagante.
- O Motor de Ciclo roda inteiro no plano Grátis, com envio por `wa.me` (`docs/56`) **[FATO]**.
  Nada técnico impede a primeira venda.
- Até hoje o produto **não sabia de onde vinha ninguém** **[FATO]**: o selo "Feito com CICLO" e o
  convite de colega apontavam para a raiz sem nenhuma marca. Corrigido nesta rodada (§6).

Consequência: todo o esforço dos próximos 30 dias é **fazer conversas acontecerem e medir o que
cada uma rende**. Feature nova só entra se encurtar o caminho até a primeira cliente recuperada.

**Métrica norte:** contas **reais** que chegam a `cliente_voltou` (uma cliente que o Motor apontou
e voltou). Não cadastro, não visita, não seguidor.

---

## 1 · Auditoria do que já existe para distribuir

| Peça | Estado | Observação |
|---|---|---|
| Landing com a pergunta-dor ("Quantos clientes pararam de voltar sem você notar?") | no ar | posicionamento certo, sem prova social ainda |
| Grátis para sempre com o Motor de Ciclo | no ar | é a oferta de entrada; não precisa trial |
| Página pública por negócio + selo "Feito com CICLO" | no ar | único laço viral grátis; **agora com origem** |
| Convite de colega (B2B) em "Meu plano" | no ar, sem recompensa | **agora com origem**; recompensa manual (§11) |
| Indicação cliente→cliente (B2C) | no ar | serve o negócio, não traz conta nova |
| Importar "quem eu já atendo" | no ar | é o atalho para o momento "aha" (§7) |
| `product_events`: `conta_criada`, `base_importada`, `motor_viu_valor`, `cliente_voltou` | no código (0088) | aplicação em produção não conferida nesta sessão (MCP sem permissão) |
| SEO técnico (sitemap, structured data, `llms.txt`) | no ar | nenhuma página por intenção de busca |
| Ferramenta grátis sem cadastro | **não existe** | §8 |
| Placar de distribuição | **não existia** | runbook novo (§13) |
| Programa de parceiro | **não existe** | links já funcionam com `?origem=parceiro&ref=` (§12) |

---

## 2 · Pesquisa de mercado — o que é novo desde o `docs/43`

**[FONTE]** salvo marcação.

- **1.127.201 salões de beleza ativos** no Brasil; **235.708 CNPJs novos em 2025** (+17,9%), 94%
  MEI ([Agência Sebrae](https://agenciasebrae.com.br/cultura-empreendedora/a-cada-hora-27-negocios-de-beleza-sao-abertos-no-pais-crescimento-foi-de-185-em-2025/)).
  Mercado gigante, pulverizado, e renovando ~20% ao ano — **gente nova abrindo negócio toda
  semana é o público mais fácil**: ainda não tem sistema para trocar.
- **Menos de 30% usam sistema de gestão**; a maioria fatura menos de R$ 50 mil/mês e o dono acumula
  todas as funções (Sebrae, via [UAI, 18/09/2026](https://www.uai.com.br/networking-e-negocios/2026/09/18/maioria-dos-saloes-de-beleza-no-brasil-fatura-menos-de-r-50-mil-por-mes-aponta-levantamento/)).
  O concorrente principal não é a Trinks — é o caderno e a memória.
- **Maravilha/SC: 182 a 203 CNPJs ativos em 9602-5/01** (cabeleireiro, manicure, barbearia)
  ([Econodata](https://www.econodata.com.br/empresas/sc-maravilha/cabeleireiros-e-outras-atividades-de-tratamento-de-beleza-s-9602501),
  [Empresaqui](https://www.empresaqui.com.br/listas-de-empresas/SC/MARAVILHA)). **[HIPÓTESE]**
  de 40% a 60% é MEI em casa ou inativo de fato → **~70 a 110 negócios visitáveis** numa cidade.
- **Preço do corte em cidade pequena: R$ 25–40** ([Barbeiro.app](https://www.barbeiro.app/blog/tabela-precos-barbearia-2026)).
  R$ 49/mês = 1,5 corte. É esse o argumento de ROI: **uma cliente recuperada por mês paga o
  sistema**.
- **O SEO de "sistema para barbearia" já tem dono**: Barbeiro.app, BarbUp, TopAgenda e
  sistemadeagendamento.com publicam comparativos e tabelas. Competir de frente por essas palavras
  com domínio novo é meses de trabalho para pouca chance. **Cauda longa + local + ferramenta** é
  onde há espaço (§11 do prompt, §9 aqui).
- **Ferramentas grátis já existem**, mas nenhuma usa ciclo pessoal: calculadora de preço (AgendaIA),
  calculadora de "quanto custa perder um cliente" (Fidelizap, conta genérica com 60–80% de perda),
  planilhas. **A lacuna é a conta por ritmo de retorno** — exatamente o que o Motor faz (§8).
- **Concorrência de preço:** agenda grátis (InfinitePay desde jan/2026, TopAgenda até 60
  agendamentos, SistemaDeAgendamento grátis+R$ 59). Reafirma o `docs/43`: **nunca vender
  "agenda"**. 5 de 7 sistemas de barbearia não publicam preço — o `/precos` público do CICLO é
  vantagem de confiança.

---

## 3 · Onde o ICP já está (canais existentes, não inventados)

| Onde | Por que importa | Custo |
|---|---|---|
| **O próprio salão, fim de tarde de seg/ter** | decisão é do dono, na cadeira dele | R$ 0 + tempo |
| **Instagram do negócio** | é a vitrine dele; todo salão da cidade tem | R$ 0 |
| **Representante/distribuidora de cosmético e barbearia** | visita os mesmos salões toda semana, já tem a confiança | comissão só se converter |
| **Contador** | MEI que cresce passa por ele no desenquadramento; Lei do Salão-Parceiro exige repasse em nota | comissão só se converter |
| **Curso de barbeiro / escola de beleza** | forma quem vai abrir negócio — o público sem sistema | R$ 0 (aula grátis) |
| **Associação Empresarial / CDL de Maravilha** ([aemaravilha.com.br](https://www.aemaravilha.com.br/)) | eventos, lista de associados, credibilidade local | anuidade (só se valer) |
| **Google Maps** | quem busca "barbearia perto" acha o negócio — e o dono olha a ficha | R$ 0 |
| **Imprensa local** (Novoeste, Razão, Conexão; rádios Alternativa FM e Difusora 90.3) | cidade pequena publica pauta local; vira prova social na visita | R$ 0 — `runbooks/pauta-para-imprensa-local.md`, só com ≥ 3 negócios usando |
| **SENAC-SC / SESC-SC** (curso de barbeiro; o do SESC é gratuito) | turma que vai abrir negócio, sem sistema ainda | R$ 0 (aula grátis) |

**Não é canal agora:** anúncio pago (CAC-teto ~R$ 100 contra ticket de R$ 49 — `docs/55`),
Reddit, TikTok nacional, marketplace. Ficam fora até existir conversão medida.

---

## 4 · ICPs — pontuação

Nota 1–5 em cada critério do prompt (§3). Base: `docs/43`, `.claude/ciclo/segments.md` e §2.

| Critério | Barbearia 1–4 cadeiras | Unhas/cílios solo (MEI) | Salão cabelo 2–5 | Estética | Casa (faxina etc.) |
|---|---|---|---|---|---|
| Dor de cliente que some | 5 | 5 | 4 | 3 | 3 |
| Frequência (ciclo curto = Motor prova rápido) | 5 (~21 d) | 5 (15–21 d) | 3 | 2 | 3 |
| Capacidade de pagar R$ 49 | 4 | 2 | 4 | 4 | 2 |
| Fácil de encontrar | 5 | 3 (em casa, Instagram) | 5 | 4 | 2 |
| ROI demonstrável | 5 | 4 | 4 | 3 | 3 |
| Concentração local | 5 | 4 | 4 | 3 | 2 |
| Potencial de indicação (colega de ofício) | 5 | 5 | 3 | 3 | 2 |
| Velocidade de venda | 4 | 4 | 3 | 2 | 3 |
| Munição de venda pronta (catálogo, demo) | 5 | 4 | 4 | 3 | 1 |
| **Total** | **43** | **36** | **34** | **27** | **21** |

- **ICP A — barbearia de 1 a 4 cadeiras, dono que corta.** Mesma conclusão do `docs/18`/`docs/56`,
  agora com o porquê numérico.
- **ICP B — unhas/cílios solo.** Ciclo curtíssimo e indicação forte, mas R$ 49 pesa mais. Entra
  pelo Grátis; vira pagante quando tiver ajudante.
- **ICP C — salão de cabelo com equipe.** Vende pelo caixa/comissão, não pelo Motor. Depois.
- **Fora do primeiro lote:** estética (ciclo longo, Motor demora a provar) e casa (nenhuma
  munição de venda nem concorrente pesquisado).

---

## 5 · Ponto de entrada local

**Cidade 1: Maravilha/SC. [HIPÓTESE a confirmar com o Eduardo]** — é onde os outros projetos dele
estão (Art's Neia, Floricultura, Zimmer's). Se ele morar em outra cidade, troca o nome e mantém o
método: cidade onde o fundador pode **estar em pessoa** toda semana.

Por que uma cidade pequena é o laboratório certo:
- ~70–110 negócios visitáveis (§2) — dá para visitar **todos** do ICP A em 3 semanas;
- barbeiro conhece todo barbeiro da cidade: indicação corre em dias, não meses;
- a reputação local vira ativo (e o erro também — por isso suporte de mão na mão).

**Cidade 2 (só depois do playbook fechado): Chapecó**, ~55 km, polo regional. Mesmo perfil, 10×
maior. O critério para ir está no §14 (semana 4).

---

## 6 · Atribuição — construído nesta rodada

Sem saber de onde veio cada conta, o §14 não tem como escolher canal vencedor. Implementado
(commit `f8f663bc`, branch `distribuicao/motor-de-distribuicao`):

- `src/core/aquisicao/origem.ts` — lê `?origem=` (ou `utm_source`) e `?ref=` do link, saneia,
  **primeiro toque vence**, validade de 60 dias, nenhum dado pessoal.
- `middleware.ts` grava o cookie `ciclo_origem` (httpOnly, primeira parte) quando o link traz
  origem.
- O onboarding grava a origem no `meta` do evento `conta_criada` — **sem migration nova**.
- O selo e o convite montam o link por `linkComOrigem` (`?origem=selo&ref=<slug>`,
  `?origem=convite&ref=<slug>`). Guarda nova impede que voltem a apontar para a raiz.
- `/privacidade` declara o cookie.
- **Medido:** cadastro local chegando por `?origem=visita&ref=parceiro-teste` gravou
  `{"canal":"visita","ref":"parceiro-teste"}` no `conta_criada`. 5 mutações, 5 reprovações.

**Links que o Eduardo passa a usar** (todos contam no placar):

| Situação | Link |
|---|---|
| Visita presencial (cadastra junto com o dono) | `seuciclo.com.br/cadastro?origem=visita` |
| Bio do Instagram | `seuciclo.com.br/?origem=instagram` |
| Post/Reel específico | `seuciclo.com.br/?origem=conteudo&ref=<nome-do-post>` |
| Parceiro (representante, contador, escola) | `seuciclo.com.br/?origem=parceiro&ref=<codigo-do-parceiro>` |
| Evento/palestra (QR code) | `seuciclo.com.br/?origem=evento&ref=<nome-do-evento>` |
| Grupo de WhatsApp | `seuciclo.com.br/?origem=whatsapp` |

---

## 7 · O momento "aha" e o caminho até ele

O dono percebe que o CICLO vale dinheiro quando **vê o nome de uma cliente que sumiu e o valor
dela** — e confirma quando **essa cliente volta**. Tudo o mais é preparação.

Caminho mais curto hoje (tudo já existe):
1. cadastro (3 respostas) → 2. "quem eu já atendo" com 10–30 nomes e a última data aproximada →
3. o Motor lista quem está atrasado (`base_importada` → `motor_viu_valor`) →
4. um toque manda a mensagem pelo WhatsApp dele → 5. a cliente volta (`cliente_voltou`).

Na visita presencial o passo 2 é feito **junto**, com o caderno ou o WhatsApp do dono aberto. É
por isso que a visita converte mais que qualquer tela: ela pula a etapa em que todo freemium morre
(conta criada e vazia — exatamente o caso do `ciclos-ana`).

---

## 8 · Ferramenta grátis — a próxima construção

**"Quanto está parado em cliente que sumiu"** — página pública, sem cadastro, em `/quanto-parado`
(nome a validar). Três números que o dono sabe de cabeça:

- quantos clientes diferentes atende por mês;
- ticket médio;
- de quanto em quanto tempo o cliente fiel volta.

Saída: estimativa de clientes atrasados e **R$ por mês parado**, com a conta aberta (sem número
mágico, sem "70% dos salões" inventado). CTA: "descubra quem são, pelo nome — grátis", levando
`?origem=calculadora`.

Por que esta e não outra: é a única ferramenta do mercado que faz a conta **pelo ritmo de
retorno** (§2), serve de abertura de conversa na visita ("vamos fazer uma conta de 1 minuto?"),
e é o link que o representante/contador manda sem precisar "vender software".

---

## 9 · Plano de conteúdo

Os quatro pilares do `docs/56` §7 continuam valendo. O que muda: **todo post tem destino
medido**.

`post → calculadora (origem=conteudo&ref=<post>) → cadastro → "quem eu já atendo" → aha`

| Semana | Pilar | Peça | Destino |
|---|---|---|---|
| 1 | Dor com número | "Quanto um barbeiro de Maravilha perde por cliente que some?" — a conta ao vivo | calculadora |
| 1 | Bastidor | "Estou visitando barbearias daqui — o que vocês usam pra agenda?" (Story com enquete) | conversa no direct |
| 2 | Produto em uso | tela gravada da lista de quem sumiu (conta demo, sem dado real) | calculadora |
| 2 | Dor | "Seu cliente fiel volta a cada quantos dias?" (caixinha de pergunta) | conversa |
| 3 | Prova local | primeiro depoimento real (só com autorização) | cadastro |
| 3–4 | Benchmark local | "Média de retorno das barbearias da cidade" — **só quando houver ≥5 contas reais**, agregado e anônimo | calculadora |

Regras herdadas: nunca nomear concorrente, nunca dado de cliente final, nunca prometer
WhatsApp automático.

---

## 10 · Sistema de aquisição

`Lead → contato → visita → conta criada → base importada → aha → cliente voltou → pagante → indica`

- **Lista de leads montada à mão**, pelo Google Maps e Instagram da cidade. Sem compra de lista,
  sem raspagem. Planilha com as colunas do §17 do prompt:
  `negocio · segmento · bairro · cadeiras · instagram · sistema_atual · problema_provavel ·
  origem_do_lead · status · proximo_passo · data · objecao · frase_do_dono`.
- Status: `a visitar → visitado → conta criada → base importada → mandou 1ª mensagem →
  cliente voltou → pagante → indicou`.
- As etapas do meio **não precisam ser anotadas à mão**: vêm do banco (`product_events`, §13).
  A planilha guarda só o que o banco não vê — objeção, frase do dono, sistema atual.
- **Venda como pesquisa (§18 do prompt):** a coluna `frase_do_dono` é a mais importante. As
  palavras que ele usa viram a copy da landing no mês seguinte.

---

## 11 · Sistema de indicação

1. **Já existe:** convite de colega com texto na voz do dono — agora atribuído (`ref=<slug>`).
2. **Recompensa manual até existir `billing_credits`:** 1 mês grátis para quem indica quando o
   indicado pagar o 1º mês. Anotado à mão, conferido no placar (`ref` do `conta_criada`).
   **Não aparece na copy do produto** enquanto não for automático — regra da casa, a promessa de
   dinheiro é a mais cara.
3. **Teste em sequência, não em paralelo:** mês 1 só reconhecimento ("o selo do seu colega trouxe
   X"); mês 2 o crédito; comissão só para parceiro profissional (§12). A métrica é
   indicações atribuídas por conta ativa.

---

## 12 · Parceiros

| Parceiro | O que ganha | Link | Primeiro passo |
|---|---|---|---|
| **Representante de cosmético/barbearia** (1º a testar) | R$ 50 por conta que pagar o 2º mês | `?origem=parceiro&ref=<nome>` | conversar com 1 representante que atende Maravilha |
| Contador de MEI/ME | idem + argumento do Salão-Parceiro | idem | 1 escritório da cidade |
| Escola/curso de barbeiro | aula grátis de "gestão da cadeira" para a turma | `?origem=evento&ref=<escola>` | 1 turma |

O controle (origem, indicação, conversão, receita, comissão) sai do placar: `ref` do parceiro →
contas → quais viraram pagantes. Comissão paga à mão por Pix enquanto for < 20 contas.

---

## 13 · Placar de distribuição

Runbook: `docs/runbooks/placar-de-distribuicao.md` — SQL só de leitura, roda no SQL Editor do
Supabase ou pelo MCP. Mede, por canal e por `ref`: contas criadas, base importada, Motor viu
valor, cliente voltou, pagantes.

**O que não é medido, por decisão:** visitante anônimo da landing (sem analytics de terceiro —
`docs/09` §0.5). O substituto honesto é contar conversas na planilha: o topo do funil nesta fase
é presencial.

---

## 14 · Plano de 30 dias

**Canal principal:** visita presencial em Maravilha. **Secundário:** 1 representante como parceiro.
Instagram só como apoio da visita (não é canal próprio ainda).

| Semana | O que o Eduardo faz | O que eu (agente) faço |
|---|---|---|
| 1 | Confirmar cidade. Montar lista de 30 leads ICP A. Ajustar bio do Instagram com link de origem. 5 visitas. | Construir a calculadora (§8). Placar rodando. Roteiro de 1 página para a visita. |
| 2 | 10 visitas (meta: 8 contas criadas com base importada na hora). Conversar com 1 representante. | Ajustar onboarding pelo que as visitas mostrarem (ex.: importar do caderno mais rápido). |
| 3 | Voltar nas contas da semana 1 ("quantos voltaram?"). Oferta de fundador. Pedir indicação. 1º depoimento. | Página por intenção se houver sinal (ex.: "sistema para barbearia em Maravilha"). |
| 4 | Medir. Decidir o canal que fica. Escrever o playbook da cidade. | Relatório do mês com o placar. Próximo ciclo. |

**Critérios de sucesso (fim do mês):** ≥ 15 contas reais com base importada; ≥ 5 com
`cliente_voltou`; ≥ 3 pagantes a R$ 49; ≥ 1 conta vinda por indicação.

**Critérios de abandono/mudança:** se < 30% das contas visitadas importarem base, o problema é o
onboarding, não o canal → produto primeiro. Se contas importam mas ninguém manda mensagem em 14
dias → o problema é hábito → testar lembrete semanal para o dono. Se tudo anda mas ninguém paga →
oferta/preço, não produto.

**Critério para ir à cidade 2:** ≥ 3 pagantes E ≥ 1 indicação espontânea E o playbook escrito
(ICP, oferta, canal, taxa de conversão, principal objeção, melhor parceiro).

---

## 15 · O que só o Eduardo faz

Visitar, conversar, cobrar por Pix, fechar com parceiro e postar. Nenhuma linha de código
substitui as primeiras 30 conversas — e todo o resto deste documento só existe para que elas
rendam o máximo e deixem rastro medido.

---

## 16 · Registro de execução

Mais recente embaixo. Cada linha diz o que foi medido, não só o que foi feito.

| Rodada | O quê | Prova |
|---|---|---|
| 1 | Atribuição de origem (§6): cookie de primeiro toque, selo e convite com `?origem=&ref=` | cadastro local por `?origem=visita&ref=parceiro-teste` gravou a origem no `conta_criada`; 5 mutações reprovadas |
| 1 | Placar (§13) | SQL executado no banco local; controle positivo mostrou a linha `visita / parceiro-teste` |
| 2 | Calculadora pública (§8) em `/calculadora`, estática | build: `○ /calculadora` 3,98 kB; conta conferida no navegador a 390 px; "R$ 426 × 8 = R$ 3.407" pego na tela e corrigido |
| 3 | Origem sobrevive ao link de confirmação aberto em outro navegador (`user_metadata`) | cadastro com cookie de convite + onboarding sem cookie → origem no `conta_criada` |
| 3 | Kit de visita + modelo de planilha | promessa "a lista aparece na hora" conferida no código (`preverEPersistirCiclos`) |
| 4 | Conta nova: 1º passo virou "Traga quem você já atende" | teste de integração afirma a ordem; mutação reprovada |
| 4 | Serviço padrão da base trazida: mais atendido, ou ritmo mediano (era "Barba · 14 dias" por ordem alfabética) | tela a 390 px mostra "Corte · 21 dias"; mutação reprovada |
| 4 | Recuperar: cliente sem telefone ganha "Chamar" (`wa.me` sem número → seletor de contatos do dono) | "Avisar" nessa pessoa terminava em "sem telefone cadastrado"; toque de 48 px sondado; guarda + mutação |
| 4 | "seu último barba": texto de recuperação reescrito ("último horário de {serviço}") | teste com serviço feminino |

| 5 | Convite de colega no pico: linha abaixo do herói "O Motor de Ciclo trouxe", atribuída | simulado no banco local (mensagem + agendamento concluído ontem) → herói e convite na tela |
| 5 | Texto do convite dizia "aqui do Barbearia …" → "do meu negócio, {nome}" | teste com nome feminino; o `\b` do teste virou backspace no heredoc e foi pego no byte |
| 6 | 8 roteiros de conteúdo com `ref` por peça (`roteiros-de-conteudo.md`) | — |
| 7 | Recuperar: ressalvas viraram `<details>` + uma linha; "cada uma… ela" → "cada pessoa" | a 390 px o primeiro nome aparece sem rolar |
| 8 | Tela "confira seu e-mail" ganha "Abrir o Gmail/Outlook/…" | teste da função; **não** verificado no navegador (exigiria criar conta digitando senha) |
| 9 | `/cadastro?origem=calculadora` continua a frase do botão ("Vamos achar quem sumiu, pelo nome") | HTML servido conferido nos dois casos |
| 10 | Verificação ampla: lint inteiro, RLS 210/210, integração 410/411 | a falha que sobra (`job-queue`, contagem de `finish_job` sob contenção) é pré-existente e já diagnosticada |
| 11 | "Chamar" manual passa a contar para o Motor (mensagem `sent`, carimbo, `recuperacao_enviada`) | integração 7/7 + mutação; clique no app registrou a linha |
| 11 | Placar ganha `mandou_mensagem` | controle positivo local |
| 12 | Guarda cega antiga achada: `estrelas-nao-repetem-o-svg` tinha `\b` virado backspace (0x08) | mutação: versão antiga verde com o defeito, nova reprova; guarda nova contra byte de controle em `src/`/`tests/` |
| 12 | Cartão A6 com QR (`material/cartao-a6.html`) | renderizado; QR **não** lido por câmera |
| 13 | `code-review` (high) da branch: 8 achados, 8 corrigidos | prefetch de `<Link>` gravava origem sem clique (header conferido no Next instalado); calculadora sumia acima do teto; chamada manual sem opt-out nem trava de 7 dias; "mais atendido" contava cancelados; origem malformada virava convite; convite no pico sumia em dia com receita |

| 14 | Copy pública varrida por "único/nenhum concorrente" (a Zenoti já prevê cadência pessoal) | nenhuma alegação pública; todas as ocorrências são comentário |
| 14 | Link de agendamento de conta nova ganha prévia com imagem (`/[slug]/previa`, 1200×630, nome e cor do negócio) | antes: sem `og:image`, cartão só texto no WhatsApp; PNG gerado conferido, meta tags na página, mutação reprovada, build `ƒ /[slug]/previa` |

**O que continua em aberto e é do Eduardo:**

1. Confirmar a cidade (§5).
2. Empurrar/abrir PR desta branch (`distribuicao/motor-de-distribuicao`, nascida de `origin/main`).
3. **Decisão nova — quem paga o "Avisar".** Produção tem `WHATSAPP_*` configurado desde ~13/09, então
   "Avisar" num cliente COM telefone sai pelo número do CICLO, como template de recuperação —
   categoria marketing, ~R$ 0,31 por mensagem, pago pelo CICLO, e sem teto por plano no envio de um
   por vez. Isso contraria a regra já registrada ("nunca empacotar WhatsApp ilimitado em nenhum
   preço") e ainda manda a mensagem de um número que a cliente não conhece. O caminho que esta
   rodada criou ("Chamar", `wa.me` pelo WhatsApp do próprio dono, grátis e pessoal) poderia ser o
   padrão também para quem tem telefone, com "Avisar pelo sistema" como opção paga. Não mudei:
   é decisão de preço e de canal.
4. As visitas.
