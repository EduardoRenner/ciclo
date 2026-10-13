# CICLO — PROMPT-CONTRATO DO PLANO DE APRIMORAMENTO GERAL (13/10/2026)

> **Como usar:** cole tudo abaixo do risco numa sessão com acesso a `C:\Users\Usuario\.claude\code\ciclo`.
> **Fonte de verdade da missão.** Se o contexto for resumido, RELEIA este arquivo e `docs/98-aprimoramento/_progresso.md` antes de continuar.
> **Esta etapa produz o PLANO. Não implementa nada.** A execução vem depois, com outro comando, ticket por ticket.

---

# PARTE A · CONTRATO

## A0. Quem sou, o que quero e em que ordem

Sou o Eduardo, fundador solo do CICLO. Escreva **simples, curto por frase, sem jargão**; quando um termo técnico for inevitável, explique na mesma frase. O plano pode (e deve) ser **longo e completo**; cada frase dele, não.

O CICLO é um SaaS de gestão para quem tem **agenda e cliente que volta** (barbearia, salão, unhas, estética e os verticais de `docs/09-PLATAFORMA.md`). O dono usa o celular com uma mão, com o cliente na cadeira e o próximo esperando. Cada segundo de espera e cada toque a mais custa dinheiro e paciência.

Quero um **plano de aprimoramento geral, de ponta a ponta, o mais completo possível**, que deixe o produto:

| # | Dimensão | O que significa para o dono |
| --- | --- | --- |
| 1 | **Interface** | Bonito, limpo, sem nada sobrando; cada tela responde uma pergunta e pede uma ação |
| 2 | **Funcionalidade** | Tudo funciona, em todo fluxo, sem defeito, sem botão morto, sem número errado |
| 3 | **Facilidade** | Ele e a equipe usam sem ajuda, sem treinamento, desde o primeiro dia |
| 4 | **Clique rápido, display sem travar** | Cada toque responde na hora; nada congela; nada fica em branco; nada pede espera sem avisar |
| 5 | **Copy** | Todo texto é claro, curto, no tom certo, sem jargão, sem supor gênero, sem prometer o que não entrega |
| 6 | **Aprimoramento geral** | Tudo mais que a análise achar e que renda para o dono ou proteja o negócio |

**Ordem de execução do plano:** 1 → 2 → 3 → 4 → 5 → 6, **precedida** do diagnóstico medido (Fase 0) e com **uma exceção fixa**: defeito que **trava, perde dado, cobra errado, mostra número errado ou vaza dado** sobe para uma onda de correções urgentes antes de tudo.

## A1. Papéis que você assume (todos ao mesmo tempo)

1. **Arquiteto(a) de produto sênior** em SaaS para pequeno negócio de serviço, multi-tenant, mobile-first, Brasil.
2. **Designer de interação sênior** para dono ocupado e equipe com pouca familiaridade digital; conhece o `DESIGN-E-INTERFACE.md` da casa.
3. **Engenheiro(a) de desempenho** de Next.js 15 (App Router, Server Components, Server Actions), React 19, Supabase (Postgres + RLS + PostgREST) e Vercel: **mede antes de opinar**.
4. **Engenheiro(a) de qualidade**: reproduz defeito, acha a causa com evidência, propõe teste que pega e vê o teste **reprovar**.
5. **Redator(a) de interface em PT-BR**, com voz da casa e respeito ao cliente do cliente (a página pública fala em nome do salão).
6. **Auditor(a) adversarial**: desconfia de "já funciona", "já consertado", "é intuitivo", teste verde que não testa, guarda cega, métrica que melhora quando o produto piora, função sem chamador, campo sem escritor ou sem leitor, migration que existe no repositório e não no banco, número calculado em dois lugares, `catch` que engole.

## A2. Missão, permissões e proibições

**Missão:** produzir o **PLANO DE APRIMORAMENTO GERAL** em `docs/98-aprimoramento/`, com diagnóstico medido, propostas por dimensão, tickets executáveis com aceite medido, e revisão adversarial.

**Pode e deve:**
- Ler **todo** o código (`src/`), `supabase/migrations/`, `tests/`, `scripts/`, `docs/`, configs (`next.config.ts`, `vercel.json`, `capacitor.config.ts`, `eslint-rules/`).
- Rodar `pnpm verify`, `pnpm test:unit`, `pnpm test:rls`, `pnpm build`; subir o app local (`supabase start` + `pnpm db:reset` + `pnpm dev`) e navegar com a conta de demonstração do seed.
- Medir com Playwright **instalado fora do repositório** (ver A6), com cronômetro, com o log do Postgres local e com a saída do build.
- Consultar o banco **local** (leitura e `explain analyze`), rodar `get_advisors` no projeto **local/dev**.
- Pesquisar referências públicas na web (concorrentes, guias de acessibilidade, padrões de desempenho).
- Escrever **somente** em `docs/98-aprimoramento/` (documentos, capturas, scripts de medição, JSON de resultados, protótipos estáticos).

**Não pode:**
- Alterar código do produto, migrations, seed, configuração, `package.json`, dependências.
- Commitar, abrir PR, empurrar branch, rodar `git checkout --`/`git reset` sobre trabalho de outra sessão.
- Tocar produção (banco, Vercel, Supabase de produção) **sem autorização escrita minha nesta conversa**; mesmo com autorização, **só leitura**.
- Criar usuário, tenant ou dado em produção; enviar e-mail, WhatsApp ou push real.
- Imprimir segredo, token, chave, connection string, conteúdo de `.env` (use `[REDACTED]`).
- Usar dado real de cliente em captura, teste ou documento.

**Ambiente (registrar antes de qualquer consulta ao banco):** banco · ambiente · host · projeto · método · é produção? Se houver dúvida se é produção, **parar a consulta**. Conferir **para onde cada `.env` aponta** antes de rodar qualquer coisa que leia variáveis: hoje o `.env.local` aponta para o Supabase **local** (`127.0.0.1:54321`, FATO em 13/10), mas já apontou para o projeto de **dev** (`sukloa…`) e uma sessão inteira foi perdida semeando o banco errado. Produção é `seuciclo.com.br` + Supabase `eqzlv…` (memória da casa): nunca tocar.

**Trabalho de outra sessão:** pode haver outra sessão trabalhando no mesmo repositório. Build, navegador e medição rodam em **worktree irmão** (`git worktree add ../ciclo-medicao <branch>`), nunca na árvore principal.

## A3. Evidência (regra de ouro) e hierarquia de confiança

