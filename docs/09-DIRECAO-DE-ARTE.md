# 09 · DIREÇÃO DE ARTE — tirar a cara de IA do CICLO

> Data: 2026-08-19 · Escopo: identidade visual do produto — cor, tipografia, marca, material,
> movimento e ícone. **Documento de execução:** ele tem autoridade para trocar cor, fonte e
> logo, e é o que vale quando conflitar com `03-DESIGN-SYSTEM.md §1`.
>
> `08-REDESIGN-UI.md` consertou a **execução** (tamanho de fonte que não chegava na tela, alvo
> de toque, campo, navegação). Estava certo e está no ar. Este documento é o problema seguinte,
> que aquele não tocou de propósito: **o produto está bem construído e não tem identidade.**
>
> Restrição que governa tudo aqui: o mesmo app é de uma **barbearia** e de uma **manicure**.
> Nada pode ser masculino nem feminino. Neutro não é "sem opinião" — é uma opinião difícil.

---

## 0. Veredito

A interface parece gerada por IA porque **é literalmente feita de valores de fábrica**. Não é
impressão, é catálogo. Oito evidências, todas verificáveis no repositório de hoje:

| # | O que está lá | Onde | Por que denuncia |
|---|---|---|---|
| 1 | `--acc: #a855f7` | `globals.css` | É o `purple-500` do Tailwind, sem uma casa alterada. O roxo é a cor default de todo app gerado desde 2023 |
| 2 | As **seis** cores de vertical são swatches crus do Tailwind | `0002_vertical_packs.sql` | `#a855f7` purple-500 · `#ec4899` pink-500 · `#f59e0b` amber-500 · `#8b5cf6` violet-500 · `#10b981` emerald-500 · `#f97316` orange-500. Seis nichos, zero decisões |
| 3 | Cílios `#a855f7` e sobrancelhas `#8b5cf6` são **quase a mesma cor** | idem | Prova que a lista foi copiada, não escolhida: ninguém que olhou as duas lado a lado as manteria |
| 4 | `linear-gradient(135deg, …)` como assinatura da marca | `--grad-acc` | 135° é o ângulo padrão. Gradiente diagonal roxo→lilás é o clichê visual do gênero |
| 5 | O logo é a letra **C** dentro de um círculo com gradiente | `selo.tsx`, `icon-512.png` | É o placeholder que toda ferramenta de geração produz quando não há marca |
| 6 | Fonte: **Inter** | `layout.tsx` | Não é errada, é anônima. Inter é a fonte de "nenhuma decisão foi tomada" |
| 7 | Fundo `#0a0a0f` — preto **azulado** | `globals.css` | Preto-azul + roxo saturado = o dark mode de SaaS genérico |
| 8 | `next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` | `public/` | Sobras literais do `create-next-app`, nunca removidas |

E um agravante de mercado, específico do Brasil: **roxo em app de celular é Nubank.** Para o
usuário brasileiro, roxo + interface escura + números grandes não lê "beleza", lê "fintech".
O CICLO está pedindo emprestada uma identidade que já tem dono no país.

**A boa notícia:** nada disso é estrutural. Cor, fonte e marca são as três camadas mais baratas
de trocar num projeto que já tokenizou tudo — que é exatamente o que o `08` deixou pronto.
O trabalho abaixo não encosta em uma regra de negócio.

---

## 1. Tese: um instrumento, não uma campanha

O CICLO é usado **em pé, com uma mão, entre uma cliente e outra**, dentro de um salão. Não é um
site para ser admirado; é uma ferramenta consultada dezenas de vezes por dia. Isso decide tudo:

1. **O conteúdo é hora e dinheiro.** Números são o herói. A tipografia carrega o design; a cor
   não precisa fazer esse trabalho.
2. **Decoração cansa; instrumento não.** Um gradiente na barra de progresso é engraçado uma vez
   e irritante na centésima. Superfície neutra envelhece bem.
3. **Cor tem que significar alguma coisa.** Se roxo é "primário" e roxo também é "confirmado" e
   roxo também é a marca, a cor perdeu função. No instrumento, cor é **estado**: confirmado, em
   risco, faltou, pago.

### 1.1 A decisão que resolve a neutralidade

Este é o ponto central do documento.

> **Dentro da ferramenta, a cor é do CICLO e significa estado.
> A cor do salão aparece na página pública dele — que é onde ela é, de fato, a marca dele.**

