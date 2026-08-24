# 18 · PLANO DE MONETIZAÇÃO, PREÇO E CRESCIMENTO

> Executa o `docs/17-MONETIZACAO-PROMPT.md`. Escrito em **2026-08-24**.
> Nenhuma linha de código foi escrita nesta rodada — o plano é o entregável (§9 do prompt).
>
> **Rótulos** (§2.4 do prompt): **[M]** Medido · **[E]** Estimado, com fórmula · **[S]** Suposto.
> **Classificação** (§7): **Decidido** · **Recomendado** · **Do Eduardo** · **Bloqueado**.

---

## Sumário executivo — leia isto se não ler mais nada

1. **A recomendação principal contraria o pedido, e é a parte mais importante deste documento.**
   Você pediu 3 planos. O plano de 3 degraus está **desenhado** aqui (Fase D/E) e **não deve ser
   construído agora**. Com zero clientes pagantes, o certo é lançar com **um preço só**, cobrado
   quase à mão, e deixar a escada em papel até existir demanda que a justifique. O raciocínio
   está na Fase P e é atacado no §Red Team.

2. **Preço recomendado de entrada: R$ 49/mês — mas a justificativa mudou.** O mercado ancora
   entre R$ 29 e R$ 110 **[M]**. R$ 49 entra abaixo do Trinks (R$ 76) e do Avec (R$ 88,90), mas
   **23% acima do Simples Agenda (R$ 39,90, 3.900 salões, mesmo modelo de cobrança)** **[M]**.
   Contra ele, o CICLO **não é o barato** — e por isso a venda tem que ser sobre o Motor de Ciclo,
   nunca sobre agenda. Se a conversa virar comparação de preço de agenda, o preço está errado
   (E.2.1).

3. **A métrica de cobrança recomendada é número de profissionais como fronteira de degrau, mas
   preço fixo por negócio** — não preço por assento. A base do CICLO é majoritariamente solo, e
   cobrar por assento nessa base é ARPU minúsculo.

4. **PSP recomendado: Mercado Pago**, e a razão é uma conta específica — Pix a **0,99% sem piso
   fixo** **[M]** contra **R$ 1,99 fixo** do Asaas **[M]**. Numa mensalidade de R$ 49, isso é
   R$ 0,49 contra R$ 1,99: **4× de diferença** na taxa efetiva, justamente no degrau de entrada.

5. **O maior risco não é preço, é custo de suporte.** Num ticket de R$ 49, meia hora de suporte
   por mês come **51% do bruto sozinha** — e somada a imposto e PSP leva **58% de tudo que
   entra** **[E]**. **Uma hora de suporte dá prejuízo de R$ 4,43 por cliente** **[E]**. Isso decide mais o destino do negócio que qualquer escolha de
   tabela.

6. ⭐ **Cobrar tem um custo fixo que a primeira versão esqueceu: R$ 194/mês, não R$ 55.**
   **MEI é vedado para software** **[M]**, então é ME no Simples Nacional, e contabilidade
   (R$ 139–195/mês **[M]**) passa a existir **antes do primeiro cliente**. Todos os números da
   Fase F foram refeitos: a meta saiu de 71 para **84 pagantes** (F.8).

7. ⭐ **O produto está com o motor desligado no ar, e isso é mais urgente que cobrança.**
   Existem **6 rotas de cron construídas** e `vercel.json` com `crons: []` **[M]** — entre elas
   `reminders` e `recompute-cycles`, ou seja, **o lembrete e o próprio Motor de Ciclo nunca
   rodaram em produção**. A solução recomendada custa **R$ 0** (GitHub Actions batendo nas rotas
   que já existem, L.5) e **sobe para a fase de curto prazo**: não adianta vender diferencial que
   está desligado.

8. ⭐ **Pix Automático mudou o jogo e é o achado mais favorável do documento.** A recorrência
   nativa do Bacen ficou disponível em **todas** as instituições em **1º/1/2026** **[M]**. A
   ressalva do próprio prompt ("Pix não é naturalmente recorrente") caiu — dá para cobrar
   assinatura por Pix, a 0,99%, de quem não tem cartão (J.4).

9. ⚠️ **O Fresha já está no Brasil a R$ 39,95 e sem comissão de marketplace** **[M]** — a
   terceira rodada de pesquisa desmentiu a fonte que dizia US$ 19,95 + 20%. Junto com o Simples
   Agenda (R$ 39,90), são **dois concorrentes convergindo em ~R$ 40** no exato degrau de entrada
   do CICLO, e um deles **traz cliente novo de graça**. Ver A.1.1 e R.5.

10. **Existe um vazio de mercado real — e ele é mais estreito do que parecia.** Software de
   serviço de campo no Brasil começa em **R$ 295–525/mês** **[M]**: é produto para empresa com
   frota, não para autônomo. Mas o eletricista **já gasta com software** — no **GetNinjas**, que
   cobra **por lead** (moeda a R$ 0,15 **[M]**) e vende *cliente novo*, não organização (A.4).
   O CICLO só ganha esse público quando a dor dele virar reter, não achar. É a aposta mais
   interessante e a menos validada.

---

## FASE A · Pesquisa de mercado e preço

Tudo consultado em **2026-08-24** via `WebSearch`/`WebFetch`.

### A.1 · Tabela de concorrentes

Duas rodadas de pesquisa. As linhas 1–8 saíram da primeira; as linhas 9–13 desta auditoria, que
foi atrás dos concorrentes nomeados no §6 do prompt e que a primeira rodada não cobriu.

