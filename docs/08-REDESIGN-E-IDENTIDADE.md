# 08 · REDESENHO E IDENTIDADE VISUAL — auditoria completa e plano de execução

> Data: 2026-08-19 · Escopo: toda a camada visual do CICLO (app do profissional, telas
> públicas, site do salão). Nenhuma regra de negócio muda. Nenhuma rota nova.
>
> Este documento junta as duas auditorias visuais do projeto, feitas na mesma sessão e com o
> mesmo método (leitura integral + medição no DOM real + reprodução isolada de cada suspeita
> antes de virar item). Ele não substitui `03-DESIGN-SYSTEM.md` — ele **corrige e estende**
> aquele documento onde a execução provou que a especificação estava incompleta (§8 lista as
> emendas). Onde os dois discordam sobre token de cor, **a Parte II decide** — ela é posterior
> e corrige uma decisão de cor que a própria Parte I tinha deixado errada.
>
> **Parte I — execução.** Por que a interface entregava menos do que o próprio código prometia:
> tipografia que não chegava na tela, campo que fazia o iPhone dar zoom, navegação sem saída em
> PWA. ✅ **Auditada, corrigida, commitada e em produção** (`ciclo-umber.vercel.app`).
>
> **Parte II — identidade.** Por que, mesmo com a execução correta, o produto parece gerado por
> IA: cor, gradiente, marca e ícone são valores de fábrica, não decisões. ⬜ **Auditada e
> planejada; execução começa nas fases E0–E5 (§ Parte II · 11), abaixo.**

---

# PARTE I · EXECUÇÃO — ✅ já aplicada e no ar

## I.1 Veredito

A base era boa — melhor do que a média de SaaS brasileiro: tokens em CSS variável, tema escuro
nativo, componentes com `aria` de verdade, `prefers-reduced-motion`, foco visível, sombra
pensada para fundo escuro. **O problema não era gosto, era execução.** Três defeitos estruturais
faziam a interface entregar bem menos do que ela mesma prometia: (1) **a escala tipográfica
inteira era descartada em tempo de execução** por uma colisão do `tailwind-merge`, e ninguém
percebeu porque o resultado era "quase certo"; (2) **o design system estava pela metade** — não
existia `Input`, e por isso 89 campos de formulário foram escritos à mão, com um tamanho de
fonte que **fazia o iPhone dar zoom em cada toque**; (3) **a navegação tinha becos sem saída em
PWA** — 12 telas sem botão de voltar, num app instalado que não tem botão de voltar do
navegador. Nada disso aparecia numa olhada rápida no desktop. Era sentido, todo dia, por quem
usa o app em pé, segurando o celular com uma mão, entre uma cliente e outra.

## I.2 Método

Auditoria feita em três camadas, todas com evidência:

1. **Leitura integral** dos 20 componentes de `src/components` e das 33 telas de `src/app`.
2. **Medição ao vivo** — dev server em `:3015`, viewport 375×812, estilos computados lidos do
   DOM real (não do código-fonte). Foi aqui que a colisão da tipografia apareceu: o código diz
   11,5 px, o navegador entrega 15 px.
3. **Reprodução isolada** — cada suspeita confirmada fora do app (ex.: `twMerge` rodado no Node
   com os pares reais de classes) antes de virar item deste documento.

Toda linha marcada `▲` foi verificada, não inferida. O mesmo método foi reaplicado na Parte II.

## I.3 Defeitos estruturais

### D1 · ▲ A escala tipográfica não chegava na tela — CRÍTICO

`cn()` é `twMerge(clsx(...))`. O `tailwind-merge` não conhecia a escala do CICLO
(`text-corpo`, `text-label`, `text-overline`…). Sem conhecer, classificava esses nomes como
**cor de texto** — e então qualquer `text-txt-2`/`text-acc-2` que viesse depois **apagava o
tamanho da fonte**.

Reproduzido no Node, com os pares exatos que os componentes usavam:

```
"text-label font-semibold | text-acc-2"            => font-semibold text-acc-2      ← 11,5px perdido
"text-overline font-semibold uppercase | text-warn"=> font-semibold uppercase text-warn ← 11px perdido
"text-secundario font-semibold | text-txt-2"       => font-semibold text-txt-2      ← 13px perdido
"text-corpo font-semibold | text-txt"              => font-semibold text-txt        ← 15px perdido
"text-titulo font-extrabold | text-txt"            => font-extrabold text-txt       ← 25px perdido
```

Confirmado no DOM: o `Chip` da vitrine, que pedia `text-label` (11,5 px), **renderizava a 15
px**. Atingidos: `chip`, `section-header`, `tab-bar`, `badge`, `button`, `appointment-row`,
`empty-state`, `sheet`, `toast`, `agenda.tsx`, `lista.tsx` (clientes), `recuperar.tsx` — a barra
de navegação, todo cabeçalho de seção e todo filtro do app.

**Correção aplicada:** `extendTailwindMerge` declarando os sete nomes da escala no grupo
`font-size`, mais teste unitário (`tests/unit/design/cn.test.ts`) que reprova o build se um nome
novo entrar na escala sem entrar na configuração.

### D2 · ▲ Todo campo de formulário fazia o iPhone dar zoom

Regra do Safari iOS: campo com fonte menor que 16 px dispara zoom automático no foco. O
`--text-corpo` era 15 px, usado em **todos** os 89 `input`/`select`/`textarea` do projeto —
inclusive no agendamento público, onde quem sofria era a cliente final, no funil de conversão.

