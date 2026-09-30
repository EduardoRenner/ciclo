# 85 · Motor de Inteligência — conversa, explicação e simulação sem IA externa

> 2026-09-28, Opus 5.5. Decisão do Eduardo: **não depender de IA externa (Gemini) nem de token**.
> Em vez disso, um motor "tão bom que simula uma IA": determinístico, interativo, com algoritmo
> fixo — na mesma família do Motor de Ciclo (mediana dos intervalos, sem aprendizado de máquina).
> Substitui a camada de IA do `docs/26` e é a base das apostas A/B/C do `docs/84`.

---

## 0 · Por que isto é melhor, e não só mais barato

| | Gemini (hoje) | Motor de Inteligência |
|---|---|---|
| Custo por pergunta | token + cota | **zero** |
| Latência | 2–8 s medidos (`respostas-rapidas.ts`, 30/08) | milissegundos |
| Inventa número | pode — "modelo confabula o que não vê" (memória do projeto) | **não pode**: toda frase sai de uma conta |
| Dado da cliente sai do servidor | sim, para o Google | **não** — incidente real: dado de saúde foi para o Gemini contra a regra 9 (auditoria 09/09) |
| Quebra por mudança do provedor | já quebrou: schema desconhecido derrubou todas as ferramentas com 400 (memória) | não tem provedor |
| Disponível para quem | só com `GEMINI_API_KEY` configurada — sem ela o botão some para todos (`admin/layout.tsx:159`) | **todo mundo, sempre**; funciona até offline no futuro |
| Testável | não — resposta varia | **sim** — cada pergunta tem resposta esperada em teste |
| Entende qualquer frase | sim | **não** — só o domínio do negócio (§5, a limitação honesta) |

Em 2026 todo concorrente vende "IA" (`docs/84` §3). "**A IA que não inventa número**" é uma
frase que nenhum deles pode dizer.

---

## 1 · O que já existe e é reaproveitado [FATO]

- **`AiProvider`** (`server/providers/ai/types.ts`): interface fina — recebe histórico + ferramentas,
  devolve texto **ou** chamada de ferramenta. O Motor implementa esta mesma interface. O laço
  (`executarLaco`), o filtro de ferramentas por papel e plano, os bloqueios, a auditoria e as
  **propostas com botão** (`preparar_*`) continuam intactos.
- **13 ferramentas** determinísticas (`server/assistente/ferramentas.ts`): resumo de hoje, clientes
  para recuperar, buscar cliente, histórico do cliente, faturamento do período, ocupação do dia,
  orçamentos parados, alertas de estoque, e cinco `preparar_*` que devolvem proposta para o dono
  confirmar.
