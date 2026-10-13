# Agente A · Rotas e interface — Fase 0 (subfases 0.2 e 0.8)

Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md` (A3, A5–A9, B1, B2, Fase 0, checklist de 17 itens da Fase 1).
Data: 13/10/2026. Base: worktree `ciclo-aprimoramento`, `origin/main` 33058dd0.

**Ambiente (registrado antes de qualquer consulta):** banco **local** · container `supabase_db_ciclo` · `127.0.0.1:54322` · `docker exec … psql` **só leitura** (`select`) · **não é produção**. App: build de produção em `http://localhost:3200` (não reiniciado). Navegador: Chrome do sistema via Playwright 1.48.2 (`channel: 'chrome'`; o Chromium do Playwright não abre nesta máquina: `spawn UNKNOWN`, provável Smart App Control). Login real pela tela `/entrar` com o dono da `demo-dom-estilo`; `storageState` salvo **fora** do repositório (`C:\temp\ciclo-medicao\estado-A-dono.json`). Nada foi escrito no banco nem no código.

**Carga da máquina:** CPU em 99 % durante a varredura (outros agentes medindo ao mesmo tempo — `Get-CimInstance Win32_Processor`). Tempos de carga desta varredura **não** servem como medida de desempenho; só a geometria, o axe e o foco valem.

**O que foi medido (185 perfis):** 70 rotas × (390×844 claro + 1280×800 claro) + as 15 mais usadas também a 360×640 claro, 390×844 escuro e 1280×800 escuro. Mais um passe de computador (1280×800 e 1440×900) para largura útil e ação principal. Capturas: **209 arquivos** em `capturas/` (18 MB), nome `<rota>-<largura>-<tema>.png`, `ID` no lugar do UUID.

---

## 1 · ACHADOS

Rótulos (A3): **FATO** (com evidência), **[INFERÊNCIA]**, **[HIPÓTESE]**, **[NÃO VERIFICADO]**. Severidade (A8). Todo defeito visual abaixo foi **conferido no navegador** (captura ou `elementFromPoint`); os falsos positivos derrubados estão na seção 1.1.

