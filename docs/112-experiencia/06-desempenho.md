# 06 · Leve e rápido (Parte C3 do docs/111)

**Data:** 21/10/2026, madrugada. **Quem:** agente da frente C3. **Código medido:** `marca/feminina-2026-10-20` no commit `1caeaacb`, num worktree próprio (`ciclo-medicao-112`, já removido), `pnpm build` + `pnpm start -p 3051` (porta já parada). **Banco:** Supabase LOCAL `ciclo-marca` (127.0.0.1:57821), contas de demonstração do seed. **Produção não foi tocada.**

Rótulos: **FATO** (medido aqui, com número e método), **INFERÊNCIA** (lido no código ou deduzido de medida, ainda não provado), **HIPÓTESE** (aposta a medir), **NÃO VERIFICADO** (não deu para medir, e o porquê).

---

## 0 · Leia isto antes dos números

1. **A máquina estava carregada.** CPU média de 64% (12 núcleos) durante a medição, com um `node` de outra sessão acumulando 32.332 s de CPU e o Docker do Supabase local (FATO, `Win32_Processor.LoadPercentage` e `Get-Process`). Por isso os tempos de servidor variam até 4× entre rodadas (ex.: `/admin/hoje` deu mediana 460 ms numa rodada e 683 ms noutra). **Use os tempos como comparação entre telas, não como número absoluto de produção.** O que não depende de carga, e é o mais confiável aqui: **contagem de idas ao banco** (log do Kong) e **bytes** (arquivos do build).
2. **Banco local ≠ banco de produção.** Uma ida ao PostgREST local custa 14 a 32 ms (mediana 17 ms, FATO, `curl` 6×). Em produção (função em `gru1`, banco em `sa-east-1`) o `docs/28` mediu ~10 ms por ida. A ordem de grandeza é a mesma; a contagem de idas em série vale para os dois.
3. **O seed é pequeno:** `demo-studio-bella` tem 24 clientes e 121 agendamentos, e **nenhuma imagem** (capa, rostos e portfólio não existem no storage local; FATO, Lighthouse não baixou nenhuma imagem na página do salão). Toda medida de página pública aqui é **o melhor caso**; um salão com fotos e 300 clientes pesa mais.
4. **Perfil de rede do Lighthouse é mais duro que o de A6.** O padrão "mobile" do Lighthouse 13.4.1 em `simulate` é 150 ms de RTT, 1,6 Mbps e CPU 4× (FATO, `configSettings.throttling` do JSON), mais perto de "Slow 4G" do que do "Fast 4G" de A6. Os LCP abaixo são, portanto, o **pior caso** de A6.
5. **Byte cru é a régua errada** (`byte-cru-e-a-regua-errada`). Todo peso abaixo é **comprimido**: gzip nível 9 e brotli q11 do `zlib` do Node, sem plano B (o script para se não houver brotli). O `next start` local serve gzip; a Vercel serve brotli.

---

## 1 · JavaScript por rota (FATO)

### 1.1 O que o `next build` diz ("First Load JS", gzip)

| Rota | Tamanho da rota | First Load JS | Antes (docs) |
|---|--:|--:|---|
| compartilhado por todas | — | **104 kB** (54,2 + 46,6 + 3,3) | 187 kB em ago/26 (`docs/10`, com Sentry); 104 kB em 04/09 (`docs/42`). **Igual desde 04/09.** |
| `/` | 1,34 kB | 114 kB | — |
| `/entrar` | 4,09 kB | 143 kB | — |
| `/cadastro` | 4,56 kB | 142 kB | — |
| `/onboarding` | 6,1 kB | 137 kB | — |
| `/calculadora` | 4,1 kB | 126 kB | — |
| `/[slug]` (página do salão) | 844 B | **108 kB** | — |
| `/[slug]/agendar` | 10,7 kB | **136 kB** | — |
| `/confirmar/[token]` | 2,78 kB | 122 kB | — |
| `/admin/hoje` | 8,53 kB | 161 kB | — |
| `/admin/agenda` | 6,25 kB | 155 kB | — |
| `/admin/recuperar` | 9,62 kB | **188 kB** | — |
| `/admin/clientes` | 5,81 kB | 123 kB | — |
| (maior do app) `/admin/clientes/[id]` | 19,8 kB | 218 kB | — |
| Middleware | — | 177 kB | — |

### 1.2 O que o navegador baixa de verdade

O "First Load JS" do Next **não conta** os chunks dos limites da raiz (`error.tsx`, `not-found.tsx`, `global-error.tsx`), que vão em `<script>` em **toda** página. Somei os `<script src>` que o HTML servido manda, lendo cada arquivo do `.next/static` e comprimindo (o `polyfills` `noModule`, 39,4 kB gzip, fica fora: navegador moderno não baixa).

| Rota | Arquivos JS | JS gzip | JS brotli | "First Load" do Next | Diferença |
|---|--:|--:|--:|--:|--:|
| `/` | 14 | 148,0 kB | 126,8 kB | 114 kB | +34 kB |
| `/entrar` | 15 | 154,3 kB | 132,4 kB | 143 kB | +11 kB |
| `/calculadora` | 14 | 150,7 kB | 129,3 kB | 126 kB | +25 kB |
| **`/[slug]`** | 15 | **148,8 kB** | **127,5 kB** | 108 kB | **+41 kB** |
| **`/[slug]/agendar`** | 17 | **162,7 kB** | **140,0 kB** | 136 kB | +27 kB |
| `/confirmar/[token]` | 16 | 153,1 kB | 131,4 kB | 122 kB | +31 kB |
| `/admin/hoje` | 21 | 195,8 kB | 169,9 kB | 161 kB | +35 kB |
| `/admin/agenda` | 20 | 190,7 kB | 165,3 kB | 155 kB | +36 kB |
| **`/admin/recuperar`** | 21 | **234,4 kB** | **203,0 kB** | 188 kB | +46 kB |
| `/admin/clientes` | 18 | 181,7 kB | 157,1 kB | 123 kB | +59 kB |

