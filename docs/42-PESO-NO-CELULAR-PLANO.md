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
| HTML de `/demo-studio-bella` | 85,3 kB | ~~**é aqui que o 3G sofre**~~ — **medido em bytes crus, que é a régua errada. Ver §7.** |

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

4. ~~**Varrer o resto do padrão do §2**~~ — **encerrado em 05/09 por medição, não por trabalho.**
   O que resta na landing é `M5 12h14` seis vezes (48 B de `d` somados) e a seta seis vezes (78 B).
   Comprimido, isso é ~200 B numa página que vai a **8,7 kB pelo fio**. Não paga um PR. Ver §7.

5. ~~**Fontes**~~ — **auditado em 05/09, nada a fazer.** `font-display: swap`; três `@font-face`
   com `unicode-range` e só o bloco latino baixa; `font-stretch: 100%` fixo (o arquivo variável
   carrega só o eixo de peso); `Archivo Fallback` com `local("Arial")` e `size-adjust`, que é o que
   segura o CLS; e o preload existe — vem pelo `:HL[...]` do payload RSC, não como `<link>` no
   `head`, que foi o que fez parecer ausente. Trocar o variável por três estáticos (400/600/700,
   os únicos pesos usados) daria TRÊS requisições somando mais que os 34,9 kB de uma. Ver
   `DECISOES` 05/09.

6. ~~**Imagens**~~ — **medido em 05/09, nada a fazer.** As cinco imagens de
   `/demo-studio-bella` somam **32,7 kB**: capa 1600×600 em 14,5 kB e avatares 512×512 em 2,9 a
   3,5 kB cada. Sim, o avatar é servido a 512 px para exibir a 64 px — e a 3 kB o redimensionamento
   custaria mais em requisição e complexidade do que economiza. O pipeline de upload
   (HEIC→WebP + `sharp`) já resolve o problema na origem.

7. **INP nas ações, não só na navegação.** Confirmar, cancelar, abrir ficha de cliente. O `docs/28`
   mediu TTFB de rota; ninguém mediu a latência da INTERAÇÃO.

### P2 — Bloqueado por acesso

8. **O painel do dono (`/admin/*`) nunca foi auditado visualmente** — e em 05/09 o motivo do
   bloqueio foi identificado, porque **o que estava escrito aqui era o motivo errado**.

   Não é senha. A senha do seed **não** é sorteada: `scripts/seed-tenant-teste.mjs` tem
   `const SENHA = process.env.SEED_SENHA ?? 'teste-ciclo-2026'`, e o dono
   `dono-lang-barber@ciclo.app` já existe no banco de DEV. Nenhuma conta nova precisa ser criada.

   **O bloqueio é `captcha_failed` no Auth do projeto de DEV.** Medido: o `signInWithPassword`
   contra `sukloaoodpxjukngyojo` responde *"captcha protection: request disallowed (no
   captcha_token found)"*, e a mesma chamada contra a produção (`eqzlvthzdjnsbogymcsw`) responde
   `invalid_credentials` — ou seja, **a proteção está ligada só no DEV**, e o app não manda token
   em nenhum dos dois. É a divergência que `core/auth/motivo-da-recusa.ts` já documenta de
   02/09/2026 ("configuração de projeto não vem em migration"), e que continua de pé no DEV.

   Login local está impossível para qualquer pessoa, não só para uma auditoria.

   **O destravamento é de 30 segundos e é do Eduardo:** painel do Supabase → projeto de DEV →
   Authentication → Attack Protection → desligar o captcha. (Rodar contra um Supabase local seria
   a outra saída, e exige Docker, que não está instalado nesta máquina.)

   Feito isso, procurar no painel os mesmos padrões que já renderam bug: coluna que a tela nunca
   escreve, número que sempre dá zero, texto cortado a 375 px, promessa de canal sem cron
   agendado, `catch` que descarta em silêncio.

### P3 — Sobras conhecidas

9. **Cold start de ~950 ms**, uma vez por período de ociosidade. `docs/28` §9 conclui que não é mais
   código: é boot de contêiner, e quem resolve é manter a instância quente (Fluid Compute),
   configuração de projeto na Vercel.