| ID | Sev. | Tela | Problema | Evidência / captura | Proposta |
|---|---|---|---|---|---|
| A-01 | **S2** | Ficha do cliente (e toda tela com `ActionBar`) | **FATO.** O botão flutuante do assistente fica **em cima** do botão principal "Mensagem" da ficha: a 360 e 390 px o texto aparece cortado ("Mensage") e a metade direita do botão vira toque no assistente. Mesmo `z-30`, mesma faixa vertical: `ActionBar` em `bottom: tabbar+12px` (`components/ui/action-bar.tsx:29-30`), assistente em `bottom: tabbar+16px; right: 16px` (`components/shell/assistente-flutuante.tsx:800-801`). O agendamento público também usa `ActionBar` (`agendar.tsx`). | `capturas/verifica-ficha-fab-360-claro.png`, `verifica-ficha-fab-390-claro.png`, `admin_clientes_ID-390-claro.png` | Quando a tela tem `ActionBar`, o assistente sobe acima dela (ou some e vira item do menu). Aceite: sondagem `elementFromPoint` em 100 % da área do botão "Mensagem" acerta o botão, a 360 e 390. |
| A-02 | **S2** | Todo o painel (shell) | **FATO.** Dois elementos com cor de ação principal (`bg-acc`) ficam **fixos em toda tela**: o botão central da barra ("Recuperar receita") e o assistente flutuante. Somados à ação da própria tela, viram 3 "primários" competindo (Agenda, Agenda/novo, Campanhas, Ficha). E o botão central, a função-bandeira do produto, é **só ícone** no celular (rótulo só no `aria-label`). | Tabela M1 coluna "Primários": 2 em todas as telas do painel; `A-dobra.txt` (`link PRIM 56x56 "Recuperar receita"` sem texto visível) | Decidir uma só cor de ação por tela. Botão central com rótulo visível curto ("Voltar clientes") ou cor neutra; assistente com cor secundária. |
| A-03 | **S2** | `/confirmar/[token]` (público) | **FATO.** A tela pergunta "Confirma seu horário?" **sem dizer qual** (salão, serviço, dia, hora): a página não carrega nada no servidor (`page.tsx` só passa o token) e o cliente não vê dado nenhum. "Preciso desmarcar" **cancela com um toque**, sem confirmação e sem desfazer (`confirmar.tsx:59-72`, `96-104`). O sucesso também não traz o dado ("Seu horário está confirmado. Até lá!", `:113-114`). Com token inválido, a pessoa só descobre depois de tocar. | `capturas/confirmar_TOKEN-FALSO-390-claro.png` | Mostrar "Barbearia X · Corte · qui 15/10 · 14h" antes dos botões (GET pelo token); desmarcar pede "Desmarcar quinta 14h?" com o dado; sucesso repete o dado. |
| A-04 | **S2** | `/admin/comanda/[id]` com id que não existe | **FATO.** Mostra "Não consegui carregar esta tela. **Pode ter sido a conexão.**" com "Tentar de novo"; o console registra **503** e "An error occurred in the Server Components render". A causa dita é falsa (a comanda não existe) e tentar de novo não resolve. | `capturas/admin_comanda_ID-FALSO-390-claro.png`; Tabela M7 | `buscarComanda` sem linha → `notFound()` ou estado "Essa comanda não existe" com "Voltar para a agenda" (mesmo padrão de `comanda/agendamento/[id]`). |
| A-05 | **S2** | Hoje | **FATO + [INFERÊNCIA].** O cartão "Atendido hoje R$ 0,00 · **100 % abaixo do costume**" compara o **dia parcial** (até agora) com a média de **dias inteiros** do mesmo dia da semana (`server/services/resumo-hoje.ts:140,154,175`; `core/ciclo/comparacao-com-costume.ts`). Logo de manhã a frase é sempre "abaixo" — medido às 01h37. E soma `appointments.price_cents` de atendimentos `done` (preço de tabela), enquanto o link do cartão leva ao **Caixa**, que soma **comandas** (com desconto). [INFERÊNCIA] com desconto, os dois números divergem. | `capturas/admin_hoje-390-claro.png`; código citado | Passar ao agente C (fonte única do dinheiro). Interface: comparar só depois do fechamento, ou contra "até esta hora" nos dias anteriores. |
| A-06 | **S2** | Todo o painel no computador | **FATO.** Coluna fixa de 560 px (`admin/layout.tsx:148`, `max-w-[560px]`): conteúdo ocupa 522 de 1048 px úteis = **50 % vazio a 1280** e **57 % a 1440** (descontada a lateral de 232 px). Sem lista + detalhe: Clientes = 3,5 telas de rolagem no monitor, Configurações = 3,5. `docs/11` E5 **continua**. | `medidas/A-computador.md`; `capturas/admin_clientes-1280-claro.png` | Fase 1 item 12: duas colunas em Clientes→Ficha, Agenda→Detalhe, Recuperar→Mensagem, Config→Subtela, a partir de `lg`. |
| A-07 | **S2** | Recuperar receita | **FATO.** A 1ª tela do celular (390×844) tem **25 interativos**: 3 fileiras de filtros (Todas/Na hora/Atrasadas/Em risco/Perdidas · Ouro/Prata/Bronze · Fiel/Regular/Novo/Atrasado/Costuma faltar/Sumido) + "Ordenar por" + 2 avisos. A resposta da tela (a lista ou o vazio) só começa em **y≈665**; o botão do vazio ("Recalcular agora") fica **fora da dobra** no celular e no computador (y=885 a 1280×800). Rótulo repetido em fileiras diferentes ("Atrasadas" × "Atrasado"). Os filtros aparecem com **0 clientes** na lista. | `capturas/admin_recuperar-390-claro.png`; `A-dobra.txt`; `A-computador.md` | Um filtro visível (situação); o resto em "Filtrar" (sheet). Esconder filtros quando a lista está vazia. |
| A-08 | **S2** | Configurações | **FATO.** A 1ª tela é "Sua conta" + um cartão "Sair da conta" com botão de largura cheia + Tema; os itens do 1º dia (Negócio, Serviços, Time) começam em y=674. A página tem **3,4 telas** (2874 px a 390) e 23 itens; descrições cortadas com "…" ("O que o CICLO faz sozinho, e quanta rédea…"). | `capturas/admin_config-390-claro.png` | "Sair" e "Tema" para o fim; agrupar "avançado"; descrição em 1 linha sem corte. |
| A-09 | **S2** | Agenda/novo | **FATO.** Data e hora num único campo nativo `datetime-local` vazio ("dd/mm/aaaa --:--"), sem os horários livres sugeridos — o agendamento **público** mostra os horários livres, o do dono não. O conflito só aparece ao enviar (SLOT_TAKEN). [INFERÊNCIA] mais toques e mais erro na tarefa-régua 2. | `capturas/admin_agenda_novo-390-claro.png` | Reusar a grade de horários do público (dia + horários livres do profissional). Medir toques antes × depois (agente F/tarefas-régua). |
| A-10 | **S2** | `/avaliar`, `/lista-espera`, `/orcamento/[token]` (erro) | **FATO.** Em erro, **0 elementos interativos**: "Não consegui abrir · Esse link… não é mais válido" + "Chame quem vai te atender pelo WhatsApp" **sem link**. Beco sem saída do `docs/15` §24 **continua** (melhorou só o texto). | `capturas/avaliar_TOKEN-FALSO-390-claro.png`, `lista-espera_…`, `orcamento_…`; M1 "Interativos na dobra = 0" | O conserto já especificado no `docs/15` §24 (devolver `slug` e oferecer "Ver a página do estabelecimento"/WhatsApp). |
| A-11 | **S2** | Onboarding · perfil | **FATO.** "Pular tudo e ir pro painel" e "Pular esta pergunta" têm **16–18 px** de altura efetiva (não são links inline; sem `toque-48`). | Tabela M3; `capturas/onboarding_perfil-390-claro.png` | Botão `ghost` de 48 px. |
| A-12 | **S2** | Clientes × Recuperar | **FATO + [INFERÊNCIA].** Em Clientes, "Voltam de novo **100 %**" na mesma tela em que **6** cartões dizem "sumido"; em Recuperar, "0 clientes para recuperar" porque "o Motor ainda não processou". Três leituras do mesmo assunto que não conversam. Depende do seed (nenhum `client_cycles` calculado) — mas o mesmo estado existe em conta nova recém-importada. | `capturas/admin_clientes-390-claro.png`, `admin_recuperar-390-claro.png` | Passar a C/E: mesma fonte para "sumido" e para a fila do Recuperar; rótulo "Voltam de novo" explicado ("voltaram ao menos uma vez"). |
| A-13 | **S2** | Campanhas | **FATO.** Dois botões primários na tela ("Nova campanha" e "Criar a primeira", mesmo destino) e o "voltar" leva a **Configurações** (`components/shell/navegacao.ts:24-25`), embora se chegue por Hoje ("aniversariantes") e pelo menu. Hoje → campanhas/nova → voltar = Campanhas → voltar = Configurações. | `capturas/admin_campanhas-390-claro.png` | Um primário; voltar pelo caminho de chegada mais comum. |
| A-14 | S3 | Todo o painel | **FATO.** O assistente flutuante cobre conteúdo na 1ª tela: o `>` do 3º cartão de Hoje e o valor "Comandas" do Caixa (some ao rolar 74 px). | `capturas/admin_hoje-390-claro.png`, `admin_caixa-390-claro.png` | Mesmo conserto de A-01 (folga lateral ou posição que não cubra a coluna). |
| A-15 | S3 | Agenda a 360 px | **FATO.** Botões de dia da semana com **43–44 px** de largura (altura 64). | Tabela M3 | Rolagem lateral de dias com 48 px, ou 6 dias visíveis. |
| A-16 | S3 | Trilhos com rolagem lateral (Agenda, Recuperar, agendar público) | **FATO.** A máscara de esmaecimento (`globals.css:574`, 12 px à esquerda) apaga a borda do **primeiro item, que é o selecionado** ("Todos", "Todas", "TER 13"). O conserto do `docs/11` E6 trocou "cortado à direita" por "esmaecido à esquerda". | `capturas/admin_agenda-390-claro.png`, `demo-dom-estilo_agendar-390-claro.png` | Máscara só do lado que tem mais conteúdo (`scrollLeft > 0`). |
| A-17 | S3 | axe | **FATO.** 3 nós com contraste insuficiente em `config/automacoes` (claro); link do logo sem nome acessível em `/calculadora` e `/precos` (`link-name`). Nas 15 principais, claro e escuro: **0** violações. | Tabela M4 | `aria-label="CICLO, início"`; ajustar o token do selo em automações. |
| A-18 | S3 | Rotas do pacote advocacia numa conta base | **FATO.** "Página não encontrada" com **HTTP 200** (soft 404, porque o `loading.tsx` já começou o streaming), **sem a barra do painel**; "Voltar ao início" leva a `/`. Console: `ERR_SSL_PROTOCOL_ERROR` no prefetch de `/` (local). Não há link para essas rotas no menu da conta base. | Tabela M7; `capturas/admin_casos-390-claro.png` | `not-found.tsx` dentro de `/admin` com a casca e "Ir para Hoje". |
| A-19 | S3 | Links inline | **FATO.** "Registrar compra" (ficha de consumo do serviço, 15 px) e 2 links nos Termos (17 px) abaixo de 48 px. São links dentro de texto (exceção da WCAG 2.5.8; a regra da casa pede 48). Não usar `toque-48` em dois links do mesmo parágrafo (CLAUDE.md). | Tabela M3 | Avaliar caso a caso; botão próprio para "Registrar compra". |
| A-20 | S3 | Tipografia | **FATO.** Menor fonte visível = **11 px** (token `--text-overline`, `globals.css:360`) em rótulos de seção e de número em 22 das 70 telas (uppercase + tracking 0,13 em). Um tamanho fora da escala: **26,4 px** em `/links`. | Tabela M8 | Overline a 12 px; `/links` no token. |
| A-21 | S3 | Menu da Topbar | **FATO (código).** O menu fixo (Caixa, Serviços, Time, Campanhas, Estoque, Recorrência, Configurações — `components/shell/topbar.tsx:22-29`) **não filtra** por pacote, módulo desligado nem papel. Módulo desligado só some do hub de Config (`config/page.tsx:129`). | código | Filtrar o menu pela mesma regra do hub. |
| A-22 | S3 | Ficha e Clientes | **FATO.** "Ticket médio" (jargão — regra de copy 7) em Clientes e na Ficha; na Ficha, "Valor atendido R$ 225,00" ao lado de "Sobrou R$ 0,00 · nenhuma comanda fechada ainda" — duas contas de fontes diferentes lado a lado sem explicar. | `capturas/admin_clientes_ID-390-claro.png` | Passar ao agente D (copy) e C (fonte). |
| A-23 | S3 | Mês vazio | **FATO.** Com o mês vazio, o 1º bloco é "Testar antes de decidir" (experimentos) — convite a uma função avançada antes de existir qualquer número. | `capturas/admin_mes-390-claro.png` | Esconder o cartão até haver 1 mês fechado. |
| A-24 | S3 | Agendar público | **FATO.** A fileira de dias mostra **DOM 18** (fechado) mas não mostra SEG (também fechado) — critério de exibição inconsistente. [HIPÓTESE] DOM aparece porque cai no fim da janela de 6 dias. Como validar: ler a geração dos dias em `agendar.tsx`. | `capturas/demo-dom-estilo_agendar-390-claro.png` | Mesma regra para todos os dias fechados (esconder ou mostrar "fechado"). |

**[NÃO VERIFICADO] que importa:**
- **Comanda com itens, Caixa e Mês com números** — o seed tem **0 comandas e 0 pagamentos** nos 6 negócios (consulta `select count(*) from tickets/payments where tenant_id=…` → 0) e **nenhum agendamento hoje** (1 futuro por negócio). Motivo: o seed não cria comanda (ver comentário em `comanda/agendamento/[appointmentId]/page.tsx:20-24`). Quem destrava: seed com comandas abertas/fechadas e agendamentos no dia (decisão do Eduardo; este agente não escreve no banco).
- **Interface do pacote advocacia** — não existe login de dono da `demo-alvorada-advocacia` no `auth.users` local. Quem destrava: seed com esse login.
- **Confirmar/avaliar/orcamento com token válido** — o token é HMAC sem estado assinado com `CRON_SECRET` (`server/services/token-assinado.ts:36,51-56`); gerar um exigiria ler o segredo, o que este agente não faz. A tela de confirmar não depende do token para desenhar (A-03 é por código + captura).