(kB = 1.000 B. Método: `medir-peso.mjs` no scratchpad da sessão; números de bytes exatos nas linhas JSON de lá.)

### 1.3 Para onde vai o JS da página do salão (FATO, `app-build-manifest.json`)

A página do salão é Server Component: o chunk próprio dela tem **0,8 kB**. Dos 148,8 kB gzip:

| Pedaço | gzip | De onde vem |
|---|--:|---|
| React + Next (`7843f6d6`, `9012`) | 100,8 kB | piso de framework (`docs/42` §1) |
| **Radix Toast** (`5739`) | **11,9 kB** | `components/shell/tela-publica.tsx:1` importa `ToastProvider`; `error.tsx` e `not-found.tsx` usam `TelaPublica`, e esses dois limites vão em toda rota |
| **tailwind-merge** (`9660`) | **9,3 kB** | `cn()` do `Button` usado no `error.tsx` |
| `next/image` (`823`) | 5,1 kB | o `Selo` (wordmark) do `error`/`not-found` |
| `error.tsx` próprio | 4,7 kB | — |
| Capacitor core + status bar (`8089`) | 3,1 kB | `ConfigurarStatusBarNativo` no layout raiz; no navegador não faz nada |
| link/prefetch (`7978`), `not-found`, `global-error`, layout, webpack | ~13 kB | — |

**Ou seja: ~31 kB gzip (Toast + tailwind-merge + next/image) entram em TODA página pública só porque a tela de erro e a de 404 usam a mesma casca que o cadastro.** É o maior pedaço de JS que não é framework na página do salão.

### 1.4 `/admin/recuperar` carrega o polyfill de Temporal no celular (FATO)

O chunk `8330` (**44,4 kB gzip**) é o `@js-temporal/polyfill`. Ele entra no bundle do cliente por `admin/recuperar/fila.tsx:9` → `core/ciclo/ritmo-do-cliente.ts:1` (que importa `Temporal`) → `core/ciclo/regua-do-servico.ts` → `core/tempo/dia.ts`. Mesmo chunk em `/admin/clientes/[id]`, `/admin/clientes/importar` e `/admin/clientes/ja-atendo`. É o motivo de `/admin/recuperar` ser a tela mais pesada das jornadas (234 kB gzip), e a tela de P3, a jornada que mais vende o produto.

---

## 2 · Tempo de servidor (TTFB, `next start` local)

Método: `curl` com `Accept-Encoding: gzip, deflate, br`; 1 requisição "primeira" separada + 7 seguidas, mediana das 7. Três rodadas nas públicas, duas nas do painel; a tabela mostra a faixa de medianas. Painel com sessão do dono de `demo-studio-bella` (link mágico gerado pelo admin do Supabase **local**, sem trocar senha nem criar conta), sessão nova para não pagar renovação de token em cada pedido.

| Rota | Mediana (faixa entre rodadas) | Idas ao Supabase por render (log do Kong) | Leitura |
|---|--:|--:|---|
| `/` | 15 a 140 ms | 0 | estática (`revalidate 600`), mede só a máquina |
| `/calculadora` | 19 a 56 ms | 0 | estática (`revalidate 3600`) |
| `/entrar` (anônima) | 79 a 219 ms | 0 a 1 | `getUser()` sem cookie + configurações do Auth em cache de 5 min |
| `/[slug]` | 106 a 171 ms | **7** (anônima) | 1 (`tenants`) + 6 em paralelo; **primeira requisição depois do start: 1.540 ms** |
| `/[slug]/agendar` | 77 a 155 ms | 7 | mesmo `perfilPublico` (com `cache()`) |
| `/confirmar/[token]` | 83 a 88 ms | — | token assinado gerado localmente para um horário de exemplo |
| `GET /api/v1/public/[slug]/availability` | 327 ms | **13** | é o toque em cada dia da agenda da cliente: rate limit → tenant → serviço+profissionais → 3 consultas por profissional |
| `/admin/hoje` | 460 a 683 ms | **29** | ver §2.1 |
| `/admin/agenda` | 478 a 503 ms | 9 | — |
| `/admin/recuperar` | 631 a 675 ms | 20 | — |
| `/admin/clientes` | 587 a 605 ms | 10 | — |
| `/onboarding` (dono já cadastrado → 307) | 507 a 813 ms | 4 | só o redirecionamento; a tela de quem acabou de criar conta não foi medida (§6) |

Produção, para comparar (`docs/28` §9, 27/08, rede residencial, função quente): `/admin/hoje` 219 ms, `/admin/agenda` 181 ms, `/admin/clientes` 202 ms. **Os números locais acima não substituem esses**: a máquina estava carregada e o banco é outro. O que eles mostram com segurança é a ordem entre telas e a contagem de idas.

### 2.1 `/admin/hoje` faz 29 idas ao banco por abertura (FATO)

