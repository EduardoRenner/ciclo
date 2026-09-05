# 42 · Peso no celular: o que foi medido, o que foi consertado, o que falta

**Data:** 2026-09-04 · **Sintoma relatado (Eduardo):** *"o clique ainda tá muito lento, deixa mais
leve para rodar em qualquer celular velho"*.

Este documento é o ponto de partida de quem continuar. Leia junto com o `docs/28`, que resolveu o
lado do SERVIDOR (região da função, cold start, idas de rede em série) — aqui é o lado do
CLIENTE, que o 28 explicitamente deixou de fora.

---

## 1. A medição que redirecionou o trabalho

A hipótese era "bundle grande demais para celular fraco". **A medição desmentiu**, e vale registrar
para ninguém gastar rodada nisso de novo. Tudo medido na produção (`seuciclo.com.br`), nunca em
`pnpm dev` — que compila sob demanda e mente sobre o tempo real.

| Medida | Resultado | Leitura |
|---|--:|---|
| JS compartilhado por todas as rotas | 104 kB | — |
| dos quais os dois maiores chunks | **101 kB** | React + Next: **piso de framework**, não gordura |
| Total Blocking Time | **33 ms** | **a CPU do celular antigo NÃO é o gargalo** |
| Lucide (todos os ícones) | 10 kB | já bem tree-shaken |
| HTML de `/demo-studio-bella` | 85,3 kB | **é aqui que o 3G sofre** |

Também foi testada e **descartada** a hipótese de o payload RSC duplicar os SVGs: ele não contém
nenhum (`0` ocorrências).

**Conclusão: o peso está no DOCUMENTO, não no JavaScript.**

### Como reproduzir a medição

Baixe a página com `curl` e separe, por regex: `self.__next_f.push(...)` (payload RSC), `<script>`,
`<style>`, `<svg>`. No navegador, `performance.getEntriesByType('resource')` para peso por tipo e
`PerformanceObserver({type:'longtask'})` para o Total Blocking Time.

---

## 2. O padrão achado: ícone dentro de `.map()`

O `lucide-react` inlina o `<path>` **e todos os atributos** em cada ocorrência. Onde o ícone está
numa lista, ele se repete inteiro.

| Onde | Cópias | Peso na página | PR |
|---|--:|--:|:--|
| Estrelas das avaliações (`[slug]/secoes.tsx`) | 26 | **22%** | #68 |
| `Check`/`Minus` da lista de planos (`precos/page.tsx`) | 24 | **14%** | #70 |
| Seta da lista de serviços (`[slug]/secoes.tsx`) | 10 | ~5% | #71 |

**Conserto:** um `<symbol>` definido uma vez + um `<use>` por item. Estrelas caíram 75%
(16.325 para 4.086 B); `/precos` caiu 48% (5.960 para 3.116 B).

### A armadilha do conserto, paga uma vez

**`fill="none"` vai no `<svg>` que USA, nunca no `<symbol>`.** Dentro do símbolo o atributo fica
mais perto do `<path>` do que a classe do `<svg>` externo, ganha da cascata, e o ícone renderiza
vazado. Na primeira versão isso deixou 25 estrelas ocas **com typecheck, lint e 1.624 testes
verdes** — só a captura de tela denunciou.

Guardado por `tests/unit/design/estrelas-nao-repetem-o-svg.test.ts` e
`precos-nao-repete-icone.test.ts`, nos dois lados: símbolo não define, elemento que usa define.

### Verificar o estado que os dados não produzem

As 5 avaliações exibidas eram todas nota 5, então **o estado "estrela vazia" nunca renderizava** —
e era justamente ele que a v1 quebrou. Foi preciso baixar todas para nota 3 no banco de dev,
confirmar 15 cheias e 10 contornadas, e restaurar. Faça o mesmo antes de declarar verificada
qualquer variação condicional.

---

## 3. Achado colateral, já consertado (#69)

`order('created_at')` sem desempate devolve ordem **instável** quando várias linhas nascem no mesmo
instante (importação, seed). Três lugares, e nos três o empate muda o RESULTADO:

- **avaliações da página pública** — tem `limit(5)`, então muda QUAIS comentários aparecem;
- **`notificarProximoDaLista`** — escolhe UMA pessoa para a vaga que abriu, e `ordenarCandidatos`
  termina em `return 0` apostando explicitamente na ordem da consulta;
- **`listarFilaDeEspera`** — a ordem da fila que o salão vê.

Corrigido com `.order('id')` secundário.

---

## 4. O que falta, em ordem

### P0 — Não é código, e destrava mais que qualquer conserto

1. ~~**`CRON_BASE_URL`**~~ — **RESOLVIDO, e o documento envelheceu em um dia.** Conferido em
   05/09: o secret foi atualizado em 04/09 01:07 UTC, as dez últimas execuções do `cron` estão
   verdes, e `/api/health` devolve `200` com `recomputeCycles: ok`. **O Motor de Ciclo roda sozinho
   em produção desde 04/09.** Nada a fazer aqui.

