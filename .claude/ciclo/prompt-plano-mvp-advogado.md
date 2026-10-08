# PROMPT: plano de implementação completo do "CICLO Advocacia" (MVP)

> Cole este arquivo inteiro como primeira mensagem de uma sessão nova. Modelo alvo: Fable.
> Repositório de trabalho: `C:\Users\Usuario\.claude\code\ciclo-verificacao` (worktree do CICLO).
> Repositório de origem das ideias a portar: `C:\Users\Usuario\.claude\code\lubi-digital-office`.

---

## 0. Papel e modo de trabalho

Você é o arquiteto-chefe e líder técnico deste MVP. Sua entrega NÃO é código: é um **plano de
implementação completo, executável por outra sessão sem perguntas**, cobrindo produto, dados,
segurança, interface, testes, ordem de entrega e riscos. Pense como um CTO de startup que vai
colocar dado de advocacia (sigilo profissional) em produção: o plano precisa sobreviver a uma
auditoria de segurança e a um advogado desconfiado.

**Duas ordens de prioridade que atravessam o documento inteiro:**
1. **Pegar a base dos projetos.** Nada se desenha do zero se o CICLO ou o LUBI já resolve. O plano
   parte de um **inventário de reaproveitamento** (seção 5.2) e cada ticket diz de qual peça
   existente nasce. O objetivo é montar o pacote Advocacia como composição do que já é sólido
   nos dois projetos, não como terceiro projeto.
2. **Amostra que impressiona.** O MVP só vale se, em poucos minutos, um advogado cético vir o
   valor com os próprios olhos. A seção 5.13 trata a **amostra** (demo com dados de impacto, e a
   amostra viva) como entrega de primeira classe, com a mesma disciplina de qualidade do código.

Regras de postura:
- Leia antes de planejar. Cada afirmação sobre o código atual deve citar `arquivo:linha`. Se você
  não leu, escreva "NÃO LI" e liste o que falta ler. Nunca invente nome de arquivo, tabela ou função.
- Separe sempre três níveis: **[FATO]** (lido no código ou em fonte citada), **[HIPÓTESE]** (minha
  inferência) e **[DECISÃO PENDENTE]** (só o Eduardo decide). Não promova hipótese a fato.
- Não decida sozinho o que é do Eduardo (lista na seção 12). Recomende, com motivo, e siga.
- Regra tributária, prazo processual e texto jurídico: nunca afirme como certo. Marque
  `precisa_revisao` e registre quem deve revisar (advogado).
- Seja extenso e concreto, mas sem enrolação. Tabelas e listas curtas, nada de adjetivo vazio.
- Escreva em português do Brasil. Sem travessão (o caractere longo) e sem texto que presuma gênero.

---

## 1. Contexto do negócio (leia com atenção, é o "porquê")

**Produto.** CICLO é um SaaS multi-tenant (Next.js 15 + Supabase) de gestão para quem tem agenda e
clientes que voltam. Hoje serve beleza e serviços. O diferencial é o **Motor de Ciclo**, que prevê
quando cada cliente volta e o traz de volta.

**Tese estratégica em teste.** Um núcleo único e vários **pacotes por nicho** (mesmo app, mesmo
site, mesmo banco; muda vocabulário, campos, telas e mensagens). Este MVP é o primeiro pacote
fora de beleza: **CICLO Advocacia**, focado em escritórios de planejamento **patrimonial,
sucessório e holding** (nicho dentro de nicho, deliberadamente).

**Por que advocacia patrimonial (hipótese, ainda não validada por mais de uma fonte).**
- Ticket alto: já houve venda de site + painel por R$ 2.500 de entrada e R$ 200/mês, e o cliente
  achou barato. Com ticket assim bastam poucos escritórios para o negócio fechar a conta.
- Dor relatada por uma advogada consultada: organização e acompanhamento do que falta de cada
  cliente. Concorrente direto não verificado. Concorrentes adjacentes: Astrea, Projuris, ADVBox,
  Legal One, Cálculo Jurídico.
- O escritório de referência (o parceiro do LUBI) **não usa software jurídico**.
- O que NÃO deve ser duplicado: financeiro de honorários e prestação de contas (a Doulhe já cobre).

**Entrevistas em andamento.** O Eduardo está conversando com advogados (dois primos e a Dra.
advogada consultada) com roteiro aberto. Resultados ainda não chegaram. O plano deve prever **onde as
respostas mudam o escopo** (ver seção 13) e não pode assumir que a tese está provada.

