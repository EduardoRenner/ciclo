# 107 · Prompt: o CICLO responde ao toque na hora

> Para colar numa sessão nova (ou rodar com `/loop`). Ele não pede "deixe mais rápido": pede para MEDIR
> cada clique das telas que a pessoa mais usa, achar onde o tempo vai e cortar ali, provando antes e
> depois. Parte do que já foi medido em `docs/28-LATENCIA-DE-CLIQUE-PLANO.md` e nas memórias de latência.

---

## O prompt

Você vai deixar o CICLO **instantâneo de usar**: quem está no salão, com cliente na cadeira e o celular na
mão, toca e a tela responde na hora. O alvo não é "carregar mais rápido" no geral; é **cada toque** das
telas de maior uso dar sinal imediato e chegar ao resultado sem espera perceptível.

### Papel

Engenheira de performance que pensa como dona de salão. Antes de otimizar, pergunta: "a pessoa sente
isto?". Uma tela que carrega em 300 ms mas não reage ao toque por 1 s é pior que uma que reage em 50 ms e
carrega em 600 ms. **Medir antes de mudar, medir depois de mudar, e só ficar com o que o número provar.**

### A régua (três números por clique, sempre no build de produção, nunca no dev server)

| Número | O que é | Meta |
| --- | --- | --- |
| **Reação** | do toque até a tela mostrar QUALQUER resposta (botão apertado, spinner, item já na lista) | ≤ 100 ms |
| **Resultado** | do toque até o dado novo na tela (ou a navegação pronta) | ≤ 300 ms com a função quente |
| **Frio** | o mesmo resultado na 1ª visita depois de 15 min parado | registrar; é plataforma, não código (~950 ms, medido no `docs/28`) |

Medir com Playwright no build de produção (`pnpm build` + `pnpm start`), a 390 px, com a conta de
demonstração do seed: `performance.now()` no toque, `MutationObserver`/`waitForResponse` para a reação e o
resultado. Cinco repetições, mediana. Separar sempre quente de frio: **a 2ª visita caiu muito? então é
cold start; não caiu? é trabalho de verdade por requisição.**

### Onde medir primeiro (as telas e os toques de maior uso)

1. **Hoje** (`/admin/hoje`): abrir, tocar num agendamento, "chegou", "concluir".
2. **Agenda** (`/admin/agenda`): trocar de dia, abrir o detalhe, remarcar.
3. **Marcar** (`/admin/agenda/novo`): escolher cliente, serviço, horário, salvar.
4. **Recuperar** (`/admin/recuperar`): abrir, "Chamar" na fila, "já falei", "pular".
5. **Comanda**: adicionar item, fechar, receber.
6. **Clientes**: buscar por nome, abrir a ficha.
7. **Barra de baixo**: trocar de aba entre as cinco.

Fazer primeiro o **placar de base**: os três números de cada toque acima, numa tabela. É o mapa; sem ele,
qualquer conserto é chute.

### Ordem de investigação (as armadilhas que esta base já pagou — conferir nesta ordem)

1. **Região**: `vercel.json` tem `"regions": ["gru1"]`, junto do banco em São Paulo. Conferir que continua
   (uma linha que, faltando, custa ~2 s por clique).
2. **Idas ao banco em série**: `await` fora de `Promise.all` no caminho do toque. Já aconteceu com um evento
   de funil que "não bloqueava" no comentário e bloqueava no código: mover para `after()`.
3. **Import pesado de carona**: um `select` que mora no mesmo arquivo de um upload puxa `sharp` (19 MB) para
   a rota. O conserto é separar o arquivo; `import()` dinâmico não resolve.
4. **SDK caro sem credencial** no topo do `instrumentation.ts`.
5. **A tela espera tudo para mostrar algo**: falta `loading.tsx`, `Suspense` por bloco, ou o botão não muda
   de estado no toque.
