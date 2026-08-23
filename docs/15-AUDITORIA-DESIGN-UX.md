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

_(em preenchimento)_