- **9 respostas rápidas** já 100% determinísticas (`respostas-rapidas.ts`), com regras de honestidade
  duramente aprendidas ("atendeu", não "faturou"; "sobrou", não "lucro"; "estimativa, não
  promessa"; agenda "fechada" ≠ "vazia"). **São o molde da fala do Motor.**
- **`resolverPorNome`** (`core/assistente/resolver.ts`): nome → cliente/serviço/profissional sem IA,
  e **empate pergunta, nunca chuta**. É a filosofia do Motor inteiro.
- Cálculos de negócio em `core/` (valor em risco, lucro, margem, concentração, ociosidade,
  previsão auditada...).

**O Gemini hoje faz só duas coisas:** (1) entender a frase e escolher a ferramenta, (2) escrever a
resposta. São exatamente as duas peças que o Motor substitui.

---

## 2 · Arquitetura — cinco peças, todas funções puras em `core/`

```
pergunta ──► 1 ENTENDER ──► intenção + entidades ──► 2 CONSULTAR (ferramentas existentes)
                 │ (não entendeu / empate)                     │
                 ▼                                             ▼
          sugestões em botão                        3 RACIOCINAR (explicar, simular, priorizar)
                                                               │
                                                               ▼
                                              4 FALAR (templates com regras de honestidade)
                                                               │
                                                               ▼
                                         5 LEMBRAR (contexto curto: "e no mês passado?", "resolve")
```

### 2.1 Entender — intenção e entidades por regra

- **Normalização:** minúsculas, sem acento (`semAcento`), sem pontuação — antes de qualquer regra
  (lição do projeto: `\w` não casa acento).
- **Intenções com vocabulário pesado:** cada intenção tem palavras-chave com peso e sinônimos.
  Ex.: `faturamento` ← faturei, faturamento, entrou, ganhei, vendi, quanto fiz; `sobra` ← sobrou,
  lucro, margem, sobra; `quem_sumiu` ← sumiu, sumiram, parou de vir, não voltou, atrasado;
  `por_que` ← por que, porque, caiu, subiu, diminuiu, piorou; `simular` ← e se, se eu, quanto
  daria, compensa.
- **Pontuação e desempate:** a intenção com maior pontuação acima de um piso vence; **empate ou
  pontuação baixa → pergunta com botões** ("Você quer saber o faturamento ou o que sobrou?") —
  mesma regra do `resolverPorNome`.
- **Entidades por extrator dedicado:** período (hoje, ontem, amanhã, esta semana, semana passada,
  este mês, mês passado, "em agosto", dd/mm), dia da semana, valor em R$ ("R$ 55", "55 reais",
  "10 a mais"), percentual, cliente/serviço/profissional (via `resolverPorNome` contra a base).
- **Gabarito:** um corpus de frases reais → intenção esperada, em teste. Toda frase nova que o motor
  errar vira linha do gabarito antes do conserto — é assim que ele "aprende" sem IA.

### 2.2 Consultar — as ferramentas que já existem

Nada novo aqui na fase 1: a intenção vira a chamada da ferramenta certa com os argumentos extraídos.
Permissão e plano continuam sendo decididos pelo `ferramentasDisponiveisAgora`, e o Motor **só
enxerga as ferramentas que o papel pode usar** — pergunta fora do plano recebe a mesma explicação
de bloqueio que já existe.

### 2.3 Raciocinar — o que faz parecer inteligente

- **Explicar variação ("por que caiu?")** — decomposição exata, não opinião:
  `faturamento = atendimentos × ticket médio`, e `atendimentos = retornos + primeiras visitas`.
  Comparando dois períodos, cada fator recebe a sua parte da diferença (em R$), e a resposta nomeia
  o maior: *"Caiu R$ 1.320 (−12%). O principal: 31 pessoas que costumam voltar nesta época ainda não
  voltaram (−R$ 1.090). O ticket médio ficou igual."* O "costumam voltar" vem do Motor de Ciclo —
  é o que nenhum concorrente consegue dizer.
- **Simular ("e se...?")** — fórmulas com a premissa à mostra (`docs/84` Aposta A): contratar
  (quantos atendimentos a mais para se pagar), abrir um dia a mais (só com demanda registrada),
  mudar preço (a premissa de quantos deixam de vir é do dono, até existir dado agregado).
- **Priorizar ("o que eu faço agora?")** — ordena as ações por R$ × chance, reaproveitando valor em
  risco e a Central de Ações.

### 2.4 Falar — templates com variação controlada

- Cada resposta é um template preenchido com números reais, seguindo as regras de honestidade das
  respostas rápidas.
- Para não soar robótico: 2–4 variações por template, escolhidas de forma **determinística** (pelo
  dia + tenant) — a mesma pergunta no mesmo dia dá a mesma resposta; em dias diferentes, varia.
- Concordância (1 pessoa / 2 pessoas; "A, B e C"), dinheiro em `dinheiro.format`, sem jargão.
- Toda resposta termina com **o próximo passo em botão** quando houver ("Ver a lista", "Chamar
  agora", "Simular outro preço"). É o botão que faz a conversa andar sem digitar.

### 2.5 Lembrar — conversa de verdade, sem estado no servidor

O cliente devolve, junto da nova pergunta, o **contexto da resposta anterior** (intenção +
entidades). O Motor resolve continuações por regra:
- *"e no mês passado?"* → mesma intenção, troca o período;
- *"por quê?"* → intenção `por_que` aplicada ao número anterior;
- *"resolve"* / *"faz isso"* → a ação sugerida na resposta anterior vira proposta com botão.

Nada fica guardado no servidor, e nada disso sai do CICLO.

---

## 3 · Proatividade — o motor fala primeiro

A maior parte do "parece inteligente" não vem de entender frases — vem de **dizer a coisa certa
antes de alguém perguntar**. O resumo da manhã (`docs/84` Aposta B, mapa de vazamento no topo do
"Hoje") é o Motor falando primeiro, com 3–4 achados e um botão em cada. Com isso, a maioria das
pessoas nunca precisa digitar — e quem digita cai no §2.

---

## 4 · Encaixe no código

1. `src/core/inteligencia/` — `entender.ts` (intenções, entidades), `falar.ts` (templates),
   `explicar.ts` (decomposição), `simular.ts` — funções puras, regra 5 do `CLAUDE.md`.
2. `src/server/providers/ai/motor.ts` — `MotorDeConversa implements AiProvider`: no primeiro turno
   devolve a chamada da ferramenta decidida pelo `entender`; no turno seguinte (com o resultado da
   ferramenta no histórico) devolve o texto do `falar`. Fora do domínio → texto com sugestões.
3. `api/v1/assistant/route.ts`: `new GeminiProvider()` → `new MotorDeConversa()`.
4. `admin/layout.tsx` e `health.ts`: o assistente deixa de depender de `GEMINI_API_KEY` — aparece
   sempre que o módulo `assistant` estiver no plano. O `gemini.ts` fica no repositório, desligado,
   até decisão de remover (não é apagado nesta fase).
5. Novas ferramentas quando chegar a vez: `explicar_variacao`, `simular`, `preparar_recuperacao`.

---

## 5 · A limitação honesta — e o que fazer com ela

O Motor **não entende qualquer frase**. Entende o domínio do negócio: agenda, clientes, dinheiro,
recuperação, estoque, orçamento, simulação — a mesma lista de ferramentas. **[HIPÓTESE]** isso
cobre a grande maioria do que o dono pergunta; será medido.

- Pergunta fora do domínio ou não entendida → **nunca inventa**: responde "Ainda não sei responder
  isso. Posso te mostrar..." com os botões mais prováveis.
- **Medir o que não foi entendido:** contar em `product_events` as perguntas sem intenção
  reconhecida (sem gravar o texto, que pode ter nome de cliente — só as palavras que sobraram
  depois de tirar nomes resolvidos). É a lista do que ensinar ao Motor a seguir.

---

## 6 · Tickets, em ordem

| # | Ticket | Entrega |
|---|---|---|
| **MI-1** | `core/inteligencia/entender.ts` + gabarito em teste | intenção e período para as ~9 perguntas das respostas rápidas + as 13 ferramentas |
| **MI-2** | `MotorDeConversa` + trocar o provider na rota + assistente aparece sem chave | o assistente passa a funcionar para todo mundo, sem Gemini |
| **MI-3** | `falar.ts` com variação determinística e botões de próximo passo | respostas naturais |
| **MI-4** | Contexto curto ("e no mês passado?", "por quê?", "resolve") | conversa |
| **MI-5** | `explicar_variacao` (decomposição do faturamento) | "por que caiu?" |
| **MI-6** | `simular` (contratar, dia extra, preço com premissa do dono) | "e se...?" |
| **MI-7** | Contagem do que não foi entendido | o motor sabe o que falta aprender |

Cada ticket: função pura com teste, teste-guarda visto reprovando, `pnpm verify`, commit local.
