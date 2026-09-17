# 71 · PLANO DE AUDITORIA — COPY E INTERFACE

> Nos moldes do `docs/66-AUDITORIA-AMPLA-PLANO.md` e do `docs/67-PLANO-NOTURNO-AUTONOMO.md`, mas
> com o escopo estreitado para o que ainda não foi medido em copy/interface. As regras
> invioláveis do §1 do `docs/67` continuam valendo integralmente aqui — este documento não as
> repete, só as referencia.

---

## 0 · O que já está fechado (não repetir sem motivo novo)

| Frente | Onde já foi medido |
|---|---|
| Copy neutra de gênero em pt-BR | `copy-nao-supoe-genero.test.ts` (598 linhas), memória `copy-pt-br-nao-supoe-genero` |
| Alvo de toque (`toque-48`) | Vários lugares corrigidos; um caso onde o próprio conserto colidiu com outro elemento (`conserto-pode-ser-pior-que-o-defeito`) |
| Promessa de canal (WhatsApp/e-mail) | Agendamento público, orçamento — ambos já auditados e com guarda dedicada |
| Polimento de conversão | Paywalls, upgrade, telas que deixavam recusar no envio (`ciclo-polimento-conversao`) |
| Vocabulário por profissão — 1ª rodada | Item 1 desta sessão: "salão" vazando em `admin/estoque`, `custo-fixo/editor.tsx`, `privacidade/page.tsx` — corrigido, commit `48eb113` |

---

## 1 · Fases

### Fase A — Vocabulário por profissão (continuação do item 1)

`vocabulario.ts` troca só 6 palavras (`cliente`, `atendimento`, `profissional`, `serviço`,
`agenda`, `local`). Qualquer OUTRA palavra fixa que pressupõe uma profissão específica é
candidata. Já cobertos: "salão". Ainda não varridos sistematicamente:

- Palavras de beleza fora de "salão": "corte", "cabelo", "barba" (já confirmado ausentes em JSX
  por grep nesta rodada — mas não checados em `alt=`, `title=`, `placeholder=`, string de
  `Zod` (`.min(1, 'mensagem')`), nem em `mensagens-prontas.ts` (modelos padrão de WhatsApp)).
- Palavras específicas de OUTRAS profissões que podem ter entrado em tela genérica ao copiar
  texto de um vertical pra outro (ex.: "aluno" fora do contexto de personal trainer, "sessão"
  fora de psicólogo).
- **Como medir:** grep por palavra fixa + comparação cruzada entre pacotes de vocabulário
  (`professions.vocab` no seed) — se uma tela usa uma palavra que SÓ aparece no pacote de uma
  profissão, é candidata a vazamento.

### Fase B — Estados de carregamento, vazio e erro

O checklist do `CLAUDE.md` exige os três em toda tela nova, mas telas ANTIGAS podem ter ficado
sem um dos três num ponto que mudou depois.

- Toda lista paginada/filtrada tem estado vazio com saída (não só "nada aqui")?
- Todo formulário tem mensagem de erro que diz O QUE FAZER, não só que deu errado?
- Toda tela com fetch assíncrono tem um estado de "carregando" visível (não uma tela branca por
  1-2s)?
- **Como medir:** navegador, no tenant de demonstração — forçar o estado vazio (filtro sem
  resultado) e o estado de erro (breaking a `fetch` de propósito, como já feito no auditoria de
  25/08) e CONFERIR NA TELA, não deduzir do código.

### Fase C — Foco de teclado e leitor de tela em fluxos ainda não auditados

Os fluxos públicos por token (confirmar, avaliar, lista de espera, orçamento) e o agendamento já
têm região viva e foco auditados. Ainda não auditados com o mesmo rigor:
- Fluxos do PAINEL que trocam conteúdo sem trocar de rota (filtros de lista, abas dentro de uma
  tela) — o mesmo defeito de `agendamento-anuncia-mudanca.test.ts` pode existir em
  `admin/clientes` (filtro), `admin/agenda` (troca de profissional/dia), `admin/estoque`
  (busca).
- Modal/sheet de ação (ex.: `DetalheAgendamento`) — o foco vai pro primeiro elemento focável ao
  abrir? Volta pro botão que abriu ao fechar?
- **Como medir:** navegador com `read_page` antes/depois da interação, e o padrão já
  estabelecido (`elementFromPoint`, sondagem de `aria-live`) — nunca deduzir do JSX que o foco
  "deveria" ir pra algum lugar.

### Fase D — Contraste de cor

Nunca medido nesta base (procurado e não encontrado em nenhuma auditoria anterior). Os tokens de
cor (`--txt-3`, `--line-2` etc.) foram escolhidos por olho, não por contraste calculado.