**Correção aplicada:** `--text-corpo` subiu para 16 px, mais a regra de base
`input, select, textarea { font-size: max(16px, 1em) }`, que blinda todos os campos de uma vez.

### D3 · ▲ Não existia componente de campo — 89 campos copiados à mão

`03-DESIGN-SYSTEM §4` exigia `MoneyInput` e `PhoneInput`. Nenhum existia. Nem um `Input`
genérico. Sem estado de erro padrão, sem `aria-invalid`, sem máscara de telefone, sem
`autoComplete` no agendamento público.

**Correção aplicada:** `Field` + `Input` + `Textarea` + `Select` + `MoneyInput` + `PhoneInput`,
48 px de altura, 16 px de fonte, rótulo real, texto de ajuda, erro com `aria-invalid`/
`aria-describedby`.

### D4 · ▲ PWA sem saída: 12 telas sem botão de voltar

`display: "standalone"` — instalado, o app não tem barra do navegador, logo não tem botão de
voltar. Só três telas tinham `ArrowLeft`. Ficavam sem saída as 9 telas de `/admin/config/*`,
`/admin/comanda/*`, `/admin/campanhas` e `/admin/agenda/novo`.

**Correção aplicada:** `Topbar` virou navegação contextual — raiz de aba mostra a marca,
sub-rota mostra voltar + destino (`src/components/shell/navegacao.ts`).

### D5 · ▲ O botão do estado vazio não parecia um botão

Quatro telas passavam `acao={<Link>…</Link>}` sem classe — nas **três telas mais usadas** do
app, o CTA do estado vazio renderizava como texto corrido.

**Correção aplicada:** `EmptyState` estiliza o slot de ação (`[&_a]`/`[&_button]`), tornando o
erro impossível mesmo com link cru.

### D6 · ▲ Alvos de toque abaixo do mínimo que o próprio documento exigia

`§3.6` mandava ≥ 48×48 px. Medido: `Chip` tinha 32 px — filtro de profissional, filtro de
segmento e **cada horário disponível no agendamento público**.

**Correção aplicada:** pílula com 40 px visual e **área de toque de 48 px** via padding vertical
transparente (`toque-48`), verificada no DOM com `elementFromPoint`, não só no CSS.

### D7 · ▲ A barra do topo entrava por baixo do relevo do iPhone

`Topbar` sticky sem `env(safe-area-inset-top)` — conteúdo sob o relógio/ilha dinâmica.

**Correção aplicada:** `pt-[env(safe-area-inset-top)]` na `Topbar`; folga inferior paga uma vez.

### D8 · ▲ No desktop, a navegação se descolava do conteúdo

`TabBar` em largura total enquanto o conteúdo vive numa coluna de 560 px.

**Correção aplicada:** `TabBar` centralizada, acompanhando a coluna.

### D9 · Estados de erro e carregamento incompletos

33 telas, 3 `loading.tsx`, 0 `error.tsx` — falha caía na página crua do Next, em inglês.

**Correção aplicada:** `error.tsx` (raiz e `/admin`) e os `loading.tsx` que faltavam, em
português, com esqueleto fiel ao layout real.

### D10 · Componentes obrigatórios que nunca foram feitos

`AlertBanner`, `MoneyInput`, `PhoneInput` eram obrigatórios no design system e nunca existiram.

**Correção aplicada:** os três, mais `Field`, `PageHeader`, `FilterRow`, `Avatar`, `ActionBar`.

## I.4 Defeitos de composição corrigidos

| # | Onde | O que estava acontecendo | O que entrou no lugar |
|---|---|---|---|
| C1 | Todo o app | Gradiente hardcoded em 9 lugares | Virou token `--grad-acc` *(⚠️ ver Parte II — este token é removido na próxima rodada)* |
| C2 | `hoje` | "Faturado hoje" do mesmo tamanho de tudo | Virou herói: `--text-numero` (34 px), com comparação com ontem |
| C3 | `hoje` | Cabeçalho mostrava o nome do salão (constante, peso zero) | Saudação por período + o que importa agora |
| C4 | Topbar | 52 px só para escrever "CICLO" | Barra contextual (D4) |
| C5 | Tab bar | 82 px + safe-area ≈ 116 px, 14% da tela | 64 px + safe-area, indicador ativo |
| C6 | Listas | Três anatomias diferentes para "linha tocável com valor à direita" | Anatomia única: faixa de estado, conteúdo, valor tabular, chevron |
| C7 | Clientes | 200 linhas de nome sem âncora visual | Avatar de iniciais, cor derivada do nome |
| C8 | Recuperar | Botão de ação sumia do campo de visão ao rolar | Barra de ação flutuante acima da tab bar |
| C9 | Movimento | Só `Sheet`/toast/`TelaPublica` animavam | Tokens de duração/curva, `active:scale` em tudo tocável |
| C10 | Skeleton | `animate-pulse` piscando | Shimmer varrendo, respeitando `prefers-reduced-motion` |
| C11 | Site público | `<h1>` de 25 px sobre fundo liso | Hero com nome grande, aberto/fechado, CTA fixo |
| C12 | Agendar público | 4 escolhas rolantes, sem progresso | Passos numerados + resumo fixo no rodapé |
| C13 | Config | 9 itens em lista chapada | Agrupado por tema |
| C14 | Formulários | Botão de salvar rolava com o conteúdo | Rodapé de ação fixo |

## I.5 Tokens da Parte I (histórico — ver Parte II para os valores vigentes)