### 1.1 · Falsos positivos derrubados (registro honesto)

A sondagem automática acusou e a conferência no navegador **desmentiu**:

| Acusação da varredura | O que a conferência mostrou | Evidência |
|---|---|---|
| 20 caixas de seleção de 20×20 px (Agenda/novo, Clientes/nova, Mensagens, Módulos ×17) | Todas têm `<label>` associado de **48×48 ou maior**; o toque no rótulo marca a caixa | `node A-verifica.mjs rotulos …` (saída na seção 6) |
| Campo de data do Caixa com 23 px | `label` "Ir para" de **242×48** | idem |
| Foco invisível no campo de data/hora (Caixa, Horários, Clientes/nova) | Focado de verdade, o contorno de 2 px aparece (`outline: solid 2px rgb(11,125,111)`); a varredura leu o estilo com o foco dentro do subcampo nativo | `capturas/verifica-foco-caixa-data-390-claro.png`, `…horarios-hora…` |
| "Confirmar agendamento" do público coberto (alvo zero) | A `ActionBar` está escondida de propósito (`opacity: 0; pointer-events: none`) até a pessoa preencher | `medidas/A-verifica-agendar.mjs` |
| Contorno de foco branco em "Novo agendamento" (Hoje, Tab 9) | Há anel visível (contorno claro + anel escuro do botão) | `capturas/verifica-foco-hoje-tab9-390-claro.png` |

---

## 2 · Inventário de rotas (0.2)

**FATO — contagem:** `find src/app -name page.tsx` devolve **70** páginas, não 64 como diz o contrato (A4 item 9). As 7 a mais em relação à lista B1 são do pacote advocacia (`admin/casos`, `casos/novo`, `casos/[id]`, `intimacoes/[id]`, `pendencias`, `clientes/[id]/estrutura`, `config/advocacia`) e `dev/ui`. **Ajustar a régua do G0 para 70.** `src/app/global-error.tsx` existe (B1 ok).

**Notas comuns (FATO — leitura de código por subagente de busca, conferida por amostragem):**
- Toda página do painel passa por `contextoDoPainel` (`src/server/auth/tenant.ts:208`); sem negócio → `/onboarding`. Exceções: `config/seguranca`, `config/excluir-conta`, `config/notificacoes`.
- **Nenhuma `page.tsx` tem `'use client'`**; a interatividade mora nos componentes-filho.
- `loading.tsx` existe em **todas** as rotas do painel menos `/admin` (só redireciona) e `config/excluir-conta`. **Nenhuma** rota pública/entrada tem `loading.tsx`. (`docs/11` E4: **resolvido** no painel.)
- **Sem conexão:** só `agenda/novo` usa `apiFetch` de `lib/offline` (`src/lib/offline/api-client.ts:136`), que enfileira. O resto do painel usa `fetch` cru; o aviso global é o `IndicadorDeConexao` do layout. As telas jurídicas usam `escreverJuridico` (`src/lib/advocacia/escrever.ts:10`), que recusa na hora se offline.
- **Papéis** (`src/server/auth/rbac.ts:12-33`): `report:read` (owner, manager, finance) guarda Caixa/Mês/Experimentos; `inventory:read` guarda Estoque; `commission:read` guarda Comissão; `client:export` só owner.
- **Módulo desligado pelo dono só some do hub** (`config/page.tsx:129`); caixa, mes, estoque, series, campanhas, taxas e custo-fixo abrem pela URL e pelo menu da Topbar (A-21).

**Frequência:** **[INFERÊNCIA]** pelo papel da tela no dia (B3) e pela posição na navegação (barra inferior = alta). Telemetria por rota **[NÃO VERIFICADO]** — Motivo: `product_events` local é seed. Quem destrava: agente E / produção com autorização.

Legenda de estados: **L** loading.tsx · **V** vazio com texto · **E** erro próprio (fora do boundary) · **S** sucesso (toast/aria-live) · **O** sem conexão tratado. "bnd" = só o boundary `admin/error.tsx`.

### 2.1 Painel — operação do dia

| Rota | Propósito | Quem usa | Frequência estimada (motivo) | Dados que carrega (servidor) | Ações | Estados |
|---|---|---|---|---|---|---|
| `/admin` | Redireciona para `/admin/hoje` (`page.tsx:12`) | todos | toda abertura (ícone do PWA) | nada | — | sem L (redirect) |
| `/admin/hoje` | Resumo do dia e "vale a pena hoje" | todos (sem guarda de papel) | **várias vezes por hora** (tela inicial) | `Promise.all` de 5 (`page.tsx:73-127`): resumoDeHoje, centralDeAcoes, receitaAtribuidaAoCiclo, listarParaRecuperar(1), prestacaoDeContasDoMotor; `after()` (`:140`) | Ver meu site, Compartilhar link, cartões-link, sheet do agendamento (`/api/v1/appointments/{id}/{acao}`), Novo agendamento | L · V "Nada mais para hoje" · E: 4 de 5 chamadas com `.catch` que loga e devolve zero (`:83-126`) — **a tela não avisa** · S toast · O não |
| `/admin/agenda` | Agenda do dia por profissional | todos (RLS filtra) | **várias vezes por hora** | `Promise.all` (`:40-43`): agenda do dia, profissionais | dia/profissional (searchParams), Marcar, detalhe, comanda | L · V "Nada marcado nesse dia" · bnd · S toast + aria-live (`agenda.tsx:184`) |
| `/admin/agenda/novo` | Novo agendamento | todos; repetição exige `recurrence` (`:37`) | **várias vezes ao dia** ("Marcar") | `Promise.all` (`:19-23`): serviços, profissionais, plano | POST `/api/v1/appointments` (**`apiFetch`**), séries, busca de cliente, converter orçamento | L · E inline, alternativas no SLOT_TAKEN · S toast · **O sim (único)** |
| `/admin/comanda/[id]` | Itens, desconto, fechamento | todos; "sobra" só `report:read` (`:33`) | **a cada atendimento** | `Promise.all` de 5 (`:96-105`), `sobraPromise` encadeada | itens POST/DELETE, PATCH, fechar | L · V "Nenhum item ainda." · bnd (A-04) · S toast + aria-live |
| `/admin/comanda/agendamento/[appointmentId]` | Ponte agenda → comanda | todos | a cada atendimento | 1 consulta + redirect | Voltar para a agenda | L · V "Esse atendimento não tem comanda" |
| `/admin/caixa` | Fechamento do dia/mês, comissão | `report:read` (`:56`) | **diária** (fim do dia) | `Promise.all` de 8 (`:120-146`) + comissões encadeadas (`:102-118`) | ontem/amanhã (`?dia=`), links | L · V "Nenhuma comanda fechada nesse dia" |
| `/admin/mes` | Resumo do mês e vazamentos | `report:read` (`:45`) | semanal/mensal | `Promise.all` de **13** (`:65-99`) | links | L · V "Nenhuma comanda fechada este mês ainda" (medido) |
| `/admin/recuperar` | Motor de Ciclo: quem chamar de volta | todos (sem guarda) | **diária** (botão central) | `Promise.all` de 8 (`:48-92`) + `comNotas` **em série** (`:127`) | filtros, mensagem WhatsApp, PATCH cliente, marcar manual, recalcular | L · V `vazioDeRecuperar` (5 variantes) · S toast + aria-live |
| `/admin/series` | Séries de recorrência | todos; não checa módulo | rara | 1 | cancelar série | L · V · S toast **sem aria-live** |

### 2.2 Painel — clientes