- **Como medir:** `javascript_tool` lendo `getComputedStyle` do texto e do fundo real (não do
  token no CSS — o token pode ser sobrescrito por acento do tenant), calculando a razão de
  contraste (fórmula WCAG, sem biblioteca — é aritmética simples) para as combinações mais
  usadas: `text-txt-3` sobre `bg-surface-2`, `text-txt-2` sobre `bg`, botão secundário.
- Atenção: a cor de destaque (`acc`/`acc2`) é escolha do DONO (`site.accent`) — o contraste do
  texto sobre ela pode falhar para alguns tenants e passar para outros. Medir com o acento
  padrão E com um acento de teste claro (ex.: amarelo), que é o pior caso plausível.

### Fase E — Rótulo de botão ambíguo / inconsistência entre telas irmãs

O item 1 desta rodada achou inconsistência comparando telas IRMÃS (4 telas de acesso negado, 3
delas com "negócio" e 1 com "salão"). O mesmo método vale para outras famílias de tela:
- As telas de "Bloqueio de plano" (`BloqueioPlano`) — o rótulo do botão/CTA é consistente entre
  `campanhas/nova`, `orcamentos`, `config/planos`, `estoque`?
- Os botões de confirmar exclusão — "Apagar", "Remover", "Excluir" usados à toa entre telas que
  fazem a mesma coisa?
- **Como medir:** grep por família de componente (`BloqueioPlano`, `EmptyState` com ação, botão
  de exclusão) e comparar o texto literal entre todos os usos — mesma técnica do item 1.

### Fase F — Mensagem de validação de formulário

- Todo `Zod` de formulário público (`EsquemaBookingPublico`, `EsquemaPedidoDeOrcamento`, etc.)
  tem mensagem que diz o que fazer, não só "campo inválido"?
- **Como medir:** ler os esquemas Zod de cada formulário público e do painel, listar toda
  mensagem sem `min(1, 'mensagem')`/`.refine` sem segundo argumento (Zod usa mensagem genérica
  em inglês nesses casos — grep por `z\.\w+\([^)]*\)(?!\s*,)` seguido de `.min(`/`.max(` sem
  segundo argumento é o sinal).

### Fase G — Animação sem custo medido

- `transition duration-[var(--dur-1)]` aparece em centenas de lugares — nenhum foi medido por
  `requestAnimationFrame`/DevTools para custo real (jank, repintura). Não é prioridade alta
  (nenhum indício de reclamação), mas cabe uma amostragem: medir 2-3 transições em elementos
  GRANDES (o card da vitrine, o painel "Hoje" inteiro) no navegador, ver se caem sob 16ms/frame.

---

## 2 · Prioridade

Segurança/dinheiro sempre primeiro se algo aparecer no caminho (regra do `docs/67`). Dentro deste
plano: **A (vocabulário) → B (estados) → E (inconsistência entre telas irmãs) → C (foco/leitor
de tela) → F (validação) → D (contraste) → G (animação)** — nessa ordem, porque A/B/E são onde já
apareceu achado real nesta sessão e nas anteriores; C/F/D/G são hipóteses ainda não confirmadas
por medição.

## 3 · Prompt pronto para `/loop`

```
continua investigando e consertando o CICLO sozinho, seguindo docs/67-PLANO-NOTURNO-AUTONOMO.md
à risca e docs/71-PLANO-AUDITORIA-COPY-INTERFACE.md como roteiro — foco em copy e interface.
Segue as fases do docs/71 na ordem A→B→E→C→F→D→G, mas troca de fase se uma esgotar sem achado em
2-3 rodadas. Medir de verdade (navegador, não suposição) antes de qualquer conserto. Se um
achado tocar em código relacionado a dinheiro/comissão/lucro ou dado de saúde, ou colidir com
guarda de segurança existente, redobra o cuidado (reler docstring, traçar a propriedade, mutar
antes de confiar). Corrige achado de baixo risco na hora com pnpm verify passando; registra o
resto em docs/DECISOES.md. Pausa de no máximo 1 minuto entre iterações. Ao parar (todas as fases
esgotadas, achado que precisa do Eduardo, ou fim do orçamento), escreve um relatório final.
```

## 4 · Quando parar

Mesmo critério do `docs/67` §10: lista esgotada, achado crítico sem resolver, ou consecutivas
rodadas sem achado novo em nenhuma fase ainda aberta. Escrever relatório final no próximo número
livre de `docs/` (`docs/7X-RELATORIO-LOOP-COPY-INTERFACE.md`) com o mesmo formato dos relatórios
anteriores (placar, achados reais, achados registrados-e-não-corrigidos, o que precisa do
Eduardo, por que parou).