Lista do Kong, uma abertura com sessão válida: `auth/v1/user` ×2, `memberships`, **`tenants` ×3** (`plan…`, `timezone`, `settings,timezone`), **`appointments` ×3**, **`services` ×2**, **`stock_moves` ×2**, `products`, `client_cycles` ×2, `messages`, `loyalty_entries`, `cycle_predictions`, `client_subscriptions`, `tenant_modules`, `v_quem_sumiu`, `package_uses`, `rpc/resumo_central_de_acoes`, `quotes`, `tickets`, `clients` (HEAD), `payments`, `service_products`.

INFERÊNCIA: a maior parte está dentro de um `Promise.all` (`admin/hoje/page.tsx:72`), então o custo de rede não é 29 × 10 ms; é a profundidade da cadeia (~4 a 5 idas em série: middleware `getUser` → `getUser` da página → `memberships` → `Promise.all` → consultas internas de cada serviço). Mas 3 leituras de `tenants` e 3 de `appointments` na mesma abertura são trabalho repetido, e cada uma ocupa conexão e CPU da função. O `docs/28` já cortou o que era série; o que sobra é **duplicação entre serviços**, que ninguém mediu ainda.

O `getUser()` duplicado (middleware + página) é decisão registrada no `docs/28` §10 (segurança > 30 ms). Fica.

---

## 3 · Página utilizável (Lighthouse 13.4.1, mobile, simulate)

Método: `lighthouse --preset=perf --form-factor=mobile --throttling-method=simulate`, Chrome headless, 3 rodadas válidas por rota, mediana. **Nesta máquina o Lighthouse falha de forma intermitente com `NO_NAVSTART`** (o trace sai sem o início da navegação). Rodada com erro foi **descartada e contada**, nunca virou número.

| Rota | Rodadas válidas / tentativas | LCP (mediana) | FCP | TBT | CLS | Speed Index | Elemento do LCP |
|---|:-:|--:|--:|--:|--:|--:|---|
| `/` | 3/5 | **3,34 s** (3,33 a 3,34) | 1,82 s | 224 ms | 0,000 | 1,82 s | `h1.font-display` (o título em **Fraunces**) |
| `/entrar` | 2/10 | **3,10 s** | 1,83 s | 141 a 166 ms | 0,000 | 1,83 s | parágrafo de ajuda do formulário |
| `/calculadora` | 1/11 | 2,74 s | 1,14 s | 138 ms | 0 | 1,74 s | (uma rodada só: tratar como indicação) |
| **`/[slug]`** | 3/9 | **2,75 s** (2,71 a 2,82) | 1,25 s | 162 ms | 0,001 | 3,87 s | aviso "Negócio de exemplo" (`p[role=status]`) |
| **`/[slug]/agendar`** | 1/10 | **2,87 s** | 1,11 s | 211 ms | 0,000 | 1,78 s | aviso "Negócio de exemplo" |
| `/confirmar/[token]` | 3/6 | 2,63 s (2,62 a 2,72) | 1,07 s | 243 ms | 0,000 | 1,07 s | `h1` "Você já confirmou" |

**Contra a meta de C3 (LCP ≤ 2,5 s na página do salão e no agendamento, 4G, primeira visita): FORA por 0,25 a 0,37 s, no perfil do Lighthouse (que é mais lento que o Fast 4G de A6).** No Fast 4G de A6 é provável que passe (INFERÊNCIA, não medido: ver §6).

O que o trace mostra (FATO, valores observados sem limitação no mesmo JSON): em todas as páginas menos o confirmar **o primeiro quadro pintado sai depois do `load`** (salão: DOMContentLoaded 355 ms, load 571 ms, FCP/LCP 770 ms; confirmar: 289 / 323 / 266 ms). Por isso o Lighthouse simulado prende o LCP ao fim do JavaScript: **LCP = TTI em todas as rotas** (salão 2.754 = 2.754 ms; confirmar 2.625 = 2.625 ms). INFERÊNCIA: o que segura a tela no celular lento não é o servidor nem a imagem (não há imagem): é **CSS que bloqueia o render** + **execução de JS antes do primeiro quadro**. O Lighthouse estima 240 ms (salão) a 1.050 ms (`/entrar`) de ganho tirando o bloqueio do CSS (`render-blocking-insight`; o arquivo é um só, 65.146 B crus, **12.798 B gzip**, com o CSS do painel inteiro dentro).

Trabalho de thread principal com CPU 4× (FATO): salão 1,86 s (estilo e layout 515 ms, avaliação de script 440 ms); agendar 1,76 s (script 822 ms); home 1,53 s.

---

## 4 · A fonte nova, Fraunces (FATO)

| Arquivo (`.next/static/media`) | Família | Faixa | Bytes |
|---|---|---|--:|
| `26dc4a78…-s.p.woff2` | **Fraunces** | latino básico (o que baixa) | **120.724 B** |
| `d02d6674…-s.woff2` | Fraunces | latino estendido | 105.660 B |
| `e8c7e585…-s.woff2` | Fraunces | vietnamita | 34.176 B |
| `1a4aa509…-s.p.woff2` | Archivo | latino básico (o que baixa) | 34.940 B |
| `23d669af…-s.woff2` | Archivo | latino estendido | 32.672 B |
| `b06b356f…-s.woff2` | Archivo | vietnamita | 13.216 B |

