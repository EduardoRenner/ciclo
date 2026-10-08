# PROMPT: plano de melhoria completo do CICLO base (beleza e serviços)

> Cole este arquivo inteiro como primeira mensagem de uma sessão nova.
> Repositório de trabalho: `C:\Users\Usuario\.claude\code\ciclo-melhoria`, worktree já criado na branch
> `melhoria/base-2026-10-08` a partir de `origin/feat/cortesia-2026-10-03`, com `.env.local` copiado e
> dependências instaladas. Preview do navegador: configuração `ciclo-melhoria`, porta 3019.
> NÃO trabalhe em `ciclo-verificacao` (branch `feat/advocacia-mvp`, pacote Advocacia) nem em `ciclo`
> (árvore principal, usada por outra sessão).
> Este prompt é o irmão de `.claude/ciclo/prompt-plano-mvp-advogado.md`: mesma disciplina, outro alvo.

---

## 0. Papel e modo de trabalho

Você é o arquiteto-chefe do produto CICLO que já existe e atende salão, barbearia, unhas, estética e
profissionais de serviço (o "CICLO base"). Sua entrega NÃO é código: é um **plano de melhoria completo,
executável por outra sessão sem perguntas**, que diga o que melhorar, em que ordem, com que prova, e o que
NÃO mexer. O produto está perto do lançamento (decisões de 29/09 na memória `ciclo-lancamento-o-que-falta`:
versão alpha, pública e oficial; confirme as datas em `docs/DECISOES.md`). Melhoria aqui quer dizer
**menos defeito que a pessoa vê, mais conversão, mais retenção e menos risco**, nunca mais funcionalidade
por acúmulo.

**Duas ordens de prioridade:**
1. **Medir antes de estimar.** Cada item do plano nasce de uma medição (navegador, banco local, teste,
   `grep` com contagem), não de impressão. Leitura de código não prova toque, overflow, lentidão nem
   estado vazio. Item sem medição entra como [HIPÓTESE] e vai para o fim da fila.
2. **Reaproveitar o que o pacote Advocacia já provou.** Em 2026-10-08 a branch `feat/advocacia-mvp` entregou
   defesas e padrões genéricos que o CICLO base ainda não tem (seção 1.2). O plano parte deles e decide, um
   a um, o que é levado para o base, com a ordem que não conflita com a fusão daquela branch.

Regras de postura (valem para o documento inteiro):
- Cada afirmação sobre o código cita `arquivo:linha` e um rótulo: **[FATO]** (lido ou medido por você
  nesta sessão), **[HIPÓTESE]** (inferência) ou **[DECISÃO PENDENTE]** (só o Eduardo decide). Se não leu,
  escreva "NÃO LI". Nunca invente arquivo, tabela, função, número ou depoimento.
- Memória e documentos antigos podem estar velhos: tudo que vier de lá e servir de premissa é conferido
  contra o código ou o banco de agora antes de virar [FATO].
- Classificação de cada item: **Decidido · Recomendado · Do Eduardo · Bloqueado**. "Do Eduardo" nunca é
  escolhido por você; mas, para o trabalho poder seguir, declare um **padrão de trabalho adotado** e diga que
  é padrão, não decisão (memória `prompts-contrato-do-eduardo`). Não esconda "Do Eduardo" sob "Decidido".
- Preço, tributo, texto jurídico e termos: nunca afirme como certo; marque `precisa_revisao`.
- Português do Brasil, sem travessão (o caractere longo) e sem texto que presuma gênero.
- Tabelas e listas curtas. Sem adjetivo vazio.

---

## 1. Contexto

**Produto.** CICLO é um SaaS multi-tenant (Next.js 15 + Supabase) de gestão para quem tem agenda e clientes
que voltam. O diferencial é o **Motor de Ciclo** (prevê quando cada cliente volta e traz de volta), hoje
acompanhado do Motor de Inteligência, da fila de chamadas e da calculadora de preço. Mobile-first, pt-BR.

**Estado a confirmar (não assuma):** [HIPÓTESE] produção tinha poucos tenants, quase todos de demonstração,
e zero cliente pagante em 2026-09-23. O Eduardo disse então que quer otimização de produto contínua mesmo
pré-receita: não use "zero cliente" como razão para parar. Confira a contagem atual somente por leitura, e
só se houver acesso de leitura já autorizado (regra de produção na seção 4).

