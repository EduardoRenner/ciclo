# 09 · IDENTIDADE VISUAL — autópsia e plano de execução

> Data: 2026-08-19 · **Documento de execução.** Tem autoridade para trocar cor, tipografia,
> marca e material, e prevalece sobre `03-DESIGN-SYSTEM.md §1–§2` onde conflitar.
> Substitui a primeira versão deste documento, que listava sintomas sem fazer o diagnóstico.
>
> `08-REDESIGN-UI.md` consertou a **execução** — tamanho de fonte que não chegava na tela, alvo
> de toque, campo de formulário, navegação em PWA. Estava certo, está no ar, e nada aqui o
> contradiz. Este documento trata do problema que aquele deixou intocado de propósito:
> **o produto está bem construído e não tem identidade nenhuma.**
>
> Restrição que governa todas as decisões: o mesmo app é de uma **barbearia** e de uma
> **manicure**. Nada pode ser masculino nem feminino. Neutro aqui não é ausência de opinião —
> é a opinião mais difícil de sustentar, e a maior parte deste documento existe para sustentá-la.

---

## Sumário executivo

Três frases:

1. A interface parece gerada por IA porque **é literalmente montada de valores de fábrica** —
   29 marcas catalogadas na §1, cada uma com arquivo e linha. Nenhuma é questão de gosto.
2. A correção não é "escolher cores mais bonitas": é **decidir**, uma vez, o que a cor significa
   neste produto — e a conclusão (§3) é que **o acento não deve ser um matiz, e sim luz**, com
   cor reservada exclusivamente para exceção.
3. Nada disso é estrutural. As fases E0–E5 do plano (§11) derrubam a maior parte da "cara de IA"
   sem tocar em uma regra de negócio, e são reversíveis.

---

## 1. A autópsia — 29 marcas de interface gerada

Cada linha foi verificada no repositório de hoje. Nenhuma é impressão subjetiva.

### A · Cor (8)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| A1 | `--acc: #a855f7` | `globals.css` | É o `purple-500` do Tailwind sem uma casa alterada. Roxo é o acento padrão de praticamente todo app gerado desde 2023 |
| A2 | As seis cores de vertical são swatches crus | `0002_vertical_packs.sql:35,83,131,172,206,243` | `#a855f7` purple-500 · `#ec4899` pink-500 · `#f59e0b` amber-500 · `#8b5cf6` violet-500 · `#10b981` emerald-500 · `#f97316` orange-500. **Seis nichos, zero decisões** |
| A3 | Cílios `#a855f7` e sobrancelhas `#8b5cf6` são quase a mesma cor | idem | A prova de que a lista foi copiada e não olhada: ninguém que visse as duas lado a lado manteria as duas |
| A4 | Cor atribuída por estereótipo: rosa=unhas, âmbar=barbearia | idem | Além de datado, quebra a exigência central do produto (neutro entre barbearia e manicure) |
| A5 | `--bg: #0a0a0f` — preto **azulado** | `globals.css` | Preto-azul é o preto de software. Somado a roxo saturado, é o dark mode de SaaS genérico |
| A6 | Roxo + app + números grandes, no Brasil | — | Lê **Nubank**, não beleza. O produto pede emprestada uma identidade que já tem dono no país |
| A7 | `--ok #5FA97F` e `--bad #E2685F` têm luminância quase idêntica (Δ 0,054) | `globals.css` | Em daltonismo verde-vermelho — o mais comum, ~8% dos homens, público direto de barbearia — os dois estados viram a mesma cor |
| A8 | A mesma cor é marca, ação primária e estado | todo o app | Se roxo é "o produto", "clique aqui" e "confirmado" ao mesmo tempo, a cor deixou de informar qualquer coisa |