```css
--on-acc:    #0a0a0f;   /* superado — ver Parte II §3.3 */
--grad-acc:  linear-gradient(135deg, var(--acc), var(--acc-2));  /* removido — ver Parte II §6 */
--surface-press: rgba(255,255,255,.05);
--overlay:   rgba(5,5,10,.72);
--ring:      var(--acc-2);
--gutter: 18px;
--radius-sheet: 24px;
--shadow-fab: 0 6px 20px color-mix(in srgb, var(--acc) 35%, transparent);
--ease-ios: cubic-bezier(.32,.72,0,1);
--dur-1: 120ms;  --dur-2: 220ms;  --dur-3: 320ms;
```

Escala tipográfica corrigida (entrelinha e tracking declarados — **ver Parte II §4.1** para a
troca de família, que herda estes tamanhos):

| Token | Tamanho | Entrelinha | Tracking | Uso |
|---|---|---|---|---|
| `--text-numero` | 34px | 1.05 | −0.02em | dinheiro herói |
| `--text-titulo` | 26px | 1.15 | −0.02em | título de tela |
| `--text-stat` | 21px | 1.2 | −0.015em | valor de stat |
| `--text-corpo` | 16px | 1.45 | 0 | corpo e todo campo |
| `--text-secundario` | 13.5px | 1.4 | 0 | apoio |
| `--text-label` | 12px | 1.35 | 0 | rótulo, tab bar |
| `--text-overline` | 11px | 1.2 | +0.13em | cabeçalho de seção |

Base: `input, select, textarea { font-size: max(16px, 1em) }` · `-webkit-tap-highlight-color:
transparent` · `overscroll-behavior-y: contain` · `env(safe-area-inset-top)` · `.scroll-x` com
`scroll-snap` e máscara de esmaecimento.

## I.6 Plano executado

| Fase | Conteúdo | Status |
|---|---|---|
| F0 · Fundação | `cn()` corrigido + teste; tokens; base CSS | ✅ |
| F1 · Componentes novos | `Field`, `Input`, `Textarea`, `Select`, `MoneyInput`, `PhoneInput`, `PageHeader`, `FilterRow`, `IconButton`, `Avatar`, `AlertBanner`, `ActionBar` | ✅ |
| F2 · Componentes existentes | `Button`, `Chip` (48px), `Card`, `EmptyState`, `Sheet`, `Toast`, `Skeleton`, `StatTile`, `AppointmentRow` | ✅ |
| F3 · Navegação | `Topbar` contextual, `TabBar` 64px centralizada | ✅ |
| F4 · Telas | `hoje`, `agenda`, `clientes`, `recuperar`, `config`, `entrar`/`cadastro`/`onboarding`, `/[slug]`, `/[slug]/agendar` | ✅ |
| F5 · Estados | `error.tsx`, `loading.tsx` faltantes | ✅ |
| F6 · Verificação | typecheck/lint/test/build + medição no DOM a 375px | ✅ |

Verificado com evidência real: `typecheck`/`lint`/364 testes unitários/build de produção
limpos; medido no DOM — campo a 16px/48px, `Chip` com 48px de área de toque efetiva
(`elementFromPoint`), zero overflow horizontal. **Commit `78dcb5b`, no ar em
`https://ciclo-umber.vercel.app`.**

---

# PARTE II · IDENTIDADE — ⬜ auditada, planejada, execução a seguir

## II.0 Sumário

A Parte I corrigiu a **execução**. Com ela pronta, ficou visível o problema seguinte, que a
Parte I não tocou de propósito: **o produto está bem construído e não tem identidade nenhuma.**
Três frases resumem esta parte:

1. A interface parece gerada por IA porque **é literalmente montada de valores de fábrica** —
   29 marcas catalogadas abaixo, cada uma com arquivo e linha. Nenhuma é questão de gosto.
2. A correção não é "escolher cores mais bonitas": é **decidir**, uma vez, o que a cor significa
   neste produto — e a conclusão é que **o acento não deve ser um matiz, e sim luz**, com cor
   reservada exclusivamente para exceção.
3. Nada disso é estrutural. As fases E0–E5 derrubam a maior parte da "cara de IA" sem tocar em
   uma regra de negócio, e são reversíveis.

Restrição que governa todas as decisões desta parte: o mesmo app é de uma **barbearia** e de uma
**manicure**. Nada pode ser masculino nem feminino. Neutro aqui não é ausência de opinião — é a
opinião mais difícil de sustentar, e a maior parte desta parte existe para sustentá-la.

## II.1 A autópsia — 29 marcas de interface gerada

Cada linha foi verificada no repositório. Nenhuma é impressão subjetiva.

### A · Cor (8)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| A1 | `--acc: #a855f7` | `globals.css` | É o `purple-500` do Tailwind sem uma casa alterada. Roxo é o acento padrão de praticamente todo app gerado desde 2023 |
| A2 | As seis cores de vertical são swatches crus | `0002_vertical_packs.sql:35,83,131,172,206,243` | `#a855f7` purple-500 · `#ec4899` pink-500 · `#f59e0b` amber-500 · `#8b5cf6` violet-500 · `#10b981` emerald-500 · `#f97316` orange-500. Seis nichos, zero decisões |
| A3 | Cílios `#a855f7` e sobrancelhas `#8b5cf6` são quase a mesma cor | idem | A prova de que a lista foi copiada e não olhada |
| A4 | Cor atribuída por estereótipo: rosa=unhas, âmbar=barbearia | idem | Quebra a exigência central do produto (neutro entre barbearia e manicure) |
| A5 | `--bg: #0a0a0f` — preto **azulado** | `globals.css` | Preto-azul é o preto de software. Somado a roxo saturado, é o dark mode de SaaS genérico |
| A6 | Roxo + app + números grandes, no Brasil | — | Lê Nubank, não beleza |
| A7 | `--ok #5FA97F` e `--bad #E2685F` têm luminância quase idêntica (Δ 0,054) | `globals.css` | Em daltonismo verde-vermelho (~8% dos homens, público direto de barbearia) os dois estados viram a mesma cor |
| A8 | A mesma cor é marca, ação primária e estado | todo o app | Se roxo é "o produto", "clique aqui" e "confirmado" ao mesmo tempo, a cor deixou de informar qualquer coisa |

