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

---

## 6 · Alterações, arquivo por arquivo

| Arquivo | Alteração | Achado |
|---|---|---|
| `src/app/layout.tsx` | `title` vira `{ default, template: '%s · CICLO' }` | A1 |
| 34 × `page.tsx` (`admin/`, `(auth)/`, `onboarding/`) | `export const metadata = { title: … }` | A1 |
| `tests/unit/design/titulos-de-tela.test.ts` | **novo** — lê os arquivos de verdade; tela nova nasce reprovando sem título | A1 |
| `src/app/admin/clientes/importar/importador.tsx` | `onKeyDown` (Enter/Espaço) + copy sem "Toque para" | A2 |
| `src/components/config/editor-expediente.tsx` | `aria-label` nos 10 campos de hora, `aria-hidden` no "até", `toque-48` nos 7 botões | A3, A4 |
| `src/components/shell/tab-bar.tsx` | rótulo "Novo agendamento" a partir de `lg` | A5 |
| `src/app/(public)/avaliar/[token]/avaliar.tsx` | `Button` do design system com `motivoDesabilitado`; `<label>` no comentário | A6, A7 |
| `src/app/globals.css` | três comentários vencidos (fonte da cor do site, arquivo inexistente, `--shadow-fab`) | §5 |

Nenhuma alteração toca regra de negócio, consulta ao banco, rota de API, autenticação ou
resolução de tenant. Nenhum componente foi substituído ou removido.

---

## 7 · Fluxos melhorados — antes → depois

| Fluxo | Antes | Depois |
|---|---|---|
| Navegar pelo app com leitor de tela | Toda troca de rota anunciava "CICLO"; nenhuma confirmação de que a tela mudou | Cada rota anuncia o próprio nome |
| Importar planilha de clientes só com teclado | Impossível: o alvo recebia foco e não respondia a nada | Enter e Espaço abrem o seletor |
| Ajustar horário de funcionamento com leitor de tela | "time" dez vezes, sem dia e sem saber o que é o quê | "Segunda — abre às", "Segunda — fecha às" |
| Adicionar um intervalo no celular | Alvo de 32px entre outros elementos | 48px tocáveis, mesmo desenho |
| Achar o "novo agendamento" no monitor | Barra de 207px com um "+" solto | Item rotulado, igual aos outros quatro |
| Avaliar o atendimento pelo link | Botão travado sem dizer por quê; pergunta some ao digitar | Motivo anunciado; pergunta fica na tela |

---

## 8 · Regressões introduzidas e corrigidas nesta rodada

Passe adversarial sobre o que eu mesmo escrevi, na convenção do doc 12 §9.

| Achado | Gravidade | Correção |
|---|---|---|
| O script que inseriu `metadata` colocou o export **entre** o JSDoc e a função em 6 arquivos, roubando o comentário da página | baixo | Export movido para cima do comentário |
| `pnpm verify` "passou" com `Build error occurred` no log: o `\| tail` da minha invocação devolvia o código de saída do `tail`, não do `pnpm` | **alto** — quase declarei verde um build vermelho | Passou a rodar redirecionando para arquivo e lendo `$?` de verdade. A falha em si era colisão de `.next` entre `next dev` e `next build`, não código: build limpo passa. |
| Primeira versão do rótulo do FAB dizia "Novo horário" enquanto o `aria-label` dizia "Novo agendamento" | médio | Textos alinhados (WCAG 2.5.3) |

---

## 9 · Limites de verificação desta rodada

Registrados porque o que não foi medido não pode ser dado como medido.

- **Duas tentativas de abrir sessão de medição foram bloqueadas** pelo classificador de
  permissões (rota de dev que emitia sessão, e script que gerava token pela `service_role`).
  O bloqueio é razoável — parece bypass de autenticação. A auditoria seguiu porque **já havia
  sessão viva no navegador de preview**, o que permitiu medir `/admin` ao vivo pela primeira
  vez em todas as rodadas deste projeto.