Toda afirmação do plano sai com um destes rótulos:
- **FATO** — com `arquivo:linha`, saída de comando colada, medição com método, captura, SQL e resultado.
- **[INFERÊNCIA]** — com a derivação: "A (fato) + B (fato) → C".
- **[HIPÓTESE]** — com "Como validar: …".
- **[NÃO VERIFICADO]** — com "Motivo: …" e "Quem destrava: …".
- **[NÃO ENCONTRADO]** — com "Busca realizada: …" e "Resultado: …".

**Hierarquia** (do mais forte ao mais fraco): execução observada > banco local > migrations > código > testes > config > docs > comentários > nomes > memória/contexto meu.

**Proibido:**
- Trocar "não consegui verificar" por "provavelmente".
- Tapar lacuna com conhecimento genérico ("em geral apps fazem X").
- Número sem fonte. Número estimado vira **[HIPÓTESE]** com meta e forma de medir.
- Afirmar defeito visual sem abrir no navegador (memória: "medição ingênua dá falso positivo").
- Afirmar "funciona" porque o teste passou (ver "Verde não é prova" no `CLAUDE.md`).

## A4. Insumos obrigatórios (ler antes de planejar; citar o que usou)

**Regras e contexto**
1. `CLAUDE.md` (regras invioláveis, teste-guarda, "verde não é prova", armadilhas conhecidas).
2. `docs/00-BRIEFING.md`, `docs/01-ESPEC-TECNICA.md`, `docs/02-API.md`, `docs/03-DESIGN-SYSTEM.md`, `docs/04-SEGURANCA-LGPD.md`, `docs/05-FAQ-DEV.md` (decisões tomadas), `docs/07-CONTEXTO-PRODUTO.md`, `docs/09-PLATAFORMA.md`, `docs/DECISOES.md` (todas as decisões; não reabrir sem motivo novo), `docs/CONTEXTO-CICLO-PARA-IA.md`, `docs/ESPECIFICACAO-COMPLETA.md`.

**Interface, experiência e copy já feitos (não refazer; verificar se ficou de pé)**
3. `08-REDESIGN-E-IDENTIDADE`, `11-INTERFACE-ESTRUTURA-E-FLUXO`, `12-AUDITORIA-DE-PRODUTO`, `13`/`14` (layout legado), `15-AUDITORIA-DESIGN-UX`, `20-COPY-PLANO`, `38-REDESIGN-CONVERSAO-HOME`, `61-EXPERIENCIA-DE-USO-PLANO`, `62-HOJE-E-PRODUTOS-DE-REVENDA-PLANO`, `71-PLANO-AUDITORIA-COPY-INTERFACE`, `72-RELATORIO-LOOP-COPY-INTERFACE`, `90-PLANO-SIMPLES`, `WEB_EXPERIENCE_AUDIT.md`.

**Desempenho já feito**
4. `28-LATENCIA-DE-CLIQUE-PLANO` (quatro rodadas; o que **não** é a causa), `42-PESO-NO-CELULAR-PLANO` (a régua errada de bytes crus), `70-RELATORIO-LOOP-PERFORMANCE`.

**Auditorias e falhas**
5. `16-AUDITORIA-SEGURANCA`, `21-AUDITORIA-FALHA-SILENCIOSA`, `23-AUDITORIA-LANCAMENTO-PLANO`, `29-SUPER-AUDITORIA`, `36-SEGURANCA-AUDITORIA-E-PLANO`, `41-AUDITORIA-E-PLANO`, `63-AUDITORIA-PENDENCIAS`, `66-AUDITORIA-AMPLA-PLANO`, `68-RELATORIO-NOITE-AUTONOMA`, `69-RELATORIO-LOOP-CLIENTE`.

**Produto em andamento (não atropelar)**
6. `73` (Motor de Ciclo), `82` (distribuição), `83`/`84`/`85` (onboarding, dados, inteligência), `91`–`96` (motor de retorno, plataforma de dados, fila de chamadas e backlog `96-BACKLOG-FILA`).

**Protocolos da casa (fora do repositório)**
7. `C:\Users\Usuario\.claude\code\DESIGN-E-INTERFACE.md` — "está bom?": tokens, CTA e zona do polegar, 7 estados de botão, animação com custo medido, banco de microcopy, gate §15 e 20 defeitos visuais reais.
8. `C:\Users\Usuario\.claude\code\VERIFICACAO-FINAL.md` — "funciona?": 15 gates, 65 defeitos reais com o sintoma enganoso.

**O código (inventário mínimo conhecido; confirmar)**
9. `src/app/`: 64 páginas (`page.tsx`) em `(auth)`, `(public)`, `admin`, `onboarding`, raiz; 118 rotas de API em `src/app/api` (`route.ts`).
10. `src/core/` (regra de negócio pura): agenda, aquisicao, assistente, attribution, auth, automacoes, billing, caixa, ciclo, comanda, commission, crm, cron, cycle, estoque, experimentos, http, inteligencia, inventory, jobs, legal, loyalty, mensageria, messaging, offline, onboarding, orcamento, pacotes, plataforma, pricing, recurrence, reminders, risk, scheduling, schema, seo, share, tempo, tenants, text, vault.
11. `src/server/` (I/O), `src/components/` (`config`, `shell`, `ui`), `src/lib/` (offline, observabilidade, mensagens, formato, haptics, preferências…).
12. `supabase/migrations/` (101 até `0101_chamada_guarda_o_texto_e_a_nota.sql`), `tests/` (unit, integration, rls, e2e, helpers; ~405 arquivos de teste).

## A5. Lições da casa que o plano TEM de respeitar

Cada uma já custou caro. O plano cita a lição quando ela se aplica e diz como foi conferida.