### B · Gradiente e efeito (4)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| B1 | `--grad-acc: linear-gradient(135deg, …)` como assinatura, em 12 pontos | `globals.css` + 11 usos | 135° é o ângulo padrão; diagonal roxo→lilás é o clichê visual do gênero inteiro |
| B2 | Gradiente na barra de progresso de fidelidade | `clientes/[id]/fidelidade.tsx:158` | Decoração pura: a barra já comunica por comprimento |
| B3 | **Três** brilhos radiais no topo da tela | `[slug]/secoes.tsx:74` · `admin/layout.tsx:28` · `shell/tela-publica.tsx:15` | O "glow" atrás do herói é a assinatura do template de landing gerada |
| B4 | CTA público preenchido com gradiente | `[slug]/secoes.tsx` | O botão mais importante do funil é também o mais genérico da tela |

### C · Marca (4)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| C1 | O logo é a letra **C** dentro de um círculo com gradiente | `shell/selo.tsx` | É o placeholder que toda ferramenta de geração produz quando não existe marca |
| C2 | O ícone do PWA é a mesma coisa rasterizada | `public/icons/*.png` | É o ativo de marca mais visto do produto |
| C3 | A arte ocupa ~78% do canvas no `maskable` | idem | A zona segura é 80% em círculo: o sistema corta a marca em parte dos Androids |
| C4 | Sem favicon próprio; `theme_color` no preto antigo | `manifest.json` | Aba e barra do sistema entregam a cor errada |

### D · Tipografia (3)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| D1 | Fonte: **Inter** | `layout.tsx` | Não é errada, é anônima — é a fonte de "nenhuma decisão foi tomada" |
| D2 | `font-extrabold` (peso 800) em **30** lugares | varredura em `src/` | Quando tudo é extrabold, nada tem ênfase |
| D3 | Hierarquia feita por peso, não por tamanho e espaço | idem | Engrossar é o atalho — o resultado é a tela "quase toda do mesmo tamanho" |

### E · Composição (4)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| E1 | Herói centralizado, pilha simétrica: brilho → título → tagline → badge → 2 botões | `[slug]/secoes.tsx:70-105` | É a anatomia exata da landing gerada |
| E2 | `text-center` em 12 telas | varredura | Texto centralizado é para bloco curto; em tela de trabalho a margem "dança" |
| E3 | Dois botões lado a lado com peso quase igual no herói | idem | Duas ações primárias = nenhuma ação primária |
| E4 | Badge de estado flutuando solto entre título e botões | idem | Gramática de template |

### F · Ícone e linguagem (4)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| F1 | **`Sparkles` representa o conceito central do produto** | `tab-bar.tsx:11` · `badge.tsx:30` · `alert-banner.tsx:19` · `hoje/central-de-acoes.tsx:21` · `clientes/[id]/ficha.tsx:269` · `recuperar.tsx:132` | O brilho ✨ é o emblema universal de "isto foi feito por IA". O Motor de Ciclo — a coisa que justifica o produto existir — está simbolizado pelo emblema de conteúdo gerado |
| F2 | `Zap` para urgência | `appointment-row.tsx:90` | Raio é o segundo clichê da mesma família |
| F3 | `AlertTriangle` **e** `TriangleAlert` no mesmo projeto | varredura | Mesmo ícone, dois nomes — sintoma de código colado de fontes distintas |
| F4 | Ícone ao lado de quase todo rótulo | várias | Quando tudo tem ícone, o ícone deixa de guiar o olho |

### G · Resíduo (2)

| # | O que está lá | Onde |
|---|---|---|
| G1 | `next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` | `public/` — sobras do `create-next-app` |
| G2 | `background_color`/`theme_color` ainda no `#0a0a0f` antigo | `manifest.json` |

### O que não é marca de IA — preservar

- **Shimmer no `Skeleton`**: varrer lê como "está vindo", piscar lê como "algo errado". Correto.
- **`backdrop-blur` só em `Topbar`, `TabBar`, `ActionBar` e overlay do `Sheet`** — os quatro
  lugares com conteúdo rolando por baixo.
- **`--radius-pill` restrito a chip, badge, avatar e alça do sheet.**
- **Máscara de esmaecimento no `.scroll-x`.**
- **Todos os tokens da Parte I** (escala tipográfica, `--gutter`, `--tabbar-h`, `--ease-ios`).

## II.2 Por que isso acontece

Código gerado otimiza por **plausibilidade**, e plausibilidade é a mediana do que existe. A
mediana da interface de SaaS é: fundo quase preto azulado, acento roxo, gradiente diagonal,
Inter, ícone de brilho, herói centralizado. Cada decisão que **não** foi tomada explicitamente
cai nessa mediana. Daí a única correção possível: **não é ter mais gosto, é gastar decisões.**
Cada seção abaixo gasta uma, e diz o que foi descartado junto.