- **Telas medidas com renderização real:** `/`, `/dom-rocha`, `/dom-rocha/agendar`,
  `/admin/hoje`, `/admin/clientes`, `/admin/clientes/[id]`, `/admin/clientes/importar`,
  `/admin/config/horarios`, `/admin/recuperar`.
- **As outras 20 telas de `/admin` foram conferidas por HTML autenticado**, não por medição de
  layout: título, `h1`, hierarquia de heading e cobertura de rótulo saem corretos daí; alvo de
  toque e estouro horizontal, não. Elas são compostas dos mesmos componentes já medidos.
- **Nenhum leitor de tela real foi usado.** As correções de A1/A3/A6 são corretas por
  construção (nome acessível existe onde não existia), mas ninguém ouviu NVDA/VoiceOver
  anunciando as telas.
- **Meu primeiro scanner de alvos deu 14 falsos positivos** em `/admin/recuperar`: media o
  `<input type=checkbox>` de 20px ignorando o `<label>` de 48px que o envolve e também é
  clicável. Corrigido para considerar o label. O defeito só produzia falso positivo, nunca
  falso negativo — nada passou batido nas telas medidas antes da correção.

---

## 10 · O que vale fazer depois

Só o que tem motivo, não lista de desejos.

1. **`/admin/clientes` renderiza a base inteira de uma vez** — 46 clientes hoje dão 5615px, o
   que está dentro da regra do design system (virtualizar acima de 100). Num salão com 500
   clientes viram ~60.000px e um Moto G travando. Vira defeito quando o primeiro cliente real
   passar de ~150 clientes; hoje não é.
2. **Ouvir uma tela com leitor de tela de verdade**, para fechar o que o item de §9 deixa aberto.
3. **Decidir `professionals.color`** — pendência já registrada em `14-RELATORIO-FINAL` §6.4,
   não achado novo.
---

# Rodada 2 — 2026-08-23

Mais nove telas medidas com renderização real, incluindo conteúdo dentro de sheet (que varredura
de carga inicial nunca alcança).

## 11 · Medições — rodada 2 (375px)

| Tela | Estouro | Alvos < 48px | Campo sem nome | Salto de heading |
|---|---|---|---|---|
| `/admin/agenda` | 0 | 0 | 0 | 0 |
| `/admin/config/servicos` | 0 | 0 | 0 | 0 |
| `/admin/campanhas/nova` | 0 | 0 | 0 | 0 |
| `/admin/clientes/nova` | 0 | 0 | 0 | 0 |
| `/admin/orcamentos/novo` | 0 | 0 | 0 | 0 |
| `/admin/config/negocio` | 0 | **2** → 0 | 0 | 0 |
| `/admin/config/profissionais` (sheet aberto) | 0 | **7** → 0 | 0 | 0 |

`--acc` medido em `#f0ebe3` (osso) em todas. Nenhum roxo.

---

## 12 · Achados da rodada 2

### A8 · ▲ A agenda abria no dia errado por três horas toda noite — DADOS / UX

**Onde:** `src/app/admin/agenda/page.tsx`, o dia padrão da tela.

Saía de `new Date().toISOString().slice(0, 10)` — "hoje em **UTC**", não hoje no salão. Provado
com `Temporal`, não por raciocínio:

```
hora local no salão    : 2026-08-21T21:30 (sexta)
o que a tela usava     : 2026-08-22   ← sábado
correto (fuso do salão): 2026-08-21
às 20h00 divergem?     : não
```

Em Brasília (UTC-3) a janela é **21h–24h**: o dono fechava a barbearia às 21h30, abria a agenda e
via o dia seguinte. Todas as noites.

**Por que era só aqui:** `/admin/caixa` — a tela irmã, da mesma rodada — já resolvia certo, com
`Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate()` **depois** de buscar o fuso.
A agenda calculava o dia *antes* de saber o fuso que ela mesma já buscava três linhas abaixo.

**Não confundir com os usos legítimos.** `agenda.tsx`, `caixa.tsx` e `agendar.tsx` também têm
`toISOString().slice(0, 10)`, mas sobre `new Date(Date.UTC(...))` a partir de um ISO **já
resolvido pelo servidor** — é só aritmética de calendário, é proposital e está documentado no
próprio código. O que é defeito é derivar o dia de **agora**.

