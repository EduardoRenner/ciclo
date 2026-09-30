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

---

## 2026-09-20 · Corrigido: `required` do `MoneyInput` nunca funcionou — preço zero passava sem aviso

Continuando a investigação por churn (produto novo de revenda, `docs/62` Fase 1, commit `a958d2c7`):
`MoneyInput` (`src/components/ui/money-input.tsx`) formata `centavos` como texto SEMPRE —
`(0/100).toLocaleString(...)` vira `"0,00"`, nunca uma string vazia. Isso quer dizer que o atributo
HTML `required`, passado via `{...props}` para o `<input>` por baixo, **nunca dispara**: o campo
nunca está "vazio" do ponto de vista do navegador, só mostra um valor que parece zero.

Achei 3 usos de `MoneyInput ... required` na base — todos silenciosamente sem proteção nenhuma:
`estoque/lista.tsx` (preço de venda do produto de revenda) e `servicos/formulario.tsx` (preço
principal, valor da hora de `visit_hourly`, meia diária). Confirmei que o schema Zod do SERVIDOR
também só exige presença (`priceCents: z.int().min(0)`, `!= null` no `.refine()`), nunca valor
positivo — então não havia trava nenhuma, nem cliente nem servidor, contra salvar um produto
vendável ou um serviço reservável a R$ 0,00 por esquecimento.

**Diferença importante que quase me fez consertar errado:** `comanda.ts` tem um comentário
explícito dizendo que preço zero É uma decisão válida — "cortesia decidida na hora" — mas isso é
sobre `unitPriceCents` (override MANUAL no momento da venda), não sobre o preço PADRÃO do catálogo.
Nada na base sugere que um serviço reservável ou o preço-padrão de um produto deveriam poder nascer
gratuitos por padrão. A trava que adicionei é só no CATÁLOGO/CADASTRO; a cortesia pontual na
comanda continua funcionando exatamente como antes.

**Fix:** validação explícita no cliente, antes do envio, nos dois formulários — mesmo padrão já
usado nos mesmos arquivos para o campo "nome". Não mexi em `MoneyInput` (component compartilhado,
mudar o comportamento dele afetaria todo uso, incluindo onde zero É válido) nem no schema do
servidor (mudar `min(0)` para `min(1)` quebraria a cortesia manual da comanda, que passa
`unitPriceCents: 0` de propósito).

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes. Sem preview local (Docker
indisponível) — mudança é validação de estado local antes do fetch, mesmo formato de código já
testado manualmente nesta base (`nome.trim().length < 2`).

---

## 2026-09-20 · Corrigido: telefone inválido marcava cliente como "enviado" na campanha, sem abrir nada

`src/app/admin/campanhas/nova/nova.tsx`: cada card de cliente virava um `<a href={link ?? '#'}>`,
onde `link = linkWhatsApp(alvo.phoneE164, texto)`. `linkWhatsApp` (`lib/mensagens.ts`) devolve
`null` quando o telefone está ausente ou tem menos de 10 dígitos — mas o `onClick` do card
`setEnviados((s) => new Set(s).add(alvo.id))` disparava DE QUALQUER FORMA, mesmo quando o `href`
era o `#` inofensivo que não abre nada.

Resultado: um clique num cliente com telefone ruim mostrava o check verde, descia o contador
"X/N enviadas", e — se o dono clicasse "Registrar campanha" depois — `clientIds` no
`POST /api/v1/campaigns` incluía esse cliente como alcançado, quando NENHUMA mensagem saiu. O
registro da campanha ficava com dado falso, e o dono achava que tinha contatado alguém que nunca
recebeu nada.

**Fix:** quando `link` é `null`, o card vira uma `div` sem toque (não mais `<a>`), com o texto
secundário trocado para "Sem telefone válido para WhatsApp" (a MESMA linha que normalmente mostra o
LTV — sempre visível, não só um `title`) e um `title` com a instrução de correção. `enviados` nunca
ganha esse `clientId`.

**Achado incidental, e vale registrar:** ao escrever o texto do `title`, dois guardas de copy já
existentes (`copy-nao-supoe-genero`, `copy-sem-travessao`) reprovaram — eu tinha escrito "a cliente"
(gênero implícito) e um travessão (marca de texto gerado por IA que este projeto proíbe
explicitamente). Corrigido antes de commitar; as guardas fizeram exatamente o que existem para
fazer.

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524, incluindo as duas guardas de copy que
inicialmente reprovaram) verdes.

---

## 2026-09-20 · Generalização do BL-08: mesma classe em `ficha.tsx`, causa diferente

Depois de consertar `campanhas/nova.tsx`, busquei o mesmo padrão (`href={link ?? '#'}`) na base e
achei mais 2 instâncias em `admin/clientes/[id]/ficha.tsx` — "Indicar" (convite de indicação) e
"Mensagem" (modelo pronto). A CAUSA aqui é diferente da campanha (lá era o `onClick` disparando
incondicional; aqui os botões que abrem essas seções só checavam `!cliente.phoneE164`, ausência de
telefone — não se `linkWhatsApp()` de fato produzia um link). Telefone PRESENTE mas com menos de 10
dígitos (dado corrompido/incompleto, ex.: importação malfeita) passava pela checagem fraca,
habilitava os botões, e tocar neles abria nada enquanto a folha fechava como se tivesse dado certo.

Menor alcance que a campanha (afeta só quem tem telefone corrompido nesse cliente específico, não
um disparo em massa), mas a mesma classe de "sucesso fingido" que este projeto trata como sério.
`telefoneUtilizavel = linkWhatsApp(cliente.phoneE164, '') !== null` centraliza a checagem
VERDADEIRA (a mesma função que decide se abre algo) nos dois lugares, substituindo o proxy fraco.

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes.

---

## 2026-09-20 · BL-07 verificado ao vivo em produção — funciona nas duas direções

Sem Docker nesta sessão para testar localmente, o conserto de `estoque/lista.tsx` (BL-07) só tinha
verificação estática (tsc/eslint/build/vitest). Testei ao vivo contra produção, login
`dono-demo-salao-encanto@ciclo.app` (plano `avancado`, sem a trava de módulo que bloqueava o
primeiro tenant testado):

1. Abri "Novo produto", preenchi nome, liguei "Vende para cliente (revenda)", deixei o preço no
   padrão "0,00" e cliquei "Cadastrar produto". A tela mostrou o erro
   ("Defina um preço de venda maior que zero...") e `read_network_requests` confirmou **zero**
   chamadas a `/api/v1/products` — bloqueado antes de qualquer rede, como desenhado.
2. Digitei um preço real (R$ 29,90) e cliquei de novo: `POST /api/v1/products → 200`, produto
   criado normalmente.

Confirma o conserto funcionando nas duas direções em produção, não só nos testes. Produto de teste
("Teste QA validacao preco") ficou no catálogo de demonstração do Salão Encanto — tela
administrativa, não alcança o storefront público, risco de deixar como está é baixo.

---

## 2026-09-20 · Corrigido (confiança média, não verificado ao vivo): drenagem concorrente da fila offline

`src/lib/offline/api-client.ts` (fila de mutações offline, TICKET-055/`01-ESPEC §4.2`) tem dois
caminhos INDEPENDENTES que chamam `drenarFilaPendente()`: o listener de `online` e
`tentarNovamenteComBackoff` (retry com backoff 2s/5s/15s). O mutex já existente
(`tentativaEmAndamento`) só protegia o LAÇO de retry — nunca a própria `drenarFilaPendente()`.
Reconectar bem no instante em que um retry agendado também dispara faria as duas passadas lerem a
MESMA lista de `listarMutacoes()` (IndexedDB) antes de qualquer uma remover algo, e mandar cada
mutação pendente duas vezes ao mesmo tempo — exatamente o cenário central deste produto (tablet de
balcão, 4G instável de subsolo).

**Por que a confiança é média, não alta:** o `Idempotency-Key` do servidor provavelmente absorve o
reenvio sem duplicar dado — não é um caminho confirmado como gerando corrupção real, é uma corrida
que o cliente não deveria criar mesmo assim (mesma régua de "duas fontes da mesma verdade" que este
projeto já aplica noutros lugares). Não consegui reproduzir a corrida ao vivo: o próprio arquivo já
documenta que depende de IndexedDB/fetch de browser real, sem jsdom neste projeto, e que os
consertos anteriores aqui (ex.: o achado de 401/403 descartando mutação de sessão vencida,
2026-08-28) só foram verificados manualmente via DevTools → Network → Offline — a mesma limitação
se aplica a este.

**Fix:** `drenagemEmAndamento`, mutex próprio em `drenarFilaPendente()`, mesmo padrão de
`tentativaEmAndamento`. Rastreei o caminho de uma mutação que chega bem no meio de uma drenagem em
andamento: ela não se perde — a chamada que encontra o mutex ocupado simplesmente não remove nada,
e o próprio laço de backoff (ou o próximo evento `online`) tenta de novo depois.

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes. Sem teste novo — este arquivo não tem
teste automatizado por desenho (a lógica testável mora em `core/offline/queue.ts`, já coberta).

---

## 2026-09-20 · Corrigido: desativar notificação push não conferia se o servidor apagou de verdade

`src/app/admin/config/notificacoes/ativar.tsx`: `desativar()` chamava
`DELETE /api/v1/push/subscriptions` e seguia direto para `inscricao.unsubscribe()` (navegador) +
`setEstado('suportado')` (UI diz "desativado"), sem checar `resposta.ok`. `ativar()`, ao lado, JÁ
fazia essa checagem corretamente — a assimetria entre os dois é o que chamou atenção.

`fetch()` só lança exceção para falha de REDE (sem conexão, DNS, CORS) — uma resposta HTTP 401,
403 ou 500 do servidor resolve normalmente com `ok: false`, sem lançar nada. Sem o `if
(!resposta.ok)`, qualquer uma dessas falhas passava batido: a inscrição continuava salva em
`push_subscriptions`, o servidor seguiria mandando push pro aparelho, e a pessoa via "desativado"
na tela — a mesma classe de "sucesso fingido" de BL-08/BL-09, terceira instância nesta sessão.