| Rota | Propósito | Quem usa | Frequência | Dados | Ações | Estados |
|---|---|---|---|---|---|---|
| `/admin/clientes` | Carteira com busca e fases | todos; exportar só owner | **diária** (barra) | `Promise.all` (`:41-45`) | busca GET `/api/v1/clients`, Nova, Exportar | L · V · aria-live (`lista.tsx:188`) |
| `/admin/clientes/[id]` | Ficha em 4 abas (Resumo, Histórico, Fidelidade, Ficha) | todos; flags por papel e plano (`:45-111`) | **várias vezes ao dia** (cliente na cadeira) | `Promise.all` de 8 (`:41-70`) | ~12 rotas de escrita (notas, fidelidade, assinatura, mídia, consentimento, cofre, exportar, apagar) | L · S toast + aria-live |
| `/admin/clientes/[id]/estrutura` | Estrutura societária | só advocacia (`notFound` `:32`) | — | 2 em série | `escreverJuridico` | L · V |
| `/admin/clientes/exportar` | Baixar planilha | owner | rara | nada | POST export | L · S |
| `/admin/clientes/importar` | Importar CSV | todos | uma vez | serviços | preview + import | L · S |
| `/admin/clientes/ja-atendo` | Cadastro de memória | todos | primeiros dias | `Promise.all` de 3 (inclui `appointments done limit 1000`) | busca, POST | L · V com link · S toast sem aria-live |
| `/admin/clientes/nova` | Cadastrar cliente | todos | diária | 2 em série | POST clients | L · S |
| `/admin/clientes/vindo-de-outro-sistema` | Guia de migração | todos | uma vez | plano | links | L · estático |

### 2.3 Painel — vendas, relatórios, estoque

| Rota | Propósito | Quem usa | Frequência | Dados | Ações | Estados |
|---|---|---|---|---|---|---|
| `/admin/campanhas` | Resultado das campanhas | todos; plano `campaigns` | semanal | **5 consultas em série** (`:34-105`) | Nova campanha | L · V · `.catch` devolve zero |
| `/admin/campanhas/nova` | Montar e disparar | todos; plano bloqueia | semanal | `Promise.all` de 4 | POST campaigns | L · V · S toast sem aria-live |
| `/admin/orcamentos` | Lista de orçamentos | todos; plano `quotes` | semanal (depende do vertical) | `Promise.all` de 2 | copiar link, Novo | L · V |
| `/admin/orcamentos/novo` | Criar orçamento | todos; **sem checar plano** | semanal | 1 | POST quotes | L · aria-live |
| `/admin/comissao` | Extrato da própria comissão | `commission:read`; dono vê cartão apontando o Caixa | semanal (profissional) | 2 em série | — | L · V (2 variantes) |
| `/admin/estoque` | Produtos e entradas | `inventory:read` | semanal | `Promise.all` de 3 | entrada, produto | L · V · S |
| `/admin/experimentos` | Testes antes/depois | `report:read`; criar só owner | rara | 1 | criar/cancelar | L · V · S |

### 2.4 Painel — advocacia (só `pacote = advocacia`; `notFound()` nos outros)

| Rota | Propósito | Frequência | Dados | Estados |
|---|---|---|---|---|
| `/admin/casos` | Lista de casos | diária (advocacia) | 3 em série | L · V (3 variantes) |
| `/admin/casos/novo` | Abrir caso | semanal | plano + `Promise.all` de 2 | L · aria-live |
| `/admin/casos/[id]` | Prazos, pendências, documentos | diária | 1 + `Promise.all` de 4 | L · V · S |
| `/admin/pendencias` | Fila do que falta | diária | 2 em série | L · V · S |
| `/admin/intimacoes/[id]` | Triagem de intimação | diária | 3 em série | L · S |
| `/admin/config/advocacia` | OAB, prazos, captura | rara | `Promise.all` de 3 | L · V |

**FATO medido:** logado como dono da Dom Estilo (pacote base), as 7 rotas jurídicas mostram "Página não encontrada" com HTTP 200 (A-18).

### 2.5 Configurações (hub + 17 subtelas)

| Rota | Propósito | Frequência | Dados | Ações | Estados |
|---|---|---|---|---|---|
| `/admin/config` | Hub agrupado, tema, sair | semanal | `listarModulos` | links, tema (cookie), sair | L · aria-live no sair |
| `config/automacoes` | Autonomia das automações | rara | 1 | salvar | L · toast **sem aria-live** · axe contraste (A-17) |
| `config/cofre` | Trilha de acesso à saúde | rara | 1 | — | L · V |
| `config/custo-fixo` | Aluguel e contas | mensal | 1 | salvar | L · S |
| `config/excluir-conta` | Apagar login | uma vez | nada | DELETE com Sheet | **sem L** · S · console: 1 recurso 401 na carga ([NÃO VERIFICADO] qual) |
| `config/horarios` | Expediente e folgas | rara | `Promise.all` de 2 | salvar, folga | L · toast sem aria-live |
| `config/mensagens` | Modelos e pausa | rara | `Promise.all` de 2 | CRUD, pausar | L · V · S |
| `config/meu-plano` | Plano do CICLO | rara | `Promise.all` de 4 | assinar, cancelar, indicar | L · aria-live, sem toast |
| `config/modulos` | Ligar/desligar módulos | rara | 1 | salvar | L · aria-live sem toast |
| `config/negocio` | Dados e imagens do site | 1º dia | 1 | salvar, imagens | L · S |
| `config/notificacoes` | Ativar push | 1º dia | nada | inscrever | L · **sem toast e sem aria-live** |
| `config/planos` | Fidelidade/planos do cliente | rara | `Promise.all` de 6 | salvar | L · V · S |
| `config/profissionais` | Time e convites | 1º dia | `Promise.all` de 2 | convidar, editar | L · V · toast |
| `config/profissionais/[id]` | Expediente de um profissional | rara | `Promise.all` de 4 | salvar | L · toast sem aria-live |
| `config/seguranca` | 2FA | rara | `Promise.all` de 2 | ativar/desativar | L · S |
| `config/servicos` | Catálogo e margens | 1º dia | `Promise.all` de 2 | reordenar, CRUD | L · V · S |
| `config/servicos/[id]/ficha` | Consumo por serviço | rara | `Promise.all` de 4 | salvar | L · V · S |
| `config/taxas` | Taxa da maquininha | uma vez | 1 | salvar | L · S |

### 2.6 Público, entrada e onboarding

| Rota | Propósito | Quem usa | Frequência | Dados | Ações | Estados |
|---|---|---|---|---|---|---|
| `/` | Landing | visitante | — | 1 consulta, `revalidate 600`; logado → `/admin/hoje` | Cadastro, Entrar, demo, calculadora | sem L |
| `/[slug]` | Página do negócio | cliente final | **alta** | `perfilPublico` (`cache()`, `Promise.all` de 6), `force-dynamic` | Agendar, Orçamento, WhatsApp, Maps, tel | sem L · conta pausada própria · `notFound` |
| `/[slug]/agendar` | Agendar online | cliente final | **por agendamento** | 3 em série + 2 GET no cliente | POST book | sem L · V "Sem horários livres" · E SLOT_TAKEN · O mensagem · S cartão |
| `/[slug]/orcamento` | Pedir orçamento | cliente final | baixa | `perfilPublico`; sem serviço "sob orçamento" → 404 (medido) | POST com idempotency | E · O · S |
| `/avaliar/[token]` | Avaliar atendimento | cliente final | por atendimento | GET no cliente | POST nota | "Carregando…" · E sem saída (A-10) · S |
| `/confirmar/[token]` | Confirmar/desmarcar | cliente final | por lembrete | **nada** no servidor | POST confirm/cancel | E · S (A-03) |
| `/lista-espera/[token]` | Pegar encaixe | cliente final | rara | **POST ao abrir** (`reivindicar.tsx:25`) | nenhuma | E sem saída · S |
| `/orcamento/[token]` | Ver/aprovar orçamento | cliente final | baixa | GET no cliente | aprovar/recusar | 4 estados + E sem saída |
| `/links`, `/calculadora`, `/precos`, `/privacidade`, `/termos` | Institucional/aquisição | visitante | — | constantes | links | estáticos |
| `/cadastro` | Criar conta | dono novo | uma vez | 2 em série | signup, reenviar, OAuth | E · O · S |
| `/entrar` | Login | dono/equipe | diária | 2 em série | login, MFA | E · O |
| `/recuperar-senha`, `/nova-senha`, `/verificar` | Recuperação e 2FA | dono | rara | sessão; sem sessão redirecionam (medido) | POST | E · O |
| `/onboarding` | Criar o negócio | dono novo | uma vez | 3 em série; com vínculo → `/admin/hoje` (medido) | POST | E · O |
| `/onboarding/perfil` | De onde vêm os clientes | dono novo | uma vez | 2 em série | POST, segue mesmo com erro | sem mensagem de erro · A-11 |
| `/dev/ui` | Vitrine de componentes | dev | — | — | — | 404 em produção (medido) |

