# 99 · Plano-mestre do ecossistema CICLO: tudo o que faz o sistema rodar, vender, cobrar e aprender

Escrito em 2026-10-07 pelo Claude (Sonnet 5.5) a pedido do Eduardo. **É só plano: nenhuma linha de
código deste documento foi escrita.** O destino é outra conta do Claude, que vai **estruturar o
backlog inteiro e executar** usando todo o seu poder. Por isso o documento é autossuficiente:
traz o estado real, as regras, as decisões já tomadas, o que está verificado e o que não está.

Documentos irmãos (leia nesta ordem): `docs/97` (esteira de dados), `docs/98` (revisão do Motor e do
ecossistema), `docs/26` (assistente de IA: **as regras de agente já decididas**), `docs/87` (cortesia),
`docs/88` e `docs/89` (custos e metas), `docs/95` e `docs/96` (fila de chamadas), `docs/86` (jurídico).

**Rótulos usados** (os mesmos de `docs/26`): **[M]** medido ou lido no repositório · **[E]** estimado
com conta · **[S]** suposto ou de fonte externa não conferida. Classes de decisão: **Decidido**,
**Recomendado**, **Do Eduardo**, **Do advogado**, **Bloqueado**.

---

## 0. Como a outra conta deve usar este documento

1. Leia `CLAUDE.md`, `docs/00-BRIEFING.md` e os documentos irmãos acima. **Não execute nada antes.**
2. Crie `docs/100-BACKLOG-MESTRE.md` no formato de `docs/96`: um ticket por item, com id, trilha,
   dependências, critério de aceite verificável, como se prova (teste, mutação, navegador a 390 px) e
   a classe de decisão. **A estrutura do backlog é o primeiro entregável**, e passa por revisão do
   Eduardo antes de qualquer código.
3. Rode as trilhas **em paralelo, cada uma em worktree e branch próprios** (seção 12). O caminho
   crítico está na seção 11.
4. Atualize este documento quando uma decisão mudar. Plano que diverge do código é o defeito mais
   caro deste projeto.

## 1. A tese em cinco linhas

1. O CICLO **não é uma agenda**. É um **motor de retorno de clientes**, e agenda é só o chão.
2. O mercado de salão é dominado por agenda e reserva; **retenção automática é o elo fraco de todos**
   (seção 3). O espaço está pouco ocupado.
3. O motor só é bom se **come qualquer dado** (`docs/97`), **prova que acerta** (`docs/98`) e
   **fecha a volta**: entra o dado, prevê, alguém age, mede, aprende, e o dono pode sair levando tudo.
4. **Agentes de IA entram onde reduzem trabalho do dono sem decidir por ele** (seção 6): quem aperta
   o botão é sempre uma pessoa. A decisão de `docs/26` continua de pé.
5. Tudo isso só vale se **cobrar for simples, confiar for possível e operar for barato** (seções 5, 8
   e 9).

## 2. O estado real (verificado em 2026-10-07)

**No ar na `main`** [M]: Motor de Ciclo v1, fila de chamadas (um cliente por vez, WhatsApp do dono,
link de agendamento com clique medido), perfil e nota do cliente, importação de CSV, exportação de
clientes em CSV, assistente de IA (Gemini, desligado sem a chave), mensageria e entrada de WhatsApp,
push, crons de lembrete, campanhas, segmentos e recálculo de ciclos, cobrança por Mercado Pago
(assinatura com cartão, webhook, cancelamento).

**Em PRs abertos, nada fundido** [M]:
- **#143** (`feat/cortesia-2026-10-03`): cortesia e faixa, pausa que trava toda rota de escrita,
  link público de negócio pausado, cancelar mantendo o mês pago, **`ACESSO_ABERTO` ligado** (toda
  conta usa tudo, sem pagar), documentos 97, 98 e 99.
- **#144** (`feat/juridico-2026-10-03`): inventário de dados, mapa de operadores, política de
  privacidade gerada do código, aviso na página pública, reaceite dos termos, minutas jurídicas
  (não estão no ar).