**Gancho + diferencial (decisão de produto a defender no plano).**
- Gancho de uso diário: **intimações e prazos** (captura pelo DJEN, fila "Hoje").
- Diferencial: **acompanhamento do caso patrimonial**: "o que falta de você", de quem, até quando,
  e a **Estrutura da família** (mapa de participações e titularidade efetiva).
- Se o plano propuser só o gancho, vira mais um software de prazo. Se propuser só o diferencial,
  ninguém abre todo dia. Mostre como os dois se encontram na mesma tela.

---

## 2. Escopo do MVP

**Dentro:**
1. Profissão **Advocacia** no cadastro, que liga o pacote (menu, vocabulário, campos, mensagens).
2. **Cliente 360**: pessoa física/jurídica, vínculos, casos, documentos, histórico.
3. **Caso** com tipo (holding, inventário, planejamento sucessório, outros), etapas e responsável.
4. **Checklist "o que falta de você"** por tipo de caso: item, quem deve entregar, prazo
   combinado, estado (pendente, recebido, conferido), documento anexado no cofre.
5. **Estrutura da família / mapa societário**: pessoas e empresas como nós, participações como
   arestas com validade temporal (`valid_from`/`valid_to`), cálculo de participação efetiva
   (direta e indireta), visualização.
6. **Hoje**: fila do dia com intimações (DJEN) e prazos, ordenada por uma função única de
   prioridade; prazo fatal blindado.
7. **Mensagem pronta de WhatsApp** para o cliente (preparada e copiada/aberta por uma PESSOA;
   nenhum envio automático).
8. Auditoria, permissões por papel (sócio, advogado, assistente), MFA para a equipe.

**Fora (não planejar em detalhe, só registrar como "depois"):** site público do escritório,
portal do cliente, financeiro de honorários, IA generativa, assinatura eletrônica, pagamento,
integração oficial com WhatsApp, app mobile nativo.

**Extensão futura a deixar encaixável, sem construir:** o conceito de "ativo com ciclo" (o carro
da oficina, a empresa/família do escritório) e o de "capacidade" (horas de advogado contra
carga prevista). Mostre onde o modelo de dados do MVP já deixa esse encaixe barato.

---

## 3. Leituras obrigatórias (nesta ordem; registre o que leu)

**CICLO** (`C:\Users\Usuario\.claude\code\ciclo-verificacao`):
- `CLAUDE.md` e `docs/00-BRIEFING.md`; `docs/05-FAQ-DEV.md`; `docs/09-PLATAFORMA.md`.
- `docs/DECISOES.md` (principalmente as entradas de 2026-10-07 sobre acesso aberto).
- `docs/83*` (migração sempre gratuita), `docs/97*`, `docs/98*`, `docs/99-PLANO-MESTRE-DO-ECOSSISTEMA.md`.
- `src/core/profissoes.ts` e a migration `0078` (profissão "outra", os "quatro eixos" do onboarding)
  e `executarOnboarding`: entenda como a profissão liga módulos hoje.
- `src/core/vault/*` e tudo que toca cofre/mídia assinada (regra: nunca cachear no service worker).
- `src/server/db/with-tenant.ts`, `src/server/auth/tenant.ts`, as políticas RLS existentes e
  `tests/rls` (como o isolamento é provado).
- `src/core/billing/{prelancamento,pausa,acesso-aberto,meu-plano}.ts` e a tabela `ROTAS_DE_ESCRITA`
  (toda rota de escrita nova precisa entrar nela; rota desconhecida bloqueia por padrão).
- `src/core/legal/*` e `src/server/services/aceite-legal.ts` (aceite de termos versionado).
- Motor: `src/core/ciclo`, `src/core/inteligencia/{planejar,proximos,medir}.ts`, `src/core/agenda`,
  `src/core/orcamento`, `src/core/mensageria`, `src/core/offline`.
- Padrões de UI: `docs/` de design, tokens, `src/app/admin/*`, o `app/error.tsx` e a deny-list do
  Workbox.

**LUBI** (`C:\Users\Usuario\.claude\code\lubi-digital-office`, branch `execucao-plano-mestre`):
- `docs/plano-mestre-lubi/` inteiro: `00-resumo`, `01-reaproveitamento-ciclo`, `02-dominio`,
  `03-telas`, `04-pendencias`, `05-area-do-cliente`, `06-motores`, `07-seguranca`,
  `08-qualidade`, `09-roteiro`, `10-revisao-adversarial`, `11-organizacao-e-motor-de-precisao`,
  `99-decisoes`, `99-perguntas-abertas`, `99-riscos`, `_EXECUCAO.md`, `_progresso.md`.
- `supabase/migrations/0010` a `0030` (domínio: contratos/bens, prazos, trabalho, atendimento,
  documentos, `work_queue`, intimações, cálculo de prazo, prazo interno, agenda).