1. **A Fraunces pesa 3,5× a Archivo** (120,7 kB contra 34,9 kB, o arquivo latino). woff2 já é comprimido: brotli não recomprime, então isto é peso real de rede.
2. **Ela só baixa onde é usada** (FATO, `network-requests` do Lighthouse): `/` e `/entrar` baixam 121.026 B de Fraunces + 35.240 B de Archivo = **156 kB de fonte, mais que todo o JS da home (154 kB)**. A página do salão, o agendamento e o confirmar baixam só a Archivo (35 kB).
3. **Não bloqueia o LCP por render:** `font-display: swap` nas duas famílias, fallback com `size-adjust` (`Fraunces Fallback` = Times New Roman a 115,45%), CLS 0,000 na home, e o `font-display-insight` do Lighthouse passa. Mas na home **o elemento do LCP é o título em Fraunces**, e os 121 kB disputam banda com o JS no 4G (a 1,6 Mbps, ~0,6 s de transferência só dela; INFERÊNCIA por conta, não medido isolado).
4. **Nenhuma fonte tem `preload`** (FATO: zero ocorrências de `woff2` no HTML de `/`, `/entrar` e `/[slug]`; o único `Link:` de cabeçalho é o do CSS). O `docs/42` §4.5 registrou preload da Archivo via `:HL` em 05/09; no build de hoje ele não existe. Efeito: a fonte só é descoberta depois do CSS.
5. **O eixo `SOFT` é baixado e nunca usado.** `layout.tsx:52` pede `axes: ["SOFT", "opsz"]`, mas nenhum CSS do projeto define `font-variation-settings` com `SOFT` (FATO: `grep` em `src` e no CSS gerado). Sem isso o eixo fica no padrão (`SOFT` 0, a serifa mais seca). Ou seja: **o arquivo carrega o eixo que deixaria o título "macio" (a promessa do `docs/109`) e a tela não usa.** É peso sem efeito e, para a frente C1, uma promessa de marca que não está na tela. HIPÓTESE: sem os eixos extras (só peso), o latino cai para perto de 40 a 60 kB.

---

## 5 · Onde o tempo vai, por tela (leitura de código, INFERÊNCIA até medir)

| Tela | Achado | Rótulo |
|---|---|---|
| todas as públicas | Radix Toast + tailwind-merge + next/image (~26 kB gzip) vêm dos limites `error`/`not-found` via `TelaPublica` (§1.3) | FATO (manifest), ganho no celular é INFERÊNCIA |
| todas | CSS único de 12,8 kB gzip bloqueia o render e leva o CSS do painel para a página do salão (§3) | FATO (tamanho e auditoria); ganho é estimativa do Lighthouse |
| `/[slug]`, `/[slug]/agendar`, `/confirmar/[token]`, `/onboarding`, `/entrar` | **Sem `loading.tsx`** (FATO, `find`). Rotas dinâmicas: o toque em "Agendar" na página do salão não muda nada na tela até o servidor responder | FATO a ausência; o tempo sem resposta não foi medido no navegador |
| `/[slug]` | `perfilPublico` busca **todas** as notas do salão (`client_reviews select rating`, `public-booking.ts:175`) para tirar a média; cresce com o salão | INFERÊNCIA (o seed tem poucas) |
| `/[slug]/agendar` | `quemIndicou` e `abrirLinkDeVolta` em série depois do perfil (`agendar/page.tsx:67-69`); só pesam quando há `?ind=` ou `?volta=` (link de indicação e link do "Chamar") | INFERÊNCIA: são justamente os links que o Motor manda |
| agendamento, troca de dia | 13 idas por toque em dia, 327 ms de mediana local; o botão do dia muda na hora? | idas FATO; reação ao toque NÃO VERIFICADA |
| `/admin/hoje` | 29 idas, com `tenants` ×3, `appointments` ×3, `services` ×2, `stock_moves` ×2 (§2.1) | FATO a contagem; ganho é INFERÊNCIA |
| `/admin/recuperar` | polyfill de Temporal de 44,4 kB gzip no celular (§1.4) | FATO |
| `/onboarding` | `getUser` → `memberships` → `professions` em série; a lista de profissões não depende de `memberships` | INFERÊNCIA |
| layout raiz | `@capacitor/core` + `status-bar` em toda página (3,1 kB gzip) | FATO, pequeno; não vale ticket sozinho |
| primeira visita | primeira requisição de `/[slug]` depois do start: 1.540 ms (carga de módulos). Em produção o `docs/28` mediu ~950 ms de cold start e concluiu que é plataforma (Fluid Compute) | FATO local; produção é o `docs/28` |

---

## 6 · NÃO VERIFICADO

| O quê | Por quê | Quem fecha |
|---|---|---|
| **INP** (toque com resposta visível ≤ 200 ms) em qualquer tela | Lighthouse de navegação não mede INP; precisa de toque real no navegador com CPU 4×. O navegador desta sessão é o da sessão principal, e a regra (`verificacao-paralela-sem-atrapalhar-outra-sessao`) é não disputar | EXP-D07 |
| LCP no **Fast 4G** de A6 | O Lighthouse só tem o perfil dele; medir com o DevTools de A6 precisa do navegador | EXP-D07 |
| TTFB de produção hoje | Proibido tocar produção nesta frente; os números de produção citados são de 27/08 (`docs/28`) | sessão principal, só leitura |
| `/onboarding` de quem acabou de criar conta | Exige conta sem vínculo; não criei conta no banco compartilhado | EXP-D07 |
| Página do salão **com fotos** | O storage local está vazio: capa, rostos e portfólio não existem no seed | EXP-D07 (subir 3 fotos no banco local) |
| `/calculadora` e `/[slug]/agendar` com 3 rodadas | 1 rodada válida em 10 a 11 tentativas (`NO_NAVSTART` intermitente). Números dessas duas são indicação, não mediana | repetir em máquina menos carregada |
| Tamanho da Fraunces sem os eixos extras | Exige build com a troca; não alterei código | EXP-D02 |
| Tela em branco ao navegar entre telas do painel | Não medido no navegador | EXP-D07 |

