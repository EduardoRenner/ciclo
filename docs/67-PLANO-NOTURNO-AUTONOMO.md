# 67 · PLANO NOTURNO — modo autônomo total (2026-09-17)

> Pedido do Eduardo, verbatim: *"faz um prompt para desenvolve um plano de implementação para rodar
> de noite no modo 10000 autônomo sem parar pausa de no maximo por 1 minuto faz bem completo e
> extenso pode ser segurança anti bug interface funcionalidade copy qualquer coisa ou tudo"*.
>
> Este documento é DUAS coisas: (1) o plano — o que investigar/consertar/melhorar, em que ordem,
> com que regras de segurança; e (2) o prompt pronto pra colar no `/loop`, na §9. Escopo é
> deliberadamente amplo ("qualquer coisa ou tudo") — a estrutura abaixo existe pra essa amplitude
> não virar trabalho superficial ou, pior, um incêndio que ninguém vê até de manhã.

---

## 0 · A regra que domina todas as outras

**Medir, não estimar. Consertar, não inventar. Registrar, não silenciar.**

Toda a disciplina deste projeto (`CLAUDE.md`, `docs/DECISOES.md`, as dezenas de memórias sobre
"guarda cega", "falso verde", "medição ingênua") existe porque uma sessão sem essa disciplina
PARECE produtiva e não é — declara vitória sobre suposição, escreve teste que não testa nada,
ou pior, causa um incidente que só aparece quando o Eduardo acorda. Uma noite inteira sem
supervisão multiplica esse risco por horas, não por unidade de trabalho. Por isso este plano é mais
sobre GUARDRAILS do que sobre lista de tarefas — a lista de tarefas (§5-§8) é secundária à §1-§4.

---

## 1 · O que NUNCA fazer, mesmo em modo totalmente autônomo

Isto não é negociável e não se relaxa por "estar sozinho de noite" — pelo contrário, é quando mais
importa, porque não há ninguém pra pegar o erro em tempo real.

1. **Nunca tocar produção diretamente.** Sem `curl` contra `seuciclo.com.br`, sem ler/gravar no
   Supabase de produção, sem rodar migration contra o banco real. O classificador de segurança do
   Claude Code já bloqueia isso e a proteção é correta — não tentar contornar.
2. **Nunca gravar, logar, ou commitar segredo.** Chave de API, token, senha — nem em teste, nem em
   comentário, nem em `.env` versionado. Regra 10 do `CLAUDE.md`.
3. **Nunca sugerir ou implementar preço automático.** A guarda `veto-de-precificacao` existe por
   decisão de produto, não técnica. Qualquer coisa que cheire a "sugerir desconto" ou "ajustar preço
   sozinho" para e vira um achado documentado, não um commit.
4. **Nunca fazer `git push --force`, `git reset --hard` na `main`, nem apagar branch.** Reversível
   sempre > irreversível nunca, sem exceção pra "economizar tempo".
5. **Nunca declarar um teste como prova sem ver ele reprovar primeiro.** Procedimento de mutação do
   `CLAUDE.md` (commitar antes de mutar, reintroduzir o defeito, confirmar reprovação, restaurar) é
   obrigatório pra TODA guarda nova, sem exceção por ser tarde da noite.
6. **Nunca inventar dado, métrica ou resultado de teste.** Se não dá pra medir (sem Docker local,
   sem acesso a produção, sem conta real), a resposta é "não verificado, motivo X" — nunca um número
   ou "passou" fabricado. `docs/54-VALIDACAO-CAMPO.md` é o exemplo de como fazer isso direito
   (substituiu entrevista real por pesquisa secundária, COM o aviso de que não é a mesma coisa).
7. **Nunca remover ou enfraquecer uma guarda existente pra fazer a suíte passar mais rápido.** Se um
   teste está genuinamente errado (like o C-07 desta sessão, achou o bug real no SETUP do teste),
   conserta a causa raiz, documenta por quê, e roda de novo — não comenta `.skip` a esmo.
8. **Nunca criar conta, cadastro ou tenant real fora dos scripts de seed já auditados.** Zero contas
   novas em serviço externo (Google, Apple, WhatsApp, Mercado Pago) sem o Eduardo.
9. **Nunca mudar `docs/DECISOES.md` de sessões anteriores** — só apensar no fim (a armadilha do
   `CLAUDE.md`: "apendar sem rebasear" já causou conflito real).
