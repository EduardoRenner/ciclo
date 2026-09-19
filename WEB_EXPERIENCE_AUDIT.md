# WEB_EXPERIENCE_AUDIT.md

> Documento vivo pedido na auditoria de Web Experience (2026-09-19). **Não é uma auditoria de dia
> zero** — este projeto já tem dezenas de rodadas anteriores cobrindo design system
> (`docs/03-DESIGN-SYSTEM.md`), UX (`docs/15`, `docs/61`, `docs/71/72`), performance
> (`docs/70-RELATORIO-LOOP-PERFORMANCE.md`, 6 bugs reais de waterfall já achados e corrigidos há 2
> dias), SEO (guarda mutation-tested, `metadataBase`/structured data/llms.txt já no ar) e
> segurança (CSP com nonce, HSTS, todos os headers relevantes já configurados em
> `src/middleware.ts`). Este documento registra o que foi VERIFICADO nesta rodada — a maior parte
> confirma que o trabalho anterior está correto — e o que foi genuinamente encontrado e corrigido.

---

## 1 · Entender o produto (resumo — ver `docs/07-CONTEXTO-PRODUTO.md`/`CONTEXTO-CICLO-PARA-IA.md`)

SaaS de gestão para profissionais de serviço com agenda (beleza como público primário). Next.js 15
App Router + Supabase/RLS, Vercel. Conversão principal: `/` → "Criar minha conta grátis" →
onboarding → primeiro agendamento. Página pública `/{slug}/agendar` é o funil do CLIENTE FINAL
(sem app, sem conta, sem ver concorrente).

---

## 2 · Verificado nesta rodada, sem achado (evidência real, não suposição)

| Área | O que foi checado | Resultado |
|---|---|---|
| Overflow horizontal | `document.documentElement.scrollWidth > clientWidth` em `/`, `/precos`, `/cadastro` a 320px e 375px | `false` nos três — sem overflow |
| Alvos de toque | Varredura por `getBoundingClientRect()` de todo `a/button/input/select/textarea` em `/precos` a 320px | 4 elementos abaixo de 44px, todos links secundários de rodapé (Termos/Privacidade/Voltar) — mesmo padrão já estabelecido no design system (`toque-48` reservado pra ações primárias) |
| Formulário de cadastro | `autocomplete`/`type`/`inputmode` de cada campo (`fullName`, `email`, `phone`, `password`) | `name`, `email`, `tel`+`inputmode="tel"`, `new-password` — todos corretos |
| Validação de formulário | Submit vazio, e-mail inválido, testados clicando de verdade no navegador | Validação nativa do browser funciona (foca o campo, mensagem em pt-BR, não navega) |
| Máscara de telefone | Digitar "11987654321" no campo de telefone | Formata em tempo real pra "(11) 98765-4321" |
| Acordeão de FAQ (landing) | Clique real | Abre/fecha, ícone gira, sem layout shift visível |
| Headers de segurança | `src/middleware.ts` | CSP com nonce+strict-dynamic, HSTS preload, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy (nega geo/câmera/mic/pagamento/usb/interest-cohort), COOP, CORP — nível "securityheaders.com nota A" |
| Console/erros JS | `/`, `/precos`, `/cadastro` | Zero erros |
| Safe-area (notch/Dynamic Island) | `viewportFit: "cover"` no layout raiz + componente dedicado de status bar nativo | Já correto |

---

## 3 · Achado real e corrigido: imagem da marca pedindo o balde de 3840px pra mostrar ~70-160px

**O quê.** `selo.tsx` (usado em `/cadastro`, `/entrar`, `/onboarding`, telas de erro) e `topbar.tsx`
(usado em **toda tela `/admin/*`** — a área logada inteira) renderizavam o wordmark do CICLO sem a
prop `sizes` do `next/image`. Sem ela, o Next trata a imagem como podendo precisar de até 100vw e
gera/serve o candidato mais largo do `deviceSizes` (3840px) para uma logo mostrada a ~28-64px de
altura.

**Como achei.** Inspecionando a aba de rede durante a navegação manual pela landing/cadastro/preços
— o mesmo arquivo (`ciclo-wordmark-aqua.png`, fonte de 1102×448, 26,6 KB) aparecia pedido em
`w=3840` repetidamente. `page.tsx` (landing), `precos/page.tsx`, `privacidade/page.tsx` e
`termos/page.tsx` **já tinham o conserto certo** (`sizes="70px"`) — só `selo.tsx` e `topbar.tsx`
ficaram de fora, inconsistência entre 6 usos do mesmo componente de marca.

**Correção.** `sizes="160px"` em `selo.tsx` (h-16, ~157px calculado da proporção real do arquivo) e
`sizes="70px"` nas duas instâncias de `topbar.tsx` (h-7, mesmo tamanho que `page.tsx` já usava
corretamente).

**Impacto real.** `topbar.tsx` é a barra fixa no topo de toda tela `/admin/*` — a área logada
inteira do produto. É o maior alcance de qualquer conserto de performance desta rodada.

