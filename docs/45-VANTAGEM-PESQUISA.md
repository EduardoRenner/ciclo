# 45 · Pesquisa de vantagem defensável — quatro lentes, não uma

**2026-09-05.** O `docs/43` fez a pesquisa de mercado com uma lente (Zero a Um) e produziu
**comunicação**: frase na landing, seção em `/precos`, um veto. O dono avaliou e o veredito foi
*"então continua sem vantagem nenhuma em relação aos outros"*. Ele está certo — dizer melhor uma
verdade que já existia não constrói fosso.

Este documento existe para achar **mecanismo**, e usa quatro lentes porque cada uma acha o que as
outras não acham:

| Lente | A pergunta que ela faz |
|---|---|
| **Zero a Um** (Thiel) | onde dá para monopolizar? |
| **7 Powers** (Helmer) | POR QUE o poder se sustenta no tempo? |
| **Innovator's Dilemma** (Christensen) | a vantagem é estrutural ou o líder só não decidiu copiar? |
| **Blue Ocean** (Kim & Mauborgne) | o que todo mundo no setor tem, e não precisa existir? |

Convenção: **[M]** medido no código/banco deste repositório · **[P]** pesquisa externa, com fonte ·
**[E]** estimativa minha.

---

## 1.1 · Zero a Um — arqueologia de fosso por concorrente

| Concorrente | Ativo que sustenta o preço | O que ele NÃO pode fazer sem se destruir | O que o CICLO nunca terá (e não deve tentar) |
|---|---|---|---|
| **AppBarber** | Base instalada do app do cliente (1M+ instalações, ~12 anos) **[P]** | Tirar a lista de concorrentes do app — é o valor de rede que justifica o app existir **[P]** | 12 anos de base e reconhecimento de marca no nicho |
| **BestBarbers** | App próprio + clube de assinatura como produto principal **[P]** | Abandonar o app — é o canal de relacionamento dele com o cliente final **[P]** | Operação de clube de assinatura já rodando em escala |
| **Trinks** | Marketplace de beleza + integrações (Conecta) **[P]** | Deixar de ser marketplace — é o que traz o tráfego que ele vende **[P]** | Ecossistema de integrações e presença em salão grande |
| **Fresha** | Marketplace global + **20% de comissão em cliente novo** (mín. US$ 6) **[P]** | Abrir mão da comissão — é a receita principal, não um extra **[P]** | Alcance global e volume de marketplace |
| **Booksy** | Marketplace global, comissão só no "Boost" **[P]** | Idem Fresha, em grau menor | Idem |

**O padrão:** os cinco vendem, no fundo, **acesso a cliente**. O CICLO vende **retenção do cliente
que o negócio já tem**. São dois produtos diferentes com a mesma cara.

### O que a pesquisa desta rodada acrescentou ao `43` — e muda a conclusão dele

O `43` tratou "prever quem volta" como território vazio. **Não é vazio: é ocupado por uma régua
errada.** O material dos próprios concorrentes descreve reativação automática por **janela fixa**:

> *"Se um cliente não agenda há 45 dias, o sistema de gestão envia um lembrete com um link para
> agendamento."* **[P]** — [Barbeiro.app, guia 2026](https://www.barbeiro.app/blog/melhor-sistema-para-barbearia-2026)

E, na mesma pesquisa, o setor **admite que a régua fixa está errada**:

> *"O ideal é enviar o convite entre 7 e 15 dias após o atendimento, **dependendo do tipo de corte e
> da frequência de cada cliente**."* **[P]** — [Blog Trinks](https://blog.trinks.com/convite-de-retorno-para-barbearias-e-uma-boa-estrategia-para-seu-negocio-de-beleza/)

Isso é mais valioso que ter achado um vazio. O setor **sabe** que o certo é por pessoa, escreve
isso no próprio blog, e entrega uma constante. É a diferença entre "ninguém pensou nisso" e
"todo mundo sabe e ninguém faz" — e a segunda é uma posição muito melhor para atacar.

---

## 1.2 · 7 Powers — que TIPO de poder é cada vantagem candidata

O erro do `43` foi tratar "somos diferentes" como se fosse uma coisa só. São tipos diferentes de
poder, com durabilidades diferentes.

| Vantagem candidata | Que poder é (Helmer) | Veredito |
|---|---|---|
| Sem app para o cliente final | **Counter-positioning** | ✅ real — ver 1.3 |
| Sem comissão por agendamento | **Counter-positioning** | ✅ real — ver 1.3 |
| Preço fixo vs. escalonado | Economia de escala (fraca) | ⚠️ copiável numa tarde. Preço não é monopólio |
| Página do negócio sem vitrine | Counter-positioning (mesma raiz das duas primeiras) | ✅ real, mas já comunicado e não é mecanismo |
| **Cadência de retorno por pessoa** (`personal_cycle_days`) | **Recurso cativo** (dado que só acumula com o tempo) | ✅ **é o mais forte, e está subaproveitado** |
| Motor de Ciclo em si (o cálculo) | ❌ nenhum dos 7 | O algoritmo é determinístico e está descrito em `docs/01`. Um concorrente copia o CÓDIGO em uma sprint. **O código não é o fosso — o dado acumulado é** |
| Atribuição de receita (`receitaAtribuidaAoCiclo`) | Recurso cativo (derivado do anterior) | ✅ real, mesma raiz |
| "Somos em português / feito para celular" | ❌ nenhum dos 7 | Paridade. Todo concorrente brasileiro tem |