**Tema (FATO):** `<html class="dark">` fixo (`src/app/layout.tsx:93`); no painel o cookie `ciclo-tema` decide (`admin/layout.tsx:101-102`: ausente = **claro**); **todas** as telas públicas cravam `data-theme="light"` (`tela-publica.tsx:50`, `[slug]/layout.tsx:84`, landing `page.tsx:291`). As capturas "escuro" das públicas são iguais às claras **de propósito**.

---

## 3 · As 15 telas mais usadas — 1ª tela do celular (390×844, claro)

Fonte: `medidas/A-dobra.txt` (gerado de `A-varredura.json`). **Comum a todas as telas do painel** (não repetido abaixo): barra inferior com 5 itens (Hoje, Agenda, **Recuperar receita só ícone**, Clientes, Marcar) e o **assistente flutuante** (56×56, `bg-acc`, só ícone). LEITOR = quem lê; DECISÃO = o que a pessoa decide com aquilo.

### Resumo das 15

| Tela | Interativos na dobra | Primários (`bg-acc`) na tela, incl. shell | Números concorrentes na dobra (≥21 px ou destaque) | Ícones sem rótulo visível | Ação principal visível sem rolar (390 / 1280) |
|---|---|---|---|---|---|
| Hoje | 14 | 2 (shell) + "Novo agendamento" fora da dobra | 1 (R$ 0,00) + "100 % abaixo" | 4 (Menu, Compartilhar, centro, assistente) | não (y≈1080) / não (y≈964) |
| Agenda | 19 | 2 + dia selecionado + "Novo agendamento" | 2 (0 %, R$ 0,00) | 3 | sim (vazio) / sim |
| Agenda/novo | 14 | 3 (Confirmar + shell) | 0 | 2 | sim / sim |
| Comanda (ponte, sem comanda) | 8 | 2 | 0 | 2 | sim / sim — **com itens [NÃO VERIFICADO]** |
| Caixa | 10 | 2 | 3 (Entrou, Sobrou, Comandas) | 3 (setas de dia + shell) | n/a (tela de leitura) |
| Clientes | 17 | 2 | 3 (R$ 66,35, 100 %, 2) + 1 valor por linha | 4 (Menu, Cadastrar cliente, shell) | n/a |
| Ficha do cliente | 18 | 3 (Mensagem + shell) | 5 (225, 0, 5, 45, 0) | 3 (Editar ficha + shell) | sim, **mas coberto em parte (A-01)** |
| Recuperar | **25** | 2 + "Recalcular agora" fora da dobra | 3 (R$ 0, R$ 0 de lucro, 0) | 3 | não / não (y=885) |
| Campanhas | 10 | **3** (Nova campanha, Criar a primeira, + shell = 4) | 3 (R$ 0, 0, "de 0") | 2 | sim / sim |
| Mês | 9 | 2 | 0 (vazio) | 3 | n/a |
| Configurações | 14 | 2 | 0 | 2 | n/a |
| Orçamentos | 8 | 2 | 0 ("0 orçamentos") | 2 | sim / sim |
| Página do salão | 7 | 1 | 6 preços (lista, ok) | 0 | sim / sim |
| Agendar público | 10 | 1 (oculto até preencher) | 6 preços | 0 | n/a até escolher horário |
| Confirmar | 2 | 1 | 0 | 0 | sim / sim |

### 3.1 Hoje

| Elemento | Tipo | Texto | LEITOR | DECISÃO | Veredito |
|---|---|---|---|---|---|
| Menu (☰) | botão ícone | — | dono | ir a Caixa/Serviços/… | MANTÉM (rótulo "Mais") |
| Data | texto 11 px | "terça-feira, 13 de outubro" | dono | nenhuma | SIMPLIFICA (junta ao título) |
| Saudação | h1 | "Bom dia" (às 01h37) | dono | nenhuma | SIMPLIFICA (título que responde a pergunta: "Hoje: 0 atendimentos") |
| Nome do negócio | texto | "Barbearia Dom Estilo" | dono | nenhuma | REMOVE (já sabe onde está) |
| Ver meu site | link 12 px | — | dono | conferir site | ESCONDE (menu) |
| Compartilhar link | botão ícone | — | dono | mandar link | MANTÉM |
| Atendido hoje | cartão-link | "R$ 0,00 · 100 % abaixo do costume · Nada mais marcado · Ver o caixa" | dono | "o dia está fraco?" | SIMPLIFICA (A-05) |
| "Vale a pena hoje" + 3 cartões | links | "Diga quando cada pessoa veio…", "2 aniversariantes…", "Você ainda não disse quanto a maquininha cobra…" | dono | fazer uma tarefa de configuração/relacionamento | SIMPLIFICA (1 cartão, o mais valioso; os outros em "Ver mais") |
| Ver mais 2 | botão | — | dono | ver mais | MANTÉM |
| Agenda do dia / "Nada mais para hoje" + Novo agendamento | vazio | abaixo da dobra | dono | marcar | **sobe** (é a resposta a "o que faço agora") |

**Veredito da tela:** a pergunta "o que faço agora?" é respondida pelos cartões de **configuração** (fichas, maquininha), não pela agenda do dia, que fica abaixo da dobra. Num dia com atendimentos [NÃO VERIFICADO — seed sem agendamento hoje].

### 3.2 Agenda

| Elemento | Tipo | Texto | LEITOR | DECISÃO | Veredito |
|---|---|---|---|---|---|
| Título | h1 | "Agenda" | todos | — | MANTÉM |
| 7 dias | botões 47×64 (43 a 360) | DOM 11 … SÁB 17 | todos | trocar o dia | MANTÉM (A-15; falta ir à semana seguinte — [HIPÓTESE] por deslize; validar) |
| Profissionais | trilho de chips | Todos, Anderson, Diego, Felipe… | dono/recepção | filtrar | MANTÉM (A-16) |
| Ocupação do dia | número | "0 %" | dono | "vale chamar alguém?" | MANTÉM |
| Previsto | número | "R$ 0,00" | dono | nenhuma no momento | ESCONDE (vai para Caixa/Hoje) |
| Vazio | cartão | "Nada marcado nesse dia · Toque no botão + …" + Novo agendamento | todos | marcar | MANTÉM (o texto cita "botão +" e há outro botão logo abaixo: SIMPLIFICA) |

### 3.3 Agenda/novo

| Elemento | Tipo | Texto | LEITOR | DECISÃO | Veredito |
|---|---|---|---|---|---|
| Voltar | link | "< Agenda" | todos | voltar | MANTÉM |
| Serviço | select | "Barba · R$ 35,00" (1º da lista pré-escolhido) | todos | escolher serviço | SIMPLIFICA (sem pré-escolha arbitrária ou o mais vendido) |
| Profissional | select | "Anderson Rocha" | todos | escolher | MANTÉM |
| Cliente | input busca | "Nome" | todos | achar/criar | MANTÉM |
| Telefone | input | "(11) 98765-4321" | todos | — | MANTÉM |
| Data e horário | `datetime-local` | "dd/mm/aaaa --:--" | todos | escolher horário | **SIMPLIFICA** (A-09) |
| Repetir este horário | checkbox + label 48 | — | dono | criar série | ESCONDE (avançado) |
| Confirmar agendamento | botão primário | — | todos | gravar | MANTÉM |

### 3.4 Comanda

Só foi possível ver a **ponte** (`/admin/comanda/agendamento/[id]` → "Esse atendimento não tem comanda", 1 título, 1 texto, 1 link) e o erro de id inexistente (A-04). A comanda com itens é **[NÃO VERIFICADO]** (seed sem comanda). Elementos da ponte: título "Comanda" (MANTÉM), estado vazio que explica e oferece "Voltar para a agenda" (MANTÉM).

### 3.5 Caixa

| Elemento | Tipo | Texto | LEITOR | DECISÃO | Veredito |
|---|---|---|---|---|---|
| Voltar | link | "< Hoje" | dono | — | MANTÉM |
| Sobretítulo + título + data | textos | "HOJE / Caixa / terça-feira, 13 de outubro" | dono | — | SIMPLIFICA ("Caixa de hoje") |
| Dia anterior / Ir para / Próximo | 2 setas + data nativa | — | dono | trocar o dia | MANTÉM |
| Vazio | cartão | "Nenhuma comanda fechada nesse dia" + Ver a agenda | dono | ir fechar | MANTÉM |
| Mês | 3 linhas | "Entrou no mês R$ 0,00 · Sobrou no mês R$ 0,00 · Comandas 0" | dono | "como vai o mês" | MANTÉM (valor "Comandas" coberto pelo assistente na 1ª tela — A-14) |