- Código de captura DJEN (T11.1), fila (T11.2), cálculo/decisão (T11.3), prazo interno (T11.4) e a
  função única `prioridade()`.
- Telas da demo: Hoje, Cliente 360, Estrutura da família, simulador "e se", Radar.

**Memória de protocolos do Eduardo** (`C:\Users\Usuario\.claude\projects\C--Users-Usuario--claude-code\memory\`):
leia ao menos `verificacao-final-protocolo.md`, `design-interface-protocolo.md`,
`lubi-armadilhas-de-execucao.md`, `guarda-cega-teste-de-mutacao.md`, `guarda-cega-de-raiz.md`,
`regex-corrompido-por-heredoc-python.md`, `bash-heredoc-limite.md`, `guarda-crlf-nao-corta-comentario.md`,
`update-zero-linhas-nao-e-erro.md`, `supabase-view-postgres-bypassrls.md`, `segunda-fk-quebra-embed-postgrest.md`,
`migration-que-tira-privilegio-inverte-a-ordem.md`, `teste-polui-trilha-lgpd.md`, `form-sem-method-vaza-senha-na-url.md`.

---

## 4. Restrições invioláveis (o plano tem que respeitar todas)

**Operação (ordens do Eduardo):**
- NUNCA escrever em produção. Desenvolvimento e testes só no banco local.
- NUNCA fazer merge, deploy ou `db push`. As migrations ficam prontas; quem aplica é o Eduardo.
- `pnpm verify` completo antes de cada commit (roda em mais de 10 minutos: em segundo plano).
- Um ticket, um commit. Mensagem de commit via arquivo e `git commit -F`. `git add` por nome.
  Commits terminam com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`;
  descrição de PR termina com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Heredoc de shell com menos de 8 KB; arquivos grandes sempre pela ferramenta de escrita.
- Parar o servidor de desenvolvimento antes de `pnpm build`. Trabalhar no worktree indicado.
- Repositório do CICLO é público: nenhum segredo, nenhum dado real, nenhum texto jurídico
  não revisado em arquivo versionado.
- Base da branch: `feat/cortesia-2026-10-03` (contém acesso aberto, pausa, cancelamento). Os PRs
  #143 e #144 não foram mergeados; o plano deve dizer como rebasear se mudarem.

**Engenharia (CLAUDE.md do CICLO):** RLS com `enable` + `force` + política + teste em toda
tabela nova; `service_role` só em `with-tenant.ts` e Edge Functions; dinheiro em centavos;
tempo em `timestamptz` UTC; regra de negócio pura em `src/core/`; escrita por `/api/v1` com
`Idempotency-Key`; Zod na borda; sem `any`; dado sensível nunca em log, Sentry ou analytics;
nunca deletar registro de auditoria (estado/compensação); view sempre com `security_invoker`
(e lembrar que o dono do banco ignora RLS: filtro explícito quando for necessário).

**Produto/UX:** pt-BR, sem jargão; erro que explica o que fazer; estados de carregamento, vazio
e erro em toda tela; 390 px de largura com alvos de toque de pelo menos 48 px; sem travessão e
sem texto que presuma gênero; promessa de canal ("você vai receber por WhatsApp") só com rota
agendada e credencial existente; o sistema SUGERE, a pessoa decide (nunca marca nem envia por conta).

**Jurídico/regulatório:** Provimento 205/2021 da OAB (publicidade e captação), LGPD (dado sensível
e dado de terceiros que o escritório trata), sigilo profissional. Nada de "especialista" sem
título comprovado. Regras de reforma tributária ficam `precisa_revisao`. Termos de uso e política
de privacidade novos exigem revisão de advogado (dossiê) antes de valer.

**Regra de ouro de prazo:** nenhuma data de prazo processual aparece como certa enquanto o
gabarito de 50 intimações (`docs/gabarito/prazo-gabarito.json`, hoje vazio no LUBI) não existir e
um sócio não confirmar as regras. Prazo vem como "sugestão a confirmar", com memória de cálculo
visível. Isso é trava por teste e permanece. Errar prazo é o dano mais caro deste produto.

---

## 5. O que o plano deve entregar (estrutura obrigatória do documento)

Produza **um documento principal** `docs/101-MVP-ADVOGADO.md` com as seções abaixo, mais anexos.

### 5.1 Resumo executivo (máx. 1 página)
Objetivo, promessa em uma frase, escopo, o que fica de fora, e os 5 maiores riscos.

### 5.2 Diagnóstico do que já existe
Tabela "item | onde está (arquivo:linha) | reaproveita como está | adapta | reescreve" para CICLO e
para LUBI. Seja explícito sobre o custo de portar: o LUBI é Vite/TanStack Router, assume UMA
instalação por escritório e não tem `tenant_id`; o CICLO é Next.js multi-tenant. Dê a estimativa
de esforço relativo (P/M/G) por peça, nunca em horas inventadas.

### 5.3 Arquitetura
- Como a profissão Advocacia liga o pacote (feature flag por profissão? tabela de módulos? onde
  mora a configuração de menu e vocabulário?). Proponha o mecanismo mínimo que NÃO precise ser
  refeito quando entrarem Mecânica e Barbearia.
- Camadas: o que vai em `src/core` (puro), `src/server/services`, `src/app`.
- Fluxo de dados da fila Hoje (captura DJEN, deduplicação, triagem, decisão, prazo interno).
- Onde o job de captura roda (cron do Vercel, `pg_cron`, fila de jobs existente) e como evita o
  problema de atraso de cron que já mordeu o projeto. Leia `cron-github-atrasa-horas.md`.
- Offline e PWA: o que pode e o que NÃO pode ser cacheado (documento sigiloso nunca).

### 5.4 Modelo de dados completo
Para cada tabela: colunas, tipos, constraints, índices, RLS (política exata por papel),
`audit_log`, retenção e eliminação (LGPD). No mínimo: pessoas (física/jurídica), vínculos e
participações **temporais** (via RPC transacional), casos e etapas, itens de checklist e
modelos de checklist por tipo de caso, documentos (metadados + objeto no cofre), intimações
capturadas, prazos (com memória de cálculo e estado de confirmação), calendário de feriados por
tribunal/comarca, fila de trabalho, modelos de mensagem, consentimentos e aceites.
Inclua o diagrama (Mermaid) e a **ordem das migrations** com a regra: aditiva ANTES do deploy,
restritiva DEPOIS. Diga como cada migration é testada localmente e como o Eduardo aplica.
Não esqueça: segunda chave estrangeira quebra embed do PostgREST; view precisa de
`security_invoker`; coluna nova sem escritor vira defeito silencioso (liste o escritor de cada coluna).

### 5.5 Segurança (seção mais longa e mais rigorosa)
Entregue um **modelo de ameaças** (STRIDE ou equivalente) para: vazamento entre escritórios,
vazamento por papel (assistente vendo caso sigiloso), documento exposto por URL, log com dado do
caso, XSS/CSRF, injeção, abuso de captura DJEN, replay/duplicidade em rota de escrita, conta
comprometida, ex-funcionário, backup, ambiente de teste com dado real, IA/terceiros (não há IA no
MVP; escreva o que seria preciso antes de haver). Para cada ameaça: controle, onde é aplicado,
**teste que prova** e **como esse teste foi visto reprovando** (ver seção 9).
Obrigatório cobrir:
- Isolamento por `tenant_id` + RLS forçada + teste de isolamento para toda tabela nova.
- Papéis (sócio, advogado, assistente, somente leitura) e **caso sigiloso**: quem vê o quê; o bug
  conhecido do LUBI em que o conflito de interesses ignora sigilosos.
- MFA obrigatório para a equipe do escritório: como se liga no Supabase Auth, recuperação,
  e o que acontece com quem não ativou.
- Cofre de documentos: bucket privado, URL assinada de curta duração, proibição de cache no
  service worker, antivírus/validação de tipo e tamanho no envio, nome de arquivo sem dado pessoal.
- Auditoria imutável de leitura e escrita de dado sensível (quem abriu qual caso/documento).
- Eliminação e portabilidade (LGPD art. 18) e o que NÃO pode ser apagado (auditoria).
- Limites de taxa e proteção de login (o `LIMITE_LOGIN_EMAIL` do LUBI existe e não é usado).
- Gestão de segredos, rotação, e o que fica em variável de ambiente (nada no repositório).
- Redação de log/Sentry: lista do que é proibido emitir e a guarda que garante.
- Dado de saúde ou criminal pode aparecer em caso: política de campo livre e de busca.
- Backup, restauração testada e RPO/RTO realistas para o plano atual do Supabase.
- Checklist de lançamento de segurança com critério de "pode entrar dado real": enquanto não
  estiver 100% verde, o ambiente aceita SÓ dado fictício.
- Plano de resposta a incidente em uma página (quem avisa quem, prazos da LGPD).

### 5.6 Interface e experiência ("tem que ficar pika")
Não aceite "ficar bonito". Defina, com decisões verificáveis:
- Princípios: o advogado abre o app para saber **o que fazer agora** e **o que está parado e de
  quem é a culpa**. Densidade de informação alta, ruído baixo, tom sóbrio e confiável (o público
  desconfia de "cara de app de salão" e de "cara de IA").
- Identidade do pacote: como a versão Advocacia muda tom, cores, tipografia e vocabulário
  sem fork do design system. Tokens, dark mode, contraste (WCAG AA no mínimo).
- Mapa de telas e navegação (menu de no máximo 6 itens), com wireframe em texto/Mermaid de
  cada tela: Hoje, Clientes, Cliente 360, Caso, Checklist, Estrutura da família, Configurações.
- **Hoje**: a fila com prazo fatal no topo, o que vence em D-2 úteis, intimações novas a triar,
  checklists vencidos. Uma ação primária por linha. Atalhos de teclado no desktop, polegar no mobile.
- **Estrutura da família**: especifique a visualização (grafo/organograma), o comportamento de
  zoom e arraste, leitura em 390 px, acessibilidade por teclado e leitor de tela (alternativa em
  lista/tabela), cálculo de participação efetiva visível e explicável, e o simulador "e se".
- **Checklist**: criação a partir de modelo, reordenar, anexar, marcar recebido/conferido,
  cobrar com mensagem pronta, histórico.
- Microinterações e animação: só com custo medido (frames, JS) e respeitando
  `prefers-reduced-motion`. Teto de JS por rota; defina e justifique.
- Estados: carregamento (esqueleto, nunca tela branca), vazio (ensina o próximo passo), erro (diz o
  que fazer), offline, conflito de edição, sessão expirada sem perder o que foi digitado.
- Copy: lista das 40 frases mais importantes da interface já escritas, sem travessão e sem gênero
  presumido, com as proibidas ("especialista", promessa de resultado, "garantimos").
- Acessibilidade: ordem de foco, rótulos, região `aria-live` que vive sempre no DOM, alvos de 48 px.
  Atenção ao `toque-48` em links inline (zera a área do segundo). Medir com `elementFromPoint`.
- Plano de verificação visual: varredura de telas × larguras (390, 768, 1280) no navegador,
  não dedução do código.

### 5.7 Portabilidade do LUBI para o CICLO
Para cada módulo a portar (captura DJEN, fila, prazo, prioridade, mapa societário, checklist,
Cliente 360): arquivo de origem, o que é lógica pura (copiar com testes), o que é UI (reescrever
em Next.js), o que depende de instalação única (reescrever com `tenant_id`), e a ordem para
manter o CICLO atual verde o tempo todo. Liste as **armadilhas já documentadas** em
`lubi-armadilhas-de-execucao.md` (Python que trunca arquivo, `\b` corrompido, GUC NULL,
allowlist do `service_role`) e como o plano as evita.

### 5.8 Backlog de tickets
Quebre em tickets pequenos (um commit cada), numerados, com: objetivo, arquivos tocados,
migration (se houver), critério de aceite verificável, testes exigidos (unitário, integração,
RLS, navegador), risco, dependências, e **o teste-guarda e como será visto reprovando**.
Agrupe em fases com ponto de parada seguro (o produto atual nunca fica pior):
- Fase 0: alicerce (profissão Advocacia, mecanismo de pacote, menu, flag, aceite, MFA).
- Fase 1: dados e segurança (modelo, RLS, auditoria, cofre, testes de isolamento e de papel).
- Fase 2: Cliente 360 + Caso + Checklist.
- Fase 3: Estrutura da família.
- Fase 4: Hoje (DJEN, fila, prazo com trava, prazo interno).
- Fase 5: mensagem pronta, polimento "pika", varredura visual e de acessibilidade.
- Fase 5b (pode correr em paralelo desde a Fase 2, pois usa dado fictício): **amostra de impacto**
  (gerador do escritório-modelo, modo demonstração seguro, roteiro e kit de venda). A demo deve
  estar apresentável ao fim da Fase 2 com o que já existir, e melhorar a cada fase.
- Fase 6: verificação final (os 15 gates), dossiê para o advogado, checklist "pode entrar dado real".
Cada fase termina com: o que está demonstrável, o que ainda é só dado fictício, e a demo.

### 5.9 Plano de testes
Pirâmide e cobertura mínima por camada. Obrigatório:
- Testes de isolamento entre escritórios e entre papéis (positivo E negativo, com controle
  positivo para provar que o cenário foi montado, não passar vazio).
- Testes-guarda do projeto, seguindo o protocolo da seção 9.
- Teste de calendário e fuso (dia 29 a 31, mudança de horário, feriado por comarca).
- Suíte de integração sem paralelismo de arquivos quando houver rate limit do Supabase.
- Verificação no navegador de tudo que a pessoa vê.
- Dados de teste: gerador de escritório fictício realista (famílias, empresas, participações
  cruzadas, intimações) sem nenhum dado real. Lembre: seed que parece certo pode ser absurdo no agregado.
- Retroteste do cálculo de prazo contra o gabarito (quando existir) e o que fazer enquanto não existe.

### 5.10 Operação e observabilidade
Logs sem dado sensível, métricas de produto (abre por dia, itens cobrados, tempo até receber
documento), alertas (captura DJEN parou, fila crescendo, erro de MFA), painel de saúde do job de
captura, e a regra de que **verde não é prova** (cron respondendo 200 com zero processado).

### 5.11 Plano de validação com o mercado (anexo)
Como o MVP entra nas conversas: o que mostrar na demo, o que NÃO mostrar, como medir uso real em
4 semanas com 1 escritório, critérios de sucesso e de morte, e como as respostas das entrevistas
reordenam o backlog. Inclua o experimento de preço (a venda anterior foi R$ 2.500 + R$ 200/mês e
"achou barato": proponha como testar o dobro sem queimar a relação).

### 5.12 Riscos, premissas e perguntas em aberto
Tabela com probabilidade, impacto, sinal de alerta e mitigação. Liste explicitamente o que
depende do Eduardo, do advogado do escritório parceiro, da advogada consultada e de um advogado revisor externo.

### 5.13 Amostra de impacto (demo que convence) e amostra viva

Esta seção é tão importante quanto a segurança. Uma demo fraca mata a tese; uma demo que mente
mata a confiança. Entregue o plano completo de:

**A) Escritório-modelo fictício (a amostra).**
- Um escritório inteiro gerado por script, **sem nenhum dado real** (repositório é público):
  equipe com papéis, 25 a 40 clientes, 3 a 5 famílias com holding, empresas com participações
  cruzadas e indiretas em 3 níveis, bens, 40 a 70 casos em etapas diferentes, checklists em
  estados variados (alguns vencidos, alguns quase completos), documentos de exemplo (PDF
  fictícios gerados), intimações e prazos distribuídos como na vida real.