---

## 7 · Metas por tela (ajuste das metas iniciais de C3)

As metas de C3 eram [HIPÓTESE]. Ajuste com o "hoje" medido. Peso de JS é brotli (o que a Vercel serve). Tempo é no aparelho de A6 (Fast 4G, CPU 4×) salvo onde diz Lighthouse.

| Tela | Hoje (FATO, §1 a §3) | Meta | Por quê |
|---|---|---|---|
| `/[slug]` (página do salão) | JS 127,5 kB br; LCP 2,75 s (Lighthouse); TTFB local 106 a 171 ms | **JS ≤ 105 kB br; LCP ≤ 2,5 s no Lighthouse mobile** | é a primeira tela da cliente (C1); os ~22 kB br dos limites raiz saem sem tocar a página |
| `/[slug]/agendar` | JS 140,0 kB br; LCP 2,87 s (1 rodada) | **JS ≤ 120 kB br; LCP ≤ 2,5 s** | mesma lógica |
| troca de dia no agendar | 13 idas, 327 ms local | **reação ≤ 100 ms (o dia marcado e esqueleto na hora); horários ≤ 600 ms em 4G** | o toque mais repetido da cliente |
| `/confirmar/[token]` | 131,4 kB br; LCP 2,63 s | **LCP ≤ 2,0 s** | tela de um botão, vem do link do lembrete |
| `/` | 126,8 kB br JS + **156 kB de fonte**; LCP 3,34 s | **fonte ≤ 90 kB; LCP ≤ 2,5 s** | o elemento do LCP é o título em Fraunces |
| `/entrar` | 132,4 kB br + 156 kB de fonte; LCP 3,10 s | **LCP ≤ 2,5 s** | — |
| `/admin/hoje` | 169,9 kB br; 29 idas; produção 219 ms em 27/08 | **≤ 18 idas; TTFB de produção quente ≤ 200 ms** | P2: "abrir e saber o que fazer" ≤ 5 s |
| `/admin/recuperar` | **203,0 kB br**; 20 idas | **JS ≤ 165 kB br (sem polyfill de Temporal)** | P3, a jornada que vende o Motor |
| `/admin/agenda`, `/admin/clientes` | 165,3 / 157,1 kB br | **não crescer** (guarda de orçamento) | já perto do piso |
| todas | sem número de INP | **INP ≤ 200 ms** (meta de C3 mantida) | medir antes de mexer |
| rotas públicas dinâmicas | sem `loading.tsx` | **nenhuma tela sem sinal em > 300 ms depois do toque** | meta de C3 "tela em branco: nenhuma" |

---

## 8 · Tickets (formato B2, prefixo EXP-D)

Ordem pelo que rende por esforço. Os cinco primeiros são os que mais rendem.

```
EXP-D01 · Tela de erro e 404 sem o Toast: ~22 kB br a menos em toda página pública
Frente: desempenho
Lado: cliente (e todas as públicas)
Jornada: C1, C2, P1 (cadastro)
Classe: Recomendado
Quando: serve ao piloto
Hoje (FATO): a página do salão manda 148,8 kB gzip / 127,5 kB br de JS, dos quais 0,8 kB são dela. Radix Toast (11,9 kB gz), tailwind-merge (9,3 kB gz) e next/image (5,1 kB gz) entram porque `error.tsx` e `not-found.tsx` usam `TelaPublica`, que importa `ToastProvider` (`components/shell/tela-publica.tsx:1`). Os dois limites vão em toda rota.
Depois (meta): página do salão ≤ 105 kB br de JS; nenhuma tela pública perde o aviso de erro.
O que muda: `TelaPublica` deixa de embrulhar `ToastProvider`; quem usa `useToast()` (hoje `cadastro/formulario.tsx`, ver o comentário em `tela-publica.tsx:30-32`) põe o provider no próprio layout. `error.tsx`/`not-found.tsx` com casca sem Toast e sem `cn()`/`next/image` se possível (o `Selo` pode virar `<img>` com tamanho fixo).
Aceite medido: `next build` + soma dos `<script src>` do HTML de `/[slug]` (script de §1.2), comprimido, antes × depois; `app-build-manifest.json` de `/error` e `/not-found` sem o chunk do Radix Toast. No navegador: forçar erro numa rota pública e ver a tela de erro; abrir `/cadastro` e disparar o toast.
Guarda: teste que lê o `app-build-manifest.json` e reprova se `/error` ou `/not-found` trouxerem módulo de `radix-ui`; mutação: voltar o import em `tela-publica.tsx` reprova. Mais o teste de comportamento: `useToast()` em `/cadastro` continua achando provider.
Risco: `useToast()` lança fora do provider (de propósito); uma tela pública que usa toast e não foi achada quebra. Medir com `grep useToast` nas rotas públicas e abrir cada uma.
Tamanho: P
```

