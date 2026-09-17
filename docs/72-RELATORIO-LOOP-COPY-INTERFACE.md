# 72 · RELATÓRIO DO LOOP FOCADO EM COPY E INTERFACE (2026-09-17)

> Pedido do Eduardo depois do loop de performance: "faz mais uma /loop mais focada em copy e
> interface". Seguiu o roteiro do `docs/71-PLANO-AUDITORIA-COPY-INTERFACE.md` (escrito nesta
> mesma rodada, a pedido dele), na ordem A→B→E→C→F→D→G.

---

## 1 · Placar

| | Quantidade |
|---|---|
| Bugs reais achados e corrigidos | 2 (4 arquivos de código + 1 guarda ampliada) |
| Achado significativo registrado, não corrigido | 1 (decisão de produto) |
| Fases do `docs/71` cobertas | 6 de 7 (A, B, C, D, E, F — G ficou de fora, já despriorizada no plano) |
| Falsos positivos descartados por medição | 2 |
| Commits | 6, todos com CI verde |

---

## 2 · Os 2 bugs reais corrigidos

1. **"salão" vazando pra profissão errada, em 4 lugares** (Fase A — vocabulário). `vocabulario.ts`
   só troca 6 palavras por profissão; "salão" fixo no texto é ilegítimo pra faxina, personal
   trainer, eletricista etc. Achado por comparação entre telas irmãs e por varredura de
   `src/server`: `admin/estoque` (texto de acesso negado — as 3 telas irmãs já diziam "negócio"),
   `custo-fixo/editor.tsx` (só no `aria-label` — quem usa leitor de tela ouvia errado enquanto o
   texto visível já estava certo), a mensagem de validação Zod do MESMO campo, e a política de
   privacidade pública (duas ocorrências, inconsistentes com 6+ outros lugares da mesma página).
2. **"todas" elíptico supondo gênero, escapando da guarda dedicada** (Fase E — telas irmãs).
   `admin/campanhas/page.tsx` dizia "...para todas de uma vez" enquanto a tela irmã
   (`campanhas/nova`) e o próprio docstring do componente `BloqueioPlano` já usavam a forma
   neutra ("todos"). Os 7 padrões de `copy-nao-supoe-genero.test.ts` exigem a palavra
   "cliente"/"amiga" perto do artigo — "todas de uma vez" é elíptico e nenhum cobria. Corrigida a
   copy (2 arquivos) E adicionado um 8º padrão à guarda, com autoteste provando que pega a frase
   real sem falso positivo em "todas as vezes" sobre coisa.

---

## 3 · O achado mais significativo: cor de acento sem piso de contraste

`tests/unit/design/contraste.test.ts` é rigoroso — mede WCAG AA nos dois temas, com Δ-luminância
pra daltonismo, pra TODO token fixo de `globals.css`. Mas ele só lê o CSS estático; nunca alcança
`--acc`/`--acc-2` na vitrine pública, que vêm de `tenants.settings.site.accent` — a ÚNICA cor do
produto escolhida livremente pelo dono, validada só por formato (`#rrggbb`), zero checagem de
contraste.

Medido com a MESMA fórmula WCAG do teste existente: 5 cores "profissionais" plausíveis (azul-
marinho, vinho, verde-escuro, grafite, azul-oceano — nenhuma extrema) ficam TODAS abaixo do piso
de 4,5:1 no preço do serviço e na estrela de avaliação da vitrine pública; o ícone de check
(`--acc` puro) fica na faixa de 1,3-1,7:1, praticamente invisível.

Não corrigido de propósito: é decisão de produto (quanto clarear antes de deixar de parecer "a
cor que o dono escolheu"?), o blast radius é a página pública de TODO tenant, e não existe teste
nenhum pra esse caminho — mereceria o mesmo cuidado de uma guarda nova, não uma correção de 1
minuto. Recomendação registrada em `docs/DECISOES.md`: fator de mistura ADAPTATIVO em vez de
fixo (clarear até bater 4,5:1, com teto de segurança), que não muda nada pra quem já escolheu
cor clara — só ativa pro caso quebrado.

---

## 4 · Dois falsos positivos descartados por medição — vale registrar o método

1. **`ErroPublico` sem link de WhatsApp no erro de token inválido.** Pareceu uma promessa vazia
   ("chame pelo WhatsApp" sem botão), mas o próprio código já explica: sem token válido não há
   como saber o WhatsApp de qual negócio, e um link pra lugar nenhum é pior que a frase. Decisão
   já documentada, não é achado.
2. **Aria-live "silencioso" ao trocar de profissional no agendamento público.** A leitura ingênua
   (ler o texto antes/depois) mostrou o MESMO texto final, porque a contagem de horários
   coincidiu. Um `MutationObserver` armado antes do clique capturou DUAS mutações reais
   ("Buscando horários." → "4 horários livres...") — um leitor de tela real ouviria as duas. Não
   é silêncio; é o mesmo padrão de "medição ingênua dá falso positivo" já catalogado nesta base.

---

## 5 · O que foi verificado sem achado

- **Fase B (estados de erro):** dois estados forçados de propósito no navegador (`/confirmar` e
  `/lista-espera` com token inválido) — ambos corretos, com `h1` único e mensagem clara.
- **Fase F (validação de formulário):** `public-booking.ts`, `pedido-de-orcamento.ts`,
  `lista-espera.ts` — todos os campos digitados por gente já têm mensagem custom que diz o que
  fazer; os `z.string()`/`z.uuid()` sem mensagem são campos internos (honeypot, token, chave),
  nunca alcançados por digitação real.
- **Modelos de mensagem pronta do WhatsApp** (`mensagens-prontas.ts`) — os 10 padrões já usam só
  placeholders e linguagem genérica, sem palavra de beleza fixa.

---

## 6 · Fase não coberta

**Fase G (custo de animação)** ficou de fora — já era a de menor prioridade no `docs/71` (nenhum
indício de reclamação, e as outras seis fases já tinham achado real ou risco maior de ter). Fica
pro próximo ciclo se o Eduardo quiser.

---

## 7 · Limitação desta sessão

Fase C (foco de teclado/leitor de tela) e parte da Fase B ficaram restritas ao que é alcançável
SEM login: as telas do PAINEL (filtro de `admin/clientes`, troca de dia/profissional em
`admin/agenda`, modais de ação) não puderam ser auditadas no navegador nesta sessão por falta de
credencial de admin. Não é um "sem achado" definitivo — é um "não verificado".

---

## 8 · Itens que precisam de você

**Um só, e é o item 3 (§3 acima):** decidir se vale investir no fator adaptativo de contraste
pra `site.accent`, e com que teto. Nenhum tenant real está no caso hoje (confirmado no
`apple-review`), então não é urgente — mas é o primeiro dono que escolher uma cor escura
"profissional" que vai ver o preço do próprio serviço quase invisível.

---

## 9 · Por que parei aqui

Seis das sete fases do `docs/71` cobertas — quatro com verificação limpa, duas com achado real
corrigido, uma com achado significativo medido e registrado (não forçado a corrigir sem
deliberação). A sétima (animação) já estava marcada como baixa prioridade. Continuar sem um
próximo alvo concreto e sem credencial de admin pra alcançar o painel viraria simular atividade —
o mesmo critério de parada dos loops anteriores.