Por que isso resolve barbearia × manicure de uma vez:

- **No app**, não existe decoração colorida para ser masculina ou feminina. O barbeiro e a
  manicure veem o mesmo instrumento neutro, e a cor que aparece está dizendo "esta cliente está
  em risco de sumir", não "este app é para você".
- **Na página pública `/[slug]`**, o acento do salão manda no herói, no botão de agendar e nos
  detalhes. Lá a personalidade é bem-vinda, porque quem vê é a cliente **daquele** salão.

Consequência prática: `--acc` deixa de ser injetado como identidade global e passa a ser o
acento **do CICLO** no app, e o acento **do tenant** apenas no escopo público. E a associação
"unhas = rosa, barbearia = âmbar" morre — ela é estereótipo, não sistema.

---

## 2. Referências — o que roubar, especificamente

Não é para copiar tela. É para roubar **disciplina**. Cada linha diz o que tirar de cada um.

| Referência | O que roubar |
|---|---|
| **Apple — apps utilitários (Ajustes, Relógio, Carteira, Fitness)** | Cinza é a cor da interface; cor é reservada para significado. Densidade alta sem ruído. Cabeçalho grande que encolhe ao rolar. Separadores que começam alinhados ao texto, não à borda |
| **Apple HIG — material** | Profundidade por **luminosidade e sombra**, não por borda colorida. Um plano acima = mais claro, não mais colorido |
| **Linear** | Quase monocromático + um acento usado com avareza. Estado por peso e por um ponto de cor de 6px, não por card colorido inteiro |
| **Stripe (dashboard)** | Número é conteúdo, não enfeite: figuras tabulares, alinhamento à direita em coluna, unidade menor que o valor (`R$` menor que `1.240`) |
| **Things 3** | A hierarquia inteira feita com tamanho, peso e espaço. Praticamente sem cor — e ainda assim inconfundível |
| **Notion Calendar** | Como densidade de agenda funciona em tela pequena: linha do tempo legível sem virar planilha |
| **Mangomint** (SaaS de salão premium, EUA) | O concorrente que acertou o tom: sóbrio, claro, caro. Prova que salão não precisa de rosa nem de glitter |
| **Fresha / Booksy / Square Appointments** | Referência **negativa**: coloridos demais, cada módulo com sua cor, tudo competindo. É o que não fazer |
| **Nubank / Monzo** | Legibilidade de dinheiro no celular. E, no caso do Nubank, a razão para **não** usar roxo no Brasil |

Uma régua para levar junto: **se a tela ficar bonita em preto e branco, o design está certo.**
Se ela depender da cor para funcionar, a cor está fazendo trabalho da tipografia.

---

## 3. Cor

Toda cor abaixo foi **medida** (WCAG 2.1) contra os fundos reais deste projeto, e não anotada de
memória — este projeto já foi mordido uma vez por contraste anotado em documento que não fechava
(o quinto defeito da especificação, `--txt-3`). O `tests/unit/design/contraste.test.ts` continua
sendo a autoridade final: **nenhuma cor entra sem passar por ele.**

### 3.1 A base: preto quente, não preto azul

A troca mais barata e mais eficaz do documento inteiro. `#0a0a0f` é azulado — é o preto de
software. Um preto levemente **quente** lê como objeto (couro, madeira, mármore), que é o
ambiente de um salão, e sai imediatamente do clichê.

```css
--bg:        #0D0C0C;  /* fundo do app */
--surface:   #161514;  /* card, linha de lista */
--surface-2: #201E1D;  /* superfície elevada, sheet, campo */
--surface-3: #2B2926;  /* pressionado, borda forte */
```

### 3.2 Texto — medido

| Token | Valor | sobre `--bg` | sobre `--surface` | sobre `--surface-2` | sobre `--surface-3` |
|---|---|---|---|---|---|
| `--txt` | `#F5F3F1` | **17,65:1** | 16,48:1 | 15,00:1 | — |
| `--txt-2` | `#A8A29C` | **7,73:1** | 7,22:1 | 6,57:1 | — |
| `--txt-3` | `#99938C` | **6,42:1** | 6,00:1 | 5,46:1 | 4,77:1 |

⚠️ Registro para não repetir o erro: os candidatos `#847E78` e `#8A847E` **reprovam** sobre
`--surface-2` (4,14:1 e 4,49:1). Passam sobre o fundo e falham sobre o card — exatamente o tipo
de valor que "parece ok" e não é. `#99938C` é o primeiro tom que passa nas **quatro** superfícies.

