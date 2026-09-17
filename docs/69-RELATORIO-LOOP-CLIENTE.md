# 69 · RELATÓRIO DO LOOP FOCADO NA EXPERIÊNCIA DO CLIENTE FINAL (2026-09-17)

> Pedido do Eduardo, depois da noite autônoma do `docs/68`: "faz mais uma /loop mais focada na
> experiência do cliente". Mesma disciplina do `docs/67` (medir antes de agir, mutação real antes
> de confiar em guarda, registrar tudo em `docs/DECISOES.md`), mas trocando o alvo: não mais o
> painel do profissional, e sim toda tela que quem **agenda, recebe mensagem ou vê a página
> pública do salão** encontra — o lado que o `docs/68` deliberadamente não tinha coberto a fundo.

---

## 1 · Placar

| | Quantidade |
|---|---|
| Telas/fluxos públicos varridos | 8 |
| Bugs reais achados e corrigidos | 1 |
| Verificações "correto, já bem construído" | 7 |
| Commits | 1 (fix + teste + docs) |
| CI | verde nos 3 jobs (Qualidade, Banco e RLS, Segredos) |

---

## 2 · O bug real: corrida no aprovar/recusar orçamento por link

`src/server/services/orcamentos.ts`, função `transicaoPublica()` (usada por
`aprovarOrcamentoPublico` e `recusarOrcamentoPublico`, chamadas por quem recebe o link do
orçamento no WhatsApp): fazia **ler-decidir-escrever** — `SELECT status`, confere se é `'sent'`,
depois `UPDATE` sem `.eq('status', 'sent')` de volta. É o mesmo defeito que este projeto já achou
e consertou antes em `transicaoSimples()` (`agendamentos.ts`, comentário lá: *"a máquina de
estados só vale se a transição for atômica"*) — só que aqui a correção nunca tinha chegado.

**Cenário real:** o link do orçamento circula por WhatsApp e pode ser aberto em mais de um
aparelho ao mesmo tempo (encaminhado, ou reaberto sem lembrar que já decidiu). Aprovar e recusar
concorrentes liam `status: sent` os dois antes de qualquer escrita, passavam os dois pela
checagem, e o **segundo a escrever ganhava calado** — o banco fica com um estado só, mas a
equipe do salão recebe as duas notificações (`notificarEquipe`), uma delas falando de um estado
que não é mais o que está salvo.

Nunca visto em produção (achado por comparação com o padrão já corrigido em `agendamentos.ts`,
não por sintoma relatado). Severidade **MÉDIA**: sem impacto de dinheiro direto — aprovar/recusar
não cria comanda nem agendamento sozinho, isso é `converterOrcamentoEmAgendamento`, ação manual
do painel — mas gera notificação falsa e ambiguidade de estado.

**Conserto:** `.eq('status', 'sent')` atômico no `UPDATE`, mesmo padrão de `agendamentos.ts`.
Quando a corrida é perdida (0 linhas afetadas), reconfere o estado real antes de responder: se o
outro clique foi pro MESMO alvo, devolve como sucesso idempotente (mesma filosofia que já
existia pro duplo-clique sequencial); se foi pro alvo oposto, `INVALID_TRANSITION` — quem perdeu
a corrida precisa saber que não vingou.

**Teste novo:** `tests/integration/orcamentos.test.ts`, "aprovar e recusar ao mesmo tempo" —
`Promise.all` real (mesmo padrão já usado em `tests/integration/comanda.test.ts` para
`fecharComanda`), afirma `[200, 422]` nos dois status HTTP (nunca `[200, 200]`) e que o banco
reflete quem venceu. **Sem Docker/Supabase local nesta sessão** para rodar `pnpm test:integration`
antes do push — verificado localmente só `tsc`, `eslint` e a suíte `tests/unit` (283 arquivos,
2461 testes, verde). A prova real veio da CI: commit `9aa785d`, job "Banco e RLS" (roda contra
banco de verdade) fechou verde, confirmando o teste novo passa com o conserto aplicado.

Detalhe completo em `docs/DECISOES.md`, entrada "2026-09-17 · Loop cliente final, item 4".

---

## 3 · O que foi medido e não teve achado (7 telas/fluxos)

| Fluxo | O que foi conferido |
|---|---|
| **`[slug]/agendar`** (agendamento público) | Medido ao vivo no navegador (mobile 375px, tenant `apple-review`): `aria-label` corretos em dia fechado, texto do passo final é exatamente o já corrigido em auditoria anterior ("É por aqui que quem vai te atender fala com você"). Formulário **não** submetido (evitaria criar agendamento real em produção sem autorização). |
| **`confirmar/[token]`** | Lido por inteiro. Ação só dispara no toque, nunca no carregamento da página (fix de 19/08). Distingue falha transitória de rede (oferece repetir) de link rejeitado/permanente (não oferece — manda falar com o salão). Botões desabilitados carregam `motivoDesabilitado` para leitor de tela. |
| **`avaliar/[token]`** | Lido por inteiro. `<label>` de verdade, não só placeholder. Link de indicação só aparece quando `linkIndicacao` não é nulo — e a nota mínima (`NOTA_MINIMA_PARA_INDICAR = 4`) é aplicada **no servidor**, não só na tela. |
| **`lista-espera/[token]`** | O disparo automático ao carregar (diferente do `confirmar`, que exige toque — motivo estrutural: é ordem de chegada, não pode esperar o toque) é seguro contra crawler de preview de link (WhatsApp etc.): o `useEffect` que reivindica a vaga mora só no Client Component, nunca no Server Component que um crawler executaria. |
| **`mensagens-prontas` / `{{valor}}`** | Confirmado que a variável de dinheiro é sempre pré-formatada em reais (`dinheiro.format(cents/100)`) nos dois pontos de uso reais — nunca centavos crus vazando pro texto que o cliente lê no WhatsApp. |
| **`[slug]/orcamento` (pedir orçamento, direção oposta do item 2)** | A tela de sucesso documenta explicitamente por que **não** promete canal de resposta ("está na lista", sem prometer WhatsApp/e-mail — a armadilha mais cara do `CLAUDE.md`). Conferido que o pedido realmente aparece no painel do dono (`listarOrcamentos` não filtra por status, `'requested'` tem selo próprio "Pedido novo") — a promessa da tela é literalmente verdadeira. |
| **`app/error.tsx` e `app/not-found.tsx`** (boundaries da raiz, cobrem toda rota pública) | Ambos já têm histórico documentado de bugs medidos e corrigidos: o erro escolhe a saída certa por `usePathname()` (não manda cliente pro login do painel), o botão de saída é `<a>` de página inteira e não `<Link>` (não reusa o runtime quebrado), e o `not-found` tem `force-dynamic` (nonce do CSP) e título correto no HTML servido. Ambos com comentário explícito do que o conserto alcança e do que não alcança — nenhuma alegação vazia. |

Também conferida a landing copy (`[slug]/agendar/agendar.tsx`): a frase "você vai receber a
confirmação por WhatsApp" já foi removida (era falsa nos três níveis: `criarAgendamentoPublico`
não manda nada pro cliente, o cron de lembrete está deliberadamente fora do `schedule`, e não há
credencial de WhatsApp) e trocada por texto honesto, com guarda dedicada
(`tests/unit/design/agendamento-publico-nao-promete-demais.test.ts`).

