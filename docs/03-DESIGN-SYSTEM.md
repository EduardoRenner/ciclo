# 03 · DESIGN SYSTEM

Referência visual viva: `ciclo-prototipo-mobile.html` (o protótipo clicável). Quando este documento e o protótipo divergirem, **o protótipo manda** na aparência e este documento manda na regra.

---

### 1. Tokens

```css
:root {
  /* superfícies (tema escuro = padrão) */
  --bg:        #0a0a0f;
  --surface:   #131320;
  --surface-2: #1c1c2e;
  --surface-3: #26263d;
  --line:      rgba(255,255,255,.08);
  --line-2:    rgba(255,255,255,.14);

  /* texto */
  --txt:   #f2f2f7;   /* principal        contraste 16:1 */
  --txt-2: #a5a5b8;   /* secundário       contraste 7:1  */
  --txt-3: #6e6e85;   /* terciário/label  contraste 4,6:1 — nunca abaixo disso */

  /* acento: TROCA conforme o pack da vertical */
  --acc:      #a855f7;
  --acc-2:    #c084fc;
  --acc-soft: rgba(168,85,247,.16);

  /* semânticos (não mudam por vertical) */
  --ok:   #34d399;   /* confirmado, lucro, em dia */
  --warn: #fbbf24;   /* aguardando, atrasado leve */
  --risk: #fb923c;   /* em risco */
  --bad:  #f87171;   /* falta, perdido, alergia */
  --info: #60a5fa;

  --radius: 16px;
  --radius-sm: 12px;
  --radius-pill: 999px;
}
```

#### Acento por vertical

| Pack | `--acc` | `--acc-2` |
|---|---|---|
| Cílios | `#a855f7` | `#c084fc` |
| Unhas | `#ec4899` | `#f9a8d4` |
| Barbearia | `#f59e0b` | `#fcd34d` |
| Sobrancelhas | `#8b5cf6` | `#a78bfa` |
| Estética | `#10b981` | `#6ee7b7` |
| Depilação | `#f97316` | `#fdba74` |

O acento vem de `vertical_packs.accent_color` e é injetado como CSS custom property no `<html>` no servidor. **Nunca hardcode a cor de acento em componente.**

---

### 2. Tipografia

Uma família variável (Inter ou a do sistema). Escala:

| Uso | px | peso |
|---|---|---|
| Número grande (dinheiro em destaque) | 34 | 800 |
| Título de tela | 25 | 800 |
| Valor de stat | 21 | 800 |
| Corpo | 15 | 400/600 |
| Secundário | 13 | 400 |
| Label / caption | 11,5 | 600 |
| Overline (seção) | 11 | 600, `letter-spacing: .13em`, maiúsculas |

**Números monetários sempre com `font-variant-numeric: tabular-nums`** — sem isso a coluna de valores dança.

---

### 3. Regras de layout mobile

1. Conteúdo em `padding: 0 18px`.
2. Ação primária no **terço inferior** da tela ou em botão fixo acima da tab bar.
3. Tab bar de 82 px + `env(safe-area-inset-bottom)`. Conteúdo com `padding-bottom: 96px`.
4. Detalhe abre em **bottom sheet**, não em página nova — não perder o contexto da agenda.
5. Máximo 2 níveis de profundidade até qualquer tarefa.
6. Alvo de toque ≥ 48×48 px, espaçamento mínimo de 8 px entre alvos.
7. Nada de menu hambúrguer. Nada de tooltip (não existe hover no celular).
8. Ação destrutiva: `swipe` longo ou sheet de confirmação — nunca botão solto.

---

### 4. Componentes obrigatórios

| Componente | Regras |
|---|---|
| `Button` | variantes `primary` (gradiente do acento), `secondary`, `success`, `danger`; altura 48; estado de carregamento com spinner interno; nunca desabilita sem explicar o motivo |
| `Card` | `--surface`, borda `--line`, raio 16 |
| `Sheet` | bottom sheet com handle, fecha por swipe, trava scroll do fundo |
| `Chip` | filtro selecionável, altura 32, estado `on` usa `--acc-soft` |
| `StatTile` | label overline + valor grande + barra de progresso opcional |
| `Badge/Pill` | estado sempre com **cor + ícone/texto**, nunca só cor |
| `AppointmentRow` | barra lateral de 3 px colorida por status, horário à esquerda em tabular |
| `AlertBanner` | variantes `danger` (alergia), `warn`, `accent`; ícone + texto, 2 linhas no máximo |
| `EmptyState` | ilustração simples + frase + **botão de ação**. Nunca só "nenhum resultado" |
| `Skeleton` | para toda lista e card; nunca tela branca |
| `MoneyInput` | teclado numérico, formatação ao digitar, valor em centavos no estado |
| `PhoneInput` | máscara BR, valida DDD, guarda E.164 |
| `SignaturePad` | canvas, traço suave, botão limpar, exporta PNG |
| `BeforeAfter` | slider de comparação, carrega com signed URL |

---

### 5. Cores por estado (usar sempre as mesmas)

| Estado | Cor | Ícone |
|---|---|---|
| Confirmado / Em dia / Lucro | `--ok` | ✓ |
| Aguardando / Atrasado | `--warn` | ⏳ |
| Em risco | `--risk` | ⚠ |
| Faltou / Perdido / Alergia | `--bad` | ✕ / 🚨 |
| Sinal pago | `--info` | 🔒 |
| Motor de Ciclo | `--acc` | ✦ |

---

### 6. Voz da interface

- **Português direto, sem jargão.** "Cliente atrasada", não "churn risk". "Quanto sobrou", não "margem de contribuição".
- **Fale em reais, sempre.** Todo insight termina em dinheiro.
- **Erro explica o que fazer.** Ruim: "Erro ao salvar". Bom: "Esse horário acabou de ser reservado. Quer 15h ou 16h30?"
- **Sem exclamação em excesso.** Um "prontinho" basta.
- **Nada de culpar o usuário.** "Não consegui salvar", não "você preencheu errado".
- **Emoji com parcimônia:** só em estado (🚨 alergia, ✦ ciclo, 🎂 aniversário). Nunca em botão.

---

### 7. Acessibilidade (checado no CI com axe)

- Contraste mínimo 4,5:1 para texto, 3:1 para ícone significativo.
- Fonte respeita o tamanho do sistema (`rem`, nunca `px` fixo no corpo).
- Foco visível em todo elemento interativo.
- `aria-live="polite"` nos toasts, `aria-live="assertive"` em erro de pagamento.
- Formulário com `<label>` de verdade, não placeholder como rótulo.
- `prefers-reduced-motion` respeitado.

---

### 8. Performance de UI

| Regra | Por quê |
|---|---|
| Lista > 100 itens é virtualizada | Moto G trava |
| Imagem sempre com `width`/`height` e `next/image` | Evita layout shift |
| Nenhuma biblioteca de gráfico no bundle inicial | `dynamic(() => import(...), { ssr:false })` |
| Ícones importados um a um | Nada de `import * as Icons` |
| Fonte com `display: swap` e subset latin | |
| Bundle inicial < 180 KB gzip | Verificado no CI com `size-limit` |


---