### 3.3 O acento do CICLO: latão

```css
--acc:      #C9A227;  /* latão */
--acc-2:    #D9B65C;  /* latão claro — hover, texto sobre superfície escura */
--acc-soft: rgba(201, 162, 39, 0.14);
--on-acc:   #0D0C0C;  /* texto sobre o acento preenchido */
```

Por que latão, e não outro:

- **É neutro de verdade no nicho.** Dourado/latão é linguagem de barbearia clássica (placa,
  navalha, cadeira) **e** de estúdio de unhas/cílios (detalhe metálico é o código de "caprichado"
  no setor). É a rara cor que os dois lados reivindicam.
- **Não é roxo, não é rosa, não é âmbar de alerta.** Sai do clichê de IA e do território do
  Nubank sem cair em estereótipo de gênero.
- **Funciona nos dois sentidos**, o que é raro: `8,08:1` como cor de texto/ícone sobre o fundo,
  e `8,08:1` para o texto escuro sobre ele quando vira botão preenchido. O roxo atual entrega
  `4,94:1` sobre o fundo — passa raspando e obriga a compensar com peso.

### 3.4 Semânticos — cor com trabalho a fazer

Dessaturados de propósito: sinalizam sem gritar, e convivem com o latão sem brigar.

| Token | Valor | Significado | sobre `--bg` |
|---|---|---|---|
| `--ok` | `#5FA97F` | confirmado, pago | 6,95:1 |
| `--warn` | `#D9A441` | aguardando confirmação | 8,69:1 |
| `--risk` | `#E08B4C` | risco de falta, ciclo atrasado | 7,41:1 |
| `--bad` | `#E2685F` | faltou, cancelado | 5,93:1 |
| `--info` | `#7FA3D1` | informativo, neutro | 7,50:1 |

⚠️ `--warn` (`#D9A441`) e `--acc` (`#C9A227`) são vizinhos. **Não podem aparecer na mesma linha**
como coisas diferentes. Regra: em componente de estado (badge, faixa de `AppointmentRow`) a cor
vem só da paleta semântica; o latão nunca entra em estado. Há de virar teste.

### 3.5 As cores de vertical: sugestão, não sentença

As seis atuais saem. Entram sete tons "de material" — todos medidos, todos plausíveis tanto numa
barbearia quanto num estúdio de unhas, e **deliberadamente não mapeados por estereótipo**. Isto
é o valor inicial do `vertical_packs.accent_color`; o dono troca no onboarding, e é a cor dele
que aparece na página pública.

| Nome | Valor | sobre `--bg` | texto escuro sobre ela |
|---|---|---|---|
| Latão | `#C9A227` | 8,08:1 | 8,08:1 |
| Argila | `#C4A98F` | 8,76:1 | 8,76:1 |
| Aço | `#8AA8CE` | 7,97:1 | 7,97:1 |
| Sálvia | `#7FA98C` | 7,40:1 | 7,40:1 |
| Grafite | `#A39B93` | 7,13:1 | 7,13:1 |
| Ameixa | `#B08AA8` | 6,56:1 | 6,56:1 |
| Terracota | `#C2725A` | 5,44:1 | 5,44:1 |

O pior desta lista (5,44:1) ainda é melhor que o roxo de hoje (4,94:1).

**Regra de onboarding:** oferecer os sete como amostra, com o nome escrito, e deixar claro que é
a cor **da página pública do salão**. Nunca perguntar "qual seu nicho?" para decidir cor.

---

## 4. Tipografia

### 4.1 A troca

**Inter sai. Entra `Archivo`.** (`next/font/google`, variável.)

- **Neutra nos dois sentidos:** é um grotesco robusto, com estrutura de letreiro — cabe numa
  fachada de barbearia sem virar "masculino", e é limpa o bastante para um estúdio de unhas.
- **Numerais de verdade**, que é o que este produto mais mostra: figuras tabulares consistentes,
  bom desenho de `1` e `7` (crítico em horário: `11:15`, `17:00`).
- **Eixos variáveis de peso e largura**, o que dá uma segunda dimensão de hierarquia **sem
  carregar uma segunda família** — o valor de "Faturado hoje" pode ser um pouco mais estreito e
  mais pesado, criando destaque sem custo de rede.
- Cobertura completa de português (acentuação e `ç`).