- **Reaproveite a base, não reinvente:** parta da demo D0 do LUBI (famílias, dados, telas) e da
  forma como o CICLO monta salões de demonstração e seed; diga o que copiar, o que regenerar com
  `tenant_id` e o que descartar.
- **Realismo medido, não suposto.** Os parâmetros da distribuição de intimações vêm de
  observação pública agregada (por exemplo: cerca de 400 intimações em 3 meses para uma OAB,
  78% no TJSC, pico de 15 por dia, só ~26% trazem "prazo de N" no texto). Use SÓ os parâmetros
  agregados, nunca texto, nome de parte ou número de processo reais.
- **Gere a partir de uma linha do tempo** (eventos ao longo de meses) e DERIVE os agregados dela.
  Nunca fixe taxas. Lições registradas na memória: seed que parece certo e é absurdo no
  agregado (100% de conversão, item nunca usado), volume que sai do histórico, coluna de busca
  que o seed não preenche. Inclua **um teste de sanidade do agregado** (faixas plausíveis para
  atraso médio de documento, % de checklists completos, intimações por dia útil, prazos por tipo).
- **Cenários de efeito, em ordem de impacto** (liste os 8 melhores e justifique):
  1. Abrir o **Hoje** e ver a intimação que a pessoa teria perdido, com prazo interno antes do fatal.
  2. **Cliente 360** com "o que falta de você" e cobrança em um toque, com mensagem pronta.
  3. **Estrutura da família** que mostra quem de fato controla a empresa (participação efetiva
     indireta) e pega uma inconsistência plantada de propósito (soma de participações > 100%).
  4. **Simulador "e se"** (sucessão/ITCMD) com o aviso `precisa_revisao` bem visível.
  5. **Linha do tempo única** do cliente (tudo que aconteceu, sem caçar em planilha e WhatsApp).
  6. **Retroteste**: "se este painel tivesse rodado nos últimos 90 dias, teria capturado X
     intimações e antecipado Y prazos", calculado do seed e rotulado como simulação.
  7. **Antes e depois do dia a dia**: tempo gasto cobrando documento, com a conta mostrada
     (premissa editável pelo visitante, nunca número inventado fixo).
  8. **Mapa de pendências por pessoa** (quem do escritório está segurando o quê).