**Velocidade**
- **Região da função × região do banco:** conferir antes de tudo. Hoje `vercel.json` tem `regions: ["gru1"]` (FATO); confirmar a região do banco de produção e do de dev.
- **Ida ao banco em série** é o maior custo e é paga **em toda requisição**; cold start é **um só** (instância compartilhada). Tamanho de bundle rende menos que cortar idas em série (`docs/28`, memória).
- **SDK caro importado no topo** (`@sentry/nextjs` sem DSN custava ~500 ms de cold start); medir com `node -e "t=Date.now();require(X);console.log(Date.now()-t)"`.
- **Binário nativo de carona** (`sharp`, 19 MB) puxado por um `import` de um arquivo vizinho: conserto que funciona é **separar o arquivo**; `import()` dinâmico e `outputFileTracingExcludes` com colchete **não** funcionaram.
- **`await` que bloqueia a tela por algo que o usuário não vê** (a Hoje esperou 1,1–1,6 s por um evento de funil). Registro e analytics vão **depois** da resposta. A trilha de auditoria **fica** no caminho crítico (decisão registrada em `docs/28` §8): não "otimizar" isso.
- **`router.refresh()`** depois de toda ação recarrega a tela inteira; trocar por atualização local onde o dado é conhecido (`docs/28` P1-c).
- **Byte cru é a régua errada**: brotli já comprime; medir **bytes transferidos** e **tempo de execução**, não tamanho de arquivo.
- **Ícone dentro de `.map()`** e outros padrões medidos em `docs/42`.
- **`get_advisors` do Supabase** acha política RLS duplicada em tabela quente (`memberships`) que leitura de código não acha; `unused_index` em banco de teste é ruído.
- **Ler cache uma vez mede o cache**: a 1ª leitura serve cópia velha e dispara regeneração; medir várias vezes.
- **Smart App Control** deixa o build local lento no Windows: não confundir com lentidão do produto.

**Funcionalidade e dados**
- **`setState` seguido de função que relê o estado** usa o valor anterior.
- **`await fetch` sem `try` dentro de `useTransition`** (React 19) derruba a tela no error boundary e perde o que foi digitado (`CLAUDE.md`; linha de base em `tests/unit/design/rede-nao-derruba-tela.test.ts`).
- **`catch` que devolve padrão e segue**: se descarta algo, tem que contar e avisar.
- **Update de zero linhas não é erro**: guard no `WHERE` silencia a escrita.
- **Coluna sem escritor vem em fila**: consertar uma revela a próxima.
- **Duas cópias da mesma fórmula** divergem com as duas guardas verdes.
- **Lucro ignora o desconto / margem com nome de lucro**: conferir toda conta de dinheiro.
- **Livro-caixa: fonte única** (somar pedidos e caixa conta duas vezes).
- **Recálculo congela o que entrou por outra porta.**
- **Prévia que não persiste**: a tela calcula certo e não grava.
- **Teste de calendário em dia 29–31** quebra `billing_day`; **teste de fuso em máquina de Brasília** esconde o defeito que só aparece na Vercel (UTC).
- **Zod 4 `.partial()` reaplica default** e sobrescreve o resto num PATCH.
- **Segunda FK quebra embed do PostgREST** ("more than one relationship").
- **View sem `security_invoker`** fura a RLS; **view do postgres ignora RLS**.
- **Produção atrás do código**: migration no repositório que não está no banco; **banco de dev atrasado**. Verificar antes de concluir que algo "existe".
- **Teste de integração nunca aponta para produção** (trava `so-banco-local`); suíte de banco **sem paralelismo** (rate limit intermitente).
- **Seed parece certo e é absurdo no agregado**; **seed não preenche coluna de busca**: medir distribuições antes de usar a demo como prova.

**Testes e guardas**
- **Guarda cega**: teste que varre código casa com comentário, rótulo, import ou string vizinha; **CRLF não corta comentário**; **afirmar por nome tem teto**; **controle positivo** em vez de só mutação; **guarda que varre passa vazia** (o piso é o positivo conhecido).
- **Commite antes de mutar** (não se aplica a este plano, que não commita; vale para os tickets).

**Copy e público**
- **Copy PT-BR não supõe gênero** (pior caso: "obrigado" para cliente mulher).
- **Prometer canal** ("vai receber por WhatsApp") só com rota agendada e credencial existente; a página pública fala em nome do **salão**.
- **Texto de erro do profissional numa tela pública**: `app/error.tsx` decide por `usePathname()`.
- **`toque-48` em dois links no mesmo parágrafo** zera o alvo do segundo.

**Processo**
- **Verificar sem atrapalhar outra sessão**: worktree irmão.
- **Prettier**: não aplicar em massa (decisão registrada).
- **Apendar em `DECISOES.md`** e **vários commits seguidos num PR** têm armadilhas (ver `CLAUDE.md`).
- **Vercel bloqueia autor do commit** fora do time: não contornar trocando autoria.

## A6. Ambiente e método de medição (como medir, para todos medirem igual)

1. **Subir local:** `supabase start` → `pnpm db:reset` (seed com tenant de demonstração) → `pnpm build` e `pnpm start` (medir **build de produção**, não `pnpm dev`). Registrar versão do Node, da máquina e se o Smart App Control está ligado.
2. **Playwright fora do repositório:** criar `C:\temp\ciclo-medicao` (ou pasta temporária), `npm init -y` e `npx playwright install chromium` lá; scripts em `docs/98-aprimoramento/medidas/`. Não adicionar nada ao `package.json` do CICLO (`DECISOES` 31/08).
3. **Perfis de aparelho:** celular 390×844 com CPU 4× mais lenta e rede "4G lenta" (1,6 Mb/s, 150 ms); celular pequeno 360×640; computador 1280×800 e 1440×900. Toque emulado (`hasTouch`).
4. **Login na demo:** usar o fluxo real de `/entrar` com o usuário do seed (ou `signInWithPassword` + cookie, como na memória de latência), **só no banco local**.
5. **Métricas por rota:** TTFB, tempo até o primeiro conteúdo útil (o elemento que responde à pergunta da tela, não o banner), LCP, CLS, INP de 3 interações típicas, JS transferido e executado, número de requisições, **idas ao banco por requisição** (ver 6), erros de console.
6. **Contar idas ao banco:** no Postgres local, `pg_stat_statements` (zerar antes, ler depois de uma requisição) ou `log_min_duration_statement = 0` em sessão de medição; anotar consultas **em série** (uma espera a outra) e **em paralelo**. Alternativa: instrumentar um wrapper **só em cópia de medição no worktree**, nunca no código do produto.
7. **Servidor:** cronometrar com `curl -w` autenticado (cold = 1ª chamada após subir; warm = mediana de 10).
8. **Repetir 5×** e reportar mediana e pior caso; dizer a variância.
9. **Interação:** medir do toque até a 1ª mudança visual (deve ser < 100 ms) e até o estado final; tentar **duplo toque** em toda ação que grava.
10. **Produção (só com autorização, só leitura):** tempos reais com sessão descartável **local de teste** não se aplicam; para produção, usar apenas páginas públicas e logs da Vercel/Supabase que eu liberar.

## A7. Régua: frases-objetivo e metas iniciais

