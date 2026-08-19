# 08 · REDESENHO DE INTERFACE — auditoria cirúrgica e plano de execução

> Data: 2026-08-19 · Escopo: toda a camada visual do CICLO (app do profissional, telas
> públicas, site do salão). Nenhuma regra de negócio muda. Nenhuma rota nova.
>
> Este documento é o **antes**: o que está errado, por que está errado, e o que vai no lugar.
> Ele não substitui `03-DESIGN-SYSTEM.md` — ele **corrige e estende** aquele documento onde a
> execução provou que a especificação estava incompleta (§7 aqui lista as emendas).

---

## 0. Veredito em um parágrafo

A base é boa — melhor do que a média de SaaS brasileiro: tokens em CSS variável, tema escuro
nativo, componentes com `aria` de verdade, `prefers-reduced-motion`, foco visível, sombra pensada
para fundo escuro. **O problema não é gosto, é execução.** Três defeitos estruturais fazem a
interface entregar bem menos do que ela mesma promete: (1) **a escala tipográfica inteira é
descartada em tempo de execução** por uma colisão do `tailwind-merge`, e ninguém percebeu porque
o resultado é "quase certo"; (2) **o design system está pela metade** — não existe `Input`, e por
isso 89 campos de formulário foram escritos à mão, com um tamanho de fonte que **faz o iPhone dar
zoom em cada toque**; (3) **a navegação tem becos sem saída em PWA** — 12 telas sem botão de
voltar, num app instalado que não tem botão de voltar do navegador. Nada disso aparece numa
olhada rápida no desktop. Tudo isso é sentido, todo dia, por quem usa o app em pé, segurando o
celular com uma mão, entre uma cliente e outra.

---

## 1. Método

Auditoria feita em três camadas, todas com evidência:

1. **Leitura integral** dos 20 componentes de `src/components` e das 33 telas de `src/app`.
2. **Medição ao vivo** — dev server em `:3015`, viewport 375×812, estilos computados lidos do
   DOM real (não do código-fonte). Foi aqui que a colisão da tipografia apareceu: o código diz
   11,5 px, o navegador entrega 15 px.
3. **Reprodução isolada** — cada suspeita confirmada fora do app (ex.: `twMerge` rodado no Node
   com os pares reais de classes) antes de virar item deste documento.

Toda linha marcada `▲` abaixo foi verificada, não inferida.

---

## 2. Defeitos estruturais (consertar antes de qualquer pixel)

### D1 · ▲ A escala tipográfica não chega na tela — CRÍTICO

`cn()` é `twMerge(clsx(...))`. O `tailwind-merge` não conhece a escala do CICLO
(`text-corpo`, `text-label`, `text-overline`…). Sem conhecer, ele classifica esses nomes como
**cor de texto** — e então qualquer `text-txt-2`/`text-acc-2` que venha depois **apaga o tamanho
da fonte**.

Reproduzido no Node, com os pares exatos que os componentes usam:

```
"text-label font-semibold | text-acc-2"            => font-semibold text-acc-2      ← 11,5px perdido
"text-overline font-semibold uppercase | text-warn"=> font-semibold uppercase text-warn ← 11px perdido
"text-secundario font-semibold | text-txt-2"       => font-semibold text-txt-2      ← 13px perdido
"text-corpo font-semibold | text-txt"              => font-semibold text-txt        ← 15px perdido
"text-titulo font-extrabold | text-txt"            => font-extrabold text-txt       ← 25px perdido
```

Confirmado no DOM: o `Chip` da vitrine, que pede `text-label` (11,5 px), **renderiza a 15 px**.

Atingidos: `chip`, `section-header`, `tab-bar`, `badge`, `button`, `appointment-row`,
`empty-state`, `sheet`, `toast`, `agenda.tsx`, `lista.tsx` (clientes), `recuperar.tsx` — ou seja,
a barra de navegação, todo cabeçalho de seção e todo filtro do app. O sintoma visível é
"tudo parece quase do mesmo tamanho": a hierarquia que o design system desenhou existe no CSS e
morre no `cn()`.

**Correção:** `extendTailwindMerge` declarando os sete nomes da escala no grupo `font-size`,
mais um teste unitário que reprova o build se um nome novo entrar na escala sem entrar na
configuração.