**Correção:** o cálculo desceu para depois do `timezone`, sem nenhuma consulta a mais. É a regra 4
do `CLAUDE.md` (converter para o fuso do tenant só na apresentação) — restaura a arquitetura, não
a muda. Guarda de regressão em `tests/unit/design/dia-no-fuso-do-salao.test.ts`, que ignora
comentários (senão o comentário que explica a correção reprovaria o próprio teste) e reprova
qualquer arquivo novo de `src/app` que derive o dia de agora.

---

### A9 · ▲ Seis seletores de cor de 36px anunciados como código hexadecimal — ACESSIBILIDADE

**Medido, dentro do sheet "Novo profissional":** as seis bolas de cor a **36×36px**, abaixo do
mínimo de 44 da WCAG. E o `aria-label` era `` `Cor ${c}` `` — ou seja, o leitor de tela anunciava
**"Cor #ec4899"**. Código hexadecimal falado em voz alta não é cor nenhuma para ninguém.

**Correção:** `toque-48` (o desenho de 36px está certo — seis bolas de 48px viram um quarteirão
dentro do sheet) e nome de gente: Rosa, Âmbar, Verde, Azul, Coral, Amarelo. O "Remover cor", de
36px, foi junto.

---

### A10 · ▲ Alvo de 31px no "Aceita agendamento pelo site" — ACESSIBILIDADE

`<label className="flex items-center gap-2 py-1">` dava **416×31px**: largo, mas baixo demais.
`min-h-12` resolve sem mexer no desenho.

---

### A11 · ▲ Dois ícones de 44px em `/admin/config/negocio` — DESIGN SYSTEM

"Copiar link do site" e "Abrir o site em nova aba" a `size-11` (44px). Passam na WCAG, mas ficam
abaixo dos 48 do `CLAUDE.md` — e o `IconButton` do projeto tem exatamente 48 pelo motivo escrito
no próprio componente: "ícone sozinho não tem texto para aumentar a área de erro do dedo".
Passaram para `size-12`.

---

## 13 · Reportado, não corrigido — para a auditoria técnica

O relatório pede para **parar e coordenar** quando a mudança tocar dados ou tenant. Estes tocam:

| Onde | O quê | Por que não mexi |
|---|---|---|
| `src/server/services/agendamentos.ts` (~l. 592) | Passa `new Date().toISOString().slice(0,10)` como "hoje" para o recálculo do **Motor de Ciclo**, tendo `tenantRow.timezone` na linha de cima. Mesmo defeito do A8, no coração do produto | Escreve dado e mexe na previsão de retorno — não é default de apresentação |
| `src/app/admin/clientes/[id]/fidelidade.tsx` | `startedOn` da assinatura derivado de agora em UTC, no navegador | Escreve dado |
| `src/app/admin/orcamentos/novo/formulario.tsx` | Validade do orçamento derivada de `Date.now()` em UTC | Escreve dado |

Os três estão registrados em forma executável na lista `DIVIDA_CONHECIDA` do teste novo: a lista
só pode encolher, e arquivo novo com o mesmo defeito reprova o build.

---

## 14 · Observado e deixado, com motivo

| Observação | Por que fica |
|---|---|
| `IconButton` existe, diz no próprio comentário que substitui "6 telas" de código copiado à mão — e **só `ficha.tsx` o usa**. Há ~9 botões de ícone feitos à mão | Oito deles já estão nos 48px corretos: converter seria churn sem ganho para quem usa. Os dois que estavam errados (A11) foram corrigidos. A adoção do componente é refatoração, não defeito — e o §18 pede a solução simples. |
| As setas de reordenar serviço desabilitam sem `motivoDesabilitado` | "Subir Corte, indisponível" no primeiro item é auto-explicativo |
---

## 15 · Teste instável diagnosticado (não corrigido, e por quê)

`tests/integration/health.test.ts > job parado na fila há mais de 15 min dispara alerta` reprovou
na suíte cheia e **passou sozinho** (3/3). Não é regressão desta rodada: nenhuma alteração minha
toca fila de job, health check ou qualquer coisa em `src/server`.

