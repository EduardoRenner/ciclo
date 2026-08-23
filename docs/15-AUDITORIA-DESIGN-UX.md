# 15 · AUDITORIA DE DESIGN / UI / UX — 2026-08-23

> Em andamento. Este documento é o caderno de bordo da rodada: cada achado entra aqui com a
> medição que o sustenta, e sai daqui para um ticket quando vira correção.
>
> **Não repete** `08-REDESIGN-E-IDENTIDADE.md` (I e II), `11-INTERFACE-ESTRUTURA-E-FLUXO.md` (III),
> `12-AUDITORIA-DE-PRODUTO.md` nem `13/14` (layout roxo). O que eles fecharam foi conferido como
> fechado.

---

## 1 · Método

Dev server em `:3015`, tenant de demonstração `dom-rocha`, viewport 375×812 e 1440×900.
Varredura instrumentada por tela, lendo do DOM: estouro horizontal, altura de todo alvo tocável
(descontando a extensão do utilitário `toque-48`), campo sem rótulo real, salto de hierarquia de
heading, e o valor de `--acc` em uso.

---

## 2 · Medições — telas públicas (375px)

| Tela | Estouro | Alvos < 44px | Campo sem rótulo | Salto de heading | `--acc` |
|---|---|---|---|---|---|
| `/` (landing) | 0 | 0 | 0 | 0 | osso |
| `/dom-rocha` | 0 | 0 | 0 | 0 | osso |
| `/dom-rocha/agendar` | 0 | 0 | 0 | 0 | osso |

Nenhum roxo em nenhuma superfície medida. A correção de 13/14 se sustenta.

---

## 3 · Suspeitas que caíram na medição

Registradas porque não inventar problema é parte do trabalho.

| Suspeita | O que a medição mostrou |
|---|---|
| `#a855f7` ainda no formulário de profissional | Está só num **comentário** explicando o que foi removido. A paleta não tem roxo. |
| Dois `<h1>` iguais em `/admin/hoje` | É o `<div hidden>` de streaming do próprio Next.js (`loading.tsx`). `hidden` tira da árvore de acessibilidade. Não é defeito. |

---

## 4 · Achados

Ordenados por gravidade. `▲` = medido ao vivo, não inferido.

### A1 · ▲ As 29 telas de `/admin` tinham o mesmo `<title>` — ACESSIBILIDADE

**Medido:** `document.title === "CICLO"` em **todas** as rotas autenticadas; nenhuma das 29
`page.tsx` de `/admin` (nem as 5 de `(auth)` nem `/onboarding`) exportava `metadata`.

Não é defeito de SEO — `/admin` nem é indexável. É que no App Router a navegação acontece no
cliente, e o `<title>` é **o que o leitor de tela anuncia quando a rota troca**. Com o mesmo texto
em todas, quem não enxerga não recebe confirmação nenhuma de que saiu do lugar (WCAG 2.4.2,
*Page Titled*). Instalado como PWA, é também o nome da janela e do item no alternador de apps, e
no histórico do navegador eram 29 entradas indistinguíveis.

**Correção:** `title: { default: 'CICLO', template: '%s · CICLO' }` no layout raiz + `metadata`
em 34 páginas. Rotas dinâmicas (`clientes/[id]`, `comanda/[id]`, `profissionais/[id]`) receberam
título estático de propósito: `generateMetadata` com o nome real custaria uma consulta a mais por
carregamento, e a regra de performance do projeto não paga isso por um título.

---

### A2 · ▲ O importador de clientes era inalcançável pelo teclado — ACESSIBILIDADE

**Medido, antes:** `focavel: true, enterAbre: false, espacoAbre: false, cliqueAbre: true`.

O seletor de arquivo é um `Card` com `role="button"` e `tabIndex={0}`, mas sem `onKeyDown`. Ele
recebia o foco e não fazia nada — e elemento que recebe foco e não responde é pior que elemento
não focável, porque parece quebrado. Importar planilha é a única porta de entrada em massa de
cliente no produto (WCAG 2.1.1, *Keyboard*).

Único caso do projeto: a varredura por `role="button"` achou esta ocorrência e mais nenhuma.

**Correção:** `onKeyDown` para Enter e Espaço, com `preventDefault` (senão o Espaço rola a
página). Copy de "Toque para escolher o arquivo CSV" para "Escolher o arquivo CSV" — CSV é tarefa
de quem está no computador com a planilha aberta, e "toque" era instrução de celular.

---

### A3 · ▲ Dez campos de horário sem rótulo — ACESSIBILIDADE

**Medido, antes:** 10 `<input type="time">` sem nome acessível em `/admin/config/horarios`.

O "até" entre os dois campos resolve para quem enxerga; o leitor de tela anunciava "time" dez
vezes seguidas, sem dizer o dia nem se era abertura ou fechamento (WCAG 4.1.2). O formulário de
folga, no **mesmo arquivo**, já usava `<label>` de verdade — a inconsistência era interna.