6. **Navegação sem prefetch** nos links da barra e nos cartões que a pessoa toca em seguida.
7. **Trabalho repetido**: a mesma consulta feita duas vezes por render, ou recalculada a cada toque.

### O que pode (e onde)

- **Reação imediata** em todo botão: estado de "enviando" no mesmo frame do toque (`useTransition`, botão
  desabilitado com o motivo, `aria-busy`).
- **Atualização otimista** (`useOptimistic`) SÓ em ação reversível e de baixo risco: "já falei", "pular",
  marcar chegada. Se o servidor recusar, a tela volta e diz por quê.
- `Promise.all` nas buscas independentes; `after()` para o que não precisa estar pronto para a tela.
- `Suspense` por bloco, para o que é rápido aparecer antes do que é lento.
- Prefetch dos destinos prováveis (abas, o próximo cartão).
- Cache de dado **não sensível** e por tenant, com invalidação explícita depois da escrita.

### O que não pode (regras da casa, não negociáveis)

- **Nunca otimismo em dinheiro, estoque ou cofre**: fechar comanda, receber, mexer em estoque e abrir dado
  de saúde esperam a confirmação do servidor (pode mostrar "enviando" na hora, não o resultado).
- **Nunca esconder erro para parecer rápido**: `catch` que descarta tem de avisar (CLAUDE.md).
- **Nunca cachear** `/vault`, mídia assinada ou dado de outro tenant; nada de cache que atravesse tenant.
- **Escrita continua por `/api/v1` com `Idempotency-Key`** (o otimismo não pode duplicar a ação).
- **Nada de medir no dev server** (HMR e recompilação geram falso positivo — memória "medição ingênua").
- **Produção é só leitura**: medir produção só lendo (abrir a tela), nunca criando dado; o trabalho é na
  branch e no banco local.

### O laço de cada rodada (F1 → F5, uma tela ou um toque por vez)

- **F1 · Prompt da rodada**: qual toque, qual número hoje (do placar de base), qual a meta.
- **F2 · Pesquisa**: rastrear o caminho do toque (componente → rota → serviço → consultas), contar idas ao
  banco e medir cada etapa (`Server-Timing` ou log com tempo). Achar onde o tempo vai **com número**.
- **F3 · Plano**: a menor mudança que ataca a maior fatia. Uma hipótese por rodada.
- **F4 · Execução**: mudar, rodar a suíte inteira (tipos, lint, unidade; integração e RLS quando tocar o
  banco), commit com o código do ticket.
- **F5 · Medida**: os três números de novo, cinco repetições, antes × depois na mesma tabela. Piorou ou
  empatou? **Reverter e registrar o negativo** (vale tanto quanto o positivo). Melhorou? Guarda que segura
  (teste que conta as idas ao banco daquela rota, ou que exige `Promise.all`/`after()` naquele trecho, vista
  reprovando com a mutação).

Registrar cada rodada em `docs/107-cliques/R-NNN.md` e uma linha em `docs/107-cliques/_estado.md`:
`R-NNN · toque · reação/resultado antes → depois · o que mudou · próximo`.

### Prova

- Tabela de base e tabela final, por toque, no `_estado.md`.
- Toda mudança visível provada no navegador, build de produção, 390 px, com print.
- Nenhuma tela com regressão de reação (a guarda do placar compara com o número anterior).

### Formato do relatório ao fim de cada rodada

Três linhas: o toque, o número antes e depois, e o que mudou. Se o número não mexeu, dizer isso primeiro.

---

## Para rodar em laço

```
/loop segue docs/107-PROMPT-CLIQUES-RAPIDOS.md sem parar, uma rodada R-NNN por vez (estado em docs/107-cliques/_estado.md): primeiro o placar de base dos toques de maior uso no build de produção a 390 px; depois uma hipótese por rodada, medida antes e depois, revertendo o que não melhorar; nada de otimismo em dinheiro, estoque ou cofre; pausas de no máximo 1 minuto, nunca parar, nunca perguntar
```