**Confirmado antes de decidir a forma do fix:** `removerInscricaoPush` (`server/services/push.ts`)
é um `DELETE ... WHERE` simples — zero linhas afetadas não é erro no Postgres, então a rota é
idempotente e sempre devolve 200 pra quem já tinha desativado antes. Isso significa que checar
`resposta.ok` não cria um falso-positivo de erro pro caminho normal — só pega falha de verdade
(sessão vencida, erro interno).

**Fix:** `if (!resposta.ok) throw ...` antes de `unsubscribe()`, mesma forma de `ativar()`. Ordem
importa: se o servidor não confirmar, o navegador NÃO cancela a inscrição local — evita o estado
pior (servidor pensa que está ativo, navegador já cancelou, e reativar criaria uma segunda
inscrição órfã).

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes.

---

## 2026-09-20 · Varredura sistemática da classe "fetch sem checar .ok" acha 3 novas instâncias

Depois de achar a mesma classe 3 vezes em locais diferentes (BL-08, BL-09, BL-11), fiz a varredura
completa: todo `await fetch(` em `src/**/*.tsx` (50 arquivos), comparando a contagem de `await
fetch(` com a de `.ok` no mesmo arquivo — 4 candidatos onde `fetch > ok`.

**1 falso positivo:** `assistente-flutuante.tsx` — dois `fetch` (ternário `condição ? await fetch(A)
: await fetch(B)`) compartilham a MESMA variável `r` e o MESMO `if (!r.ok)` logo abaixo; a terceira
chamada (já lida nesta sessão, `confirmarProposta`) também checa `.ok` corretamente. Contagem simples
não capturou o compartilhamento — confirmado lendo o código, não descartado por suposição.

**3 achados reais, todos corrigidos:**

1. **`admin/recuperar/recuperar.tsx`, `trocarFiltro()`** — trocar o filtro e a requisição falhar
   (401/500) não avisava nada: a lista antiga ficava na tela, sem toast, sem indicação de que o
   filtro não mudou.
2. **`admin/recuperar/recuperar.tsx`, `enviar()`** — envio de campanha de recuperação em lote:
   falha de verdade caía nos mesmos `??` que uma resposta de sucesso vazia, virando
   `resumoDoEnvio(0, [])` — a MESMA frase de "ninguém pra mandar" que "a requisição nem foi
   processada". Ninguém saberia que precisava tentar de novo.
3. **`admin/config/profissionais/lista.tsx`, `desativar()`** — atualização OTIMISTA (`active:
   false` na tela antes da resposta) só revertia em erro de REDE (`catch`); um 401/403/500 do
   servidor (que não lança) deixava a UI mostrando "inativo" com o profissional continuando ATIVO
   de verdade — reservável, visível no site público.
4. **`components/config/editor-expediente.tsx`, `removerFolga()`** — o pior caso: nem `try/catch`
   existia. Folga sumia da tela otimisticamente e ficava assim para sempre mesmo se o servidor
   recusasse, continuando a bloquear horário de verdade no banco enquanto a agenda parecia livre.

Todos os quatro ganharam a mesma forma de conserto: checar `r.ok`, reverter o estado (quando
otimista) e mostrar toast de erro — mesmo padrão já usado corretamente em `BotaoRecalcular`
(mesmo arquivo de `recuperar.tsx`) e nos consertos anteriores desta classe.

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes.

---

## 2026-09-20 · BL-12 estendida a .ts: `limitarComUpstash` também não checava `.ok` (latente)

A varredura de "fetch sem `.ok`" (BL-12) só tinha coberto `.tsx`. Rodando a mesma comparação em
`.ts` (`grep -rl "await fetch(" src --include="*.ts"`), achei mais 3 candidatos: `lib/offline/
api-client.ts` (falso positivo — usa `classificarResposta(status)`, mais sofisticado que `.ok`, já
corrigido/revisado tick passado), `server/services/captcha.ts` (falso positivo — lê `success` do
corpo da hCaptcha, que é o sinal certo; falha de rede já cai num `catch` bem documentado), e
**`server/services/rate-limit.ts`, `limitarComUpstash`** — real.

Nem `incr` nem `expire` (API REST do Upstash) checavam a resposta. Um erro que ainda devolve JSON
válido (`{"error": "..."}`, sem `result`) virava `contagem: undefined`, e `undefined <= limite` é
`false` em JS — toda requisição passaria a ser RECUSADA, em vez de cair pro Postgres, que é a
intenção documentada extensivamente neste mesmo arquivo (achado de segurança S4, "Upstash →
Postgres → memória").

**Por que é sério mesmo sendo latente:** `UPSTASH_REDIS_REST_URL`/`TOKEN` não estão provisionados
em produção hoje (o próprio arquivo documenta isso, auditoria de 23/08) — então `limitarComUpstash`
nunca roda de verdade agora. Mas é exatamente o caminho "preferencial" que a documentação do
arquivo defende para quando Upstash for provisionado — sem o conserto, ativar Upstash um dia
introduziria silenciosamente "recusa 100% do tráfego" na primeira falha transitória da API deles.

**Fix, com cuidado no `expire`:** `incr` lança em falha (dispara o fallback já existente em
`limitador()`). `expire` NÃO lança — `incr` já tinha acontecido de verdade em Upstash, então
lançar jogaria essa contagem fora e cairia pro Postgres, contando a MESMA requisição duas vezes;
só loga um aviso.

**Testado, mutation-testado:** `limitarComUpstash` exportada só pra teste (mesmo padrão de
`chavesEmMemoriaParaTeste`, já existente no arquivo) — testar via `limitador()` misturaria com o
fallback real pro Postgres, que exige banco de verdade (indisponível neste ambiente). 3 testes
novos com `fetch` mockado (`vi.stubGlobal`, mesmo padrão de `mercado-pago-cliente.test.ts`).
Reintroduzi o defeito exato (removi o `if (!incr.ok) throw`) e vi o teste reprovar mostrando
`{ permitido: false, restante: NaN }` — a manifestação exata prevista — antes de restaurar via
`git checkout --`.

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2527) verdes.

---

## 2026-09-20 · Corrigido: `apagarBancoOffline()` falhando era 100% silencioso no logout/exclusão

Varredura de uma classe adjacente à de BL-08/09/11/12/13: em vez de "fetch sem `.ok`", busquei
`.catch(() => {})` / `.catch(() => undefined)` / `catch {}` em `src/**/*.{ts,tsx}` — ~20
ocorrências. A maioria é legítima (localStorage, Share nativo, StatusBar, parse de corpo JSON,
diagnóstico best-effort) — verificadas uma a uma, não descartadas por amostragem.

**Uma era real:** `apagarBancoOffline().catch(() => undefined)`, em `admin/config/sair.tsx` e
`admin/config/excluir-conta/formulario.tsx`. `apagarBancoOffline` (`lib/offline/db.ts`) é a limpeza
do achado de segurança S9 — apaga o IndexedDB que guarda CORPO de mutações pendentes (nome,
telefone, dados de agendamento) para não vazar de uma pessoa pra próxima num tablet de balcão
compartilhado. Uma falha dessa limpeza específica (rara — `indexedDB.deleteDatabase` só rejeita em
erro genuíno; bloqueio por outra aba já resolve como sucesso DENTRO da própria função) sumia sem
deixar rastro nenhum.

**Por que vale consertar mesmo sendo raro:** é exatamente a classe de coisa que este projeto já se
cobrou por várias vezes ("catch que descarta — tem que contar e avisar"), e o dado em jogo aqui é
PII num aparelho compartilhado, não um detalhe cosmético. Não dá pra bloquear o logout esperando
essa limpeza (a sessão já foi encerrada no servidor, não sobra tela pra avisar a pessoa) — o fix é
`console.warn` estruturado, mesmo padrão já usado em `upstash_indisponivel`/`hcaptcha_indisponivel`.

`tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2527) verdes.

---

## 2026-09-20 · Vercel MCP (`get_runtime_errors`) abriu uma fonte de evidência nova — dois achados, resolução diferente

Durante a missão de crescimento/mercado, testei o conector Vercel já disponível na sessão contra o
projeto `ciclo` (`prj_Ba2E6fVCLnkDSZi1Y5G7zUb3kHV7`). `get_web_analytics` retornou "Tool not found"
de forma consistente (schema mismatch do lado do servidor MCP — não investiguei mais a fundo, não é
o objetivo da sessão). `get_runtime_errors` funcionou e trouxe 7 dias de erros de produção
agrupados — uma fonte de evidência que este projeto não vinha consultando.

**Achado 1 — resolvido, sem ação necessária.** Cluster de `FORBIDDEN "Sua conta ainda não tem um
estabelecimento"` vazando como erro não tratado em `/admin/config` e `/admin/hoje` (count=4,
users=2, primeiro 2026-09-03, último 2026-09-16). `src/server/auth/tenant.ts` já documenta esse
EXATO defeito e a correção (`contextoDoPainel`, comentário datado de 16/09). Confirmei que **as
duas rotas do cluster já usam `contextoDoPainel`**, e uma varredura (`grep -rl "contextoAtual"
src/app/admin --include="page.tsx"`) não achou mais nenhum `page.tsx` sob `/admin` usando a versão
antiga sem a proteção. Zero ocorrências novas nos 4 dias seguintes (verificado via
`get_runtime_logs`, últimas 24h, vazio). Fechado — o conserto já estava completo antes desta sessão
chegar nele.