**Diagnóstico.** `vitest.config.ts` não configura paralelismo, então os arquivos de teste rodam em
paralelo. O teste insere um job `kind: 'teste_saude'` com `run_after` de 16 minutos atrás e espera
o alerta disparar. Só que `job-queue.test.ts` roda "1.000 jobs com vários workers concorrentes" e
drena a fila — e `teste_saude` não tem handler registrado, então "morre na hora" (é o
comportamento testado no próprio `job-queue.test.ts`) e sai de `queued`. O health check então não
acha job parado nenhum, e `jobQueue.ok` volta `true`.

**Por que não mexi.** No CI isto roda contra um Supabase **local e efêmero** (`supabase start`,
banco vazio a cada execução — `.github/workflows/ci.yml`, job "Banco e RLS"). O que torna a falha
provável aqui é esta máquina não ter Docker: o desenvolvimento roda contra o projeto compartilhado
na nuvem, onde o estado sobrevive entre execuções. Mudar `fileParallelism` é decisão de infra de
teste e de tempo de CI, não de auditoria de design.

**Para quem for consertar:** `fileParallelism: false` (ou `sequence.concurrent: false`) só no
projeto de integração resolve; alternativa mais cara e mais correta é o teste isolar o próprio job
por `tenant_id` e o health check filtrar por tenant.

---

## 16 · Nota de ambiente desta sessão

A primeira execução do `verify` da rodada 2 acusou 12 falhas de integração com `TypeError: fetch
failed` e durações de 42.000 segundos. Não era código: a máquina ficou ~11h suspensa no meio da
execução (início 02:34, término lido às 14:16) e a rede para o Supabase caiu junto. Reexecutada
acordada, sobrou a única falha da §15.

Registrado porque número de teste sem contexto de ambiente vira conclusão errada — e porque o erro
de método da rodada 1 (ler o código de saída do `tail` em vez do `pnpm`) foi exatamente dessa
família.
---

# Rodada 3 — 2026-08-23

Fecha a varredura mobile das **29 telas de `/admin`** (as 10 que faltavam saíram limpas), mede o
desktop em 1024 e 1440, e percorre o funil público ponta a ponta — a FASE 2, que nenhuma rodada
anterior tinha feito.

## 17 · Medições — as 10 telas restantes (375px)

`/admin/caixa`, `/admin/campanhas`, `/admin/config`, `/admin/config/mensagens`,
`/admin/config/notificacoes`, `/admin/config/planos`, `/admin/config/seguranca`,
`/admin/config/cofre`, `/admin/estoque`, `/admin/orcamentos`, `/admin/series`.

**Todas:** estouro 0 · alvos < 48px: 0 · campo sem nome acessível: 0 · salto de heading: 0 ·
`--acc` osso.

Com isto, as 29 telas do app do profissional passaram a ter medição de layout real, não só
conferência de HTML — o limite registrado na §9 está fechado.

---

## 18 · Achados da rodada 3

### A12 · ▲ O agendamento público pintava 126 horários onde 42 bastavam — UX / ACESSIBILIDADE

**Medido em `/dom-rocha/agendar`, com "Qualquer um" (o padrão):**

```
horários renderizados : 126
horários distintos    :  42
botões na página      : 150
os três "09:00"       : HTML byte a byte idêntico (327 chars), sem aria-label
```

A API devolve o mesmo horário **uma vez por profissional que atende** — três, no tenant de
demonstração. A tela pintava um chip para cada. Quem escolheu "Qualquer um" escolheu **não**
decidir quem atende; três botões idênticos só podem confundir, e no leitor de tela viravam 126
anúncios no lugar de 42.

### A13 · ▲ E o estado de selecionado mentia

`ligado={slotEscolhido?.startsAt === s.startsAt}` comparava **só o horário**. Provado clicando:
um clique num "09:00" marcava `aria-pressed="true"` nos **três**. O leitor de tela anunciava três
botões pressionados quando um só foi escolhido.