10. **Nunca deixar a árvore de trabalho suja ao final de um ciclo.** Todo experimento de mutação
    termina restaurado e verificado (`git status` limpo) antes do próximo commit.

Se qualquer tarefa do backlog abaixo esbarrar numa dessas regras, ela para, registra a trava em
`docs/DECISOES.md`, e o loop segue pro próximo item — nunca insiste tentando contornar.

---

## 2 · O ciclo de trabalho (repete a cada iteração, pausa de até 1 minuto entre elas)

Cada iteração é UMA unidade de trabalho — um achado, um conserto, ou uma verificação — nunca um lote
de mudanças não relacionadas num commit só (regra 12 do `CLAUDE.md`: um ticket, um commit).

1. **Escolher o próximo item** da lista de prioridade (§5), ou um achado nascido de investigar o
   item anterior (achado gera achado — é assim que o `docs/66` funcionou).
2. **Medir antes de agir.** Ler o código de verdade, rodar o teste, checar o log real — nunca
   assumir pelo nome do arquivo ou pela documentação desatualizada.
3. **Se for só verificação** ("está tudo certo aqui"): registrar em `docs/DECISOES.md` como
   "Verificado, correto" — isso tem valor real, poupa a próxima sessão de reconferir.
4. **Se for achado sem conserto óbvio ou que exige decisão de produto:** registrar o achado com
   severidade e causa raiz, sem tentar consertar às cegas. Ver §3 pra critério de severidade.
5. **Se for conserto de baixo risco com causa raiz clara:** implementar, seguindo o checklist do
   `CLAUDE.md` ("Antes de considerar um ticket pronto") — RLS, os três estados de tela, `pnpm
   verify`, teste do caminho feliz e de erro, guarda vista reprovando se for guarda nova.
6. **Rodar a verificação disponível nesta máquina** — `tsc --noEmit`, `eslint`, `vitest run
   tests/unit` (sem Docker local, `test:rls`/`test:integration` não rodam aqui; documentar isso
   explicitamente em vez de fingir que rodou).
7. **Commitar** com mensagem em português, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
8. **Empurrar e conferir a CI** (`gh run list`/`gh run view`) antes de considerar o item fechado —
   local verde não é prova (regra do `CLAUDE.md`, "verde não é prova" é sobre isto).
9. **Registrar em `docs/DECISOES.md`** — achado, decisão, motivo, e o que ficou pendente/backlog.
10. **Decidir se continua.** Sinal pra PARAR o loop (ver §10): orçamento de sessão perto do fim,
    achado que precisa de decisão do Eduardo (então registra e segue pro PRÓXIMO item, não trava),
    ou lista de prioridade esgotada.

---

## 3 · Critério de severidade (pra decidir "conserta agora" vs "só registra")

| Severidade | Critério | Ação |
|---|---|---|
| **CRÍTICA** | Vazamento de dado entre tenants, RLS ausente/furada, segredo exposto, perda de dado irreversível | Consertar imediatamente se a causa raiz for clara e de baixo risco; senão, registrar como prioridade máxima pro Eduardo acordar sabendo — nunca deixar 8h sem registro |
| **ALTA** | Bug de produção real (dado errado, cálculo de dinheiro errado, tela que trava sem saída) | Consertar se o escopo for de 1-2 arquivos com teste claro; senão registrar com plano de conserto |
| **MÉDIA** | Guarda cega, cobertura faltando, UX confusa mas com saída, copy que promete o que o código não cumpre | Registrar sempre; consertar se o tempo permitir depois das prioridades acima |
| **BAIXA** | Nomenclatura, comentário desatualizado, pequena inconsistência visual | Só se sobrar tempo real no fim da lista — nunca em detrimento de algo ALTA/CRÍTICA não visto |

**Acúmulo de achados MÉDIOS/BAIXOS não é motivo pra parar** — eles vão pro backlog de
`docs/DECISOES.md` pra próxima sessão, exatamente como o `docs/66` fez com as 132 guardas antigas.

---

## 4 · As seis frentes ("segurança, anti-bug, interface, funcionalidade, copy, ou tudo")

### 4.1 · Segurança
- RLS de qualquer tabela criada desde a última auditoria (`docs/16`, 23/08) — `docs/66` Fase B já
  cobriu até 16/09; conferir migrations posteriores a essa data.
