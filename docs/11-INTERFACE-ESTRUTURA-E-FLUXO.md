# 11 · INTERFACE — ESTRUTURA E FLUXO

> **Parte III** do trabalho de interface. As duas anteriores estão em
> `08-REDESIGN-E-IDENTIDADE.md` e **já estão no ar** — este documento não as repete.
>
> | Parte | Eixo | Estado |
> |---|---|---|
> | I | **Execução** — a mecânica chegava quebrada na tela | ✅ aplicada |
> | II | **Identidade** — a interface não tinha opinião visual | ✅ aplicada |
> | III | **Estrutura e fluxo** — como a informação se organiza e como se navega | ⬜ este documento |

---

## 1 · Veredito

Depois das Partes I e II, **a interface não tem mais defeito de execução**. Foi medido, não
suposto: varredura a 375×812 em `/admin/hoje`, `/admin/clientes`, `/admin/clientes/[id]`,
`/dom-rocha` e `/dom-rocha/agendar` acusou **zero** estouro horizontal e **zero** alvo abaixo do
mínimo nas telas principais.

O que resta é de outra natureza, e é o que separa "app bem construído" de "app que a pessoa
gosta de usar":

1. **A informação está empilhada, não organizada.** A tela mais importante do CRM tem 3 telas de
   rolagem sem nenhum jeito de pular para uma parte.
2. **A navegação não tem continuidade.** Cada toque troca a tela inteira de uma vez, sem
   nenhuma relação visual entre a que sai e a que entra.
3. **Ainda há ação destrutiva com alvo de 16px** — sobra pontual da Parte I, em componente
   criado depois dela.
4. **No monitor, o app é uma coluna de celular** com 61% da tela vazia.

Nada aqui é estrutural. Nenhuma fase abaixo toca em regra de negócio.

---

## 2 · Método

Medição ao vivo contra o código atual (`pnpm dev`), viewport 375×812 (o menor aparelho que a base
de clientes usa) e 1440×900. Para cada tela: largura de rolagem do documento, altura total, e
altura real de cada alvo tocável via `getBoundingClientRect()`, descontando os que usam o
utilitário `toque-48` — que estende a área tocável sem engordar o desenho.

Nenhum item abaixo é impressão subjetiva: cada um traz o número medido e o arquivo.

---

## 3 · O que já está resolvido — **não refazer**

Registrado para a próxima sessão não "consertar" o que já está certo:

| Verificado | Medição atual |
|---|---|
| Alvos de toque | `Chip` = 40px visual + `toque-48` → 48px tocáveis |
| Horário no agendamento público | 40×65px visual, área tocável 48px |
| Corpo de texto | 16px (abaixo disso o Safari do iPhone dá zoom no campo) |
| Escala tipográfica | Entrelinha e tracking fazem parte do token |
| Ação primária fora de vista | `ActionBar` ancorada em `--tabbar-h` |
| Estouro horizontal | Zero em todas as telas medidas |
| Nav do desktop descolada | Wrapper interno a 560px, alinhado ao conteúdo (435→995 vs 436→994) |
| Contraste | `--txt-3` passa nas quatro superfícies; semânticos separados por luminância |

---

## 4 · Defeitos medidos que restam

### E1 · ▲ A ficha do cliente é uma parede de 3 telas — CRÍTICO

**Medido:** `2429px` de altura útil contra viewport de `812px` = **3,0 telas de rolagem**.

Sete blocos empilhados na vertical, todos no mesmo peso visual, sem índice e sem como pular:

| Bloco | Altura |
|---|---|
| Métricas + ações | ~370px |
| Como atender | 260px |
| Relacionamento | 176px |
| Fidelidade | 356px |
| Anotações | 266px |
| Histórico | 562px |
| Saúde / Pacotes | condicional |

**Por que é o defeito mais caro do app:** esta é a tela que a profissional abre *com o cliente na
cadeira*. A pergunta real é "como ele gosta do corte?" — e a resposta está no segundo scroll,
depois de passar por LTV, pontos e assinatura. A informação que importa no momento do
atendimento está enterrada sob a informação que importa na gestão do negócio.

**Não é problema de quantidade.** Todo bloco ali é útil. É problema de **não haver camada**: a
ficha responde a três perguntas diferentes (*quem é · como atender · quanto vale*) fingindo ser
uma pergunta só.

**Arquivo:** `src/app/admin/clientes/[id]/ficha.tsx` (+ 4 componentes filhos)

---

### E2 · ▲ Ação destrutiva com alvo de 16px

**Medido:** `"Cancelar assinatura"` = **16px** de altura.

É o menor alvo do app inteiro, e é **destrutivo** — cancela a mensalidade de um cliente pagante.
A Parte I corrigiu os alvos que existiam na época; `fidelidade.tsx` nasceu depois dela, com um
`<button>` de texto solto em vez de componente.

Na mesma tela, os links de indicados (`Danilo Freitas`, `Otávio Pinheiro`, `Renato Cavalcanti`)
medem **18px** — links inline dentro de parágrafo, sem área tocável estendida.

