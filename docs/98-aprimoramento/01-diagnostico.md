# 01 · Diagnóstico ponta a ponta (Fase 0)

Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md`. Base: `origin/main` em `33058dd0` (13/10/2026). Detalhe e evidência de cada achado ficam nos relatórios dos agentes em `agentes/` (este documento consolida; não repete a evidência).

## 1. Ambiente e método

- **Worktree** `ciclo-aprimoramento`, branch `aprimoramento/plano-2026-10-13`, criado a partir do `main` (o checkout principal estava 121 commits atrás).
- **Banco local** refeito com `supabase db reset` (migrations 0001–0117 do `main`) + `scripts/seed-demo-6-negocios.mjs`; depois `seed-demo-agenda-futura.mjs` (os 6 demos) e `seed-demo-dinheiro.mjs` (as 3 barbearias; o script quebra em tenant sem serviço "Barba", ver §6).
- **App:** build de produção (`pnpm build`, 10 min 12 s neste Windows) servido por `pnpm start` em `localhost:3200`.
- **Medição:** Playwright fora do repositório com o **Chrome do sistema** (`channel: 'chrome'`); o Chromium baixado é bloqueado pelo Smart App Control (`spawn UNKNOWN`, FATO).
- **Limite principal:** durante a Fase 0 a CPU ficou em 94–99% com 7 agentes rodando juntos. **Tempos absolutos estão inflados**; a medida confiável de servidor é a **contagem de idas ao banco** e quantas são **em série** (agente B, pelo log do Postgres). Produção não foi tocada.

## 2. Números da varredura

| Agente | Escopo | Achados | S0 | S1 | Relatório |
| --- | --- | --- | --- | --- | --- |
| A | 70 rotas (não 64: 7 da advocacia + `dev/ui`), 185 perfis, 209 capturas | 24 | 0 | 0 | `agentes/A-interface.md` |
| B | 20 telas/ações: idas ao banco, tempos, INP, duplo toque | tabela de 20 linhas + B-00a/b | 0 | 2 | `agentes/B-desempenho.md` |
| C | Fluxos, dinheiro, fuso, offline, crons, testes, rotas órfãs | 52 | 1 (condicional) | 12+ | `agentes/C-funcionalidade.md` |
| D | 4.839 textos únicos (132 entradas de rota + core/server/lib/API) | 51 | 0 | 2 | `agentes/D-copy.md` |
| E | Schema × código, números, RLS, índices, seed, migrations | 14 | 0 | 5 | `agentes/E-dados.md` |
| F | 14 páginas públicas, primeiro dia (2 verticais), importar 300 | 26 | 1 (reproduzido) | 4 | `agentes/F-publico-primeiro-dia.md` |
| G | Concorrentes (material público) | em andamento | — | — | `agentes/G-referencias.md` |

**Linha de base técnica (agente C):** typecheck e lint verdes; **3.757 testes unitários em 389 arquivos** passam em UTC, São Paulo, Tóquio e Manaus; integração e RLS em paralelo têm vermelhos de carga (6 de 7 passam em série); **um vermelho real**: teste com data fixa `HOJE='2026-10-08'` reprova todo dia desde 09/10 (C-36). A CI do `main` deve estar vermelha por isso [NÃO VERIFICADO no GitHub].

## 3. O que já está bem (manter)

- **0 rolagem lateral** nas 70 rotas, a 360, 390 e 1280 px (A).
- **axe sem violação** nas 15 telas principais, claro e escuro; foco visível em 100% dos 10 primeiros Tab (A).
- **CLS** no pior caso 0,012 (B) e 0,013 nas públicas (F).
- **Ações que gravam reagem em 33–76 ms** ao toque (B); duplo toque na tela não grava duas vezes, salvo "adicionar item" (B-07).
- Consertos do `docs/28` seguem de pé: `cache`, Sentry fora do topo, `sharp` separado, RLS de `memberships` (B).
- Copy pública principal, FAQ e onboarding seguem os planos `20`/`71`/`72` (D); importar 300 clientes leva ~2 s com acento e data dd/mm certos (F).
- Ficha do cliente em abas (E1 do `docs/11`) resolvida (A).

## 4. Achados S0 e S1 consolidados (candidatos à Onda U)

| ID | Sev. | Dimensão | O que acontece | Fonte |
| --- | --- | --- | --- | --- |
| **F-01** | **S0** | Funcionalidade | Página pública de agendar **grava outro dia** (às vezes outro profissional) do que a tela mostra: resposta antiga de horários chega depois da nova. Reproduzido 2/6 natural, 3/3 forçado; 3 agendamentos errados no banco local | F |
| **C-01** | **S0 cond.** | Dinheiro | Concluir atendimento abre comanda **vazia**; sugere o 1º serviço do catálogo e cobra o preço de **hoje**, não o combinado | C |
| F-03 | S1 (S0 se o mínimo de senha em produção > 8) | Cadastro | Senha de 8–9 caracteres mostra "Quase lá! Mandamos um link", Supabase recusa e a rota esconde o erro: **nenhuma conta é criada** | F |
| B-00b / E-05 | S1 | Velocidade/trava | `/admin/mes` e `/admin/config/servicos` **caem** com ~220 comandas em 90 dias (`.in('ticket_id', ids)` estoura a URL, HTTP 414) | B, E |
| B-00a / E-01 | S1 | Velocidade/escala | RLS de `appointments`, `tickets`, `ticket_items` chama função por **linha** (0,45 ms/linha); 10 mil linhas = 1–4,6 s; a Hoje pararia de abrir entre ~18 mil e 80 mil agendamentos (projeção) | B, E |
| E-02 | S1 | Números | 7 consultas passam de 1.000 linhas e **saem cortadas sem aviso** (atribuição, comparação da Hoje, Recuperar, público de campanha, fidelidade, `loyalty_entries`, `receitaPorCampanha`) | E, B |
| E-04 | S1 | Dinheiro/segurança | Qualquer membro **apaga ou edita comanda fechada** (inclusive a própria comissão) direto pela API | E |
| C-02 / C-38 | S1 | Dinheiro | Pacote fora do caixa: `payments` sem leitor nem escritor; toast promete "use na comanda" e a comanda não usa: **risco de cobrar duas vezes** | C |
| C-03 | S1 | Números | "O Motor de Ciclo trouxe" infla quando o pacote acaba | C |
| C-04 | S1 | Funcionalidade | Agendar público **sem `Idempotency-Key`**: resposta perdida → cliente vê "já reservado" para o próprio horário e marca outro | C |
| F-02 | S1 | Funcionalidade | Horário tomado por outra pessoa (409): aviso apagado no mesmo instante, formulário some, sem alternativas | F |
| C-05 | S1 | Funcionalidade | "Bloquear um dia" **derruba a tela** quando a rede pisca (guarda `rede-nao-derruba-tela` só olha `src/app`) | C |
| C-07 | S1 | Funcionalidade | Hoje e Agenda podem mostrar a hora em **UTC (+3h)** no HTML do servidor (código; sintoma a confirmar no navegador) | C |
| C-45 | S1 | Funcionalidade | **Fila offline nunca sai** ao abrir o app | C |
| C-37 | S1 | Funcionalidade | Link de **convite de equipe dá 404** | C |
| C-39 | S1 | Facilidade | Expediente por profissional **sem link de entrada** | C |
| C-06 | S1 cond. | Cobrança | Cron `expirar-graca` **sem gatilho**: plano pago nunca cai para o Grátis | C |
| E-03 | S1 | Dado | Cron `segments` apaga `last_visit_at` de importados | E |
| F-04 | S1 | Copy/funcionalidade | Sucesso do agendamento diz "é só chamar por telefone", conta nova **não tem telefone** | F |
| F-05 | S1 | Funcionalidade | Recuperar senha aberto em outro navegador (app de e-mail) **sempre falha** (PKCE) | F |
| D-01 | S1 | Copy | Plano vende "mandar para todos de uma vez"; o fluxo abre o WhatsApp **um por vez** | D |
| D-02 | S1 | Copy | 4 botões mandam comprar o **plano Avançado, que não está à venda** | D |
| C-36 | S1 (processo) | Testes | Teste com data fixa reprova todo dia: CI do `main` provavelmente vermelha | C |
| B (idas) | S2→S1 nas mais usadas | Velocidade | Hoje 28 idas, Ficha 32, Mês 26; criar agendamento 13 (12 em série); receber 22 (19 em série); 1 toque em Entrar = 69 idas e 12 `getUser`; todo o painel paga **2 `getUser` + `memberships` em série** antes de qualquer dado (TTFB do painel 359–1.841 ms × públicas 26–182 ms, local) | B |

## 5. Temas S2 por dimensão (detalhe nos relatórios)

- **Interface (A):** assistente flutuante cobre "Mensagem" na ficha (A-01); até 3 botões primários por tela (A-02); `/confirmar` não diz qual horário e "Preciso desmarcar" cancela sem confirmar nem desfazer (A-03); Recuperar com 25 interativos na 1ª tela (A-07); Config abre com "Sair da conta" no topo (A-08); agendar com campo nativo sem horários livres (A-09); **50–57% da largura vazia no computador**, nenhuma tela em duas colunas (A-06, E5 do `docs/11` continua); regressão da máscara do E6 (A-16).
- **Funcionalidade (C):** o mesmo atendimento aparece como R$ 100 / R$ 95 / R$ 90 conforme a tela; "Sobrou" só desconta aluguel das horas agendadas; remarcar ignora alternativas do 409; lista de clientes em ordem aleatória; estorno sem interface; agendar/remarcar/folga no fuso do aparelho (C-08).
- **Velocidade (B):** navegar não dá retorno por 344–516 ms (abas) e 516–1.025 ms (trocar de dia); INP > 200 ms ao abrir agendamento na Hoje e na busca de clientes; tarefas longas até 449 ms no celular médio; `router.refresh()` dobra o custo de confirmar e prende o spinner ao fechar comanda; esqueleto de `loading.tsx` não aparece na abertura direta; "adicionar item" grava 2 itens no duplo toque (B-07).
- **Copy (D):** gênero voltou onde a guarda não olha ("Suas clientes", "Atrasada"/"Sumido", "na Espaço Vitória", "seu Progressiva"); jargão ("Recuperar receita" no botão central, "ticket médio" em 5 telas, "classe", "na janela"); "Sobrou" × "Lucro" para o mesmo número (decisão aberta em `DECISOES.md`); "Não consegui falar com o servidor" escrito 63 vezes em 40 arquivos; 42 de 47 erros de reserva não dizem o que fazer; vocabulário por profissão só em 20 arquivos; "Confirmar agendamento" cria agendamento **pendente**.
- **Dados (E):** "em risco" da Hoje ≠ Recuperar; `no_show_count` sempre zero e vai para o assistente; colunas e tabelas sem uso (`payments`, `commissions`, `v_daily_cash`, `messages.scheduled_for`); migrations 0101 e 0118 de outras branches vão colidir com o `main`.
- **Público e primeiro dia (F):** perfil do onboarding não muda os primeiros passos; depois do 1º agendamento a tela não mostra o horário criado; "Repetir é do Solo" oferece plano quando o motivo é a profissão; importação descarta 7 por telefone, aceita data americana errada sem aviso e marca 97% como atrasados; lista de espera mostra erro a quem já garantiu horário; páginas com token sem `noindex`; descrições padrão "profissionais da beleza".

## 6. Medida com dia cheio (orquestrador, depois dos agentes, máquina sem carga)

Conta `demo-dom-estilo` depois de `seed-demo-agenda-futura` e `seed-demo-dinheiro`, celular 390×844, build local, carga até `networkidle` (FATO, `capturas/dia-cheio_*`):

| Rota | Status | Tempo até ocioso | Observação |
| --- | --- | --- | --- |
| `/admin/hoje` | 200 | 1.141 ms | "ATENDIDO HOJE R$ 0,00 · 100% abaixo do costume" logo de manhã (confirma A-05: dia pela metade × dias inteiros) |
| `/admin/agenda` | 200 | 847 ms | |
| `/admin/caixa` | 200 | 865 ms | "Nenhuma comanda fechada nesse dia" (o seed de dinheiro cria comandas no passado) |
| `/admin/mes` | 200 | 1.127 ms | Abre com o volume desta conta (abaixo do limite de B-00b) |
| `/admin/recuperar` | 200 | 1.067 ms | "R$ 0,00 · CLIENTES 0": o Motor de Ciclo não rodou no local (cron), tela medida vazia |
| `/admin/comissao` | 200 | 1.035 ms | |
| `/admin/config/servicos` | 200 | 1.074 ms | |
| `/admin/clientes` | 200 | 1.183 ms | "VOLTAM DE NOVO 100%" (seed com 100% de retorno, E-07) |

**Seed:** `seed-demo-dinheiro` dá "lucro = faturamento (100%)" em duas das três barbearias e quebra em salão sem "Barba" (`seed-demo-dinheiro.mjs:279`). Demonstração local não serve de prova para Caixa, Mês, Comissão e Recuperar sem um seed melhor (ticket na Fase 7).

## 7. Não verificado (com quem destrava)

| Item | Motivo | Quem destrava |
| --- | --- | --- |
| Migration 0102 em produção (sem ela todo login cai) | Produção não consultada | Eduardo (autorizar leitura) |
| Cron `expirar-graca` com gatilho em produção | Idem | Eduardo |
| CI do `main` vermelha pelo teste de data fixa | **Conferido no GitHub (13/10)**: último CI do `main` foi verde em 08/10, antes da data passar; o próximo push no `main` vai reprovar (`tests/integration/legal-captura.test.ts:25` e `legal-casos-estado.test.ts:21`) | Ticket na Onda U |
| Tamanho mínimo de senha no Supabase de produção (F-03) | Idem | Eduardo |
| Limite de URL do PostgREST em produção (B-00b) | Idem | Eduardo |
| Sintoma visual de C-07 (hora +3h) | Precisa abrir no navegador com fuso do servidor em UTC | Fase 2 (reproduzir) |
| Leitor de tela real, aparelho real, Safari/Firefox | Sem aparelho | Teste com pessoas |
| Tempos absolutos sem carga | CPU 94–99% na Fase 0 | Reexecução da Fase 4 com a máquina livre |
| Concorrentes (agente G) | Em andamento | — |

## 8. Gate G0

Rotas (70), tarefas-régua (B e F), desempenho por rota (B), travamentos (B, C), defeitos com severidade (C, E, F), textos (D), capturas e axe (A, F) e banco (E) **medidos**; o não medido está listado em §7. **G0 fechado com ressalva:** tempos absolutos sob carga e referências de concorrentes pendentes (não bloqueiam as Fases 1–6).
