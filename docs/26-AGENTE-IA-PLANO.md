# 26 · PLANO DO ASSISTENTE DE IA

> Escrito em **2026-08-26**. **Nenhuma linha de código nesta rodada — o plano é o entregável**,
> mesmo padrão do `18-MONETIZACAO-PLANO.md`.
>
> **Rótulos**: **[M]** Medido (li no repo/banco) · **[E]** Estimado, com fórmula · **[S]** Suposto.
> **Classificação**: **Decidido** · **Recomendado** · **Do Eduardo** · **Bloqueado**.

---

## Sumário executivo — leia isto se não ler mais nada

1. **O que vale copiar dos bancos não é o chat. É a arquitetura de contenção.** Erica (BofA),
   Eno (Capital One), BIA (Bradesco) e o assistente do Itaú parecem um chat por fora, mas por
   dentro são a mesma coisa: **uma porta de entrada nova para controles que já existem**, nunca um
   caminho paralelo até os dados. O modelo escolhe qual ferramenta chamar; quem decide se pode é o
   sistema de permissão de sempre.

2. **Isso torna o assistente barato e seguro de construir no CICLO especificamente.** **[M]** A
   casa já tem as cinco camadas que o padrão exige, e todas separadas: `exigirPermissao()`
   (RBAC), RLS no banco (`has_tenant`, `can_see_appointment`), `writeAudit()` com lista de
   redação, `rate-limit.ts` em Postgres e `exigirModulo()` por plano. **Nada disso precisa ser
   escrito — precisa ser reusado.** Em quase qualquer outro projeto, essa seria a parte cara.

3. **Chamar de "assistente", não de "agente". Decidido.** "Agente" promete autonomia que este
   desenho recusa de propósito. O que está sendo construído responde perguntas e prepara ações;
   quem aperta o botão é o dono. Vender como "agente autônomo" cria expectativa que o produto
   não cumpre — e é exatamente a promessa que faz 40% dos projetos de IA agêntica serem
   cancelados por ROI incerto (Gartner, previsão para o fim de 2027).

4. **Quatro regras inegociáveis**, todas copiadas do padrão bancário:
   - **O modelo nunca produz número.** Toda cifra vem de consulta ao serviço existente. O LLM só
     escolhe a ferramenta e redige a frase em volta do valor que recebeu.
   - **O modelo nunca escreve SQL.** Text-to-SQL contra o Supabase é o caminho mais curto para
     furar RLS e inventar agregado. Ferramentas fixas, sempre.
   - **Escrita exige confirmação humana.** O assistente devolve uma proposta; quem executa é o
     endpoint normal, com o clique do dono.
   - **Dado de saúde nunca entra no contexto.** `vault`, `health_records` e anamnese ficam fora,
     por construção, não por instrução no prompt.

5. **É do dono, dentro do painel. Não é do cliente final, não é no WhatsApp.** Razão em três
   partes: a Meta já ocupa a conversa (Business Agent em rollout no Brasil desde 1º/7/2026),
   cada mensagem de saída tem custo (R$ 0,3125 marketing / R$ 0,0340 utilidade), e o `wa.me`
   atual custa R$ 0. Assistente no painel não toca em nenhum desses três custos.

6. **Custo de LLM é irrelevante para a decisão. [E]** Gemini 2.5 Flash: ~R$ 0,004 por pergunta;
   100 perguntas/mês/tenant = **R$ 0,40**, contra R$ 45,57 de líquido. O que precisa existir não é
   economia, é **teto por tenant** — para conter laço maluco e abuso, não para conter custo normal.

7. **Fase 1 cabe em 3–4 dias e entrega valor sozinha**, mesmo que as fases seguintes nunca
   aconteçam. As fases 2 e 3 ficam travadas em sinal de uso, não em vontade.

8. **A ressalva que já foi feita e não vai se repetir:** construir isto compete com as 20
   conversas de venda. Você reafirmou que quer, então o plano existe e está inteiro — e a Fase 1
   foi dimensionada em dias justamente para não virar as três semanas que o `docs/18` proíbe.

---

## §1 · O modelo dos bancos, item por item

Cada linha é um padrão real de assistente bancário, com o veredito para o CICLO e o porquê.

