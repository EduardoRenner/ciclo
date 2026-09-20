# Descobertas — CICLO (evolução autônoma do produto)

> Achados investigados com evidência, não suposição. Cada entrada diz o que foi observado, como foi
> confirmado, e o que (se algo) ainda falta para agir.

---

## 2026-09-20 · "Motor acertou 0%" é garantido pela estrutura dos dados de demo, não pelo algoritmo

**Onde:** `/admin/recuperar` (tela "Recuperar receita"), card de prestação de contas
(`src/app/admin/recuperar/prestacao.tsx` + teaser em `src/app/admin/hoje/prestacao-teaser.tsx`), a
um toque da tela "Hoje" — a mais visitada do painel.

**O que se vê ao vivo** (login `dono-demo-dom-estilo@ciclo.app`, senha do
`scripts/seed-demo-6-negocios.mjs`, 2026-09-20): *"O Motor acertou 0% das 132 previsões já
conferidas."*

**Por que isso chamou atenção.** `prestacao-de-contas.ts` já é uma peça cuidadosamente projetada
contra viés de sobrevivência (conta "não voltou" como ERRO, não ignora) e já tem piso de amostra
(`MINIMO_PARA_AFIRMAR = 8`) — 132 está bem acima disso. Um algoritmo determinístico rodando contra
histórico com cadência REGULAR por cliente (o que o seed constrói deliberadamente, `__cadencia` por
cliente) não deveria errar 132 de 132 por acaso — mesmo um algoritmo ruim acertaria algumas.

**Causa raiz, confirmada lendo o código (não suposição):**
1. `registrarPrevisoes` (`src/server/services/ciclo.ts` L154-227) roda UMA vez por combinação
   (cliente, serviço), usando o histórico COMPLETO — registra UMA previsão para "o que vem depois
   da última visita conhecida".
2. `resolverPrevisoes` (`src/server/services/previsao.ts` L90-138) só marca uma previsão como
   resolvida-com-acerto se existir uma visita **estritamente depois** de `last_visit_on` no mesmo
   par (cliente, serviço).
3. O seed (`scripts/seed-demo-6-negocios.mjs` L320-345) gera histórico inteiramente **retroativo**
   (`status: 'done'`, datas no passado) numa única rodada — não há NENHUMA visita depois da mais
   recente de cada cliente, porque nada é inserido depois do seed rodar.
4. Resultado: toda previsão registrada para este tenant está estruturalmente condenada a nunca
   resolver como acerto. Depois de `JANELA_DE_ESPERA_DIAS` (30 dias) sem uma visita que não pode
   existir, `prestacaoDeContas` conta cada uma como `naoVoltou` — um erro garantido, não medido.

**Isto é um bug de PRODUTO ou de DEMO?** De demo. Um tenant real e ativo recebe agendamentos novos
continuamente (bookings de verdade), então `resolverPrevisoes` tem chance real de encontrar a
"volta" e resolver a previsão como acerto. O seed é que constrói uma base congelada, sem nada
acontecendo depois — a métrica mede exatamente essa ausência de atividade futura, não a qualidade
do algoritmo.

**Risco real, mesmo sendo "só" demo:**
- A tela `/admin/recuperar` é alcançável em UM toque a partir de "Hoje" (confirmado ao vivo). Quem
  explora a conta demo — cliente em potencial, ou a própria equipe numa demonstração ao vivo — pode
  cair nesse número e ler "o diferencial do produto não funciona".
- **Verificado, e é a parte boa:** o print de marketing atual (`public/exemplo/demo-dom-estilo-hoje.webp`,
  usado em `painel-do-dono-exemplo.tsx` na home) corta ANTES de chegar neste card — a captura pára em
  "48 clientes perto do prêmio". O risco de marketing não está realizado hoje, mas fica um toque de
  distância de qualquer refeitura do print que role a página um pouco mais fundo.