Alternativas aceitáveis, se a leitura no aparelho real não agradar: **Schibsted Grotesk**
(mais editorial) ou **Instrument Sans** (mais contemporânea). **Não voltar para Inter** — o
problema dela aqui não é qualidade, é ausência de escolha.

Nota técnica: `next/font/google` **baixa e auto-hospeda no build**. Não há requisição a
`fonts.googleapis.com` em produção e **a CSP não muda** (`font-src 'self' data:` já cobre).

### 4.2 Regras de uso

| Regra | Detalhe |
|---|---|
| **Dinheiro e hora sempre `tabular-nums`** | sem isso a coluna de valores "dança" ao atualizar |
| **`R$` menor e mais claro que o número** | 60% do tamanho, `--txt-2`. O valor é o dado; a moeda é rótulo |
| **Tracking negativo só em número grande** | `-0.02em` no `--text-numero`/`--text-titulo`; zero no corpo |
| **Nada de `font-weight` acima de 700** | extrabold em fonte de UI é grito |
| **`text-wrap: balance` em título, `pretty` em parágrafo** | nome de salão com duas palavras para de quebrar com órfã |
| **Caixa alta só no `--text-overline`** | com `+0.13em`, como já está |

A escala de tamanhos do `08 §4.2` **está correta e fica** — ela acabou de ser consertada e
validada no DOM. Este documento não mexe em tamanho, só em família, entrelinha de número e
numerais.

---

## 5. Marca

### 5.1 O problema

Uma letra dentro de um círculo com gradiente não é uma marca: é o placeholder que aparece
quando não existe uma. Além de genérico, o `C` não diz nada sobre o produto.

### 5.2 O conceito

O produto se chama CICLO e a coisa que ele faz é **trazer a cliente de volta**. A marca é isso e
mais nada: **um anel aberto** — que se lê como `C` num relance, e como "ciclo que retorna" no
segundo olhar. Sem gradiente, sem badge, monocromático, herda `currentColor`.

### 5.3 A arte (usar exatamente esta geometria)

Marca principal — a que vale em qualquer tamanho, inclusive favicon:

```svg
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CICLO">
  <path d="M44.93 15.45 A21 21 0 1 0 44.93 48.55"
        stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
</svg>
```

Variante expressiva — **só a partir de 64px** (topo do app, tela de login, ícone do PWA, página
pública). O ponto é a cliente que deu a volta e está voltando ao início do anel; ele fica sobre
a mesma linha de centro do traço, com metade da espessura como raio, então pesa exatamente o
mesmo que o resto da marca:

```svg
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CICLO">
  <path d="M44.93 15.45 A21 21 0 1 0 44.93 48.55"
        stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
  <circle cx="53" cy="32" r="4" fill="currentColor"/>
</svg>
```

### 5.4 Verificação — a geometria acima foi renderizada, não desenhada de cabeça

As duas variantes foram rasterizadas (via `sharp`, do próprio projeto) a 16, 32 e 256px antes de
entrarem aqui. Resultado:

| Tamanho | Sem ponto | Com ponto |
|---|---|---|
| 256px | anel aberto, lê `C` e lê ciclo | ponto pesa igual ao traço, funciona |
| 32px | limpo, sem ambiguidade | ⚠️ o ponto já lê como **pontuação**: vira `C.` |
| 16px | ainda legível como `C` | ❌ o ponto vira sujeira de 1px |

É por isso que a regra abaixo é 64px, e não "quando parecer bom".

### 5.5 Regras da marca

- **Monocromática, sempre.** Latão sobre escuro, ou `--txt` sobre escuro, ou `--bg` sobre claro.
  Gradiente **nunca**.
- **Abaixo de 64px, versão sem ponto** — medido acima: a 32px o ponto já lê como `C.`
- **Área de respiro** = metade do diâmetro do anel em volta. Não encostar em texto.
- **Nunca dentro de um círculo cheio.** A marca já é um círculo; badge em cima de badge é o erro
  que estava lá.
- **O favicon repete a geometria à mão** — SVG de favicon não herda `currentColor`; cor fixa
  literal. (Armadilha conhecida da família: mudou a marca, mudar o favicon junto.)
- **Ícone do PWA:** marca centralizada a **60%** do canvas sobre `--surface` sólido. O `maskable`
  precisa da arte dentro do círculo de 80% — a 78% que a marca ocupa hoje, o sistema corta.