**Arquivos:** `src/app/admin/clientes/[id]/fidelidade.tsx`, `.../ficha.tsx`

---

### E3 · A navegação não tem continuidade

**Medido:** zero ocorrências de `viewTransition` / `startViewTransition` no repositório.

Cada navegação é uma substituição seca: a tela some, a próxima aparece. Não há relação visual
entre origem e destino, então o app não comunica **hierarquia** — abrir a ficha de um cliente
(descer um nível) parece igual a trocar de aba (mover-se lateralmente).

Instalado como PWA, ao lado de apps nativos na tela de início, é a diferença que mais denuncia
"isto é um site".

---

### E4 · 19 de 27 telas sem estado de carregamento

**Medido:** só 8 telas têm `loading.tsx`.

Sem ele, o Next não mostra **nada** entre o toque e o Server Component terminar de buscar — a
tela anterior fica congelada. No 4G do subsolo de um salão, isso lê como travamento.

As 19 sem cobertura:

```
admin/agenda/novo · admin/campanhas · admin/campanhas/nova
admin/clientes/importar · admin/clientes/nova
admin/comanda/[id] · admin/comanda/agendamento/[appointmentId]
admin/config/cofre · admin/config/horarios · admin/config/mensagens
admin/config/negocio · admin/config/notificacoes · admin/config/planos
admin/config/profissionais · admin/config/profissionais/[id]
admin/config/seguranca · admin/config/servicos
admin/orcamentos/novo · admin
```

---

### E5 · No monitor, 61% da tela é vazio

**Medido a 1440×900:** conteúdo ocupa `558px`; sobram **882px** desperdiçados.

A decisão mobile-first está certa e **não deve ser revertida** — o app é usado no celular, em pé,
com uma mão. Mas o balcão do salão tem um monitor, e nele o produto vira uma tira estreita no
meio do nada. Não é bug: é oportunidade não aproveitada.

---

### E6 · Rolagem horizontal cortada na margem

Os trilhos de filtro (`overflow-x-auto`) terminam exatamente na `--gutter`, sem máscara de
esmaecimento nem sangria até a borda. O último item aparece cortado ao meio, o que lê como
defeito de layout em vez de "há mais para o lado".

---

## 5 · Plano de execução

Fases independentes, na ordem de retorno por esforço. Cada uma pode parar sem deixar o app
inconsistente.

---

### Fase E0 · Fechar a sobra da Parte I *(~30min)*

Puramente mecânico, sem decisão de design.

- `fidelidade.tsx`: `"Cancelar assinatura"` vira `Button` com `variante="danger"`, ou ganha
  `toque-48`. Alvo mínimo 48px, como todo o resto.
- Links inline de indicados: `toque-48` + `inline-flex`, ou viram lista de chips tocáveis.
- Varredura final: nenhum elemento interativo abaixo de 44px em nenhuma tela.

**Aceite:** a varredura de alvos volta vazia em `/admin/clientes/[id]`.

---

### Fase E1 · A ficha em camadas — a mudança que mais importa *(~3h)*

A ficha para de ser pilha e passa a ter **três camadas**, na ordem em que a pergunta aparece na
vida real:

**Camada 1 — sempre visível, sem rolar (o "cabeçalho vivo")**
Nome · telefone com toque para WhatsApp · etiquetas · **como atender** (máquina, barba, alergia).
É o que a profissional precisa com o cliente na cadeira. Hoje está no segundo scroll.

**Camada 2 — navegação segmentada**
Um controle segmentado com quatro abas, cada uma abrindo em ~700px:

| Aba | Conteúdo | Pergunta que responde |
|---|---|---|
| **Resumo** | Métricas, ciclo, relacionamento | "Quanto vale e quando volta?" |
| **Histórico** | Atendimentos, mensagens | "O que já fizemos?" |
| **Fidelidade** | Pontos, assinatura, pacotes, carteira | "O que ele tem comigo?" |
| **Ficha** | Anotações, saúde, consentimentos | "O que preciso lembrar?" |

**Camada 3 — ações**
`ActionBar` fixa com as duas ações reais: *Mandar mensagem* e *Marcar horário*. Hoje são botões
no meio da página que somem ao rolar.

**Regras de execução:**
- Aba escolhida vive na **URL** (`?aba=historico`), não em estado local — voltar do WhatsApp
  precisa cair na mesma aba, e o link precisa ser compartilhável.
- Aba sem conteúdo **não some**: mostra estado vazio explicando o que aparece ali. Aba que
  desaparece sozinha faz a pessoa achar que perdeu dado.
- O trilho de abas é rolável e sangra até a borda (ver E6).
- Sem `loading` entre abas: o dado já veio junto na ficha, trocar de aba é troca de camada, não
  nova busca.

**Resultado esperado:** de 2429px numa pilha → ~700px por camada, com o essencial em 0px de
rolagem.

**Arquivos:** `ficha.tsx`, novo `src/components/ui/segmented.tsx`