## II.3 Cor — a decisão

### 3.1 O espaço de busca

O produto já compromete matizes com significado, o que restringe o acento por eliminação:

| Família | Situação | Veredito |
|---|---|---|
| Verde | ocupado por "confirmado/pago" | ❌ |
| Âmbar / amarelo | ocupado por "aguardando" | ❌ |
| Laranja | ocupado por "risco" | ❌ |
| Vermelho | ocupado por "faltou/cancelado" | ❌ |
| Azul | ocupado por "informativo"; acento genérico de SaaS | ❌ |
| Roxo / violeta / índigo | marca de IA (A1) e território do Nubank (A6) | ❌ |
| Rosa / magenta | estereótipo de gênero; território de Booksy/Avec | ❌ |
| Turquesa / teal | vizinho do verde semântico | ❌ |
| Latão / dourado | vizinho do âmbar de aviso | ❌ — ver 3.2 |
| Neutro quente (osso, areia) | não colide com nada; não tem gênero | ✅ |

### 3.2 Correção de rota: por que latão foi descartado

A primeira versão desta auditoria propunha latão `#C9A227`. Estava errado, e o próprio texto já
denunciava: exigia a regra "latão e `--warn` nunca podem aparecer na mesma linha como coisas
diferentes". **Quando a paleta precisa de uma regra para não brigar consigo mesma, a paleta está
errada.** Latão fica reservado para eventual marca impressa; não entra na interface.

### 3.3 A conclusão: o acento não é um matiz, é luz

> **`--acc` passa a ser osso — um branco quente. A interface do CICLO não tem cor de marca.**

```css
--acc:      #F0EBE3;  /* osso — ação primária, marca, item ativo */
--acc-2:    #FFFCF7;  /* topo do realce (hover, foco) */
--acc-soft: rgba(240, 235, 227, 0.10);
--on-acc:   #0D0C0C;  /* texto sobre o osso preenchido — substitui o valor da Parte I */
```

Medido: **16,46:1** sobre o fundo, nos dois sentidos. O roxo atual entrega 4,94:1 — passa
raspando e obriga a compensar com peso, parte da razão dos 30 `font-extrabold` (D2).

Por que esta é a decisão certa: é a única saída do espaço de busca (3.1); resolve barbearia ×
manicure de forma definitiva (branco quente não tem gênero); é o gesto do produto que ele quer
ser (botão claro sobre fundo escuro é a gramática de ferramenta séria); devolve função à cor; e
o ícone na tela inicial vira o quieto — numa grade de ícones saturados, um campo quase preto com
um anel osso é o que se acha primeiro.

A cor do salão continua existindo — na página pública dele (§II.9), que é onde ela é, de fato, a
marca dele.

### 3.4 A base: preto quente, não preto azul

```css
--bg:        #0D0C0C;
--surface:   #161514;
--surface-2: #201E1D;
--surface-3: #2B2926;
```

`#0a0a0f` é azulado — o preto de software. Preto levemente quente lê como objeto (couro, madeira,
mármore), ambiente físico de um salão. É a troca mais barata e mais eficaz de todo o documento.

### 3.5 A regra que muda tudo: cor é exceção, não confirmação

Hoje, todo agendamento confirmado é verde. Num dia cheio — que é o dia bom — a tela é uma parede
de verde, e o olho não tem onde pousar.

> **O estado esperado não tem cor.** Confirmado e pago são neutros. Cor aparece só quando algo
> precisa de você ou deu errado.

| Estado | Tratamento |
|---|---|
| Confirmado, pago, concluído | **sem cor** — `--txt`/`--txt-2`, peso e ícone bastam |
| Precisa de você — aguardando confirmação, ciclo na hora | `--atencao` |
| Problema — faltou, cancelado, ciclo perdido, estoque negativo | `--erro` |
| Dinheiro entrando (uso escasso, só em valor) | `--ok` |

### 3.6 Paleta final — medida

Texto (WCAG 2.1, contra as quatro superfícies reais):

| Token | Valor | `--bg` | `--surface` | `--surface-2` | `--surface-3` |
|---|---|---|---|---|---|
| `--txt` | `#F5F3F1` | 17,65:1 | 16,48:1 | 15,00:1 | — |
| `--txt-2` | `#A8A29C` | 7,73:1 | 7,22:1 | 6,57:1 | — |
| `--txt-3` | `#99938C` | 6,42:1 | 6,00:1 | 5,46:1 | 4,77:1 |

⚠️ `#847E78` e `#8A847E` **passam sobre o fundo e reprovam sobre o card** (4,14:1 e 4,49:1) —
exatamente o tipo de valor que "parece ok". `#99938C` é o primeiro que passa nas quatro.

Semânticos:

| Token | Valor | Contraste sobre `--bg` | Luminância |
|---|---|---|---|
| `--ok` | `#8FD3A8` | 11,21:1 | 0,553 |
| `--atencao` | `#E8B23C` | 10,11:1 | 0,493 |
| `--erro` | `#E0574D` | 5,25:1 | 0,232 |

### 3.7 Daltonismo

| Par | Δ luminância | |
|---|---|---|
| `ok` × `erro` — hoje | 0,054 | ❌ praticamente indistinguíveis |
| `ok` × `erro` — proposto | **0,321** | ✅ 6× melhor |
| `atencao` × `erro` — proposto | **0,261** | ✅ é o par que mais aparece junto |

A regra 3.5 já elimina o par mais perigoso na maioria das telas: confirmado deixa de ser verde,
então verde e vermelho quase nunca dividem a mesma lista.