**Frases-objetivo**
- **Dono:** "Abro o CICLO e em 5 segundos sei o que fazer agora; faço em 2 toques; nada trava."
- **Equipe (profissional, recepção):** "Vejo só o que é meu, entendo sem treinamento, não consigo estragar nada sem querer."
- **Cliente final** (páginas públicas): "Entendo e concluo pelo celular, sem conta, em menos de 1 minuto, e sei que deu certo."

**Metas iniciais (todas [HIPÓTESE], a confirmar ou ajustar na Fase 0 com justificativa)**

| Dimensão | Meta |
| --- | --- |
| Resposta visual ao toque | < 100 ms em toda ação (botão muda de estado na hora) |
| Troca de tela (app quente, celular médio) | < 1 s até o conteúdo útil |
| Tela em branco | nunca; esqueleto ou conteúdo sempre |
| INP | < 200 ms nas 20 interações mais frequentes |
| CLS | < 0,05 |
| Idas ao banco em série por clique | ≤ 3, salvo justificativa medida |
| Duplo toque | nunca grava duas vezes (idempotência + estado "enviando") |
| Tarefas-régua do dono | ≤ 2 toques nas 5 mais frequentes; ≤ 4 nas demais |
| Estados por tela | carregando, vazio, erro, sucesso, sem conexão, dado longo |
| Interface | 390 px e 360 px sem rolagem lateral; alvos ≥ 48 px; 1 botão principal por tela; tema claro e escuro; contraste AA |
| Copy | 0 jargão sem explicação; 0 suposição de gênero; todo erro diz o que fazer |
| Funcionalidade | 0 botão morto; 0 número divergente entre telas; 0 `catch` que descarta sem avisar |

Meta não se ajusta **depois** de ver o resultado para "passar"; ajuste só com motivo escrito antes da medição.

## A8. Severidade (mesma escala dos protocolos da casa)

| Nível | Quando |
| --- | --- |
| **S0** | Perde ou corrompe dado, cobra errado, vaza dado entre tenants ou de saúde, trava o fluxo principal (agendar, atender, cobrar) |
| **S1** | Fluxo importante quebrado ou enganoso (mostra número errado, diz "salvo" sem salvar), lentidão que faz a pessoa tocar duas vezes |
| **S2** | Atrito sério: muitos toques, texto confuso, tela sem estado de erro, lentidão perceptível |
| **S3** | Polimento: alinhamento, microcopy, consistência |

## A9. Paralelização (agentes) e retorno obrigatório

Divida a Fase 0 em agentes independentes, todos **somente leitura** fora de `docs/98-aprimoramento/`:

| Agente | Escopo |
| --- | --- |
| **A · Rotas e interface** | 64 telas: inventário de elementos, estados, capturas 390/360/1280, claro e escuro, acessibilidade |
| **B · Desempenho** | Medição por rota e por ação (A6), idas ao banco, bundle, imports pesados, `await` no caminho crítico, `get_advisors` local |
| **C · Funcionalidade** | Fluxos ponta a ponta, `pnpm verify`, testes que pulam, regras de negócio, dinheiro, fuso, offline, idempotência, `catch` |
| **D · Copy** | Todo texto visível, toasts, erros, e-mails, mensagens de WhatsApp, push, páginas públicas |
| **E · Dados e banco** | Migrations × banco de dev, RLS de tabelas quentes, índices, consultas lentas (`explain analyze`), números calculados em mais de um lugar |
| **F · Público e primeiro dia** | Páginas públicas, cadastro, onboarding, conta vazia, migração de outro sistema |

Cada agente devolve **ACHADOS · EVIDÊNCIAS · INCERTEZAS · RECOMENDAÇÕES**, com rótulos de A3. Você confere **por amostragem** todo achado S0/S1 antes de aceitar (agente pode errar; já houve "agente-fantasma" que terminou sem alterar arquivo).

---

# PARTE B · O QUE ANALISAR (MAPA DO PRODUTO)

## B1. Rotas (confirmar a lista no código; acrescentar o que faltar)

**Painel (`/admin`)** — o dono e a equipe
- `hoje` (tela inicial do dia), `agenda` e `agenda/novo`, `comanda/[id]` e `comanda/agendamento/[appointmentId]`, `caixa`, `mes`.
- `clientes`, `clientes/[id]` (ficha), `clientes/nova`, `importar`, `exportar`, `ja-atendo`, `vindo-de-outro-sistema`.
- `recuperar` (clientes que sumiram; Motor de Ciclo), `campanhas` e `campanhas/nova`, `series`, `experimentos`.
- `orcamentos` e `orcamentos/novo`, `estoque`, `comissao`.
- `config` e 18 subtelas: automações, cofre, custo-fixo, excluir-conta, horários, mensagens, meu-plano, módulos, negócio, notificações, planos, profissionais e `[id]`, segurança, serviços e ficha, taxas.

**Público (`(public)`)** — o cliente do cliente
- `[slug]` (página do salão), `[slug]/agendar`, `[slug]/orcamento`, `confirmar/[token]`, `avaliar/[token]`, `lista-espera/[token]`, `orcamento/[token]`, `links`, `calculadora`, `precos`, `privacidade`, `termos`, a landing (`/`).

**Entrada (`(auth)` e `onboarding`)**
- `cadastro`, `entrar`, `verificar`, `recuperar-senha`, `nova-senha`, `onboarding` e `onboarding/perfil`.

**Infra visível**
- `error.tsx`, `global-error.tsx`, `not-found.tsx`, `admin/error.tsx`, `layout.tsx`, `opengraph-image.tsx`, PWA/offline, Capacitor (`android/`, `ios/`).

## B2. Perguntas por área (o diagnóstico responde cada uma)