### 5.6 O nome escrito

`CICLO` em caixa alta, peso 600, `letter-spacing: +0.13em` — o mesmo tratamento do
`--text-overline` que já existe. Marca + nome ficam lado a lado só na tela de login e no rodapé
público; na `Topbar` do app, **só a marca** (a pessoa sabe em que app está — isso já foi
decidido no `08 §C4`).

---

## 6. Material e profundidade

O que mata a cara de IA, além da cor:

| Sai | Entra | Por quê |
|---|---|---|
| `--grad-acc` como assinatura (botão primário, FAB, monograma, barra de progresso) | **Latão sólido.** Gradiente sobra em, no máximo, um lugar — e de preferência em nenhum | Gradiente diagonal é a tatuagem do gênero. Cor chapada é mais cara |
| `backdrop-blur-xl` como efeito | Blur **só** onde há conteúdo rolando por baixo (`Topbar`, `TabBar`) | Vidro em cima de fundo liso é custo de GPU sem imagem |
| Borda colorida para elevar | **Luminosidade + sombra** (`--shadow-elevado` já existe e está certo) | É a regra da Apple: plano acima é mais claro, não mais colorido |
| Raio 16px em tudo | 16 em card, **12** em campo e botão, 24 em sheet, pill em chip | Raio uniforme achata a hierarquia |
| Card colorido inteiro para estado | Faixa de 3px na borda esquerda + ponto de 6px | Estado se lê na varredura vertical; card colorido polui |

Separador de lista alinhado ao texto (não à borda da tela) — detalhe pequeno, é o que diferencia
lista de app nativo de `<hr>` de site.

---

## 7. Ícones

`lucide-react` fica — é uma boa biblioteca. As regras que faltam:

- **Um traço só no app inteiro:** `stroke-width: 1.75`. Hoje varia com o tamanho e a tela.
- **Tamanhos: 20 (linha/campo) e 24 (navegação).** Nada de 18, 22, 28 avulsos.
- **Ícone nunca sozinho como ação primária** sem `aria-label` — já está certo na `Topbar`, tem
  que valer para todos.
- **Ícone acompanha a cor do texto**, não recebe cor própria — exceto quando é sinal de estado.

---

## 8. Movimento

Os tokens do `08 §4.3` (`--ease-ios`, `--dur-1/2/3`) estão certos e ficam. O que este documento
acrescenta:

- **Nada pulsa para sempre.** Se algo precisa chamar atenção (cliente em risco), pulsa 3 vezes e
  para.
- **A marca não anima na abertura.** Splash animado é vaidade de produto; o app abre na agenda.
- **Transição de lista só na primeira renderização**, nunca ao filtrar — reanimar a lista a cada
  toque de filtro faz o app parecer lento mesmo sendo rápido.
- **`prefers-reduced-motion` continua desligando tudo** (já está).

---

## 9. Duas vozes: o app e a página pública

| | App (`/admin/*`) | Página pública (`/[slug]`) |
|---|---|---|
| Quem usa | profissional, dezenas de vezes por dia | cliente final, uma vez a cada poucas semanas |
| Cor | neutra + latão + semânticos | **acento do salão** manda |
| Densidade | alta, informação primeiro | baixa, respiro, uma decisão por vez |
| Tom | instrumento | convite |
| Marca | CICLO discreto | **marca do salão**; CICLO só um selo pequeno no rodapé |

Erro a evitar: deixar a página pública com cara de painel administrativo. Ela é o cartão de
visita do salão, não uma tela do sistema.

---

## 10. Plano de execução

Ordem obrigatória — cor e fonte antes de qualquer tela, senão o ajuste fino é chute.