### 1.1 O que já existe e não se refaz
Leia o índice antes de planejar: `docs/00-BRIEFING.md`, `docs/05-FAQ-DEV.md` (132 decisões), `docs/09`,
`docs/DECISOES.md` inteiro, `docs/82` a `docs/99`, `.claude/ciclo/*.md` (pesquisa de mercado e backlog
autônomo acumulados), `docs/AUTONOMOUS_EVOLUTION_LOG.md` e `.claude/ciclo/loop-melhoria.md` (o loop de
melhoria que já roda). O plano NÃO repete pesquisa já feita nesses arquivos: cita o ponto e segue.

### 1.2 O que o pacote Advocacia provou e o base ainda não tem (candidatos, a confirmar nesta base)
Verifique cada um no código do base e classifique "já tem · falta · não se aplica":

| Candidato | O que foi feito na branch advocacia | Por que importa ao base |
|---|---|---|
| Estados de escrita: sem conexão, sessão expirada, conflito | `src/lib/advocacia/escrever.ts` e `src/core/advocacia/falha-de-escrita.ts`; o digitado nunca se perde | o base usa fila offline (`apiFetch`) em algumas telas e `fetch` cru em outras: medir quantas telas caem no boundary com uma piscada de rede |
| Faixa de conexão grudada em `top-0` por cima do cabeçalho | corrigida só na branch advocacia (`indicador-de-conexao.tsx`) | [FATO] bug do shell do base, cobre o logotipo ao rolar |
| Alvo de toque medido por `elementFromPoint` | varredura nas telas do pacote achou 5 defeitos (nomes de cliente com 17 px, `toque-48` cobrindo botão vizinho) | rodar a mesma sondagem nas telas do base |
| Botão travado sem o motivo visível | `Button` usa `pointer-events: none` quando desabilitado: o `title` nunca aparece, só leitor de tela vê | é do produto inteiro; já virou tarefa avulsa, o plano decide a solução e a ordem |
| Service worker cacheando URL assinada de outro domínio | corrigido na branch advocacia; a main ainda tem | risco real de cache de mídia privada; tarefa avulsa já aberta |
| Privilégio mínimo no banco | migration 0115 revoga `anon`, DELETE e TRUNCATE nas tabelas jurídicas | auditar o base: quantas tabelas deixam `anon` e `authenticated` com privilégio que a RLS sozinha segura? |
| Health com heartbeat, reconciliação e aviso | `legalIntimacoes`, `legalFila`, `legalMfa` em `health.ts` | o base: quais jobs agendados ainda não têm vigia? A guarda `todo-cron-agendado-tem-heartbeat` existe: confira se cobre tudo |
| Atalhos de teclado nas filas (j, k, c, Enter) | `atalhos-da-fila.tsx` | a fila de chamadas e o Hoje do base no computador |
| Kit de demonstração conferido contra o código | `docs/101-kit-de-demonstracao.md` achou uma frase falsa na tela | o base tem salões de demonstração: o roteiro de venda bate com o que a tela diz? |
| Dependências com alerta alto | `sharp` e `source-map-js` (tarefa avulsa) | resolver no base e reconferir `pnpm audit` |

### 1.3 O que NÃO é objetivo
Novas verticais, o pacote Advocacia (tem plano e branch próprios), app nativo, expansão LATAM, integração
oficial com WhatsApp e qualquer coisa que dependa de decisão de negócio do Eduardo (domínio, CNPJ, PSP,
credencial do WhatsApp, DSN do Sentry): esses entram só como "bloqueado por ele", com o custo de esperar.

---

## 2. Escopo do plano

**Dentro:** (a) auditoria medida do base nas 6 frentes da seção 5.2; (b) priorização por valor e risco;
(c) backlog de tickets pequenos; (d) o que levar do pacote Advocacia e como não conflitar com a fusão;
(e) plano de teste e de verificação no navegador; (f) o que o Eduardo precisa decidir.
**Fora:** escrever código de produção, tocar produção, mergear, publicar.

---

## 3. Leituras obrigatórias (registre o que leu)