**Hoje** — Responde "o que faço agora" em 5 s? Quantos números concorrentes? O 1º item tem ação direta? Quanto tempo até o 1º item aparecer (medido)? O que bloqueia?
**Agenda** — Criar, mover, remarcar, cancelar, confirmar, faltou: quantos toques? Conflito tratado pela constraint com 409 e alternativas? Arrastar funciona no celular? Fuso e virada de horário de verão? Duplo toque?
**Comanda e caixa** — Abrir, somar, desconto, pacote, pagamento parcial, troco, estorno compensatório: os números batem com o caixa, o mês e a comissão? Fonte única? Recebimento duplicado?
**Clientes e ficha** — A ficha ainda é uma parede (`docs/11` E1)? Busca acha por nome, telefone e apelido com acento? Importar e exportar funcionam com planilha real? LGPD: cofre, consentimento, exclusão.
**Recuperar e campanhas** — O dono entende por que o cliente aparece? A mensagem pronta abre o WhatsApp dele com o texto certo? Medição de volta (link de volta, migration 0099) aparece?
**Orçamentos, estoque, comissão, séries, experimentos** — Cada número tem fonte única? Telas usadas de verdade ou módulos que poluem o menu?
**Config** — 18 subtelas: quais o dono precisa no primeiro dia? Quais podem ir para "avançado"? Cada salvar avisa e persiste?
**Públicas** — Abrem rápido em 4G? Agendar em menos de 1 minuto? Confirmação clara? Texto fala em nome do salão, sem prometer canal que não existe?
**Entrada** — Cadastro, verificação de e-mail, recuperação de senha (limite de e-mail do Supabase é por projeto), primeiro dia com conta vazia, onboarding por perfil (vertical).
**Transversal** — Navegação (continuidade, voltar), tema escuro, offline (fila de `lib/offline`), haptics, notificações, erro de rede que não derruba tela, `aria-live` sempre no DOM.

## B3. Mapa de tarefas-régua (definir 12 a 15 a partir do uso real; candidatos)

1. Abrir o dia e saber o que fazer (Hoje).
2. Agendar um cliente que chegou ou ligou.
3. Remarcar um horário.
4. Marcar que o cliente chegou / faltou.
5. Fechar a comanda e receber (Pix, cartão, dinheiro, parcial).
6. Ver quanto entrou hoje e no mês.
7. Chamar um cliente que sumiu (Recuperar) com a mensagem pronta.
8. Cadastrar um cliente novo rápido.
9. Achar a ficha de um cliente e ver o histórico.
10. Criar um orçamento e mandar o link.
11. Lançar uma venda de produto de revenda.
12. Ajustar horário de trabalho ou bloquear um dia.
13. Cliente final: agendar sozinho pela página do salão.
14. Cliente final: confirmar o agendamento pelo link.
15. Dono novo: primeiro uso até o 1º agendamento.

Para cada uma: gatilho, quem faz, frequência (estimada com motivo), toques, telas, tempo, pontos de dúvida, falhas possíveis, **medido hoje**.

---

# PARTE C · FASES DO PLANEJAMENTO

Cada fase tem: **objetivo · perguntas · método · checklist · entregável (modelo) · gate**. Fase sem entregável com evidência **não está concluída**.

## Fase 0 · Diagnóstico ponta a ponta (medido)

**Objetivo:** saber, com números, onde o CICLO trava, confunde, erra e sobra.

**Método (subfases)**
- **0.1 Linha de base técnica:** `pnpm verify` (colar saída), contagem de testes que **pulam** e por quê, `pnpm build` (tempo, tamanho de rota), versão das dependências críticas, região das funções e do banco, migrations do repositório × banco de dev (diferença).
- **0.2 Inventário de rotas (B1):** para cada uma, propósito, quem usa, frequência, dados carregados (consultas), ações, estados existentes, componentes.
- **0.3 Tarefas-régua (B3):** medidas com Playwright nos 3 perfis de aparelho.
- **0.4 Desempenho por rota e por ação (A6):** tabela completa; top 20 ações mais lentas; árvore do que cada clique faz (requisição → servidor → idas ao banco → resposta → render).
- **0.5 Travamentos:** botões sem "enviando", duplo toque que grava duas vezes, telas que congelam (tarefa longa > 50 ms na thread principal), listas sem paginação/virtualização, `useEffect` em cascata, `router.refresh()` onde basta atualizar local, formulário que perde o digitado.
- **0.6 Funcionalidade:** fluxos ponta a ponta das tarefas-régua; botões mortos; telas sem estado de erro; regras de dinheiro, fuso, idempotência, offline; números divergentes entre telas (listar cada número exibido e sua fonte).
- **0.7 Copy:** extrair todo texto visível (script que percorre as rotas e salva `textos.json` por rota) + textos de e-mail, WhatsApp e push em `src/`.
- **0.8 Interface:** inventário de elementos por tela (cada um com **leitor** e **decisão**), capturas 390/360/1280 nos dois temas, axe, contraste, alvos, foco, zoom 200%.
- **0.9 Dados:** `get_advisors` local (performance e segurança), `explain analyze` das 10 consultas mais quentes, índices faltando, políticas RLS duplicadas em tabela quente, seed medido (distribuições).
- **0.10 Referências:** como os concorrentes diretos (Trinks, Avec, Belasis, Simples Agenda, Booksy) resolvem as tarefas-régua, só por material público; o que imitar e o que evitar.

**Checklist de saída**
- [ ] 64 rotas inventariadas
- [ ] 12–15 tarefas-régua medidas nos 3 perfis
- [ ] Tabela de desempenho por rota e top 20 ações lentas com causa
- [ ] Lista de travamentos com reprodução
- [ ] Lista de defeitos com severidade S0–S3
- [ ] `textos.json` por rota
- [ ] Capturas e axe por tela
- [ ] Achados de banco com `explain`
- [ ] Referências com fonte

**Entregável:** `docs/98-aprimoramento/01-diagnostico.md` (+ `capturas/`, `medidas/*.json`, `medidas/*.mjs`).
Modelo de tabela de tarefa: `| # | Tarefa | Perfil | Toques | Telas | Tempo (mediana/pior) | Onde parou | Severidade | Evidência |`.
Modelo de desempenho: `| Rota/ação | TTFB | Conteúdo útil | INP | JS (KB) | Idas ao banco (série/paralelo) | Causa principal | Evidência |`.

**Gate G0:** tudo do checklist, com evidência; o que não foi medido listado nominalmente com motivo.

## Fase 1 · Interface

**Objetivo:** cada tela simples, clara, sem sobra, bonita, igual em linguagem visual, nos dois temas e nos dois tamanhos.

**Perguntas:** O que cada tela responde? Qual a ação principal? O que sobra? O que falta? O que esconde algo importante? A versão de computador aproveita o espaço (`docs/11` E5: 61% vazio)?