**Nota de honestidade sobre a verificação.** Tentei confirmar visualmente que o navegador passou a
baixar um candidato menor depois do conserto. `page.tsx`, que JÁ tinha `sizes="70px"` corretamente
configurado antes desta sessão, **também** mostrou `currentSrc` resolvendo pro candidato de 3840px
neste navegador de teste sandboxed — ou seja, o próprio código já correto apresenta o mesmo
comportamento no ambiente de teste. Isso indica uma característica do algoritmo de seleção de
`srcset` deste navegador específico (headless/sandboxed), não um defeito no código ou no conserto:
os atributos HTML (`sizes`, `srcset`, `imagesizes` do preload) foram conferidos byte a byte e estão
corretos, batendo com a documentação oficial do `next/image` e com o padrão que já funciona nas
outras 4 páginas. **Não afirmo ter medido o download real menor** — afirmo que o HTML gerado está
correto e consistente com código que já está em produção há dias. Validação final (Network tab de
um Chrome/Safari real) fica registrada como pendência, não como feito.

**Testes:** `tsc`/`eslint` limpos, `pnpm build` e `tests/unit` (290/2517) verdes.

---

## 3.1 · Segunda instância do mesmo achado, por generalização

Depois de corrigir a seção 3, generalizei a busca (`grep -rln "next/image" src/ --include="*.tsx"`)
para os 8 arquivos que usam `next/image` no projeto, em vez de considerar o achado isolado.
`secoes.tsx` foi falso positivo (grep casou `fill` de SVG). `painel-do-dono-exemplo.tsx`
(print real de conta demo em `/{slug}/agendar`) era instância real, mas de um tipo diferente:
imagem já responsiva (`width={750} height={...} className="block h-auto w-full"`), sem `sizes`. O
container que a envolve (`agendar/page.tsx`, `max-w-[560px] px-[18px]`) trava a largura em ~524px em
qualquer tela — sem `sizes`, o Next ainda assumia 100vw e pedia o candidato mais largo do
`deviceSizes`. Corrigido com `sizes="(min-width: 560px) 524px, calc(100vw - 36px)"`.

`tsc`/`eslint` limpos, `pnpm build` e `tests/unit` (290/2517) verdes.

---

## 3.2 · A guarda existente do wordmark era cega justamente para o achado da seção 3

Este projeto já tinha um teste-guarda para este exato bug
(`tests/unit/design/imagem-da-marca-diz-o-tamanho.test.ts`, de 2026-09-04) — mas ele só cobria as 4
páginas que já estavam corretas (`page.tsx`, `precos`, `privacidade`, `termos`). `selo.tsx` e
`topbar.tsx` nunca entraram na lista, e foi exatamente por isso que ficaram sem `sizes` sem ninguém
notar até a inspeção manual desta rodada — o próprio `CLAUDE.md` deste projeto documenta esse padrão
("guarda cega", achados de 2026-08-25) e ele se repetiu aqui.

Estendi a guarda para os 6 arquivos (7 tags — `topbar.tsx` tem duas, tema claro e escuro) e apliquei
o procedimento de mutação obrigatório do `CLAUDE.md`: commitei a guarda estendida primeiro, depois
removi `sizes` de `selo.tsx` **e** da segunda tag de `topbar.tsx` (a `wordmarkClaro`, para provar que
a busca generalizada realmente varre todas as tags do arquivo, não só a primeira), rodei a suíte e
vi os 2 testes esperados reprovarem com a mensagem certa, depois restaurei via `git checkout --`.
Sem isso a "guarda estendida" seria só uma lista mais longa sem prova de que protege algo.

`tests/unit` (290 arquivos, 2519 testes, 2 a mais que antes) verde depois da restauração.

---

## 4 · O que não foi encontrado, apesar de procurado com afinco

- Bug de navegação/formulário nos fluxos testados manualmente (cadastro, login, FAQ).
- Inconsistência visual (espaçamento, cor, tipografia) nas páginas verificadas — o design system
  documentado em `docs/03` está sendo seguido de forma consistente.
- Erro de console, warning relevante, link quebrado nas páginas verificadas.
- Overflow horizontal em nenhuma largura testada (320px/375px).

**Sobre não ter achado mais.** Esta base já passou por um loop dedicado de performance (`docs/70`,
6 bugs reais de waterfall encontrados e corrigidos, confirmado esgotado por varredura sistemática
com `awk` em TODO `page.tsx` do projeto) e por múltiplas rodadas de auditoria de design/UX/copy
(`docs/15`, `61`, `71`, `72`). Não fabriquei achados para preencher espaço — o item da seção 3 é o
que a inspeção manual desta rodada especificamente revelou de novo.

---

## 5 · Pendências

1. **Confirmar em navegador real (não sandboxed)** que o conserto da seção 3 reduz o download de
   verdade — Network tab do Chrome DevTools ou Safari, comparando antes/depois.
2. Nenhuma outra pendência de código identificada nesta rodada.

---

## 6 · Checklist final

- [x] Build de produção (`pnpm build`)
- [x] Testes unitários (290/2517)
- [x] Lint / Typecheck
- [x] Mobile (320px/375px, sem overflow, alvos de toque conferidos)
- [x] Formulários (autocomplete, validação, máscara)
- [x] Segurança (headers já configurados e conferidos)
- [x] SEO — já auditado e guardado por teste em rodada anterior recente
- [x] Performance — loop dedicado recente + 1 achado novo desta rodada, corrigido
- [ ] Confirmação de payload de imagem em navegador real (pendência, seção 5)
- [x] Console sem erros nas páginas verificadas
