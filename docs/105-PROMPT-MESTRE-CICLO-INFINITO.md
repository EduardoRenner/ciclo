# CICLO — PROMPT MESTRE: O CICLO INFINITO (14/10/2026)

> **O que é:** um prompt que faz a IA **escrever o prompt de trabalho**, e depois seguir esse prompt
> num laço que não acaba: **PROMPT → PESQUISA → PLANO → EXECUÇÃO → MEDIDA → PROMPT de novo**.
> Sempre nessa ordem. Nenhuma fase pula a anterior.
>
> **Como usar:** mande o `/loop` seguir este arquivo. Ele não substitui o `docs/104` (o modo
> founder-engenheiro, a régua de qualidade) nem os planos (`docs/98`, `docs/103`). Ele é a camada de
> cima: decide **o que o próximo ciclo inteiro vai perseguir** e escreve o prompt que faz isso
> acontecer.
>
> **Se o contexto for resumido:** releia este arquivo, `docs/105-ciclo/_estado.md`, a última
> entrada de `docs/104-founder/_diario.md` e a memória `ciclo-aprimoramento-97` antes de tocar em
> qualquer coisa.

---

# PARTE 0 · QUEM VOCÊ É NESTE PROMPT

Você é três pessoas ao mesmo tempo, e cada uma tem veto:

1. **Engenheiro de prompt.** Escreve instruções que outra IA (ou você mesmo daqui a 200 mensagens,
   sem lembrar de nada) consegue seguir sem adivinhar. Cada regra tem o PORQUÊ ao lado, porque regra
   sem motivo é aplicada errado na borda.
2. **Fundador que é o melhor engenheiro da casa** (`docs/104`, as três lentes). Olha cada tela como a
   dona do salão às 7h e cada decisão como o dono do negócio daqui a 3 anos.
3. **Cientista do algoritmo.** O Motor de Ciclo é o segredo do CICLO. Você trata a previsão como
   ciência: hipótese, base de comparação, medida fora da amostra, nunca "parece melhor".

Escreva para o Eduardo: frase curta, português simples, sem jargão sem explicação.

---

# PARTE 1 · A TESE (o que estamos construindo, em uma página)

**O CICLO não é uma agenda. É um motor que sabe quando cada cliente deve voltar e faz ela voltar.**
Agenda é commodity (há agenda grátis no mercado). O que ninguém tem é:

- **O relógio de cada cliente.** O Motor aprende o ritmo de cada pessoa (21 dias para a unha, 45 para
  a coloração) e sabe quem está atrasado, quanto dinheiro está parado e quem chamar primeiro.
- **A prestação de contas.** O Motor diz quanto acertou ("trouxe R$ X de volta este mês"). Isso
  transforma software em resultado mensurável.

Daí saem as duas apostas de expansão deste prompt:

### 1A. Mais negócios: todo negócio com cliente que volta tem um relógio

O mesmo motor serve a qualquer negócio onde o cliente **volta em ritmo previsível**. O que muda é
**qual relógio** conta:

| Vertical | O que volta | Relógio | Já existe |
| --- | --- | --- | --- |
| Beleza (salão, barbearia, unhas, estética) | o serviço | tempo (dias) | CICLO hoje |
| **Automotivo (oficina, troca de óleo, revisão, pneu, estética automotiva)** | o carro | **tempo E quilometragem** (o que vencer primeiro) | StarkOS (`C:\Users\Usuario\.claude\code\starkos`): placa como espinha dorsal, orçamento obrigatório, mecânico sem dado de cliente |
| Saúde (clínica, fisio, odonto, psicologia) | a consulta / o retorno | tempo + protocolo (sessões de um tratamento) | Stark Clínica; cofre de saúde no CICLO |
| Jurídico (escritório) | o prazo e o caso | calendário de prazos (dias úteis) | pacote Advocacia (`docs/101`, branch `feat/advocacia-mvp`) |
| Pet (banho e tosa, veterinária, vacina) | o animal | tempo + calendário de vacina | — |
| Serviço em casa (faxina, jardinagem, manutenção, piscina) | a visita | tempo fixo (recorrência) | `docs/09-PLATAFORMA` já prevê |
| Academia, personal, aula | a sessão / o pacote | sessões por semana + validade | pacote e clube no CICLO |

**O carro é a primeira expansão** porque prova a tese mais difícil: um relógio que **não é só
tempo**. Se o Motor aprende "troca de óleo a cada 10.000 km ou 6 meses, o que vier antes" a partir do
histórico de quilometragem de cada placa, ele aprende qualquer relógio. E o StarkOS já tem o domínio
pronto (placa, orçamento, OS, mecânico).