**Checklist por tela (aplicar a todas as 64)**
1. Uma pergunta, uma ação principal, um botão primário.
2. Cada elemento com leitor e decisão; sem os dois, sai ou vai para "mais".
3. Hierarquia: título, estado, ação, detalhe.
4. Zona do polegar: ação principal alcançável com uma mão no celular.
5. Os 7 estados de botão (`DESIGN-E-INTERFACE.md`): normal, hover, foco, pressionado, enviando, desabilitado, sucesso/erro.
6. Estados de tela: carregando (esqueleto), vazio (explica e convida), erro (diz o que fazer), sucesso, sem conexão, dado longo.
7. Consistência com `03-DESIGN-SYSTEM` (tokens, componentes obrigatórios, cores por estado).
8. Tipografia e espaçamento pela escala; nada de tamanho solto.
9. Ícone sempre com rótulo; cor nunca sozinha.
10. Ação destrutiva separada, com confirmação e desfazer; alvo ≥ 48 px (`docs/11` E2).
11. Continuidade de navegação: voltar leva aonde a pessoa espera (`docs/11` E3).
12. Computador: duas colunas onde há lista e detalhe; nada esticado; ação principal visível sem rolar.
13. Tema escuro com o mesmo contraste.
14. Acessibilidade: contraste AA, foco visível, ordem do foco, leitor de tela, zoom 200%, `aria-live` sempre no DOM.
15. Movimento: só onde informa, com custo medido, `prefers-reduced-motion`.
16. Densidade: o dono vê o que precisa sem rolar na 1ª tela do celular.
17. Rolagem horizontal cortada (`docs/11` E6): nunca.

**Método:** começar pelas telas de maior frequência (Hoje, Agenda, Comanda, Clientes, Recuperar, Caixa) e pelas públicas; propor antes × depois com captura e, quando a mudança for grande, **protótipo estático** em `docs/98-aprimoramento/prototipos/` (celular e computador, estados, tema escuro, dados fictícios), medido pela mesma régua.

**Entregável:** `02-interface.md` — por tela: veredito, problemas (com captura), proposta, elementos que saem, ganho esperado (em toques ou segundos, com medida), esforço e risco.
**Gate G1:** cada tela com antes × depois; as 10 mais usadas com protótipo ou captura anotada.

## Fase 2 · Funcionalidade

**Objetivo:** zero defeito nos fluxos que o dono e o cliente usam; zero botão morto; zero número errado.

**Checklist por fluxo**
1. Caminho feliz ponta a ponta, medido.
2. Caminho de erro: rede cai no meio, servidor responde 409/422/500, sessão expira, permissão negada.
3. Duplo toque e reenvio (idempotência com `Idempotency-Key`).
4. Offline: a fila de `lib/offline` guarda, reenvia e avisa; nada some no logout.
5. Dinheiro: centavos, desconto em valor, pacote por sessão consumida, estorno compensatório, comissão, caixa, mês: **fonte única** para cada número.
6. Tempo: UTC no banco, fuso do tenant na tela, dia de mudança de horário, dias 29–31, virada de mês e ano; teste rodando com `TZ=UTC`.
7. Multi-tenant: nada de `tenant_id` do corpo; RLS; views com `security_invoker`.
8. LGPD: dado de saúde fora de log/Sentry/analytics; cofre; exclusão de conta.
9. `catch` que descarta: conta e avisa?
10. Cron e motores (Motor de Ciclo, lembretes, automações): rodam? Processam algo (não `200` com 0)? Vigiam a si mesmos?
11. Migrations: repositório × dev × produção (produção só com autorização).
12. Testes: quais pulam; quais asserem vazio sem montar cenário; guardas cegas (verificar por mutação nos críticos).

**Entregável:** `03-funcionalidade.md` — por defeito: ID, severidade, fluxo, reprodução (passos), resultado esperado × obtido, causa com evidência, correção proposta, teste que pega (e como ver reprovar), risco do conserto, se precisa de migration (ordem: aditiva antes do deploy, restritiva depois).
**Gate G2:** cada defeito reproduzido ou marcado [NÃO VERIFICADO] com motivo; os S0/S1 conferidos por você.

## Fase 3 · Facilidade

**Objetivo:** o dono e a equipe fazem tudo sem ajuda; o primeiro dia leva ao primeiro agendamento sem atrito.

**Checklist**
1. Cada tarefa-régua: hoje × proposto (toques, telas, tempo, decisões que a pessoa precisa tomar).
2. Primeiro dia: cadastro → verificação → onboarding por vertical → conta vazia → 1º serviço → 1º profissional → 1º agendamento → 1º cliente que volta. Medir cada passo; o que pode ser pré-preenchido, pulado ou feito depois.
3. Migração de outro sistema (`vindo-de-outro-sistema`, importar planilha): quanto custa trazer 300 clientes?
4. Equipe e papéis: o profissional vê só o que é dele? A recepção consegue operar sem ver dinheiro?
5. Ajuda na própria tela: estados vazios que ensinam, exemplos, defaults sensatos, desfazer em vez de "tem certeza?".
6. Menu e módulos: o que o dono não usa pode sumir (`config/modulos`)?
7. Linguagem do nicho: o vertical (barbearia, estética, faxina, personal) muda palavras? Onde?
8. Erros que a pessoa comete mais (pela análise de fluxo): prevenir em vez de avisar.

**Entregável:** `04-facilidade.md` — tabela de tarefas-régua (hoje × proposto × como medir) e roteiro do primeiro dia com tempo por passo.
**Gate G3:** todas as tarefas-régua com proposta e medida de sucesso.

## Fase 4 · Clique rápido, display sem travar

**Objetivo:** cada toque responde na hora; nada congela; nada fica em branco.

**Taxonomia de causas (classificar cada lentidão em uma ou mais)**

| Causa | Como detectar | Consertos típicos (escolher com medida) |
| --- | --- | --- |
| **Rede/região** | TTFB alto mesmo com servidor rápido | Região já em `gru1`; conferir banco; CDN para estático |
| **Idas ao banco em série** | Log/contagem de consultas por requisição | `Promise.all` quando independentes; uma consulta com junção; RPC; deduplicar sessão e tenant por requisição |
| **`await` no caminho crítico** | Leitura do handler + medição | Mover para depois da resposta (`after()` do Next) o que é registro; manter auditoria onde a decisão manda |
| **Servidor pesado** | Tempo de CPU da função | Tirar SDK do topo; separar arquivo que puxa binário; cache de leitura segura |
| **Cold start** | 1ª chamada após ociosidade | É plataforma; reduzir peso do bundle do servidor; aceitar o resto |
| **Render no cliente** | Tarefas longas > 50 ms | Menos `use client`; memo onde medido; dividir componente; virtualizar lista |
| **Hidratação** | Tempo até interativo | Server Component por padrão; ilhas pequenas |
| **Bundle** | JS transferido por rota | Import dinâmico do que é raro; nada de biblioteca inteira por um ícone |
| **Recarga total** | `router.refresh()` após ação | Atualização local/otimista onde o dado é conhecido |
| **Sem feedback** | Toque sem mudança visual em 100 ms | Estado "enviando" imediato; `useOptimistic`; haptic |
| **Banco** | `explain analyze`, `get_advisors` | Índice; política RLS única em tabela quente; consulta paginada |
| **Imagem e fonte** | LCP de imagem; FOUT | Tamanhos certos; `next/image`; fonte local com `display: swap` |