**Achado 2 — aberto, evidência insuficiente para consertar sem especular.** Cluster de
`AppError INTERNAL "Algo deu errado do nosso lado"` na página pública `/[slug]/agendar` — a tela
onde a cliente de um salão marca horário. count=20, users=10 (dez pessoas DIFERENTES, não uma só
tentando de novo), 2026-09-09 a 2026-09-16, sem recorrência nos 4 dias seguintes. `perfilPublico`
(`src/server/services/public-booking.ts`) é a função por trás da página, e joga qualquer erro do
Supabase (5 queries em paralelo) direto em `AppError('INTERNAL', {cause})` — então a causa real fica
só no `[cause]`, que o `get_runtime_errors` trunca para `[Object]`, e os logs detalhados de 09-09 a
09-16 já saíram da janela de retenção (Hobby/Pro: 1h–1 dia) quando fui olhar. **Hipótese descartada
com evidência:** não é o latência cross-region Vercel↔Supabase que o comentário antigo do arquivo
sugeria — `vercel.json` já fixa `regions: ["gru1"]`, junto do Supabase em `sa-east-1`, desde antes
desta sessão (o comentário citando `iad1` estava desatualizado; corrigido nesta sessão). Sem a causa
real, não fiz nenhuma mudança de código aqui — inventar um "conserto" para uma falha não
caracterizada seria o mesmo erro que este projeto já se cobrou de evitar (`CLAUDE.md`, "verde não é
prova" vale nos dois sentidos: não afirmar consertado, mas também não afirmar causa sem prova).
**Registrado para quem tiver os logs a tempo:** a próxima vez que isso recorrer, `get_runtime_logs`
com `since` recente (dentro de 24h) e `requestPath`/`query` filtrando `/agendar` deve trazer o
`[cause]` completo antes que a retenção expire.

`.claude/ciclo/growth-opportunities.md`/`funnel.md`/`market-intelligence.md`/`experiments.md`
(missão de crescimento) documentam o resto do que essa mesma sessão pesquisou — este achado é o
único item de bug-hunting que a pesquisa de mercado produziu de lambuja.

---

## 2026-09-27/28 · Missão `.claude/ciclo/loop-motor-nao-esquece.md` — BL-48, BL-47, BL-46, todos fechados

Modo autônomo infinito, branch `fix/motor-nao-esquece-2026-09-27`, 5 commits.

**BL-48 (serviço arquivado / cliente eliminada continuavam "atrasados" para sempre).** A tentativa
anterior (commit `f6f46acf`, revertida em `9bf0d1b8`) tinha diagnosticado RLS como causa do erro na
CI — **errado**. Reproduzido com Postgres local: `service_role` ignora RLS por desenho
(`BYPASSRLS`), `FORCE ROW LEVEL SECURITY` não vale para ele. A causa real: `client_cycles` tem chave
primária composta, sem coluna `id`, e o laço genérico de `TABELAS_APAGADAS` fazia
`.delete()...select('id')` — `SQLSTATE 42703`. Corrigido com deleção própria fora do laço. Segunda
parte (serviço arquivado): job noturno ganhou `.eq('active', true)`, e as duas views de dinheiro
(`v_recover_revenue`, `v_clientes_a_recuperar`) ganharam o mesmo filtro dos dois lados da lógica.
Todas as três partes verificadas com mutação (reintroduzi o defeito, vi a guarda reprovar,
restaurei).

**BL-47 (cobertura de dinheiro da porta CSV).** Ao tentar espelhar os 3 casos de
`quem-ja-atendo.test.ts`, achado: 2 deles (assinante ativo, pacote com saldo) são estruturalmente
IMPOSSÍVEIS pela porta CSV — ela só cria cadastro novo, nunca atualiza um telefone já existente, e
assinatura/pacote só existem presos a um `client_id` que já tem ficha. Implementado só o caso
alcançável, com o achado documentado no backlog para não ser tentado de novo à toa.

**BL-46 (`resolverPrevisoes` nunca em lote).** Medido pela primeira vez com Docker disponível:
17,57ms/previsão, 87,8s para 5 mil. RPC em lote (`resolver_previsoes_em_lote`, migration `0094`)
trouxe para 0,08ms/previsão — **~208x mais rápido**. A trava contra corrida (`resolved_at is null`)
continua por linha, dentro do `UPDATE` em lote. **Achado no caminho, sobre o próprio teste que eu
estava escrevendo:** a primeira versão do teste de corrida chamava `resolverPrevisoes` duas vezes em
sequência e via "0 fechadas" na segunda — mas por motivo ERRADO (o filtro externo de
`resolverPrevisoes`, não a trava da RPC). O teste passava mesmo com a trava removida da função
(mutação testada). Corrigido chamando a RPC direto, duas vezes, com o mesmo lote — só assim a
mutação REPROVA de verdade. **Segundo achado, também de isolamento:** o benchmark de 5 mil
previsões usava o tenant compartilhado do arquivo e poluía a amostra que outro teste
(`'prestação de contas do Motor'`) precisa pequena para provar que `acertoBps` fica `null` — isolado
num tenant próprio.

**Infra, de passagem:** depois de um `supabase db reset --local`, o Kong local ficou apontando para
o IP antigo do container de auth (`connect() failed... 172.18.0.6:9999`) — `502` em toda chamada de
auth admin, com a mensagem genérica "An invalid response was received from the upstream server" do
lado do supabase-js. `docker restart supabase_kong_ciclo` resolve. Vale lembrar se acontecer de
novo: não é bug do teste, é o proxy com cache de DNS/IP desatualizado depois de um restart de
container.

`pnpm verify` verde nas três frentes. Suíte de integração inteira rodou verde (1 flake pré-existente
e não relacionado em `job-queue.test.ts` sob carga pesada, confirmado passando isolado).

---

## 2026-09-28 · BL-42 — 5 rotas de dinheiro param de duplicar linha de auditoria em retry

Mesma missão, mesmo loop infinito. `writeAudit` ficava FORA do fechamento que `comIdempotencia`
protege em pelo menos 49 (na verdade 50, recontado) rotas — repetir a mesma `Idempotency-Key`
(fila offline reenviando, toque duplo) não repetia a mutação, mas gravava uma linha nova em
`audit_log` a cada repetição. Corrigido nas 5 rotas onde isso mais custa (dinheiro):
`wallet/credit`, `wallet/debit`, `tickets/[id]/close`, `billing/assinar`, `billing/cancelar` —
`writeAudit` move para dentro do fechamento; numa repetição, `comIdempotencia` nem chama o
fechamento, então nem a mutação nem a auditoria rodam de novo.

**Achado ao contar a lista de pendentes, não ao consertar:** escrevi a lista das 44 rotas restantes
de cabeça (a partir do resultado de um `grep` que eu já tinha visto) e errei — pulei
`tickets/[id]/cancel`. Recontei gerando a lista por comando em vez de por memória: são 45
restantes, não 44 (50 no total, não 49 — a contagem original do achado, "pelo menos 49", ficou
desatualizada no meio do caminho, uma rota nova nasceu). Registrado no BL-42 com a lista completa,
gerada, não digitada.

`pnpm verify` verde. `tests/integration/idempotencia-nao-duplica-auditoria.test.ts` prova o
mecanismo (`comIdempotencia`+`writeAudit`) contra Postgres real, verificado com mutação.

---

## 2026-09-28 · BL-42, segunda rodada — mais 5 rotas + guarda de fonte permanente

Mesmo loop. Mais 5 rotas corrigidas, priorizadas por LGPD/dinheiro/estoque: `clients/[id]/erase`
(eliminação de dado pessoal — o registro que prova quando e por quem é onde a auditoria inflada
mais dói), `packages`, `packages/[id]/use`, `inventory/entries`, `clients/[id]/subscription`
(POST+DELETE). Total: 10 de 50.

**Decisão desta rodada:** em vez de só repetir o conserto rota a rota confiando na memória de "fiz
certo", escrevi uma guarda de fonte (`tests/unit/design/writeaudit-dentro-do-idempotente.test.ts`)
que confere, para as rotas já corrigidas, que `writeAudit(` está de verdade DENTRO do corpo
balanceado de `comIdempotencia(` — não só presente no arquivo. Isso transforma "eu revisei" em algo
que a próxima pessoa (ou eu, na próxima rodada) não pode desfazer sem o teste avisar. Verificado com
mutação: reintroduzi o defeito original em `inventory/entries` (voltei `writeAudit` pra fora), a
guarda reprovou nomeando a rota certa, restaurei.

`pnpm verify` verde. Testes relacionados às rotas tocadas (`lgpd.test.ts`, `pacotes.test.ts`,
`estoque.test.ts`) continuam verdes, sem regressão.

---

## 2026-09-28 · BL-42, terceira rodada — mais 5 rotas, e uma varredura de `growth-opportunities.md` que não achou alvo

Antes de continuar o BL-42, conferi as sete entradas de `growth-opportunities.md` (GO-0 a GO-6)
procurando um alvo alternativo, para variar de ticket. Nenhuma serve para esta sessão:

- GO-0: bloqueada por acesso a credenciais de produção (rodar um script, não código a escrever).
- GO-1: já decidida "não construir mais" (evidência insuficiente/já resolvido de outro jeito).
- GO-2: decisão do Eduardo (ligar `reminders` em produção — mensagem pra cliente final de terceiro).
- GO-3: bloqueada por GO-0.
- GO-4: causa raiz já corrigida em sessão anterior; o que resta é medir com GO-0.
- GO-5: "não é lacuna a preencher às pressas" — recomendação explícita de não implementar.
- GO-6: "não implementar agora" — recomendação explícita, e é a mesma família de "mensagem para
  terceiro" do GO-2.

Achado, não implementação: todo o documento de oportunidades de crescimento está genuinamente
esgotado para trabalho autônomo agora — sete de sete itens são bloqueio de acesso, decisão de
negócio, ou dependência de outro item bloqueado. Voltei para o BL-42, que continua sendo o alvo
mais produtivo disponível.

Mais 5 rotas corrigidas, por volume/valor: `clients/[id]/loyalty`, `campaigns`, `quotes`, `clients`
(maior volume do produto), `appointments/[id]/complete` (dispara recálculo síncrono do Motor —
provavelmente a rota mutante mais chamada do produto inteiro). Total: 15 de 50. Guarda de fonte
estendida e reverificada com mutação numa rota nova (`clients/route.ts`).

`pnpm verify` verde. Testes relacionados (`ciclo.test.ts`, `orcamentos.test.ts`, `comanda.test.ts`)
continuam verdes.

---

## 2026-09-28 (rodada 4) — BL-42 vira regra de ESLint; `test:integration` oscila por contenção de conexão, não por defeito

**Regra de ESLint em vez de rota por rota.** Depois de 3 rodadas fixando rotas uma a uma (15 de
50), o passo de maior alavancagem era parar de depender de memória humana para "não esquecer" uma
rota nova. `ciclo/writeaudit-dentro-do-idempotente` (`eslint-rules/index.mjs`) faz isso em AST,
mesmo mecanismo de `service-client-confinado`.

**Achado no meu próprio design, antes de commitar — vale registrar por ser exatamente a família de
defeito que este projeto já catalogou.** A primeira versão da regra era "todo `comIdempotencia`
sem `writeAudit` dentro do fechamento é erro". Passou nos 4 primeiros casos do teste e só quebrou
no quinto: "rota que não audita nada não pode ser reprovada". A regra estava certa para o padrão
que eu tinha em mente (writeAudit MOVIDO pra fora) mas cega para o caso real mais comum no código
(mutação que não tem — nem precisa ter — auditoria). Isso é `medição ingênua dá falso positivo` e
`guarda cega` ao mesmo tempo: eu tinha escrito a própria armadilha que a tabela do CLAUDE.md
cataloga, num arquivo que EXISTE para caçar essa família de defeito. Corrigido antes do commit: a
regra só acusa quando existe uma chamada de `writeAudit` em algum lugar da MESMA função que não
está dentro do fechamento — não quando `writeAudit` está simplesmente ausente.

`pnpm lint` bateu com a lista existente: 40 warnings em 34 arquivos, contra os "35 pendentes"
escritos à mão na rodada anterior — a diferença é a mesma classe de erro de contagem manual já
documentada nesta sessão (`.claude/ciclo/autonomous-backlog.md`, BL-42), e a regra nova existe
justamente para a ferramenta contar sozinha daqui pra frente.

**`test:integration` oscilando entre rodadas — não é regressão deste diff.** `pnpm verify` completo
rodou 3 vezes nesta sessão e falhou em arquivos DIFERENTES a cada vez: primeiro
`lembretes`/`comanda`/`cor-do-site` (todos com `AppError('INTERNAL', { cause: erroTenant })` saindo
de `executarOnboarding`), depois `job-queue` (contagem de concorrência, 997/1000)  e
`whatsapp-inbound` ("An invalid response was received from the upstream server" — a MESMA
assinatura do achado de Kong/Docker já documentado nesta sessão), depois `reconhecimento` (de novo
`executarOnboarding`) e `job-queue` de novo (999/1000). Nenhum desses arquivos toca
`eslint-rules/`, `eslint.config.mjs` ou o teste novo. Reproduzido: `docker restart
supabase_kong_ciclo` não resolveu sozinho desta vez (o padrão se repetiu depois do restart), mas
`vitest run --config vitest.banco.config.ts --dir tests/integration --poolOptions.forks.maxForks=2`
passou **430/430** de primeira — confirma contenção de conexão com o Postgres local sob paralelismo
alto (muitos arquivos de teste abrindo conexão ao mesmo tempo), não um defeito de código. Registro
aqui **para não confundir com bug de teste da próxima vez** (mesma cautela já registrada para o
achado do Kong): se `test:integration` falhar em arquivos que mudam a cada rodada e a mensagem for
`AppError INTERNAL` genérico ou "invalid response from upstream", rode de novo com
`--poolOptions.forks.maxForks=2` antes de investigar como bug.

`pnpm verify` (rodando os gates separadamente para confirmar, dado o achado acima): typecheck ✓,
lint ✓ (0 erros, 40 warnings novos e esperados), test:unit 2764 ✓, test:integration 430/430 ✓ (com
`maxForks=2`), test:rls 210 ✓, build ✓. Guarda nova mutada e vista reprovando antes do commit
(`d76d93f5`).

---

## 2026-09-28 (rodadas 5–10) — BL-42 fechado: 50 de 50 rotas, regra em "error"

Seis rodadas depois da 4 (que criou a regra de ESLint), o BL-42 foi de 15 para 50 rotas corrigidas
e a regra subiu de `"warn"` para `"error"`. Registro só o que é novo em relação à rodada 4 — o
mecanismo em si já está documentado lá.

**A lista manual de pendências foi abandonada de propósito a partir da rodada 5.** Mantê-la era a
própria fonte do erro de contagem já documentado nesta sessão (rodadas 1–3: "pelo menos 49",
depois "50", com um item esquecido no meio do caminho). A partir daqui, cada rodada regenerou a
lista com `npx eslint 'src/app/api/v1/**'` filtrando por `ciclo/writeaudit-dentro-do-idempotente` —
a ferramenta virou sua própria fonte de verdade sobre o que falta, em vez de depender de alguém
lembrar de atualizar um `.md`.

**Dois casos fugiram do padrão mecânico "mover a chamada para dentro" e mereceram desenho próprio:**

1. `clients/ja-atendo/route.ts` (rodada 6): `registrarPrimeiraOcorrencia` fica de propósito FORA do
   fechamento. Ela mesma se protege (`SELECT` antes do `INSERT` — "primeira ocorrência" é o próprio
   contrato da função), então repeti-la numa repetição idempotente é inofensivo — ao contrário de
   `writeAudit`, que sempre insere uma linha nova sem checar se já existe. Mover TUDO pra dentro por
   reflexo teria sido esconder essa distinção, não corrigi-la.
2. `account/route.ts` (rodada 10): não era uma chamada de `writeAudit`, era um LAÇO — um registro
   por vínculo/tenant (quem é `professional` em dois salões, por exemplo). Fora do fechamento, uma
   repetição não duplicaria uma linha, duplicaria N linhas (uma por vínculo). O laço inteiro
   precisou mover para dentro, não só a chamada individual.

**O passo final (rodada 10) foi verificado nos dois sentidos, não só um.** Antes de subir
`ciclo/writeaudit-dentro-do-idempotente` de `"warn"` para `"error"` em `eslint.config.mjs`,
confirmei `pnpm lint` limpo (zero erros, zero warnings) — subir a severidade com alguma rota ainda
pendente teria quebrado `pnpm verify` na hora. Depois de subir, testei o oposto: reintroduzi o
defeito em `waitlist/route.ts` (a mesma mutação de sempre) e rodei `pnpm lint` de novo — agora ele
FALHA de verdade (`ELIFECYCLE`, exit 1), não só avisa. Sem esse segundo teste, "subi a severidade"
seria uma afirmação não verificada — o mesmo espírito do procedimento de mutação, aplicado à
CONFIGURAÇÃO da regra, não só ao código que ela varre.

**O mecanismo final que fica:** duas guardas independentes, cada uma pega uma classe diferente de
regressão. `tests/unit/design/writeaudit-dentro-do-idempotente.test.ts` prova, rota por rota, que
as 50 já corrigidas continuam corrigidas — útil como documentação viva e como teste rápido em CI. A
regra de ESLint (`error`) pega QUALQUER rota, existente ou futura, sem precisar que ninguém edite
lista nenhuma — é ela quem realmente fecha o buraco de origem do BL-42 (alguém escrever uma rota
nova com o padrão errado e ninguém perceber na revisão).

`pnpm verify` da rodada final: typecheck ✓, lint ✓ (0 problemas com a regra em `error`), test:unit
2799 ✓, test:integration 430/430 ✓ (com `maxForks=2`), test:rls 210 ✓, build ✓.

---

## 2026-09-28 — Varredura: "confiar no `tenant_id` do corpo da requisição" — LIMPA (achado negativo)

Depois do BL-42 fechado, varri o código atrás da armadilha catalogada no CLAUDE.md ("Confiar no
`tenant_id` do corpo da requisição / Use sempre o do contexto validado"). Três checagens, cada uma
cobrindo uma superfície diferente:

1. `grep -rn 'tenantId:\s*z\.' src/` — **zero** schemas Zod (`EsquemaXxx`) declaram um campo
   `tenantId`. Se nenhum schema aceita o campo, `lerCorpo` nunca deixaria um `tenantId` do corpo
   chegar a lugar nenhum — a validação na borda (regra 7 do CLAUDE.md) já fecha essa porta antes de
   qualquer rota individual precisar se lembrar de ignorá-lo.
2. Todas as 80 rotas de `src/app/api/v1/**/route.ts` que usam `tenantId` o fazem via `ctx.tenantId`
   (de `contextoAtual(req)`, a sessão validada) — nenhuma lê de `entrada.tenantId`/`corpo.tenantId`/
   query string. As poucas ocorrências de `entrada.tenantId` que existem no projeto inteiro
   (`server/audit/write.ts`, `server/services/job-queue.ts`, `server/services/mensageria.ts`) são
   parâmetros de função de camada de SERVIÇO, sempre chamadas pela própria rota já passando
   `ctx.tenantId` — não são o corpo bruto da requisição HTTP.
3. Os dois webhooks públicos e não-autenticados (`webhooks/mercado-pago`, `webhooks/whatsapp`) —
   a superfície de MAIOR risco, já que não têm sessão nenhuma — não recebem `tenantId` do payload
   em lugar nenhum. O do Mercado Pago verifica a assinatura HMAC (`verificarAssinaturaWebhook`)
   ANTES de processar qualquer coisa, e resolve o tenant fazendo uma segunda chamada AUTORITATIVA à
   própria API do MP (`consultarPreapproval`, usando o `data.id` já verificado) — o `tenantId` que
   sai dali é `externalReference`, um valor que o PRÓPRIO CICLO gravou quando criou a assinatura, não
   algo que o payload do webhook possa forjar diretamente. O do WhatsApp resolve o tenant por busca
   no banco (telefone → tenant), não por um campo do payload.

**Resultado: nenhuma violação encontrada.** Registro aqui para a próxima sessão não reabrir esta
varredura sem evidência nova — mesma disciplina já aplicada a `growth-opportunities.md`.

---

## 2026-09-28 — Início da auditoria de `.claude/ciclo/loop-auditoria-armadilhas-catalogadas.md`

Escrito o plano completo (6 itens da tabela "Armadilhas conhecidas" do CLAUDE.md ainda não
conferidos com evidência medida nesta sessão) e já investigados os dois primeiros, ambos negativos:

**Item 1 (slot de agenda em horário local) — LIMPO.** `tests/unit/core/available-slots.test.ts`,
describe `'availableSlots — dia de mudança de horário de verão'`, já cobre exatamente o cenário da
armadilha: dias reais de transição de DST do Brasil (2018-11-04, dia de 23h; 2019-02-16, dia de
25h — confirmados contra `Temporal`, não fusos inventados), prova que o offset é resolvido PELA
DATA (não fixo), e prova que antecedência mínima atravessando a virada conta em tempo real, não em
"horas de relógio". Rodado (`npx vitest run tests/unit/core/available-slots.test.ts
tests/unit/core/dia-do-salao.test.ts`): 38/38 verde. Não é teste decorativo — é exatamente o
comportamento que a armadilha do CLAUDE.md descreve, testado contra datas reais.

**Item 3 (no-show automático) — LIMPO.** `grep -r marcarFalta src` encontra só 2 arquivos: a
própria definição (`server/services/agendamentos.ts`) e a rota autenticada
(`appointments/[id]/no-show/route.ts`, que exige `exigirPermissao` e uma pessoa logada chamando).
Nenhum cron, job ou chamada automática invoca `marcarFalta` — a regra do comentário `FAQ E68` no
código ("quem marca é o profissional, manualmente") é respeitada de fato, não só documentada.

Itens 2 (bloqueio por estoque negativo), 4 (delete no estorno), 5 (catch que descarta) e 6
(promessa de canal) ainda pendentes — continuar seguindo `loop-auditoria-armadilhas-catalogadas.md`.

**Item 4 (delete de movimento de estoque no estorno) — LIMPO, com prova forte já existente.**
`estornarBaixaDaComanda` (`server/services/estoque.ts`) nunca chama `.delete()` — gera um
movimento `return` novo, positivo, do mesmo tamanho do `out` original (comentário no código já cita
"F81: jamais delete o movimento original"). `tests/integration/estoque.test.ts`, teste "estornar
comanda fechada devolve o estoque com movimento return, sem apagar o out original", já prova isso
contra Postgres real: confere as DUAS linhas (`out` intacto E `return` novo) e o `stock_qty` final.
Rodado, verde. Achado negativo desde antes desta auditoria — só confirmado aqui.

**Item 2 (bloqueio por estoque negativo) — LIMPO, mas SEM prova antes desta auditoria.**
`baixarEstoqueDaComanda` tem o comentário certo ("F83: nunca bloqueia o fechamento por estoque
insuficiente... só desce o número, mesmo que fique negativo") e o código (`registrarMovimento`,
CAS por `stock_qty`) de fato não tem `throw` nenhum condicionado a `stock_qty < 0`. Mas não existia
NENHUM teste que vendesse mais do que o estoque tinha e confirmasse que o fechamento sucede — a
afirmação do comentário nunca tinha sido medida, só lida. Escrito o teste que faltava (`tests/
integration/estoque.test.ts`, "fechar comanda vendendo mais do que o estoque tem NÃO bloqueia"):
vende 5 de um produto com 2 no estoque, `fecharComanda` resolve sem lançar, `stock_qty` termina em
-3, o movimento registra -5 (o consumo real, não truncado no que havia). Rodado contra Postgres
real, verde. Achado negativo, agora com prova.

**Item 5 (catch que descarta sem contar) — ACHADO REAL, corrigido.** `cron/campaigns/route.ts`
tinha `try/catch` por tenant desde que foi escrita, mas o `catch` só logava — nenhum contador,
nenhuma exposição no corpo da resposta —, diferente dos três cron jobs irmãos
(`recompute-cycles`, `segments`, `stock-alerts`), que já tinham `falhas++` + `tenantsComFalha` no
retorno. O próprio guard que existe para essa classe de defeito
(`tests/unit/server/motor-de-ciclo-um-tenant-nao-derruba-o-laco.test.ts`) excluía `campaigns` da
lista com o comentário "já tinha try por item" — verdade só pela metade: o `try` existia, o
CONTADOR não. Corrigido: `falhas++` no catch, `tenantsComFalha` no retorno, evento de log
renomeado para o padrão dos irmãos (`campanha_diaria_tenant_falhou`), rota incluída na lista do
guard. Mutado (revertido o conserto) e confirmado que o guard reprova nos dois checks certos
(contador e exposição no corpo), nomeando `campaigns/route.ts`; restaurado. `lgpd-retention`
(também excluído da lista original) foi conferido à parte: usa `falhas.push(id)`/`falhas:
falhas.length` — padrão diferente (lista em vez de contador), mas correto; não cabe no regex
genérico do guard sem reescrevê-lo para os dois formatos, deixado como está.

pnpm verify: typecheck ✓, lint ✓, test:unit 2803 ✓, test:rls 210 ✓, build ✓. test:integration
431/431 com `--poolOptions.forks.maxForks=2` (1 falha isolada de `job-queue.test.ts` — a mesma
oscilação de contagem sob concorrência já documentada nesta sessão, arquivo não tocado por este
diff — 2ª rodada completa verde). Commit `ca1cbb09`.

**Item 6 (promessa de canal sem rota agendada + credencial) — LIMPO, achado já fechado numa sessão
anterior a esta auditoria.** Os dois pontos de maior risco (tela de confirmação de agendamento
público, `agendar.tsx`; tela de pedido de orçamento, `pedido.tsx`) têm comentário explícito
citando a violação EXATA que este item procura ("A frase anterior prometia 'você vai receber a
confirmação por WhatsApp', e isso era falso em três níveis: `criarAgendamentoPublico` não manda
nada para o cliente [...] e o WhatsApp não tem credencial [...] Nada chegava, nunca.") — já
corrigida, com o comentário deixado de propósito como lição. `lib/mensagens.ts`,
`saidaDeContato()`: a função central que decide "por onde a cliente fala com o salão" devolve
sempre um LINK que a PESSOA clica (`wa.me`/`tel:`), nunca uma alegação de envio automático — o
próprio docstring da função registra a distinção ("Nada aqui é promessa de canal: quem manda a
mensagem é a pessoa, no aplicativo dela"). Conferido também que o comentário cita uma varredura
mais ampla já feita ("`DECISOES` de 05/09 registrou ao varrer as 16 linhas de canal"). Nenhuma nova
violação encontrada nas 34 ocorrências de "WhatsApp" em `.tsx` fora de `/admin/**` — o restante são
links de contato do próprio negócio (`secoes.tsx`), texto institucional (`termos`, `privacidade`)
ou comentário/nome de variável.

**Com isto, os 6 itens de `loop-auditoria-armadilhas-catalogadas.md` estão todos investigados:**
1 e 3 limpos (rodada anterior), 4 limpo com prova preexistente, 2 limpo com prova nova escrita
nesta rodada, 5 achado real e corrigido, 6 limpo (achado de sessão anterior, confirmado). Um
conserto real de seis itens — proporção saudável para uma varredura de armadilhas já conhecidas,
não hipóteses: a maioria já estava certa porque as sessões anteriores já tinham corrigido essa
classe de defeito quando apareceu.

---

## 2026-09-28 (continuação) — Duas armadilhas de dinheiro além do plano dos 6 itens

**"Calcular desconto percentual e guardar o percentual" — LIMPO, agora com prova.** `grep -r
discount_bps\|discountBps src/ supabase/migrations/`: zero ocorrências no projeto inteiro.
`comanda.ts` usa `discount_cents` em toda parte; `orcamentos.ts`/`pacotes.ts` não têm conceito de
desconto. Leitura confirma que `unit_price_cents`/`discount_cents`/`total_cents` são gravados uma
vez no INSERT do item, nunca recalculados de `services.price_cents` na leitura — mas não havia
teste medindo essa afirmação. Escrito `tests/integration/comanda.test.ts` (serviço PRÓPRIO, não o
`servicoId` compartilhado do describe, para não poluir os testes seguintes que esperam preço
10.000 — mesma armadilha de poluição já documentada nesta sessão): vende com desconto, muda o
preço do serviço depois, relê o item e confirma que nada mudou. Rodado contra Postgres real
(`comanda.test.ts` inteiro, 22/22), verde, sem poluir os demais testes do arquivo. Commit
`f488991a`.

**"Reconhecer receita de pacote na venda" — LIMPO, achado de sessão anterior já fechado, NÃO
reaberto.** Minha primeira leitura (`venderPacote` só insere em `packages`, com `paid_cents`;
`consumirSessao` só incrementa `used_sessions`; nenhum dos dois toca `payments`/`ticket_items`)
quase me levou a marcar como possível achado real — mas `docs/DECISOES.md`
("2026-09-18 · Terceiro mecanismo de pagamento não-avulso: pacote com sessão sobrando") já
investigou e fechou EXATAMENTE esta linha do CLAUDE.md, com uma correção importante de
interpretação que eu teria perdido lendo só o código: `paid_cents` cobrado NA VENDA é o desenho
CERTO, não o defeito — é dinheiro que já entrou de verdade (`clients.ltv_cents` reflete isso de
propósito, "é uma venda que JÁ aconteceu"). O defeito real que essa armadilha descrevia NESTE
projeto era outro: o Motor de Ciclo (`value_at_risk_cents`/`profit_at_risk_cents` em
`client_cycles`, e `receitaAtribuidaAoCiclo`/`receitaPorCampanha`) tratava um cliente com sessão de
pacote sobrando como se a próxima visita fosse uma venda avulsa nova em risco — dinheiro contado
DUAS vezes (uma na venda do pacote, outra como "risco" da sessão que ele já pagou). Corrigido
2026-09-18 com 7 testes de integração novos, e a varredura de lá já cobriu os TRÊS mecanismos de
pagamento não-avulso (clube, pacote, comanda normal via `caixa.ts`/`resumo-hoje.ts`). Não reaberto
aqui — só confirmado que a lição já existe e onde ela mora, para a próxima sessão achar mais rápido
do que eu achei.

**Terceira armadilha (fallback do plano): "cachear `/vault`/mídia assinada no service worker" —
LIMPO, guarda dedicada já existe e passa.** `tests/unit/design/sw-nao-cacheia-tela-privada.test.ts`
(5 testes, rodado, verde) cobre exatamente esta inviolável: `public/sw.js` tem uma deny-list por
prefixo, testada com controle POSITIVO (uma rota pública tem que passar, não só a privada tem que
ser negada — `/precos`/`/` confirmados fora da deny-list) e cobre nominalmente `/api/v1/clients/X/
vault`. Nada a fazer.

---

## 2026-09-28 (continuação) — Duas últimas linhas da tabela de armadilhas: limpas, uma medida ao vivo

**"Texto de erro escrito para o profissional numa tela pública" — LIMPO, guarda já muito madura.**
`src/app/error.tsx` já é exatamente o conserto que a regra pede: decide a saída por `usePathname()`
(`noPainel = caminho.startsWith('/admin')`), com mensagem e botão DIFERENTES para painel vs. rota
pública, nunca `/admin/hoje` fixo. Duas guardas já provam isso, não uma: `erro-nao-manda-cliente-
pro-admin.test.ts` (8 testes — inclusive uma segunda metade que varre TODOS os boundaries do Next
por DIRETÓRIO, não por lista fixa, então um `global-error.tsx`/`not-found.tsx`/`error.tsx` de
segmento NOVO entra sozinho na varredura — precedente direto do `[[guarda-cega-de-raiz]]`) e
`boundary-de-erro-tem-saida.test.ts` (9 testes). Rodados: 17/17 verde. Grep complementar por
`tenant_id|tenantId|RLS|Postgres|stack trace` em `src/app/(public)/**/*.tsx`: a única ocorrência de
"RLS" é na página de privacidade, em contexto de explicação legítima ao usuário, não vazamento de
erro. Nada a fazer.

**"`toque-48` em dois links no mesmo parágrafo" — LIMPO, medido AO VIVO no navegador, não só lido.**
As duas guardas de fonte existentes (`alvo-de-toque-tem-48.test.ts`,
`alvo-de-toque-tem-largura.test.ts`) verificam presença de classe (`toque-48`/`px-2`), nunca
geometria computada — e isso é DELIBERADO, documentado no próprio docstring
("esse caso continua sendo trabalho de medição no navegador"), porque jsdom não computa layout CSS
de verdade. Escrever um teste Vitest que "sonda geometria" seria fingir medir. Em vez disso, rodei a
MESMA receita de `elementFromPoint` que o achado original de 2026-09-09 usou, ao vivo, contra o
servidor de dev (`pnpm dev` via `.claude/launch.json`), a 320px de largura — a mesma régua e o mesmo
viewport do achado original:
- `/precos`: sondagem em X (largura) e Y (altura) dos 8 links do rodapé/CTAs. Nenhum com área
  efetiva zerada; "Termos"/"Privacidade"/"Voltar para o início" (o trio inline, exatamente a
  situação da armadilha) com largura efetiva 58/81-82/81+ px, batendo com a largura visual.
- `/` (landing): mesma sondagem nos links "Preços"/"Termos"/"Privacidade" do rodapé — 56/58/82 px
  efetivos, batendo com a largura visual (55/58/82).

Nenhum link com o padrão do defeito original ("o vizinho cobre o segundo, que fica com zero").
Confirmado hoje, não presumido pelo commit antigo. Servidor de dev parado ao final
(`preview_stop`), viewport resetado para desktop.

**Com isto, a tabela "Armadilhas conhecidas" do CLAUDE.md está esgotada para varredura nesta
sessão** — toda linha catalogada foi conferida ao menos uma vez, com achado negativo (a maioria) ou
achado real corrigido (BL-42's causa original, o item 5 do plano de auditoria/`cron/campaigns`).
Próxima sessão: não reabra sem evidência nova. Se quiser continuar essa família de trabalho, a
avenida que resta é (a) mecanizar mais regras do CLAUDE.md por AST, ou (b) segunda leitura crítica
do que esta própria sessão escreveu.

---

## 2026-09-28 (continuação) — Nova regra de ESLint: regra 3 do CLAUDE.md (dinheiro em centavos)

Escolhida a alternativa (a) do fallback acima. `ciclo/dinheiro-em-centavos-inteiros`
(`eslint-rules/index.mjs`) mecaniza a regra 3 do CLAUDE.md ("dinheiro em centavos, percentual em
basis points, nunca float") no limite onde ela é verificável por AST: todo campo de schema Zod
terminado em `Cents`/`Bps` precisa recusar fração (`z.number().int(...)` ou `z.int(...)`).

Varredura ANTES de escrever a regra (`grep -rn "Cents:\s*z\.number\|Bps:\s*z\.number" src/ |
grep -v '\.int()'`, e uma segunda passada mais ampla): **zero violações no projeto inteiro** — todo
campo já usa `.int()` ou o `z.int()` direto do Zod 4. Diferença importante do BL-42: lá havia 50
rotas para corrigir antes de subir a severidade; aqui a regra nasce direto em `"error"`, sem
estágio `"warn"`.

Cuidados de design (mesma disciplina das duas regras anteriores): só dispara quando o valor tem
raiz `z.` de verdade (uma referência a variável não dá pra verificar por AST — reprovar seria
adivinhar, não conferir) e só quando a raiz é `z.number()`/`z.int()` (campo homônimo não-numérico
fica fora do escopo). Teste novo
(`tests/unit/design/dinheiro-em-centavos-inteiros.test.ts`, `RuleTester`, 8 casos) cobre o padrão
errado, o certo em duas variações (`.int()` em qualquer ordem, `z.int()` direto), o sufixo `*Bps`
além de `*Cents`, nome que só TERMINA parecido ("recents"), `Cents` no MEIO do nome, referência a
variável e campo não-numérico.

Mutação contra código REAL (não sintético): removido `.int()` de `discountCents` em
`comanda.ts` (`EsquemaDescontoGorjeta`) — `pnpm lint` reprovou de verdade (`exit 1`, `ELIFECYCLE`),
nomeando o campo e o arquivo certos; restaurado, `pnpm lint` voltou a zero. `pnpm verify` completo:
typecheck ✓, lint ✓ (0 problemas), test:unit 2811 ✓, test:rls 210 ✓, build ✓, test:integration
432/432 com `--poolOptions.forks.maxForks=2`. Commit `a454450d`.

---

## 2026-09-28 (continuação) — Segunda leitura crítica de 5 arquivos: nada encontrado (bom sinal)

Mesmo método que achou BL-42, BL-43 e o defeito do `cron/campaigns` (reler o próprio trabalho
recém-commitado com ceticismo, não confiar que "já foi corrigido uma vez" basta). Cinco arquivos,
cinco investigações de verdade, zero defeitos:

1. **`account/route.ts` (laço de writeAudit por vínculo).** A dúvida: usar `sessao.userId` como
   `tenantId` do `comIdempotencia` é seguro? Segui a cadeia até `withTenant`/`withNovoTenant`
   (`server/db/with-tenant.ts`): as duas só validam formato UUID e devolvem `createServiceClient()`
   — nenhuma delas seta contexto de RLS a partir do valor. Confirmado no schema (`0001_initial.sql`):
   `idempotency_keys.tenant_id` é `uuid` solto, sem FK, `force row level security` **sem política
   nenhuma** ("sem políticas = ninguém lê pelo cliente"). Ou seja: a tabela só é tocável por
   `service_role` mesmo, e não exige que o valor seja um `tenants.id` de verdade. Uso de
   `sessao.userId` é seguro E correto, não só "parece certo".
2. **`tickets/[id]/route.ts` (leitura extra após o fechamento).** A dúvida: `buscarComanda` rodando
   de novo, fora do `comIdempotencia`, pode divergir do que uma repetição "deveria" devolver?
   Confirmado que é uma leitura PURA (sem mutação), e que o fechamento — que contém a ÚNICA mutação
   e o `writeAudit` — só roda uma vez independente de quantas vezes a rota é chamada. Uma leitura
   fresca a mais não duplica nada; na pior hipótese devolve um estado mais atual, nunca um estado
   corrompido ou uma ação repetida.
3. **`cron/campaigns/route.ts` (contagem e janela).** Duas perguntas concretas do prompt: (a) tenant
   demo/pausado pular o incremento de `tenantsProcessados` está certo? Sim — eles nunca foram
   CANDIDATOS a processamento, contar como "processado" inflaria a métrica sem significar nada. (b)
   A janela (`TOLERANCIA_HORAS = 3`, `core/cron/janela.ts`) é larga o bastante para o atraso real do
   GitHub Actions (36-56min documentado)? Sim, com folga — e há teste dedicado
   (`cron-sobrevive-a-atraso.test.ts`) recalculando a garantia para quatro fusos a cada build, não
   um número solto em comentário. Rodado: 6/6 verde.
4. **`eslint-rules/index.mjs` (as 3 regras existentes).** Os dois casos de borda sugeridos no prompt
   para `dinheiro-em-centavos-inteiros`: `.optional()` ANTES de `.int()` não é um caso real — a
   própria tipagem do Zod não expõe `.int()` depois de `.optional()`/`.nullish()` (confirmado contra
   o uso real do projeto: `.int()` sempre vem antes). União com `z.string()`
   (`z.number().int().or(z.string())`) é uma lacuna real da regra, mas não ocorre em lugar nenhum do
   projeto hoje — registrado como limitação conhecida, não corrigido por especulação (over-
   engineering contra um caso fantasma é o mesmo erro pelo avesso de uma guarda cega).
5. **`packages/[id]/use/route.ts`.** Estrutura limpa: `comIdempotencia` devolve o valor usado como
   resposta (ao contrário de `tickets/[id]`, que descarta), `writeAudit` dentro do fechamento,
   `consumirSessao` internamente já usa CAS (`used_sessions`). Nada a apontar.

**A releitura não achar nada em 5 arquivos não é falha de busca — é evidência de que o trabalho
está sólido**, exatamente como o próprio plano desta rodada previu. Pivotei para a alternativa (a)
sugerida: nova regra de ESLint, `ciclo/sem-delete-em-tabela-append-only` (regra 11 do CLAUDE.md).
Achado no processo, não hipotético: a primeira varredura manual (`grep` só em `src/`) escondeu 9
ocorrências legítimas de `.delete()` em `tests/**`/`scripts/**` que só `pnpm lint` revelou — o
próprio teste de RLS PRECISA chamar `.delete()` para provar que o banco bloqueia, e scripts de seed
recriam demonstração do zero. Resolvido com o mesmo escopo de isenção já usado por
`service-client-confinado`. Mutação contra código real (appointments.ts, `.delete()` acrescentado e
removido): `pnpm lint` reprovou de verdade. `pnpm verify` completo: typecheck ✓, lint ✓ (0
problemas), test:unit 2819 ✓, test:rls 210 ✓, build ✓, test:integration 432/432 com
`--poolOptions.forks.maxForks=2` (1 falha isolada em `agendamentos.test.ts` na 1ª rodada — arquivo
não tocado por este diff, mesmo padrão de contenção já documentado; 2ª rodada completa). Commit
`c7e4ee92`.

**Motivação da nova regra, além do texto literal da regra 11:** a proteção de RLS (migration
`0081`, `tests/rls/append-only-nao-se-apaga.test.ts`) só vale para o cliente do USUÁRIO —
`service_role` (`withTenant`/`withNovoTenant`, o caminho que a maioria do código de servidor usa)
ignora RLS por desenho (`BYPASSRLS`, confirmado nesta sessão ao investigar um bug totalmente
diferente, ver entrada de `eliminarCliente`/`client_cycles`). A regra de ESLint fecha a MESMA porta
no código-fonte — camada extra, não substituta da proteção do banco.

---

## 2026-09-28 — Missão de onboarding + migração: plano em `docs/83`, um bug real (BL-51)

Missão `.claude/ciclo/loop-migracao-de-concorrentes.md`, rodada em Opus 5.5. Entregável:
`docs/83-ONBOARDING-E-MIGRACAO-PLANO.md`. Achados que valem fora do plano:

- **BL-51 [medido]:** o importador de CSV corrompe acento de arquivo Windows-1252 (o "CSV" do Excel
  em PT-BR) e descarta em silêncio toda data `dd/mm/aaaa` — o Motor nasce vazio para quem migra de
  planilha. Ponto-e-vírgula funciona. Medido com teste temporário contra a função real, apagado
  depois.
- **GO-1 reconciliado, não contradito:** o veredito "não construir mais migração" continua certo
  sobre parsers por concorrente. O que muda é roteamento/argumento/confiança em volta do que existe,
  e o BL-51 é exatamente a "fricção dentro da feature que já existe" que o próprio GO-1 previu.
- **Concorrência [evidência, 28/09]:** AppBarber importa só clientes/serviços/produtos, por chamado,
  até 5 dias úteis, sem histórico; "Taxa de Retorno" deles é relatório manual por período. Belasis
  usa janelas fixas de 30/60/90 dias e promete "IA que traz cliente de volta" — "trazemos cliente
  de volta" sozinho não diferencia o CICLO. BarbUp anuncia migração sem custo. Trinks exporta
  clientes em Excel (colunas exatas não verificadas). "Beleza na Web" não é concorrente (loja de
  cosméticos).
- **Lacuna de confiança:** o CICLO não tem exportação da base inteira pelo dono (só `data-export`
  por cliente, LGPD). "Traga na hora, leve na hora" não pode ser prometido até existir.
- **Tela de 3 respostas não cresce:** freio deliberado em `onboarding/page.tsx`. Perguntas de
  qualificação vão para uma tela pulável DEPOIS da conta criada.

---

## 2026-09-28 — Dados e inteligência (`docs/84`): o que o mercado já tem e o que falta a todos

- **"IA que opera o negócio" é commodity em 2026 [evidência]:** GlossGenius virou Genius AI
  (21/07/2026, US$ 1,15 bi, 125 mil negócios, agentes que agem sozinhos). No Brasil: Barberia.io,
  BarberAI, BarberFlow AI, RobotiZap, Simples Agenda, Belasis, Trinks. Até o Genius AI decide quem
  sumiu por janela fixa (seis semanas) — o ritmo pessoal do Motor continua diferença real.
- **Não encontrado em software de agenda:** simulador "e se" com dados do próprio negócio;
  experimento ligado pelo dono e medido pelo sistema; mapa de vazamento de receita como TELA
  (existe como artigo/relatório: Salon Today, Zenoti). Comparativo com outros negócios por dado
  agregado existe só na Zenoti, só EUA.
- **Metade da visão já está construída [fato]:** Motor, previsão auditada, valor em risco, lucro por
  cliente, concentração, margem do clube, cadeira vazia (`ociosidade.ts`), assistente com 13
  ferramentas que PREPARAM ações para o dono confirmar.
- **Sinal que se perde hoje:** a página pública não registra quando alguém procura horário e não
  acha (`disponibilidadePublica`). Demanda não atendida é o dado que tornaria o simulador "abrir
  sábado" e o vazamento "horário vazio" honestos.
- **Histórico de preço já existe sem ninguém usar:** `audit_log` grava `service.update` com
  antes/depois — base do simulador de preço e dos experimentos.
- **Os termos hoje não permitem nenhum uso agregado:** `/privacidade` §1 põe o CICLO como operador e
  §3 promete não usar dados para nada além do serviço. A estratégia de dados do Eduardo precisa de
  cláusula nova + aceite versionado (BL-50) — e é jurídica, não decidida aqui.

## 2026-09-29 · BL-51 fechado, C-07 de fim de mês, MI-1 (Motor de Inteligência)

- **"Importe de novo" era instrução falsa, e morava em duas frases do importador.** A segunda
  importação pula quem tem telefone (a ficha existe, o ciclo nunca é criado) e duplica quem não tem
  (sem telefone não há o que comparar). O caminho que funciona é "Quem você já atende" (`retornos`:
  ficha existente + serviço + data). Só apareceu importando um CSV Win-1252 de verdade na tela.
- **Teste que depende do calendário passa 28 dias por mês.** C-07 do clube chamava `assinar` com
  `billingDay: hoje.day`; `billing_day` é 1..28 (check da 0019). Quebrou em 29/09 com INTERNAL. O Zod
  da borda protege o produto; só o teste furava. Mesma família do 139d8c22 (UTC × fuso).
- **Outra sessão commitou "trabalho solto" no mesmo working tree** (8e05904c) e levou junto arquivo
  temporário desta. Duas sessões na mesma árvore: `git add` sempre por nome, e a divisão de trabalho
  ficou escrita em `.claude/ciclo/loop-onboarding-migracao-inteligencia.md` (Fase 3 é desta sessão).
- **MI-1: o Motor entende sem IA e, principalmente, não chuta.** Sonda com 31 frases nunca vistas:
  9 entendidas, 0 erradas. O que ele não entende divide em (a) lacuna de vocabulário — vira gabarito
  e conserto — e (b) pedido que nenhuma ferramenta atende ("desmarca a Joana", "quanto custa o
  corte"): ali "não entendi" é a resposta CERTA e está escrita como tal no teste.
- **A guarda de gênero pegou o vocabulário de ENTRADA** ("obrigado" na lista do que o Motor ignora).
  Em vez de afrouxar a guarda, agradecimento virou cortesia pelo prefixo `obrigad*` — um item cobre
  as duas formas. A guarda continua valendo para o que o produto fala.
- **Guarda sem caso próprio para o piso**: trocar `PISO` por 0 passava verde (nenhuma frase do
  gabarito ficava só com peso 1). Achado ao planejar as mutações, antes de rodá-las; caso próprio
  em dfd1ef4f. 6 de 6 mutações reprovam.

## 2026-09-29 · MI-2: o assistente sem Gemini, medido no navegador

- **Desempenho:** 22 perguntas pela rota real, 200 em ~220-350 ms cada (Gemini: 2-8 s, medido em
  30/08). Cada resposta conferida contra o banco local — o Motor não disse nada que o banco não
  sustentasse.
- **Senha na URL (b9c1c3b8):** achado de passagem. Enter antes da hidratação mandou e-mail e senha
  como query string (`<form>` sem method = GET). 15 formulários, 4 com credencial, 1 público com
  dado de cliente do salão. `method="post"` + guarda com controle positivo.
- **`pnpm build` com o dev server rodando derruba o dev server** (mesmo `.next`): chunks somem,
  toda página dá 500. Parar o preview antes do build, apagar `.next`, subir de novo.
- **Três defeitos que só a pergunta real mostrou (3db106b6):** telefone cru, "com a Juliana" virando
  serviço, e "qual profissional?" sem jeito de responder. Nenhum teste unitário os teria pedido.
- **Demonstração oca:** 133 atendimentos concluídos, 0 comandas, 0 ciclos no seed dos 6 negócios.
  "R$ 0,00" e "ninguém sumiu" são verdade ali — e parecem produto quebrado numa demo (DECISOES).

## 2026-09-29 · MI-4 e MI-7 no ar (local), e duas frases que mentiam

- **MI-4 medido no chat de verdade:** "e sexta?", "e da Xênia?" (herda o FOCO: telefone), "qual
  profissional?" → "a Camila" → cartão completo. O contexto vai e volta pelo navegador, validado por
  esquema fechado; forjado não abre ferramenta fora do papel (três barreiras; a do laço basta).
- **A rota descartava o contexto** (lista explícita de campos) e os 34 testes do Motor passavam —
  eles chamam o laço, não a rota. Só o navegador mostrou. `corpoDaResposta` agora é testada.
- **MI-7 desviou do plano de propósito:** docs/85 dizia gravar "as palavras que sobraram". A frase
  não entendida é a que ninguém filtrou — nome e dado de saúde (regra 9). Grava só motivo + tema de
  lista fechada. Medido no banco: pergunta sobre reação alérgica gravou `{motivo, tema: "outro"}`.
- **"Sobrou" mentia para quem respondeu o custo fixo (56c71009):** a frase dizia sempre "ainda não
  desconta o custo fixo", falsa desde a 0072 (06/09) para quem respondeu. Mesma armadilha da
  maquininha; mesma fonte da tela do caixa agora.
- **Cartão de confirmação mostrava "duracaoMin 60"** (4520339d) — nome interno do campo, cru.

## 2026-09-29 · MI-5 e MI-6: explicar e simular, medidos com dado real

- **"Por que caiu?" compara os MESMOS dias** (1–29/09 × 1–29/08). Mês corrente contra o anterior
  inteiro "cai" todo mês; a armadilha estava no desenho, não no código.
- **O teste pegou `lembrar` herdando o assunto sem o período:** "quanto faturei em agosto?" → "por
  quê?" explicava setembro.
- **"R$ 2.500" não era dinheiro** para o `entender` (milhar com ponto). Pego pelo teste do MI-6.
- **Dado real mostrou o que o teste com 30 atendimentos não mostrava:** com 5 cortes em 90 dias,
  "1 em cada 10" e "2 em cada 10" davam o mesmo número. Volume < 10 conta em PESSOAS.
- **O dono disse "de R$ 80" e o preço real era R$ 85:** a resposta abre com o preço de verdade.
  Premissa do dono sobre o que perde, sim; sobre o preço atual, não — esse vem do catálogo.
- **O teto de uso (429) aparecia como "não consegui responder"** — a rota mandava a frase certa e o
  chat descartava. Corrigido (01d8a608).
- Heredoc de ~8 KB estourou de novo (`unexpected EOF`) — nada aplicado, conferido antes de refazer.
  Script Python em arquivo no scratchpad resolve e ainda evita o `\b`→backspace.

## 2026-09-29 · Demanda não atendida gravando (docs/84 §2.2)

- `demanda_nao_atendida` em product_events, sem dado pessoal (chaves exatas conferidas em
  integração). Medido pela rota pública de verdade: domingo do Studio Bella → 0 horários → gravou
  `dia_fechado`; quarta com 95 horários → nada.
- **Opt-in de propósito:** `disponibilidadePublica` também valida a RESERVA; gravar ali contaria
  a mesma procura duas vezes.
- **Profissional sem expediente próprio cai no padrão do salão** — quarta não era "fechada" no
  fixture. A precondição do teste pegou antes de a asserção mentir.
- **Contar evento ≠ contar gente:** a mesma pessoa espiando o domingo 3 vezes gera 3 eventos (sem
  dado pessoal não há como deduplicar pessoa). Quem for LER isto (mapa de vazamento, "e se eu abrir
  sábado?") deve contar pares distintos (serviço, dia), não linhas.
- `/privacidade` intocada; frase sugerida em DECISOES para o Eduardo.

## 2026-09-29 · Mapa de vazamento v1 e BL-50

- **Mapa de vazamento no topo de "O mês"** (ba4abe1d): só composição de cálculos existentes; R$ só
  onde é medido. Medido no navegador com 3 procuras reais em domingos: a linha apareceu com "3
  procuras" — e eram 4 eventos (o mesmo domingo 2 vezes): contar pares distintos segurou o número.
- **BL-50** (e6efbdc9): aceite versionado, migration 0095 que precisa ir ANTES do deploy (senão
  todo cadastro novo falha). A guarda `schema-esperado-bate-com-o-disco` reprovou até a contagem de
  migrations ser atualizada — funcionando como desenhada.
- **Mutação inválida não é prova:** duas vezes hoje a mutação não compilou ("no tests") ou não
  casou (multilinha × CRLF). Ambas refeitas antes de contar como "guarda vista reprovando".
- `pnpm db:types` exige `supabase` no PATH; com `npx supabase gen types --local` para arquivo
  temporário, validar e só então copiar (redirecionar direto no arquivo versionado o zera se falhar).

## 2026-09-29 · docs/85 fechado (MI-1…MI-7) e o loop de 83/84 concluído

- **Motor de Inteligência inteiro sem IA externa:** entender (MI-1), trocar o Gemini (MI-2),
  próximo passo em botão (MI-3), conversa com contexto (MI-4), "por que caiu?" (MI-5), "e se...?"
  (MI-6), contar o que não soube (MI-7). Cada peça medida no chat de verdade contra o banco local.
- **Loop 83/84:** BL-51, demanda não atendida, BL-50 e mapa de vazamento v1 — todos com mutação.
- **Cartão dizia "Marcado." para qualquer ação** (93093e44) — achado lendo o código do cartão.
- **Pendências que são do Eduardo** (todas em DECISOES com a pergunta exata): migration 0095 ANTES
  do deploy; frase da /privacidade sobre demanda não atendida; teto de uso do assistente; seed de
  demonstração oco (0 comandas, 0 ciclos).

## 2026-09-29 · P3 exportação terminado; a data que voltava um dia

- **`last_visit_at` gravado como data pura = meia-noite UTC = dia anterior em Brasília** (2f78a103).
  Importação e "Quem você já atende" desde 10/09. Conserto: meio-dia UTC na escrita + migration 0096
  que normaliza só o que não veio de atendimento (medida antes/depois com linha de controle).
- **Duas guardas passavam verde com o defeito**: uma cortava a string no "T", outra só checava
  `toBeTruthy`. Ambas vistas passando na mutação e corrigidas para comparar o DIA no fuso do salão.
- **Guarda que lista por `git ls-files` é cega a arquivo novo antes do commit:** o `verify` local passou
  com dois travessões na copy do P3 (arquivos untracked da outra sessão). `git add -N` fez a guarda
  enxergar. Vale para toda guarda de fonte desta base.
- P3 retomado da outra sessão (parada desde 28/09 23:45) — commit com as duas autorias.
- BL-52 registrado: "hoje" no fuso do servidor em "Quem você já atende".

## 2026-09-29 · Memória do cliente (docs/84 P4)

- **Tudo derivado dos atendimentos concluídos, sem coluna nova**; ficha e assistente dizem a MESMA
  frase, com a contagem ("5 de 7 visitas"). Pisos: 4 visitas para dia, 3 para profissional (e só
  com 2+ pessoas ativas), 3 intervalos para faixa. Empate não escolhe.
- **Visita = dia**, não atendimento: corte + barba no mesmo dia inflaria o hábito e criaria um
  intervalo de 0 dias. Faixa do quartil de baixo ao de cima (nearest-rank): a volta de 90 dias
  depois das férias não estica a faixa de quem vem todo mês.
- **Fuso:** o teste de integração grava quarta 01:00 UTC = terça 22:00 em SP. A mutação "dia em UTC"
  foi pega por ele; 12 de 12 mutações pegas.
- A guarda `agrega-lendo-tudo` ancorava no texto exato do select da ficha e **reprovou** quando
  ganhei a coluna do profissional (grita em vez de passar vazia, como desenhada). Âncora atualizada;
  a regra que ela guarda não mudou.
- **Seed:** medido no navegador, Vinícius (Studio Bella) = 5 terças com a mesma profissional a cada
  21 dias. No seed TODO cliente é perfeitamente regular, então a demo sempre mostra "sempre" e "5 de 5":
  é o mesmo seed oco já registrado (DECISOES 29/09), não defeito da memória. Nesses clientes sem
  `client_cycles` a memória é a ÚNICA linha de ritmo da ficha.

## 2026-09-29 · "Resolve" no assistente (docs/84 P2) e dois números que mentiam

- **"Resolve" = chamada de volta pelo WhatsApp DO DONO**, não envio pelo sistema: mesma lista
  (`listarParaRecuperar`), mesmo texto (`textoDeVolta`), mesma rota (`/cycle/recover/manual`), mesma
  permissão e módulo. O cartão tem LINK (a aba nova só abre de dentro do toque), host fixo `wa.me`,
  número só como E.164, texto codificado. Medido no navegador: link certo, "Chamada anotada", e
  `messages.recover_manual` + `last_campaign_at` gravados no banco local.
- **A rota responde 200 sem anotar** (`registrada: false`, já chamada na semana): o cartão agora diz
  isso em vez de "anotada".
- **Duas guardas reprovaram como desenhadas**: `permissao-igual-a-da-rota` (ferramenta nova de preparo
  sem mapa) e o "não chuta" do `entender` ("manda mensagem pra Joana" era o exemplo de pedido sem
  ferramenta; o tema `mandar_mensagem` ficou guardado por "manda um lembrete pra todo mundo").
- **Achado medindo: "-2 dias sem voltar"** na resposta de "quem eu chamo primeiro?". A fila é por
  lucro e `due` (até 3 dias ANTES da data) entra com atraso ≤ 0. A tela Recuperar já dizia "na janela".
- **Achado vizinho: "14 clientes passaram da hora de voltar"** no Hoje e o título do mapa contavam os
  `due` também (3 de 14). Virou "para chamar de volta". Só apareceu porque recalculei o Motor no seed
  (o seed tinha 0 ciclos). Seed oco esconde defeito de texto, não só de número.
- Heredoc de ~8 KB estourou de novo (nada aplicado). Script em arquivo resolveu.

## 2026-09-29 · Experimentos v1 (docs/84 Aposta C) e a missão fechada

- **O antes é congelado na criação** (`experiments.baseline`), e o início só pode ser hoje ou depois:
  sem isso, o dono escolheria o "antes" depois de ver o resultado. Mutação "antes recalculado na
  leitura" pega pelo teste que conclui um atendimento do período de antes DEPOIS de criar o teste.
- **Sem veredito enquanto roda, e o dia de hoje não conta** (ainda pode ter atendimento). "Subiu/caiu"
  só com 20+ atendimentos nos dois períodos e 10%+ de diferença; amostra sempre junto.
- **Concordância:** "Nos 2 quintas" saiu na primeira versão. Dia útil é feminino e sábado/domingo
  masculino, e uma quinta só é "na quinta". Pego pelo próprio teste.
- A guarda do estado vazio reprovou (`acao={null}`): o vazio agora leva ao formulário (ou a "O mês",
  para quem não pode criar).
- `pnpm test:rls` falhou uma vez com "invalid response from the upstream server" no seed de
  `client_reviews` (infra local). Rodado de novo: verde. Não é defeito da tabela nova.
- No navegador, cada campo aparece duas vezes na árvore de acessibilidade: é o `<div hidden id="S:0">`
  do streaming do React no dev, em toda tela. Conferido no DOM (0×0, `hidden`) antes de chamar de defeito.
- 11 de 11 mutações pegas; medido no navegador: antes = 1 atendimento em 2 quintas (bate com o banco),
  auditoria `experiment.create`, cancelar funciona, 390 px sem rolagem lateral e alvos de 48 px.