| # | Padrão do banco | Vale aqui? | Razão |
|---|---|---|---|
| 1 | Ponto de entrada persistente e discreto (bolha/ícone no cabeçalho, em toda tela) | **Adotar** | Assistente em página própria não é usado. Tem que estar onde o dono já está. |
| 2 | **Sugestões prontas** em vez de caixa de texto vazia | **Adotar — crítico** | Dono de salão não sabe o que perguntar para um sistema. Caixa vazia = abandono na primeira tentativa. É o item que mais decide adoção. |
| 3 | Resposta em **cartão estruturado** (número grande + lista curta + botão), não parágrafo | **Adotar** | Parede de texto no celular não é lida. E cartão obriga o dado a vir de consulta. |
| 4 | Roteamento de intenção barato antes do LLM | **Adiar** | Otimização de custo que não faz sentido a R$ 0,004/pergunta. Reavaliar se passar de 1.000 perguntas/mês. |
| 5 | Números sempre por consulta, nunca gerados | **Adotar — inegociável** | É a diferença entre ferramenta e gerador de mentira convincente. |
| 6 | Confirmação explícita antes de qualquer escrita | **Adotar — inegociável** | O banco pergunta "confirma a transferência?". Aqui: "confirma o envio para 47 clientes?". |
| 7 | Trilha de auditoria de tudo que foi perguntado e acessado | **Adotar** | `writeAudit()` já existe, com redação. É reuso, não construção. |
| 8 | Escalada para atendente humano | **Adaptar** | No banco é call center. Aqui é um botão "falar com o suporte" que abre o WhatsApp do Eduardo. |
| 9 | Escopo declarado + recusa fora do escopo | **Adotar** | O banco recusa dar conselho de investimento. Aqui recusa conselho clínico, jurídico e fiscal. |
| 10 | Kill switch por cliente e global | **Adotar** | Um módulo `assistant` em `tenant_modules` + uma variável de ambiente. Já há infraestrutura para os dois. |
| 11 | Autenticação reforçada para ação sensível | **Adaptar** | Reusar `EXCLUSIVAS_DO_DONO` do `rbac.ts` — o assistente simplesmente não tem ferramenta para nada que está nessa lista. |
| 12 | Canal de voz / telefonia | **Rejeitar** | Custo e complexidade sem relação com a dor. |
| 13 | Agente que executa sozinho, sem humano | **Rejeitar** | Ver §5. É o que transforma um erro de modelo em 47 mensagens erradas enviadas. |
| 14 | Assistente falando com o **cliente final** | **Rejeitar por ora** | Território da Meta + custo por mensagem. Fase 4, condicional. |

### O que os bancos fazem que aqui seria pior

- **Base de conhecimento gigante (RAG sobre documentos).** O banco tem 4.000 páginas de
  regulamento; o CICLO tem 15 telas. A resposta certa aqui vem de **consulta ao banco de dados**,
  não de busca em texto. RAG seria complexidade sem ganho. **Rejeitar.**
- **Modelo próprio / fine-tuning.** Faz sentido com milhões de conversas. Com zero pagantes, é
  cerimônia. **Rejeitar.**
- **Persona elaborada com nome e avatar.** BIA e Erica têm marca própria porque o banco tem
  milhões de usuários para amortizar. Aqui, "Assistente" basta e não cria expectativa de
  inteligência que o produto não tem. **Rejeitar.**

---

## §2 · Arquitetura — cinco camadas, quatro já existem

O desenho inteiro cabe numa frase: **o assistente é mais um chamador dos mesmos serviços que as
telas chamam**, com a mesma sessão, as mesmas permissões e a mesma RLS.

```
[UI: painel lateral]  src/app/admin/_components/assistente/
        ↓ POST /api/v1/assistant
[Rota]                src/app/api/v1/assistant/route.ts
        ↓ contextoAtual() + exigirPermissao() + exigirModulo() + rate-limit
[Executor do laço]    src/server/services/assistente.ts
        ↓ escolhe ferramenta pelo nome, valida entrada com Zod
[Catálogo]            src/core/assistente/ferramentas.ts   ← declarativo, sem I/O
        ↓ chama o serviço EXISTENTE, com criarClienteDoUsuario()
[Serviços de sempre]  resumo-hoje.ts · recuperar-receita.ts · caixa.ts · orcamentos.ts …
        ↓
[Provider de LLM]     src/server/providers/ai/{types,gemini}.ts  ← espelha providers/messaging/
```