| Fase | O que | Arquivos | Risco |
|---|---|---|---|
| **A0 · Cor** | Tokens de §3.1–3.4 substituídos | `src/app/globals.css` | Baixo — só token |
| **A1 · Contraste** | Atualizar `contraste.test.ts` para os novos valores e **rodar** | `tests/unit/design/contraste.test.ts` | Baixo — é a trava |
| **A2 · Fonte** | `Inter` → `Archivo`; `tabular-nums` em dinheiro/hora; tracking de número | `src/app/layout.tsx`, `globals.css` | Baixo |
| **A3 · Marca** | `Selo` vira a marca de §5.3; favicon; ícones 192/512 + maskable a 60% | `src/components/shell/selo.tsx`, `src/app/icon.svg`, `public/icons/*` | Baixo |
| **A4 · Limpeza** | Apagar `next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`; `theme_color`/`background_color` do manifest para `#0D0C0C` | `public/` | Nenhum |
| **A5 · Gradiente** | `--grad-acc` sai do botão primário, FAB, `EmptyState`, monograma → latão sólido | `button.tsx`, `empty-state.tsx`, `tab-bar.tsx`, `selo.tsx` | Médio — toca o que está na tela |
| **A6 · Verticais** | Seis Tailwind → os sete tons de §3.5, via migration | `supabase/migrations/00XX_accent_neutro.sql` | Médio — muda dado |
| **A7 · Escopo do acento** | `--acc` do tenant deixa de ser injetado no app; passa a valer só em `/[slug]` | injeção no `<html>`, layout público | **Alto** — é a tese de §1.1, revisar com calma |
| **A8 · Material** | Raio por família, faixa de estado no lugar de card colorido, separador alinhado ao texto | `card.tsx`, `appointment-row.tsx`, `input.tsx` | Médio |
| **A9 · Ícones** | `stroke-width` 1.75, tamanhos 20/24 | varredura | Baixo |
| **A10 · Verificação** | `pnpm typecheck && lint && test:unit && build` + medição no DOM a 375px | — | — |

**A6 e A7 mexem em dado e em arquitetura de tema — as demais são cosméticas e reversíveis.**
Se for para fatiar a entrega, A0–A5 já resolvem ~80% da "cara de IA" e não têm risco.

---

## 11. Critérios de aceite

1. Nenhum valor de cor do projeto é um swatch cru do Tailwind. Verificável por busca.
2. `contraste.test.ts` passa **sem afrouxar nenhum piso**, com os valores de §3.
3. `--txt-3` passa nas quatro superfícies (o erro do `#847E78` não volta).
4. `grep -r "grad-acc"` não retorna nada em botão, FAB, monograma ou barra de progresso.
5. A marca renderiza legível a 16px em monocromático, e o `maskable` não corta.
6. Nenhum arquivo do `create-next-app` sobrou em `public/`.
7. Cor de vertical não corresponde a estereótipo de gênero — e é editável no onboarding.
8. A tela "Hoje" continua compreensível **em escala de cinza** (régua de §2).
9. `--warn` e `--acc` nunca aparecem como coisas diferentes na mesma linha.
10. `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build` limpos.
11. Nenhuma regra de negócio, rota de API ou consulta ao banco alterada.

---

## 12. O que não fazer

- **Não trocar roxo por outro roxo.** Se o acento novo for lilás, índigo ou violeta, nada mudou.
- **Não adicionar uma segunda fonte "de display".** O eixo de largura do Archivo já resolve.
- **Não colorir por módulo** (agenda azul, clientes verde, caixa laranja). É o erro do Fresha e
  destrói a leitura de estado.
- **Não usar foto de banco de imagem** de salão em lugar nenhum. Ou é foto real do salão, na
  página pública dele, ou não é foto.
- **Não pôr emoji na interface.** É o outro sinal clássico de interface gerada.
- **Não animar a marca.**
- **Não deixar o dono escolher a cor do app inteiro.** Ele escolhe a cor da página pública dele;
  o instrumento é o mesmo para todos — é isso que mantém o produto neutro entre barbearia e
  manicure.

---

## 13. Emendas ao `03-DESIGN-SYSTEM.md`

Registrar em `DECISOES.md` junto com a data:

1. **§1 (cor):** paleta base passa de preto azulado para preto quente; acento do produto passa de
   `#a855f7` para `#C9A227`; `--txt-3` para `#99938C`. Motivo: os valores anteriores eram
   defaults do Tailwind e o `--txt-3` reprovava sobre `--surface-2`.
2. **§1 (acento por vertical):** a tabela de seis cores é substituída pelos sete tons de §3.5, e
   deixa de ser função do nicho — passa a ser escolha do dono, com valor inicial sugerido.
3. **§2 (tipografia):** família passa de Inter para Archivo; numerais tabulares obrigatórios em
   dinheiro e hora.
4. **Novo — §1.1 (escopo da cor):** o acento do tenant vale na página pública; dentro do app a
   cor é do CICLO e significa estado.
5. **Novo — marca:** o monograma em círculo com gradiente é substituído pelo anel aberto de §5.3,
   monocromático, com variante de ponto acima de 64px.