- **Roteiro de demonstração de 5 a 7 minutos**, falado, tela a tela, com o gancho de abertura, os
  momentos de impacto, o que dizer e o que NÃO dizer (promessa de resultado, "garantimos",
  qualquer coisa que o Provimento 205/2021 e a LGPD não aceitem). Versão de 2 minutos para
  mandar em vídeo. Inclua as perguntas que fecham a demo e coletam sinal (quanto pagaria, quem
  mais precisa disso).
- **Modo demonstração seguro:** bandeira explícita "dados fictícios" visível em toda tela;
  botão de reiniciar o cenário; impossível misturar com escritório real (guarda no servidor e
  no banco, não só na interface); desligado por padrão em produção e ligado só por variável de
  ambiente documentada; nada da demo vai para analytics ou trilha de auditoria de verdade
  (lembre: teste que polui a trilha LGPD já aconteceu). Defina o teste que prova cada uma.
- **Acabamento de nível de produto:** a amostra é a primeira impressão. Fixe o padrão: zero
  estado vazio, zero "lorem", zero tela quebrada em 390 px, carregamento sem tela branca, tempo
  até o primeiro conteúdo medido, e a varredura visual completa (telas × larguras) antes de
  qualquer apresentação.

**B) Amostra viva (opcional, avalie risco e valor, recomende sim ou não).**
Ideia: o advogado informa a própria OAB e o painel mostra, na hora, o que o DJEN publicou para
ele nos últimos 90 dias (a API pública responde sem login e filtra por OAB). É a "prova" mais
forte possível, porque usa a vida real da pessoa. Analise com rigor antes de recomendar:
LGPD e base legal (intimações trazem nome de partes), o que pode ser exibido sem conta criada,
**não gravar nada até haver conta e aceite**, limite de taxa e abuso (qualquer um digitar a OAB
de outro), a interpretação do Provimento 205/2021, e o fato de a API devolver no máximo ~200
registros únicos por consulta (captura precisa ser dia a dia). Entregue o desenho mínimo que
reduz o risco ao menor possível, ou a recomendação fundamentada de NÃO fazer agora.