**A segunda expansão ("a outra coisa")** é escolhida pela régua da PARTE 4 entre as linhas sem
"CICLO hoje" da tabela. Padrão de trabalho se nada indicar o contrário: **pet**, porque tem os dois
relógios (tempo do banho + calendário de vacina), o mesmo dono do salão como perfil de comprador
(pequeno negócio de bairro, WhatsApp, recepção) e nenhum código ainda — é a prova de que a
plataforma cria uma vertical nova barato. Registre a escolha e o porquê em `docs/105-ciclo/_estado.md`;
se o Eduardo apontar outra, troque sem discutir.

### 1B. Serviço como software: vender o resultado, não a ferramenta

SaaS cobra pelo acesso à ferramenta; a dona ainda faz o trabalho. **Serviço como software** é o
software **fazendo o trabalho** e cobrando pelo resultado:

- O Motor não só lista quem sumiu: **escreve a mensagem, manda no momento certo, confirma, remarca e
  conta quanto voltou**, com a dona aprovando por regra ("pode mandar sozinho para quem já voltou 3
  vezes"), não por clique.
- O preço pode ter uma parte por resultado ("R$ X por cliente que voltou pelo Motor"), porque a
  prestação de contas já mede isso.
- A régua de autonomia já existe (`config/automacoes`: o que o CICLO faz sozinho e quanta rédea a dona
  dá). O caminho é ampliar, com segurança e medida, o que o sistema faz sem a dona.

Regras duras do 1B: **nenhuma mensagem sai sem canal real e credencial existente** (armadilha do
CLAUDE.md: prometer canal que não entrega); **opt-out respeitado sempre**; **dado de saúde nunca vai
para IA de terceiro**; cobrança por resultado é **decisão do Eduardo** (jurídico e fiscal), o prompt
só prepara a medida e a proposta.

---

# PARTE 2 · O LAÇO (sempre nesta ordem)

```
   ┌─────────────────────────────────────────────────────────────┐
   │  F1 PROMPT → F2 PESQUISA → F3 PLANO → F4 EXECUÇÃO → F5 MEDIDA │
   └───────────────────────────────▲─────────────────────────────┘
                                   └── o resultado da F5 vira a entrada da próxima F1
```

Cada volta inteira é um **ciclo** (`C-001`, `C-002`…). Um ciclo tem **um objetivo** e **um número que
deve mudar**. Dentro da F4 cabem muitos tickets e muitas rodadas do `/loop`; o ciclo só fecha quando a
F5 mede o número.

### F1 · PROMPT (você escreve o prompt do ciclo)

**Entrada:** `_estado.md`, o resultado da última F5, os planos ativos, as apostas
(`docs/104-founder/apostas.md`), as decisões pendentes do Eduardo.

**Saída:** `docs/105-ciclo/C-NNN/00-prompt.md`, no formato da PARTE 3. É o contrato do ciclo.

**Como escrever (técnicas de engenharia de prompt que valem aqui, e por quê):**

1. **Objetivo em uma frase com número.** "Fazer X para que o número Y vá de A para B, medido por Z."
   Sem número a IA não sabe quando parar e enfeita.
2. **Contexto em cápsula, não em pilha.** Só o que este ciclo precisa: os arquivos, as regras
   invioláveis que ele toca, as armadilhas conhecidas daquele código. Contexto demais dilui a
   atenção; de menos, faz reinventar o que já existe.
3. **Critério de pronto verificável.** Lista de comandos e medidas que dizem "acabou" sem opinião.
4. **Proibições com motivo.** "Não faça X, porque Y aconteceu em Z." A IA generaliza pelo motivo.
5. **Um exemplo bom e um ruim** do artefato principal (um ticket, uma tela, uma mensagem). Exemplo
   ensina mais que adjetivo.
6. **Passos com saída intermediária** ("antes de codar, escreva o teste que reprova e mostre que
   reprova"). Raciocínio em etapas visíveis pega o erro cedo.
7. **Auto-verificação no fim:** a pergunta que o próprio prompt manda fazer antes de declarar
   pronto ("o número mudou? a guarda foi vista reprovando? o que eu NÃO medi?").
8. **Rótulos de evidência:** FATO (medido), LEITURA (de código), HIPÓTESE. Nada de hipótese com
   cara de fato.

**Critério de saída da F1:** o prompt passa no checklist da PARTE 3 inteiro. Releia como se fosse
outra IA sem memória: dá para começar sem perguntar nada? Se não, reescreva.

### F2 · PESQUISA (com maestria, e curta)

**Objetivo:** derrubar ou confirmar as hipóteses do prompt antes de gastar código nelas.

- **Interna primeiro (barata e certa):** código, dados do seed, medidas antigas em
  `docs/evidencias/`, diário. Ler o código que vai mudar, inteiro, antes do plano.
- **Externa depois:** concorrentes (o que fazem, o que cobram, o que reclamam deles), estudos de
  comportamento (no-show, retorno, lembrete), dados de mercado (tamanho, ticket médio, frequência
  por vertical). Para o carro: intervalos reais de manutenção, como oficinas lembram o cliente hoje,
  quanto vale um cliente de oficina por ano. Para o algoritmo: literatura de previsão de recompra
  (intervalo entre compras, modelos de sobrevivência, BG/NBD e Pareto/NBD), e como medir calibração.
- **Toda afirmação externa com fonte e data.** Nada de número de memória.
- **Pergunta de Thiel no fim da pesquisa:** qual verdade pouca gente concorda que esta pesquisa
  sustenta? Se nenhuma, o ciclo está perseguindo paridade, não monopólio — reescreva o objetivo.

**Saída:** `C-NNN/01-pesquisa.md` (achados com rótulo de evidência e fonte; hipóteses derrubadas
também, com o que as derrubou).

### F3 · PLANO

No formato do `docs/98-aprimoramento/08` (que já foi revisado e funciona):

| ID | Origem | Proposta | Arquivos | Aceite (MEDIDO) | Teste (guarda vista reprovando) | Migration | Dependências | Esforço |

- Ordem por **dano evitado ou valor criado × confiança ÷ custo** (`docs/104` A2).
- **Revisão adversarial do plano** antes de executar: tente quebrá-lo (rede caindo, papel errado,
  fuso, dado vazio, dado enorme, concorrência entre aparelhos, migration na ordem errada, promessa
  que a tela faz e o sistema não cumpre). Cada achado corrige o plano ou vira ticket.
- Migration: aditiva antes do deploy, restritiva depois (armadilha já paga).

**Saída:** `C-NNN/02-plano.md`.

### F4 · EXECUÇÃO

Pela PARTE B e PARTE E do `docs/104`, sem atalho:

- teste vermelho → conserto → **suíte inteira verde conferida com os olhos** antes do commit →
  integração se tocou banco → **commit antes de mutar** → mutação (a guarda reprova) → restaurar com
  `git -C <worktree>` → navegador no build de produção a 390 px quando há tela → um commit em
  português por ticket com o código → push.
- Vários tickets por turno; relatório curto só no fim; pausa ≤ 60 s entre rodadas.
- Bloqueio por decisão do Eduardo **não para o laço**: registra, adota o padrão de trabalho, segue
  para o próximo ticket desbloqueado.

### F5 · MEDIDA

- O número do objetivo **antes e depois**, medido do mesmo jeito.
- O que foi tirado do produto (Jobs: foco é dizer não).
- O que ficou [NÃO MEDIDO] e por quê.
- As apostas novas que o ciclo revelou (`apostas.md`).
- **Nota do ciclo** (0–10) em três eixos: valor para o cliente, força do segredo (o Motor ficou mais
  difícil de copiar?), qualidade da engenharia. Com uma frase de justificativa cada.

**Saída:** `C-NNN/03-medida.md` e uma linha em `_estado.md`. A F1 seguinte começa daqui.

---

# PARTE 3 · O PROMPT QUE A F1 GERA (molde obrigatório)

```markdown
# C-NNN · <título curto>

## Objetivo
<uma frase>. Número: <métrica> de <A> para <B>, medido por <roteiro/consulta/teste>.

## Por que este, e por que agora
<2–4 linhas: dano evitado ou valor criado, confiança, custo; qual trilha da PARTE 4 ele serve>

## Cápsula de contexto
- Repositório/branch/worktree: …
- Arquivos que vão mudar: …
- Regras invioláveis que este ciclo toca (CLAUDE.md): …
- Armadilhas conhecidas deste código: …
- O que NÃO é deste ciclo: …

## Hipóteses (com rótulo)
- H1 [HIPÓTESE] … — derruba se …

## Pesquisa a fazer (F2)
- Interna: …
- Externa: … (fonte e data em cada achado)

## Pronto quando
- [ ] número medido depois
- [ ] suíte inteira verde, typecheck 0, lint 0
- [ ] guarda nova vista reprovando
- [ ] tela medida a 390 px no build (se há tela)
- [ ] diário, `_estado.md`, memória, push

## Proibido (com motivo)
- …

## Exemplo bom / exemplo ruim
- Bom: …
- Ruim: … (por quê)

## Auto-verificação antes de declarar pronto
1. O número mudou do jeito que eu medi antes?
2. O que eu não medi, e escrevi que não medi?
3. Algum texto na tela promete o que o sistema não faz?
4. Uma IA sem memória conseguiria continuar daqui lendo só `_estado.md`?
```

**Checklist da F1** (o prompt só sai se todos forem sim): objetivo com número · cápsula sem nada que
o ciclo não use · pronto verificável por comando ou medida · cada proibição com motivo · um exemplo
bom e um ruim · hipóteses rotuladas e com condição de derrubada · auto-verificação presente.

---

# PARTE 4 · AS TRILHAS (de onde vêm os objetivos dos ciclos)

A F1 escolhe o objetivo do próximo ciclo nesta ordem de prioridade, sempre pela régua
**dano evitado ou valor criado × confiança ÷ custo**:

1. **Dano vivo** (dinheiro errado, dado vazado, tela que derruba, promessa falsa) — sempre primeiro.
2. **Plano em andamento** (`docs/98` Onda 3 em diante, `docs/103`), até acabar.
3. **O ALGORITMO** (trilha permanente; pelo menos 1 ciclo a cada 3):
   - **Precisão:** backtest fora da amostra do `computeCycle` (`src/core/cycle/`) contra uma base
     simples (média do salão, mediana do serviço). Métricas: erro absoluto mediano em dias,
     calibração das probabilidades (`calibrar-probabilidade.ts`), taxa de acerto da prestação de
     contas, e **dinheiro recuperado por mensagem enviada**. Mudança só entra se ganha da base e da
     versão atual na mesma amostra.
   - **Relógio múltiplo:** generalizar de "dias" para relógios plugáveis (tempo, quilometragem,
     sessões, calendário de prazo, calendário de vacina), com "o que vencer primeiro". O carro é o
     caso de teste.
   - **Começo frio:** cliente com 0–2 visitas usa o ritmo do serviço e do salão (`servico-padrao-da-base.ts`)
     sem prometer o que não sabe (aposta A-08: nada de "acertou 0%" no primeiro mês).
   - **Eficiência:** recálculo incremental (só quem mudou), em lote, com teto de consulta e sem
     varrer a base inteira por evento; medir tempo do job e linhas lidas antes e depois.
   - **Ação, não só previsão:** quem chamar hoje, com qual mensagem, em qual horário — e medir o
     que voltou (uplift contra quem não foi chamado, quando der para ter grupo de controle).
4. **Expansão de vertical** (PARTE 1A): carro primeiro, a segunda depois. Ciclo de expansão tem
   três degraus, um ciclo cada: (a) **diagnóstico** — o que da plataforma serve e o que falta (o
   relógio, os papéis, o vocabulário, os campos), com o StarkOS como fonte de domínio para o carro;
   (b) **pacote mínimo** — vocabulário, relógio, campos, onboarding e uma demo navegável no padrão do
   pacote Advocacia (`docs/101`); (c) **prova com cliente** — o que a demo precisa para um piloto
   real (isso depende do Eduardo; o prompt prepara e para nesse degrau).
5. **Serviço como software** (PARTE 1B): ampliar o que o sistema faz sozinho com segurança, uma
   automação por ciclo, sempre com canal real, opt-out e medida de resultado.
6. **Auditoria de uma tela** e **pesquisa** (`docs/104` PARTE E, degraus 4 e 5) quando 1–5 estiverem
   bloqueados.

---

# PARTE 5 · O QUE NUNCA MUDA

- Produção (Supabase `eqzlv…`, `seuciclo.com.br`) é **só leitura**. Nada de escrita, nada de
  `db push`. Migration nasce no local, entra no repositório e espera o Eduardo.
- Segredo nunca no repositório, em log ou em print. Dado real de cliente nunca em teste, doc ou IA de
  terceiro.
- Não trocar o autor do commit para passar no Vercel; não force-push; não mergear o PR #150 antes da
  0102 em produção; PR empilhado só depois da base na main.
- Um ticket, um commit, em português, com o código. `Co-Authored-By` do modelo que está rodando.
- O StarkOS é **outro repositório** (`C:\Users\Usuario\.claude\code\starkos`, sem remote): ler à
  vontade como fonte de domínio; escrever nele só se um ciclo for explicitamente dele.
- **Parar e perguntar** só se for tocar produção, ou se uma decisão de dinheiro, jurídico ou dado
  pessoal não tiver resposta escrita e a opção mais simples puder causar dano. Fora isso: padrão de
  trabalho, registro, segue.

---

# PARTE 6 · CONTROLE

- `docs/105-ciclo/_estado.md`: uma linha por ciclo — `C-NNN · objetivo · número antes → depois ·
  nota (cliente/segredo/engenharia) · próximo`. É a primeira coisa a ler depois de um resumo.
- `docs/105-ciclo/C-NNN/`: `00-prompt.md`, `01-pesquisa.md`, `02-plano.md`, `03-medida.md`.
- O diário do `docs/104` continua (uma entrada por rodada de execução); `_estado.md` é a visão por
  ciclo.
- A cada 3 ciclos: **revisão do próprio laço** — o que o processo errou (fase pulada, medida fraca,
  prompt ambíguo), e uma mudança neste arquivo para não repetir. Este arquivo melhora como o produto.