**A distinção que o `43` não fez, e que decide esta rodada:** o Motor de Ciclo tem duas metades com
durabilidades opostas. O **cálculo** (`computeCycle`) é copiável em dias — são ~80 linhas
determinísticas **[M]**. O **dado acumulado** que alimenta o cálculo não é copiável de jeito
nenhum, porque é uma função do tempo de operação, não de esforço de engenharia.

Tudo que esta rodada construir tem que estar do lado do dado, nunca do lado do cálculo.

---

## 1.3 · Innovator's Dilemma — teste de estrutura

Para cada counter-positioning candidato: o líder não faz porque **os clientes atuais dele
penalizariam**, ou porque **só não pensou nisso**?

| Candidato | Por que o líder não faz | Estrutural? |
|---|---|---|
| Tirar a vitrine de concorrentes do app do cliente | Esvazia o ativo que justifica o app existir. O dono pediria; o modelo de negócio dele diz não **[P]** | ✅ **Sim** |
| Abrir mão da comissão sobre cliente novo | É a receita principal da Fresha, não um extra **[P]** | ✅ **Sim** |
| **Calcular cadência por pessoa em vez de janela fixa** | **Nada os impede.** Não há cliente atual que puna isso, não há receita que dependa da régua fixa. É trabalho não feito, não impedimento estrutural **[E]** | ❌ **Não** |

**Este é o achado mais importante da Fase 1, e ele derruba o candidato mais óbvio.**

A previsão por pessoa **não é counter-positioning**. Se o AppBarber decidir amanhã, ele constrói. E
ele tem uma vantagem brutal para isso: 12 anos de histórico de agendamento acumulado **[P]** — ou
seja, o "recurso cativo" que o CICLO tem em quantidade minúscula, ele tem em quantidade enorme e
parado.

**Consequência para a Fase 2:** qualquer mecanismo cujo fosso seja "nós prevemos e eles não" é
frágil por construção. O fosso tem que estar em algo que **o histórico bruto deles não resolve**.

E existe uma coisa assim: **histórico de agendamento não é histórico de PREVISÃO.** O AppBarber sabe
quando cada cliente veio. Ele não sabe — e não tem como saber retroativamente — **o que um motor de
previsão teria dito, e se teria acertado**. Isso só existe para quem rodou o motor em produção, dia
após dia, e guardou o que previu antes de saber o resultado. Não é reconstruível a partir de dado
histórico, porque previsão feita depois do fato não é previsão.

---

## 1.4 · Blue Ocean — a grade de 4 ações, aplicada ao setor

As outras três lentes perguntam onde ser melhor ou impossível de copiar. Esta pergunta o que
**não precisa existir**.

| Ação | O quê | Situação no CICLO |
|---|---|---|
| **Eliminar** | O app próprio para o cliente final. Todo concorrente do nicho tem um; ele existe para o benefício da PLATAFORMA (rede, retenção do cliente final), não do negócio **[P]** | ✅ já eliminado por arquitetura **[M]** — e o `43` já comunicou |
| **Eliminar** | A vitrine/marketplace que mostra concorrentes | ✅ já eliminado, com veto permanente **[M]** |
| **Reduzir** | Configuração no onboarding. O setor entrega catálogo enorme para o dono ajustar; o CICLO já semeia por profissão | ⚠️ parcial |
| **Elevar** | **A previsão de retorno, de janela fixa para cadência por pessoa** — o setor entrega uma constante (45 dias) e sabe que está errada **[P]** | ✅ já feito no cálculo **[M]**, mas **sem prova de que funciona** |
| **Criar** | **Prestação de contas do próprio motor.** Nenhum dos cinco publica, nem para o cliente pagante, se a previsão que ele faz acerta. O setor inteiro vende automação sem medir o resultado dela | ❌ **não existe em lugar nenhum — é o espaço vazio** |

A linha "Criar" é a única da tabela que ninguém ocupou. E ela não é ideia de marketing: é o
único jeito honesto de o CICLO provar que a régua dele é melhor que a régua fixa do setor.

---

## 1.5 · A dor não atendida, com evidência

O `43` achou duas queixas de dono. Esta rodada acrescenta três, das quais uma muda a estratégia.