```
EXP-D02 · Fraunces só com o que a tela usa (e o SOFT de verdade, ou fora)
Frente: desempenho (com C1, marca)
Lado: os dois (home, preços, calculadora, cadastro, entrar)
Jornada: P1, C1 (primeiro contato)
Classe: Recomendado (a decisão de usar ou não o eixo SOFT é de marca: Do Vitor; padrão abaixo)
Quando: serve ao piloto
Hoje (FATO): o woff2 latino da Fraunces tem 120.724 B, 3,5× a Archivo (34.940 B). `/` e `/entrar` baixam 156 kB de fonte, mais que todo o JS da home. O elemento do LCP da home é o título em Fraunces (LCP 3,34 s no Lighthouse). `layout.tsx:52` pede os eixos SOFT e opsz, e nenhum CSS define `font-variation-settings` com SOFT: o eixo é baixado e o título sai com SOFT 0 (a serifa seca), o contrário do que o `docs/109` prometeu.
Depois (meta): fonte do título ≤ 55 kB; total de fonte da home ≤ 90 kB; LCP da home ≤ 2,5 s no Lighthouse mobile.
O que muda: padrão provisório — decidir o SOFT. Se é para ser macio: `font-variation-settings: "SOFT" 100` no `.font-display` e medir o arquivo; se não: tirar `SOFT` dos `axes`. Avaliar também tirar `opsz` (o título usa 1 ou 2 tamanhos) e trocar por peso fixo (`weight: "600"`). Arquivo: `src/app/layout.tsx`, `globals.css`.
Aceite medido: tamanho do `*.p.woff2` da Fraunces em `.next/static/media` antes × depois; Lighthouse mobile em `/` (3 rodadas válidas); captura do título a 375 px antes × depois, para a marca aprovar que o desenho não piorou.
Guarda: teste que reprova se `axes` pedir um eixo que nenhum CSS usa (casar `"SOFT"` em `axes:` com `"SOFT"` em `font-variation-settings`, cortando comentários antes; ver `guarda-casa-com-o-proprio-comentario`); mutação: reintroduzir `SOFT` sem CSS reprova.
Risco: o título perde o "macio" que a marca quer. Por isso a captura vai para o Vitor antes do merge.
Tamanho: P
```

```
EXP-D03 · Hoje sem leitura repetida: 29 idas ao banco viram ≤ 18
Frente: desempenho
Lado: profissional
Jornada: P2 (abrir de manhã e saber o que fazer)
Classe: Recomendado
Quando: serve ao piloto
Hoje (FATO): uma abertura de `/admin/hoje` faz 29 pedidos ao Supabase (log do Kong local): `tenants` 3×, `appointments` 3×, `services` 2×, `stock_moves` 2×, `client_cycles` 2×. TTFB local 460 a 683 ms com máquina carregada; produção quente era 219 ms em 27/08 (`docs/28`).
Depois (meta): ≤ 18 pedidos por abertura; TTFB de produção quente ≤ 200 ms (mediana de 5, medida só lendo).
O que muda: `cache()` por requisição (React) nas leituras de tenant e de agendamentos do dia/mês que os serviços de `resumoDeHoje`, `centralDeAcoes`, `receitaAtribuidaAoCiclo`, `listarParaRecuperar` e `prestacaoDeContasDoMotor` repetem; ou passar o que já veio do `contextoDoPainel` (timezone, settings) em vez de reler. Nunca variável de módulo (`vercel-regiao-do-banco`: vaza entre requisições).
Aceite medido: contagem no log do Kong local antes × depois (receita em §2); TTFB local 3 rodadas na mesma máquina e no mesmo minuto; número da tela idêntico antes × depois (captura de "Hoje" com o mesmo banco).
Guarda: teste de integração que conta os pedidos de uma abertura de "Hoje" (fetch instrumentado no cliente Supabase) e reprova acima de 18; mutação: tirar o `cache()` de uma leitura reprova.
Risco: cache por requisição servindo dado de outro tenant. O `cache()` do React é por requisição; a chave inclui `tenantId`. Teste de RLS continua passando.
Tamanho: M
```

```
EXP-D04 · Recuperar sem o polyfill de Temporal no celular (−44 kB gzip)
Frente: desempenho
Lado: profissional
Jornada: P3 (chamar quem passou do dia)
Classe: Recomendado
Quando: serve ao piloto
Hoje (FATO): `/admin/recuperar` manda 234,4 kB gzip / 203,0 kB br de JS, a tela mais pesada das jornadas. 44,4 kB gzip são o `@js-temporal/polyfill`, puxado por `admin/recuperar/fila.tsx:9` → `core/ciclo/ritmo-do-cliente.ts:1` (e `core/tempo/dia.ts:1`). O mesmo chunk vai em `/admin/clientes/[id]`, `importar` e `ja-atendo`.
Depois (meta): `/admin/recuperar` ≤ 165 kB br; o chunk do polyfill fora das quatro rotas.
O que muda: o ritmo e a frase do ritmo são calculados no servidor (`page.tsx`) e viajam como texto/número para `fila.tsx`; ou a conta de dias do cliente usa `Date`/`Intl` em UTC num módulo separado de `core/tempo/dia.ts`. Regra 4 do CLAUDE.md continua: nada de aritmética em horário local.
Aceite medido: soma dos scripts do HTML de `/admin/recuperar` antes × depois; `app-build-manifest.json` sem o chunk do polyfill nas quatro rotas; a frase do ritmo idêntica antes × depois para 5 clientes do seed (captura).
Guarda: teste que reprova se algum arquivo com `'use client'` alcançar `@js-temporal/polyfill` pelo grafo de imports (o rastreador de §1.4 vira teste); mutação: importar `ritmoDoCliente` de novo em `fila.tsx` reprova.
Risco: a frase do ritmo mudar perto da virada do dia ou no dia de mudança de fuso. Teste de fuso já existe; rodar com `TZ=UTC` (`teste-de-fuso-em-maquina-de-brasilia`).
Tamanho: M
```