2. ~~**Aplicar as migrations 0059, 0060 e 0061**~~ — **FEITO em 05/09, e não eram inertes: eram
   um erro na cara da cliente.** `pedido-de-orcamento.ts` insere em `quotes` com `professional_id
   = null` e `status = 'requested'`, e as duas coisas violavam a coluna `not null` e o CHECK antigo
   — quem pedisse orçamento pela página pública levava erro. Mais 10 profissões com o `vocab` só no
   masculino. (Detalhe: a tabela nunca foi `quote_requests`; é `quotes`, com colunas novas.)

   A causa a montante foi consertada junto e vale mais que as três: o `docs/05-FAQ-DEV.md` B24
   prometia uma GitHub Action rodando `supabase db push` antes do deploy, e ela **nunca existiu**.
   Hoje o `/api/health` compara o ledger do banco com `src/core/schema/versao.ts` e o job `vigia`
   do cron avisa. Ver `DECISOES` 05/09.

3. **`SENTRY_DSN` na Vercel** — ou criar, ou tirar a promessa da tela. Hoje erro de usuário não
   chega em ninguém. A variável é lida em tempo de BUILD: criar no painel não basta, precisa de
   deploy novo.

### P1 — Continuação direta desta auditoria

4. **Varrer o resto do padrão do §2.** Os três maiores já foram. Restam ~2,2 kB de ícone repetido
   na landing e o que aparecer nas telas do `/admin`, que não foram medidas (ver P2).

5. **Fontes.** 34 kB numa requisição; formato e `font-display` não auditados.

6. **Imagens.** Conferir tamanho servido contra o necessário a 390 px (piso de design do projeto)
   nas telas com foto: vitrine, portfólio, avatares.

7. **INP nas ações, não só na navegação.** Confirmar, cancelar, abrir ficha de cliente. O `docs/28`
   mediu TTFB de rota; ninguém mediu a latência da INTERAÇÃO.

### P2 — Bloqueado por acesso

8. **O painel do dono (`/admin/*`) nunca foi auditado visualmente.** Duas sessões tentaram e
   pararam no mesmo lugar: criar conta de autenticação é ação bloqueada, e a senha do seed é
   sorteada e não fica no repositório (regra 10, corretamente). É onde mora a maior parte do
   produto e onde vários consertos foram feitos sem ninguém ter visto a tela.
   **Precisa de uma credencial de teste fornecida pelo Eduardo.** Procurar lá os mesmos padrões que
   já renderam bug: coluna que a tela nunca escreve, número que sempre dá zero, texto cortado a
   375 px, promessa de canal sem cron agendado, `catch` que descarta em silêncio.

### P3 — Sobras conhecidas

9. **Cold start de ~950 ms**, uma vez por período de ociosidade. `docs/28` §9 conclui que não é mais
   código: é boot de contêiner, e quem resolve é manter a instância quente (Fluid Compute),
   configuração de projeto na Vercel.

10. **Item C do `docs/41`** — 8 colunas sem consumidor em TS (`products.sku`,
    `package_uses.used_at`, `messages.scheduled_for`, `tenant_keys.rotated_at`,
    `webhook_events.processed_at`, `audit_log.orphaned_at`, e dois agregados de
    `v_clientes_a_recuperar`). Confirmadas órfãs em varredura de 04/09. O próprio `docs/41` manda
    fazer "só o que tiver dono claro": decidir, por coluna, entre documentar ou remover.

11. **Realismo do seed de produção.** As 6 contas demo fazem 8 a 11 atendimentos por semana (real
    seria 30 a 60) e têm 45 a 55% de ciclos perdidos nos três salões. Não é bug, subvende. Exige
    SQL na produção, então é decisão do Eduardo.

---

## 5. Método que esta auditoria confirma

Quatro medições ingênuas quase viraram defeito inventado, e foram descartadas por medir de novo:

1. **avatares "quebrados"** — era `loading="lazy"` não disparando com `scrollIntoView` no navegador
   de automação; com rolagem de verdade, carregam;
2. **logo "cortado" depois do rebase** — 56 px é a SOBREPOSIÇÃO de projeto, não corte; só vira
   corte se o pai recortar, e ele não recorta;
3. **"6 paths ainda desenhados" em `/precos`** — o path do `ArrowRight` começa igual ao do `Minus`,
   e o regex casou por prefixo;
4. **alvos de toque "menores que 44 px" na landing** — medem 48 a 50 px de área alcançável; o
   `::after` do `toque-48` não aparece no `getBoundingClientRect`, tem que sondar ponto a ponto com
   `elementFromPoint`.

E uma armadilha que se repetiu **quatro vezes no mesmo dia**: casamento por texto acertando o
COMENTÁRIO em vez do código — em três testes-guarda e num script descartável de verificação.
Quanto melhor o comentário explica o código, mais fielmente ele reproduz o texto que o padrão
procura. Tire comentário antes de casar, inclusive em script de uso único, e ao mutar confira em
qual linha a substituição caiu.

---

## 6. Onde chegou

| PR | O quê |
|:--|---|
| #68 | estrelas das avaliações: 22% do HTML da página do salão |
| #69 | ordem instável em avaliações e fila de espera |
| #70 | `Check`/`Minus` de `/precos`: 14% daquela página |
| #71 | seta da lista de serviços |

Todos no `main`. `typecheck`, `lint` e `test:unit` (1.631) verdes.