**Por que não consertei agora.** O conserto certo é o seed simular ALGUMAS visitas de retorno
recentes para os clientes que NÃO estão no grupo deliberadamente atrasado (a variável `i % 4 === 0`
já reserva 1 em 4 para ficar atrasado de propósito — os outros 3 em 4 deveriam poder "acertar").
Mas `scripts/seed-demo-6-negocios.mjs` é compartilhado pelos SEIS negócios de demo, e os valores que
ele produz já foram calibrados em pelo menos 5 rodadas anteriores (ver docstring de
`painel-do-dono-exemplo.tsx`) para bater com números citados noutras partes do produto (ex.: "R$
1.840" da home). Mexer no laço de geração de agendamentos sem conseguir rodar localmente (Docker
indisponível nesta sessão — sem como testar contra um banco de verdade antes de aplicar em produção)
arrisca descalibrar os seis negócios ao mesmo tempo, um erro caro de reverter (o script apaga e
recria os seis a cada execução). Rodar o seed é sempre escrita em produção — exige autorização
explícita, não é decisão que este agente toma sozinho.

**Status:** documentado, não corrigido. Ver `autonomous-backlog.md` para o item de acompanhamento.

---

## 2026-09-20 · Botão nativo não responde a Enter/Espaço neste navegador de teste — descartado como limite da ferramenta

Durante a mesma exploração, testar o seletor de serviço de `/{slug}/agendar` via teclado (Tab até o
botão, depois Enter) não mudava o estado (`aria-pressed` continuava `false`). Antes de reportar como
bug de acessibilidade, testei um `<button onclick=...>` criado do zero via `javascript_exec` numa
página NEUTRA (`example.com`, sem nenhum código do CICLO) — o mesmo comando de teclado (`Return`) não
disparou o clique nele também. Como um `<button>` nativo recebe Enter/Espaço por padrão do browser,
sem handler nenhum de JS precisar tratar isso, e o botão de teste falhou da mesma forma, a conclusão
é que a ferramenta de automação de teclado deste ambiente (`computer key`) não está disparando o
evento nativo de ativação — não é um defeito do código do CICLO. Não virou item de backlog: é uma
limitação conhecida da ferramenta de teste, registrada aqui para a próxima sessão não repetir a
investigação do zero.

---

## 2026-09-20 · `reivindicarEncaixe` (lista de espera): hipótese de double-booking investigada e descartada

Ao ler `src/server/services/lista-espera.ts`, `reivindicarEncaixe` fez soar um alarme: checa
`entrada.fulfilled_at` num `SELECT` separado, cria o agendamento, e só DEPOIS marca `fulfilled_at`
com um `.update()` sem condição (`WHERE fulfilled_at IS NULL`) — diferente do padrão que
`resolverPrevisoes` (`previsao.ts`) usa corretamente (`.is('resolved_at', null)` + contar linhas
afetadas). `reivindicar.tsx` dispara a reivindicação sozinha, ao abrir a página, sem
`Idempotency-Key` — parecia a receita clássica pra dois toques/duas abas criarem dois agendamentos
pro mesmo encaixe.

**Investigação mais funda derrubou a hipótese.** O token carrega profissional+horário FIXOS
(`OfertaEncaixe`), então duas chamadas concorrentes para o MESMO token tentam criar agendamento no
MESMO slot exato — e é exatamente o que `appointments_no_overlap` (constraint do banco, código
`23P01`) existe para impedir. `criarAgendamento` já trata esse código e devolve `SLOT_TAKEN` de
forma limpa (`agendamentos.ts` L387-400), não um 500. Comparei com o padrão irmão
(`/confirmar/[token]`, `route.ts` L30-32): também não usa `Idempotency-Key`, e também faz
"checar-depois-agir" — a diferença é que ali a ação (mudar `status` pra `confirmed`) é
naturalmente idempotente por repetição, e aqui (criar linha nova) não seria, SE não fosse a
constraint de exclusão cobrindo justamente este caso.

**Conclusão:** não é um bug de integridade de dado — o pior cenário real é uma aba "perdedora" numa
corrida rara (duplo toque, duas abas) ver uma mensagem de erro genérica enquanto a outra aba já
reservou com sucesso. Nenhum agendamento duplicado é possível pra este fluxo específico. Não virou
item de backlog — registrado aqui porque a investigação valeu a pena (confirma uma propriedade real
do sistema) mesmo sem virar código, e para a próxima sessão não repetir a mesma suspeita do zero.

---