### 3.8 As cores de vertical

Sete tons de material, medidos, plausíveis tanto numa barbearia quanto num estúdio de unhas,
**deliberadamente não mapeados por estereótipo** — valor inicial sugerido, não sentença, válido
só na página pública do salão.

| Nome | Valor | sobre `--bg` | texto escuro sobre ela |
|---|---|---|---|
| Argila | `#C4A98F` | 8,76:1 | 8,76:1 |
| Latão | `#C9A227` | 8,08:1 | 8,08:1 |
| Aço | `#8AA8CE` | 7,97:1 | 7,97:1 |
| Sálvia | `#7FA98C` | 7,40:1 | 7,40:1 |
| Grafite | `#A39B93` | 7,13:1 | 7,13:1 |
| Ameixa | `#B08AA8` | 6,56:1 | 6,56:1 |
| Terracota | `#C2725A` | 5,44:1 | 5,44:1 |

## II.4 Tipografia

### 4.1 A troca

**Inter sai. Entra `Archivo`** (`next/font/google`, variável). Neutra nos dois sentidos —
grotesco robusto com estrutura de letreiro; numerais inequívocos (`1`, `7` — crítico em
`11:15`/`17:00`); eixos de peso e largura dão hierarquia sem segunda família; cobertura completa
de português. Alternativas se a leitura no aparelho real não convencer: Schibsted Grotesk
(editorial) ou Instrument Sans (contemporânea). **Não voltar para Inter.**

`next/font/google` auto-hospeda no build — sem requisição a `fonts.googleapis.com` em produção;
a CSP não muda (`font-src 'self' data:` já cobre).

### 4.2 Peso

| Uso | Peso |
|---|---|
| Número herói, título de tela | **700** |
| Rótulo, nome em linha de lista, botão | **600** |
| Corpo, descrição | **400** |
| Nada | 800 |

### 4.3 Números

`tabular-nums` em todo dinheiro e hora · `R$` a 60% do tamanho e `--txt-2` · tracking `-0.02em`
só em número grande · alinhamento à direita em coluna de valores.

## II.5 Marca

### 5.1 O conceito

Um **anel aberto** — lê `C` num relance, lê ciclo no segundo olhar. Monocromático, sem badge,
sem gradiente, herda `currentColor`.

### 5.2 A arte

Marca principal:

```svg
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CICLO">
  <path d="M44.93 15.45 A21 21 0 1 0 44.93 48.55"
        stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
</svg>
```

Variante expressiva — só a partir de 64px:

```svg
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CICLO">
  <path d="M44.93 15.45 A21 21 0 1 0 44.93 48.55"
        stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
  <circle cx="53" cy="32" r="4" fill="currentColor"/>
</svg>
```

### 5.3 Verificação — rasterizada antes de virar regra

Renderizada (via `sharp`) a 16, 32 e 256px:

| Tamanho | Sem ponto | Com ponto |
|---|---|---|
| 256px | anel aberto; lê `C` e lê ciclo | ponto pesa igual ao traço, funciona |
| 32px | limpo | ⚠️ o ponto já lê como pontuação: vira `C.` |
| 16px | ainda legível como `C` | ❌ vira sujeira de 1px |

### 5.4 Regras

Monocromática sempre; abaixo de 64px, sem ponto; respiro = metade do diâmetro do anel; nunca
dentro de círculo cheio; favicon repete a geometria com cor literal (não herda `currentColor`);
ícone do PWA a **60%** do canvas (resolve C3); `theme_color`/`background_color` → `#0D0C0C`.

### 5.5 O nome escrito

`CICLO`, caixa alta, peso 600, `letter-spacing: +0.13em`. Marca + nome juntos só em login e
rodapé público; na `Topbar` do app, só a marca.

## II.6 Material e profundidade

| Sai | Entra | Por quê |
|---|---|---|
| `--grad-acc` como assinatura (12 pontos) | Osso sólido | Gradiente diagonal é a tatuagem do gênero |
| Gradiente na barra de fidelidade | Preenchimento sólido | A barra já informa por comprimento |
| Três brilhos radiais | Zero — profundidade vem de superfície e sombra | O glow de herói é a citação mais direta do template gerado |
| Borda colorida para elevar | Luminosidade + `--shadow-elevado` | Regra da Apple: plano acima é mais claro, não mais colorido |
| Raio 16 em tudo | 16 card · 12 campo/botão · 24 sheet · pill em chip | Raio uniforme achata a hierarquia |
| Card colorido inteiro para estado | Faixa de 3px + ponto de 6px | Estado se lê na varredura vertical |
| Separador de borda a borda | Separador alinhado ao texto | Diferencia lista nativa de `<hr>` de site |

## II.7 Movimento

Tokens da Parte I ficam. Regras novas: nada pulsa para sempre (3× e para); a marca não anima na
abertura; transição de lista só na primeira renderização, nunca ao filtrar; um efeito por
interação; `prefers-reduced-motion` continua desligando tudo.

## II.8 Ícones e linguagem

`Sparkles` banido (F1) — onde hoje há brilho, entra o anel da marca ou nada. `Zap` sai. Um nome
só por ícone: `TriangleAlert`. `stroke-width: 1.75` em todo o app; tamanhos 20 (linha/campo) e
24 (navegação); ícone não acompanha todo rótulo; herda a cor do texto exceto em sinal de estado.

## II.9 Composição e as duas vozes