**Política de resposta otimista (decidir por ação, escrever no plano)**
- **Pode ser otimista** (reverte com aviso se falhar): marcar chegou/faltou, mover item na Hoje, favoritar, filtros, editar nota.
- **Não pode** (espera o servidor, mas mostra "enviando" na hora): criar agendamento (conflito), receber dinheiro, estorno, excluir, qualquer coisa com idempotência de dinheiro.

**Orçamento por tipo de ação (preencher na Fase 0 e usar aqui)**

| Tipo | Feedback visual | Conclusão |
| --- | --- | --- |
| Navegar entre telas principais | < 100 ms (esqueleto) | < 1 s |
| Salvar simples | < 100 ms | < 800 ms |
| Ação com dinheiro | < 100 ms ("enviando") | < 1,5 s |
| Busca | a cada tecla < 50 ms local | resultado < 500 ms |
| Página pública (4G) | conteúdo útil < 2 s | agendar < 1 min |

**Entregável:** `05-velocidade.md` — tabela **rota/ação × hoje (medido) × meta × causa × conserto × ganho esperado (com base) × como medir depois × risco**, ordenada por **ganho medido × frequência ÷ esforço**.
**Gate G4:** cada conserto com causa **medida**; ganho sem medida marcado [HIPÓTESE].

## Fase 5 · Copy

**Objetivo:** todo texto claro, curto, consistente, respeitoso, honesto.

**Regras da casa (aplicar e citar)**
1. Botão = **verbo + objeto** ("Salvar horário", "Receber R$ 80,00"), nunca "OK", "Enviar" solto em tela com mais de uma ação.
2. **Erro** = o que aconteceu + o que fazer ("Não salvou porque a internet caiu. Tocamos de novo quando voltar.").
3. **Vazio** = por que está vazio + próximo passo.
4. **Sucesso** = o que aconteceu, com o dado ("Agendado: Ana, quinta, 14h").
5. **Confirmação destrutiva** = consequência concreta + desfazer quando possível.
6. **Sem supor gênero** ("Boas-vindas", "Que bom te ver", "obrigado(a)" evitado por construção).
7. **Sem jargão**: CRM, churn, LTV, ticket médio, no-show → palavra do dono ("cliente que sumiu", "faltou").
8. **Números, datas e dinheiro** pelo `lib/formato` (um lugar só); "hoje", "amanhã", dia da semana.
9. **Vertical**: palavras que mudam por profissão (cliente, paciente, aluno; atendimento, sessão, aula) vêm de um lugar só.
10. **Página pública fala pelo salão**; nunca promete canal sem rota agendada e credencial.
11. **Mensagens de WhatsApp e e-mail**: curtas, com nome, sem parecer robô, com saída (parar de receber).
12. **Notificações**: o que mudou e o que fazer, em uma linha.

**Método:** usar `textos.json` da Fase 0; classificar cada texto (OK / reescrever / remover); reescrever; montar **glossário do produto** (termo → definição curta → onde aparece); listar strings duplicadas que deveriam vir de uma fonte só.

**Entregável:** `06-copy.md` — tabela **rota · elemento · texto atual · problema · texto proposto · regra** + glossário + banco de microcopy (erros, vazios, sucessos, confirmações).
**Gate G5:** 100% do texto visível inventariado; o que muda, reescrito; o que é jurídico/regulatório, marcado para revisão.

## Fase 6 · Aprimoramento geral

**Objetivo:** tudo o mais que a análise achar e que renda ou proteja.

**Áreas a varrer**
1. **Segurança e LGPD** visíveis (cofre, consentimento de foto, exclusão, export, sessão, limite de tentativas).
2. **Observabilidade**: erro que some em silêncio (memória "falha silenciosa"), cron que responde 200 sem fazer nada, vigias que se desligam quando pioram.
3. **Testes**: lacunas nos fluxos críticos; e2e inexistente (propor caminho sem violar a decisão de 31/08 ou propor revisá-la com motivo).
4. **Dívida técnica** que trava evolução (arquivos gigantes, duplicação de fórmula, componentes que fazem tudo).
5. **Acessibilidade** além do axe.
6. **SEO e páginas públicas** (`llms.txt`, sitemap, metadata, `opengraph-image`).
7. **App nas lojas** (Capacitor): o que muda na interface para parecer app.
8. **Custos de infraestrutura** ligados a desempenho (funções, banco, imagens).
9. **Documentação** para quem vier depois (o que está obsoleto em `docs/`).
10. **Experiência de build e desenvolvimento** (tempo de `pnpm verify`, testes intermitentes).

**Entregável:** `07-geral.md` — por item: valor para o dono, custo, risco, prioridade; o que **não** fazer agora e por quê.
**Gate G6:** cada item com valor, custo e risco; nenhuma decisão de `DECISOES.md` reaberta sem motivo novo escrito.

## Fase 7 · Plano consolidado e tickets

**Objetivo:** transformar tudo num plano executável, na ordem pedida.

**Ondas (ordem)**
- **Onda U · Urgente:** todo S0 e os S1 que travam, perdem dado, cobram errado ou mostram número errado (qualquer dimensão).
- **Onda 1 · Interface.**
- **Onda 2 · Funcionalidade** (S1 restantes, S2).
- **Onda 3 · Facilidade.**
- **Onda 4 · Velocidade.**
- **Onda 5 · Copy.**
- **Onda 6 · Geral.**
Se uma melhoria de uma onda depende de outra (ex.: copy de uma tela que vai ser redesenhada), registrar a dependência e juntar no mesmo ticket ou ordenar.

**Modelo de ticket (obrigatório)**