### D2 · ▲ Todo campo de formulário faz o iPhone dar zoom

Regra do Safari iOS: campo com fonte **menor que 16 px** dispara zoom automático no foco. O
`--text-corpo` é 15 px e é o tamanho usado em **todos** os 89 `input`/`select`/`textarea` do
projeto. Efeito real: a profissional toca em "Nome da cliente", a tela pula, ela perde a
referência, digita, e precisa dar dois toques para voltar. Em toda tela de formulário do app,
inclusive no agendamento público — onde quem sofre é a cliente final, no funil de conversão.

**Correção:** `--text-corpo` sobe para 16 px (é também o tamanho certo de corpo para leitura em
celular — 15 px é subdimensionado para o contexto "de pé, com uma mão") **mais** uma regra de
base `input, select, textarea { font-size: max(16px, 1em) }`, que blinda os 89 campos existentes
de uma vez, inclusive os que ninguém migrar.

### D3 · ▲ Não existe componente de campo — 89 campos copiados à mão

`03-DESIGN-SYSTEM §4` exige `MoneyInput` e `PhoneInput`. Nenhum dos dois existe. Nem um `Input`
genérico. A string `border-line-2 bg-surface-2` aparece **99 vezes** no código. Consequências
medidas: não há estado de erro padrão em campo nenhum, não há `aria-invalid`, não há mensagem de
ajuda, não há máscara de telefone (a cliente digita `(11) 9…` e o formato varia por tela), e
`autoComplete` está ausente no agendamento público — o celular não oferece preencher nome e
telefone salvos, no exato formulário onde a conversão importa.

**Correção:** `Field` + `Input` + `Textarea` + `Select` + `MoneyInput` + `PhoneInput`, todos com
48 px de altura, 16 px de fonte, rótulo real, texto de ajuda, estado de erro com `aria-invalid` e
`aria-describedby`.

### D4 · ▲ PWA sem saída: 12 telas sem botão de voltar

`manifest.json` declara `display: "standalone"` — instalado, o app **não tem** a barra do
navegador, logo não tem botão de voltar. Só três telas têm `ArrowLeft`
(`clientes/nova`, `clientes/[id]`, `campanhas/nova`). Ficam sem saída: as 9 telas de
`/admin/config/*`, `/admin/comanda/*`, `/admin/campanhas` e `/admin/agenda/novo`. Quem entra em
"Horário de funcionamento" no app instalado só sai por gesto do sistema (que no Android volta,
no iOS não existe de forma confiável em standalone).

**Correção:** a `Topbar` deixa de ser um enfeite de marca e vira barra contextual — nas rotas
raiz das abas mostra a marca; em qualquer sub-rota mostra **voltar + título da tela**. Uma vez,
para todas as telas, sem tocar em 12 arquivos.

### D5 · ▲ O botão do estado vazio não parece um botão

`EmptyState` exige `acao` — mas quatro telas passam um `<Link>` **sem classe nenhuma**:

```
hoje.tsx:57       acao={<Link href="/admin/agenda/novo">Novo agendamento</Link>}
agenda.tsx:123    acao={<Link href="/admin/agenda/novo">Novo agendamento</Link>}
lista.tsx:134     acao={<Link href="/admin/clientes/nova">Cadastrar cliente</Link>}
campanhas:95      acao={<Link href="/admin/campanhas/nova">Criar a primeira</Link>}
```

Renderiza como texto corrido, cor do corpo, sem fundo, sem altura de toque. São exatamente os
estados vazios das **três telas mais usadas** — e o estado vazio é a primeira coisa que uma conta
nova vê. A promessa do design system ("nunca só 'nenhum resultado'") existe no componente e
falha no uso.

**Correção:** `EmptyState` passa a estilizar o slot de ação (`[&_a]`/`[&_button]` com o visual do
botão primário), de modo que o erro deixe de ser possível mesmo quando alguém passar um link cru.

### D6 · ▲ Alvos de toque abaixo do mínimo que o próprio documento exige

`§3.6` manda ≥ 48×48 px. Medido no DOM: `Chip` tem **32 px** de altura — e o `Chip` é o filtro de
profissional na Agenda, o filtro de segmento em Clientes, **e cada horário disponível no
agendamento público**. A cliente escolhe o horário dela num alvo de 32 px. Os filtros feitos à
mão em `clientes/lista.tsx` e `recuperar.tsx` (que ignoram o `Chip` e reimplementam o visual, com
outro raio, outro tamanho e outra cor de borda) ficam em ~37 px.