| Tela | Hoje | Passa a ser |
|---|---|---|
| Herói público | brilho radial + centralizado + 2 botões iguais | Alinhado à esquerda; "aberto agora" primeiro; um botão primário |
| Hoje | 3 stat tiles iguais | Faturado hoje como número herói |
| Listas | card colorido por estado | Faixa de 3px + neutro para o esperado |
| Formulários | `text-center` | Alinhado à esquerda; ação fixa no rodapé |
| Config | lista chapada | Agrupada por tema |

| | App (`/admin/*`) | Página pública (`/[slug]`) |
|---|---|---|
| Cor | osso + semânticos; sem cor de marca | acento do salão manda |
| Densidade | alta | baixa, respiro |
| Tom | instrumento | convite |
| Marca | CICLO discreto | marca do salão; CICLO só um selo no rodapé |

Consequência arquitetural: `--acc` deixa de ser injetado globalmente por tenant e passa a valer
**apenas no escopo público** (fase E7 — maior risco do plano).

Régua: **se a tela funciona em escala de cinza, o design está certo.**

## II.10 Plano de execução

| Fase | O que | Arquivos | Risco | Status |
|---|---|---|---|---|
| **E0 · Cor** | Tokens de II.3.3–3.6 | `globals.css` | Baixo | ✅ |
| **E1 · Trava** | `contraste.test.ts` estendido: Δ luminância ≥ 0,15 entre `ok`/`warn`/`risk`/`bad` | `tests/unit/design/contraste.test.ts` | Baixo | ✅ |
| **E2 · Tipografia** | Inter → Archivo; peso máx. 700; varredura dos 30 `font-extrabold` | `layout.tsx`, `globals.css` | Baixo | ✅ |
| **E3 · Gradiente** | `--grad-acc` removido dos 11 pontos; os 3 brilhos radiais apagados; barra de fidelidade sólida | `button.tsx`, `selo.tsx`, `empty-state.tsx`, `stat-tile.tsx`, `fidelidade.tsx`, `secoes.tsx`, `admin/layout.tsx`, `tela-publica.tsx` | Médio | ✅ |
| **E4 · Marca** | `Selo`/`Topbar` viram o anel de II.5.2; favicon (`app/icon.svg`); ícones 192/512 + maskable a 60% regerados | `selo.tsx`, `topbar.tsx`, `app/icon.svg`, `public/icons/*`, `manifest.json` | Baixo | ✅ |
| **E5 · Limpeza** | Apagados os 5 SVGs do `create-next-app` e o `favicon.ico` antigo | `public/` | Nenhum | ✅ |
| **E6 · Ícones** | `Sparkles` banido (virou a marca — `icone-anel.tsx` — na tab bar, badge, `AlertBanner`, 2× `SectionHeader`); `Zap` → `UserX`; `AlertTriangle`/`TriangleAlert` unificados em `TriangleAlert` (4 arquivos) | varredura completa | Médio | ✅ nomes · ⬜ traço 1.75/tamanhos 20-24 não auditados |
| **E7 · Escopo da cor** | `--acc` do tenant só em `/[slug]`; app fica osso | injeção no `<html>`, layout público | ~~Alto~~ | ✅ **já era assim** — achado ao executar: `/[slug]/layout.tsx` já injeta `--acc` só no wrapper inline, nunca em `:root`; o admin nunca herdava cor de tenant. Só os *fallbacks* apontavam para roxo (`layout.tsx`, `page.tsx`, `public-booking.ts`) — trocados para osso |
| **E8 · Verticais** | Migration com os sete tons de 3.8 | `supabase/migrations/00XX_*.sql` | Médio | ⬜ não feito — os 6 swatches do Tailwind seguem em `0002_vertical_packs.sql` |
| **E9 · Estado sem cor** | Confirmado/pago passam a neutro; faixa de 3px | `badge.tsx`, `appointment-row.tsx`, `card.tsx` | Médio | ⬜ não feito de propósito — ver nota abaixo |
| **E10 · Composição** | II.9, tela a tela | telas | Médio | ⬜ não feito |
| **E11 · Verificação** | `typecheck && lint && test:unit && build` + medição no DOM + leitura em escala de cinza | — | — | ✅ ver II.10.1 |

**Achado durante a execução, fora do escopo original (novo item para o backlog):**
`src/app/admin/config/profissionais/formulario.tsx:24` — o seletor de cor do profissional
(`CORES`) usa os **mesmos seis swatches crus do Tailwind** da A2. É feature diferente (cor do
profissional na agenda, não marca/vertical) — por isso não entrou em E0–E6 — mas nasceu do
mesmo copiar-e-colar e deveria trocar por uma paleta pensada, não os defaults.

**Por que E9 ficou de fora desta rodada, apesar de E0 ter corrigido os *valores* dos 5
semânticos:** ao medir o espaço de busca real (II.3.7), descobri que `info` (estado "chegou",
usado em 3 lugares) é uma informação de produto genuína, não coberta pela tabela simplificada de
4 linhas da II.3.5 — colapsar 5 estados em 3 sem decidir o que fazer com "chegou" seria mudar
comportamento sem decisão, não só cor. `--ok`/`--warn`/`--risk`/`--bad` já saíram do E0 com Δ
luminância ≥0,15 entre si (testado); "confirmado deixa de ter cor" continua correto e fica para
quando alguém decidir o destino do estado "chegou".

### II.10.1 Evidência da verificação (2026-08-19)