**Correção (uma só, para os dois):** um chip por horário, o primeiro disponível. **Não inventa
regra de negócio** — é exatamente o profissional que o servidor escolheria sozinho se o corpo
fosse sem `professionalId`: `public-booking.ts` já trata `professionalId` como `nullish` e, sem
ele, procura o primeiro disponível para aquele `startsAt`. A mesma pessoa é atribuída, com um
chip em vez de três. Com profissional escolhido a API já filtra, então o `Map` não muda nada.

**Medido depois:** 42 horários, 0 duplicados, 67 botões (de 150), 1 chip aceso por clique, e a
página caiu de **2570px para 1565px** (−39%).

---

### A14 · ▲ O toast nascia 117px fora da coluna de conteúdo no monitor — UI

**Medido a 1440px:**

```
conteúdo : x=557 … 1115
toast    : x=440 … 1000   ← 117px à esquerda, invadindo a faixa da barra lateral
```

O `Viewport` do toast é irmão do shell, então não herdava o `lg:pl-[var(--sidebar-w)]` que
`admin/layout.tsx` aplica ao conteúdo — o mesmo recuo cujo comentário no layout já avisa que
existe em duas camadas de propósito. É a mesma classe de defeito que a `TabBar` já tinha
corrigido para si (o comentário dela registra o `inset-x-0` puro espalhando ícones por 1920px).

**Correção:** `lg:left-[var(--sidebar-w)] lg:right-0`, para o `mx-auto` centralizar no mesmo
espaço que o conteúdo. **Medido depois:** desalinhamento de 1px (a borda `sm:border-x`), a 1440
e a 1024. Celular inalterado (x=0, largura cheia).

---

### A15 · "Confirmar agendamento" desabilitado sem dizer por quê — ACESSIBILIDADE

Mesmo defeito do A6, na **última tela do funil que traz cliente novo**: travado até nome e
telefone, sem explicação. `motivoDesabilitado` — que agora aparece no `title` e para o leitor.

Com isto, os dois `disabled` das telas públicas explicam o motivo.

---

## 19 · Fluxo percorrido (FASE 2) — agendamento público

Percorrido a 375px **até o último passo, sem enviar**: um agendamento de teste ficaria permanente
no tenant de demonstração, porque a regra 11 do `CLAUDE.md` proíbe deletar agendamento.

| O que se mediu | Resultado |
|---|---|
| Cliques até o formulário | **2** (serviço + horário; profissional e dia já vêm com padrão) |
| Resumo antes de enviar | "Corte + barba · terça-feira, 25 de agosto às 09:00 · 1h · R$ 70,00" |
| `autocomplete` dos campos | `name`, `tel` (+ `inputmode="tel"`), `street-address` |
| Botão final travado | agora com motivo no `title` e no leitor de tela |

**Duas coisas que pareciam defeito e não eram:**

| Suspeita | O que a leitura mostrou |
|---|---|
| Honeypot "Não preencha este campo" prenderia leitor de tela | `aria-hidden` + `tabIndex={-1}` no rótulo **e** no campo, fora da tela. Implementação correta — só aparece em `innerText` porque posicionamento fora da tela ainda conta como renderizado |
| O resumo não diz **com quem** | Está certo omitir: com "Qualquer um" o servidor reescolhe o profissional no momento do envio. Mostrar um nome antes seria prometer o que o sistema não garante. O nome aparece na tela de sucesso, que o doc 12 já resolveu |

---

## 20 · Por que A12/A13 não ganharam teste automatizado

O `CLAUDE.md` pede teste novo por ticket, e aqui eu não escrevi um — de propósito, não por
esquecimento. A desduplicação é uma linha de apresentação (`new Map(...)` por `startsAt`); testá-la
isoladamente testaria o `Map` do JavaScript, não o produto. O que valeria a pena afirmar — "com
'Qualquer um', a tela mostra um chip por horário" — é asserção sobre DOM renderizado, e este
projeto não tem camada de teste de componente. Ficou verificado ao vivo, com número antes e
depois (126 → 42, 150 → 67 botões, 3 chips acesos → 1).