**Correção:** pílula com 40 px de altura visual e **área de toque de 48 px** via padding vertical
transparente — mantém o desenho leve sem trair o dedo. E um único `FilterRow` acaba com as três
implementações paralelas.

### D7 · ▲ A barra do topo entra por baixo do relevo do iPhone

`layout.tsx` declara `viewportFit: "cover"` e `statusBarStyle: "black-translucent"`; a `Topbar` é
`sticky top-0` **sem** `env(safe-area-inset-top)`. Em iPhone instalado, o conteúdo da barra fica
sob o relógio/ilha dinâmica. O `body` tem `padding-bottom: env(safe-area-inset-bottom)` que,
somado ao `pb` da tab bar, ainda empurra o conteúdo — a folga inferior está sendo paga duas vezes.

### D8 · ▲ No desktop, a navegação se descola do conteúdo

O conteúdo é `max-w-[560px] mx-auto`; a `TabBar` é `fixed inset-x-0` — **largura total da tela**.
Em qualquer monitor, os quatro ícones se espalham por 1920 px enquanto o app vive numa coluna de
560 px no meio. Não é o alvo principal do produto, mas é a tela em que o Eduardo demonstra o
CICLO para o cliente.

### D9 · Estados de erro e carregamento incompletos

33 telas, **3** `loading.tsx`, **0** `error.tsx`. Qualquer falha de servidor cai na página de
erro crua do Next (em inglês, fundo branco, sem saída) — dentro de um app que é preto, em
português, e mobile-first. O design system promete esqueleto em toda lista e card (§4).

### D10 · Componentes obrigatórios que nunca foram feitos

`§4` lista como obrigatórios `AlertBanner`, `MoneyInput`, `PhoneInput` — nenhum existe. O
"AlertBanner" foi improvisado com `Card` + borda colorida em pelo menos três telas
(`clientes/page.tsx`, `recuperar/page.tsx`, `recuperar.tsx`), cada uma com um tom diferente.

---

## 3. Defeitos de composição (o que separa "bom" de "Apple")

| # | Onde | O que está acontecendo | O que vai no lugar |
|---|---|---|---|
| C1 | Todo o app | O gradiente do acento aparece em 9 lugares, hardcoded como `linear-gradient(135deg,var(--acc),var(--acc-2))`, inclusive em barra de progresso e monograma | Vira token `--grad-acc`. Gradiente é **assinatura**, não textura: fica no FAB, no botão primário e na marca. Barra de progresso passa a ser acento sólido |
| C2 | `hoje` | "Faturado hoje" é um `StatTile` de 21 px, do mesmo tamanho de tudo — a única métrica de dinheiro da tela principal não tem destaque | Vira herói: número de 34 px (`--text-numero`, hoje **não usado em lugar nenhum**), com comparação com ontem |
| C3 | `hoje` | Cabeçalho mostra a data e o nome do salão. O nome do salão é constante — informação de peso zero ocupando o lugar mais nobre | Saudação por período + data + o que importa agora ("faltam 3 atendimentos") |
| C4 | Topbar | Ocupa 52 px em toda tela para escrever "CICLO" — a pessoa sabe em que app está | Vira barra contextual (D4): título da tela ou marca, e a engrenagem só onde faz sentido |
| C5 | Tab bar | 82 px + safe-area = ~116 px num iPhone: 14 % da tela permanentemente gastos em navegação | 64 px + safe-area, com indicador ativo (ponto + peso), FAB elevado sobre a barra |
| C6 | Listas | `AppointmentRow`, linha de cliente e item de recuperar têm três anatomias diferentes para a mesma ideia "linha tocável com valor à direita" | Anatomia única: faixa de estado, conteúdo, valor tabular, chevron quando navega |
| C7 | Clientes | Lista de nomes sem âncora visual — 200 linhas de texto igual | Avatar de iniciais com cor derivada do nome (determinística), o padrão que todo app de contatos usa |
| C8 | Recuperar | O botão "Avisar N selecionadas" nasce **acima** da lista e some do campo de visão ao rolar | Barra de ação flutuante acima da tab bar, aparece ao selecionar (`§3.2`: ação primária no terço inferior) |
| C9 | Movimento | Só o `Sheet`, o toast e a `TelaPublica` animam. Toque em card/linha não tem retorno nenhum | Tokens de duração/curva (`--ease-ios`), `active:scale` em tudo que é tocável, transição de entrada nas listas |
| C10 | Skeleton | `animate-pulse` (opacidade piscando) — o padrão datado | Shimmer com gradiente varrendo, respeitando `prefers-reduced-motion` |
| C11 | Site público `/[slug]` | O rosto do negócio abre com `<h1>` de 25 px em cima de fundo preto liso, igual a qualquer tela interna | Hero com brilho do acento do salão, nome grande, prova social (horário de hoje: aberto/fechado) e CTA fixo |
| C12 | Agendar público | Fluxo de 4 escolhas numa página rolante, sem indicação de progresso e sem resumo fixo | Passos numerados com resumo fixo no rodapé (serviço · dia · hora · valor) |
| C13 | Config | 9 itens numa lista chapada, do serviço ao cofre de LGPD | Agrupado em "Seu negócio", "Atendimento", "Crescimento", "Privacidade" |
| C14 | Formulários | Botão de salvar rola junto com o conteúdo | Rodapé de ação fixo (`sticky bottom`) nos formulários longos |