---

## 4 · Por que parei aqui

O escopo que eu mesmo tracei no início desta rodada — agendamento público, confirmar/cancelar,
avaliar, lista de espera, mensagens prontas, orçamento (as duas direções), qualquer promessa
pública não cumprida, telas de erro públicas — está **esgotado**: todo item foi medido, e o único
achado real (item 2 acima) já está corrigido, testado e com CI verde. Continuar sem um próximo
alvo concreto viraria simular atividade, o que a §10 do `docs/67` pede para evitar.

---

## 5 · Itens que precisam de você — nenhum novo

Nenhum achado deste loop precisa de decisão do Eduardo. O único item pendente continua sendo o
já registrado no `docs/68` (`/api/v1/cash/daily` e `/api/v1/cash/summary` sem chamador interno).

---

## 6 · Backlog explícito pra próxima sessão

| Item | Tamanho |
|---|---|
| Rodar `pnpm test:integration` localmente (Docker/Supabase) para confirmar o teste de corrida de `orcamentos.test.ts` também localmente, não só na CI | pequeno, só falta ambiente |
| Copiar link de orçamento ainda `requested` (sem itens) é possível pelo painel — não é bug (aprovar cai em erro claro), mas é uma aresta de UX que vale revisitar: o botão "Copiar link" na lista de orçamentos não distingue "pronto pra mandar" de "pedido cru, ainda sem itens" | pequeno, UX |
| `clients/import`, `clients/[id]/media` — risco de duplicação em double-submit (herdado do `docs/68`, ainda não verificado) | não verificado |
| Teste visual do app Android num emulador | sem ambiente gráfico nesta sessão |