| # | Queixa | Fonte | Dono ou cliente? | O concorrente conserta sem quebrar o modelo? |
|---|---|---|---|---|
| 1 | "Baixe nosso app" faz cliente novo desistir | `43` **[P]** | Dono | ❌ não — é o ativo dele |
| 2 | O app mostra concorrentes para a clientela dele | `43` **[P]** | Dono | ❌ não — é o valor de rede dele |
| 3 | **Cobrança e cancelamento**: troca de data de vencimento sem aviso, dificuldade de cancelar plano, cobrança indevida | [Reclame Aqui · App Barber](https://www.reclameaqui.com.br/empresa/app-barber/) **[P]** | Dono | ✅ **sim** — é operação, não modelo. Não é fosso |
| 4 | **Funcionalidade que não entrega o prometido** (agendamento, estoque, pacotes), com suporte que não resolve | [Reclame Aqui · reclamação específica](https://www.reclameaqui.com.br/app-barber/app-barber-nao-cumpre-o-que-promete-falhas-no-agendamento-estoque-e-controle-de-pacotes_YQQypRdlbb6F1pEr/) **[P]** | Dono | ✅ sim — é qualidade, não modelo. Não é fosso |
| 5 | **Medo de o dado ficar preso**: "alguns sistemas gratuitos não permitem exportar o histórico — você usa seis meses, cadastra 300 clientes, e na hora de migrar descobre que o dado fica preso" | [Blog Belio](https://blog.belio.com.br/artigos/melhores-sistemas-agendamento-salao-beleza-2026/) **[P]** | Dono | ✅ sim — botão de exportar é uma sprint. Não é fosso sozinho |

**Sobre a 5, e é uma correção importante de rota:** ela parece a materialização perfeita do "seu
cliente é seu". Mas exportar CSV é feature de uma sprint, e a mesma fonte registra que **a LGPD já
resolve isso juridicamente** — o salão é o *controlador* e o sistema é o *operador*, então o banco
já é dele por lei **[P]**. Construir "portabilidade" como diferencial seria vender como vantagem
uma coisa que a lei obriga e que todo concorrente sério já faz.

As queixas 3 e 4 são as mais numerosas no Reclame Aqui e as menos úteis para esta rodada: são
falhas de execução do líder, não do modelo dele. Um concorrente conserta operação; ele não conserta
o próprio modelo de negócio.

---

## 1.6 · Arqueologia do repositório — de onde vem o recurso cativo

Todo dado que só existe porque o Motor de Ciclo existe, e quanto tempo um concorrente levaria para
ter **dado suficiente** (não código — dado acumulado) para o recurso ser útil:

| Dado **[M]** | O que é | Tempo até um concorrente ter o equivalente útil |
|---|---|---|
| `client_cycles.personal_cycle_days` | mediana dos últimos 5 intervalos daquela pessoa naquele serviço, misturada com o padrão | **Imediato para quem já tem histórico.** O AppBarber tem 12 anos de agendamento parado — ele calcula isso em batch **[E]** |
| `client_cycles.predicted_on` | a data prevista de retorno | Idem — derivável do histórico |
| `client_cycles.state` / `late_days` | a máquina de estados (`on_track`/`due`/`late`/`at_risk`/`lost`) | Idem |
| `client_cycles.value_at_risk_cents` | preço × probabilidade por estado | Idem |
| `client_cycles.computed_at` + histórico de execuções | **quando cada previsão foi feita** | ⚠️ **hoje é sobrescrito a cada recálculo — não há histórico [M]** |
| **A previsão CONFRONTADA com o que aconteceu depois** | acertou? errou por quantos dias? em que direção? | **Não é reconstruível.** Exige ter previsto ANTES de saber. 12 anos de histórico não produzem isso retroativamente **[E]** |

**A conclusão que orienta a Fase 2:** as quatro primeiras linhas parecem fosso e não são — o líder
as deriva em batch do que já tem. A última linha é a única que o tempo protege de verdade, **e o
CICLO ainda não a guarda**. Hoje `computed_at` é sobrescrito e a previsão anterior se perde **[M]**.

Ou seja: o recurso cativo mais defensável do produto **está sendo jogado fora todo dia, a cada
execução do `recompute-cycles`**.

---

## Resumo para a Fase 2

1. O único counter-positioning real é o que o `43` já achou e já comunicou (sem app, sem vitrine,
   sem comissão) — **não sobra mecanismo novo ali**.
2. Previsão por pessoa **não é fosso**: o líder tem mais dado bruto que o CICLO e nada o impede.
3. O setor faz reativação por **janela fixa e sabe que está errada** **[P]** — há espaço para ser
   demonstravelmente melhor, mas "ser melhor" precisa de **prova**, não de alegação.
4. O único espaço que ninguém ocupou (Blue Ocean · Criar) é **medir e mostrar se a própria previsão
   acerta**.
5. O único dado que o tempo protege é **a previsão guardada antes do resultado** — e o CICLO
   sobrescreve isso hoje.

Os pontos 3, 4 e 5 apontam para o mesmo mecanismo. A Fase 2 testa isso contra outros quatro
candidatos antes de decidir.