`pnpm typecheck && pnpm lint` — limpos. `pnpm test:unit` — **369/369** (era 364; os 5 novos são
o teste de Δ luminância). `pnpm build` — produção limpa, `Archivo` baixado e auto-hospedado,
`/icon.svg` reconhecido como rota especial do App Router. Medido no **DOM real** do dev server
(não só no código-fonte): `background-color` do `body` = `rgb(13,12,12)` (`#0D0C0C`), fonte
computada = `Archivo, "Archivo Fallback", system-ui, sans-serif`, botão primário =
`rgb(240,235,227)` de fundo com `rgb(13,12,12)` de texto (osso sólido, sem gradiente), as 5
cores semânticas renderizadas batendo exatamente com os hex calculados, 3 instâncias do anel
renderizadas na vitrine (tab bar, badge "Ciclo", `AlertBanner`), zero overflow horizontal a
375px.

**E0–E6 (nomes) derrubam a maior parte da "cara de IA", tinham risco baixo/médio e foram
verificados com evidência real, não só leitura de código.** E8–E10 mexem em dado e em
comportamento de estado — ficam para rodada própria, com decisão de produto tomada antes.

---

# Critérios de aceite — Parte I (cumpridos) + Parte II (a cumprir)

**Parte I — ✅ todos cumpridos, evidência em I.6:**

1. `cn('text-label','text-acc-2')` preserva os dois. Há teste.
2. Nenhum campo de formulário abaixo de 16 px. Verificado no DOM.
3. Nenhum alvo tocável abaixo de 48 px de área. Verificado no DOM a 375 px.
4. Toda rota fora da raiz de uma aba tem caminho de volta visível.
5. Todo `EmptyState` tem ação com aparência de botão.
6. `error.tsx` na raiz e em `/admin`, em português, com saída.
7. `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build` passam.

**Parte II — resultado em 2026-08-19 (linha de base do dia entre parênteses):**

8. ⬜ `grep -rn "a855f7\|ec4899\|f59e0b\|8b5cf6\|10b981\|f97316" src/ supabase/` → **7**
   (era 10) — restam só `0002_vertical_packs.sql` (E8, migration não feita) e o achado novo em
   `formulario.tsx` (fora do escopo original). Os 3 *fallbacks* de código que apontavam para
   roxo foram corrigidos.
9. ✅ `grep -rn "grad-acc\|radial-gradient" src/` (fora da máscara do `.scroll-x`) → **0** (era 15).
10. ✅ `grep -rn "Sparkles\|Zap" src/` → **0** (era 14).
11. ✅ `grep -rn "font-extrabold" src/` → **0** (era 30).
12. ✅ `ls public/*.svg` (resíduo `create-next-app`) → **0** (era 5).
13. ✅ `contraste.test.ts` passa sem afrouxar piso; reprova se Δ luminância cair abaixo de 0,15
    entre `ok`/`warn`/`risk`/`bad` (não cobre `info`, ver nota do E9 em II.10).
14. ✅ `--txt-3` (`#99938c`) passa nas quatro superfícies — testado.
15. ✅ A marca é legível a 16px em monocromático (verificado por rasterização, II.5.3); o
    `maskable` não corta — regerado a 60% do canvas, contra os 78% de antes.
16. ⬜ Cor de vertical não corresponde a estereótipo de gênero e é editável no onboarding — não
    feito (depende de E8).
17. ⬜ A tela "Hoje" é compreensível em escala de cinza — não verificado (depende de E10).
18. Nenhuma regra de negócio, rota de API ou consulta ao banco alterada (vale para as duas partes).

---

# Emendas ao `03-DESIGN-SYSTEM.md`

Registrar em `DECISOES.md` com a data de execução de cada uma:

**Da Parte I (já registradas e aplicadas):**

1. §2 (tipografia): corpo de 15 px para 16 px — Safari iOS dá zoom em campo abaixo de 16 px.
2. §4 (`Chip`, altura 32): violava o próprio §3.6 (≥ 48 px). Mantido desenho de 40 px com área
   de toque de 48 px por padding transparente.
3. §3.3 (tab bar de 82 px): reduzida para 64 px + safe-area.
4. §1 (tokens): acrescentados `--overlay`, `--ring`, `--surface-press`, `--gutter`,
   `--radius-sheet`, `--ease-ios`, `--dur-*`.
5. §4 (componentes obrigatórios): `AlertBanner`, `MoneyInput`, `PhoneInput` entraram nesta
   rodada, mais `Field`, `PageHeader`, `FilterRow`, `Avatar`, `ActionBar`.

**Da Parte II (a registrar na execução das fases E0–E11):**

6. §1 (cor): base de preto azulado para preto quente; **o acento deixa de ser um matiz e passa
   a ser osso `#F0EBE3`**, substituindo o `--on-acc`/`--grad-acc` da emenda 4 acima; `--txt-3`
   para `#99938C`.
7. §1 (semântica): cinco matizes viram três (`ok`, `atencao`, `erro`), piso de Δ luminância 0,15.
   **Estado esperado não tem cor.**
8. §1 (vertical): tabela de seis cores substituída pelos sete tons de II.3.8; deixa de ser
   função do nicho, passa a ser escolha do dono, válida só na página pública.
9. §2 (tipografia): Inter → Archivo; peso máximo 700; `tabular-nums` obrigatório.
10. Novo — escopo da cor: acento do tenant vale na página pública; dentro do app a cor é do
    CICLO e significa exceção.
11. Novo — marca: monograma em círculo com gradiente substituído pelo anel aberto de II.5.2.
12. Novo — ícones: `Sparkles` e `Zap` banidos; traço 1.75; tamanhos 20/24.