## 2026-09-20 · Corrigido: prévia das estrelas em `/avaliar` não existia para teclado

`onMouseEnter`/`onMouseLeave` davam a prévia de quantas estrelas seriam marcadas ao passar o mouse
(`notaEmFoco`); tabulando pelas estrelas via teclado, essa prévia não existia — só a nota já
confirmada por clique. Adicionado `onFocus`/`onBlur` espelhando os mesmos handlers. Mudança pequena
e de baixo risco: `tsc`/`eslint` limpos, `pnpm build` e `tests/unit` (290/2524) verdes. Não foi
possível verificar visualmente ao vivo (sem servidor local — Docker indisponível nesta sessão), mas
a mudança é mecânica (dois handlers a mais, espelhando dois já existentes e testados).

---

## 2026-09-20 · Corrigido: aprovar/recusar orçamento apagava a tela inteira durante o envio

`src/app/(public)/orcamento/[token]/orcamento.tsx`: `aprovar()`/`recusar()` reaproveitavam
`setEstado('carregando')` enquanto o POST estava em voo. `telaDoOrcamento` (função pura, já
guardada por `orcamento-mostra-erro.test.ts`) trata QUALQUER `'carregando'` como "mostra só o texto
de carregamento" — é o mesmo estado que cobre a carga inicial da página. Resultado: apertar "Aprovar
orçamento" fazia os itens e o total (a única prova do que está sendo aprovado) sumirem da tela,
substituídos por "Carregando orçamento…" — na decisão de MAIOR custo das quatro telas públicas
(fechar negócio), segundo o próprio comentário do arquivo.

O padrão correto já existe no irmão `/avaliar` (`Button carregando={estado === 'enviando'}`, spinner
dentro do botão, conteúdo continua visível). Apliquei o mesmo: `pendente`, um estado booleano
separado de `estado`, mantém o conteúdo na tela e usa o spinner do próprio `Button`. Não toquei em
`telaDoOrcamento` nem no guard existente — a mudança é só em como `aprovar`/`recusar` reportam
progresso.

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524, incluindo `orcamento-mostra-erro.test.ts`)
verdes. Sem preview local (Docker indisponível) — mudança de estado local, sem novo endpoint nem
lógica de servidor, risco baixo.

---

## 2026-09-20 · `ATUALIZADO_EM` de privacidade/termos: risco confirmado, sem guarda automática viável

Continuando a investigação por churn: `privacidade/page.tsx` teve um bug real e confirmado (commit
`e428ec1a`, 16/09) — o conteúdo mudou (nomeou os processadores de dado) e a constante
`ATUALIZADO_EM` ficou presa em "30 de agosto", achado só verificando a página PUBLICADA, não pelo
build passar. `termos/page.tsx` tem a MESMA constante solta, mesmo risco — checado o histórico
desde 30/08 e confirmado que seu conteúdo de fato não mudou ainda (só CSS/performance/a11y tocaram
o arquivo), então a data lá está correta hoje, mas por sorte de calendário, não por proteção.

Considerei escrever uma guarda de varredura (padrão estabelecido desta base), mas esbarrei num
limite real: o defeito é "conteúdo mudou SEM a data acompanhar" — uma comparação entre DUAS versões
do arquivo (antes/depois), não uma propriedade de UMA versão isolada. Um teste Vitest lê só o
snapshot atual; não tem como saber se o texto abaixo é "o mesmo de sempre" ou "acabou de mudar" sem
comparar contra git (fora do padrão de guarda deste projeto) ou aceitar uma janela de "data ficou
velha há N dias" (temporal, não-determinística, dispara mesmo quando nada mudou). Nenhuma das duas
options se encaixa no padrão de guarda estabelecido aqui sem introduzir uma classe nova de
fragilidade.

**Ação tomada, proporcional ao risco:** comentário no ponto exato da constante, nas DUAS páginas,
contando o incidente real e pedindo para mudar a data na MESMA alteração que muda o texto —
mesma cultura de "aviso escrito onde o próximo vai procurar" já usada nesta base (ex.:
`toque-48`, `card.tsx`). Não é proteção automática, é o que o problema realmente comporta sem
inventar uma guarda frágil só para ter uma.

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes — mudança é só comentário.
