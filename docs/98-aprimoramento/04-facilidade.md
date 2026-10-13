# 04 · Facilidade (Fase 3)

Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md`, Parte C, Fase 3. Base: `origin/main` em `33058dd0`, 13/10/2026.
Insumos: `agentes/B-desempenho.md` (tempos de toque e de tela), `agentes/F-publico-primeiro-dia.md` (primeiro dia, migração, páginas públicas), `agentes/A-interface.md` (dobra, papéis), `agentes/C-funcionalidade.md` (fluxos), `02-interface.md` e `03-funcionalidade.md` desta rodada.

**Como os números foram obtidos.**
- **Toques medidos**: os que o agente F contou com Playwright (primeiro dia, 1º agendamento, página pública, importação) e os que o agente B mediu em tempo (confirmar, receber, adicionar item, trocar de tela).
- **Toques contados no fluxo**: lidos do código e das capturas, passo a passo, marcados **[INFERÊNCIA, contado]**. Um toque = uma ação de dedo (abrir um `select` e escolher são 2; digitar um campo é 1 toque + digitação).
- **Tempos** são do agente B (celular 390×844, CPU 4×, 4G lenta, mediana/pior de 5) **sob CPU de 94–99%**: servem para comparar, não como linha de base de produção (`01-diagnostico.md` §1). Tempos do F são de **robô** (digita em milissegundos).
- **Tempo humano**: nenhum foi medido. Onde aparece, é [HIPÓTESE] com "como medir".

**Metas da A7 que valem aqui (não ajustadas):** tarefas-régua do dono ≤ 2 toques nas 5 mais frequentes e ≤ 4 nas demais; cliente final conclui em menos de 1 minuto; dono abre o CICLO e em 5 s sabe o que fazer.

As 5 mais frequentes, pelo papel da tela no dia (A, §2; [INFERÊNCIA], sem telemetria por rota): **1 abrir o dia**, **4 chegou/faltou**, **5 receber**, **2 agendar**, **9 achar a ficha**.

---

## 1 · Tarefas-régua: hoje × proposto

| # | Tarefa | Quem · frequência | Hoje: toques · telas · tempo | Onde trava hoje | Proposto: toques · telas | Meta A7 | Atinge? | Como medir depois |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Abrir o dia e saber o que fazer | Dono, equipe · várias vezes por hora | 0 toques · 1 tela · conteúdo útil **1083/2156 ms** (B) | A resposta (o próximo horário e o resto do dia) fica abaixo de 3 cartões de configuração; sem horário, "Novo agendamento" em y≈1080 (A-dobra); "100% abaixo do costume" de manhã (A-05); hora +3 h por ~1 s no servidor em UTC (C-07, reproduzido) | 0 toques · 1 tela · próximo horário em y=175 no protótipo (`prototipos/hoje.html`) | 5 s para saber o que fazer | **Sim** na posição; tempo [HIPÓTESE] | `A-varredura` (y da resposta) + `B-tempos.mjs` (útil < 1 s) + 5 donos: "o que você faz agora?" cronometrado |
| 2 | Agendar quem ligou ou chegou | Dono, recepção · várias por dia | **8 toques** (F, 1º agendamento: serviço, profissional, nome, telefone, data/hora ≈ 3, confirmar) · 2 telas · tela 1596/2979 ms + confirmar 984/1027 ms (B) | Campo nativo de data e hora sem horários livres (A-09); conflito só ao enviar; volta para hoje e não mostra o criado (C-11); fuso do aparelho (C-08) | Cliente existente: **6** (cliente 2, serviço 1, dia 1, horário 1, marcar 1) [INFERÊNCIA, contado no protótipo]. **"Marcar de novo" na ficha, na Hoje e no Recuperar com o horário de sempre sugerido: 2** (tocar a sugestão, confirmar) [INFERÊNCIA] | ≤ 2 (é das 5 mais frequentes) | **Só no atalho** "Marcar de novo". O caminho completo fica em 6: menos que isso esconderia escolha obrigatória (serviço, dia, hora). Fica registrado como lacuna, não como meta ajustada | Script Playwright que conta toques no fluxo (`F-primeiros-cadastros.mjs` adaptado) |
| 3 | Remarcar | Dono, recepção · diária | Sheet (1) + Remarcar (2) + campo nativo (≈ 3) + confirmar (1) = **≈ 7** [INFERÊNCIA, contado] · sem alternativas no 409 (C-10) | Mesmo campo nativo; 409 só com texto | **4** no mesmo dia (sheet, Remarcar, horário, confirmar); **5** em outro dia [INFERÊNCIA] | ≤ 4 | **Sim** no mesmo dia; não em outro dia (lacuna) | Mesmo script |
| 4 | Marcar que chegou / faltou | Profissional, recepção · dezenas por dia | **2** (abrir o horário + Chegou) · retorno em 62/150 ms, toast em 981/1445 ms (B) · INP ao abrir 208/216 ms (B-15) | No erro, a Hoje fica no estado novo (C-09) | **1** no cartão "Agora" da Hoje; **2** nos outros | ≤ 2 | **Sim** | `B-interacoes.mjs` (retorno < 100 ms, INP < 200 ms) |
| 5 | Fechar a comanda e receber | Dono, recepção · todo atendimento | Concluir (1) + Ver comanda (2) + escolher serviço (2) + Adicionar (1) + forma (1) + Fechar (1) = **7–8** [INFERÊNCIA, contado]; +1 se o desconto estava focado (C-13, **reproduzido**) · 3 telas · abrir pela agenda **3118/3270 ms**, adicionar 723/2059, fechar 761/1790 (B) | Comanda nasce vazia com o serviço errado (C-01, reproduzido); redirect no meio (B-11); toque engolido (C-13) | **3**: Concluir (abre a comanda já com o item) + forma + "Receber R$ X" [INFERÊNCIA, contado] · 2 telas | ≤ 2 | **Não**. O 3º toque é a forma de pagamento, que é **obrigatória de propósito** (`comanda.tsx`, comentário da `0066`: sem ela o "Sobrou" volta a mentir). Lacuna registrada | `B-interacoes.mjs` + contagem; "Comanda fechada" < 1,5 s no pior de 5 |
| 6 | Ver quanto entrou hoje e no mês | Dono · diária | Hoje mostra "Atendido" (preço de tabela) e o Caixa mostra "Entrou" (comandas): **números diferentes** (C-26); 1 toque até o Caixa | Dois números para a mesma pergunta | **1** ("Ver o caixa") com o **mesmo** número nos dois lugares | ≤ 4 | **Sim** | Teste de propriedade cruzando as telas (Fase 2, C-26) |
| 7 | Chamar quem sumiu | Dono · diária | Botão central (1) + achar a pessoa abaixo de 25 interativos (A-07) + Chamar (1) = **≥ 2**, com a lista em y≈665 | Filtros antes da lista; jargão ("classe", "nota", "na janela", D-19) | **2**: botão central + "Chamar pelo WhatsApp" no cartão da fila (y=199 no protótipo) | ≤ 4 | **Sim** | `A-varredura` com o seed do E-07 (Motor rodado) |
| 8 | Cadastrar cliente novo rápido | Recepção, dono · diária | **3 toques + 2 campos** (F, 1º cliente) | Botão só com ícone; busca não acha telefone parcial (C-19) | **3** (Nova + 2 campos + Salvar) ou dentro de "Marcar" sem sair da tela | ≤ 4 | **Sim** | Contagem |
| 9 | Achar a ficha e ver o histórico | Todos · várias por dia | Clientes (1) + busca (1) + digitar + tocar (1) = **3** · INP da busca **216/352 ms**, lista 579/717 ms (B) | Ordem aleatória impede rolar (C-18); busca mente quando falha (C-19, reproduzido); 6,6 s com 295 clientes (F-21) | **3**, com a busca no topo (y<200) e ordem alfabética | ≤ 2 | **Não** (3). Atalho: os 3 últimos abertos no topo da lista = 2 toques [HIPÓTESE de valor; validar com uso] | `B-interacoes.mjs` (busca < 500 ms) |
| 10 | Criar orçamento e mandar o link | Dono · semanal (depende do vertical) | [NÃO VERIFICADO] contagem: seed sem serviço "sob orçamento" (F); total mostrado é a prévia local (C-28) | Link de WhatsApp montado à mão (C-28) | Ficha › ⋯ › Criar orçamento › itens › "Mandar pelo WhatsApp" = **≤ 4** + itens [INFERÊNCIA] | ≤ 4 | [HIPÓTESE] | Contagem com seed que tenha serviço sob orçamento |
| 11 | Vender produto de revenda | Recepção · semanal | **Impossível** sem inventar atendimento (C-17) | — | Pelo PR #149 ("venda de balcão", aberto) [NÃO VERIFICADO] | ≤ 4 | depende do #149 | Contagem depois do merge |
| 12 | Ajustar horário ou bloquear um dia | Dono · mensal | Menu (1) + Configurações (1) + rolar até Horários (y=674, A-08) (1) + preencher folga + Adicionar (1) = **≥ 4** · **a tela cai** se a rede piscar (C-05, reproduzido) · expediente de um profissional **sem entrada** (C-39) | Config começa por "Sair da conta"; folga sem `try` | Agenda › "⋯ deste dia" › "Fechar este dia" › confirmar = **3**; expediente por profissional pela Equipe | ≤ 4 | **Sim** | Contagem + `fase2-reproducoes` parte `c05` (não pode mais cair) |
| 13 | Cliente final agenda sozinho | Cliente do negócio · por agendamento | **7 toques + 2 campos** · 8,8–11,9 s (robô, celular) · útil 1089/1230 ms (F) | **Grava outro dia** (F-01, S0); 409 some (F-02); promete telefone que não existe (F-04) | **7 + 2 campos**, com 0 divergência entre tela e banco | < 1 min, sem conta, sabe que deu certo | Toques **sim**; tempo humano [HIPÓTESE] | 5 pessoas reais no celular delas, cronômetro; `F-corrida-dia.mjs` com 20 repetições → 0 divergências |
| 14 | Cliente final confirma pelo link | Cliente · por lembrete | **1 toque**, 0,52 s até "Prontinho!" (F) · **sem dizer qual horário** · hoje **ninguém recebe o link** (lembrete desligado, `cron.yml:196-253`) | Página cega (C-21) | **1 toque**, com negócio, serviço, dia e hora antes | < 1 min | **Sim** | Playwright com token gerado no local |
| 15 | Dono novo: do cadastro ao 1º agendamento | Dono novo · uma vez | Até o painel: **12–16 toques, 6–8 campos, 15,8–23,7 s** (robô, F); 1º serviço 5 toques; 1º profissional 3; 1º agendamento 8: **≈ 28–32 toques** [soma das medidas do F] | Senha de 8–9 "cria" conta que não existe (F-03); link em outro navegador falha (F-05); perfil do onboarding não muda os primeiros passos (F-11); 1º agendamento volta para hoje (F-12) | **≈ 18–20** (seção 2) [INFERÊNCIA, contado] | ≤ 4 por tarefa; 1º agendamento sem atrito | Por tarefa, sim; o roteiro inteiro é longo por natureza | 5 donos reais, cronômetro do cadastro ao 1º horário marcado, com o e-mail de produção |

**Lacunas que ficam (registradas, sem mexer na meta):** agendar pelo caminho completo (6), receber (3), achar a ficha (3) e remarcar para outro dia (5). Nos três primeiros, o toque a mais é escolha obrigatória (serviço/dia/hora; forma de pagamento; qual pessoa). O atalho "Marcar de novo" e "últimos abertos" cobrem o caso mais comum. Medir a frequência de cada caminho em produção decide se vale mais atalho [HIPÓTESE].

---

## 2 · Primeiro dia do dono: roteiro com tempo por passo

Tempos do agente F (robô, celular 4×/4G lenta). "Proposto" diz o que se pré-preenche, pula ou vai para depois.

| Passo | Hoje (robô) | Toques · campos | Problema | Proposto | Toques depois |
| --- | --- | --- | --- | --- | --- |
| 1. Abrir `/cadastro` | 0,6 s | — | "Leva menos de um minuto" sem fonte (D-38) | Tirar a promessa de tempo | — |
| 2. Criar a conta | 7,5 s | 5 · 4 (nome, e-mail, telefone, senha) | Senha de 8–9 mostra "Quase lá" sem criar conta (F-03) | Piso de senha único e motivo real | 5 · 4 |
| 3. Confirmar o e-mail | **não medido** (local sem confirmação) | abrir o e-mail + 1 | Link falha em outro navegador (F-05); e-mail do Supabase em inglês se não houver modelo (D-24, [HIPÓTESE] em produção) | `token_hash` + `verifyOtp`; modelos de e-mail em PT-BR versionados | 1 |
| 4. Onboarding (nome, profissão, endereço) | 3,8–5,9 s | 4 · 2 | Não pede o WhatsApp do negócio (F-04) | Pedir WhatsApp do negócio (pré-preenchido com o telefone do cadastro, com "é o mesmo?") | 5 · 2 |
| 5. "Do seu jeito" (perfil) | 2,4–2,8 s | 3–4 · 0 | "Pular" com 16 px (A-11); respostas não mudam nada depois (F-11) | Botões de 48 px; as respostas decidem os primeiros passos (abaixo) | 3–4 |
| **Até o painel** | **15,8 s (faxina) · 23,7 s (barbearia, com novo login)** | **12 · 16** | | | **≈ 13** |
| 6. Hoje vazio | 1,3–1,7 s | — | "Primeiros passos" iguais para todo perfil (F-11) | Por resposta: "começando agora" → "Copie seu link" + "Confira seus horários"; "venho de outro sistema" → "Traga sua lista"; "tenho clientes de memória" → "Escreva os nomes que lembra" | — |
| 7. 1º serviço | 1,9 s + 1,7 s | 5 · 3 de 11 no formulário | Formulário de 11 campos | Catálogo já vem pré-preenchido por profissão (FATO, F: 6 na barbearia, 4 na faxina): o passo vira "confira preços" (1 toque se estiver certo); os 8 campos raros vão para "Mais opções" | 1–3 |
| 8. 1º profissional | 1,2 s + 1,2 s | 3 · 1 | — | Se "Só eu": o dono já é o profissional, passo pulado | 0–3 |
| 9. 1º cliente | 1,5 s + 1,5 s | 3 · 2 de 7 | — | Pode ser feito dentro do 1º agendamento | 0–3 |
| 10. 1º agendamento (painel) | 1,3 s + 2,0 s | 8 · 3 | Volta para hoje e não mostra o criado (F-12); "Repetir é do Solo" para quem não pode (F-13) | Grade de horários livres; volta para o dia com destaque | 6 |
| 11. 1º agendamento pela página (cliente final) | 1,9 s (computador) · 8,8–11,9 s (celular) | 6–7 · 2 | F-01, F-02, F-04 | Consertos da Onda U | 7 · 2 |
| 12. 1º cliente que volta | não medido | — | O Recuperar enche no mesmo minuto da importação, mas inflado (F-09d, F-10: 97% "atrasados") | Serviço do Motor sem pré-escolha arbitrária; um número por pergunta | — |

**Total do cadastro ao 1º agendamento:** hoje ≈ 28–32 toques (soma das medidas do F); proposto ≈ 18–20 [INFERÊNCIA, contado]. **Tempo humano** [HIPÓTESE]: 2–4 min com o e-mail (o F estimou). Como medir: 5 donos reais, celular deles, cronômetro do toque em "Criar conta" até o 1º horário na agenda.

---

## 3 · Migração de outro sistema

**Custo medido (F, barbearia, celular 4×):** planilha CSV de 300 → prévia em 0,3 s, importar em 1,8 s, **5 toques**. "Quem você já atende": 10 nomes colados, **6 toques**, 3,5 s. Leitura de Windows-1252 e `dd/mm/aaaa` sem erro (0 nome quebrado em 300). A tela "Vindo de outro sistema" tem mensagem pronta para o suporte antigo (`docs/83` P2/P6 feitos).

**O que custa caro de verdade** [HIPÓTESE]: pedir a exportação ao sistema antigo e salvar como CSV. Fica fora da tela. Como validar: perguntar a 5 donos de Trinks/AppBarber quanto tempo levaram.

| Problema (F-09) | Efeito para o dono | Proposta | Prioridade |
| --- | --- | --- | --- |
| Telefone inválido descarta a pessoa inteira (7 de 300) | Perde clientes sem saber quem | Importar sem o telefone e listar "7 sem telefone válido" com o nome | Onda 3 |
| Data americana aceita errada (`10/3/26` vira 10/03) | Ritmo e "quem sumiu" errados | Detectar o formato pela **coluna inteira**; perguntar se ambíguo | Onda 3 |
| Serviço do Motor pré-escolhido no 1º da lista → 97% "atrasados" | Primeiro contato com número inflado | Sem pré-escolha; mostrar "com X dias de ritmo, Y pessoas ficam atrasadas" na prévia | Onda 3 |
| `.xlsx` recusado | Um passo a mais (salvar como CSV) | Manter a instrução de 2 caminhos (custo de biblioteca nova não medido, D5) | não fazer agora |
| Cron `segments` apaga a última visita dos importados (E-03) | O que entrou pela importação some em 1–3 h | Onda U (03-funcionalidade) | **U** |
| Só alcançável pelo onboarding (C-44) | Quem pulou não acha | Link em Clientes vazio e no menu de Clientes | Onda 3 |

---

## 4 · Equipe e papéis

FATO (`server/auth/rbac.ts:12-33`): `professional` = `appointment:own`, `client:own`, `vault:own`, `comanda:own`, `commission:own`; `reception` = `appointment:*`, `client:read`, `client:create`, `comanda:create`; `report:read` (Caixa, Mês, Experimentos) só `owner`, `manager`, `finance`. A RLS de `appointments` filtra o profissional pelo próprio (`can_see_appointment`).

| Pergunta do contrato | Resposta | Evidência | Proposta |
| --- | --- | --- | --- |
| O profissional vê só o que é dele? | Na agenda e nas comandas, sim (RLS) | FATO (`pg_policies`, B-00a) | Manter |
| A recepção opera sem ver dinheiro? | **Não totalmente**: a Hoje não tem guarda de papel e mostra "Atendido hoje R$" somado dos horários que a RLS deixa ver; a recepção vê todos | [INFERÊNCIA]: `hoje/page.tsx` sem checagem de `report:read` para o número + `reception: appointment:*`. Como validar: login de recepção no seed | Número do dia só para `report:read`; recepção vê "6 horários, 3 feitos" |
| O menu mostra só o que a pessoa pode abrir? | Não: o menu do topo é fixo (Caixa, Serviços, Time, Campanhas, Estoque, Recorrência) | FATO: `topbar.tsx:22-29` (A-21) | Filtrar por papel e módulo (I-06) |
| A equipe consegue estragar algo sem querer? | Pela tela, pouco; pelo REST, um profissional pode editar a comissão de comanda fechada | FATO do desenho (E-04) | Gatilho + `revoke` (Onda U) |
| A equipe entra pelo convite? | **Não**: o link dá 404 | FATO (C-37, reproduzido) | Página de convite (Onda U) |
| O dono dá folga a um profissional? | Só por URL | FATO (C-39) | Link na Equipe (Onda U) |
| Quem atende sozinho vê o próprio extrato? | Não: "chega aqui em breve" | FATO (C-42) | Extrato pelo `my_professional_id` |

**[NÃO VERIFICADO]** o que profissional e recepção veem na tela: o seed só tem login de dono. Quem destrava: seed com um usuário de cada papel (junto com o E-07).

---

## 5 · Ajuda na própria tela

| Princípio | Onde já existe (manter) | Onde falta (propor) |
| --- | --- | --- |
| Vazio que ensina | Hoje "Primeiros passos" (3 cartões com ação); Recuperar com 5 variantes de vazio (`vazio-de-recuperar.ts`); Caixa vazio com "Ver a agenda" | Primeiros passos por perfil (F-11); Clientes vazio com link para "Vindo de outro sistema" (C-44); aviso de custo de material só com clientes (F-26) |
| Exemplo | Placeholder "(11) 98765-4321"; "Estimativa, não promessa" | Calculadora explica "Ticket médio" com o próprio termo (D-16): trocar |
| Padrão sensato | Catálogo pré-preenchido por profissão (F); endereço sugerido no onboarding | Serviço do agendamento pré-selecionado na comanda (C-01); último serviço do cliente em "Marcar" (I-10); **não** pré-escolher forma de pagamento (decisão da `0066`, manter) |
| Desfazer em vez de "tem certeza?" | "Sair" conta e avisa a fila (`sair.tsx:47-93`) | Cancelar horário → "Cancelado. Desfazer" por 10 s; desmarcar na página pública → desfazer (`prototipos/publico.html`); fechar comanda → "Desfazer fechamento" (C-41) |
| Erro que diz o que fazer | `/confirmar` com "Tentar de novo"; agendar público explica rede × servidor | 42 de 47 fallbacks sem instrução (D-25); boundary que afirma "nada foi perdido" (C-05b) |
| Prevenir em vez de avisar | Forma de pagamento obrigatória; constraint de conflito | Ver seção 8 |

---

## 6 · Menu e módulos

FATO: `config/modulos` liga e desliga módulos, mas **só o hub de Configurações obedece** (`config/page.tsx:129`); o menu do topo e as URLs não (A-21). O perfil do onboarding ("Só eu") não esconde Equipe e Comissão ([NÃO VERIFICADO] no menu, F).

**Proposta.**
1. Menu do topo e hub com **uma** regra: módulo desligado ou papel sem permissão some (I-06).
2. Padrões por perfil do onboarding: "Só eu" → Equipe e Comissão desligadas (religáveis); "começando agora" → Campanhas e Experimentos desligados até haver 20 clientes [HIPÓTESE do número; validar com uso].
3. URL de módulo desligado mostra "Esta parte está desligada. Ligar em Configurações › Módulos." em vez de abrir.
4. Não sumir com dado: desligar módulo esconde a tela, nunca apaga.

---

## 7 · Linguagem do nicho (vocabulário por vertical)

FATO (D, E10): os pacotes mudam "cliente" para aluno, paciente, tutor, estudante, responsável e "atendimento" para aula, treino, faxina, reunião, sessão, ensaio. **20 arquivos** usam o vocabulário; **223 textos** têm "cliente" fixo; a aba "Clientes" da barra é literal (`core/pacotes/base.ts:26`): o personal trainer lê "Clientes" na barra e "Alunos" no título. FATO (F): a Hoje e os "Primeiros passos" são **idênticos** para barbearia e faxina.

| Onde precisa mudar por vertical | Hoje | Proposta |
| --- | --- | --- |
| Barra inferior e menu ("Clientes", "Marcar") | Literal | Do vocabulário |
| Títulos de tela (Clientes, Ficha, Recuperar) | Parte usa | Todos do vocabulário |
| Primeiros passos da Hoje | Iguais | Por vertical e por resposta do perfil |
| Mensagens prontas | Sem palavra de beleza fixa (`docs/72` §5) | Manter; corrigir gênero (D-51) |
| Página pública ("salão", "estabelecimento") | 5 vazamentos novos de "salão" (D-29); 7 "estabelecimento" (D-31) | "negócio" ou o vocabulário `local` |
| Calculadora e preços | "salão e barbearia" | "quem tem agenda" |

Termos por vertical e a fonte única estão em `06-copy.md` §4.

---

## 8 · Erros mais comuns: prevenir em vez de avisar

| Erro provável | Evidência | Prevenção proposta |
| --- | --- | --- |
| Marcar horário ocupado | Conflito só ao enviar (A-09) | Grade só com horários livres (I-10); 409 com alternativas |
| Marcar no dia errado (público) | F-01 (S0) | Resumo com dia e hora tirados do horário; lista só da consulta mais recente |
| Cobrar o serviço errado ou o preço de hoje | C-01 (reproduzido) | Comanda nasce com o item combinado |
| Tocar "Fechar" e nada acontecer | C-13 (reproduzido) | Desconto vai no mesmo envio |
| Cancelar o horário achando que fecha a janela | "Cancelar" solto no sheet (D-23) | "Cancelar horário" separado, com consequência e desfazer |
| Duplicar cliente com outro nome | F-22 | "Já é cliente: {nome}" ao digitar o telefone |
| Data americana na planilha | F-09c | Formato pela coluna inteira |
| Senha que o Supabase recusa | F-03 | Piso único |
| Abrir o link em outro navegador | F-05 | `token_hash` |
| Esquecer a forma de pagamento | Já é obrigatória (`comanda.tsx`) | Manter |

---

## 9 · Gate G3

Todas as 15 tarefas-régua têm hoje × proposto, meta da A7, se atinge e como medir (§1). O primeiro dia tem tempo por passo (§2). Migração, papéis, ajuda na tela, módulos, vocabulário e prevenção de erro cobertos (§3–8).

**Ressalvas:** nenhum tempo humano foi medido (todas as metas de tempo ficam [HIPÓTESE] até o teste com 5 donos e 5 clientes); os papéis profissional e recepção não foram vistos na tela (seed só com dono). **G3 fechado com ressalva.**

---

## Correções após a revisão adversarial (prevalecem)

Fonte: `09-revisao-adversarial.md`. Onde esta seção contradiz o que está acima, **vale esta seção**.

1. **Papéis (§4, R-27).** Gerente (`manager`) e financeiro (`finance`) também existem (`rbac.ts`) e não foram vistos. A recepção **fecha comanda** (`comanda:create`, `rbac.ts:32`) e não tem `report:read`, então não vê o Caixa. Fica a pergunta: quem confere a gaveta no fim do dia? Decisão do Eduardo (`09` §5 item 3). Recomendação: a recepção vê "Recebido por você hoje". Ticket APR-039: as 15 telas com os 4 papéis.
2. **Tarefa 3 e "Desfazer" (§5, R-16).** "Cancelado. Desfazer" só vale quando nenhuma pessoa da lista de espera foi avisada. O painel avisa na hora (`appointments/[id]/route.ts:81-100`). Na página pública, "desfazer" sai; fica o 2º passo.
3. **Tarefa 14 (R-17).** A página de confirmar não tem tráfego enquanto o lembrete estiver desligado. A melhoria dela vem depois de ligar o lembrete (APR-617).
4. **Tarefa 13 (R-05).** O "0 divergência entre tela e banco" mede contra o **dia que a cliente tocou**, e não contra o resumo.
5. **§5 "Padrão sensato" (R-18).** O sinal do agendamento não é pré-preenchido como pagamento na comanda: ele aparece como aviso ("Confira se já recebeu"), porque não está registrado em lugar nenhum.
6. **Toques × informação (R-21).** Nenhuma redução de toques pode esconder um número ou um alerta a mais de 1 toque de distância. Cada tarefa redesenhada conta também "toques até o que saiu da tela".