---

### Fase E2 · Continuidade de navegação *(~2h)*

Dar hierarquia ao movimento, com a curva que já existe no token (`--ease-ios`):

- **Descer um nível** (lista → ficha, lista → detalhe): entra da direita, o anterior recua
  levemente.
- **Trocar de aba** (tab bar): esmaece no lugar, sem deslocamento lateral — abas são irmãs, não
  filhas.
- **Sheet**: já sobe de baixo; falta o fundo recuar (`scale(.98)` + escurecer) para o sheet
  parecer *em cima de*, não *no lugar de*.

Sempre atrás de `prefers-reduced-motion` — que o `globals.css` já respeita globalmente.

**Cuidado registrado:** transição de rota no App Router precisa ser aplicada no `layout.tsx` do
grupo, não por página, ou a animação reinicia a cada navegação interna.

---

### Fase E3 · Percepção de velocidade *(~1h30)*

`loading.tsx` nas 19 telas listadas em E4, reusando o `Skeleton` que já existe.

**Regra:** o esqueleto imita a **forma real** da tela (mesma quantidade de cards, mesma altura),
não um retângulo genérico. Esqueleto com forma errada é pior que nenhum — a tela "pula" quando
o conteúdo chega.

Duas telas merecem tratamento próprio:
- `admin/comanda/[id]` — é onde se cobra; qualquer hesitação ali é grave.
- `admin/campanhas/nova` — resolve cinco públicos no servidor antes de pintar.

---

### Fase E4 · Trilhos que sangram *(~40min)*

Todo `overflow-x-auto` do app ganha:
- sangria negativa até a borda (`-mx-[var(--gutter)]` + `px-[var(--gutter)]` interno);
- máscara de esmaecimento (`mask-image`) nas duas pontas, que some ao chegar no fim;
- `scroll-snap` nos trilhos de escolha (dias, horários).

**Onde:** filtros de `/admin/clientes` e `/admin/agenda`, faixa de 14 dias do agendamento
público, trilho de abas da Fase E1.

---

### Fase E5 · Aproveitar o monitor *(~2h, opcional)*

Só acima de `lg` (1024px), sem tocar em nada abaixo disso:

- A tab bar vira **coluna lateral** fixa à esquerda (rótulo + ícone), liberando a barra inferior.
- O conteúdo sobe de 560px para duas colunas em telas de lista + detalhe: lista à esquerda,
  ficha aberta à direita, sem navegar.
- `ActionBar` deixa de ser fixa e volta ao fluxo.

**Fica de fora se o tempo apertar** — é a única fase que não melhora a experiência no celular,
que é onde o produto realmente vive.

---

## 6 · Componentes novos

| Componente | Papel | Detalhe que não pode faltar |
|---|---|---|
| `segmented.tsx` | Navegação entre camadas da ficha | `role="tablist"`, setas do teclado, indicador animado com `--ease-ios` |
| `scroll-rail.tsx` | Trilho horizontal padrão | Máscara nas pontas, sangria até a borda, `scroll-snap` opcional |
| `page-transition.tsx` | Continuidade de rota | Respeita `prefers-reduced-motion`; aplicado no layout, não por página |

---

## 7 · Verificação

Nenhuma fase fecha sem isto:

- [ ] Varredura de alvos a 375px: **nenhum** elemento interativo abaixo de 44px
- [ ] Zero estouro horizontal em todas as telas
- [ ] Ficha do cliente abaixo de 900px na camada inicial
- [ ] As 27 telas admin com `loading.tsx`
- [ ] `prefers-reduced-motion` desliga toda transição nova
- [ ] Teclado: `Tab` alcança tudo; setas navegam o segmented
- [ ] Leitor de tela anuncia a troca de aba
- [ ] `pnpm verify` limpo
- [ ] Testado ao vivo em `dom-rocha`, com dado real, não vitrine

---

## 8 · Fora de escopo — deliberadamente

- **Reverter mobile-first.** O produto é usado em pé, com uma mão. A Fase E5 *acrescenta* ao
  desktop, nunca tira do celular.
- **Trocar a paleta.** A Parte II decidiu, com medição, que o acento é luz e não matiz. Está
  fechado.
- **Biblioteca de componentes de terceiro.** O sistema atual é enxuto e do tamanho do problema.
- **Modo claro.** Ninguém pediu, e o tema escuro é a identidade do produto, não uma variante.
- **Animação decorativa.** Movimento aqui existe para comunicar hierarquia. Movimento que só
  enfeita é a marca mais reconhecível de interface gerada — e a Parte II passou 29 itens
  removendo exatamente isso.

---

## 9 · Ordem sugerida

```
E0 (30min) → E1 (3h) → E3 (1h30) → E4 (40min) → E2 (2h) → E5 (2h, opcional)
```

E0 primeiro porque é dívida de segurança de toque. E1 em seguida porque é, sozinha, o maior
ganho do documento inteiro. E5 por último porque é a única que não melhora o celular.