- **#142** (outra conta): textos de volta por perfil.
- Ao fundir #143 e #144: a rota nova `POST v1/legal/accept` precisa de uma linha `'permite'` em
  `core/billing/pausa.ts`, e há conflito de uma linha em `tests/unit/core/versoes-legais.test.ts`.

**Não existe ainda** [M]: esteira de dados; retroteste; backoffice interno; integração de cobrança
automática em produção (credencial do Mercado Pago ausente); e-mails de aviso (C6); eliminação após
90 dias de pausa (C9); RIPD; runbook de incidente.

**Datas anteriores** (de `docs/87`, hoje afetadas pelo acesso aberto): alpha 26/10, abertura pública
09/11, lançamento oficial 11/01/2027. **Reconfirmar com o Eduardo**: com tudo liberado sem prazo, o
conceito de "pré-lançamento com data" mudou.

**Regra de trabalho em conflito [Do Eduardo]:** nesta conversa a regra era **nunca escrever em
produção, nunca fundir, nunca fazer deploy nem `db push` sem pedido**. O `docs/96` (outra conta)
descreve CI verde, auto-merge e migrations aplicadas em produção antes do código. **A outra conta deve
perguntar ao Eduardo qual regra vale antes de tocar em produção.**

## 3. O mercado (pesquisado hoje; **nenhum produto foi testado**)

**Agenda e reserva** (Fresha, Booksy, Vagaro, Mangomint): fortes em reserva, mas os comparativos
dizem que a **retenção automatizada fica fraca ou exige camada de fora** [S]. **Phorest** aparece como
o voltado a retenção (campanhas de retorno, fidelidade, reputação) [S]. Brasil: Trinks, Avec, AppBarber,
Salão99, Belle, Simples Agenda, Belasis, Actana: **não há documentação pública** achada sobre
exportação e importação, com duas exceções: AppBarber exporta **pelo chat do suporte**, e Belasis,
Actana e Zenamu **fazem a migração por você, de graça, como parte da venda** [S].

**Importadores de dados** (Flatfile, OneSchema, Dromo, CSVBox, Ingestro): genéricos, embutidos em outro
produto, **nenhum conhece o destino**. Só o Dromo processa no navegador (como opção paga) [S].

**Recepcionista de IA para salão** (Velora, Wello, Ada e outros, no WhatsApp e no Instagram): o
produto virou **commodity** em 2026, com muitos entrantes [S]. Cuidado com os números de "no-show
cai e ocupação sobe 20 a 30%": vêm de blogs de fornecedor [S], **não usar**.

**Regra do WhatsApp (Meta), vigente em 2026** [S, de várias reportagens, **conferir o texto oficial**]:
a API de negócios **proíbe chatbots de IA de uso geral** (a partir de 15/01/2026 para todos), mas
**permite IA como parte de um serviço do negócio**: reserva, suporte, avisos, acompanhamento de
pedido. A IA **não pode ser a funcionalidade principal**. Isso favorece o desenho do CICLO (agendar
e recuperar são fins do negócio), mas **proíbe vender "um ChatGPT no WhatsApp do salão"**.

**Cobrança no Brasil:** seção 5.

**Lacunas desta pesquisa [fazer]:** (a) preços e funcionalidades reais dos concorrentes brasileiros
(pedir print a salões que os usam); (b) texto oficial da política do WhatsApp Business; (c) parceiros
de distribuição (contadores, fornecedores de produtos, sindicatos e associações de salão, escolas de
beleza), que **não foram pesquisados**; (d) o que o Instagram e o Google Meu Negócio permitem
integrar.

## 4. O ecossistema: dez trilhas, uma volta

```
 CAPTAR → ATIVAR → ENTRAR DADO → PREVER → AGIR → MEDIR → APRENDER → COBRAR/RETER → SAIR LEVANDO
   (A)     (A)        (B)          (C)     (D)     (E)      (C,E)        (F)           (B,I)
              + (G) agentes em volta de cada elo   + (H) confiança   + (J) operação   + (K) método
```