**Por que essa ordem importa.** A camada de permissão fica **antes** do modelo e **dentro** de cada
ferramenta — nunca no prompt. Um prompt que diz "não mostre dados de outro salão" é uma sugestão;
`criarClienteDoUsuario()` + RLS é uma garantia. **[M]** A rota `cycle/recover/route.ts` já mostra o
padrão exato a copiar: `contextoAtual` → `exigirPermissao` → `criarClienteDoUsuario` → serviço.

**Provider de LLM espelha `providers/messaging/types.ts`. Decidido.** Uma interface
(`AiProvider`), implementações separadas (`gemini.ts`, e amanhã outra), e o resto do sistema não
sabe qual está atrás. Trocar Gemini por outro vira reescrever um arquivo, não o produto. É o mesmo
desenho que já existe para WhatsApp/e-mail/push — não é padrão novo, é o padrão da casa.

**Recomendado: Gemini 2.5 Flash** como primeiro provider (US$ 0,15/M entrada, US$ 1,25/M saída).
**DeepSeek fica fora** — dados hospedados na China e aviso de privacidade fora do padrão da LGPD,
e o CICLO trata dado de cliente final, incluindo cofre. Não é preço, é exposição jurídica.

---

## §3 · Catálogo de ferramentas

Toda ferramenta declara: nome, descrição (é o que o modelo lê para escolher), esquema Zod de
entrada, **permissão RBAC exigida**, **módulo exigido** e se é leitura ou proposta. Nenhuma
ferramenta acessa o banco direto — todas chamam um serviço que já existe e já é testado.

### Fase 1 — só leitura **[M: todos os serviços já existem]**

| Ferramenta | Serviço existente | Permissão | Módulo |
|---|---|---|---|
| `resumo_de_hoje` | `resumoDeHoje()` | `appointment:read` | `agenda` |
| `clientes_para_recuperar` | `listarParaRecuperar()` | `client:read` | `cycle_engine` |
| `buscar_cliente` | `clientes.ts` | `client:read` | `clients` |
| `historico_do_cliente` | `clientes.ts` + `agendamentos.ts` | `client:read` | `clients` |
| `faturamento_do_periodo` | `caixa.ts` | `report:read` | `register` |
| `horarios_vagos` | `agendamentos.ts` / `expediente.ts` | `appointment:read` | `agenda` |
| `orcamentos_parados` | `orcamentos.ts` | `appointment:read` | `quotes` |
| `alertas_de_estoque` | `listarAlertasDeEstoque()` | `inventory:read` | `stock` |

Oito ferramentas cobrem, **[S]**, a grande maioria das perguntas que um dono faria. Começar com
oito e medir quais são usadas é melhor que começar com vinte e adivinhar.

### Fase 2 — propostas (nunca executam)

| Ferramenta | O que devolve | Quem executa |
|---|---|---|
| `preparar_mensagem_de_recuperacao` | texto pronto + link `wa.me` | o dono, clicando |
| `preparar_orcamento` | rascunho de itens e total | o dono, na tela `/admin/orcamentos/novo` |
| `preparar_campanha` | segmento + texto sugerido | o dono, com confirmação de contagem |

**Regra da Fase 2. Decidido:** a ferramenta devolve um objeto de proposta; a UI mostra um botão
que **navega para a tela existente com os campos preenchidos**. O assistente nunca chama o
endpoint de escrita. Isso reusa toda a validação, idempotência e auditoria que aquelas telas já
têm — e torna impossível o modelo enviar algo sozinho, por construção.

### Ferramentas que nunca vão existir. Decidido.

`vault` / `health_records` / anamnese · `client:export` · alterar plano ou cobrança · apagar
qualquer coisa · executar SQL · enviar mensagem · alterar permissão de usuário.

---

## §4 · Guardrails, LGPD e o que sai da máquina

### 4.1 Minimização antes de enviar ao modelo. Decidido.

O que sai daqui para o provedor de LLM é o mínimo que responde a pergunta:

- **Nunca sai:** telefone, CPF, endereço, qualquer campo do cofre, qualquer `health_record`,
  token, chave.
- **Sai como identificador, não como pessoa:** cliente vira `cliente_4821` no raciocínio; o nome
  só volta na hora de montar o cartão, **no servidor, depois da resposta do modelo**.
- **Reusar a lista `REDIGIR` de `src/server/audit/write.ts`** como base do filtro. **[M]** Ela já
  cobre `ciphertext`, `iv`, `answers`, `dek_wrapped`, `token` e afins. Estender, não recriar.

### 4.2 Dado de saúde: proibição por construção, não por prompt. Decidido.