### 3.6 Clientes

| Elemento | Tipo | Texto | LEITOR | DECISÃO | Veredito |
|---|---|---|---|---|---|
| Título + contagem | h1 + texto | "Clientes · 22 na carteira" | todos | — | MANTÉM |
| Cadastrar cliente | botão ícone | — | todos | cadastrar | SIMPLIFICA (rótulo visível "Nova") |
| Baixar todos em planilha | link 12 px | — | dono | exportar | ESCONDE (menu da tela) |
| Ticket médio | número | "R$ 66,35" | dono | nenhuma no balcão | ESCONDE (Mês) — e é jargão (A-22) |
| Voltam de novo | número + barra | "100 %" | dono | — | ESCONDE/REVÊ (A-12) |
| Aniversariantes | cartão | "2 fazem aniversário esse mês" | dono | mandar parabéns | MANTÉM |
| Busca | input | "Nome ou telefone" | todos | achar cliente | **SOBE** (é a ação da tela; hoje está na metade da dobra, y=401) |
| Filtros | trilho | Aniversariante, Primeira visita sem volta, Ticket alto | dono | filtrar | SIMPLIFICA |
| Lista | cartões-link | nome, telefone, valor, visitas, selo | todos | abrir ficha | MANTÉM (valor em R$ por linha: [INFERÊNCIA] a recepção não precisa ver) |

### 3.7 Ficha do cliente

| Elemento | Tipo | Texto | LEITOR | DECISÃO | Veredito |
|---|---|---|---|---|---|
| Voltar | link | "< Clientes" | todos | — | MANTÉM |
| Avatar + nome + telefone · origem | cabeçalho | "Ana Souza · (11) 9300-2000 · Instagram" | todos | — | MANTÉM |
| Editar ficha | botão ícone (lápis) | — | dono | editar | MANTÉM |
| Selo | chip | "sumido" | dono | chamar de volta | MANTÉM |
| Padrão | texto | "Costuma vir às terças (5 de 5 visitas). Sempre com Anderson Rocha…" | profissional | — | MANTÉM (bom) |
| Como atender | cartão | "Nada anotado ainda. Toque para registrar…" | profissional | anotar | MANTÉM (`docs/11` E1 pedia isto no topo: **resolvido**) |
| Abas | 4 botões | Resumo, Histórico, Fidelidade, Ficha | todos | navegar | MANTÉM |
| 5 números | tiles | Valor atendido, Sobrou, Visitas, Ticket médio, Faltas | dono | — | SIMPLIFICA (2 números; "Sobrou" ao lado de "Valor atendido" confunde — A-22) |
| Criar orçamento / Indicar | 2 botões cheios | — | dono | — | ESCONDE (menu da ficha) |
| Horário / Mensagem | barra de ação | — | todos | marcar / chamar | MANTÉM (A-01 cobre "Mensagem") |

### 3.8 Recuperar receita

| Elemento | Tipo | Texto | LEITOR | DECISÃO | Veredito |
|---|---|---|---|---|---|
| Título + subtítulo | h1 + texto | "Recuperar receita · Quem o Motor de Ciclo identificou em atraso para voltar." | dono | — | SIMPLIFICA ("Motor de Ciclo" é nome interno) |
| Campanhas | link | — | dono | ir a campanhas | ESCONDE |
| Dá para recuperar / Clientes | 2 tiles | "R$ 0,00 · R$ 0,00 de lucro · 0" | dono | "vale a pena?" | MANTÉM 1 número |
| "Estimativa, não promessa" | `details` | — | dono curioso | — | MANTÉM (fechado) |
| Aviso de custo | texto + link | "6 serviços estão sem o custo do material… Completar o custo" | dono | configurar | ESCONDE (vai para Hoje "vale a pena") |
| 3 fileiras de filtros + Ordenar | 15 chips + select | ver A-07 | dono | filtrar | SIMPLIFICA → 1 fileira + "Filtrar" |
| Lista/vazio | cartão | "O Motor ainda não processou… Recalcular agora" | dono | chamar cliente | **SOBE** |

### 3.9 Campanhas

| Elemento | Tipo | Texto | LEITOR | DECISÃO | Veredito |
|---|---|---|---|---|---|
| Voltar | link | "< Configurações" | dono | — | REVÊ (A-13) |
| Título + subtítulo | — | "Campanhas · Quem voltou depois de receber mensagem, e quanto isso trouxe" | dono | — | MANTÉM |
| Voltaram este mês / Atendimentos | 2 tiles | "R$ 0,00 · 0 de 0 mensagens" | dono | "funcionou?" | ESCONDE quando 0 |
| Nova campanha | botão primário | — | dono | criar | MANTÉM |
| Resultados (vazio) + Criar a primeira | cartão + 2º primário | — | dono | criar | REMOVE o 2º botão |

### 3.10 Mês

Título "O mês" + subtítulo (MANTÉM) · cartão "Testar antes de decidir" (ESCONDE até haver mês fechado — A-23) · vazio "Nenhuma comanda fechada este mês ainda… Ver a agenda" (MANTÉM). Com dados: **[NÃO VERIFICADO]** (seed sem comanda).

### 3.11 Configurações

| Elemento | Tipo | LEITOR | DECISÃO | Veredito |
|---|---|---|---|---|
| Voltar "< Hoje" | link | dono | — | MANTÉM |
| Sua conta (e-mail, papel) | cartão | dono | — | SIMPLIFICA (1 linha) |
| Sair da conta (texto + botão cheio) | cartão | dono | sair | **move para o fim** (A-08) |
| Tema (3 opções) | segmentado | dono | aparência | move para o fim |
| Negócio / Serviços / Time… | 23 links agrupados | dono | configurar | MANTÉM, sobe |

### 3.12 Orçamentos

"< Configurações" (REVÊ: chega-se pela ficha "Criar orçamento" também) · "Orçamentos · 0 orçamentos" (SIMPLIFICA: "0 orçamentos" repete o vazio) · vazio "Nenhum orçamento ainda · Monte um orçamento, mande o link…" + "Criar orçamento" (MANTÉM).

### 3.13 Página do salão (`/demo-dom-estilo`)

Faixa "Negócio de exemplo" (só demo; MANTÉM) · nome (h1 34 px) · "Abre hoje às 09:00" · **Agendar horário** (único primário, y=239: bom) · 6 serviços com preço e duração, cada um link para agendar já escolhido (MANTÉM) · abaixo: quem atende, horário, contato. Nada sobrando na 1ª tela. Contato só telefone ([INFERÊNCIA] o seed não tem WhatsApp — o código tem o link, `secoes.tsx:188`).

### 3.14 Agendar público

Título "Agendar em Barbearia Dom Estilo" · faixa de exemplo · alternador "Visão de quem agenda/atende" (só nas vitrines) · passo 1 Serviço (6 cartões) — a dobra inteira é a lista de serviços; profissional, dia e horário vêm abaixo, em passos numerados (MANTÉM). A-16 e A-24.

### 3.15 Confirmar

"Confirma seu horário?" · "Toque numa opção abaixo." · **Vou sim** (primário) · **Preciso desmarcar**. Falta o dado do horário; desmarcar sem confirmação (A-03).

---

## 4 · As 15 telas × checklist de 17 itens (Fase 1)

**P** passa · **F** falha · **~** parcial · **?** não verificado (motivo na nota). Evidência na linha "Notas" e nas tabelas M1–M8.