Atinge duas telas, porque `editor-expediente.tsx` é compartilhado com
`/admin/config/profissionais/[id]`.

**Correção:** `aria-label` com dia + abre/fecha (`"Segunda — abre às"`). O "até" virou
`aria-hidden`, que agora é redundância visual. **Medido depois:** 0 campos sem rótulo.

---

### A4 · ▲ Sete alvos de 32px no editor de expediente — ACESSIBILIDADE

**Medido, antes:** os sete botões "Adicionar intervalo" (um por dia) a **32×32px**, abaixo do
piso de 44px da WCAG e da regra de 48px do próprio `CLAUDE.md`.

É a mesma sobra que a Parte III achou em `fidelidade.tsx` (E2): componente escrito depois da
varredura de alvos, com `<button>` dimensionado à mão em vez de componente.

**Correção:** utilitário `toque-48`, que o projeto já tem exatamente para isto — estende a área
tocável sem engordar o desenho, que a 32px é o certo ao lado do nome do dia. **Medido depois:**
visual 32px, área tocável 48px, nenhum alvo abaixo de 48 na tela.

---

### A5 · ▲ A ação mais importante do produto era a única anônima no monitor — UI

**Medido, antes (1440px):** o FAB da coluna lateral com **207px de largura e só um "+"**
encostado na esquerda, enquanto os quatro destinos logo abaixo mostravam ícone + rótulo.

Não é preferência: o `lg:gap-2` já estava no código, esperando um rótulo que nunca foi escrito —
implementação inacabada, não decisão de design. E "marcar horário" é, pelo próprio comentário do
componente, "o gesto que sustenta o produto".

**Correção:** rótulo "Novo agendamento" a partir de `lg`, igual ao `aria-label` que já existia —
nome acessível e rótulo visível têm que bater (WCAG 2.5.3), senão comando de voz não alcança o
botão. No celular o FAB continua redondo e só com ícone: lá texto não cabe e o `aria-label` basta.
**Medido depois:** os cinco itens da coluna com 207px, alinhados, todos com rótulo.

---

### A6 · ▲ "Enviar avaliação" desabilitado sem dizer por quê — ACESSIBILIDADE / DESIGN SYSTEM

**Onde:** `/avaliar/[token]`, a página pública que o cliente abre pelo link da mensagem.

O botão ficava `disabled` enquanto a nota fosse 0. Para quem enxerga, as cinco estrelas logo
acima explicam sozinhas; no leitor de tela sai **"Enviar avaliação, indisponível"** e mais nada.
O `Button` do projeto tem `motivoDesabilitado` exatamente para isso (§4: "nunca desabilita sem
explicar o motivo") — mas esta tela usava um `<button>` cru, fora do design system, com o
carregamento escrito à mão (`'Enviando…'`) em vez do spinner do componente.

Não é o caso de todo `disabled` do app: `campanhas/nova` já explica por `title` + texto na linha,
e `estoque/lista` já usa `motivoDesabilitado`. As setas de reordenar serviço ficam como estão —
"Subir Corte, indisponível" no primeiro item é auto-explicativo, e trocar por trocar seria
mudança sem ganho.

**Correção:** passou a usar `Button` com `motivoDesabilitado` e `carregando`.

---

### A7 · Placeholder como único rótulo — ACESSIBILIDADE

**Onde:** o campo de comentário da mesma tela de avaliação.

`placeholder="Quer contar mais alguma coisa? (opcional)"` sem `<label>` nenhum. O §7 do design
system proíbe em uma linha: "formulário com `<label>` de verdade, não placeholder como rótulo".
Placeholder some no primeiro caractere — quem digitou perde a pergunta de vista, e o leitor de
tela anuncia só "caixa de texto".

Escapou das varreduras anteriores porque o campo **só existe depois de escolher uma estrela**:
varredura de carga inicial não o encontra.

**Correção:** `<label>` de verdade com a pergunta; o placeholder virou só "Opcional".

---

## 5 · Observações que não viraram correção

| Observação | Por que fica |
|---|---|
| `/admin/clientes` renderiza os 46 clientes de uma vez (5615px, sem paginação) | Dentro da regra do design system (virtualizar acima de 100). Vira problema real num salão com 500 clientes — é item de roadmap, não defeito de hoje. |
| `professionals.color` só é lido no próprio formulário que o define | Já registrado em `14-RELATORIO-FINAL` §6.4 como decisão de escopo consciente, não esquecimento. |
| Comentário de `--acc` em `globals.css` ainda cita `vertical_packs.accent_color` como fonte da cor | Documentação desatualizada dentro do código — mesma classe de armadilha que causou o roxo (doc 13 T3). Corrigido nesta rodada. |