### B · Gradiente e efeito (4)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| B1 | `--grad-acc: linear-gradient(135deg, …)` como **assinatura da marca**, em 12 pontos | `globals.css` + 11 usos | 135° é o ângulo padrão; diagonal roxo→lilás é o clichê visual do gênero inteiro |
| B2 | Gradiente na barra de progresso de fidelidade | `clientes/[id]/fidelidade.tsx:158` | Gradiente em elemento de dado é decoração pura: a barra já comunica por comprimento |
| B3 | **Três** brilhos radiais no topo da tela | `[slug]/secoes.tsx:74` · `admin/layout.tsx:28` · `shell/tela-publica.tsx:15` | O "glow" atrás do herói é a assinatura do template de landing gerada. Aparecer três vezes no mesmo produto é o mesmo efeito aplicado sem critério |
| B4 | CTA público preenchido com gradiente | `[slug]/secoes.tsx` | O botão mais importante do funil é também o mais genérico da tela |

### C · Marca (4)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| C1 | O logo é a letra **C** dentro de um círculo com gradiente | `shell/selo.tsx` | É exatamente o placeholder que toda ferramenta de geração produz quando não existe marca |
| C2 | O ícone do PWA é a mesma coisa rasterizada | `public/icons/*.png` | O ícone é o que fica na tela inicial do celular do cliente — é o ativo de marca mais visto do produto |
| C3 | A arte ocupa ~78% do canvas no `maskable` | idem | A zona segura do `maskable` é 80% em círculo: o sistema **corta** a marca em parte dos Androids |
| C4 | Sem favicon próprio; `theme_color` no preto antigo | `manifest.json` | Aba do navegador e barra do sistema entregam a cor errada |

### D · Tipografia (3)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| D1 | Fonte: **Inter** | `layout.tsx` | Não é errada, é anônima — é a fonte de "nenhuma decisão foi tomada" |
| D2 | `font-extrabold` (peso 800) em **30** lugares | varredura em `src/` | Quando tudo é extrabold, nada tem ênfase. Peso 800 em fonte de interface é grito |
| D3 | Hierarquia feita por peso, não por tamanho e espaço | idem | É o atalho: engrossar é mais fácil que compor. O resultado é a tela "quase toda do mesmo tamanho" |

### E · Composição (4)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| E1 | Herói centralizado, pilha simétrica: brilho → título → tagline → badge → 2 botões | `[slug]/secoes.tsx:70-105` | É a anatomia exata da landing gerada. Simetria total é o padrão de quem não decidiu o que é mais importante |
| E2 | `text-center` em 12 telas | varredura | Texto centralizado é para bloco curto. Em tela de trabalho vira leitura difícil (a margem esquerda "dança") |
| E3 | Dois botões lado a lado com peso quase igual no herói | `[slug]/secoes.tsx` | Duas ações primárias = nenhuma ação primária |
| E4 | Badge de estado flutuando solto entre título e botões | idem | O "pill" decorativo abaixo do título é gramática de template |

### F · Ícone e linguagem (4)

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| F1 | **`Sparkles` representa o conceito central do produto** | `tab-bar.tsx:11` · `badge.tsx:30` · `alert-banner.tsx:19` · `hoje/central-de-acoes.tsx:21` · `clientes/[id]/ficha.tsx:269` · `recuperar.tsx:132` | O brilho ✨ é **o** símbolo universal de "isto foi feito por IA". O Motor de Ciclo — a coisa que justifica o produto existir — está simbolizado pelo emblema de conteúdo gerado |
| F2 | `Zap` para urgência | `appointment-row.tsx:90` | Raio é o segundo clichê da mesma família |
| F3 | `AlertTriangle` **e** `TriangleAlert` no mesmo projeto | varredura | É o mesmo ícone com dois nomes de versões diferentes da lucide — sintoma de código colado de fontes distintas |
| F4 | Ícone ao lado de quase todo rótulo | várias | Quando tudo tem ícone, o ícone deixa de guiar o olho |

### G · Resíduo (2)

| # | O que está lá | Onde |
|---|---|---|
| G1 | `next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` | `public/` — sobras literais do `create-next-app` |
| G2 | `background_color`/`theme_color` ainda no `#0a0a0f` antigo | `manifest.json` |

### O que **não** é marca de IA — e deve ser preservado

Auditoria honesta precisa separar. Estas escolhas foram **pensadas** e não entram no plano:

- **Shimmer no `Skeleton`** (`skeleton.tsx`) com o comentário certo: varrer lê como "está vindo",
  piscar lê como "algo errado". Correto.
- **`backdrop-blur` apenas em `Topbar`, `TabBar`, `ActionBar` e overlay do `Sheet`** — os quatro
  lugares onde existe conteúdo rolando por baixo. É uso justificado, não decoração.
- **`--radius-pill` restrito a chip, badge, avatar e alça do sheet.** Não é "tudo redondo".
- **Máscara de esmaecimento no `.scroll-x`** — resolve um problema real de affordance.
- **Todos os tokens de `08`** (escala tipográfica, `--gutter`, `--tabbar-h`, `--ease-ios`).

---

## 2. Por que isso acontece

Vale nomear a causa, porque ela vai voltar em todo projeto novo.

Código gerado otimiza por **plausibilidade**, e plausibilidade é a mediana do que existe. A
mediana da interface de SaaS é: fundo quase preto azulado, acento roxo, gradiente diagonal,
Inter, ícone de brilho, herói centralizado. Cada decisão que **não** foi tomada explicitamente
cai nessa mediana — e o resultado é internamente coerente, tecnicamente correto e
completamente anônimo. É exatamente o estado do CICLO hoje.

Daí a única correção possível: **não é ter mais gosto, é gastar decisões.** Cada seção abaixo
gasta uma, e diz o que foi descartado junto.

---

## 3. Cor — a decisão

### 3.1 O espaço de busca

O produto já compromete matizes com significado. Isso restringe o acento muito mais do que
parece, e é por eliminação que se chega à resposta:

| Família | Situação | Veredito |
|---|---|---|
| Verde | ocupado por "confirmado/pago" | ❌ indisponível |
| Âmbar / amarelo | ocupado por "aguardando" | ❌ indisponível |
| Laranja | ocupado por "risco" | ❌ indisponível |
| Vermelho | ocupado por "faltou/cancelado" | ❌ indisponível |
| Azul | ocupado por "informativo"; e é o acento genérico de SaaS | ❌ |
| Roxo / violeta / índigo | a marca de IA (A1) e o território do Nubank (A6) | ❌ |
| Rosa / magenta | estereótipo de gênero; e é onde já estão Booksy e Avec | ❌ |
| Turquesa / teal | vizinho do verde semântico; confunde com "ok" | ❌ |
| Latão / dourado | **vizinho do âmbar de aviso** | ❌ — ver 3.2 |
| Neutro quente (osso, areia) | não colide com nada; não tem gênero | ✅ |

### 3.2 Correção de rota: por que latão foi descartado

A primeira versão deste documento propunha latão `#C9A227`. Está errado, e o próprio texto
denunciava: exigia a regra "latão e `--warn` nunca podem aparecer na mesma linha como coisas
diferentes". **Quando a paleta precisa de uma regra para não brigar consigo mesma, a paleta está
errada.** Latão fica reservado para a marca impressa, se um dia houver; não entra na interface.

### 3.3 A conclusão: o acento não é um matiz, é luz

> **`--acc` passa a ser osso — um branco quente. A interface do CICLO não tem cor de marca.**

```css
--acc:      #F0EBE3;  /* osso — ação primária, marca, item ativo */
--acc-2:    #FFFCF7;  /* topo do realce (hover, foco) */
--acc-soft: rgba(240, 235, 227, 0.10);
--on-acc:   #0D0C0C;  /* texto sobre o osso preenchido */
```

Medido: **16,46:1** sobre o fundo, nos dois sentidos (como cor de texto e como preenchimento com
texto escuro). O roxo atual entrega 4,94:1 — passa raspando e obriga a compensar com peso, que é
parte da razão dos 30 `font-extrabold`.

Por que esta é a decisão certa, e não uma fuga:

- **É a única saída do espaço de busca** (3.1) que não colide com significado.
- **Resolve barbearia × manicure de forma definitiva.** Branco quente não tem gênero. Nenhuma
  outra opção pode dizer o mesmo com honestidade.