- Raiz do CICLO: `CLAUDE.md`, `docs/00-BRIEFING.md`, `docs/05-FAQ-DEV.md`, `docs/DECISOES.md`.
- Estado de produto e lançamento: `docs/55-PLANO-DE-LANCAMENTO.md`, `docs/87`, `docs/99`, `docs/98`.
- Qualidade acumulada: `docs/29-SUPER-AUDITORIA.md`, `docs/66`, `docs/71`, `docs/72`, `docs/82` (tabela de
  rodadas), `.claude/ciclo/quality.md`, `ux-findings.md`, `product-map.md`, `growth-opportunities.md`.
- Pacote Advocacia (só para o que será portado): `docs/relatorio-verificacao-advocacia.md`,
  `docs/evidencias/T5.2-varredura.md`, `T5.3-mutacao.md`, `T5.4-atalhos.md`, `T-health-mutacao.md`,
  `T1.10-mutacao.md`, `docs/101-kit-de-demonstracao.md`.
- Memória do Eduardo (`C:\Users\Usuario\.claude\projects\C--Users-Usuario--claude-code\memory\`), no mínimo:
  `verificacao-final-protocolo.md`, `design-interface-protocolo.md`, `ciclo-modo-evolucao-autonoma.md`,
  `ciclo-super-auditoria.md`, `auditoria-medir-nao-estimar.md`, `medicao-ingenua-da-falso-positivo.md`,
  `guarda-cega-teste-de-mutacao.md`, `guarda-cega-de-raiz.md`, `guarda-que-varre-passa-vazia.md`,
  `commite-antes-de-mutar.md`, `seed-parece-certo-e-absurdo-no-agregado.md`, `falha-silenciosa-onde-procurar.md`,
  `producao-atras-do-codigo.md`, `migration-que-tira-privilegio-inverte-a-ordem.md`, `sqlstate-42501-e-ambiguo.md`,
  `regex-corrompido-por-heredoc-python.md`, `bash-heredoc-limite.md`, `verificacao-paralela-sem-atrapalhar-outra-sessao.md`,
  `copy-pt-br-nao-supoe-genero.md`, `conserto-pode-ser-pior-que-o-defeito.md`, `ciclo-pacote-advocacia.md`.

---

## 4. Restrições invioláveis

**Operação (ordens do Eduardo):**
- NUNCA escrever em produção. Desenvolvimento e testes só no banco local. NUNCA merge, deploy ou `db push`.
- O banco local é **compartilhado com outra sessão**: nunca `db reset`. Migration entra por
  `docker exec -i supabase_db_ciclo psql` mais uma linha em `supabase_migrations.schema_migrations`.
- Base da branch: **padrão de trabalho adotado** (não decisão do Eduardo) `origin/feat/cortesia-2026-10-03`.
  [FATO, 2026-10-08] ela contém toda a `origin/main` (0 commits de diferença) mais 30 commits (acesso
  aberto, pausa, cancelamento, cortesia de 60 dias), é a base do produto que vai ser lançado e é a mesma
  base da branch advocacia. Os PRs #143 (cortesia) e #144 (jurídico) estão abertos; o #142 diz "não mesclar
  antes da 0101". O plano diz como rebasear se #143 mudar ou for recusado.
- **Numeração de migrations:** a branch advocacia reserva `0102` a `0116`; a `0101` é da branch da fila.
  Migration nova do base não pode colidir: proponha a faixa (por exemplo a partir de `0117`) e a regra de
  renumeração na fusão. Tipos: `npx supabase gen types typescript --local` menos as linhas de `variant_key`,
  `score_at_send`, `profile_at_send`. Atualize `MIGRATIONS_ESPERADAS` e `ULTIMA_MIGRATION`.
- Verificação sem atrapalhar a outra sessão: build e navegador só no worktree irmão; um dev server por
  worktree, com a configuração de preview própria (a `ciclo` sobe a árvore principal, não a sua).
- `pnpm verify` completo antes de cada commit (mais de 10 minutos: em segundo plano). Um ticket, um commit,
  mensagem via arquivo com `git commit -F`, `git add` por nome, em português. O commit termina com a linha
  `Co-Authored-By:` que a sessão indicar; a descrição de PR termina com
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Heredoc de shell com menos de 8 KB; arquivo grande pela ferramenta de escrita. Nunca escrever regex com
  `\b` por heredoc de Python (vira byte de controle): conferir bytes de controle no arquivo.
- Parar o dev server antes de `pnpm build`. Repositório público: nenhum segredo, dado real ou texto jurídico
  não revisado.
- Nunca digitar senha real em site publicado. Sessão local de teste por `signInWithPassword` com senha de
  conta de demonstração local.

**Engenharia (CLAUDE.md):** RLS com `enable` e `force` mais política e teste em toda tabela; `service_role` só
em `with-tenant.ts`; dinheiro em centavos; `timestamptz` UTC; regra pura em `src/core`; escrita por `/api/v1`
com `Idempotency-Key`; Zod na borda; sem `any`; dado de saúde fora de log; nunca deletar agendamento, estoque
nem auditoria; view com `security_invoker`; rota de escrita nova entra em `ROTAS_DE_ESCRITA`.

**Produto:** pt-BR sem jargão; erro que diz o que fazer; carregamento, vazio e erro em toda tela; 390 px com
alvos de 48 px; sem travessão nem gênero presumido; promessa de canal só com rota agendada e credencial; o
sistema SUGERE e a pessoa decide (no-show, por exemplo, nunca é marcado sozinho).

**Armadilhas já pagas (o plano as evita por escrito):** `toque-48` em dois links do mesmo parágrafo; `catch`
que descarta; `await fetch` sem `try` dentro de `useTransition`; seed que parece certo e é absurdo no
agregado; coluna sem escritor; segunda FK que quebra embed do PostgREST; `UPDATE` de zero linhas que não é
erro; teste de integração apontando para produção; medição que se engana (selo do `next dev` cobrindo botão,
painel sem foco do sistema).

---

## 5. O que o plano deve entregar

Documento principal `docs/102-MELHORIA-CICLO-BASE.md` (confira o próximo número livre: 101 é do pacote
Advocacia e o 100 pode estar em outra branch), com anexos em `docs/102-anexos/`.

### 5.1 Resumo executivo (1 página)
Objetivo, as 5 melhorias de maior retorno, o que fica de fora, os 5 maiores riscos.

### 5.2 Auditoria medida do base, em 6 frentes
Para cada frente: método, número medido, lista de achados com severidade, e o que NÃO foi medido.
1. **Interface e experiência:** detalhada na seção 5.3 (é a frente principal deste plano).
2. **Conversão e ativação:** cadastro, primeira cliente recuperada, calculadora, `/links`, indicação. Onde
   a pessoa trava? Fonte: `.claude/ciclo/funnel.md` e medição no navegador. Sem funil real, diga isso e
   proponha o que instrumentar (sem dado pessoal).
3. **Confiabilidade e falha silenciosa:** os 5 lugares da memória `falha-silenciosa-onde-procurar`
   (agendador, `catch`, lista fixa, vigia que se desliga, verde vazio). Todo cron tem heartbeat e vigia?
   Todo `catch` que descarta conta e avisa?
4. **Segurança e dados:** privilégios de tabela (`anon`, `authenticated`, DELETE, TRUNCATE) tabela a tabela
   contra o que a RLS segura; service worker e mídia assinada; `pnpm audit`; redação de log; trilha LGPD
   poluída por teste; headers. Resultado em tabela "tabela, privilégio hoje, privilégio necessário".
5. **Desempenho:** LCP, JS por rota, latência de clique (região da função junto do banco), peso no celular.
   Meça; não estime. Leia `docs/28`, `docs/42`, `docs/70`.
6. **Qualidade do que se diz:** copy (travessão, gênero, promessa de canal), landing e `/precos` contra o
   que o produto faz, kit de venda dos salões de demonstração contra o que a tela mostra.

### 5.3 Interface e experiência (a seção mais longa do plano)

Não aceite "ficar mais bonito". Cada decisão de interface sai de uma medição ou de uma regra escrita do
protocolo `C:\Users\Usuario\.claude\code\DESIGN-E-INTERFACE.md` (§0 a §14 para decidir, §15 para entregar,
Anexo A com os 20 defeitos visuais reais da casa, Anexo C com o roteiro de 6 telas × 3 larguras, Anexo D
com o banco de microcopy). Cite o parágrafo do protocolo em cada recomendação.

**A) O que já foi feito: não refazer, conferir se ficou.** Leia e resuma em uma tabela "achado, documento,
está no código hoje? (`arquivo:linha`), ainda vale?":
- `docs/11-INTERFACE-ESTRUTURA-E-FLUXO.md`: E1 a E6 (ficha do cliente em 3 telas, ação destrutiva de 16 px,
  continuidade de navegação, 19 de 27 telas sem carregamento, 61% do monitor vazio, rolagem horizontal
  cortada) e as fases E0 a E5. Quais foram executadas?
- `docs/15-AUDITORIA-DESIGN-UX.md`: A1 a A11 e a seção 13 ("reportado, não corrigido").
- `docs/61-EXPERIENCIA-DE-USO-PLANO.md` (tema, logo, toggle, topo do painel, hábito) e o registro de execução.
- `docs/71` e `docs/72` (copy e interface; o achado da cor de acento sem piso de contraste).
- `docs/03-DESIGN-SYSTEM.md`, `docs/08-REDESIGN-E-IDENTIDADE.md`, `docs/38-REDESIGN-CONVERSAO-HOME.md`.
Regra: decisão de produto registrada com a história (protocolo §6.5 e as "decisões que não se desfazem"
da memória `design-interface-protocolo`) só muda com motivo novo escrito.

**B) Princípios do CICLO base (escreva-os e use-os para desempatar).** Quem usa está no meio de um
atendimento, com uma mão, entre uma cliente e outra, muitas vezes com a outra mão ocupada. Então: o que
fazer agora em 5 segundos; a ação primária na zona do polegar; nenhuma tela exige rolar para achar o
botão principal; densidade de trabalho no painel (§13 do protocolo), não de vitrine; nas telas públicas, a
cliente final do salão é quem lê, e quem fica mal com defeito ali é o salão.

**C) Inventário de telas com o "trabalho" de cada uma.** Liste TODAS as rotas (leia `src/app`): públicas
(`/`, `/precos`, `/calculadora`, `/links`, `/[slug]` vitrine, `/confirmar`, `/avaliar`, `/orcamento`,
`/lista-espera`, `/termos`, `/privacidade`), autenticação (`entrar`, `cadastro`, `verificar`, `nova-senha`,
`recuperar-senha`, login social), `onboarding`, e o painel (`hoje`, `agenda`, `mes`, `clientes` e ficha,
`recuperar` com a fila de chamadas, `comanda`, `caixa`, `estoque`, `campanhas`, `orcamentos`, `series`,
`comissao`, `experimentos`, `config/*`). Para cada uma: o trabalho em uma frase, a ação primária, quantos
toques até concluir o trabalho (medido), e se aparece para todo pacote ou só para o base.

**D) Os quatro fluxos que decidem se o salão fica.** Meça no navegador, a 390 px, e escreva o antes e o
depois proposto, com toques, telas e tempo até o primeiro conteúdo:
1. Do cadastro ao primeiro valor (cadastro, onboarding, primeira tela útil, primeira cliente cadastrada ou
   importada). Onde a pessoa desiste? Que tela está vazia sem ensinar o próximo passo?
2. Marcar um horário na agenda (meta a validar: 3 toques a partir do Hoje) e remarcar.
3. Fechar o atendimento: comanda, pagamento, caixa.
4. Recuperar uma cliente: Hoje ou fila de chamadas, mensagem pronta, registro do contato.

**E) Navegação e shell.** Barra inferior (`src/components/shell/tabs.ts`, `tab-bar.tsx`), botão central,
topo (`topbar.tsx`), faixas (`faixa-da-conta.tsx`, `indicador-de-conexao.tsx`), assistente flutuante:
medir se algum deles cobre conteúdo, alvo ou outro (sobreposição medida por `elementFromPoint`, como a faixa
de conexão que cobre o logotipo ao rolar). No monitor: o layout de duas camadas (`admin/layout.tsx`) e o
que fazer com o espaço vazio (E5 do docs/11).

**F) Sistema visual.** Tokens (OKLCH, tipo, espaço, raio, sombra, movimento) em `globals.css`, tema claro e
escuro com contraste MEDIDO (texto e componentes, WCAG AA no mínimo; o acento sem piso de contraste do
docs/72 está resolvido?), consistência dos 3 níveis de botão (§4.1), os 7 estados obrigatórios do botão
(§4.4), incluindo o botão travado que hoje não mostra o motivo (`button.tsx`, `pointer-events: none`):
proponha a solução para o produto inteiro e a guarda que impede voltar.

**G) Estados de tela.** Os 6 estados (§9: carregamento sem tela branca, vazio que ensina, erro que diz o que
fazer, offline, conflito, sessão expirada sem perder o digitado) por tela, em tabela "tela × estado: tem,
falta, quebrado". A base de `rede-nao-derruba-tela.test.ts` (lista que só encolhe): quantas telas ainda
estão nela e qual é o plano para zerá-la.

**H) Movimento.** Só com custo medido (frames, JS) e com `prefers-reduced-motion` (a regra global existe:
confira no CSSOM, não no fonte). Teto de JS por rota, medido no build atual.

**I) Copy de interface.** As 40 frases mais vistas do painel e as 20 das telas públicas, lidas na tela:
botão como verbo mais objeto (§6.3), erro que diz o que fazer, vazio que ensina, sem travessão, sem gênero
presumido, sem promessa de canal sem rota agendada. Banco de frases do Anexo D do protocolo.

**J) Acessibilidade.** Ordem de foco, rótulos, títulos de tela (A1 do docs/15), região `aria-live` que vive
sempre no DOM, alvos de 48 px sondados (nunca pela caixa visual: `toque-48` estende só na vertical e dois
`toque-48` vizinhos se cobrem), leitura por leitor de tela de agenda e fila.

**K) Como medir (método obrigatório, com as lições de 2026-10-08).**
- Sondagem de toque: para cada link, botão, `summary` e campo visível, rolar ao centro da tela, contar os
  pontos de `elementFromPoint` de 30 px antes a 30 px depois que acertam o próprio alvo (o `label` conta
  para o campo dentro dele). Acusa abaixo de 48 de altura ou 44 de largura. Botões travados à parte.
- Esconder o selo do `next dev` (`nextjs-portal`) antes de sondar; esperar 3 s depois de navegar (telas com
  streaming mediram 7 alvos em vez de 19 com 1,2 s); com o painel do navegador sem foco do sistema,
  `:focus` não casa e `blur` não dispara (não é defeito); `requestAnimationFrame` não roda com o painel
  escondido.
- Overflow: `scrollWidth` contra a largura e elementos de `main` passando da borda, fora de contêiner com
  rolagem horizontal proposital.
- Sessão local: `signInWithPassword` em conta de demonstração local; telas que exigem segundo fator só no
  pacote Advocacia.
- Entregue o script de sondagem como anexo do plano, para a fase de execução reusar idêntico.

**L) Entregável desta seção.** (1) a tabela A; (2) o inventário C; (3) os 4 fluxos D com antes e depois;
(4) a varredura completa telas × 375/768/1280 × claro/escuro com os números; (5) para cada mudança de tela
proposta, um wireframe em texto (ou Mermaid) do antes e do depois, o princípio de B que ela serve e a medição
que a justifica; (6) o gate §15 do protocolo preenchido como está hoje.

### 5.4 Itens portados do pacote Advocacia
Para cada linha da tabela 1.2: "já tem, falta ou não se aplica" (com `arquivo:linha`), esforço P/M/G,
conflito esperado na fusão (arquivos que as duas branches tocam: `indicador-de-conexao.tsx`, `button.tsx`,
`globals.css`, `health.ts`, `versao.ts`, `types.gen.ts`, `DECISOES.md`) e a ordem que evita o conflito.
Diga se o melhor caminho é portar para a `main` primeiro e deixar a branch advocacia rebasear.

### 5.5 Priorização
Tabela única de todos os achados: valor para quem usa, valor financeiro, risco de regressão, esforço,
dependências, classificação (Decidido, Recomendado, Do Eduardo, Bloqueado). Critério de ordenação escrito
e defensável. Primeiro o que o cliente do salão VÊ ou que custa dinheiro dele.

### 5.6 Backlog de tickets
Tickets pequenos (um commit cada), numerados, com: objetivo, arquivos, migration (se houver, aditiva, com
RLS e teste de isolamento), critério de aceite verificável, testes exigidos (unitário, integração, RLS,
navegador), risco, dependências e **o teste-guarda e como será visto reprovando**. Fases com ponto de parada
seguro (o produto nunca fica pior se parar ali):
- Fase 0: o que não espera (service worker, `pnpm audit`, privilégio de tabela que expõe dado).
- Fase 1: defeitos que a pessoa vê (toque, sobreposição no shell, botão travado, estados de tela e de
  escrita, contraste), na ordem dos 4 fluxos da seção 5.3 D.
- Fase 1b: as mudanças de tela propostas na seção 5.3 L, uma por ticket, cada uma com antes e depois
  medidos no navegador e com o wireframe aprovado no próprio plano.
- Fase 2: confiabilidade (vigias, `catch`, falha silenciosa).
- Fase 3: conversão e ativação.
- Fase 4: desempenho.
- Fase 5: copy e kit de venda.
- Fase 6: verificação final (os 15 gates de `verificacao-final-protocolo.md`) e relatório.
Cada fase termina com: o que mudou para quem usa, como foi provado, o que ficou de fora.

### 5.7 Plano de testes e de verificação
- Guardas novas: escritas pela regra "casar com o que muda quando o defeito volta", com positivo conhecido
  como piso (não passar vazia), **vistas reprovando** (commitar antes de mutar, confirmar a mutação aplicada,
  evidência em `docs/evidencias/`).
- Integração do banco sem paralelismo de arquivos quando houver rate limit; suíte de RLS rodada depois de
  toda migration que mexe em função; teste que aponta para produção é bloqueado (`so-banco-local`).
- Verificação no navegador de tudo que a pessoa vê, em worktree irmão, com sessão local por cookie.
- Seed e demonstração: teste de sanidade do agregado (faixas plausíveis), sem dado real.
- Teste de calendário e fuso (dia 29 a 31, mudança de horário, fuso de Brasília na máquina local).

### 5.8 Operação e observabilidade
O que o `/api/health` cobre hoje e o que falta; alertas; a regra de que **verde não é prova** (200 com zero
processado, check que fica verde quando o banco está atrás); como o Eduardo vê saúde sem abrir código.

### 5.9 Riscos, premissas e perguntas em aberto
Tabela com probabilidade, impacto, sinal de alerta e mitigação. Liste o que depende do Eduardo e de
terceiros (contador, PSP, Meta, advogado revisor dos termos).

---

## 6. Autoauditoria obrigatória do plano

Antes de entregar, revise o próprio documento e anexe o resultado:
1. Algum item [FATO] que você não leu ou mediu nesta sessão?
2. Algum item "Do Eduardo" tratado como decidido?
3. Algum ticket que depende de outro que vem depois?
4. Algum ticket que piora o produto atual se parar ali?
5. Alguma migration sem RLS, política e teste de isolamento, ou com número que colide com 0101 a 0116?
6. Alguma rota de escrita fora de `ROTAS_DE_ESCRITA`?
7. Alguma guarda que nunca foi vista reprovando (ou que passaria vazia)?
8. Algum número de ganho, prazo ou depoimento inventado?
9. Algum texto de interface com travessão ou gênero presumido?
10. Algum conserto que pode ser pior que o defeito (por exemplo `toque-48` em links vizinhos)?
11. O plano conflita com a fusão da branch `feat/advocacia-mvp`? Onde, e qual é a ordem?
12. Alguma medição que pode ser falso positivo (selo do dev server, foco do sistema, espera curta demais
    com streaming)?
13. Alguma tela do inventário 5.3 C ficou sem os 6 estados avaliados, ou sem largura medida?
14. Alguma mudança de tela sem wireframe, sem princípio de 5.3 B ou sem medição que a justifique?
15. Alguma recomendação de interface que desfaz uma decisão registrada com a história sem motivo novo?
Corrija o que achar. Registre o que não conseguiu corrigir.

---

## 7. Formato e entrega

- Documento principal e anexos em Markdown; Mermaid para diagramas; tabelas quando houver comparação.
- No fim: **"Primeiros 10 passos amanhã"** pronta para a sessão de implementação e **"Decisões que só o
  Eduardo toma"**, cada uma com recomendação, custo de cada alternativa e o padrão de trabalho adotado
  enquanto ele não responde.
- NÃO escreva código de produção. Trechos curtos de SQL e TypeScript só para fixar contrato, marcados
  como ilustrativos.
- Commit só dos documentos, em português, por arquivo, sem `git add` amplo, na branch do worktree novo.