**C) Kit de amostra para o Eduardo vender.**
Lista do que sai pronto: link da demo, roteiro falado, vídeo curto, one-pager sem promessa
proibida, FAQ de objeções (segurança, sigilo, "já uso Astrea", "e se vazar?") com resposta
honesta, e o checklist "o que mostrar a cada tipo de advogado" (contencioso, patrimonial,
sócio, assistente). Tudo marcado `precisa_revisao` quando tocar em regra ou publicidade.

---

## 6. Critérios de qualidade do próprio plano (autoauditoria obrigatória)

Antes de entregar, faça uma revisão adversarial do seu documento e anexe o resultado:
1. Há alguma tabela sem RLS, sem política, sem teste de isolamento?
2. Há alguma rota de escrita fora de `ROTAS_DE_ESCRITA`?
3. Há alguma coluna sem escritor (nenhum código que a preencha)?
4. Há algum ponto onde dado de caso pode ir parar em log, Sentry, analytics ou cache?
5. Algum prazo aparece como certo sem gabarito e confirmação?
6. Algum ticket depende de outro que vem depois?
7. Algum ticket piora o CICLO atual (beleza) se parar ali?
8. Alguma promessa de canal sem rota agendada e credencial?
9. Algum texto de interface com travessão ou gênero presumido?
10. Alguma afirmação marcada [FATO] que você não leu?
11. Algum ticket constrói do zero algo que o inventário de reaproveitamento mostra que já existe?
12. A amostra tem algum dado real, algum número de ganho inventado, ou promessa que o Provimento
    205/2021 não aceita? O agregado do seed passa no teste de sanidade?