| # | Item | Hoje | Agenda | Ag/novo | Comanda | Caixa | Clientes | Ficha | Recuperar | Campanhas | Mês | Config | Orçam. | Salão | Agendar | Confirmar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 pergunta, 1 ação, 1 primário | F | ~ | ~ | ? | P | ~ | F | F | F | P | ~ | P | P | P | P |
| 2 | Leitor e decisão p/ cada elemento | ~ | P | P | ? | P | ~ | ~ | F | ~ | ~ | ~ | P | P | P | F |
| 3 | Hierarquia título→estado→ação→detalhe | F | P | P | ? | P | ~ | P | F | ~ | ~ | F | P | P | P | ~ |
| 4 | Ação principal na zona do polegar | ~ | P | P | ? | — | ~ | F | F | ~ | — | — | P | ~ | P | P |
| 5 | 7 estados de botão | P | P | P | ? | P | P | P | P | P | P | P | P | P | P | P |
| 6 | Estados de tela | ~ | P | P | F | P | P | ~ | P | P | P | ~ | P | ~ | P | ~ |
| 7 | Consistência com o design system | P | P | ~ | P | P | P | P | ~ | P | P | P | P | P | P | P |
| 8 | Escala tipográfica | ~ | ~ | P | P | ~ | ~ | ~ | ~ | ~ | P | ~ | P | ~ | ~ | P |
| 9 | Ícone com rótulo; cor nunca sozinha | F | F | F | F | F | F | F | F | F | F | F | F | P | P | P |
| 10 | Destrutiva separada, confirmação, ≥48 | P | P | P | ? | — | P | ~ | — | — | — | ~ | — | — | — | F |
| 11 | Voltar leva aonde se espera | P | P | P | P | P | P | P | P | F | ~ | P | ~ | — | — | — |
| 12 | Computador: 2 colunas, ação visível | F | F | ~ | F | F | F | F | F | F | F | F | F | ~ | ~ | ~ |
| 13 | Escuro com o mesmo contraste | P | P | P | P | P | P | P | P | P | P | P | P | — | — | — |
| 14 | A11y (AA, foco, ordem, leitor, zoom) | ~ | P | P | ? | P | P | P | P | P | P | P | P | P | P | P |
| 15 | Movimento com `prefers-reduced-motion` | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| 16 | Densidade: vê o que precisa sem rolar | F | P | P | ? | P | ~ | ~ | F | P | P | F | P | P | ~ | ~ |
| 17 | Sem rolagem horizontal cortada | P | ~ | P | P | P | ~ | ~ | ~ | P | P | P | P | P | ~ | P |

**Notas por item (evidência):**
1. Shell põe 2 `bg-acc` fixos em todas (A-02). Hoje sem ação da tela na dobra; Ficha com 3 primários; Recuperar com a resposta abaixo da dobra; Campanhas com 2 primários próprios (A-13).
2. Recuperar: 15 chips sem decisão clara com lista vazia (A-07). Confirmar: não diz o que se confirma (A-03).
4. Ficha: "Mensagem" na zona do polegar, mas coberto pelo assistente (A-01). Recuperar: "Recalcular agora" fora da dobra.
5. **FATO (código):** `components/ui/button.tsx` tem normal, hover (`:20-31`), foco visível (medido 10/10 Tab), pressionado (`active:scale-[.97]`), enviando (`carregando` + `aria-busy`), desabilitado **com motivo** (`motivoDesabilitado`, bolha), sucesso/erro por toast. "?" na comanda: tela com itens não vista.
6. Comanda: id inexistente vira erro de "conexão" (A-04). Hoje: 4 de 5 consultas engolem erro e mostram zero sem avisar (`hoje/page.tsx:83-126`) — **viola "erro diz o que fazer"**. Ficha/Config: "sem conexão" não tratado (fetch cru). Salão: sem `loading.tsx`. Confirmar: sem o dado no sucesso.
7. Agenda/novo usa `datetime-local` nativo; Recuperar usa `<select>` nativo com estilo diferente dos chips (captura).
8. Escala: 11 / 12 / 13,5 / 16 / 21 / 26 / 34 px = tokens. "~" onde aparece o 11 px (A-20).
9. Botão central e assistente só ícone em **todas** as telas do painel (A-02); Clientes "Cadastrar cliente" e Ficha "Editar" só ícone. Selos "sumido"/"fiel" têm texto (cor não está sozinha: P nesse ponto).
10. Ficha: "Cancelar assinatura" agora com `toque-48` (`fidelidade.tsx:252`) — `docs/11` E2 **resolvido** no código; não exercitado na tela (cliente sem assinatura no seed). Config: "Sair da conta" no topo com botão cheio (A-08). Confirmar: desmarcar em 1 toque (A-03).
11. **FATO:** mapa `paiDaRota` (`components/shell/navegacao.ts:19-66`). Campanhas e Orçamentos voltam para Configurações (A-13); Mês/Experimentos não têm voltar (não são sub-rota de aba) — no PWA sem barra do navegador, de Experimentos não há "voltar" para o Mês.
12. Tabela M2 (`A-computador.md`): 50 % vazio a 1280, 57 % a 1440; nenhuma tela em 2 colunas (A-06). Hoje: "Novo agendamento" em y≈964 (fora de 800).
13. axe nas 15, escuro, 390 e 1280: **0** violações (Tabela M1). Públicas: escuro não existe (claro cravado).
14. axe 0 nas 15; foco visível em 100 % dos 10 primeiros Tab (Tabela M5 só tem falsos positivos, seção 1.1); ordem do foco segue o DOM. Hoje: "~" porque não há região viva e a tela engole erro. **Zoom 200 %: [NÃO VERIFICADO]** como zoom; [INFERÊNCIA] a 1280 com zoom 200 % a largura CSS é 640 px, coberta pelo 390/360 sem rolagem lateral.
15. Com `reducedMotion: 'reduce'`, **0** animações rodando na carga das 15 (`medidas/A-aria-live.txt`); `globals.css:487,546` têm `@media (prefers-reduced-motion: reduce)`.
16. Hoje: a agenda do dia fica abaixo da dobra; Recuperar: resposta em y≈665; Config: itens úteis em y=674.
17. **FATO:** sobra lateral **0 px em 185 de 185 perfis** (360, 390, 1280). "~" onde a máscara esmaece o item selecionado (A-16).

---

## 5 · Comparação com `docs/11` e `docs/15`

| Origem | Item | Hoje (13/10) | Situação |
|---|---|---|---|
| 11 · E1 | Ficha = parede de 3 telas | Ficha com 4 abas (`ficha.tsx:498-507`), "Como atender" no topo; altura 1210 px a 390 (1,4 tela) contra 2429 px antes | **Resolvido** |
| 11 · E2 | "Cancelar assinatura" com 16 px | `toque-48` no botão (`fidelidade.tsx:252`) | **Resolvido no código** (tela não exercitada: seed sem assinatura) |
| 11 · E3 | Navegação sem continuidade | `grep viewTransition\|startViewTransition` em `src` → **0** ocorrências | **Continua** |
| 11 · E4 | 19 de 27 telas sem `loading.tsx` | só `/admin` (redirect) e `config/excluir-conta` sem; nenhuma pública tem | **Resolvido no painel**; públicas não têm |
| 11 · E5 | 61 % vazio a 1440 | 57 % a 1440 (desconta a lateral de 232 px), 50 % a 1280 | **Continua** (A-06) |
| 11 · E6 | Trilho cortado na margem | máscara em `globals.css:574` | **Resolvido com efeito colateral** (A-16) |
| 15 · A1–A3, A5–A7, A9–A11 | títulos, rótulos, alvos de config/negócio | axe 0 nas telas de config (exceto automações, contraste); alvos sem acusação real | **Continuam resolvidos** |
| 15 · A4 | alvos de 32 px no expediente | `config/horarios`: nenhum alvo < 48 efetivo | **Continua resolvido** |
| 15 · A12/A13 | 126 horários pintados / selecionado mentindo | agendar público mostra Manhã/Tarde/Noite colapsáveis (12/24/2) | **Continua resolvido** |
| 15 · A16 | telas por token sem título | `<title>` medido: "Avaliar atendimento · CICLO", "Confirmar agendamento · CICLO", "Vaga na agenda · CICLO", "Orçamento · CICLO" | **Continua resolvido** |
| 15 · §5/§10 | Clientes renderiza a base toda | 22 clientes = 2901 px a 390; [INFERÊNCIA] 300 clientes ≈ 26 000 px | **Continua** (paginação/virtualização) |
| 15 · §14 | `IconButton` pouco usado | botões de ícone feitos à mão continuam (Menu, Compartilhar, Cadastrar) | **Continua** (sem defeito de alvo) |
| 15 · §24 | Telas por token sem saída em erro | 0 interativos em avaliar/lista-espera/orcamento | **Continua** (A-10) — texto melhorou |
| — | **Regressões novas** | A-01 (assistente cobre ação), A-02 (2 primários fixos), A-16 (máscara) | **Regrediu** com a chegada do assistente flutuante e do botão central |

---

## 6 · Tabelas de medida