- **É o gesto do produto que ele quer ser.** Botão primário claro sobre fundo escuro é a
  gramática de ferramenta séria — não é ausência de design, é subtração.
- **Devolve função à cor.** Com o acento fora do espectro, qualquer cor que apareça na tela está
  necessariamente dizendo alguma coisa.
- **O ícone na tela inicial vira o quieto.** Numa grade de ícones saturados e gradientes, um
  campo quase preto com um anel osso é o que se acha primeiro. Ser o discreto é distinção.

E a cor do salão continua existindo — na página pública dele (§10), que é onde ela é, de fato,
a marca dele.

### 3.4 A base: preto quente, não preto azul

```css
--bg:        #0D0C0C;  /* fundo */
--surface:   #161514;  /* card, linha de lista */
--surface-2: #201E1D;  /* elevado: sheet, campo */
--surface-3: #2B2926;  /* pressionado, borda forte */
```

`#0a0a0f` é azulado. Um preto levemente quente lê como objeto — couro, madeira, mármore — que é
o ambiente físico de um salão, e sai do clichê sem custar nada. É a troca mais barata e mais
eficaz do documento.

### 3.5 A regra que muda tudo: cor é exceção, não confirmação

Esta é a decisão de maior impacto sobre como o app se parece no dia a dia.

Hoje, todo agendamento confirmado é verde. Num dia cheio — que é o dia bom — a tela é uma parede
de verde, e o olho não tem onde pousar. **A informação está no que foge do padrão, não no que
segue.**

> **O estado esperado não tem cor.** Confirmado e pago são neutros. Cor aparece só quando algo
> precisa de você ou deu errado.

Isso reduz cinco matizes semânticos para dois, e o efeito é imediato: um dia com doze
atendimentos tranquilos fica calmo e uniforme, e as duas linhas que precisam de atenção são as
únicas coisas coloridas da tela.

| Estado | Tratamento |
|---|---|
| Confirmado, pago, concluído | **sem cor** — `--txt` / `--txt-2`, peso e ícone bastam |
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

⚠️ Registro para não repetir: `#847E78` e `#8A847E` **passam sobre o fundo e reprovam sobre o
card** (4,14:1 e 4,49:1). É o tipo de valor que "parece ok" — e a especificação deste projeto já
foi mordida exatamente assim uma vez. `#99938C` é o primeiro que passa nas quatro.

Semânticos:

| Token | Valor | Contraste sobre `--bg` | Luminância |
|---|---|---|---|
| `--ok` | `#8FD3A8` | 11,21:1 | 0,553 |
| `--atencao` | `#E8B23C` | 10,11:1 | 0,493 |
| `--erro` | `#E0574D` | 5,25:1 | 0,232 |

### 3.7 Daltonismo — o motivo desses valores exatos

Verde-vermelho é o daltonismo mais comum (~8% dos homens — e barbearia é público
majoritariamente masculino, então isto não é hipótese remota). Nesse caso o matiz some e **só a
luminância separa**.

| Par | Δ luminância | |
|---|---|---|
| `ok` × `erro` — **hoje** | 0,054 | ❌ praticamente indistinguíveis |
| `ok` × `erro` — proposto | **0,321** | ✅ 6× melhor |
| `atencao` × `erro` — proposto | **0,261** | ✅ é o par que mais aparece junto |

Somado a isso, a regra de 3.5 já elimina o par mais perigoso da maioria das telas: **confirmado
deixa de ser verde**, então verde e vermelho quase nunca dividem a mesma lista. E o `Badge`
continua obrigado a carregar ícone + texto, nunca só cor.

### 3.8 As cores de vertical

As seis do Tailwind saem. Entram sete tons de material, todos medidos, todos plausíveis tanto
numa barbearia quanto num estúdio de unhas, **deliberadamente não mapeados por estereótipo** —
é valor inicial sugerido, não sentença, e vale só na página pública do salão.