| Produto | Degraus e preço | Métrica de cobrança | Grátis? o que limita | Taxa sobre transação | Preço público? | Fonte | Consultado em |
|---|---|---|---|---|---|---|---|
| **Trinks** ✅ *confirmado na fonte* | R$ 76 (1–2 prof) · R$ 110 (3–4) · 5–10, 11–20, 21+ **sob consulta** | **Faixa de profissionais** | Não. **5 dias** de teste | Não (tem conta digital integrada) | Parcial — some acima de 5 prof | **[negocios.trinks.com/planos](https://negocios.trinks.com/planos/)** (fornecedor) | 2026-08-24 |
| **Belasis** | Lite R$ 99 · Pro R$ 189 · Scale **sob consulta** | Por negócio (fixo) | Não. Teste grátis (duração não publicada) | Não informado | Parcial | [belasis.com.br/precos](https://www.belasis.com.br/precos) | 2026-08-24 |
| **SPAgenda** | R$ 29/mês · R$ 290/ano (−16%) | Por negócio (fixo) | Não. **30 dias** de teste | Não informado | Sim | [spagenda.com](https://spagenda.com/artigo/quanto-custa-sistema-agendamento) | 2026-08-24 |
| **Fresha** ⚠️ *corrigido na 3ª rodada* | **R$ 39,95/mês** (Independent, 1 pessoa) · **R$ 26,95 por membro** (Team) · Enterprise 20+ sob consulta | Por membro | Não. **7 dias** de teste | ⚠️ **Zero.** A própria página diz que a taxa sobre cliente novo do marketplace é **grátis**, e que cliente que volta nunca paga taxa | Sim | **[fresha.com/pricing](https://www.fresha.com/pricing)** (página do fornecedor, preços já em BRL) | 2026-08-24 |
| **Booksy** ⚠️ *fonte secundária* | US$ 29,99 + US$ 20/membro extra | Por membro | Não | 30% da 1ª visita, **só no Boost opcional** | Sim | [twizzlo.com](https://twizzlo.com/articles/fresha-vs-booksy/) — **blog comparativo, não o fornecedor**; a página de preço do Booksy devolveu 404 nas tentativas. Tratar como **[S]**, não [M] | 2026-08-24 |
| **Field Control** | Básico **R$ 525**/mês · módulo extra **R$ 89** (Otimizador Avançado R$ 169) · ⚠️ **implantação de R$ 899** | Por licença/técnico | Não | Não | Parcial | [capterra](https://www.capterra.com/p/207608/Field-Control/) + [store.omie.com.br](https://store.omie.com.br/apps/field-control) — fornecedor não publica tabela | 2026-08-24 |
| **Auvo** | **Sob consulta** | Por usuário | Não | Não | **Não** | [capterra.com.br](https://www.capterra.com.br/compare/201778/207608/auvo/vs/field-control) | 2026-08-24 |
| **Nuvemshop** *(calibragem)* | Grátis → R$ 69 → R$ 164 → R$ 449 → R$ 999+ | Por loja + taxa de venda | **Sim** (plano Começo) | Isenta usando Nuvem Pago | Sim | [litextension.com](https://litextension.com/pt/blog/nuvemshop-pricing-plans) | 2026-08-24 |
| **Avec** ⭐ | **R$ 88,90** (1–2 prof) · 3–5, 6–10, 11–20, 21+ **sob consulta**. Diz atender **40 mil** estabelecimentos | **Faixa de profissionais** | Não anunciado na página de planos | Roda sobre **Asaas** — a própria página cita "taxas transacionais com o Asaas", sem publicar o % | Parcial — some acima de 2 prof | [negocios.avec.app/planos](https://negocios.avec.app/planos) | 2026-08-23 |
| **Simples Agenda** ⭐ | **R$ 39,90/mês** no anual, 1 profissional. Degraus **só** por nº de profissionais | **Faixa de profissionais**, e **as funcionalidades são idênticas em todos os degraus** | Não. **35 dias** de teste | Não informado | Sim | [simplesagenda.com.br/site/precos.php](https://www.simplesagenda.com.br/site/precos.php) — a página devolve **403 a robô**; dados obtidos por busca | 2026-08-23 |
| **Produttivo** | **Sob consulta**. Três planos nomeados (Padronização, Produtividade, Performance) | Não publicado | 15 dias de teste | Não publicado | **Não** | [produttivo.com.br/planos](https://www.produttivo.com.br/planos/) | 2026-08-23 |
| **GetNinjas** *(concorrente de carteira)* | **Não é assinatura.** Pacote de moedas: 4.800 moedas = **R$ 716**; 1 moeda ≈ **R$ 0,15** | **Por lead respondido** — paga para enviar orçamento, sem garantia de fechar | Cadastro grátis; **responder é pago** | **0% de comissão** sobre o serviço fechado | Sim | [help.getninjas.com](https://help.getninjas.com/hc/pt-br/articles/360000476353-O-que-s%C3%A3o-moedas-) | 2026-08-23 |
| **Contabilizei** *(calibragem + insumo da Fase F)* | Básico **R$ 139** · Padrão **R$ 195** · Multibenefícios **R$ 225** · Experts **R$ 395** | Por empresa | Não | — | Sim | [contabilizei.com.br/quanto-custa-contabilizei](https://www.contabilizei.com.br/quanto-custa-contabilizei/) | 2026-08-23 |

*(Fontes com preços divergentes entre si na Nuvemshop — R$ 58,65/139,40/381,65 numa, R$ 69/164/449 noutra. Usei a mais alta; a diferença não muda a conclusão de calibragem.)*

**Quatro dos treze escondem preço** (Trinks e Avec acima de 2–5 profissionais, Auvo e Produttivo
por inteiro) **[M]**. O §2.1 do prompt manda tratar isso como achado, e é: **preço público é
diferencial de baixo custo e alta confiança** num público que desconfia de "fale com um
consultor". Entra na Fase M como decisão de produto, não de marketing.

*(As linhas novas foram consultadas em 2026-08-23, na virada para o dia 24 em que esta auditoria
foi escrita. As datas da coluna são as da consulta real, não a da redação.)*

### A.1.1 · ⭐ Terceira rodada — o que aconteceu ao exigir a página do fornecedor

O §2.1 do prompt manda buscar **na página real**. A segunda rodada aceitou blog comparativo em
quatro linhas. Ao voltar nas fontes primárias, **duas se confirmaram e uma estava errada nos dois
números que importavam**:

| Produto | O que o blog dizia | O que o fornecedor diz | Veredito |
|---|---|---|---|
| **Trinks** | R$ 76 / R$ 110, 5 dias | idem, mais a lista de add-ons | ✅ confirmado |
| **Fresha** | **US$ 19,95** e **20% de comissão** de marketplace | **R$ 39,95** e **comissão zero** | ❌ **errado nos dois** |
| **Field Control** | R$ 525 + R$ 89/licença | idem, **+ R$ 899 de implantação** | ⚠️ incompleto |
| **Booksy** | US$ 29,99 + US$ 20/membro | página devolveu 404 | ⚠️ **rebaixado para [S]** |

**Esta é a razão de o §2.1 existir**, e vale registrar como método: o erro do Fresha não era de
arredondamento. Era um preço em moeda errada (**2,7× mais caro que o real, ao câmbio de R$ 5,50**)
e uma comissão de 20% **que não existe**. Uma decisão de posicionamento tomada em cima disso teria
sido tomada contra um concorrente imaginário.

#### O que a correção do Fresha faz com este plano

**Piora bastante, e em três lugares:**

1. **Fase E (preço).** O Fresha custa **R$ 39,95** no Brasil para profissional solo — praticamente
   empatado com o Simples Agenda (R$ 39,90). Não é mais "um caro e um barato": **dois concorrentes
   independentes convergiram em ~R$ 40 para o público-alvo exato do degrau de entrada do CICLO.**
   R$ 49 é 23% acima de ambos.
2. **Red Team R.5.** A ameaça estava escrita como hipótese futura — *"se o Fresha trouxer
   marketplace ao Brasil"*. **Ele já trouxe**, com preço em real e **sem cobrar comissão sobre
   cliente novo**. O laço de crescimento mais forte que existe nesta categoria (alguém traz
   cliente pagante para o profissional) está sendo oferecido de graça por um concorrente.
3. **Fase G (laços).** Todo o capítulo de laços do CICLO é sobre *distribuição da marca*
   (selo, link, indicação). Nenhum deles traz **cliente final** para o profissional. O Fresha traz,
   e é isso que um autônomo quer comprar.

**A resposta honesta não é ajustar preço — é reconhecer que o CICLO não compete com marketplace
e nunca vai competir** (marketplace está fora de escopo por decisão do §10 do prompt). O que sobra
é a diferenciação da E.2.1, agora com um adversário a mais e com menos margem de erro.

### A.2 · O que a pesquisa mudou em relação ao que eu supunha

Cinco correções — inclusive a uma premissa do meu próprio prompt e **duas contra recomendações
deste documento**:

- **"Fresha é grátis" está desatualizado.** O prompt (§8 do 17) citava o Fresha como ameaça
  gratuita. Ele **aposentou o modelo grátis em 2025** **[M]** e hoje cobra assinatura **e** 20% de
  comissão sobre cliente novo do marketplace. A ameaça mudou de forma.
- **Trinks cobra à parte por lembrete, fidelidade e WhatsApp** **[M]** — confirmado na página do
  fornecedor, que lista como "itens adicionais": app exclusivo, clube de assinatura, automação de
  WhatsApp, SMS e e-mail, programa de fidelidade, **lembretes automáticos**, **convite de retorno**
  e emissão de nota. O CICLO tem essas coisas **incluídas e prontas**.
- ⭐ **E o item mais revelador dessa lista é "convite de retorno".** É, com outro nome, **o Motor
  de Ciclo** — e o líder do mercado brasileiro de beleza **cobra por ele à parte**. Isso é a melhor
  evidência externa que este documento tem de que o diferencial do CICLO **tem valor comercial
  reconhecido**, e não é só uma opinião interna sobre o produto. Sustenta diretamente o argumento
  de preço da E.2.1.
- ⭐ **A métrica de cobrança recomendada na Fase C não é invenção — é o padrão do mercado
  brasileiro de beleza** **[M]**. Trinks, Avec e Simples Agenda **todos** cobram por *faixa de
  profissionais* com preço fixo dentro da faixa. Só Belasis e SPAgenda são fixos puros. Isso
  **fortalece** a Fase C: ela deixa de ser aposta de desenho e passa a ser convenção da categoria,
  que o cliente já sabe ler.
- ⭐ **E o mesmo achado enfraquece a Fase E.** O **Simples Agenda cobra R$ 39,90 para 1
  profissional** **[M]**, com **funcionalidades idênticas em todos os degraus** e **35 dias** de
  teste — e diz ter mais de 3.900 salões. O preço de entrada recomendado (R$ 49) é **23% mais
  caro que um concorrente direto, estabelecido, com o mesmo modelo de cobrança**. A primeira
  rodada ancorou no Trinks (R$ 76) e por isso R$ 49 pareceu barato. Contra o Simples Agenda,
  não é. Ver E.2, reescrita.
- ⭐ **O piso do mercado não é R$ 29 de brinquedo — é R$ 39,90 de produto sério.** O SPAgenda a
  R$ 29 podia ser descartado como piso; o Simples Agenda a R$ 39,90 com 3.900 clientes, não.

### A.3 · Faixa crível para o CICLO

| Referência | Valor | Rótulo |
|---|---|---|
| Piso do mercado (SPAgenda) | R$ 29 | **[M]** |
| **Concorrente direto estabelecido, 1 prof (Simples Agenda, anual)** | **R$ 39,90** | **[M]** |
| **Fresha Independent, 1 pessoa — e com marketplace sem comissão** | **R$ 39,95** | **[M]** |
| Faixa "melhor custo-benefício" declarada pelo mercado | R$ 50–80 | **[M]** |
| Entrada do líder de beleza (Trinks, 1–2 prof) | R$ 76 | **[M]** |
| Entrada do Avec (1–2 prof), 40 mil estabelecimentos | R$ 88,90 | **[M]** |
| Entrada do concorrente fixo (Belasis) | R$ 99 | **[M]** |
| Serviço de campo (Field Control) | R$ 295–525 | **[M]** |

**Leitura:** a faixa crível de **entrada** para 1 profissional é **R$ 39–89**, e o CICLO tem
produto comparável em amplitude com **maturidade e reputação de zero**. O preço de entrada tem
que refletir isso.

**Onde o CICLO ganha:** lembrete/confirmação, fidelidade e Motor de Ciclo inclusos (Trinks cobra
à parte **[M]**) · página pública que é mini-site de verdade · 17 profissões, não só beleza ·
LGPD levada a sério (cofre cifrado, trilha de acesso — auditado) · **preço público inteiro**,
enquanto quatro dos treze escondem os degraus de cima **[M]**.

**Onde o CICLO perde, sem eufemismo:** zero reputação e zero prova social (Avec anuncia 40.000
estabelecimentos **[M]**, Belasis 16.000 **[M]**, Simples Agenda 3.900 **[M]**) · sem app nativo ·
sem marketplace que traga cliente novo · sem conta digital/maquininha integrada, âncora forte do
Trinks e do Avec · **teste grátis mais curto que o de quase todo mundo** se o CICLO ficar em 14
dias enquanto o Simples Agenda dá 35 e o SPAgenda 30 **[M]** · suporte de uma pessoa só.

### A.4 · GetNinjas não é substituto de produto — é substituto de orçamento

O prompt mandou olhar o GetNinjas como **concorrente de carteira**, e o achado justifica a
instrução: ele **não cobra assinatura**, cobra **por lead respondido** (moeda a ≈ R$ 0,15
**[M]**), e não tira comissão do serviço fechado **[M]**.

A consequência é específica e desconfortável para a Fase B: **o eletricista e a faxineira já
gastam com software — só que gastam em aquisição de cliente, não em organização.** Um pacote de
R$ 149 no GetNinjas compra leads; R$ 49 no CICLO compra agenda. Para quem não tem cliente
sobrando, o primeiro ganha sempre.

Isso não invalida o vazio de mercado da A.1 (não existe SaaS de gestão a R$ 50 para serviço de
campo) — **redefine contra o que ele compete.** O CICLO só ganha desse público quando o problema
dele já for *reter e organizar*, não *achar*. É mais um motivo para o ICP de beleza (Fase B), onde
o cliente volta sozinho e a retenção é a dor real.

---

## FASE B · Segmentação — quem é o cliente que paga

### B.1 · O problema de foco

17 profissões é excelente para tamanho de mercado e **péssimo para os próximos 90 dias**: cada
profissão tem canal, vocabulário e objeção diferentes. Vender para todas é não vender para nenhuma.

### B.2 · ICP recomendado para o 1º ano

**Barbearia e salão pequeno (1 a 4 profissionais), em uma cidade só.** — **Recomendado**

Motivos:
1. É a única profissão com **catálogo real** no produto (os 6 serviços do `dom-rocha` vieram de um
   negócio de verdade **[M]**; faxina e eletricista têm preço/duração estimados, registrado
   honestamente em `docs/DECISOES.md`).
2. É a categoria com maior densidade por bairro — e densidade é o combustível dos laços (Fase G).
3. Já tem hábito de pagar por software (Trinks, Belasis e Booksy existem porque há mercado).
4. O ciclo de retorno é curto (2–4 semanas), o que faz o Motor de Ciclo mostrar valor rápido.

### B.3 · O que fica de fora de propósito

**Eletricista, faxineira e as demais 15 profissões não são ICP agora** — o produto continua
funcionando para elas, e elas continuam podendo se cadastrar. O que não vai acontecer é esforço de
venda, material e suporte dedicado.

**Mas guarde a Fase A.1:** o vazio de R$ 50 no serviço de campo é a oportunidade mais
interessante do CICLO. A recomendação é **sequenciar, não descartar** — provar o modelo onde há
hábito de pagar, e atacar o vazio depois, com dinheiro de cliente e não de esperança.

### B.4 · Disposição a pagar por perfil — **[S]**

| Perfil | Receita mensal típica **[S]** | DAP estimada **[S]** | Observação |
|---|---|---|---|
| Barbeiro solo | R$ 4–8 mil | R$ 30–60 | Compara com o preço de 1 corte |
| Barbearia 3–4 cadeiras | R$ 15–30 mil | R$ 80–150 | Já paga software hoje |
| Salão 5+ | R$ 30 mil+ | R$ 150–300 | Território do Trinks/Belasis |
| Faxineira solo | R$ 2–4 mil | **R$ 0–25** | Margem apertada, baixa afinidade digital |
| Eletricista solo | R$ 4–10 mil | R$ 30–80 | Orçamento é a dor real, não agenda |

⚠️ **Toda esta tabela é Suposto.** Não há um único cliente pagante para calibrar. A Fase E propõe
como sair dessa condição (Van Westendorp nas conversas de venda), e a Fase O transforma isso em
previsão verificável.

---

## FASE C · Métrica de valor — a decisão estrutural

### C.1 · As opções, com consequência

| Métrica | A favor | Contra | Quem usa **[M]** |
|---|---|---|---|
| **Por negócio (fixo)** | simples de vender e entender; previsível | solo paga igual a salão de 5 cadeiras; sem receita de expansão | Belasis, SPAgenda |
| **Por profissional/assento** | escala com o time; padrão do setor | **pune quem cresce**; base majoritariamente solo → ARPU baixo | Trinks, Fresha, Booksy |
| **Por agendamento/mês** | escala com uso real | imprevisível para quem paga; gera ansiedade e faz esconder uso | — |
| **Por cliente cadastrado** | cresce sozinho | pune importar base — e a importação de CSV é *feature de aquisição* | — |
| **% do que ele recebe** | alinhamento perfeito | exige ser o meio de pagamento; muda o produto inteiro | Fresha (parcial) |

### C.2 · Recomendação — híbrido

**Número de profissionais define o degrau; o preço é fixo por negócio dentro do degrau.**
— **Recomendado**

Ou seja: **não** é "R$ 30 por profissional". É "até 1 profissional custa R$ 49; até 5 custa R$ 99".

Por quê:
- Preserva o que o mercado de beleza já entende (Trinks escalona por profissional);
- **Evita a armadilha do assento numa base solo** — se a maioria dos tenants tem 1 profissional
  (e hoje **6 dos 8 tenants têm exatamente 1** **[M]**), cobrar por assento significa que quase
  toda a receita vem do degrau mais barato, sem caminho de expansão;
- Dá previsibilidade a quem paga, que num autônomo importa mais que otimização de centavos.

### C.3 · O que se perde

Sem preço por assento, uma barbearia que vai de 3 para 4 cadeiras **não gera receita adicional**
até cruzar a fronteira do degrau. É expansão de receita mais grosseira. Aceito de propósito: com
zero clientes, previsibilidade e simplicidade valem mais que otimização de expansão.

### C.4 · Quando esta decisão envelhece mal

Se o ICP virar salão de 8–15 profissionais, o degrau fixo deixa dinheiro na mesa e o assento passa
a ser certo. **Gatilho de revisão:** quando mais de 25% dos pagantes estiverem no degrau mais alto.

---

## FASE D · Empacotamento

### D.1 · Princípio de desenho

Cada degrau precisa de **uma dor específica que faz subir**. Degrau que é só "mais completo" não
existe. Ancorado nos 16 módulos do `09-PLATAFORMA.md §6`.

### D.2 · A decisão mais delicada: o que o plano grátis leva

O §13.1 já decidiu que **o grátis é canal de distribuição**, não isca. Isso cria uma tensão real:

- Generoso demais → ninguém sobe de degrau;
- Apertado demais → ninguém usa, o link não circula, e o laço que justifica o grátis **morre**.

**Resolução recomendada — "vê o dinheiro, não colhe sozinho":**

O plano grátis **mostra** a tela "Recuperar receita" (quem sumiu e quanto vale), que é o Motor de
Ciclo, o diferencial do produto. O que ele **não** dá é a alavanca: mandar em lote. No grátis, a
pessoa manda **uma a uma** pelo `wa.me`.

Por que isto é o desenho certo, e não um truque:
- O valor fica **visível e verdadeiro** — a pessoa vê R$ 800 de clientes atrasados, com nome;
- O trabalho manual é **real**, não artificial: mandar 30 mensagens à mão é chato porque é chato;
- Ela pode fazer de graça para sempre se quiser. Ninguém está sendo enganado;
- Passa no teste do §5.10: continua funcionando mesmo se a pessoa souber exatamente como funciona.

**Esconder o Motor de Ciclo do grátis seria o erro oposto** — a pessoa nunca descobre por que o
CICLO é diferente de uma agenda qualquer, e o produto vira commodity na cabeça dela.

### D.3 · Tabela de planos proposta

| Plano | Preço | Métrica | Módulos ligados | Limites | A dor que faz subir daqui | Classif. |
|---|---|---|---|---|---|---|
| **Grátis** | R$ 0 | 1 profissional | Agenda · Página pública **com selo** · Clientes/CRM · Ficha · Motor de Ciclo **(só ver)** · Lembrete manual | 1 prof · **50 clientes** · sem envio em lote | *"Vejo R$ 800 parados e mando um a um"* | Recomendado |
| **Essencial** | **R$ 49** | 1 profissional | + Envio em lote · Campanhas · Comanda e caixa · Orçamento · **Remove o selo** | 1 prof · clientes ilimitados | *"Contratei alguém e preciso de agenda separada"* | Recomendado |
| **Equipe** | **R$ 99** | até 5 profissionais | + Agenda por profissional · Comissão · Relatórios · Fidelidade | 5 prof | *"Passei de 5 / preciso de estoque / atendo saúde"* | Recomendado |
| **Avançado** | **R$ 179** | ilimitado | + Estoque · **Anamnese e cofre** · Recorrência avançada · API | — | — | Recomendado |

**Notas de desenho:**

- **O selo sai no primeiro degrau pago.** É o único item que é puramente "pagar para remover", e
  o §13.1 avisa: selo feio faz pagar só para removê-lo e o laço fecha uma vez. Como o selo é
  bonito e discreto (decisão de `08-REDESIGN-E-IDENTIDADE.md`), removê-lo é escolha estética, não
  alívio de vergonha. **Isso é receita trocada por distribuição, e a troca é consciente.**
- **Anamnese e cofre no degrau mais alto** não é gula: é dado de saúde, com custo de conformidade
  real (LGPD, cifragem, trilha de acesso, MFA — tudo já construído e auditado). Quem precisa
  disso é clínica de estética, que tem faturamento para pagar.
- **Limite de 50 clientes no grátis** é **[S]**. A única referência interna é o `dom-rocha` com 46
  clientes **[M]** — e é **base semeada, não uso real**. O número é um chute educado que precisa
  ser recalibrado assim que houver 20 tenants ativos de verdade.

### D.4 · O nome dos planos

`gratis` · `essencial` · `equipe` · `avancado` — **Recomendado**

Resolve a §4.3 do prompt: hoje o enum tem `pro` **e** `profissional` como degraus distintos, que
ninguém distingue numa tabela de preço. Como **nenhuma linha de código lê `tenants.plan`** **[M]**,
renomear agora é troca de rótulo pura, custo zero. Depois de existir cobrança, é migração de dado
de cliente pagante.

Migração: `pro → essencial`, `profissional → equipe`, `avancado` fica, `gratis` fica.

**Sobre a §4.4 do prompt ("o pedido fala em 3 planos; o enum tem 4 valores"):** não há conflito a
resolver — **`gratis` não é um plano vendido, é o estado de quem não paga.** São 3 degraus pagos
(`essencial`, `equipe`, `avancado`) mais o estado gratuito, e o enum com 4 valores está certo.
O que estava errado era ter `pro` **e** `profissional` como degraus distintos, que D.4 resolve.
— **Decidido**

### D.5 · ⭐ Os quatro eixos — a §4.7 do prompt, que a primeira versão não respondeu

O prompt exige que limites e módulos funcionem nos **4 eixos** que o `09-PLATAFORMA.md §4` modelou.
Os eixos reais, lidos na migration `0023_tenant_eixos.sql` **[M]**, são:

| Eixo | Coluna | Valores |
|---|---|---|
| 1 · Onde acontece | `tenants.onde` | `no_local` · `vai_ate` · `remoto` · `hibrido` |
| 2 · Como cobra | `tenants.cobranca` | `fixo` · `hora` · `visita_hora` · `diaria` · `orcamento` · `pacote` · `recorrente` |
| 3 · Como começa | `tenants.inicio` | (definido na mesma migration) |
| 4 · Com que ritmo | `tenants.ritmo` | `avulso` · `recorrente` · `sazonal` · `sob_demanda` |

*(Nota: o §4.7 do prompt chama o eixo 1 de `vai_ate`. `vai_ate` é um **valor** do eixo `onde`, não
o nome do eixo. Erro do prompt, corrigido aqui contra o schema.)*

**A tensão que ninguém tinha nomeado: existem DUAS razões diferentes para um módulo estar
desligado, e o plano é só uma delas.** O `09-PLATAFORMA.md §6` já define módulos ligados **por
eixo**: *Recorrência* por eixo 4, *Orçamento* por eixo 3, *Deslocamento e rota* por eixo 1.
Isso não é upsell — é **relevância**. Um barbeiro que atende no local não deveria ver "rota"
nem no plano mais caro.

**Regra de precedência recomendada — três camadas, nesta ordem:**

```
1. EIXO      decide se o módulo faz SENTIDO para este negócio   → some da interface
2. PLANO     decide se o módulo está LIBERADO                   → aparece bloqueado, com motivo
3. DONO      decide se ele QUER ver                             → aparece desligado, reversível
```
— **Recomendado**

A ordem importa e é a parte fácil de errar: **eixo antes de plano.** Se plano viesse primeiro, um
eletricista veria "Fidelidade bloqueada — assine o Equipe" para um módulo que ele nunca vai usar.
Isso é a regra 5.2 (mostrar motivo e caminho) aplicada ao contrário — vira ruído e queima a tela
de bloqueio, que é a peça de conversão mais importante do produto (M.1).

**Consequência para a tabela de planos (D.3):** os degraus **não podem** ser definidos por lista
fixa de módulos, porque a lista varia por eixo. O degrau define **capacidades**, e cada capacidade
se materializa no módulo que faz sentido para aquele eixo:

| Capacidade do degrau | Vira, num negócio `no_local` | Vira, num negócio `vai_ate` |
|---|---|---|
| "Alcance em lote" | campanha para a base | campanha + **rota do dia** |
| "Cobrar melhor" | comanda e caixa | **orçamento com aprovação por link** |
| "Time" | agenda por cadeira + comissão | agenda por técnico + comissão |

**O que isto custa admitir:** a Fase D.3 está escrita com nomes de módulo de beleza. **Ela está
correta para o ICP (Fase B) e incompleta para o catálogo inteiro.** Preencher as outras colunas
exige saber quais módulos importam para faxina e elétrica — e isso é **[S]**, porque o produto
nunca foi usado por nenhum dos dois.

**Evidência dura, do banco de produção [M] (2026-08-24):** os **3 tenants reais** são
**todos** `onde=no_local`, `cobranca=fixo`, `ritmo=avulso`. Os 5 restantes são resíduo de teste,
com os eixos **nulos**. Ou seja: **o modelo de 4 eixos nunca foi exercitado fora da configuração
de beleza, nem uma vez.** Qualquer empacotamento para os outros eixos é desenho no papel.

---

## FASE E · Preço e psicologia de preço

### E.1 · Como chegar a um preço sem clientes

Não há base para teste A/B. Dois métodos que funcionam sem escala:

1. **Van Westendorp** nas primeiras 20 conversas de venda — 4 perguntas ("a partir de que preço
   ficaria caro demais? / barato a ponto de duvidar da qualidade? / caro mas ainda compraria? /
   é uma pechincha?"). Dá faixa aceitável com amostra pequena. **Vira tarefa da Fase P.**
2. **Ancoragem no substituto real.** O concorrente do CICLO na cabeça do barbeiro solo **não é o
   Trinks** — é *caderno + WhatsApp + memória*, que custa R$ 0. Toda a venda é contra isso.

### E.2 · A tabela recomendada e o raciocínio de cada número

| | Valor | Raciocínio |
|---|---|---|
| **Essencial** | **R$ 49** | 35% abaixo do Trinks 1–2 prof (R$ 76 **[M]**) e 45% abaixo do Avec (R$ 88,90 **[M]**), mas **23% acima do Simples Agenda** (R$ 39,90 **[M]**). Enquadra como "menos de R$ 1,70 por dia" **[E]**, ou **"o preço de um corte por mês"** — a âncora que importa, porque é a unidade de receita *dele* |
| **Equipe** | **R$ 99** | Alinha com a entrada do Belasis (R$ 99 **[M]**), abaixo do Trinks 3–4 prof + add-ons. Salto de 2,0× |
| **Avançado** | **R$ 179** | Salto de 1,8×. Nuvemshop usa ~2,4× entre degraus **[M]**; ficar um pouco abaixo é apropriado para produto novo |

**Efeito de centro:** o Equipe (R$ 99) é o alvo. O Avançado existe em boa medida para fazer o
Equipe parecer proporcional — o que é uso legítimo de ancoragem (§5.10: continua funcionando
mesmo sabendo como funciona).

#### E.2.1 · ⭐ O problema que a segunda rodada de pesquisa criou para este preço

A primeira versão justificou R$ 49 dizendo que ele fica "abaixo do Trinks e acima do piso de
brinquedo". **Essa justificativa não sobrevive ao Simples Agenda** (A.1): R$ 39,90/mês para 1
profissional, funcionalidades idênticas em todos os degraus, 35 dias de teste, 3.900 salões
**[M]**. Contra ele, R$ 49 é **o preço caro**, não o barato.

Três saídas, e a recomendação não é a óbvia:

| Saída | Consequência |
|---|---|
| **Igualar (R$ 39,90)** | Sobram **R$ 12,12** por cliente depois de imposto e suporte (F.7). Vira briga de preço com quem tem 3.900 clientes de escala e o CICLO tem zero. **Não recomendado** |
| **Manter R$ 49 e justificar pela diferença** | Exige que a venda seja sobre Motor de Ciclo, 17 profissões e "tudo incluso" — nunca sobre agenda, onde o CICLO é comparável e mais caro. **Recomendado** |
| **Subir para R$ 59** | +45% de margem (F.7), ainda abaixo de Trinks e Avec. Aposta que o valor diferenciado sustenta o prêmio. **Do Eduardo** |

**Recomendação: manter R$ 49, e mudar o que a venda diz.** Se a conversa for "agenda por
R$ 49 contra agenda por R$ 39,90", o CICLO perde e merece perder. Se for "o sistema que te avisa
quem sumiu e traz de volta", o Simples Agenda não está no mesmo mercado.

**Isto é um teste falsificável, não uma frase de efeito:** se nas 20 conversas da P.1-G o cliente
comparar preço com Simples Agenda/Trinks em vez de reagir ao Motor de Ciclo, **a diferenciação não
existe na cabeça dele** e o preço tem que cair. Vira a previsão 6 na Fase O.

#### E.2.2 · O teste grátis é curto demais para esta categoria

Mercado **[M]**: Simples Agenda **35 dias** · SPAgenda **30** · Produttivo **15** · Trinks **5**.
A Fase K propõe **14 dias**, o que coloca o CICLO no quartil de baixo — para um produto
**desconhecido**, que é exatamente quem menos pode pedir decisão rápida.

Além disso, o momento "aha" definido em I.1 é *o primeiro agendamento que chega sozinho*, e a
métrica-alvo do §13.2 é **< 7 dias** para isso. Um teste de 14 dias dá **uma** chance de o aha
acontecer; um de 30 dá margem para o ciclo de retorno do cliente dele (2–4 semanas) fechar pelo
menos uma volta — que é a única forma de o **Motor de Ciclo** demonstrar valor.

**Recomendação: teste de 30 dias, não 14** — o diferencial do produto precisa de um ciclo inteiro
para aparecer, e 14 dias mata a demonstração da única coisa que diferencia o CICLO.
— **Recomendado** (altera a Fase K)

### E.3 · Terminação de preço — a decisão brasileira

O prompt mandava avaliar. **Recomendação: R$ 49 / 99 / 179.**

`R$ 97 / R$ 197` é o padrão de **infoproduto** no Brasil e carrega esse cheiro. Para um público
que precisa confiar dado de cliente e faturamento ao software, isso **queima credibilidade** em
vez de aumentar conversão. `R$ 49/99` é gramática de SaaS, lida como profissional.

`R$ 50/100/180` (redondo) sinaliza premium/confiança e é defensável — mas com produto novo e sem
reputação, o ganho de percepção não compensa parecer 2% mais caro. **Do Eduardo**, se quiser
inverter.

### E.4 · Técnicas legítimas aplicadas

| Técnica | Onde | Por que passa no §5.10 |
|---|---|---|
| **Ancoragem / efeito de centro** | 3 degraus, meio como alvo | Funciona sabendo como funciona |
| **Enquadramento na unidade dele** | "o preço de um corte por mês" | É uma comparação verdadeira |
| **Preço por dia** | só no degrau de entrada | R$ 49/30 = R$ 1,63/dia **[E]** — aritmética honesta |
| **Aversão à perda no teste** | teste com recursos do Equipe | A dor da queda é real: ele *usou* de verdade |
| **Dotação / efeito IKEA** | onboarding pede configuração cedo | Motivo real para pedir config cedo, e já é meta do §13.2 |
| **Prova social** | *"usado por N profissionais"* | ⚠️ **Só quando N for verdade.** Hoje seria 3. **Proibido antes disso** |

### E.5 · Anual

**Recomendação: não lançar anual no primeiro trimestre.** — **Recomendado**

Anual melhora caixa e retenção, mas **trava o preço antes de você saber se ele está certo**. Com o
preço ainda sendo descoberto (E.1), vender anual é congelar um número provavelmente errado, para o
cliente mais valioso. Revisitar quando houver ~20 pagantes e o preço tiver parado de se mover.

---

## FASE F · Unit economics — com a conta na mesa

> ⚠️ **Esta fase foi reescrita na auditoria.** A primeira versão esquecia **duas linhas de custo
> obrigatórias** — contabilidade e imposto — e por isso todos os seus números eram otimistas. As
> conclusões qualitativas sobreviveram; as quantitativas não. O que mudou está em F.8.

### F.1 · Custo fixo mensal — incluindo o que a primeira versão esqueceu

| Item | Custo | Rótulo |
|---|---|---|
| Supabase (projeto `ciclo`, org Pro) | US$ 10/mês | **[M]** |
| Vercel Hobby | US$ 0 | **[M]** |
| Câmbio suposto | R$ 5,50/US$ | **[S]** |
| Subtotal de infraestrutura | **≈ R$ 55/mês** **[E]** = 10 × 5,50 | **[E]** |
| ⭐ **Contabilidade** (Contabilizei Básico) | **R$ 139/mês** | **[M]** |
| **Total obrigatório hoje** | **≈ R$ 194/mês** | **[E]** |
| Vercel Pro, **se** for a solução de cron (§4.2) | +US$ 20 = R$ 110 | **[E]** |
| **Total com cron pago** | **≈ R$ 304/mês** | **[E]** |

**Por que contabilidade virou linha obrigatória, e não opcional:** cobrar assinatura exige CNPJ
com nota fiscal, e **MEI está fora** — desenvolvimento e licenciamento de software (CNAEs 6201,
6202, 6203) **não constam na lista de ocupações do MEI**, e operar como MEI em atividade vedada
leva a cancelamento do CNPJ **[M]**. O caminho é **ME no Simples Nacional**, que exige
contabilidade. Ver Fase N.

Isso é uma correção com consequência: o custo fixo **triplica**, de R$ 55 para R$ 194 — e
existe **antes do primeiro cliente**.

### F.2 · Receita líquida por assinante — agora com imposto

Duas subtrações, não uma:

```
líquido = preço − taxa do PSP − imposto sobre a receita
        = preço − (preço × 0,99%) − (preço × alíquota do Simples)
```
Taxa do PSP: **Pix Mercado Pago, 0,99% sem piso fixo** **[M]**.

**A alíquota depende do Fator R, e essa é a variável que mais mexe no número:**

| Cenário | Alíquota | Condição |
|---|---|---|
| **Anexo III** | **6%** | Fator R ≥ 28% (folha ÷ receita dos últimos 12 meses) **[M]** |
| **Anexo V** | **15,5%** | Fator R < 28% **[M]** |

**Leitura contraintuitiva, e é a favor do CICLO:** com receita pequena, o Fator R é **fácil** de
atingir — um pró-labore de um salário mínimo contra uma receita de R$ 4 mil/mês já dá ~40%. O
Fator R só vira problema quando a receita cresce sem folha crescer junto. **Portanto o cenário
base é o Anexo III (6%)**, e o Anexo V entra como sensibilidade. — **Do Eduardo / contador**,
porque pró-labore tem INSS e IRRF que este documento não modela.

**Cenário base (Anexo III, 6%):**

| Plano | Bruto | PSP 0,99% | Simples 6% | **Líquido** |
|---|---|---|---|---|
| Essencial | R$ 49,00 | R$ 0,49 | R$ 2,94 | **R$ 45,57** |
| Equipe | R$ 99,00 | R$ 0,98 | R$ 5,94 | **R$ 92,08** |
| Avançado | R$ 179,00 | R$ 1,77 | R$ 10,74 | **R$ 166,49** |

**Sensibilidade (Anexo V, 15,5%):** Essencial cai para **R$ 40,91** — **10% a menos**.
```
49 − 0,49 − 7,60 = 40,91
```
**[E]**

Mesma conta do PSP com **Asaas** (Pix R$ 1,99 fixo **[M]**): Essencial líquido **R$ 44,07** —
taxa efetiva de PSP de **4,06%** contra **0,99%**. É a Fase J em uma linha.

### F.3 · Ponto de equilíbrio de infraestrutura *e estrutura*

```
Só infraestrutura (R$ 55):        55 ÷ 45,57 = 1,21  →   2 assinantes Essencial
Infra + contabilidade (R$ 194):  194 ÷ 45,57 = 4,26  →   5 assinantes Essencial
+ Vercel Pro para cron (R$ 304): 304 ÷ 45,57 = 6,67  →   7 assinantes Essencial
```
**[E]**

⭐ **A terceira linha não deve acontecer.** A Fase L.5 escolhe **cron externo a custo zero** em
vez do Vercel Pro, justamente porque R$ 110/mês para agendar seis chamadas HTTP equivale a
**2,4 assinantes Essencial trabalhando só para pagar o agendador**. **O número que vale é 5.**

**Leitura, corrigida:** a primeira versão dizia "2 a 4 assinantes" e concluía que infraestrutura
não é o problema. **A conclusão sobrevive, o número não** — são **5 a 7**, não 2 a 4. Continua
sendo pouco. O que decide o destino do negócio é F.4.

### F.4 · O custo que realmente importa: suporte

**[E]**, com premissa **[S]** de 30 min/mês por cliente pagante e custo de oportunidade de
R$ 50/h:

```
Custo de suporte por cliente = 0,5 h × R$ 50 = R$ 25,00/mês
Margem no Essencial = 45,57 − 25,00 = R$ 20,57  →  42% da receita bruta
Margem no Equipe    = 92,08 − 25,00 = R$ 67,08  →  68%
```

**Consequência estratégica — mais dura do que na primeira versão:**

1. **Autoatendimento não é luxo, é sobrevivência** no degrau de entrada;
2. O degrau Equipe é onde o negócio ganha dinheiro — o que reforça o efeito de centro da Fase E;
3. Se o suporte médio for **1 h/mês** em vez de 30 min, o Essencial fica em
   **R$ 45,57 − 50,00 = −R$ 4,43** — **prejuízo por cliente** **[E]**. A primeira versão calculava
   −R$ 1,49; com imposto, o buraco é **3× maior**. Vira previsão verificável na Fase O.
4. **No cenário Anexo V com 1 h de suporte, o prejuízo é de R$ 9,09 por cliente por mês** — ou
   seja, *cada venda nova piora o resultado*. É o pior cenário do documento e ele não é absurdo.

### F.5 · Quantos assinantes o projeto precisa

**[S]** para "o projeto se paga" = **R$ 3.000/mês no bolso** (renda complementar relevante),
**depois** de PSP, imposto, suporte **e custo fixo**:

```
ARPU líquido de suporte, mix 70/25/5 (Essencial/Equipe/Avançado):
  0,70 × 20,57 + 0,25 × 67,08 + 0,05 × 141,49
  =   14,40    +    16,77     +     7,07      = R$ 38,24

Cobrindo também o custo fixo de R$ 194:
  (3.000 + 194) ÷ 38,24 = 83,5  →  84 clientes pagantes
```
**[E]**

Para referência, os extremos:
```
Só Essencial:  (3.000 + 194) ÷ 20,57 = 155 clientes
Só Equipe:     (3.000 + 194) ÷ 67,08 =  48 clientes
```

**84 clientes pagantes** é a ordem de grandeza da meta — contra os **71** que a primeira versão
calculava. A diferença de 13 clientes é o preço de ter lembrado do imposto e do contador.

⚠️ **O alvo de R$ 3.000 é [S] escolhido por mim, não pelo Eduardo** — e ele é quem define o que
significa "se pagar". Trocar o alvo troca tudo nesta seção. — **Do Eduardo**

### F.6 · O custo do plano grátis

Cada tenant grátis consome banco e banda, mas o custo marginal no Supabase é próximo de zero até
volume alto **[S]**. O grátis é **investimento em distribuição** (Fase G), não desperdício —
desde que o teto de clientes evite que um tenant grátis vire o mais pesado da base.

**O custo real do grátis não é servidor, é suporte.** Um usuário grátis que abre chamado consome
o mesmo R$ 25 de um pagante e devolve R$ 0. **Recomendação: suporte do plano grátis é
assíncrono e por base de conhecimento, nunca por WhatsApp direto** — não por mesquinhez, mas
porque é a única forma de o grátis não matar a margem do pago. — **Recomendado**

### F.7 · Sensibilidade a ±20% no preço de entrada

| Preço | Líquido (Anexo III) | Margem após suporte **[E]** | Leitura |
|---|---|---|---|
| R$ 39 | R$ 36,27 | **R$ 11,27** | Margem fina demais; suporte come 69% |
| **R$ 39,90** *(paridade com o Simples Agenda)* | R$ 37,12 | **R$ 12,12** | Empata com o concorrente e **quase não sobra** |
| **R$ 49** | R$ 45,57 | **R$ 20,57** | Recomendado |
| R$ 59 | R$ 54,88 | **R$ 29,88** | **+45% de margem**, ainda 22% abaixo do Trinks |

⚠️ **Isto enfraquece minha própria recomendação e ficou mais forte com o imposto:** R$ 59 tem
margem **45% maior** que R$ 49 e continua abaixo do Trinks e do Avec. E a paridade com o Simples
Agenda (R$ 39,90) deixa **R$ 12 por cliente** — que não paga suporte humano nenhum.

**Consequência honesta: brigar por preço com o Simples Agenda é uma briga que o CICLO não pode
vencer com esta estrutura de custo.** A saída não é ser mais barato, é ser diferente (Motor de
Ciclo, 17 profissões, tudo incluso). Se a escolha for margem em vez de conversão, **R$ 59 é a
escolha melhor.** — **Do Eduardo**

### F.8 · O que esta reescrita mudou

| Número | Primeira versão | Corrigido | Por quê |
|---|---|---|---|
| Custo fixo mensal | R$ 55 | **R$ 194** | Faltava contabilidade (obrigatória, MEI vedado) |
| Líquido do Essencial | R$ 48,51 | **R$ 45,57** | Faltava o Simples Nacional |
| Equilíbrio de infra | 2 assinantes | **5 assinantes** | Custo fixo real |
| Meta de R$ 3.000 | 71 clientes | **84 clientes** | Imposto + custo fixo |
| Prejuízo com 1h de suporte | −R$ 1,49 | **−R$ 4,43** | Imposto |

**Nenhuma conclusão estratégica virou ao contrário** — infraestrutura continua barata, suporte
continua sendo o que decide, o Equipe continua sendo onde há dinheiro. Mas **todo número que
alguém fosse usar para decidir estava errado para menos**, e essa é exatamente a falha que o §2.3
do prompt existe para impedir.

---

## FASE G · Laços de crescimento

Anúncio pago está fora de escopo (§13.1: o CAC não fecha nesta categoria). O que resta são laços
que se alimentam do uso.

| Laço | O que alimenta | Tempo de volta **[S]** | Como medir | Custo de construir | Já existe? |
|---|---|---|---|---|---|
| **Selo na página pública** | cada agendamento é uma impressão | 1–3 meses | origem do cadastro | R$ 0 | ✅ **existe, incondicional** |
| **O link como produto** | status do WhatsApp, bio, grupo de bairro | dias | cliques no link público | Baixo (falta encurtador/UTM) | Parcial |
| **Indicação** | um pagante traz outro | 1–2 meses | código de indicação | **Médio** (Fase H) | ❌ mecanismo novo |
| **SEO das páginas `/{slug}`** | página por profissional × cidade | **6–12 meses** | tráfego orgânico | Baixo | Parcial (existe `sitemap.xml`) |
| **WhatsApp transacional** | todo lembrete carrega a marca | 1–3 meses | — | **Bloqueado** (TICKET-043) | ❌ |
| **Parceria de canal** | distribuidora, associação, escola técnica | 1–3 meses | cupom por parceiro | Baixo (é conversa, não código) | ❌ |

### G.1 · O que priorizar, e o que é armadilha

**Priorizar: parceria de canal.** É o único que dá volume cedo **sem depender de escala prévia** —
uma distribuidora de produtos de beleza ou uma escola de barbeiro fala com dezenas de profissionais
de uma vez. Custo de engenharia: quase zero. É trabalho de conversa, não de código.

**Armadilha: SEO das páginas públicas.** Parece de graça e não é. Com 3 tenants, são 3 páginas
finas e quase idênticas — o padrão que buscadores penalizam. **Só passa a fazer sentido com
algumas dezenas de páginas com conteúdo real.** Registrar como laço de médio prazo, não trabalhar
nele agora.

**A decisão do selo — a tensão explícita:** removê-lo é benefício do plano pago (Fase D.3), o que
significa que **todo cliente que converte remove uma peça de distribuição**. É um laço que se
autolimita conforme o negócio dá certo. A alternativa (selo em todos, inclusive pagos) preserva o
laço e tira um motivo de compra. **Recomendo manter como benefício pago** — com produto novo,
receita vale mais que alcance —, mas a decisão é **Do Eduardo** e é reversível.

---

## FASE H · Indicação

O §13.1 já decidiu **um mês para quem indica e para quem entra**. O desenho:

### H.1 · Quando a recompensa vira real

**No primeiro pagamento do indicado, não no cadastro.** — **Decidido** (é a única variante que
não é convite para fraude)

### H.2 · Forma da recompensa

**Crédito em centavos numa conta do tenant** (`billing_credits`), não "um mês grátis".
— **Recomendado**

Motivo: crédito funciona com proração, com troca de degrau e com mês parcial; "um mês grátis" quebra
nos três casos. Fiscalmente também é mais limpo — é desconto sobre a próxima fatura, não serviço
prestado sem contrapartida.

### H.3 · Antifraude

| Ataque | Defesa |
|---|---|
| Autoindicação | mesmo CPF/CNPJ, mesmo `phone_hash`, mesmo instrumento de pagamento no PSP |
| Conta falsa em série | recompensa só no 1º pagamento (H.1) — fraudar custa dinheiro de verdade |
| Fazenda de indicação | teto de **12 meses de crédito por indicador por ano** **[S]** |
| Empilhar com teste grátis | crédito só começa a consumir **depois** do teste |

### H.4 · O convite é ferramenta dele, não anúncio nosso

O convite deve sair com a cara do profissional ("o Diego te indicou o CICLO"), não da marca. Em
categoria de autônomo, a recomendação de um colega de ofício vale ordens de grandeza mais que
qualquer peça. Isso é **reciprocidade e identidade**, e é honesto — a indicação é real.

---

## FASE I · Ativação e retenção

Vender é metade. A outra é ele não largar em duas semanas.

### I.1 · O momento "aha" — hipótese explícita

**O primeiro agendamento que chega sozinho pela página pública, sem ele digitar nada.** **[S]**

É a diferença entre "mais um sistema para eu alimentar" e "isso trabalha para mim". Tudo no
onboarding deveria correr para esse momento — e a métrica "tempo até o 1º agendamento real"
(§13.2, alvo < 7 dias) já é exatamente isso, sem ninguém ter nomeado.

### I.2 · Hábito recorrente

**Candidato: o Motor de Ciclo.** "3 clientes sumiram, R$ 240 parados" é motivo semanal de abrir o
app. Uma agenda só se abre quando há agendamento; um alerta de dinheiro parado se abre sozinho.

**Requisito honesto:** isso depende de **notificação**, que depende de **cron**, que hoje não
existe (§4.2). O laço de retenção mais forte do produto está bloqueado pela mesma coisa que
bloqueia a cobrança recorrente. Isso **eleva a prioridade de resolver o cron** — não é detalhe de
billing, é o motor de retenção.

### I.3 · Sinais de churn

Queda de agendamentos criados/semana · sem login há 14 dias · página pública sem visita há 30
dias. Todos calculáveis com timestamps que **já existem** **[M]** — não exigem instrumentação nova.

### I.4 · Quem cai não é perdido

A regra 5.1 (nunca prender dado) tem consequência comercial boa: quem cancela **vira grátis com a
base intacta**. Reativar é muito mais barato que adquirir. O e-mail de "seus 46 clientes estão
aqui esperando" é honesto e eficaz.

---

## FASE J · PSP

### J.1 · Comparação

| Critério | **Asaas** **[M]** | **Mercado Pago** **[M]** |
|---|---|---|
| **Pix** | **R$ 1,99 fixo** (R$ 0,99 promo 3 meses) | **0,99%, sem piso fixo** |
| Cartão à vista | 2,99% + R$ 0,49 | 3,03%–4,98% (varia com prazo de repasse) |
| Boleto | R$ 1,99 → R$ 3,49 | ~R$ 3,49 |
| Assinatura recorrente nativa | Sim | **Sim** (Planos de Assinatura/preapproval), com **retentativa automática** |
| Meios na recorrência | cartão, boleto, Pix | **cartão, Pix e boleto** |
| Mensalidade da conta | **R$ 0** | R$ 0 |
| Extras | NF-e R$ 0,49 · WhatsApp R$ 0,55 · antecipação | ecossistema de maquininha/carteira |

### J.2 · A conta que decide — no ticket do CICLO

```
Essencial R$ 49
  Mercado Pago Pix: 49 × 0,99%      = R$ 0,49   (1,00% efetivo)
  Asaas Pix:        R$ 1,99 fixo    = R$ 1,99   (4,06% efetivo)
  Diferença: R$ 1,50/cliente/mês = R$ 18/ano por cliente
  Em 84 clientes (F.5): R$ 1.512/ano
```
**[E]**

**O piso fixo do Asaas é desenhado para boleto de R$ 300, não para assinatura de R$ 49.** No
ticket baixo ele é caro; no ticket alto ele vira barato (numa mensalidade de R$ 500, R$ 1,99 é
0,4% contra 4,95 do MP).

### J.3 · Recomendação

**Mercado Pago** — **Recomendado**, com três motivos e uma ressalva honesta:

1. Pix percentual sem piso é decisivo no ticket de R$ 49 (J.2);
2. Recorrência nativa aceitando **Pix**, o que importa muito num público em que **nem todo mundo
   tem cartão de crédito** **[S]**;
3. Reconhecimento de marca — "pagar pelo Mercado Pago" reduz atrito de confiança para quem nunca
   ouviu falar do CICLO.

**O que se perde indo de Asaas:** conta digital PJ integrada, notificação por WhatsApp nativa
(R$ 0,55) e antecipação de recebível — coisas que os tickets 031/032/033 assumiam. Se algum dia o
CICLO quiser ser o meio de pagamento *do salão* (receber pela cliente final), **o Asaas volta a
ser o candidato mais forte**, e o `payments.psp` sendo `text` **[M]** permite os dois convivendo.

**Nota:** taxa de cartão do MP varia com prazo de repasse; a de 4,98% é a de recebimento
imediato. Para assinatura, receber em 14/30 dias é aceitável e baixa a taxa. **Confirmar no
simulador da conta real antes de fechar** — é o tipo de número que muda por perfil.

**Um ponto a favor do Asaas que a honestidade obriga a registrar:** o **Avec**, com 40 mil
estabelecimentos declarados, **roda a cobrança em cima do Asaas** — a própria página de planos
cita "taxas transacionais com o Asaas" **[M]**. Não é argumento de preço (a conta da J.2 continua
valendo), mas é prova de que o Asaas aguenta esta categoria em escala. A recomendação pelo MP
segue de pé; ela é sobre o **ticket de R$ 49**, não sobre qualidade da plataforma.

### J.4 · ⭐ Pix Automático — a nota do Brasil, e ela mudou desde o prompt

O §J do prompt advertia: *"Pix não é naturalmente recorrente"*. **Isso deixou de ser verdade.**

O **Pix Automático** — recorrência nativa do Bacen, com autorização única do pagador e débitos
subsequentes automáticos — teve o **prazo de adequação das instituições encerrado em
1º de janeiro de 2026**, e passou a estar disponível em **todo participante do ecossistema Pix**
**[M]**. Fontes: [Mercado Pago — Pix Automático e receita recorrente](https://www.mercadopago.com.br/blog/pix-automatico-gestao-assinaturas-receita-recorrente) ·
[Asaas — Pix automático 2026](https://blog.asaas.com/pix-automatico/) ·
[PagBrasil — dados do 1º tri de 2026](https://www.pagbrasil.com/pt-br/blog/pagamento-recorrente/pix-automatico-2026/) —
consultados em **2026-08-23**.

**Por que isto é o achado mais favorável do documento inteiro para o CICLO:**

1. **Remove a única objeção estrutural ao Pix como meio de assinatura.** A escolha deixa de ser
   "cartão porque recorre" e passa a ser "Pix porque recorre **e** custa 0,99% sem piso" (F.2).
2. **Ataca o problema real do público.** A Fase J.3 supunha **[S]** que nem todo autônomo tem
   cartão de crédito. Com Pix Automático, isso deixa de ser barreira de conversão — qualquer
   conta bancária serve.
3. **Já há adoção medida:** o Pix Automático cresceu **182%** em transações no início de 2026, e
   numa empresa analisada respondeu por **25% das novas assinaturas** entre agosto/2025 e
   março/2026 **[M]**. Não é promessa de roadmap.

**Recomendação: Pix Automático é o meio de cobrança primário; cartão é a alternativa, não o
padrão.** — **Recomendado**

**O que fica de ressalva, e é grande:** o Pix Automático é **novo**, e retentativa, tratamento de
saldo insuficiente e cancelamento pelo pagador têm comportamento que este documento **não testou**
— e não pode testar, porque a regra 5.5 proíbe criar produto e disparar cobrança no PSP sem
autorização explícita. **Bloqueado**: confirmar no sandbox do Mercado Pago, na conta real, antes
de escrever a Fase K em código.

**Débito automático tradicional** (convênio direto com banco) fica **descartado**: exige
negociação banco a banco, tem prazo de implantação longo e o Pix Automático resolve o mesmo
problema sem intermediário. — **Decidido**

---

## FASE K · Ciclo de vida da assinatura

| Transição | Regra recomendada |
|---|---|
| **Teste grátis** | ⭐ **30 dias** com recursos do **Equipe**, **sem cartão**. *Corrigido de 14 para 30 em E.2.2:* o mercado dá 30–35 dias (Simples Agenda 35, SPAgenda 30 **[M]**), e o Motor de Ciclo precisa de um ciclo de retorno inteiro (2–4 semanas) para demonstrar valor. Sem cartão converte menos e gera muito menos raiva — e raiva, nesta categoria, vira review pública |
| **Assinar** | Pix recorrente ou cartão, via MP |
| **Subir de degrau** | Imediato, **com proração** (crédito do não usado) |
| **Descer** | **No fim do ciclo**, não na hora — ele pagou o mês. Se estiver acima do limite novo: **nada é apagado** (regra 5.1); fica em modo leitura na parte excedente, com o motivo na tela |
| **Inadimplência** | 3 retentativas (D+1, D+3, D+7) · **7 dias de carência com acesso normal** · depois **rebaixa para Grátis** · nunca apaga |
| **Cancelar** | Autoatendimento, mesmo número de cliques que assinar (§5.10). **Arrependimento em 7 dias com reembolso integral** (CDC) |
| **Reativar** | Um clique, base intacta |
| **Aumento de preço** | Aviso com **30 dias**; quem já é cliente **fica congelado por 12 meses**. Isso é retenção e é decência |

**Os tenants existentes** (`dom-rocha`, `ruivo-barber`, `lang-barber` **[M]**):
`dom-rocha` é demo do produto → **Avançado vitalício de cortesia**. Os outros dois → Grátis, com
oferta de fundador se quiserem pagar. — **Recomendado**

⚠️ **Achado que testa o próprio desenho:** `dom-rocha` tem **3 profissionais e 46 clientes**
**[M]**. Sob os limites propostos em D.3 (Grátis = 1 profissional, 50 clientes), **o tenant de
demonstração do produto seria bloqueado pelo próprio plano grátis** — e ele está a 4 clientes do
teto. Isso é sinal, não coincidência: **se o único negócio realista da base já não cabe no
grátis, o grátis provavelmente está apertado demais** para sustentar o laço de distribuição que o
§13.1 diz ser a razão de ele existir. Reforça que o "50 clientes" é **[S]** (D.3) e sugere que o
limite de profissionais do grátis mereça ser **2, não 1**. — **Recomendado revisar**

**Higiene achada nesta análise:** há **5 tenants de teste** órfãos no banco de produção
(`health-*`, `alertas-estoque-*`, `recuperar-*`, `clientes-*`, `risco-*` **[M]**). Não afeta
cobrança, mas **suja qualquer métrica de "quantos tenants existem"**.

⚠️ **Diagnóstico corrigido na execução:** a primeira versão desta linha dizia "resíduo de suítes
que falharam antes do `afterAll` limpar". **Errado, e otimista.** O `.env.local` aponta para o
Supabase de produção **[M]**, então a suíte de integração **cria esses tenants na base real toda
vez que roda** — não é falha de limpeza, é o alvo estar errado. Ver **P.1.1**, que reescreve o
item P-B por causa disso.

---

## FASE L · Enforcement técnico

### L.1 · Princípios

- **Sempre no servidor.** Esconder botão não é limite.
- **Um lugar só** responde "este tenant pode X?". Espalhar por 30 rotas é como a regra some.
- Limite **duro** (recusa): criar profissional acima do teto, enviar em lote no grátis.
  Limite **suave** (avisa e deixa passar): chegar perto do teto de clientes — **nunca** travar
  cadastro de cliente no meio do atendimento.

### L.2 · Onde mora a verdade

Duas tabelas já existem e precisam de hierarquia clara, senão viram duas fontes brigando:

```
tenants.plan     → o que o plano LIBERA         (teto)
tenant_modules   → o que o dono LIGOU           (escolha, dentro do teto)
```

Regra: **o plano é o teto; a escolha do dono só desliga, nunca liga além do teto.** A coluna
`tenant_modules.origem` (`'plano'` | `'dono'`) **[M]** já existe exatamente para a tela poder dizer
*"bloqueado pelo plano"* × *"você desligou"* — que é a regra 5.2 virando dado.

#### L.2.1 · ✅ Implementado em 2026-08-24 — e a lacuna que isso abriu

`tenant_modules` existia desde a migration 0025 **sem nenhum escritor**. Agora tem: a tela
`/admin/config/modulos` e a rota `PATCH /api/v1/tenant/modules`, com a regra desta seção aplicada
ao pé da letra — o plano é teto, o dono só desliga, e ligar além do teto é recusado no servidor.

⚠️ **A lacuna, nomeada em vez de escondida:** a tela agora **afirma** coisas que as rotas ainda
não impõem. Ela diz *"Campanhas faz parte do Essencial"* — e `POST /api/v1/campaigns` continua
respondendo normalmente para um tenant no Grátis. O mesmo vale para estoque, orçamento, cofre e
comissão: `exigirModulo` **existe, mas não é chamado por rota nenhuma** — quem está ligado, e só
no envio em lote, é `exigirCapacidade`. (Correção: uma versão anterior desta linha dizia que
`exigirModulo` estava testado. Não estava — tinha zero usos, inclusive em teste. Cobertura
adicionada em 2026-08-24, justamente para o passo 3 abaixo ser rápido e seguro quando destravar.)

**Por que não liguei em todas de uma vez**, e é o tipo de decisão que precisa estar escrita:
os 3 tenants reais estão **todos em `gratis`** **[M]**, e as migrations 0040/0041 **não foram
aplicadas em produção**. Ligar `exigirModulo` nas rotas hoje tiraria comanda, caixa e orçamento
do `dom-rocha` — que é a demonstração do produto — no primeiro deploy. Seria enforcement correto
em cima de dado errado.

**A ordem certa, e ela não é negociável:**

| # | O quê | Por quê |
|---|---|---|
| 1 | Aplicar 0040 e 0041 em produção | O enum e a FK precisam existir antes de qualquer coisa depender deles |
| 2 | **Atribuir plano aos 3 tenants reais** — `dom-rocha` → Avançado de cortesia (Fase K) | Sem isso, enforcement rebaixa a demonstração |
| 3 | Só então ligar `exigirModulo` nas rotas de campanha, estoque, orçamento, cofre e comissão | Enforcement em cima de dado certo |

Inverter 2 e 3 é o erro clássico desta área: enforcement correto que quebra usuário existente
porque os dados ainda não refletem o modelo novo. — **Bloqueado** no passo 1, que é deploy.

### L.3 · As `FEATURE_*` globais

As 4 flags no Vercel **não são lidas por nenhuma linha** e, sendo globais, **não conseguem por
natureza ligar coisa por tenant** **[M]**. **Recomendação: aposentar as 4** e deixar
`tenant_modules` ser a única resposta. Manter variável de ambiente que promete controle de
funcionalidade e não entrega é dívida que engana quem chega depois.

✅ **Feito em 2026-08-24:** removidas do `.env.example`, com o motivo escrito no lugar delas.
**Pendência que não é de código:** as quatro continuam definidas no **Vercel de produção** —
apagá-las é ação no painel, e sem uso elas não fazem nada além de sujar a configuração.
— **Do Eduardo**

### L.4 · Namespace (regra 5.6)

O que é "CICLO cobra do tenant" usa prefixo **`billing_`** — `billing_subscriptions`,
`billing_credits`, `billing_invoices`. **Nunca** reusar `subscription_plans`/`client_subscriptions`,
que já significam "salão cobra da cliente" **[M]**. — **Decidido**

### L.5 · ⭐ A decisão do cron — a §4.2 do prompt, que a primeira versão só mencionou

O prompt manda **escolher e justificar**, não descrever. A primeira versão citou o problema em
I.2 e P.2 e nunca escolheu. Escolhendo, e o achado que força a mão:

**O estado real é pior do que "não existe cron" [M]:** existem **6 rotas de cron já construídas e
protegidas por `CRON_SECRET`** —
`/api/cron/reminders`, `/api/cron/recompute-cycles`, `/api/cron/campaigns`, `/api/cron/jobs`,
`/api/cron/segments`, `/api/cron/stock-alerts` — e o `vercel.json` está com **`{"crons": []}`**.
Não é uma lacuna a construir: são **seis jobs prontos que nunca rodaram em produção**.

Entre eles estão **`reminders`** (lembrete e confirmação) e **`recompute-cycles`** (o Motor de
Ciclo). Ou seja: **as duas funcionalidades que este documento chama de diferencial do produto e
de motor de retenção estão desligadas no ar.** Isso não é dívida de billing — é o produto não
estar funcionando.

**As três opções, com a conta:**

| Opção | Custo | Frequência possível | Veredito |
|---|---|---|---|
| **Vercel Pro** | **US$ 20/mês ≈ R$ 110** **[E]** | qualquer, por minuto **[M]** | Resolve, e custa **2,4 assinantes Essencial só para existir** (F.2) |
| **Vercel Hobby** (atual) | R$ 0 | **1× por dia, e só** — expressão mais frequente **falha no deploy** **[M]** | Serve para `recompute-cycles`; **não serve** para `reminders` nem `jobs` |
| ⭐ **Cron externo grátis** batendo nas rotas que já existem | **R$ 0** | qualquer | **Recomendado** |

*(Limites do Vercel consultados em 2026-08-23: desde janeiro/2026 são 100 jobs por projeto em
todos os planos, mas o Hobby continua travado em **uma execução por dia**; a diferença que importa
é frequência, não quantidade. Fonte: [vercel.com/docs/limits](https://vercel.com/docs/limits) ·
[changelog](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan).)*

**Recomendação: cron externo, com GitHub Actions `schedule` como primeira escolha.**
— **Recomendado**

Três motivos concretos:
1. **Custo zero**, e num negócio cujo custo fixo acabou de triplicar (F.1), R$ 110/mês para
   agendar seis `curl` é a pior compra disponível;
2. **Não exige nada novo do produto** — as rotas existem, o `CRON_SECRET` existe e a comparação
   já é em tempo seguro **[M]**. É configuração, não engenharia;
3. **O repositório já roda GitHub Actions** (`.github/workflows/ci.yml`, CI desde 2026-08-24
   **[M]**) — o segredo tem onde morar e o mecanismo já é conhecido por quem mantém.

**O que se perde, dito honestamente:** o `schedule` do GitHub Actions **não é pontual** — atrasa
em horário de pico e pode pular execução. Para lembrete de agendamento, atraso de 10–15 minutos é
tolerável; para cobrança, também. **Se algum dia houver um job que não pode atrasar, aí sim o
Vercel Pro se justifica** — e aí ele já estará pago por dezenas de assinantes.

**Alternativa se o GitHub Actions incomodar:** cron-job.org ou similar, mesmo custo zero, mesma
imprecisão, uma dependência externa a mais.

**Consequência de sequenciamento — e ela contraria a P.2:** resolver o cron **não deve esperar
por 10 pagantes.** Ele não é infraestrutura de cobrança, é **o produto funcionando**. Enquanto
`recompute-cycles` não rodar, o Motor de Ciclo não existe, e o CICLO está vendendo uma agenda
comum contra concorrentes mais baratos e mais maduros (E.2.1). **Isto sobe para a Fase P.1.**

### L.6 · Uma armadilha de schema achada nesta auditoria

`tenant_modules.modulo` é **`text` sem `check` nem tabela de referência** **[M]** — só `origem`
tem restrição. Não há nenhuma lista canônica dos 16 módulos no banco.

Consequência: um erro de digitação (`'fidelidade'` × `'fidelidades'`) cria silenciosamente um
módulo fantasma que nunca liga nada, e **nenhuma query acusa**. Como é exatamente essa coluna que
vai decidir o que cada plano libera (L.2), **o custo do erro sai barato hoje e caro depois de
existir cliente pagante** — o mesmo argumento do enum em D.4.

**Recomendação: uma tabela `modules` de referência (chave, rótulo, eixo que o condiciona) com FK,
antes de qualquer tela ler `tenant_modules`.** Baratíssimo agora. — **Recomendado**

---

## FASE M · Telas e os momentos que decidem

| Tela | O que decide |
|---|---|
| **Preço público** | Preço **visível sem cadastro** — vários concorrentes escondem (Fase A). Transparência é diferencial barato |
| **Meu plano** | Degrau, uso contra limite, próxima cobrança, cancelar (mesmos cliques que assinar) |
| **Bloqueio** | ⬇️ ver abaixo |
| **Assinar** | Menos passos possível; Pix primeiro |
| **Indicação** | Link com a cara dele, quanto já ganhou |
| **Inadimplência** | Tom de "seu pagamento não passou, sua base está aqui", não de cobrança agressiva |

**Restrições que valem para as seis telas, e não são negociáveis** (§M do prompt e o
`03-DESIGN-SYSTEM.md` existente): tudo em **pt-BR**, **mobile-first a 390px**, **alvo de toque
≥ 48px**, dentro do design system atual — sem componente novo inventado para a tela de preço.
Este público decide no celular, em pé, entre um atendimento e outro.

**Preço público sem cadastro é decisão de produto, não de marketing** — **Decidido**. Quatro dos
treze concorrentes pesquisados escondem os degraus de cima **[M]** (Trinks e Avec acima de 2–5
profissionais, Auvo e Produttivo por inteiro). Transparência aqui custa uma página HTML e compra
confiança de um público que trata "fale com um consultor" como sinal de que vai ser caro.

### M.1 · A tela de bloqueio é a peça de conversão mais importante do produto

Mais que a página de preço — porque aparece **no momento em que a pessoa já quer fazer alguma
coisa**. A regra 5.2 exige motivo + caminho; o que converte é mostrar **o valor concreto do outro
lado, com o dado dele**:

> ❌ *"Faça upgrade para enviar campanhas."*
>
> ✅ *"**23 clientes seus** estão atrasados, somando **R$ 1.840**. No Essencial você manda para
> todos de uma vez. Ou mande um a um agora, de graça."*

A segunda converte mais **e é mais honesta** — inclusive por oferecer o caminho gratuito. É a
aplicação correta do desenho da Fase D.2.

---

## FASE N · Legal, fiscal e ético

| Item | Situação | Classif. |
|---|---|---|
| CNPJ para receber | Necessário para PJ no PSP | **Bloqueado** — só o Eduardo |
| **Regime tributário** | ⭐ **MEI está vedado** — ver N.0. O caminho é **ME no Simples Nacional** | **Bloqueado** (contador) |
| **Contabilidade** | Obrigatória como consequência do acima. **R$ 139–195/mês** **[M]** — entrou na Fase F | **Bloqueado** (contador) |
| Nota fiscal por assinatura | Obrigatória. Asaas emite a R$ 0,49 **[M]**; MP exige integração | **Do Eduardo** |
| Termos e política de assinatura | Não existem | **Bloqueado** (advogado) |
| Renovação automática | CDC exige clareza — avisar antes de cobrar | **Decidido** |
| Arrependimento 7 dias | CDC. Reembolso integral | **Decidido** |
| Dado de cartão | **O CICLO nunca toca em número de cartão** — tokenização no PSP | **Decidido** |

### N.0 · ⭐ MEI está fora, e isso tem preço

O §4.6 do prompt mandava **nomear** a consequência fiscal, não resolvê-la. Nomeando, com fonte:

**Desenvolvimento e licenciamento de software não constam na lista de ocupações permitidas ao
MEI** — os CNAEs da atividade (6201-5/01, 6202-3/00, 6203-1/00, 6204-0/00, 6209-1/00) estão
**todos fora** **[M]**. Operar como MEI em atividade vedada pode levar a **cancelamento do CNPJ,
impossibilidade de emitir nota e autuação** **[M]**. O caminho correto é **ME** (até R$ 360 mil/ano)
optante pelo **Simples Nacional**.

Fontes: [contabilizei — MEI para programador](https://www.contabilizei.com.br/contabilidade-online/mei-para-programador/) ·
[econtrol — desenvolvedor pode ser MEI?](https://econtrolcontabilidade.com.br/desenvolvedor-de-software-pode-ser-mei-entenda-o-que-diz-a-legislacao-e-quais-alternativas-existem/) —
consultados em **2026-08-23**.

**Duas consequências que mudam o plano, não só o rodapé:**

1. **Custo fixo antes do 1º cliente.** Contabilidade a partir de R$ 139/mês **[M]**. Isso entrou
   na Fase F e mexeu em todos os números dela (F.8).
2. **Alíquota depende do Fator R.** Anexo III (**6%**) se folha ÷ receita dos últimos 12 meses
   ≥ 28%; Anexo V (**15,5%**) se abaixo **[M]**. Com receita baixa o Fator R é fácil de bater
   (F.2) — mas isso envolve pró-labore, INSS e IRRF que **este documento não modela e não deve
   modelar**. — **Do Eduardo / contador**

Fonte: [contabilizei — Anexo III](https://www.contabilizei.com.br/contabilidade-online/anexo-3-simples-nacional/) ·
[contabilizei — Fator R](https://www.contabilizei.com.br/contabilidade-online/fator-r-simples-nacional/) —
consultados em **2026-08-23**.

**O que dá para fazer sem destravar isso:** tudo da Fase P.1 exceto receber dinheiro. Página de
preço, limites, tela de bloqueio e as 20 conversas de venda **não dependem de CNPJ**. O CNPJ é
pré-requisito do primeiro R$ 49, não do primeiro "quanto custa?".

### N.1 · Conferência contra o §5.10

Cada mecanismo proposto passou pelo teste "continuaria funcionando se a pessoa soubesse como
funciona?":

| Mecanismo | Veredito |
|---|---|
| Ancoragem de 3 degraus | ✅ passa |
| "Preço de um corte por mês" | ✅ comparação verdadeira |
| Teste com recursos do Equipe | ✅ a perda é real, ele usou |
| Ver o dinheiro parado no grátis | ✅ o número é verdadeiro e o caminho grátis é oferecido |
| Prova social "N profissionais" | ⚠️ **só quando N for verdade** — hoje seria 3 |
| Cancelamento em autoatendimento | ✅ exigido |
| Rebaixar sem apagar | ✅ regra 5.1 |

**Nenhum mecanismo deste plano depende de escassez inventada, contador falso ou dificuldade de
cancelar.**

---

## FASE O · Métricas e previsões falsificáveis

### O.1 · O que dá para medir sem instrumentação nova **[M]**

Ativação · tempo até o link pronto · tempo até o 1º agendamento · retenção 30/90d · sinais de
churn (I.3) — tudo derivável de `tenants.created_at`, `appointments.created_at` e timestamps que
já existem.

✅ **Implementado em 2026-08-24:** `scripts/metricas-ativacao.mjs` — só leitura, sem instrumentação
nova, derivando tudo de `tenants.created_at`, `services`, `professionals` e `appointments`.
Descarta o resíduo de suíte de teste (§P.1.1) antes de contar, e **avisa em letra garrafal quando
os números são de base semeada** — que é exatamente o caso hoje: mediana de configuração de
0,01 min, porque tenant, serviço e profissional nascem na mesma transação do seed. Ler isso como
"o onboarding funciona" seria Suposto apresentado como Medido, o defeito mais grave do §2.4.

### O.2 · O que exige instrumentação nova

Onde abandona no onboarding passo a passo · % que compartilha o link · origem do cadastro
(atribuição do selo/indicação) · MRR, churn, conversão grátis→pago.

### O.3 · Previsões

| # | Previsão | Número | Prazo | Como verificar | Se falhar |
|---|---|---|---|---|---|
| 1 | Pagantes com Essencial a R$ 49 | entre **3 e 12** | 90 dias após começar a vender | contar assinaturas ativas | <3 → o problema é produto/ICP, não preço. **Parar de construir cobrança** |
| 2 | Conversão grátis→pago | entre **2% e 8%** | 6 meses | pagantes ÷ tenants ativos | <1% com >100 grátis → grátis generoso demais ou paywall no lugar errado |
| 3 | Concentração no ICP | **≥6 dos 10 primeiros** pagantes são beleza | 6 meses | `tenants.profession_id` | Se não-beleza dominar, o ICP da Fase B está errado — e a oportunidade da A.1 é maior que eu supus |
| 4 | Indicação como canal | **<20%** dos 20 primeiros | 6 meses | código de indicação | >20% → laço mais forte que o previsto, priorizar |
| 5 | **Suporte por cliente** | **>30 min/mês** no mês 1 | 60 dias | registro de tempo | >1h → **Essencial dá prejuízo** (F.4). Subir preço ou cortar escopo |

| 6 | ⭐ **A diferenciação existe na cabeça do cliente** | **≥ 12 das 20** conversas reagem ao Motor de Ciclo antes de perguntar preço | 20 conversas da P.1-G | anotar, em cada conversa, se a primeira objeção foi preço ou não | **<8/20 → o CICLO é uma agenda cara.** Ou o preço cai para a faixa do Simples Agenda (R$ 39,90) ou a proposta muda (E.2.1) |

A previsão **5 é a mais importante** e a menos óbvia: ela testa a única premissa que pode
inviabilizar o modelo inteiro. A **6** é a mais barata de rodar — não precisa de uma linha de
código, só de anotar o que já vai ser dito nas conversas de venda — e é a que decide se R$ 49 é
defensável (E.2.1).

---

## FASE P · Sequenciamento

### P.1 · Curto prazo (0–3 meses) — cobrar do cliente nº 1

**Objetivo: o primeiro R$ 49, com o mínimo de máquina.**

| # | O quê | Por quê | Custo |
|---|---|---|---|
| P-A | **Renomear o enum** (`pro→essencial`, `profissional→equipe`) | Custo zero agora **[M]**, migração de pagante depois | Trivial |
| P-B | ⚠️ **CORRIGIDO — ver P.1.1.** Limpar os 5 tenants de teste **não resolve nada sozinho** | Métrica suja desde o dia 1 | Trivial, e inútil isolado |
| P-C | **Página de preço pública**, sem cobrança | Vender exige poder mostrar preço | Baixo |
| P-D | **Cobrar à mão**: link de pagamento MP no WhatsApp + `update tenants.plan` | Nenhuma linha de billing para 1–10 clientes | ~Zero |
| P-E | **Um lugar só** que responde "pode X?" + 2 limites (profissionais, envio em lote) | O mínimo que faz o plano significar algo | Médio |
| P-F | **Tela de bloqueio** com o dado dele (M.1) | É a peça de conversão | Médio |
| P-G | **Van Westendorp** nas primeiras 20 conversas | Sai do **[S]** para **[M]** no preço | Zero (é conversa) |
| ⭐ **P-0** | **Ligar o cron externo** nas 6 rotas que já existem (L.5) | **Vem antes de tudo.** `reminders` e `recompute-cycles` estão desligados — o diferencial que sustenta o preço não está no ar | Baixo, **R$ 0/mês** |

#### P.1.1 · ⚠️ Correção do P-B, achada ao executar

O P-B foi escrito com o diagnóstico errado. A Fase K deste documento atribuiu os 5 tenants órfãos
a "resíduo de suítes de integração que falharam antes do `afterAll` limpar". **A causa é mais
estrutural: o `.env.local` do projeto aponta para o Supabase de produção** **[M]** — logo
`pnpm test:integration` e `pnpm test:rls` criam tenant e usuário de `auth` na base real, **toda
vez que rodam**.

Consequência prática: **apagar os 5 tenants é trabalho que se desfaz na próxima execução da
suíte.** O P-B, como escrito, é enxugar gelo.

**O que P-B tem que ser:**

| # | O quê | Por quê |
|---|---|---|
| P-B.1 | **Apontar o ambiente de teste para um Supabase separado** (projeto local via `supabase start`, ou um projeto de staging) | É a única coisa que faz a limpeza durar |
| P-B.2 | **Depois** disso, limpar os tenants órfãos de produção | Aí a métrica fica limpa e continua limpa |

**Isto muda o custo do item** — deixa de ser "trivial" e passa a ser mudança de infraestrutura de
teste, com um risco próprio: a organização Supabase gratuita tem teto de projetos, e outros
projetos da casa já disputam esse teto. — **Do Eduardo**, porque envolve conta e possivelmente
dinheiro.

**E muda a leitura da Fase O:** qualquer previsão que conte tenants (`previsão 2`, conversão
grátis→pago sobre "tenants ativos") está medindo uma base contaminada por fixture de teste
enquanto isso não for resolvido. Não invalida a previsão; invalida contá-la por `select count(*)
from tenants` sem filtro.

⭐ **P-0 é o primeiro item, não o oitavo.** A ordem da primeira versão colocava cron na fase
média, atrás de "≥10 pagantes". Isso está errado por um motivo simples: **não dá para vender o
Motor de Ciclo enquanto ele não roda.** Todo o argumento de preço da E.2.1 — o que justifica
cobrar 23% acima do Simples Agenda — depende de uma funcionalidade que hoje não executa.

**Não fazer nesta fase:** assinatura automática, proração, inadimplência, portal, indicação,
webhook, teste grátis automatizado.

### P.2 · Médio prazo (3–12 meses) — e o sinal que destrava cada item

| Item | **Sinal que destrava** |
|---|---|
| Assinatura recorrente automática (MP) | **≥10 pagantes** cobrados à mão — a dor de cobrar vira real |
| ~~Resolver o cron (§4.2)~~ | **Movido para P.1 como P-0** — ver L.5. Não depende de sinal nenhum; é o produto funcionando |
| Inadimplência e retentativa | 1º cliente que não pagar |
| Teste grátis automatizado | **≥20 pagantes** e conversão medida |
| Indicação (Fase H) | **≥20 pagantes** — laço precisa de densidade; antes disso é máquina sem combustível |
| 2º e 3º degraus | Alguém pedir mais de 1 profissional **e recusar por causa disso** |
| Anual | Preço parar de se mover (~20 pagantes) |
| Atacar o vazio de serviço de campo (A.1) | Modelo provado em beleza |
| SEO das páginas públicas | **≥30 tenants ativos** com conteúdo real |

### P.3 · Critérios de parada

| Aposta | Critério | Prazo |
|---|---|---|
| Cobrar por este produto agora | <3 pagantes com esforço real de venda | 90 dias |
| ICP beleza | ≥7 dos 10 primeiros vêm de outra profissão | 6 meses |
| Modelo de assinatura pura | suporte >1h/cliente/mês sustentado | 60 dias |
| Escada de 3 degraus | ninguém pedir o 2º degrau | 6 meses |

---

## RED TEAM

Escrito **contra** o resto do documento (§8 do prompt).

### R.1 · Pré-mortem — é agosto de 2027 e há menos de 10 pagantes

**Causa 1 (mais provável): nunca houve venda de verdade.** O plano foi executado como projeto de
engenharia — enum renomeado, tela de preço, limites, tela de bloqueio — e ninguém passou 20 horas
falando com barbeiro. O produto ficou pronto para cobrar de gente que nunca soube que ele existe.
**É o desfecho mais provável, e nada neste documento o impede** — só a Fase P.1-G, que é a única
tarefa que não é código.

**Causa 2: o produto não estava pronto para quem paga.** Um profissional pagante descobre em duas
semanas o que nenhum teste pega — o fluxo que trava, o relatório que não bate. Com 3 tenants e um
deles semeado, o CICLO **nunca foi usado de verdade por ninguém**.

**Causa 3: o preço estava certo e a dor não era essa.** Barbeiro solo com caderno não tem dor de
agenda — tem dor de cliente que some. O Motor de Ciclo é a resposta certa, mas está atrás do cron,
que não existe. Vendeu-se agenda contra caderno, e o caderno é grátis e funciona.

### R.2 · O caso contra cobrar agora — sem palha

O argumento mais forte contra este documento inteiro:

> O CICLO tem **três tenants, um dos quais é demonstração**. Não existe evidência de que alguém
> queira este produto o suficiente para pagar. Construir cobrança agora é responder à pergunta
> errada: a pergunta não é "como cobro?", é "alguém quer?". Todo trabalho de billing é
> **irreversível em atenção** — o tempo gasto em proração é tempo não gasto conversando com
> barbeiro. E o histórico do próprio projeto mostra o padrão: 58 tickets, duas rodadas de CRM,
> auditoria de segurança completa, redesenho de identidade — tudo antes do primeiro cliente. Mais
> um documento de 500 linhas é mais do mesmo com outro nome.

**Minha resposta, parcial:** o argumento está **certo sobre a máquina** e errado sobre o mínimo.
Não dá para vender sem saber quanto custa nem ter onde mostrar preço — e isso é a Fase P.1, que
cabe numa semana. O erro seria a Fase P.2 sem os sinais.

**Concordância explícita:** se este plano levar a três semanas construindo billing, **ele terá
piorado o projeto**. O critério da P.3 existe para isso.

### R.3 · Ataque à métrica de valor (Fase C)

Degrau por número de profissionais assume que **profissional ≈ valor**. Falha quando: (a) um
barbeiro solo faz 300 atendimentos/mês e paga o mesmo que um que faz 30 — o primeiro extrai 10×
mais e paga igual; (b) profissões que **não têm "profissional"** no sentido de assento — uma
faxineira solo nunca sai do degrau 1, para sempre. **Para metade do catálogo, esta métrica tem
teto de R$ 49 por cliente, para sempre.**

### R.4 · Ataque ao preço (Fase E)

**Pode estar 2× alto:** contra caderno + WhatsApp (R$ 0), R$ 49/mês = R$ 588/ano para um barbeiro
que fatura R$ 5 mil/mês é uma decisão que ele adia. Talvez o preço certo de entrada seja R$ 19–29,
com o Equipe fazendo o dinheiro.

**Pode estar 2× baixo:** para uma barbearia de 4 cadeiras que já paga R$ 110 no Trinks, R$ 49 é
tão barato que **levanta suspeita de fragilidade** — e ainda por cima é o segmento com margem
melhor (F.4).

Os dois ataques são plausíveis, o que significa que **a Fase E está apoiada em [S], não em [M]**.
A P.1-G existe exatamente para corrigir isso.

### R.5 · O concorrente que mata isso

**Não é o Trinks** — ele está subindo de mercado (some com preço acima de 5 profissionais). O
perigo real:

1. ⚠️ **O Fresha já chegou — isto deixou de ser cenário e virou fato, na 3ª rodada de pesquisa.**
   Preço **em real** (R$ 39,95 solo, R$ 26,95/membro) e **comissão zero** sobre cliente novo do
   marketplace, na página do próprio fornecedor **[M]**. Eles não vendem software, vendem
   **cliente novo** — e um barbeiro escolhe quem traz cliente sobre quem organiza agenda, sempre.

   **O CICLO não tem resposta e não vai ter**, porque marketplace está fora de escopo por decisão
   do §10 do prompt. Isso é escolha de escopo, não vantagem, e agora tem custo conhecido: o
   degrau de entrada do CICLO custa **23% mais** que um produto que **também traz clientes**.

   **O que resta é escolher o terreno.** O Fresha ganha em aquisição; o CICLO só pode ganhar em
   **retenção da base que o profissional já tem** — que é literalmente o Motor de Ciclo, e é o
   item que o Trinks vende como add-on pago (A.2). Se a venda do CICLO for sobre agenda ou sobre
   preço, ela é perdida antes de começar.
2. **WhatsApp Business virando agenda de verdade.** É onde o público já está, é grátis e é da
   Meta. Se isso acontecer, o degrau de entrada evapora.

### R.6 · Onde este documento usa [S] como se fosse [M]

Auditoria honesta do próprio texto:

| Onde | O problema |
|---|---|
| **Limite de 50 clientes no grátis** (D.3) | Apresentado com ar de calibragem; é chute com uma referência semeada |
| **30 min de suporte/mês** (F.4) | Sustenta a conclusão mais forte do documento (metade da margem) e **não tem base nenhuma** |
| **Meta de R$ 3.000/mês** (F.5) | Número escolhido por mim, não pelo Eduardo — e define os "84 clientes" |
| **Tabela de DAP** (B.4) | A mais frágil do documento; parece pesquisa de mercado e é intuição |
| **Tempo de volta dos laços** (G) | "1–3 meses" não tem origem |

Todas estão rotuladas **[S]** no corpo, mas **a prosa ao redor às vezes as trata com mais
confiança que o rótulo permite**. Ao ler decisões, o peso deve ser sempre o do rótulo.

**Acrescentado na auditoria — os defeitos que a primeira versão não viu em si mesma:**

| Onde | O problema |
|---|---|
| **Fase F inteira** (1ª versão) | Não era [S] apresentado como [M] — era pior: era **[E] com a fórmula errada**, por esquecer imposto e contabilidade. Toda a aritmética estava certa e todos os insumos, incompletos. Corrigido em F.8 |
| **"R$ 49 fica abaixo do mercado"** (E.2, 1ª versão) | Verdadeiro contra Trinks e Avec, **falso contra o Simples Agenda**. A conclusão foi tirada de uma amostra que não incluía o concorrente mais parecido. É viés de amostragem, não de rótulo |
| **"Não existe cron"** (§4.2, 1ª versão) | Impreciso para menos. Existem **6 rotas prontas e desligadas** — o que muda o problema de "construir" para "ligar", e muda a prioridade inteira (L.5) |
| **Teste de 14 dias** (K, 1ª versão) | Número sem origem, e **abaixo de todo o mercado pesquisado**. Corrigido para 30 em E.2.2 |
| **Tabela D.3** | Escrita com módulos de beleza e apresentada como se valesse para as 17 profissões. Só vale para o ICP — ver D.5 |
| **"3 tenants reais"** | Verdadeiro, mas ameno demais: os 3 têm **os mesmos 3 eixos**, e o último agendamento de dois deles é de agosto. Não é base pequena, é **base parada** |
| **"resíduo de suítes que falharam antes do `afterAll`"** (K) | Diagnóstico errado, e errado para o lado tranquilizador: sugere acidente pontual quando é **a suíte apontando para produção por configuração**. Levou o P-B a ser dimensionado como "trivial". Corrigido em P.1.1 |

**O padrão por trás dos sete:** a primeira versão errou sempre na mesma direção — **para o lado
otimista**, e sempre por *ausência* de um dado, nunca por invenção. Nenhum número foi inflado; o
que faltou foi ir buscar o que estava faltando. É o modo de falha do §0.1 do prompt aparecendo na
prática: **consultoria plausível, internamente coerente, e incompleta nos insumos que decidem.**

---

## As duas listas

### Decidido com base

- Faixa de preço do mercado brasileiro **[M]**, com **13 concorrentes** e fontes datadas
- **MEI é vedado para software** **[M]** → ME no Simples Nacional → contabilidade a R$ 139–195/mês
  é custo fixo obrigatório **antes do 1º cliente**
- **Alíquota é 6% (Anexo III) ou 15,5% (Anexo V), decidida pelo Fator R ≥ 28%** **[M]**
- Mercado Pago com vantagem de **4×** em Pix no ticket de entrada **[M]** + conta em J.2
- **Pix Automático disponível em todas as instituições desde 1º/1/2026** **[M]** — derruba a
  ressalva do próprio prompt sobre recorrência em Pix
- **6 rotas de cron existem e nunca rodaram** (`crons: []`) **[M]**; o Hobby trava em 1×/dia
  **[M]**, e cron externo resolve a **R$ 0** (L.5)
- **Trinks, Avec e Simples Agenda cobram por faixa de profissionais** **[M]** — a métrica da
  Fase C é convenção da categoria, não invenção
- **Simples Agenda: R$ 39,90 para 1 profissional, 3.900 salões** **[M]** — R$ 49 não é o barato
- Trinks cobra à parte por lembrete/fidelidade/WhatsApp; o CICLO inclui **[M]**
- Fresha aposentou o grátis em 2025 **[M]** — corrige premissa do próprio prompt
- **GetNinjas cobra por lead, não assinatura** **[M]** — o serviço de campo já gasta com software,
  só que em aquisição
- Vazio de R$ 50 no serviço de campo (concorrentes em R$ 295–525) **[M]**
- Renomear o enum é custo zero **agora** (zero linhas leem) **[M]**
- `tenant_modules` já tem a coluna que a tela de bloqueio precisa **[M]** — mas **`modulo` não tem
  restrição nenhuma** **[M]** (L.6)
- **Os 3 tenants reais têm os mesmos 3 eixos** (`no_local`/`fixo`/`avulso`) **[M]** — o modelo de
  4 eixos nunca foi exercitado
- Ponto de equilíbrio: **5 assinantes** com o custo fixo real **[E]**
- As 4 `FEATURE_*` não podem gatear por tenant **[M]**

### Aposta

- **Preço de R$ 49** — apoiado em faixa de mercado, não em disposição a pagar medida. E agora
  com um concorrente direto **23% mais barato** (E.2.1)
- **Que a diferenciação pelo Motor de Ciclo sustenta o prêmio de preço** — é a aposta central do
  documento, e a previsão 6 existe para testá-la
- **ICP beleza** — coerente, não testado
- **Limites do plano grátis** — 50 clientes é chute, e o próprio `dom-rocha` não caberia (K)
- **Custo de suporte** — a premissa que mais decide, e a menos sustentada
- **Meta de R$ 3.000/mês** — escolhida por mim, não pelo Eduardo; define os 84 clientes
- **Fator R dar Anexo III** — plausível com receita baixa, mas envolve pró-labore/INSS que este
  documento não modela
- **Momento "aha"** — hipótese não medida
- **Teste de 30 dias** — alinhado ao mercado **[M]**, mas a conversão em 30 vs 14 dias é **[S]**
- **Três degraus** — o mercado usa, este produto não provou precisar
- **Empacotamento fora do eixo beleza** — D.5 dá a regra, não os módulos; o produto nunca foi
  usado por faxineira nem eletricista
- **Indicação converte nesta categoria** — plausível, e o §13.1 já apostou nisso

---

## Definição de pronto (§11 do prompt)

Reconferida na auditoria de **2026-08-24**, item por item, contra o texto e não contra a memória:

- [x] Fases A–P com seção própria
- [x] Preços com **URL e coluna `Consultado em`** (contrato do §9 cumprido na A.1) — todo número
      rotulado [M]/[E]/[S]
- [x] Aritmética visível em F.1–F.8, J.2, L.5 e O
- [x] Itens classificados (Decidido/Recomendado/Do Eduardo/Bloqueado)
- [x] **As 8 tensões do §4**, cada uma com endereço:
      **4.1** zero pagantes → P.1, R.2 · **4.2** cron → **L.5 (decisão tomada)**, P-0 ·
      **4.3** `pro`×`profissional` → D.4 · **4.4** 3 planos × 4 valores do enum → D.4 ·
      **4.5** preço pesquisado → A.1 (13 fontes) · **4.6** fiscal → **N.0** ·
      **4.7** os 4 eixos → **D.5** · **4.8** zero uso real → B.4, D.5, R.6
- [x] Red team incluindo o caso de **não fazer nada agora** (R.2) e a **auto-auditoria ampliada**
      dos erros da 1ª versão (R.6)
- [x] **6 previsões** com prazo e critério de falha
- [x] P responde o que precisa existir para o cliente nº 1, com critério de parada — e **P-0**
      corrige a ordem
- [x] Nenhum mecanismo viola o §5.10 (auditado em N.1)
- [x] Nada construído — o plano é o entregável

**O que continua NÃO pronto, e é honesto dizer:**

- [ ] **Preço não está medido.** Continua **[S]** até as 20 conversas da P.1-G. O documento
      pesquisou o *mercado*, não a *disposição a pagar* do cliente do CICLO — são coisas
      diferentes e só a segunda decide.
- [ ] **Empacotamento fora do eixo de beleza** está em regra (D.5), não em tabela. Não dá para
      escrever sem uso real, e escrever mesmo assim seria exatamente o defeito do §0.1.
- [ ] **Comportamento do Pix Automático** (retentativa, saldo insuficiente, cancelamento) não foi
      verificado — a regra 5.5 proíbe tocar no PSP sem autorização. **Bloqueado**, e nomeado.