As tabelas completas estão em `medidas/A-resumo.md` (gerado por `A-resumo.mjs` a partir de `A-varredura.json`) e `medidas/A-computador.md`. Resumo:

**M1 (todas as 185):** axe com violação em **4 rotas** (automações, calculadora, preços, `/dev/ui` 404); sobra lateral **0** em todas; foco visível nos 10 primeiros Tab em todas (os "nenhum" são falsos positivos, seção 1.1); menor fonte 11 px.

**M2 · computador (15 principais, claro):**

| Tela | 1280: conteúdo / útil | Vazio 1280 | Vazio 1440 | Altura (telas a 1280) | Ação principal sem rolar (1280) |
|---|---|---|---|---|---|
| Hoje | 522 / 1048 | 50 % | 57 % | 1,5 | não ("Novo agendamento" y≈964) |
| Agenda | 523 / 1048 | 50 % | 57 % | 1,0 | sim |
| Agenda/novo | 522 / 1048 | 50 % | 57 % | 1,0 | sim |
| Comanda (ponte) | 522 / 1048 | 50 % | 57 % | 1,0 | sim |
| Caixa | 522 / 1048 | 50 % | 57 % | 1,1 | n/a |
| Clientes | 523 / 1048 | 50 % | 57 % | 3,5 | n/a |
| Ficha | 639 / 1048* | 39 %* | 47 %* | 1,4 | sim (barra de ação) |
| Recuperar | 523 / 1048 | 50 % | 57 % | 1,3 | não (y=885) |
| Campanhas | 522 / 1048 | 50 % | 57 % | 1,0 | sim |
| Mês | 522 / 1048 | 50 % | 57 % | 1,0 | n/a |
| Config | 522 / 1048 | 50 % | 57 % | 3,5 | n/a |
| Orçamentos | 522 / 1048 | 50 % | 57 % | 1,0 | sim |
| Salão | 524 / 1280 | 59 % | 64 % | 1,9 | sim |
| Agendar | 888 / 1280* | 31 %* | 38 %* | 1,7 | oculta até preencher |
| Confirmar | 444 / 1280 | 65 % | 69 % | 1,0 | sim |

\* trilho com rolagem lateral (`-mx-[gutter]`) estica a medida; a coluna real é 560 px.

**M3 · alvos < 48 px efetivos (reais, depois da conferência):** Agenda a 360 (7 dias, 43–44 px de largura); Onboarding/perfil (2 botões, 16–18 px); ficha de consumo "Registrar compra" (15 px, inline); Termos (2 links inline, 17 px). Sondagem: para cada alvo, `scrollIntoView` ao centro e `elementFromPoint` pixel a pixel nas linhas centrais horizontal e vertical; a corrida contínua que contém o centro é o alvo efetivo (pega o `::after` do `toque-48` e pega alvo coberto).

**M4 · axe:** `config/automacoes` color-contrast (3 nós, claro); `/calculadora` e `/precos` link-name (logo); `/dev/ui` html-has-lang (página 404 de produção — esperado).

**M6 · trilhos com rolagem lateral (intencionais):** Agenda (profissionais 475/390), Clientes (filtros 444/390), Ficha a 360 (abas 375/360), Recuperar (2 trilhos 519 e 547/390), Config a 360 (tema 349/326), Agendar (dias 924/390).

**M7 · console:** 503 + erro de Server Component em comanda inexistente (A-04); `ERR_SSL_PROTOCOL_ERROR` no prefetch de `/` a partir do 404 do painel (A-18); 401 em `config/excluir-conta` na carga ([NÃO VERIFICADO] qual recurso); 404 esperados nos tokens falsos.

**Regiões vivas na carga (`A-aria-live.txt`):** Agenda, Clientes, Recuperar e Agendar têm região `polite` no DOM desde a carga (bom, regra do CLAUDE.md). Hoje, Caixa, Campanhas, Mês, Config, Orçamentos, Ficha, Confirmar: 0 — nessas, a troca de conteúdo é por rota, por aba (`role=tabpanel`) ou por foco no título (`TituloDeEstado`, `components/ui/titulo-de-estado.tsx:48`), então não é defeito. Agenda/novo: região só depois de enviar — **[NÃO VERIFICADO]** (enviar grava no banco).

---

## 7 · EVIDÊNCIAS (arquivos)

- Scripts (todos em `docs/98-aprimoramento/medidas/`): `A-login.mjs` (login real, estado fora do repo), `A-descobrir-ids.mjs` → `A-ids.json`, `A-varredura.mjs` → `A-varredura.json` + `A-varredura.log` + `capturas/*.png`, `A-resumo.mjs` → `A-resumo.md`, `A-computador.mjs` → `A-computador.json/.md`, `A-verifica.mjs` (foco, rótulos, capturas pontuais, aria-live) → `A-aria-live.txt`, `A-verifica-agendar.mjs`, `A-dobra.txt`.
- Capturas: `capturas/<rota>-<largura>-<tema>.png` (185) + `capturas/verifica-*.png` (conferências).
- Consultas ao banco local (só `select`): tenants demo; contagem de `tickets`, `payments`, `appointments` hoje/futuros, `quotes`, `clients`; e-mails `dono-%` em `auth.users`.
- Saída da conferência de rótulos: `agenda/novo` checkbox 20×20 com label 354×48; `caixa` date 169×23 com label 242×48; `config/modulos` 17 checkboxes com label 48×48; `clientes/nova` checkbox com label 354×50; `config/mensagens` checkbox com label 48×48.

## 8 · INCERTEZAS

1. **Seed sem comanda, sem pagamento e sem agendamento hoje** — Hoje, Agenda, Caixa, Mês, Comanda e Recuperar foram vistos **vazios**. Densidade, números concorrentes e zona do polegar com a tela cheia ficam **[NÃO VERIFICADO]**; é o estado mais importante (dia de trabalho). Quem destrava: seed com um dia cheio.
2. **Motor de Ciclo não calculado no seed** ("o Motor ainda não processou") — o Recuperar com lista não foi visto.
3. **Pacote advocacia** sem login de demonstração.
4. **Telas com token válido** (confirmar/avaliar/orcamento/lista-espera) — só estados inicial e de erro.
5. **Desempenho** — tempos desta varredura contaminados por CPU a 99 %; não usar.
6. **Papéis** (profissional, recepção) — só o dono foi medido; o que a equipe vê vem do código (rbac).
7. Contagem de "primários" pela classe `bg-acc`+`text-on-acc`: subconta as ações de `EmptyState` (estilo próprio) e conta o dia selecionado da Agenda; corrigido à mão na seção 3.

## 9 · RECOMENDAÇÕES (para a Fase 1, em ordem de ganho por esforço)

1. **Assistente flutuante não cobre ação** (A-01, A-14) — P (≤ 0,5 d). Aceite: sondagem `elementFromPoint` do botão principal de toda tela com `ActionBar` acerta 100 % a 360/390.
2. **Uma cor de ação por tela** (A-02, A-13) — M. Decisão de design: botão central com rótulo e/ou cor neutra; assistente secundário. Aceite: ≤ 1 `bg-acc` visível por tela além do selecionado.
3. **Confirmar mostra o horário e protege o desmarcar** (A-03) — M (precisa GET público pelo token). Aceite: dado do horário visível antes do toque; desmarcar com confirmação e "desfazer" por 5 s.
4. **Recuperar e Config com a resposta na 1ª tela** (A-07, A-08) — M. Aceite: lista/vazio começa antes de y=400 a 390×844; ≤ 12 interativos na dobra.
5. **Hoje responde "o que faço agora"** com a agenda do dia no topo e 1 cartão de "vale a pena" (seção 3.1, A-05) — M, junto com o agente C para a fonte do "Atendido hoje".
6. **Agenda/novo com horários livres** (A-09) — M/G (reusa a grade do público). Medir toques antes × depois.
7. **Erro que diz a causa certa** (A-04) e **saída nas telas por token** (A-10) — P cada.
8. **Computador em 2 colunas** nas 4 telas de lista + detalhe (A-06) — G; opcional depois das anteriores (`docs/11` já marcava como oportunidade, não defeito).
9. Polimento S3: A-11, A-15, A-16, A-17, A-18, A-19, A-20, A-21, A-23, A-24 — P cada.
10. **Seed de um dia cheio** antes de fechar a Fase 1 (incerteza 1): sem ele, as telas mais usadas só foram vistas vazias.