13. É possível misturar a demo com escritório real? Onde a guarda impede, e qual teste prova?
14. A demo causa impacto em até 2 minutos para quem nunca viu o produto?
Corrija o que achar. Registre o que não conseguiu corrigir.

---

## 7. Formato e entrega

- Documento principal: `docs/101-MVP-ADVOGADO.md`. Anexos separados em `docs/101-anexos/`
  (modelo de dados, ameaças, backlog, telas, copy, testes, **amostra-demo**: gerador do
  escritório-modelo, roteiro falado, kit de venda e análise da amostra viva).
- Use Mermaid para diagramas. Tabelas sempre que houver comparação.
- No fim, uma seção **"Primeiros 10 passos amanhã"** pronta para a sessão de implementação, e uma
  lista **"Decisões que só o Eduardo toma"** com recomendação e custo de cada alternativa.
- NÃO escreva código de produção nesta sessão. Pode escrever trechos curtos de SQL e TypeScript
  dentro do plano só para fixar contratos (assinatura de função, política RLS), marcados como
  ilustrativos.
- Commit só dos documentos, mensagem em português via arquivo, sem `git add` amplo.

---

## 8. Decisões que são do Eduardo (não decidir sozinho; recomendar)

1. Aplicar as migrations no banco de produção do CICLO e quando.
2. Mergear os PRs #143 e #144 antes ou depois deste trabalho.
3. Mesmo banco de produção para advocacia e beleza, ou um projeto Supabase separado por bloco
   de escritórios (a recomendação precisa pesar sigilo, custo e operação).