---

## 4. O sistema visual depois da cirurgia

### 4.1 Cor

As superfícies e os semânticos estão certos e ficam. O que muda:

```css
--on-acc:    #0a0a0f;                                   /* texto sobre o acento — hoje hardcoded 9x */
--grad-acc:  linear-gradient(135deg, var(--acc), var(--acc-2));
--surface-press: rgba(255,255,255,.05);                 /* retorno de toque, sem inventar cor */
--overlay:   rgba(5,5,10,.72);                          /* fundo de sheet/dialog */
--ring:      var(--acc-2);
```

`--txt-3` fica em `#7f7f98` (a correção do quinto defeito da especificação, medida em 5,07:1).
O teste `tests/unit/design/contraste.test.ts` continua sendo a autoridade: **nenhuma cor entra
sem passar por ele.**

### 4.2 Tipografia

Escala corrigida — com entrelinha e tracking declarados, que a original não tinha:

| Token | Antes | Depois | Entrelinha | Tracking | Uso |
|---|---|---|---|---|---|
| `--text-numero` | 34 | **34** | 1.05 | −0.02em | dinheiro herói (passa a ser usado) |
| `--text-titulo` | 25 | **26** | 1.15 | −0.02em | título de tela |
| `--text-stat` | 21 | **21** | 1.2 | −0.015em | valor de stat |
| `--text-corpo` | 15 | **16** | 1.45 | 0 | corpo e **todo campo** (mata o zoom do iOS) |
| `--text-secundario` | 13 | **13.5** | 1.4 | 0 | apoio |
| `--text-label` | 11.5 | **12** | 1.35 | 0 | rótulo, tab bar |
| `--text-overline` | 11 | **11** | 1.2 | +0.13em | cabeçalho de seção |

Números monetários seguem `tabular-nums`. Títulos ganham `text-wrap: balance`, parágrafos
`text-wrap: pretty` — nome de salão com duas palavras deixa de quebrar com uma órfã.

### 4.3 Espaço, raio, elevação, movimento

```css
--gutter: 18px;          /* tokenizado: hoje é px-[18px] literal em 6 arquivos */
--radius-sheet: 24px;    /* sheet com raio de sheet, não de card */
--shadow-fab: 0 6px 20px color-mix(in srgb, var(--acc) 35%, transparent);
--ease-ios: cubic-bezier(.32,.72,0,1);
--dur-1: 120ms;  --dur-2: 220ms;  --dur-3: 320ms;
```

### 4.4 Base

- `input, select, textarea { font-size: max(16px, 1em) }` — blindagem do D2.
- `-webkit-tap-highlight-color: transparent` — some o retângulo cinza do Android no toque.
- `overscroll-behavior-y: contain` — o app instalado para de "esticar" como página web.
- `env(safe-area-inset-top)` na barra superior, e a folga inferior paga **uma** vez só.
- `.scroll-x` — utilitário de rolagem horizontal com `scroll-snap`, sem barra visível e com
  máscara de esmaecimento nas bordas (hoje as fileiras de filtro cortam no seco e não há sinal
  nenhum de que há mais conteúdo à direita).