- `service_role` usado fora de `with-tenant.ts`/Edge Functions — grep, não suposição.
- Novo endpoint de API sem `rota()`, sem Zod na borda, ou sem `Idempotency-Key` em escrita.
- Qualquer lugar que confie em `tenant_id` do corpo da requisição em vez do contexto validado.
- Cabeçalhos/CSP em rota nova — nonce, `connect-src`, cache de resposta sensível.

### 4.2 · Anti-bug (a parte mais própria deste projeto)
- **Guardas-cegas**: continuar o backlog do `docs/66` Fase A (132 guardas ainda não mutadas nesta
  rodada de auditoria) — escolher por amostragem, priorizando as mais antigas ou mais tocadas
  recentemente por outro ticket.
- **Dinheiro fora da carteira**: os 15 módulos de `src/core` ainda não auditados na Fase C do
  `docs/66` (`caixa/concentracao.ts`, `caixa/taxa-por-forma.ts`, `comanda/*`, `crm/lucro-do-
  cliente.ts`, `loyalty/*`, `billing/mercado-pago.ts`, `pricing/*`).
- **Testes que provam vazio**: os 39 arquivos de `toEqual([])`/`toHaveLength(0)` ainda não
  amostrados na Fase I do `docs/66`.
- **O mesmo padrão do bug de fuso do C-07**: `grep` por `new Date().getUTC*` combinado com uma
  função de produção que usa `Temporal`/fuso do tenant no MESMO teste — já varrido uma vez nesta
  sessão (limpo), vale reconferir se algum teste novo introduzir o mesmo padrão.
- **Cron/jobs**: qualquer rota nova sob `api/cron/` sem `try/catch` por item no laço, ou sem
  heartbeat quando entrar em `ROTAS_AGENDADAS`.

### 4.3 · Interface
- Estados vazio/carregando/erro em qualquer tela nova desde a última varredura (as guardas de
  `docs/66` Fase E são exaustivas — rodar de novo e ver se алgo ficou vermelho).
- Acessibilidade: `aria-live` faltando em filtro/busca/aba que troca conteúdo sem navegação
  (`docs/66` Fase H, amostra pequena — ampliar).
- `toque-48` em elementos que dividem linha de texto corrida (armadilha documentada no
  `CLAUDE.md` — sondar com `elementFromPoint`, não só checar se a classe está presente).
- Contraste, foco visível, formulário que apaga o que foi digitado num erro de rede.

### 4.4 · Funcionalidade
- Critério de aceite de ticket marcado "completo" que nunca ganhou a guarda que o próprio critério
  pedia (o padrão que achou os bugs reais de T1.5/T-DEL no `docs/64`) — varrer outros `docs/*-PLANO.md`
  à procura do mesmo gap.
- Rota de API que existe mas nunca é chamada por nenhuma tela (capacidade morta) — ou o inverso,
  tela que chama rota que não existe mais.
- `ehRequisicaoDoAppNativo` — algum lugar novo que devia checar e não checa (vazamento de tela de
  cobrança dentro do app iOS, T1.5).

### 4.5 · Copy
- Frase que promete canal (WhatsApp, e-mail) sem rota agendada e credencial existente — a
  armadilha mais cara documentada no `CLAUDE.md` (a página pública do cliente do tenant é quem
  sofre, não o CICLO).
- Gênero pressuposto em texto voltado a profissional de beleza (maioria mulher) — `copy-pt-br-nao-
  supoe-genero` já documentou o pior caso ("obrigado" na voz da profissional).
- Texto de erro escrito pro profissional numa tela pública, ou vice-versa.
- Qualquer alegação em `/precos` ou na home que o código não cumpre mais (mesmo padrão do achado
  de 24/08 que criou `precos-nao-promete-demais.test.ts`/`home-nao-promete-demais.test.ts`).

### 4.6 · Documentação viva
- `docs/DECISOES.md` como fonte única — nunca duplicar achado já registrado, sempre linkar.
- Se um documento de plano (`docs/NN-*-PLANO.md`) tiver seção "o que falta" desatualizada (como
  aconteceu com `docs/49` sobre migrations 0066/0067, que já estavam aplicadas há muito), corrigir
  o documento com a data da correção.

---