```
EXP-D05 · CSS que não bloqueia: a página do salão pinta sem esperar o CSS do painel
Frente: desempenho
Lado: cliente (e todas)
Jornada: C1, C2
Classe: Recomendado
Quando: serve ao piloto
Hoje (FATO): um CSS único de 65.146 B crus / 12.798 B gzip, com o painel inteiro, bloqueia o render de toda página. O Lighthouse estima 240 ms de ganho no salão e 1.050 ms em `/entrar` (`render-blocking-insight`). O primeiro quadro sai depois do `load` em 4 das 5 rotas medidas (salão: load 571 ms, FCP 770 ms, sem limitação), e o LCP simulado é igual ao TTI.
Depois (meta): LCP de `/[slug]` e `/[slug]/agendar` ≤ 2,5 s no Lighthouse mobile (hoje 2,75 e 2,87 s).
O que muda: testar `experimental.inlineCss` do Next 15 (CSS no HTML, sem pedido que bloqueia) e medir o HTML brotli resultante; se o HTML crescer demais, separar o CSS do painel (`/admin`) do das públicas. Uma hipótese por rodada.
Aceite medido: Lighthouse mobile 3 rodadas válidas em `/[slug]`, `/[slug]/agendar`, `/` e `/entrar` antes × depois, na mesma máquina e na mesma hora; HTML brotli antes × depois (o custo do inline); CLS continua 0.
Guarda: orçamento em teste: CSS bloqueante da página do salão ≤ N bytes gzip (N = o número depois), lido do build; mutação: voltar a configuração reprova.
Risco: CSP (o `style-src` precisa aceitar o inline; hoje aceita, `admin/layout.tsx` já usa `<style>`); HTML maior em toda navegação. Medir o brotli do HTML.
Tamanho: M
```

```
EXP-D06 · Sinal na hora nas rotas públicas dinâmicas (loading.tsx)
Frente: desempenho
Lado: cliente
Jornada: C1 (salão → agendar), C2 (confirmar)
Classe: Recomendado
Quando: serve ao piloto
Hoje (FATO): `/[slug]`, `/[slug]/agendar`, `/confirmar/[token]`, `/onboarding` e `/entrar` não têm `loading.tsx`; são rotas dinâmicas (`force-dynamic` ou leitura de sessão). TTFB local do agendar 77 a 155 ms, mais a rede do 4G. O tempo sem resposta ao tocar "Agendar" não foi medido no navegador.
Depois (meta): nenhum toque sem sinal visível em > 300 ms (meta de C3: "tela em branco ou carregando sem aviso: nenhuma").
O que muda: `loading.tsx` com esqueleto na cor do salão para `[slug]` e `[slug]/agendar`; estado de "abrindo" no botão "Agendar" da página do salão.
Aceite medido: no navegador de A6 (375×812, CPU 4×, Fast 4G e Slow 4G), do toque em "Agendar" até a primeira mudança na tela, média de 3; captura do esqueleto.
Guarda: teste que exige `loading.tsx` em toda rota dinâmica de `(public)` que é destino de link da cliente; mutação: apagar o de `agendar` reprova.
Risco: esqueleto que pisca em rede boa. Medir em Wi-Fi: se o servidor responde em < 100 ms, o esqueleto não deve aparecer (atraso de exibição).
Tamanho: P
```

```
EXP-D07 · Placar de toque e tela no aparelho de A6 (INP, Fast 4G, fotos, cadastro novo)
Frente: desempenho
Lado: os dois
Jornada: P1, P2, P3, P4, C1, C2
Classe: Decidido (é a medida que C3 exige e esta rodada não fez)
Quando: serve ao piloto (antes de qualquer ticket D que mexe em toque)
Hoje (FATO): nenhum INP medido; nenhum LCP no Fast 4G; página do salão medida sem fotos (storage local vazio); `/onboarding` de conta nova não medido; `/calculadora` e `/agendar` com 1 rodada de Lighthouse cada (§6).
Depois (meta): tabela em `medidas/` com INP e "toque → tela utilizável" de cada toque das jornadas (lista do `docs/107`), Fast 4G e Slow 4G, cache vazio e cheio, média de 3.
O que muda: nada de código. Subir 3 fotos (capa, um rosto, um portfólio) no `demo-studio-bella` do banco LOCAL antes de medir a página do salão.
Aceite medido: a própria tabela, com captura de cada toque.
Guarda: não se aplica (é medida). O número de cada toque vira linha de base para a guarda dos tickets que mexerem nele.
Risco: medir com outra sessão usando o mesmo navegador e banco: seguir `verificacao-paralela-sem-atrapalhar-outra-sessao`.
Tamanho: M
```