```
### APR-XXX · <título com verbo e objeto>
Onda: U | 1 | 2 | 3 | 4 | 5 | 6        Severidade: S0–S3        Esforço: P (≤ 0,5 d) · M (1–2 d) · G (3–5 d), em faixa
Dimensão: interface | funcionalidade | facilidade | velocidade | copy | geral
Problema (com evidência): …
Proposta: …
Telas/rotas: …                         Arquivos prováveis: …
Critério de aceite (MEDIDO): … (ex.: "tempo até conteúdo útil de /admin/hoje ≤ 1 s, mediana de 5, perfil celular")
Teste: caminho feliz + caminho de erro; guarda nova vista REPROVANDO com o defeito plantado
Migration: não | aditiva (antes do deploy) | restritiva (depois do deploy)
Dependências: …                        Risco e como reverter: …
Como verificar em produção depois (com autorização): …
Commit: tipo(escopo): descrição em português (APR-XXX)
```

**Regras do plano**
- Um ticket, um commit (regra da casa).
- Cada ticket cabe em `pnpm verify` verde.
- Esforço em faixa e **total por onda**; total geral com 20–30% de integração, verificação e revisão.
- Grafo de dependências (mermaid).
- O que depende de mim (decisão, acesso, dinheiro) listado à parte.

**Entregável:** `08-plano-e-tickets.md` + `_progresso.md` atualizado.
**Gate G7:** todo ticket com aceite medido, ordem, dependências e esforço.

## Fase 8 · Revisão adversarial

**Objetivo:** derrubar o plano antes que a realidade derrube.

**Ataques obrigatórios**
1. Para cada proposta: afirme o contrário; ela resiste?
2. Meta que melhora quando o produto piora (ex.: "menos toques" escondendo informação; "mais rápido" pulando verificação de dinheiro).
3. Ganho de velocidade estimado sem medida; conserto que move o custo para outro lugar.
4. Otimista onde não pode (dinheiro, conflito de agenda).
5. Tela simplificada que escondeu o que importa.
6. Copy que confunde, assusta, supõe gênero ou promete o que não existe.
7. Defeito "consertado" sem teste que reprova.
8. Guarda proposta que seria cega.
9. Migration fora de ordem; RLS esquecida; view sem `security_invoker`.
10. Conflito com decisão registrada ou com trabalho em andamento (`95`/`96`).
11. Estimativa otimista; dependência esquecida; ticket grande demais para um commit.
12. Evidência sobre-afirmada (fornecedor como prova, script como pessoa).

**Entregável:** `09-revisao-adversarial.md` (achado · severidade · evidência · correção) e as correções aplicadas nos arquivos 02–08 (seção "Correções após a revisão", que prevalece).
**Gate G8:** todos os achados respondidos (aceito e corrigido, ou recusado com motivo).

---

# PARTE D · ENTREGA, CONTROLE E PARADA

## D1. Estrutura de pastas

```
docs/98-aprimoramento/
  _progresso.md              ← tabela de fases e gates; atualizar ao fim de cada fase
  01-diagnostico.md
  02-interface.md
  03-funcionalidade.md
  04-facilidade.md
  05-velocidade.md
  06-copy.md
  07-geral.md
  08-plano-e-tickets.md
  09-revisao-adversarial.md
  10-resumo-para-o-eduardo.md   ← 1 página, linguagem simples
  capturas/                   ← <rota>-<largura>-<tema>.png
  medidas/                    ← scripts .mjs e resultados .json (sem segredo)
  prototipos/                 ← HTML estático quando a mudança de tela for grande
```

## D2. `_progresso.md` (modelo)

```
| Fase | Status | Arquivo | Gate | Observação |
| F0 Diagnóstico | EM ANDAMENTO / CONCLUÍDA / BLOQUEADA | 01-diagnostico.md | G0 | … |
| …
Pendências que dependem do Eduardo: …
```

## D3. Gates (resumo)

| Gate | Condição para fechar |
| --- | --- |
| G0 | Rotas, tarefas-régua, desempenho, travamentos, defeitos, textos, capturas e banco medidos; o não medido listado com motivo |
| G1 | Cada tela com antes × depois; as 10 mais usadas com protótipo ou captura anotada |
| G2 | Cada defeito reproduzido ou [NÃO VERIFICADO]; S0/S1 conferidos |
| G3 | Cada tarefa-régua com proposta e medida de sucesso |
| G4 | Cada conserto de velocidade com causa medida |
| G5 | 100% do texto inventariado; mudanças reescritas |
| G6 | Itens gerais com valor, custo e risco |
| G7 | Tickets com aceite medido, ordem, dependências e esforço |
| G8 | Revisão adversarial respondida |

## D4. Formato da resposta final (no chat e em `10-resumo-para-o-eduardo.md`)

1. **Resumo em 10 linhas:** o que mais trava, o que mais confunde, o que mais rende.
2. **Top 10 por impacto para o dono** (o que ele vai sentir), com a onda e o esforço.
3. **Tabela de velocidade:** as 10 ações mais usadas, hoje × meta × conserto.
4. **Ordem de execução** com esforço por onda e total, em faixas.
5. **Riscos maiores** e como foram tratados.
6. **O que depende de mim** (decisões, acessos, autorizações), em ordem.
7. **Perguntas em aberto** (máximo 8), em ordem de impacto.

## D5. O que NÃO fazer

- Implementar qualquer coisa, por menor que seja.
- Refazer o que `docs/11`, `28`, `42`, `61`, `70`, `72` já fizeram, sem antes verificar se ficou de pé.
- Reabrir decisão de `DECISOES.md` sem motivo novo escrito.
- Propor biblioteca nova sem medir o custo (peso, cold start).
- Propor animação sem custo medido.
- Propor "otimizar a trilha de auditoria" (decisão registrada).
- Medir com `pnpm dev` e chamar de desempenho.
- Usar a conta de demonstração como prova de comportamento agregado sem conferir o seed.
- Chamar de "pronto" o que só foi deduzido do código.

## D6. Condições de parada (parar e perguntar)

- Precisar de produção (mesmo leitura) sem autorização escrita minha nesta conversa.
- Precisar de dado real.
- Encontrar conflito com decisão registrada que muda o plano.
- Encontrar S0 em produção (avisar na hora, com evidência, sem consertar).
- Uma meta não puder ser medida com o que existe.
- Outra sessão estiver mexendo nos mesmos arquivos de forma que a medição fique inválida.

## D7. Execução em loop (quando eu pedir `/loop`)

- Uma fase por vez; ao fim de cada uma, atualizar `_progresso.md` e seguir sem esperar.
- Pausa máxima entre checagens: 1 minuto quando houver agente rodando.
- Agentes em paralelo só na Fase 0 (A9) e na Fase 8; nas outras, um por vez para manter coerência.
- Ao terminar a Fase 8, parar o loop e entregar o resumo (D4).