| Nome | Valor | sobre `--bg` | texto escuro sobre ela |
|---|---|---|---|
| Argila | `#C4A98F` | 8,76:1 | 8,76:1 |
| Latão | `#C9A227` | 8,08:1 | 8,08:1 |
| Aço | `#8AA8CE` | 7,97:1 | 7,97:1 |
| Sálvia | `#7FA98C` | 7,40:1 | 7,40:1 |
| Grafite | `#A39B93` | 7,13:1 | 7,13:1 |
| Ameixa | `#B08AA8` | 6,56:1 | 6,56:1 |
| Terracota | `#C2725A` | 5,44:1 | 5,44:1 |

O pior desta lista (5,44:1) ainda supera o roxo de hoje (4,94:1). No onboarding, mostrar as sete
com o nome escrito e deixar explícito que é **a cor da página pública do salão** — nunca
perguntar o nicho para decidir cor.

---

## 4. Tipografia

### 4.1 A troca

**Inter sai. Entra `Archivo`** (`next/font/google`, variável).

- **Neutra nos dois sentidos:** grotesco robusto, com estrutura de letreiro. Cabe numa fachada de
  barbearia sem virar masculino, e é limpa o bastante para um estúdio de unhas.
- **Numerais de verdade** — que é o que este produto mais mostra. Desenho inequívoco de `1` e
  `7`, crítico em horário (`11:15`, `17:00`).
- **Eixos de peso e largura**, o que dá uma segunda dimensão de hierarquia **sem uma segunda
  família**: o valor de "Faturado hoje" pode ser levemente mais estreito e mais pesado. Destaque
  sem custo de rede.
- Cobertura completa de português.

Alternativas aceitáveis se a leitura no aparelho real não convencer: **Schibsted Grotesk** (mais
editorial) ou **Instrument Sans** (mais contemporânea). **Não voltar para Inter** — o problema
dela aqui não é qualidade, é ausência de escolha.

Nota técnica: `next/font/google` baixa e **auto-hospeda no build**. Não há requisição a
`fonts.googleapis.com` em produção e **a CSP não muda** (`font-src 'self' data:` já cobre).

### 4.2 Peso — o fim dos 30 extrabold

| Uso | Peso |
|---|---|
| Número herói, título de tela | **700** |
| Rótulo, nome em linha de lista, botão | **600** |
| Corpo, descrição | **400** |
| Nada | 800 |

Ênfase passa a vir de **tamanho, espaço e cor de texto** — que é o que `08 §4.2` já preparou e
ninguém usou, porque engrossar era mais rápido.

### 4.3 Números

| Regra | Detalhe |
|---|---|
| `tabular-nums` em **todo** dinheiro e hora | sem isso a coluna dança a cada atualização |
| `R$` menor e mais claro que o valor | 60% do tamanho, `--txt-2`. O valor é o dado; a moeda é rótulo |
| Tracking `-0.02em` só em número grande | zero no corpo |
| Alinhamento à direita em coluna de valores | é o que permite comparar de relance |

---

## 5. Marca

### 5.1 O conceito

O produto se chama CICLO e o que ele faz é **trazer a cliente de volta**. A marca é isso:
**um anel aberto** — lê `C` num relance, lê ciclo no segundo olhar. Monocromático, sem badge,
sem gradiente, herda `currentColor`.

### 5.2 A arte

Marca principal — vale em qualquer tamanho, inclusive favicon:

```svg
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CICLO">
  <path d="M44.93 15.45 A21 21 0 1 0 44.93 48.55"
        stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
</svg>
```

Variante expressiva — **só a partir de 64px**. O ponto é a cliente que deu a volta e está
voltando ao início do anel; fica sobre a mesma linha de centro do traço, com metade da espessura
como raio, então pesa exatamente igual ao resto da marca:

```svg
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CICLO">
  <path d="M44.93 15.45 A21 21 0 1 0 44.93 48.55"
        stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
  <circle cx="53" cy="32" r="4" fill="currentColor"/>
</svg>
```

### 5.3 Verificação — rasterizada antes de virar regra

As duas variantes foram renderizadas (via `sharp`, do próprio projeto) a 16, 32 e 256px:

| Tamanho | Sem ponto | Com ponto |
|---|---|---|
| 256px | anel aberto; lê `C` e lê ciclo | ponto pesa igual ao traço, funciona |
| 32px | limpo | ⚠️ o ponto já lê como pontuação: vira `C.` |
| 16px | ainda legível como `C` | ❌ vira sujeira de 1px |

É por isso que o corte é 64px, e não "quando parecer bom".

### 5.4 Regras

- **Monocromática, sempre.** Osso sobre escuro, ou `--bg` sobre claro. Gradiente **nunca**.
- **Abaixo de 64px, versão sem ponto.**
- **Respiro** = metade do diâmetro do anel. Não encosta em texto.
- **Nunca dentro de um círculo cheio** — a marca já é um círculo; badge sobre badge é o erro atual.
- **O favicon repete a geometria à mão**, com cor literal: SVG de favicon não herda
  `currentColor`. Mudou a marca, mudar o favicon junto.
- **Ícone do PWA:** marca a **60%** do canvas (não 78%), centralizada, sobre `--surface` sólido —
  resolve C3, o corte do `maskable`.
- **`theme_color` e `background_color` do manifest** passam a `#0D0C0C`.

### 5.5 O nome escrito

`CICLO` em caixa alta, peso 600, `letter-spacing: +0.13em` — o mesmo tratamento do
`--text-overline` que já existe. Marca + nome juntos só na tela de login e no rodapé público.
Na `Topbar` do app, só a marca: a pessoa sabe em que app está.

---

## 6. Material e profundidade

| Sai | Entra | Por quê |
|---|---|---|
| `--grad-acc` como assinatura (12 pontos) | **Osso sólido** | Gradiente diagonal é a tatuagem do gênero. Cor chapada é mais cara |
| Gradiente na barra de fidelidade | Preenchimento sólido | A barra já informa por comprimento |
| **Três** brilhos radiais | **Zero.** A profundidade vem de superfície e sombra | O glow de herói é a citação mais direta do template gerado |
| Borda colorida para elevar | Luminosidade + `--shadow-elevado` (já existe) | Regra da Apple: plano acima é mais claro, não mais colorido |
| Raio 16 em tudo | 16 card · **12** campo e botão · 24 sheet · pill em chip | Raio uniforme achata a hierarquia |
| Card colorido inteiro para estado | Faixa de 3px na borda esquerda + ponto de 6px | Estado se lê na varredura vertical; card colorido polui |
| Separador de borda a borda | Separador **alinhado ao texto** | É o detalhe que separa lista nativa de `<hr>` de site |

---

## 7. Movimento

Os tokens de `08 §4.3` (`--ease-ios`, `--dur-1/2/3`) estão certos e ficam. O que falta é regra:

- **Nada pulsa para sempre.** Chamar atenção = pulsar 3 vezes e parar.
- **A marca não anima.** Splash animado é vaidade; o app abre na agenda.
- **Transição de lista só na primeira renderização** — reanimar ao filtrar faz o app parecer
  lento sendo rápido.
- **Um efeito por interação.** Hoje o toque em card faz escala + cor + sombra ao mesmo tempo.
- `prefers-reduced-motion` continua desligando tudo.

---

## 8. Ícones e linguagem

- **`Sparkles` é banido do produto** (F1). O Motor de Ciclo precisa de um símbolo próprio: o
  **anel aberto da marca**, que é literalmente o conceito. Onde hoje há brilho — tab bar, badge
  "ciclo", `AlertBanner` de acento, "Vale a pena hoje", "Como atender" — entra o anel ou nada.
- **`Zap` sai.** Urgência se comunica por cor semântica e posição, não por raio.
- **Um nome só por ícone:** `TriangleAlert` (nome atual da lucide) em todo lugar; `AlertTriangle`
  sai (F3).
- **`stroke-width: 1.75` em todo o app.** Tamanhos **20** (linha, campo) e **24** (navegação).
  Nada de 18, 22, 28 avulsos.