10. ~~**Item C do `docs/41`**~~ — **fechado em 05/09, e três das oito não eram órfãs.**
    `tenant_keys.rotated_at` é escrita por `scripts/rotacionar-kek.mjs`, `audit_log.orphaned_at`
    pela migration 0050, e `package_uses.used_at` tem `default now()`. A varredura de 04/09 só
    olhou `src/`. Nenhuma remoção: `drop column` custa duas releases e nenhuma delas atrapalha
    consulta ou tela. Ver `docs/41` §C.

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

---

## 7. A régua estava errada, e a conclusão muda de tamanho (2026-09-05)

Tudo neste documento até aqui foi medido em **bytes crus**. O que chega ao celular é comprimido, e
a diferença não é um detalhe de porcentagem — é uma ordem de grandeza. Medido na produção com
`Accept-Encoding`:

| Página | cru | gzip | **brotli (o que o celular recebe)** |
|---|--:|--:|--:|
| `/demo-studio-bella` | 74.223 B | 10.071 B | **9.291 B** |
| `/` | 55.169 B | 8.668 B | **9.320 B** |
| `/precos` | 50.330 B | — | **8.363 B** |

**A página do salão não pesa 74 kB no 3G. Pesa 9,3 kB.** A frase do §1 — *"é aqui que o 3G
sofre"* — foi escrita sobre 85,3 kB crus, que na época eram ~11 kB reais.

### E os PRs de ícone, valeram? Não — 30 bytes

Reconstruí o HTML de hoje desfazendo o conserto (cada `<use>` expandido de volta no `<symbol>`
inteiro) e comprimi os dois lados a partir do **mesmo HTML de produção**:

| | cru | gzip | **brotli q4** | brotli q11 |
|---|--:|--:|--:|--:|
| com `<use>` (hoje) | 74.223 | 10.071 | 8.875 | 7.552 |
| com o SVG repetido (antes) | 86.688 | 11.221 | 8.904 | 7.580 |
| **economia real** | 12.465 B | 1.150 B | **29 B** | 28 B |

Medido em toda qualidade de brotli entre 4 e 11: a economia fica entre **28 e 48 bytes**. A
produção transfere 9.291 B, que é a vizinhança da qualidade 4 — ou seja, **os três PRs de ícone
economizaram cerca de 30 bytes na rede**, contra os 12.465 que a conta crua anunciava. Uma
diferença de 400×.

Os 22% de "22% do HTML era o mesmo ícone" são verdade sobre o arquivo e **falsos sobre a rede**.
Marcação repetida é literalmente o caso de uso do LZ77: trinta cópias idênticas de um `<path>`
custam, comprimidas, quase o mesmo que uma. E trocar N cópias idênticas por um símbolo mais N
`<use>` diferentes ainda **introduz** conteúdo novo, que é menos comprimível — por isso a economia
chega a ser MENOR na qualidade mais alta.

**A regra que fica:** antes de cortar repetição de marcação por peso, comprima os dois lados a
partir do mesmo HTML servido. A estimativa em bytes crus não erra por uma margem — erra por duas
ordens de grandeza, e sempre para o lado de fazer o trabalho parecer valer a pena.

### E uma armadilha de ferramenta, que quase repetiu o erro

A primeira medição desta seção saiu com `gzip` porque o script tinha
`try: import brotli / except: tem_brotli = False` — e o arquivo se chamava `brotli.py`, então ele
sombreava o próprio módulo que tentava importar. **O fallback transformou uma falha de ferramenta
em um resultado**, e a primeira versão deste documento foi commitada afirmando "1,15 kB, ~11% do
que trafega", que está errado por 40×.

Ferramenta de medição não pode ter plano B silencioso. Se o compressor que a produção usa não está
disponível, o certo é parar — um número da grandeza errada é pior que nenhum número, porque ele
vira decisão.

**O que isso muda no que sobrou:** o item 4 do §4 (os ~2,2 kB de ícone que restam na landing) sai
da lista, e sai com folga: se 12,4 kB crus valeram 30 bytes, 2,2 kB crus valem menos de dez. E o
próximo alvo de peso, se houver, não é marcação: é o payload RSC, que sozinho é 58% dos bytes crus
desta página — e que não é repetição, é dado, que é justamente o que não comprime de graça.