4. Preço, plano e cobrança do pacote Advocacia; se haverá taxa de implantação.
5. Contratar revisão jurídica externa (termos, privacidade, Provimento 205/2021).
6. Quando liberar dado real de cliente (só após o checklist de segurança 100% verde).
7. Quem confirma as regras de prazo (advogado do escritório parceiro) e o prazo para entregar o gabarito de 50.
8. Autorizar contas pagas (Supabase Pro, domínio, e-mail transacional).

---

## 9. Protocolo de verificação (o plano precisa embutir isto em cada ticket)

- **Teste-guarda que varre código** (nome de função, frase, config, janela de caracteres) falha
  de jeito silencioso. Case com o que MUDA quando o defeito volta, nunca com nome que aparece em
  `import`, rótulo ou comentário. Delimite pelo fim real do elemento. Faça a guarda gritar se o
  próprio padrão parar de casar.
- **Commite antes de mutar.** Reintroduza cada defeito que a guarda existe para pegar, um por
  vez, **confirme que a mutação foi aplicada**, e só então leia o resultado. Registre a evidência.
- **Verde não é prova:** caso que pula precisa dizer por quê; teste que assere "vazio" precisa
  provar que montou o cenário; job que responde 200 com zero processado é falha.
- **Medir, não estimar:** toque, overflow, contraste e desempenho se medem no navegador.
  Cuidado com falso positivo de medição ingênua.
- **Verificação final:** aplicar o checklist de 15 gates de `verificacao-final-protocolo.md` e o
  protocolo de `design-interface-protocolo.md` no fim de cada fase.

---

## 10. Perguntas que o plano deve responder explicitamente

1. Quantas semanas de trabalho (em ordem de grandeza, com a premissa de uma sessão por vez) para
   cada fase, e qual é o menor recorte que já permite uma demo com valor para um advogado?
2. Qual é o primeiro ticket que, sozinho, já prova que o pacote Advocacia liga e desliga sem
   afetar beleza?
3. Qual parte do LUBI é cópia segura e qual é reescrita? Onde está o maior risco de regressão?
4. Como o escritório faz a transição de planilha/WhatsApp para o app sem digitar tudo de novo?
   (Lembre: migração para o CICLO é sempre gratuita; proponha importação de lista de clientes e
   de checklist por planilha, com a esteira de dados já planejada em `docs/97`.)
5. O que o advogado vê no primeiro minuto e no primeiro dia, e o que o faz voltar amanhã?
6. Qual a métrica única de sucesso do MVP e qual é o critério de morte?
7. O que muda no plano se as entrevistas disserem que a dor principal é outra (por exemplo:
   cobrança de honorários, ou comunicação com o cliente, ou só prazos)?

---

## 11. Tom e limites finais

Seja honesto sobre o que não sabe. Prefira "não sei, e para saber é preciso X" a uma resposta
confiante errada. Se algo no repositório contradisser este prompt, o repositório vence e você
registra a contradição. Se encontrar um defeito grave no código existente durante a leitura,
liste-o em "Achados fora do escopo" e não conserte nesta sessão.

---

## 12. Check de entrega

Só encerre quando o documento tiver: resumo, diagnóstico com `arquivo:linha`, arquitetura,
modelo de dados com RLS, modelo de ameaças com testes, interface com wireframes e copy,
portabilidade, backlog em fases, plano de testes, operação, validação de mercado, riscos,
autoauditoria da seção 6, "primeiros 10 passos" e "decisões do Eduardo".

---

## 13. Pontos onde as entrevistas podem mudar o escopo (planeje o desvio)

- Se a dor central for **documento e acompanhamento**: peso máximo em checklist, cobrança e
  Cliente 360; o DJEN vira secundário.
- Se for **prazo e intimação**: peso em Hoje e prazo; o escritório de contencioso vira o alvo e a
  concorrência aperta (Astrea, Projuris). Avalie se ainda vale a pena.
- Se for **comunicação com o cliente** ("em que pé está?"): antecipe o portal do cliente.
- Se for **estrutura societária e planejamento tributário**: a Estrutura da família e o simulador
  viram o produto; reforma tributária entra como módulo de conteúdo revisado por advogado.
- Se o advogado **não pagar**: encerre a tese antes de construir o resto; registre a evidência.