---

## 5. Plano de execução

| Fase | Conteúdo | Risco |
|---|---|---|
| **F0 · Fundação** | `cn()` corrigido + teste de regressão; tokens de 4.1–4.4 em `globals.css`; base CSS | Baixo — nenhum arquivo de tela muda |
| **F1 · Componentes novos** | `Field`, `Input`, `Textarea`, `Select`, `MoneyInput`, `PhoneInput`, `PageHeader`, `FilterRow`, `IconButton`, `Avatar`, `AlertBanner`, `ActionBar` | Baixo — adição |
| **F2 · Componentes existentes** | `Button` (tamanhos, `ghost`, ícone), `Chip` (48 px de toque), `Card` (pressionável), `EmptyState` (D5), `Sheet` (raio/curva/cabeçalho fixo), `Toast` (ícone), `Skeleton` (shimmer), `StatTile` (variante herói), `AppointmentRow` | Médio — mexe no que já está na tela |
| **F3 · Navegação** | `Topbar` contextual com voltar (D4/D7), `TabBar` 64 px com indicador e centrada no desktop (D5/D8) | Médio |
| **F4 · Telas** | `hoje`, `agenda`, `clientes`, `recuperar`, `config`, `entrar`/`cadastro`/`onboarding`, `/[slug]`, `/[slug]/agendar` | Médio |
| **F5 · Estados** | `error.tsx` (raiz e `/admin`), `loading.tsx` faltantes com esqueleto fiel ao layout real | Baixo |
| **F6 · Verificação** | `pnpm typecheck && lint && test:unit && build`, medição no DOM a 375 px, conferência de contraste | — |

**Ordem é obrigatória.** F0 antes de tudo: enquanto o `cn()` estiver quebrado, qualquer ajuste
fino de tipografia é chute.

---

## 6. Critérios de aceite

1. `cn('text-label','text-acc-2')` preserva os dois. Há teste.
2. Nenhum campo de formulário abaixo de 16 px. Verificado no DOM.
3. Nenhum alvo tocável abaixo de 48 px de área. Verificado no DOM a 375 px.
4. Toda rota fora da raiz de uma aba tem caminho de volta visível.
5. Todo `EmptyState` tem ação com aparência de botão.
6. `error.tsx` na raiz e em `/admin`, em português, com saída.
7. `tests/unit/design/contraste.test.ts` passa sem afrouxar nenhum limite.
8. `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build` passam.
9. Nenhuma regra de negócio, rota de API ou consulta ao banco alterada.

---

## 7. Emendas ao `03-DESIGN-SYSTEM.md`

Registradas aqui e replicadas em `DECISOES.md`:

1. **§2 (tipografia):** corpo passa de 15 px para 16 px. Motivo: abaixo de 16 px o Safari iOS dá
   zoom em campo de formulário. O documento nunca considerou isso e a regra "alvo ≥ 48 px" perde
   o sentido se a tela pula no toque.
2. **§4 (`Chip`, altura 32):** 32 px viola o próprio `§3.6` (≥ 48 px). Mantido o desenho de 40 px
   com área de toque de 48 px por padding transparente. Documento contradizia a si mesmo.
3. **§3.3 (tab bar de 82 px):** reduzida para 64 px + safe-area. 82 px + relevo consumia 14 % da
   altura útil de um iPhone padrão sem contrapartida.
4. **§1 (tokens):** acrescentados `--on-acc`, `--grad-acc`, `--overlay`, `--ring`,
   `--surface-press`, `--gutter`, `--radius-sheet`, `--ease-ios`, `--dur-*`. O documento
   descrevia cor e raio, mas não elevação, movimento nem "texto sobre o acento" — daí o
   `#0a0a0f` hardcoded em nove lugares.
5. **§4 (componentes obrigatórios):** `AlertBanner`, `MoneyInput` e `PhoneInput` eram obrigatórios
   e nunca existiram; entram nesta rodada. Acrescentados à lista: `Field`, `PageHeader`,
   `FilterRow`, `Avatar`, `ActionBar` — todos já existiam de fato, copiados à mão nas telas.