- **Ícone não acompanha todo rótulo** (F4). Ícone é para o que se procura na varredura: estado,
  navegação, ação. Cabeçalho de seção não precisa.
- **Ícone herda a cor do texto**, exceto quando é sinal de estado.

---

## 9. Composição

O que muda concretamente nas telas, além de cor e fonte:

| Tela | Hoje | Passa a ser |
|---|---|---|
| **Herói público** (`/[slug]`) | brilho radial + tudo centralizado + 2 botões iguais | Alinhado à esquerda; nome grande; "aberto agora" como primeira informação; **um** botão primário (Agendar), WhatsApp como secundário de texto |
| **Hoje** | linha de 3 stat tiles do mesmo tamanho | Faturado hoje como número herói; os demais viram linha secundária. A tela responde "como está o dia?" antes de "quais são os números?" |
| **Listas** | card colorido por estado | Faixa de 3px + neutro para o esperado (§3.5) |
| **Formulários** | `text-center` em várias | Alinhamento à esquerda; rótulo acima; ação fixa no rodapé |
| **Config** | lista chapada de 9 itens | Agrupada por tema, com separador alinhado ao texto |

Régua para levar junto: **se a tela funciona em escala de cinza, o design está certo.** Se ela
depende da cor para ser compreendida, a cor está fazendo trabalho da tipografia.

---

## 10. As duas vozes

| | App (`/admin/*`) | Página pública (`/[slug]`) |
|---|---|---|
| Quem usa | profissional, dezenas de vezes ao dia | cliente final, uma vez a cada semanas |
| Cor | **osso + semânticos**; sem cor de marca | **acento do salão** manda |
| Densidade | alta, informação primeiro | baixa, respiro, uma decisão por vez |
| Tom | instrumento | convite |
| Marca | CICLO discreto | marca **do salão**; CICLO só um selo no rodapé |

Consequência arquitetural: `--acc` deixa de ser injetado globalmente por tenant e passa a valer
**apenas no escopo público**. É a fase de maior risco do plano (E7).

Erro a evitar: deixar a página pública com cara de painel administrativo. Ela é o cartão de
visita do salão, não uma tela do sistema.

---

## 11. Plano de execução

Ordem obrigatória: cor e tipografia antes de qualquer tela, senão o ajuste fino é chute.

| Fase | O que | Arquivos | Risco |
|---|---|---|---|
| **E0 · Cor** | Tokens de 3.3–3.6; `--ok/--atencao/--erro` substituem os cinco semânticos | `globals.css` | Baixo |
| **E1 · Trava** | `contraste.test.ts` atualizado **e estendido**: passa a exigir Δ luminância ≥ 0,15 entre `ok`/`atencao`/`erro` | `tests/unit/design/contraste.test.ts` | Baixo — é o que impede a regressão |
| **E2 · Tipografia** | Inter → Archivo; peso máx. 700; `tabular-nums`; varredura dos 30 `font-extrabold` | `layout.tsx`, `globals.css`, varredura | Baixo |
| **E3 · Gradiente** | `--grad-acc` removido dos 12 pontos; os **3** brilhos radiais apagados | `button.tsx`, `selo.tsx`, `empty-state.tsx`, `stat-tile.tsx`, `fidelidade.tsx:158`, `secoes.tsx:74`, `admin/layout.tsx:28`, `tela-publica.tsx:15` | Médio — muda o que está na tela |
| **E4 · Marca** | `Selo` vira §5.2; favicon; ícones 192/512 + maskable a 60%; manifest | `selo.tsx`, `app/icon.svg`, `public/icons/*`, `manifest.json` | Baixo |
| **E5 · Limpeza** | Apagar os 5 SVGs do `create-next-app` | `public/` | Nenhum |
| **E6 · Ícones** | `Sparkles`/`Zap` banidos; `TriangleAlert` unificado; traço 1.75; tamanhos 20/24 | varredura | Médio |
| **E7 · Escopo da cor** | `--acc` do tenant só em `/[slug]`; app fica osso | injeção no `<html>`, layout público | **Alto** — é a tese de §10 |
| **E8 · Verticais** | Migration com os sete tons de 3.8 | `supabase/migrations/00XX_*.sql` | Médio — muda dado |
| **E9 · Estado sem cor** | Confirmado/pago passam a neutro; faixa de 3px | `badge.tsx`, `appointment-row.tsx`, `card.tsx` | Médio |
| **E10 · Composição** | §9, tela a tela | telas | Médio |
| **E11 · Verificação** | `typecheck && lint && test:unit && build` + medição no DOM a 375px + leitura em escala de cinza | — | — |