```
EXP-D08 · Troca de dia no agendamento: resposta na hora e menos idas
Frente: desempenho
Lado: cliente
Jornada: C1
Classe: Recomendado
Quando: depois do piloto (depende do número de EXP-D07)
Hoje (FATO): cada toque num dia chama `GET /api/v1/public/[slug]/availability`: 13 pedidos ao Supabase (rate limit, tenant, serviço, profissionais, e `business_hours`/`time_off`/`appointments` para cada profissional), 327 ms de mediana local (204 a 591 ms). A reação visual ao toque não foi medida.
Depois (meta): reação ≤ 100 ms; horários na tela ≤ 600 ms em Fast 4G.
O que muda: uma consulta por tabela para todos os profissionais (`in('professional_id', ids)`) em vez de três por profissional; o dia tocado fica marcado e a grade vira esqueleto no mesmo quadro.
Aceite medido: contagem do Kong por chamada antes × depois (13 → ≤ 7); placar de EXP-D07 para "toque no dia → horários".
Guarda: teste de integração que conta pedidos de uma chamada de disponibilidade com 3 profissionais; mutação: voltar ao laço por profissional reprova. Os testes de slot (fuso, dia de 23/25 h) continuam.
Risco: errar slot de um profissional ao juntar as consultas. Os testes de `disponibilidade` cobrem; rodar a suíte inteira (`suite-inteira-antes-do-commit`).
Tamanho: M
```

```
EXP-D09 · Nota média do salão sem baixar todas as notas
Frente: desempenho
Lado: cliente
Jornada: C1
Classe: Recomendado
Quando: depois do piloto
Hoje (FATO): `perfilPublico` faz `client_reviews.select('rating')` sem limite para todo o salão (`server/services/public-booking.ts:175`), em toda abertura da página do salão e do agendamento, para calcular a média. No seed o volume é pequeno; o custo cresce com o salão (INFERÊNCIA).
Depois (meta): uma linha por abertura (média e contagem agregadas no banco), qualquer que seja o número de avaliações.
O que muda: agregação no banco (`avg`/`count` numa view com `security_invoker` ou RPC), mesma nota exibida.
Aceite medido: bytes da resposta do PostgREST para o salão do seed com 500 avaliações sintéticas no banco local, antes × depois; nota exibida idêntica.
Guarda: teste que confere a nota agregada contra a média calculada em memória num cenário montado (com prova de que há avaliações).
Risco: view sem `security_invoker` furar RLS (CLAUDE.md); RLS test obrigatório.
Tamanho: P
```

```
EXP-D10 · Orçamento de JavaScript por rota, guardado
Frente: desempenho
Lado: os dois
Jornada: todas
Classe: Recomendado
Quando: antes do lançamento
Hoje (FATO): ninguém guarda o peso: o compartilhado está em 104 kB desde 04/09 por sorte, e o polyfill de Temporal (EXP-D04) e o Toast nos limites raiz (EXP-D01) entraram sem ninguém ver.
Depois (meta): build falha se uma rota das jornadas passar do orçamento (números de §7 depois de D01 e D04).
O que muda: script que soma os chunks de cada rota a partir do `app-build-manifest.json` + limites raiz e compara com uma tabela versionada; roda no CI depois do build.
Aceite medido: a CI reprova numa PR de teste que importa `@js-temporal/polyfill` num componente cliente da página do salão.
Guarda: é a própria guarda; mutação descrita no aceite. Ela tem de gritar se o manifest não for achado (`guarda-que-varre-passa-vazia`).
Risco: orçamento apertado demais vira atrito; folga de 5%.
Tamanho: P
```

---

## 9 · O que fica de fora, de propósito

- **`getUser()` duplicado** (middleware + página): decidido no `docs/28` §10, segurança acima de ~30 ms.
- **Capacitor no layout raiz** (3,1 kB gzip): pequeno demais para um ticket sozinho; entra junto se EXP-D01 mexer no layout.
- **Payload RSC da página do salão** (40.470 B crus de 68.137 B do HTML): o HTML inteiro vai a 6.831 B em brotli. Não é o gargalo (`byte-cru-e-a-regua-errada`).
- **Cold start**: plataforma (`docs/28` §9, Fluid Compute), não código.

## 10 · Como reproduzir

1. Worktree próprio (`git worktree add --detach ../ciclo-medicao-NNN <branch>`), `.env.local` copiado, `pnpm install --frozen-lockfile`, `pnpm build` (3,3 min de compilação nesta máquina, SWC nativo bloqueado: `smart-app-control-build-lento`), `pnpm start -p 3051`.
2. Peso: baixar o HTML da rota, somar os `<script src>` (sem `noModule`) lendo de `.next/static`, gzip 9 e brotli 11 do `zlib` do Node. Parar se não houver brotli.
3. Idas ao banco: diferença de linhas de `docker logs supabase_kong_ciclo-marca` em volta de **uma** requisição, com sessão nova (sessão vencida soma um `POST /auth/v1/token` por pedido, porque o `curl` não guarda o cookie renovado).
4. Lighthouse: `npx lighthouse@13.4.1 <url> --preset=perf --form-factor=mobile --throttling-method=simulate --output=json --chrome-flags=--headless=new`; descartar rodada com `runtimeError` e contar as descartadas. O erro `EPERM` no fim (limpeza da pasta temporária do Chrome no Windows) não estraga o JSON.
5. Ao terminar: parar o `next start` pelo PID dono da porta, `git worktree remove --force` e, se o Windows reclamar de caminho longo, `rmdir /s /q "\\?\<caminho>"` + `git worktree prune`.