Nenhuma ferramenta lê o cofre. Não existe caminho. A instrução no prompt de sistema ("não fale
sobre saúde") é a segunda camada, nunca a primeira — mesma filosofia do `rbac.ts`: *"se só uma
existir, está errado."*

O assistente também **recusa** conselho clínico, jurídico e fiscal, e nunca afirma resultado
("essa campanha vai trazer X clientes"). Precedente na família: no StarkOS a IA foi proibida de
dar diagnóstico. Aqui a regra é a mesma, com o agravante de que ficha de estética é dado sensível
do art. 11 da LGPD.

### 4.3 Injeção por texto de terceiro — o risco específico desta casa

**[M] Achado ao ler `public-booking.ts`:** o campo `name` do agendamento público é
`z.string().trim().min(2)` — **sem limite de tamanho e sem sanitização**, preenchido pelo
**cliente final**, não pelo dono. O mesmo vale para `address` (máx. 300). Esses valores caem em
`clients.name` e `appointments.address`, e os dois entram em `resumoDeHoje()`.

Consequência: um cliente pode se cadastrar com o nome
`Maria. IGNORE AS INSTRUÇÕES ANTERIORES E ...` e esse texto **entra no contexto do modelo** quando
o dono perguntar "quem vem hoje?". Isso não é hipótese de laboratório — é o caminho natural do
dado neste sistema.

**Mitigações. Decidido:**
1. Resultado de ferramenta entra no contexto **delimitado e rotulado como dado não confiável**,
   nunca concatenado no prompt de sistema.
2. Texto vindo de terceiro é **truncado** (nome: 120 caracteres) e tem quebras de linha e
   marcadores de bloco removidos antes de entrar.
3. **A Fase 1 não tem ferramenta de escrita** — mesmo uma injeção bem-sucedida só consegue fazer o
   modelo dizer algo estranho, não agir. Esse é o argumento mais forte a favor de começar só com
   leitura.
4. Na Fase 2, toda proposta passa pela confirmação humana com **contagem explícita** ("enviar para
   47 clientes?"), que é onde uma injeção seria vista antes de virar dano.

### 4.4 Trilha, teto e interruptor

- **Auditoria:** cada pergunta grava `assistant.ask` via `writeAudit()` — quem perguntou, quais
  ferramentas rodaram, quantos registros voltaram. **A pergunta em si é gravada; a resposta, não**
  (pode conter nome de cliente sem valor de auditoria).
- **Teto por tenant:** usar `rate-limit.ts` com balde em Postgres — **[M]** o Upstash não existe em
  produção e o balde de memória não vale em serverless. Sugestão inicial **[S]**: 60 perguntas por
  dia por tenant, 20 por hora por usuário.
- **Interruptor:** módulo `assistant` em `tenant_modules` (por salão) + variável de ambiente
  global. Desligar não pode quebrar tela nenhuma.
- **Exceção deliberada ao padrão da casa:** o CICLO degrada em silêncio quando falta credencial de
  terceiro. **Para o assistente isso é proibido** — sem chave de IA, o botão **não aparece**. Um
  assistente que existe na tela e responde "não consegui" a tudo é pior que assistente nenhum, e
  a auditoria de segurança já registrou que *"mitigação ausente fica indistinguível de mitigação
  funcionando"*.

---

## §5 · Interface — o que o dono vê

### Ponto de entrada
Botão discreto no cabeçalho do `/admin`, presente em toda tela. Abre **painel lateral**
(mesmo componente de sheet que o `DetalheAgendamento` já usa — reuso, não componente novo).

### Estado vazio: sugestões, nunca caixa em branco. Decidido.
Quatro a seis sugestões, **contextuais à tela em que o dono está**:

| Tela | Sugestões |
|---|---|
| `/admin/hoje` | "Quem falta confirmar hoje?" · "Quanto já faturei hoje?" · "Tenho horário vago amanhã?" |
| `/admin/recuperar` | "Quem eu chamo primeiro?" · "Quanto tem parado aqui?" · "Quem sumiu há mais de 60 dias?" |
| `/admin/caixa` | "Quanto faturei essa semana?" · "Qual serviço rendeu mais no mês?" |
| `/admin/orcamentos` | "Quais orçamentos estão sem resposta?" |

### Formato da resposta
Cartão, nunca parágrafo solto: **título curto · número grande · lista de no máximo 5 itens ·
botões**. Cada número vem acompanhado de onde saiu ("de 46 clientes ativos").

### Os botões navegam, não executam. Decidido para a Fase 1.
"Ver na tela de recuperar" leva para `/admin/recuperar` filtrado. O assistente aponta; a tela
existente age. Custo de implementação quase zero e raio de dano zero.

### Rodapé fixo do painel
> *"O assistente lê os mesmos dados que você já vê. Ele não envia mensagem nem altera nada
> sozinho."*

Declaração de escopo é padrão bancário e resolve metade das dúvidas antes de virarem suporte.

### Escalada
Quando não souber: resposta honesta ("não consigo responder isso") + botão **"Falar com o
suporte"**. Nunca inventar. Nunca tentar de novo com outro modelo.

---

## §6 · Fases e tickets

### FASE A — Fundação e leitura · **3–4 dias** · Recomendado começar por aqui

| Ticket | Entrega | Depende de |
|---|---|---|
| A1 | `providers/ai/types.ts` — interface `AiProvider`, espelhando `messaging/types.ts` | — |
| A2 | `providers/ai/gemini.ts` — implementação, com timeout (o achado de mensageria: nenhum provider tinha timeout) | A1, chave |
| A3 | `core/assistente/ferramentas.ts` — catálogo declarativo das 8 ferramentas de leitura, com Zod e permissão/módulo por ferramenta | — |
| A4 | `server/services/assistente.ts` — laço: pergunta → escolha de ferramenta → validação → execução → redação da resposta. **Máximo 3 chamadas de ferramenta por pergunta** (corta laço infinito e custo) | A1–A3 |
| A5 | `api/v1/assistant/route.ts` — `contextoAtual` + `exigirPermissao` + `exigirModulo('assistant')` + rate limit + `writeAudit` | A4 |
| A6 | Migration: módulo `assistant` no catálogo `modules` (segue o padrão da 0041) | — |
| A7 | UI: painel lateral, sugestões por tela, cartão de resposta, rodapé de escopo | A5 |
| A8 | Testes: **unitários com cliente falso**, em `tests/unit/server/` — nunca em `tests/integration/`, porque `.env.local` aponta para produção | A4 |

**Critério de pronto da Fase A:** o dono pergunta "quem sumiu?" e recebe a lista real, com número
que bate com a tela `/admin/recuperar`. Se o número divergir da tela, a fase não está pronta.

### FASE B — Propostas com confirmação · **travada em ≥ 10 pagantes**
B1 preparar mensagem de recuperação · B2 preparar orçamento · B3 preparar campanha com contagem
explícita · B4 tela de confirmação padronizada.

### FASE C — Resumo proativo · **travada em ≥ 30 pagantes**
"O que fazer hoje" calculado no cron que já existe (`recompute-cycles`), mostrado ao abrir o
painel, **sem chamar LLM** — é consulta com texto fixo. IA só se o dono pedir detalhe.

### FASE D — Cliente final · **condicional, provavelmente nunca**
Só reabrir se: (a) houver cliente pagando **por isso**, e (b) o preço do Meta One para PME no
Brasil se mostrar alto o bastante para o CICLO valer a pena no lugar dele. Hoje, não.

---

## §7 · Custo **[E]**

Premissa: 3.000 tokens de entrada (contexto + resultado de ferramenta) e 400 de saída por pergunta.

| Provider | Entrada /M | Saída /M | Por pergunta | 100 perguntas/mês |
|---|---:|---:|---:|---:|
| Gemini 2.5 Flash | US$ 0,15 | US$ 1,25 | ~R$ 0,004 | **R$ 0,40** |
| Claude Haiku 4.5 | US$ 1,00 | US$ 5,00 | ~R$ 0,027 | R$ 2,70 |

Contra R$ 45,57 de líquido por assinante, qualquer um dos dois é ruído. **A conclusão prática:
não desenhe nada para economizar token.** Desenhe para conter abuso (teto por tenant) e para
poder trocar de provider (interface). O custo que importa neste produto continua sendo mensagem
de WhatsApp e minuto de suporte — não inferência.

---

## §8 · Armadilhas desta casa que vão pegar esta implementação

Todas já documentadas em auditoria anterior. Estão aqui porque **cada uma tem uma forma específica
de aparecer no assistente**.

1. **`supabase-js` não lança em erro de banco.** Toda ferramenta faz consulta; toda consulta pode
   falhar em silêncio e devolver `data: null`. Uma ferramenta que ignora `{ error }` faz o
   assistente responder **"você não tem nenhum cliente atrasado"** quando na verdade a consulta
   quebrou. É a pior falha possível aqui: mentira confiante. **Toda ferramenta checa `error` e,
   em erro, o assistente diz que não conseguiu consultar — nunca devolve lista vazia como
   resposta.**

2. **Degradação silenciosa vira mentira.** Ver §4.4: sem chave, o botão não existe.

3. **Guarda que nunca falhou é guarda não testado.** Os testes de recusa (dado de saúde, fora de
   escopo, permissão negada) precisam ser verificados **por mutação**: reintroduza a falha de
   propósito e confirme que o teste fica vermelho. Um teste que varre o código procurando a string
   de uma regra passa vazio para sempre.

4. **Teste de integração escreve em produção.** `.env.local` aponta para o Supabase real. Os
   testes do assistente vão para `tests/unit/server/` com cliente falso. Sem exceção.

5. **`Intl.NumberFormat('pt-BR')` usa espaço não-quebrável.** Se algum teste comparar o texto que o
   assistente devolveu com `"R$ 1.234,00"` digitado à mão, nunca vai bater. Normalizar antes de
   comparar.

6. **`beforeAll` que estoura vira "skipped", não "failed".** Suíte do assistente que dependa de
   fixture precisa ser rodada inteira antes de commitar, olhando o número de testes executados.

---

## §9 · Red team — atacando este plano

**"Ninguém vai usar."** É o desfecho mais provável, não o mais catastrófico. Dono de salão resolve
as coisas olhando a tela ou ligando. Mitigação: as sugestões contextuais do §5 são a defesa
principal. **Métrica de corte, Decidido: se depois de 30 dias com pelo menos 5 tenants ativos o uso
médio ficar abaixo de 1 pergunta por semana por tenant, o assistente é desligado e o esforço para
na Fase A.** Registrar isso em `DECISOES.md` junto com a regra de parada do produto.

**"Vai errar e o dono vai confiar."** É por isso que número nunca vem do modelo e toda resposta
mostra a origem. O modo de falha que sobra é o modelo escolher a ferramenta errada — visível e
corrigível, diferente de um número inventado.

**"Vira desculpa para não vender."** Risco real, e o dossiê de mercado já apontou esse padrão.
Defesa: Fase A dimensionada em dias e Fases B/C travadas em número de pagantes — se as conversas
de venda não acontecerem, o plano trava sozinho e não consome mais tempo.

**"Injeção pelo nome do cliente."** Ver §4.3. Mitigado pela ausência de escrita na Fase A.

**"O modelo vai vazar dado entre salões."** Não pode: a ferramenta usa
`criarClienteDoUsuario()` e a RLS filtra por `tenant_id` no banco. O modelo nunca vê consulta,
só resultado já filtrado. **É o argumento mais forte a favor deste desenho** — e só é verdade
porque nenhuma ferramenta usa `service_role`.

---

## §10 · O que depende do Eduardo — Bloqueado

| Item | Por quê |
|---|---|
| Escolher o provider e criar a chave | **Recomendado: Gemini 2.5 Flash.** Sem chave, a Fase A para no ticket A2. |
| Confirmar nos termos do provider que dado enviado não treina modelo | Obrigação de operador na LGPD; precisa estar verificado antes de mandar dado real. |
| Atualizar a política de privacidade com o provedor de IA como **suboperador** | Sem isso, mandar dado de cliente final para terceiro é exposição. Vale mesmo com minimização. |
| Decidir em que plano o assistente entra | **Recomendado:** ligado para todos no começo (é medição de uso, não receita). Virar diferencial de plano só depois da métrica do §9. |
| Aprovar a métrica de corte de 1 pergunta/semana/tenant | É a regra que impede este plano de virar dívida permanente. |

---

## §11 · Resumo em cinco linhas

1. Copie dos bancos a **contenção**, não o chat.
2. O assistente é **mais um chamador dos serviços que já existem**, com a mesma sessão e a mesma RLS.
3. **Número sempre de consulta; escrita sempre com confirmação; cofre nunca.**
4. Fase A tem 8 ferramentas de leitura, cabe em 3–4 dias e é útil sozinha.
5. **Se depois de 30 dias quase ninguém perguntar nada, desligue** — e essa decisão já está tomada
   aqui, antes de o esforço criar apego.