**E0–E5 derrubam a maior parte da "cara de IA", não têm risco e são reversíveis.** E7, E8 e E9
mexem em arquitetura de tema, em dado e em semântica — merecem rodada própria.

---

## 12. Critérios de aceite

1. `grep -rn "a855f7\|ec4899\|f59e0b\|8b5cf6\|10b981\|f97316" src/ supabase/` não retorna nada.
2. Nenhum valor de cor do projeto é um swatch cru do Tailwind.
3. `grep -rn "grad-acc\|radial-gradient" src/` retorna **zero** em componente de interface
   (só a máscara do `.scroll-x`, que não é cor).
4. `grep -rn "Sparkles\|Zap" src/` retorna zero.
5. `grep -rn "font-extrabold" src/` retorna zero.
6. `contraste.test.ts` passa **sem afrouxar piso**, e reprova se Δ luminância entre semânticos
   cair abaixo de 0,15.
7. `--txt-3` passa nas quatro superfícies.
8. A marca é legível a 16px em monocromático; o `maskable` não corta.
9. Nenhum arquivo do `create-next-app` em `public/`.
10. Cor de vertical não corresponde a estereótipo de gênero e é editável no onboarding.
11. A tela "Hoje" é compreensível **em escala de cinza**.
12. `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build` limpos.
13. Nenhuma regra de negócio, rota de API ou consulta ao banco alterada.

---

## 13. O que não fazer

- **Não trocar roxo por outro matiz.** Se o acento novo for lilás, índigo, teal ou latão, nada
  mudou — só trocou de clichê. A decisão é osso (3.3).
- **Não adicionar uma segunda família tipográfica.** O eixo de largura do Archivo resolve.
- **Não colorir por módulo** (agenda azul, clientes verde, caixa laranja). É o erro do Fresha e
  destrói a leitura de estado.
- **Não devolver o gradiente "só no botão principal".** Ou é assinatura, ou não é — e não é.
- **Não usar foto de banco de imagem.** Ou é foto real do salão, na página dele, ou não é foto.
- **Não pôr emoji na interface.**
- **Não animar a marca.**
- **Não deixar o dono escolher a cor do app inteiro.** Ele escolhe a cor da página pública dele;
  o instrumento é o mesmo para todos — é isso que mantém o produto neutro entre barbearia e
  manicure.

---

## 14. Emendas ao `03-DESIGN-SYSTEM.md`

Registrar em `DECISOES.md` com a data:

1. **§1 (cor):** base passa de preto azulado para preto quente; **o acento do produto deixa de
   ser um matiz e passa a ser osso `#F0EBE3`**; `--txt-3` para `#99938C`.
2. **§1 (semântica):** cinco matizes viram três (`ok`, `atencao`, `erro`), com piso de Δ
   luminância 0,15 entre eles. **Estado esperado não tem cor.**
3. **§1 (vertical):** a tabela de seis cores é substituída pelos sete tons de 3.8; deixa de ser
   função do nicho e passa a ser escolha do dono, válida só na página pública.
4. **§2 (tipografia):** Inter → Archivo; peso máximo 700; `tabular-nums` obrigatório em dinheiro
   e hora.
5. **Novo — escopo da cor:** o acento do tenant vale na página pública; dentro do app a cor é do
   CICLO e significa exceção.
6. **Novo — marca:** monograma em círculo com gradiente é substituído pelo anel aberto de §5.2.
7. **Novo — ícones:** `Sparkles` e `Zap` banidos; traço 1.75; tamanhos 20/24.