| Trilha | Faz o quê | Estado | Doc |
|---|---|---|---|
| **A** Captação e ativação | landing, calculadora, indicação, prospecção, onboarding, alpha | landing e calculadora existem; onboarding existe | `docs/82`, `docs/83` |
| **B** Entrada e saída de dados | esteira de qualquer arquivo; exportação completa | plano pronto, **nada construído** | `docs/97` |
| **C** Motor | previsão, valor em risco, backtest, v2 | v1 no ar; revisão pronta | `docs/98` |
| **D** Ação | fila de chamadas, texto, link, mensageria | no ar; textos por perfil em #142 | `docs/95`, `docs/96` |
| **E** Medição e prova | atribuição, calibração, **retroteste**, placar do dono | parcial | `docs/98` §5 |
| **F** Cobrança e planos | provedor, Pix, cobrança manual, dunning, notas | **decisão aberta** (seção 5) | `docs/87`, `docs/88` |
| **G** Agentes | assistentes que preparam, humano aprova | assistente base no ar; catálogo na seção 6 | `docs/26` |
| **H** Confiança e conformidade | LGPD, termos, política, retenção, incidente | #144 aberto, sem revisão humana | `docs/86` |
| **J** Plataforma e operação | infra, custos, vigias, backoffice | vigias existem; **backoffice não existe** | `docs/88` |
| **K** Método de engenharia | testes, mutação, modo sombra, experimentos | forte; some o que está na seção 10 | `CLAUDE.md` |

(A trilha **I**, plataforma, está dentro de **J**; mantive a letra para não renumerar os documentos
anteriores.)

## 5. Trilha F: cobrança e planos (a pesquisa nova: Asaas e o Pix Automático)

**O que foi lido hoje** (documentação e página de preços do Asaas; **conferir no cadastro**, porque
uma das leituras da tabela de cartão veio ambígua):
- A **API cobra Pix, boleto e cartão**, avulso, parcelado ou **recorrente** (`POST /v3/subscriptions`
  gera uma cobrança a cada ciclo; cada cobrança tem id e status próprios). **Webhook** a cada mudança de
  status. Sandbox gratuito [S, resumo de terceiros].
- **Pix Automático** (Banco Central, desde **16/06/2025**): o pagador autoriza **uma vez** (QR Code) e
  as cobranças seguintes saem sem nova confirmação, como um débito automático. No Asaas há dois modos:
  `MANUAL` (o nosso sistema cria cada cobrança) e `SUBSCRIPTION` (a plataforma gera sozinha).
  Há política de **retentativas** configurável.
- **Taxas lidas** [S]: sem mensalidade nem taxa de adesão; **Pix R$ 1,99 por cobrança recebida**
  (promocional de R$ 0,99 nos 3 primeiros meses); boleto igual; **cartão à vista 1,99% + R$ 0,49**.
  O Mercado Pago, segundo `docs/88`, cobra **0,99% no Pix** [S, também não confirmado], e a taxa do
  cartão recorrente do MP **não foi confirmada**.

**Conta que importa (taxa efetiva, sobre cada pagamento):**

| Ticket | Asaas Pix (R$ 1,99) | MP Pix (0,99%) | Asaas cartão (1,99% + R$ 0,49) |
|---|---|---|---|
| R$ 49 (Essencial, mensal) | **4,1%** | 1,0% | 3,0% |
| R$ 99 (Equipe, mensal) | 2,0% | 1,0% | 2,5% |
| R$ 497 (anual à vista) | **0,4%** | 1,0% | 2,1% |