## 5 · Ordem de prioridade sugerida (ajustável pelo que a Fase 1 encontrar)

1. Segurança (§4.1) — sempre primeiro, é onde uma falha vira incidente, não só bug.
2. Anti-bug em dinheiro e RLS (§4.2, primeiras duas subseções) — histórico de maior dano real.
3. Anti-bug em cron/guardas (§4.2, restante).
4. Funcionalidade (§4.4) — gaps de critério de aceite têm achado real toda vez que foram procurados.
5. Interface (§4.3).
6. Copy (§4.5).
7. Documentação viva (§4.6) — nunca primeiro, mas nunca pulado: registrar é parte do trabalho, não
   sobra dele.

---

## 6 · Ferramentas disponíveis nesta máquina, e o que NÃO está

**Disponível:** `tsc --noEmit`, `eslint`, `vitest run tests/unit` (via `node_modules/.bin/*.CMD`
no PowerShell — `pnpm` não está no PATH desta sessão), `git`, `gh` (CI, PRs), leitura de runtime
errors/logs via Vercel MCP, leitura de código completa.

**NÃO disponível nesta sessão:** Docker/Supabase local (`test:rls`, `test:integration` não rodam),
emulador Android, acesso a produção (bloqueado por desenho). Todo achado que dependeria dessas
ferramentas fica marcado "não verificado localmente, aguarda CI" ou "aguarda sessão com Docker" —
nunca inventado.

---

## 7 · Formato de registro em `docs/DECISOES.md`

Seguir o padrão já estabelecido nesta sessão (ver as entradas de 16-17/09):

```
## AAAA-MM-DD · <título curto> — <VERIFICADO/ACHADO + severidade/CORRIGIDO>

**Contexto:** por que esta investigação aconteceu agora.
**Medido:** o que foi lido/rodado, com caminho de arquivo e comando — nunca "parece que".
**Causa raiz** (se achado): o mecanismo exato, não só o sintoma.
**Corrigido / Não corrigido, e por quê.**
**Backlog explícito** (se aplicável): o que ficou de fora e por quê, pra próxima sessão não perder
tempo redescobrindo.
```

---

## 8 · Relatório final da noite

Ao parar o loop (por esgotar a lista, o orçamento, ou achar algo que precisa do Eduardo acordado),
escrever UM resumo final — pode ser em `docs/DECISOES.md` (entrada normal) ou, se o volume da noite
justificar, um novo `docs/68-RELATORIO-NOITE-AUTONOMA.md` no formato do `docs/66` §11.1: placar por
severidade, quantos corrigidos, quantos ficaram de backlog, e — o mais importante pro Eduardo ler de
manhã com café — **uma lista de no máximo 5 itens que precisam de decisão ou ação humana**, em
ordem de urgência, cada um em uma frase.

---

## 9 · O prompt pronto pro `/loop`

Copiar e colar (ou usar como está — este documento já é auto-suficiente):

> `/loop continua investigando e consertando o CICLO sozinho a noite toda, seguindo docs/67-PLANO-NOTURNO-AUTONOMO.md à risca — nunca pular as regras da seção 1, sempre medir antes de agir, sempre registrar em docs/DECISOES.md. Prioridade: segurança, depois dinheiro/RLS, depois cron/guardas, depois funcionalidade, depois interface, depois copy, documentação sempre. Pausa de no máximo 1 minuto entre iterações. Ao parar (lista esgotada, achado que precisa do Eduardo, ou fim do orçamento), escreve o relatório final da seção 8.`

---

## 10 · Quando parar de verdade

- A lista de prioridade (§5) se esgotou e não há achado novo nascendo dos anteriores.
- O orçamento de tokens/sessão está visivelmente perto do fim (melhor parar com relatório limpo do
  que ser cortado no meio de um commit).
- Um achado CRÍTICO foi encontrado e não tem conserto de baixo risco óbvio — registrar com destaque
  máximo no relatório final e parar, em vez de continuar arriscando mais mudanças em cima de uma
  base com problema crítico não resolvido.
- Três iterações seguidas sem achado novo em NENHUMA das seis frentes — sinal de que a varredura
  manual chegou ao limite do que dá pra achar sem ferramenta que falta (Docker, emulador,
  produção) ou sem o Eduardo decidir algo. Parar e registrar isso explicitamente, não simular
  atividade.