**Leitura [E]:** taxa fixa por cobrança pesa em **ticket pequeno** e some em **ticket grande**. O ponto
de virada entre Asaas Pix e MP Pix é perto de **R$ 200**. Duas consequências: (1) o **plano anual à
vista** é barato de cobrar em qualquer provedor e **elimina a cobrança mensal manual**; (2) o Essencial
mensal no Asaas Pix é o pior caso. Isso reforça o preço-âncora de **R$ 497 por ano** para fundadores.

**Recomendação** (**Do Eduardo** decidir), em ordem:
1. **Alpha:** cobrança **por fora** (Pix anual à vista, manual) **mais uma tela de backoffice** para
   marcar a conta paga (seção 9). Zero integração, zero taxa de plataforma, zero risco.
2. **Abstração antes de escolher provedor:** uma interface `ProvedorDeCobranca` em `core/billing`
   (criar assinatura, cancelar, ler situação, próxima data de vencimento, webhook) com **adaptadores
   intercambiáveis**: `Manual`, `MercadoPago` (o código atual) e `Asaas`. Testes com um provedor falso.
   **Por quê:** o plano atual está preso ao vocabulário do Mercado Pago (`preapproval`, `authorized`,
   `paused`, `cancelled`), e já tivemos que consertar semântica de cancelamento. Trocar de provedor
   não pode exigir mexer em regra de negócio.
3. **Recorrente real:** avaliar **Asaas com Pix Automático** para o mensal (quem não usa cartão
   assina uma vez e esquece, que é o jeito de **reduzir inadimplência por esquecimento**), e cartão
   como alternativa. Conferir antes: exigência de CNPJ ou pessoa física, MEI (**o CICLO precisa
   resolver o enquadramento fiscal: `docs/89`**), prazo de repasse, chargeback, e se o Pix Automático
   está liberado para a conta do Eduardo.
4. **Semântica que o adaptador novo precisa respeitar** (já consertada no #143): **cancelar não corta
   o mês pago** (`acesso_ate`), e quem cai para o plano mais baixo com cortesia vencida **fica pausada**.
5. **Régua de cobrança (dunning), sem IA:** aviso antes do vencimento, link de pagamento, retentativa,
   aviso de pausa. Determinística, com **e-mail transacional** (C6 do `docs/86`), pela fila de jobs e
   **não pelo cron do GitHub** (que atrasa horas).

**Pendências de decisão [Do Eduardo]:** manter ou aposentar o código do Mercado Pago; o
enquadramento fiscal (CNPJ, nota fiscal, Simples); preço final (R$ 497 por ano e R$ 49 por mês são
propostas, **R$ 497 por ano dá R$ 41,40 por mês, abaixo do Essencial de R$ 49**, e isso precisa ser
dito como desconto de fundador).

## 6. Trilha G: onde agentes se encaixam

**A decisão que já existe e continua valendo (`docs/26`):** chamar de **assistente**, não de agente
autônomo. Quatro regras inegociáveis, **estendidas aqui a todo agente**:

1. **O modelo nunca produz número.** Toda cifra vem de uma consulta ao serviço existente.
2. **O modelo nunca escreve SQL.** Ferramentas fixas, sempre.
3. **Escrita exige confirmação humana** (o assistente propõe; o endpoint normal executa com o clique).
4. **Dado de saúde nunca entra no contexto**, por construção e não por instrução de prompt.

**Regras acrescentadas por este plano:**
5. **Escada de autonomia.** L0 informa; **L1 propõe e a pessoa aprova (teto para tudo que toca cliente
   final ou dinheiro)**; L2 executa ação **reversível e de baixo risco**, avisa e deixa desfazer;
   L3 autônomo: **proibido**, exceto operação interna somente de leitura.
6. **Cada agente tem a lista fechada de ferramentas** e um **teste de contrato** que reprova ferramenta
   nova sem decisão registrada.
7. **IA no aparelho primeiro; de terceiros só com parecer jurídico** (`docs/97` §7). A política
   atual diz que dado de cliente não vai a provedor de IA externo.
8. **Teto de custo por conta e chave de desligamento** (flag) por agente.
9. **Avaliação antes de soltar:** conjunto de conversas e casos com gabarito; o agente que erra o
   gabarito não sai. Mutação vale: se o teste passa com o agente quebrado, o teste é cego.
10. **Registro do que o agente fez**, visível ao dono ("o que o assistente fez hoje"), com redação de
    dado pessoal.
11. **Política do WhatsApp:** o agente é sempre **uma função do negócio** (agendar, recuperar,
    confirmar), nunca conversa aberta.

**Catálogo, em ordem de valor e de baixo risco:**

| # | Agente | Para quem | O que faz | Autonomia | IA | Trava | Onda |
|---|---|---|---|---|---|---|---|
| G1 | **Importação** | dono, no primeiro uso | guia a esteira: explica o que entendeu, pergunta o mínimo, diz o que falta para subir o nível, escreve o pedido ao sistema antigo | L1 | **regras** e, se o dono ligar, modelo no aparelho | só vê o que o dono subiu; nada vai para fora | com a esteira |
| G2 | **Retorno** | dono, todo dia | monta a fila de chamadas, escolhe o texto pelo perfil, explica o porquê ("vem a cada 28 dias, faz 41"), propõe a ordem | **L1** (o dono toca em Chamar) | texto por regras; explicação por regras | WhatsApp **manual do dono**: sem API, sem disparo | com o Motor v2 |
| G3 | **Operações** (interno) | Eduardo | vigia crons, fila, cobrança, taxa de erro, importações que travaram; abre alerta com a causa | L0 e L1 (relatório) | regras e consultas fixas | **somente leitura** em produção | cedo |
| G4 | **Onboarding** | dono novo | leva do cadastro ao primeiro valor em menos de 15 minutos: serviços, horário, importar, ver o ouro | L1 | regras | não grava sem o toque | cedo |
| G5 | **Cobrança** | dono pagante | régua de aviso, link de pagamento, pausa | L2 (e-mail transacional) | **nenhuma** | só e-mail de conta; texto fixo e revisado | com a trilha F |
| G6 | **Qualidade de dados** | dono | acha duplicados e telefones ruins depois da importação, propõe corrigir | L1 | regras (pontuação por campo, `docs/97` E7) | nunca funde sozinho | depois da esteira |
| G7 | **Suporte** | dono | responde dúvidas com base na documentação do próprio produto, abre chamado se não souber | L1 | **parecer jurídico** se usar modelo de terceiros | sem dado de cliente no contexto | tardio |
| G8 | **Recepcionista** (WhatsApp, Instagram) | cliente final do salão | conversa para **agendar e confirmar** | L1 no começo (propõe horários, o sistema agenda) | **terceiros**, API oficial paga | **alto risco jurídico, de custo e de política da Meta**; mercado já saturado | **depois de tudo; avaliar parceria em vez de construir** |
| G9 | **Prospecção** (do Eduardo, fora do produto) | Eduardo | lista de salões, roteiro, resposta a objeção | L0 | qualquer, **sem dado de cliente do CICLO** | LGPD e antispam: abordagem **manual e individual** | quando houver alpha |
| G10 | **Engenharia** (as contas do Claude e o Codex) | time | executam o backlog | L1 (PR revisado) | n/a | contratos, worktrees, revisão (seção 12) | já |

**Por que G8 fica no fim, e é uma opinião fundamentada, não um veto:** (a) o produto virou commodity,
com vários entrantes [S]; (b) o diferencial do CICLO é **retenção**, não conversa; (c) exige a API
oficial do WhatsApp (custo por conversa, número verificado, aprovação de modelos), um provedor de IA de
terceiros (**quebra a promessa da política de privacidade** até haver parecer) e conformidade com a
política da Meta; (d) o ganho do CICLO está em G2, que já funciona sem nada disso. **Pergunta aberta
[Do Eduardo]:** construir, ou **integrar** (deixar o salão conectar a recepcionista que já usa e o CICLO
só entrega a lista e o motivo)?

**Onde o agente mais agrega valor ao negócio do CICLO:** G1 (derruba a maior barreira de entrada),
G2 (é o produto) e G3 (protege contra o defeito mais caro deste projeto, a **falha silenciosa**:
cron parado, banco atrasado, painel verde que mente).

## 7. Trilha A: captação e ativação (o que falta pensar)

- **Métrica de ativação:** minutos do cadastro até o **primeiro ouro** ("47 clientes, R$ 6.300 na
  tela"), meta **abaixo de 15**; depois, **primeira chamada feita**, **primeira volta confirmada**.
- **A estrela-guia:** **clientes recuperados confirmados por mês** (clique no link seguido de
  agendamento: o dado de atribuição já existe). **R$ recuperado por salão** é o número que justifica o
  preço e entra no retroteste.
- **O canal real do alpha** é a venda **um a um**, com o Eduardo na tela do salão importando a lista
  (`docs/97`, modo assistido). Meta de abordagem e roteiro estão em `docs/88`. **Pesquisar parceiros
  de distribuição** (seção 3, lacuna c).
- **Indicação** (`docs/30`, `docs/82`) já tem o laço de convite; falta medir.
- **O que não fazer:** disparo em massa frio, compra de lista, promessa de resultado que o retroteste
  não prove.

## 8. Trilha H: confiança e conformidade

- **Fundir e revisar o #144**; levar o **dossiê** ao advogado (prazo anterior: 21/12 para o Portão 1).
- **Perguntas abertas ao advogado**, consolidadas (de `docs/97` §13 e `docs/86`): IA e OCR no aparelho
  contam como terceiro? redação da declaração da prévia; dado de saúde em planilha; modo assistido
  (CICLO recebendo o arquivo); IA ou OCR de terceiros; lista importada sem consentimento de contato;
  dados agregados entre salões (a trilha segue **desligada**).
- **Construir, sem esperar o advogado:** e-mails de aviso (C6), eliminação após 90 dias (C9, só depois
  do parecer sobre retenção), RIPD, runbook de incidente com prazo de 3 dias úteis para a ANPD,
  cobertura de `job_queue.payload` e `webhook_events.payload` na eliminação.
- **Privacidade por arquitetura** é a vantagem competitiva: esteira no navegador, IA no aparelho,
  retenção curta, nada de dado de cliente para terceiro.
- **Acesso aberto:** os Termos §5 e §6 descrevem cortesia e pausa; **enquanto a chave estiver ligada
  o texto promete uma pausa que não acontece**. Resolver antes de abrir ao público.

## 9. Trilha J: plataforma e operação (o que falta para operar sem sofrer)

**Backoffice interno (não existe, e é pré-requisito do alpha pago)** [Recomendado]:
- Lista de contas (plano pago, estado, cortesia, última atividade, nível de dados N0 a N3).
- **Marcar conta como paga** (data, valor, forma), com trilha em `audit_log`.
- Prorrogar cortesia, ligar e desligar o acesso aberto **por conta**.
- **Acesso de suporte com justificativa e registro** (nunca silencioso).
- Painel de funil: cadastro, importou, viu o ouro, chamou, voltou.
- Tudo atrás de **papel de operador do CICLO** e verificação em duas etapas; **o painel interno é a
  superfície de ataque mais valiosa** do sistema.

**Custos e capacidade:** `docs/88` (fixo estimado em R$ 433 por mês, equilíbrio perto de 8 pagantes
[E]) e a pergunta "quantos clientes cabem sem pagar Supabase e Vercel por escala" ficou lá. **Com a
esteira no navegador, a carga de importação sai do servidor**, o que melhora a conta.

**Vigias contra falha silenciosa** (lição do projeto, `falha-silenciosa-onde-procurar`): agendador,
fila, banco atrasado em relação às migrations, cron do GitHub que atrasa horas, cobrança que não
chega. G3 (agente de operações) é o consumidor natural.

## 10. Trilha K: método (o que torna o resto confiável)

Regras que **já valem** (`CLAUDE.md`): RLS sempre; `service_role` só em `with-tenant.ts`; dinheiro em
centavos; núcleo em `src/core` puro; escrita por `/api/v1` com chave de idempotência; Zod na borda;
sem `any`; dado de saúde fora de log; nunca apagar agendamento nem auditoria; **um ticket, um commit**;
**guarda vista reprovando**; verde não é prova.

**Acrescentar** (de `docs/97` e `docs/98`): **modo sombra** para todo classificador e versão do Motor;
**portão de regressão de métricas no CI**; **corpus versionado e crescente** (todo erro de produção vira
caso permanente); **registro de experimentos** em `docs/DECISOES.md`, **inclusive os negativos**;
**paridade navegador e servidor** do mesmo código; **teste de contrato de ferramentas** de agente;
**retroteste** como prova de produto.

**Armadilhas conhecidas do ambiente (aprendidas nesta e em sessões anteriores):**
- A suíte de integração falha em **arquivo diferente a cada rodada em paralelo** e passa isolada. Para
  verde limpo: `npx vitest run --config vitest.banco.config.ts --dir tests/integration
  --no-file-parallelism`. O `pnpm verify` completo passa de 10 minutos: **rodar em segundo plano**.
- Windows: `git add` **por nome**, nunca amplo; avisos de CRLF são esperados; comando de shell acima
  de ~8 KB trunca (usar arquivos); **scripts com regex e `\n` em heredoc de Python corrompem**: usar
  a ferramenta de escrita de arquivo.
- **Commitar antes de mutar.** Confirmar que a mutação foi aplicada antes de ler o resultado.
- Pare o servidor de desenvolvimento antes de `pnpm build`.
- Banco local pode estar com migrations fora de ordem (já aconteceu com a 0093 antes da 0092).
- **Duas sessões na mesma árvore** já commitaram trabalho uma da outra.

## 11. Dependências e caminho crítico

```
 B1 Esteira Onda 1 ──► B2 Esteira Onda 2 (histórico) ──► C1 Backtest ──► C2 Experimentos H1-H5
        │                        │                              │              │
        │                        └────────────► E1 Retroteste ◄─┘              ▼
        ▼                                                                   C3 Motor v2 em sombra
   G1 Agente de Importação                                                      │
   A  Onboarding (G4)                                                           ▼
                                                                         G2 Retorno explicando
 F1 Backoffice ──► F2 Cobrança manual ──► F3 Interface de provedor ──► F4 Asaas/MP adaptador ──► G5 Régua
 H1 Fundir #143/#144 ──► H2 C6 e-mails ──► (parecer) ──► C9 eliminação, abrir ao público
 G3 Operações  (independente, cedo)
```

**Caminho crítico até um alpha pago:** F1 + F2 (poder cobrar à mão) **e** B1 (esteira mínima) **e** H1
(fundir e revisar). **Caminho crítico até o diferencial** (provar que acerta): B2, C1, E1.

## 12. Como executar com várias contas e agentes ao mesmo tempo

- **Um worktree e uma branch por trilha**, nunca duas sessões na mesma árvore.
- **Contrato por tarefa** (ver como `docs/26` classifica): escopo exato, o que **não** tocar, critério de
  pronto, prova exigida. Se o Codex ou outra conta receber a tarefa, precisa de um `AGENTS.md` que
  aponte para o `CLAUDE.md`.
- **Entregável pequeno e revisável:** um PR por estação da esteira, por hipótese do Motor, por adaptador.
- **Quem revisa:** o PR de uma conta é revisado por outra, com os mesmos testes e **as mutações
  refeitas** (não confiar no relato de "vi reprovando").
- **O que fica com humano:** Onda 2 da esteira (dinheiro), qualquer texto jurídico, migration e RLS,
  decisões de preço e de provedor.
- **Empurrar vários commits seguidos reinicia o job de banco da CI** (~5 minutos): juntar antes de
  empurrar.

## 13. Medidas de sucesso (por trilha)

| Trilha | Medida | Meta inicial [E] |
|---|---|---|
| A | cadastro até o primeiro ouro | < 15 min |
| A | recuperados confirmados por salão por mês | a medir no alpha |
| B | arquivos sem nenhuma pergunta; falso-aceite | ≥ 70%; **0** no corpus |
| C | precisão@k do Motor v2 contra o v1; escore de Brier | v2 só entra se vencer |
| D | chamadas feitas por dia útil; cliques que viram agendamento | a medir |
| E | retroteste mostrado com amostra dita | 100% das importações N2 |
| F | pagamentos em dia; taxa efetiva de cobrança | ≥ 90% em dia; ≤ 3% |
| G | tarefas do agente aceitas sem edição; custo por conta | a medir; teto fixado |
| H | itens do dossiê respondidos; incidentes | 0 incidentes sem registro |
| J | falhas silenciosas detectadas por vigia antes de reclamação | 100% |

## 14. Riscos (os dez que mais custam)

| Risco | Resposta |
|---|---|
| Escolher provedor de cobrança errado e ficar preso | interface de provedor com adaptadores; começar manual |
| Promessa dos Termos que o código não cumpre (pausa, e-mails) | C6 antes de abrir; revisar o texto com o acesso aberto |
| Agente que decide sozinho e erra com cliente final | escada de autonomia; L1 como teto; WhatsApp manual |
| Dependência de IA de terceiros quebrando a política de privacidade | IA no aparelho; terceiros só com parecer |
| Esteira classificando coluna errada sem ninguém ver | falso-aceite zero, prévia obrigatória, controle de totais |
| Motor v2 pior que o v1 sem ninguém perceber | backtest, modo sombra, regra de adoção |
| Backoffice vazando acesso | papel de operador, 2FA, trilha, justificativa |
| Falha silenciosa (cron, fila, banco atrasado) | G3 e vigias; teste de que o vigia reprova |
| Duas contas pisando uma na outra | worktrees, contratos, revisão cruzada |
| Concorrente copiar a ideia | o diferencial é o **conjunto** (entrada, motor, prova, saída aberta), difícil de copiar em um sprint |

## 15. O que depende do Eduardo (lista única)

1. **Regra de produção** (nunca escrever em produção, ou o fluxo do `docs/96`).
2. **Provedor de cobrança** (Pix manual no alpha; depois Asaas, Mercado Pago ou os dois) e o
   **enquadramento fiscal**.
3. **Preço** (R$ 497 por ano, R$ 49 e R$ 99 por mês) e o texto de fundador.
4. **Fundir #143 e #144** e aplicar as migrations de produção antes do código (`0092` a `0098`, e as
   seguintes: **conferir o que já está em produção**, pois a outra conta aplica por conta própria).
5. **Variáveis de contato** (`NEXT_PUBLIC_CONTATO_*`) e planos pagos de Vercel e Supabase.
6. **Texto do aviso de cobrança** ("avisamos antes de qualquer cobrança" já está na tela de Meu plano).
7. **Recepcionista de IA**: construir ou integrar.
8. **Advogado**: a lista da seção 8.
9. **Prints dos preços e das telas dos concorrentes brasileiros** e **2 ou 3 arquivos reais** de
   exportação (anonimizados).
10. **Datas do alpha e da abertura pública**, agora que o acesso é aberto.

## 16. O que esta revisão NÃO fez

Não testou produto nenhum; não leu o texto oficial da Meta; não confirmou taxa nem exigência de
cadastro do Asaas nem do Mercado Pago; não pesquisou distribuição nem concorrentes brasileiros a fundo
(a busca web tem alcance limitado e quase nada de documentação pública aparece); não mediu nenhuma
hipótese do Motor; não escreveu código. **Tudo marcado [S] é ponto de partida, e [E] é conta que
precisa de confirmação.**
