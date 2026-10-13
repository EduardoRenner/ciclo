# 02 · Interface (Fase 1)

Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md`, Parte C, Fase 1. Base: `origin/main` em `33058dd0`, 13/10/2026.
Insumos usados: `01-diagnostico.md`; `agentes/A-interface.md` (inventário de elementos, M1–M8, checklist das 15 telas); `agentes/B-desempenho.md` (tempo de toque e de tela); `agentes/C-funcionalidade.md`, `D-copy.md`, `E-dados.md`, `F-publico-primeiro-dia.md`; `capturas/` (209 do agente A, 120 do F, 8 do orquestrador, 8 desta fase); `docs/DECISOES.md` (19/08 "escopo reduzido" do computador; 30/08 assistente flutuante); branch do PR #149 (`origin/simplifica/interface-2026-10-08`, ainda aberto) e `docs/95` (fila de chamadas).

**Como ler.** Cada proposta tem um código `I-xx` que a Fase 7 vai transformar em ticket. Entre parênteses fica o ID do achado de origem (A-07, F-01…). Rótulos de evidência como na A3: **FATO** (arquivo:linha, captura ou medida), **[INFERÊNCIA]**, **[HIPÓTESE]** (com como validar), **[NÃO VERIFICADO]** (com motivo).

**Limites honestos desta fase.**
- As telas com dinheiro (Comanda com itens, Caixa e Mês com números) e o Recuperar com lista foram vistos **vazios** pelo agente A (seed sem comanda e sem Motor rodado; `01-diagnostico.md` §6). As propostas para elas saem do código e das capturas vazias. A densidade com o dia cheio fica **[NÃO VERIFICADO]** até existir o seed do E-07.
- Exceção: nesta fase abri uma comanda real no banco local (reprodução do C-01) e vi a Comanda com item, desconto e formas de pagamento (`capturas/fase2-C13-fechar-com-desconto-focado-390.png`).
- Só o papel **dono** foi visto na tela. O que a equipe vê sai do código (`server/auth/rbac.ts:12-33`).
- Ganho em toques e posição na tela é medido na régua do agente A (`medidas/A-dobra.txt`, `A-computador.md`). Ganho em segundos só aparece onde o agente B mediu.

---

## 0 · Decisões transversais (valem para todas as telas)

São oito. Cada tela abaixo só cita o código.

| Código | Decisão | Por quê (evidência) | Esforço | Risco |
| --- | --- | --- | --- | --- |
| **I-01** | **O assistente nunca cobre conteúdo nem ação.** No **celular**, ele sai de cima da tela e vira botão do topo ("✦ Perguntar", ao lado do menu), abrindo o mesmo `Sheet` de hoje. No **computador**, continua a janela flutuante arrastável (decisão de 30/08 em `DECISOES.md`, que é só do computador), com folga até a coluna de conteúdo. | FATO: na ficha, a 360 e 390 px, o botão "Mensagem" aparece cortado ("Mensage") e a metade direita vira toque no assistente (A-01; `capturas/verifica-ficha-fab-390-claro.png`; `components/ui/action-bar.tsx:29-30` × `components/shell/assistente-flutuante.tsx:800-801`). Também cobre o `>` do 3º cartão da Hoje e o valor "Comandas" do Caixa (A-14). **Medido nesta fase no protótipo:** só "subir o botão acima da `ActionBar`" não basta: numa lista com botão à direita (Recuperar, "Chamar") o botão flutuante cobre a linha que estiver embaixo dele em qualquer altura (`capturas/proto-recuperar-normal-390-claro.png`, versão anterior). Por isso o topo. | P | Baixo. Perde-se a "presença" do botão flutuante no celular; se o Eduardo quiser manter flutuante, a alternativa é esconder ao rolar para baixo e voltar ao parar, com a mesma sondagem `elementFromPoint` como aceite. |
| **I-02** | **Uma cor de ação por tela.** O botão central da barra ganha rótulo visível curto e fundo neutro com anel na cor da marca. O assistente passa a cor secundária (fundo `surface`, ícone na cor da marca). A cor cheia (`bg-acc`) fica só para a ação da própria tela. | FATO: 2 elementos `bg-acc` fixos em toda tela do painel; com a ação da tela, viram 3 ou 4 "primários" (Ficha, Campanhas, Agenda/novo) (A-02). O botão central, a função-bandeira, é só ícone no celular (rótulo só em `aria-label`). | M | Médio: muda a cara do painel. Depende do nome do botão central (decisão do Eduardo, D-17; ver `06-copy.md`). |
| **I-03** | **Todo toque de navegação muda algo em menos de 100 ms.** Aba da barra e chip de dia marcam "selecionado + carregando" no mesmo quadro do toque; o esqueleto vem depois. | FATO: 1ª mudança após o toque em 344/516 ms (aba) e 516/1025 ms (dia), mediana/pior de 5, celular 4× (B-09; `medidas/B-interacoes-celular.json`). Na troca de dia, a 1ª mudança **é** o resultado final. | P | Baixo |
| **I-04** | **Estados de tela iguais em todo lugar.** Erro diz a causa certa e o que fazer; vazio explica e convida; sem conexão diz o que ficou guardado. Nada de mostrar zero quando a consulta falhou. | FATO: a Hoje engole 4 de 5 erros e mostra zero sem avisar (`hoje/page.tsx:83-126`); comanda inexistente diz "Pode ter sido a conexão" (A-04); a busca de clientes mostra "Nenhum resultado · Confira a grafia" quando o servidor falha (reproduzido nesta fase, `capturas/fase2-C19-busca-servidor-500-390.png`). | M (espalhado) | Baixo |
| **I-05** | **Computador: duas colunas onde há lista e detalhe**, a partir de 1024 px (`lg`, o mesmo corte da barra lateral): Agenda + detalhe do horário; Clientes + ficha; Recuperar + mensagem/fila; Configurações + subtela; Hoje com a agenda do dia ao lado de "Vale a pena hoje". O resto continua em coluna única, centralizada, com até 720 px. | FATO: coluna fixa de 560 px (`admin/layout.tsx:148`), **50% da largura útil vazia a 1280 e 57% a 1440**; Clientes e Configurações com 3,5 telas de rolagem no monitor (A-06; `medidas/A-computador.md`). **Decisão registrada** (`DECISOES.md`, 19/08, "Escopo reduzido de propósito"): duas colunas ficaram de fora porque "o ganho é especulativo, e o produto é usado em pé, com uma mão, no celular". **Motivo novo:** (1) o vazio agora está medido; (2) o contrato de 13/10 pede explicitamente "duas colunas onde há lista e detalhe". O celular não muda (só classes `lg:`). | G (4 telas) | Médio: toca as telas de lista. Ordem: por último na Onda 1. |
| **I-06** | **O menu do topo segue a mesma regra do hub de Configurações**: módulo desligado ou papel sem permissão some do menu. | FATO: `components/shell/topbar.tsx:22-29` lista Caixa, Serviços, Time, Campanhas, Estoque, Recorrência fixos; o hub filtra (`config/page.tsx:129`) (A-21). | P | Baixo |
| **I-07** | **Escala tipográfica sem 11 px**: o `--text-overline` passa a 12 px. A máscara de esmaecimento dos trilhos só aparece do lado que tem mais conteúdo. | FATO: 11 px em rótulos de 22 das 70 telas (`globals.css:360`) (A-20). A máscara de 12 px à esquerda apaga a borda do 1º item, que é o selecionado ("Todos", "TER 13") (A-16; `globals.css:574`). | P | Baixo |
| **I-08** | **No detalhe do agendamento (sheet), um primário só: a próxima ação.** As outras ações de estado viram secundárias; "Cancelar horário" fica separado no fim, com a consequência escrita. | FATO: `agenda/detalhe.tsx:240-252` desenha cada ação de estado como `Button` primário em sequência, mais "Remarcar" e "Cancelar" (vermelho) na mesma pilha. A confirmação "Cancelar esse agendamento?" não diz a consequência (D-23). | P | Baixo |

---

## 1 · Resumo das 15 telas mais usadas

Frequência pela posição na navegação e pela tarefa-régua (A, §2; [INFERÊNCIA], sem telemetria por rota). "1ª tela" = celular 390×844.

| # | Tela | Pergunta que responde | Veredito | Mudança principal | Ganho esperado (base) | Esforço | Risco | Protótipo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hoje | O que faço agora? | **Refazer a ordem** | Próximo horário e agenda do dia no topo; 1 cartão "vale a pena"; número do dia honesto | Agenda do dia sobe de y≈1080 para y<420 (A-dobra) | M | Médio | `prototipos/hoje.html` |
| 2 | Agenda | Quem vem hoje e quando? | Ajustar | Retorno imediato no dia; sheet com 1 primário; computador lista + detalhe | 1ª mudança 516 → <100 ms (B-09) | M | Baixo | `prototipos/agendar-painel.html` (coluna da agenda) |
| 3 | Agenda/novo | Quando cabe este cliente? | **Refazer** | Horários livres em vez do `datetime-local`; serviço sem pré-escolha arbitrária; volta para o dia criado | Toques: 8 → 6 [INFERÊNCIA, ver §2.3]; erro de horário ocupado antes de enviar | M–G | Médio | `prototipos/agendar-painel.html` |
| 4 | Comanda | Quanto cobrar e como foi pago? | **Refazer o começo** | Nasce com o serviço e o preço combinados; botão "Receber R$ X" | Toques para receber: 7–8 → 3 [INFERÊNCIA, §2.4]; fim do toque engolido (C-13) | M | Alto (dinheiro) | `prototipos/ficha-e-comanda.html` |
| 5 | Caixa | Quanto entrou e sobrou hoje? | Manter, polir | Título "Caixa de hoje"; assistente não cobre número | Valor "Comandas" visível na 1ª tela (A-14) | P | Baixo | captura anotada (§2.5) |
| 6 | Clientes | Onde está fulano? | Ajustar | Busca no topo; números do dono saem para o Mês; ordem alfabética; computador lista + ficha | Busca sobe de y=401 para y<200 (A-dobra) | M | Baixo | `prototipos/ficha-e-comanda.html` (computador) |
| 7 | Ficha do cliente | Como atender esta pessoa? | Ajustar | Assistente acima da barra; 2 números em vez de 5; "Criar orçamento/Indicar" no menu | "Mensagem" 100% tocável a 360/390 (hoje ~50%, A-01) | P–M | Baixo | `prototipos/ficha-e-comanda.html` |
| 8 | Recuperar | Quem chamar agora? | **Refazer a ordem** | Fila de hoje primeiro; 1 fileira de filtro; o resto em "Filtrar" | Lista começa em y≈665 → <420; interativos na dobra 25 → ≤12 (A-07) | M | Médio (conflita com PR #149 e `docs/95`) | `prototipos/recuperar.html` |
| 9 | Campanhas | Funcionou? O que mando agora? | Ajustar | 1 primário; voltar pelo caminho de chegada; números somem quando zero | 4 primários → 1 (A-13) | P | Baixo | — |
| 10 | Mês | Como vai o mês? | Ajustar | "Testar antes de decidir" só com mês fechado | 1º bloco vira o número do mês (A-23) | P | Baixo | — |
| 11 | Configurações | Onde arrumo X? | Reordenar | "Sair" e "Tema" para o fim; grupos "Primeiro dia" e "Avançado" | Itens do 1º dia sobem de y=674 para y<200 (A-08) | P | Baixo | — |
| 12 | Orçamentos | Quais mandei e quais voltaram? | Polir | Voltar pela origem; tirar "0 orçamentos" repetido | — | P | Baixo | — |
| 13 | Página do negócio (`/[slug]`) | Dá para marcar aqui? | Manter | Contato que existe; nota com vírgula | — | P | Baixo | — |
| 14 | Agendar público | Que horário eu consigo? | **Consertar e ajustar** | Resumo e sucesso derivados do horário gravado (F-01); 409 com alternativas que ficam; sucesso sem prometer canal | Fim do agendamento em dia errado (S0) | M | Alto | `prototipos/publico.html` |
| 15 | Confirmar (`/confirmar/[token]`) | É este o meu horário? | **Refazer** | Mostrar negócio, serviço, dia e hora antes dos botões; desmarcar com 2º passo e desfazer | Dado visível antes do toque (hoje 0 dado, A-03) | M | Baixo | `prototipos/publico.html` |

**Códigos das propostas por tela** (usados nas Fases 2–7): **I-09** Hoje reordenada · **I-10** grade de horários livres no painel (Agenda/novo e Remarcar) · **I-11** Comanda nasce com o item e "Receber R$ X" · **I-12** Clientes com busca no topo, ordem alfabética e computador lista + ficha · **I-13** Ficha com 2 números e "Marcar de novo" · **I-14** Recuperar com a fila no topo e "Filtrar" · **I-15** Confirmar com o horário e desmarcar em 2 passos · **I-16** Agendar público (resumo do horário escolhido, 409 que fica, sucesso honesto) · **I-17** Configurações reagrupadas · **I-18** Campanhas com 1 primário · **I-19** Mês sem "Testar" vazio · **I-20** Caixa polido.

Gate G1 "as 10 mais usadas com protótipo ou captura anotada": Hoje, Agenda, Agenda/novo, Comanda, Clientes, Ficha, Recuperar, Agendar público e Confirmar têm protótipo; Caixa tem captura anotada (§2.5).

---

## 2 · Telas, uma por uma

Formato fixo: **pergunta e ação · veredito · problemas (com captura) · proposta celular · proposta computador · sai ou esconde · ganho · esforço · risco.** O inventário de cada elemento (leitor e decisão) está em `agentes/A-interface.md` §3; aqui entra só o que muda.

### 2.1 Hoje (`/admin/hoje`)

**Pergunta:** "O que faço agora?" **Ação principal:** atender o próximo (abrir o horário) ou marcar um novo.

**Veredito:** a tela responde com cartões de configuração, não com o dia. A ordem precisa virar.

**Problemas.**
- FATO: no dia cheio, o 1º bloco é "Atendido hoje R$ 0,00 · 100% abaixo do costume nesse dia da semana", medido de madrugada (`capturas/dia-cheio_admin_hoje-390.png`). A comparação usa o dia **parcial** contra a média de dias **inteiros** (A-05; `server/services/resumo-hoje.ts:140,154,175`). De manhã a frase é sempre "abaixo".
- FATO: "A seguir" mostra **um** horário; o resto do dia fica abaixo de 3 cartões de "Vale a pena hoje" (fichas sem última visita, aniversariantes, maquininha). Na conta sem horário hoje, "Novo agendamento" fica em y≈1080 no celular e y≈964 no computador (A-dobra; `capturas/admin_hoje-1280-claro.png`).
- FATO: data em 11 px, saudação "Bom dia" às 01h37, nome do negócio repetido, "Ver meu site" em 12 px.
- FATO: 4 de 5 consultas engolem erro e mostram zero (`hoje/page.tsx:83-126`).
- FATO (reproduzido nesta fase): no HTML do servidor em UTC (como na Vercel), a hora do próximo cliente sai **3 horas adiantada** e fica visível por 819–1093 ms no celular 4×/4G lenta, até a hidratação trocar (C-07; `medidas/fase2-reproducoes.json`, `fase2-c07-janela-hora-errada.mjs.txt`). É defeito de funcionalidade (Fase 2), mas aparece nesta tela.
- FATO: abrir o horário pela Hoje tem INP 208/216 ms, acima da meta de 200 (B-15).

**Proposta (celular).** Ordem nova, de cima para baixo:
1. Cabeçalho de uma linha: "Terça, 13 de outubro" + botão "Compartilhar link" (ícone com rótulo curto). Sai a saudação; sai o nome do negócio.
2. **Agora / A seguir**: o próximo horário em destaque (hora, nome, serviço, estado), com as ações dele num toque: "Chegou" (primário) e "Mensagem". Se alguém está atrasado para chegar, aparece aqui.
3. **Resto do dia**: lista compacta (hora · nome · serviço · estado), uma linha por horário, até o fim do expediente. Toque abre o sheet (I-08). Se não há mais nada: "Nada mais para hoje" + "Marcar horário" + "Compartilhar meu link".
4. **Número do dia**, numa linha: "Atendido até agora: R$ 210,00 · 3 de 7 horários". A comparação com o costume só aparece depois do fim do expediente, ou compara "até esta hora" nos dias anteriores (decisão de fórmula fica na Fase 2, item de A-05/C-26).
5. **Vale a pena hoje**: um cartão só, o de maior valor; o resto em "Ver mais 2".
6. Erro de qualquer bloco: o bloco mostra "Não consegui carregar isto. Tocar para tentar de novo." (I-04), nunca zero.

**Proposta (computador).** Duas colunas (I-05): à esquerda, "Agora" + "Resto do dia"; à direita, número do dia + "Vale a pena hoje". A ação principal ("Marcar horário") fica no topo da coluna da esquerda, visível sem rolar.

**Sai ou esconde.** Saudação (sai) · nome do negócio (sai) · "Ver meu site" (vai para o menu) · 2 dos 3 cartões de "Vale a pena" (atrás de "Ver mais") · "% abaixo do costume" de manhã (sai até o fim do expediente).

**Ganho esperado.** Com 1 horário hoje, o próximo cliente já está em y≈340 (`capturas/dia-cheio_admin_hoje-390.png`); a mudança põe a **lista do dia** logo abaixo dele, em y<420, onde hoje estão os cartões de configuração. Sem horário, "Marcar horário" sobe de y≈1080 para y<420 (A-dobra). Toques para "marcar que chegou": hoje 2 (abrir sheet + Chegou) → 1 no próximo horário [INFERÊNCIA pelo fluxo]. Medir com `A-dobra` e `B-interacoes`.

**Esforço:** M. **Risco:** médio. A Hoje tem várias guardas de copy (`home-nao-promete-demais`, `hoje-*`); reordenar pode quebrar asserção de posição. Depende de C-07 (hora certa) e de A-05 (fórmula).

**Protótipo:** `prototipos/hoje.html` (celular e computador; estados normal, carregando, vazio, erro de bloco, sem conexão, dia longo com 14 horários; tema escuro).

### 2.2 Agenda (`/admin/agenda`)

**Pergunta:** "Quem vem e quando?" **Ação:** abrir um horário; marcar novo.

**Veredito:** boa no celular; falta retorno ao toque e o sheet tem primários demais.

**Problemas.** FATO: trocar de dia não muda nada por 516/1025 ms (B-09). FATO: botões de dia com 43–44 px de largura a 360 px (A-15). FATO: máscara apaga a borda do dia selecionado (A-16; `capturas/admin_agenda-390-claro.png`). FATO: o vazio diz "Toque no botão +", e o botão da barra se chama "Marcar" (D-44). FATO: sheet com várias ações primárias e "Cancelar" vermelho na mesma pilha (I-08). FATO: remarcar mostra só o texto do 409, sem as alternativas que a API já devolve (C-10). FATO: "Previsto R$ 0,00" no topo (leitor: dono; decisão: nenhuma no momento).

**Proposta (celular).** Chip de dia marca o dia na hora (I-03). Trilho de dias com 7 dias de 48 px e deslize para a semana seguinte (a 360 px, 6 visíveis + rolagem). "Ocupação do dia" fica; "Previsto" sai para o Caixa/Hoje. Sheet do horário: primário = próxima ação do estado ("Confirmar" se pendente; "Chegou" se confirmado; "Concluir" se chegou); "Faltou", "Remarcar" e "Mensagem" como secundários; "Cancelar horário" separado no fim, com confirmação que diz a consequência. Remarcar usa a mesma grade de horários livres de I-10 e mostra as alternativas no 409.

**Proposta (computador).** Lista do dia à esquerda (largura 420 px), detalhe do horário à direita, sem sheet (I-05). Seletor de semana no topo.

**Sai ou esconde.** "Previsto" (sai). Texto "botão +" (troca).

**Ganho.** 1ª mudança no toque do dia: 516 ms → < 100 ms [HIPÓTESE pelo padrão já medido nos botões de escrita, 33–76 ms, B §3]. Alvo 43 → 48 px a 360. Medir com `B-interacoes.mjs` e `A-varredura` (M3).

**Esforço:** M. **Risco:** baixo.

**Protótipo:** coluna da agenda em `prototipos/agendar-painel.html` (computador).

### 2.3 Agenda/novo (`/admin/agenda/novo`)

**Pergunta:** "Quando cabe este cliente?" **Ação:** marcar o horário.

**Veredito:** é um formulário genérico onde devia haver uma grade de horários. Refazer o meio.

**Problemas.**
- FATO: data e hora num único `datetime-local` vazio ("dd/mm/aaaa --:--"), sem horários livres; o agendamento **público** mostra horários livres, o do dono não (A-09; `capturas/admin_agenda_novo-390-claro.png`).
- FATO: o serviço vem pré-escolhido como o 1º do catálogo ("Barba · R$ 35,00").
- FATO: o conflito só aparece ao enviar; depois de salvar, volta para a agenda de **hoje** e o horário criado (amanhã) não aparece (C-11, F-12).
- FATO: "Repetir é do Solo" aparece para barbearia com plano Equipe, quando o motivo é a profissão (F-13).
- FATO: a hora é convertida pelo fuso do **aparelho** (C-08), e a busca do cliente pré-preenchido roda no navegador depois de montar (B-12): tocar "Confirmar" antes disso faz o formulário recusar.
- FATO: o botão "Confirmar agendamento" cria agendamento **pendente** (D-05).

**Proposta (celular).** Ordem: **Cliente** (busca por nome ou telefone; se não achar, "Cadastrar {nome}" ali mesmo) → **Serviço** (lista dos mais usados primeiro; sem pré-escolha se não houver cliente; se houver, o último serviço dele) → **Profissional** ("Qualquer um" + nomes) → **Dia** (trilho de dias) → **Horários livres** (grade por Manhã/Tarde/Noite, igual à pública, já descontando conflito e expediente) → "Outro horário" (abre o campo manual, para encaixe fora da grade) → "Repetir este horário" (fechado, em "Mais opções") → botão "Marcar horário" com o resumo ("Marcar: Ana · Corte · qui 15/10, 14:00"). Depois de salvar: vai para a Agenda **no dia do horário**, com a linha nova destacada por 2 s. Conflito (409) no envio: aviso que fica + 3 alternativas tocáveis.

**Proposta (computador).** Formulário à esquerda; a agenda do dia escolhido à direita, atualizando quando o dia muda (a pessoa vê o buraco antes de escolher).

**Sai ou esconde.** `datetime-local` como caminho principal (vira "Outro horário"); "Repetir" (em "Mais opções"); pré-escolha arbitrária de serviço.

**Ganho.** Contagem no fluxo (F mediu 8 toques no 1º agendamento: serviço, profissional, nome, telefone, data/hora ≈ 3 no seletor nativo, confirmar; `F-publico-primeiro-dia.md`, "Primeiro dia"). Proposto, cliente já cadastrado: cliente (2: digitar + escolher) + serviço (1) + dia (1) + horário (1) + marcar (1) = **6**, com 0 erro de horário ocupado na grade [INFERÊNCIA pela grade; medir com Playwright no fluxo F-primeiros-cadastros]. Para cliente novo: +1 (telefone). A meta da A7 para tarefa-régua frequente é ≤ 2 toques; agendar não chega a 2 sem perder informação obrigatória. Ver `04-facilidade.md` (atalho "Marcar de novo" na ficha e na Hoje: 2 toques).

**Esforço:** M–G (a grade existe no público: `[slug]/agendar/agendar.tsx`; precisa virar componente compartilhado e chamar a disponibilidade do painel). **Risco:** médio: o público tem um S0 de corrida (F-01) na mesma busca; a grade compartilhada nasce **já** com "a resposta mais recente vence".

**Protótipo:** `prototipos/agendar-painel.html` (estados: carregando horários, sem horário no dia, conflito 409 com alternativas, sucesso com destaque, sem conexão com fila; computador com a agenda ao lado).

### 2.4 Comanda (`/admin/comanda/[id]`)

**Pergunta:** "Quanto cobrar e como foi pago?" **Ação:** receber.

**Veredito:** o fim da tela é bom (formas de pagamento em botões, total grande). O começo está errado: a comanda nasce vazia e oferece o serviço errado.

**Problemas.**
- FATO (reproduzido nesta fase): concluir o horário "Corte + barba · R$ 70,00" abre a comanda **vazia**, com "Barba · R$ 35,00" pré-escolhido (C-01; `capturas/fase2-C01-comanda-nasce-vazia-390.png`; `medidas/fase2-reproducoes.json` → `c01`).
- FATO (reproduzido nesta fase): com o campo de desconto focado, **um** toque em "Fechar comanda" só dispara o PATCH do desconto; a comanda não fecha (C-13; `capturas/fase2-C13-fechar-com-desconto-focado-390.png`).
- FATO: "Fechar comanda" não diz o valor (D-42). Comanda fechada diz "Nada mais pode mudar aqui" e não há "Desfazer fechamento" (C-41).
- FATO: id inexistente mostra "Pode ter sido a conexão" (A-04).
- FATO: abrir a comanda pelo horário passa por um `redirect()` do servidor: 3118/3270 ms até o conteúdo no celular, a pior tela medida (B-11).

**Proposta (celular).** Topo: cliente, serviço e profissional do horário (leitura). **Itens:** já vem 1 item com o serviço e o preço **combinados** (o do agendamento). "Adicionar item" (serviço ou produto) fica fechado num botão secundário. **Desconto e gorjeta:** fechados em "Desconto ou gorjeta" (a maioria das comandas não tem). **Como foi pago:** os 5 botões de hoje. **Botão:** "Receber R$ 60,00" (o total na hora), que leva desconto e gorjeta no mesmo envio (resolve C-13). Comanda fechada: resumo + "Desfazer fechamento" (secundário, com confirmação que diz "volta a ficar aberta; o caixa de {dia} muda").

**Proposta (computador).** Duas colunas: itens e desconto à esquerda; resumo, forma de pagamento e "Receber" à direita, fixos.

**Sai ou esconde.** Seletor de serviço aberto por padrão (vira "Adicionar item"); campos de desconto e gorjeta sempre abertos.

**Ganho.** Toques para receber um atendimento simples, contados no fluxo atual: Concluir (1) → Ver comanda (2) → abrir seletor (3) → escolher serviço (4) → Adicionar (5) → forma (6) → Fechar (7), mais 1 se houver desconto focado (C-13) = **7–8**. Proposto: Concluir (1) → Ver comanda (2) → forma (3) → Receber (4) = **4**, e **3** se "Concluir" já levar à comanda [INFERÊNCIA pelo fluxo; medir com o roteiro do B, `B-interacoes.mjs`]. Tempo até a comanda: 3118 ms → metade [INFERÊNCIA do B-11: 2 renders → 1].

**Esforço:** M (precisa do conserto C-01 no servidor). **Risco:** alto, é dinheiro; nada de resposta otimista aqui (Fase 4).

**Protótipo:** `prototipos/ficha-e-comanda.html` (estados: aberta com item, com desconto, enviando, fechada com "Desfazer", erro de rede sem perder nada).

### 2.5 Caixa (`/admin/caixa`) · captura anotada

**Pergunta:** "Quanto entrou e sobrou hoje?" **Ação:** nenhuma de escrita; ir fechar o que falta.

**Veredito:** manter. Polir 3 pontos.

**Captura anotada** (`capturas/admin_caixa-390-claro.png`, `capturas/dia-cheio_admin_caixa-390.png`):
1. Topo, y≈70–140: "HOJE / Caixa / terça-feira, 13 de outubro" são três linhas para um título. **Proposta:** "Caixa de hoje" + data em 13,5 px.
2. Meio, y≈160–220: setas de dia + campo "Ir para" de 242×48 (FATO, A §1.1: o rótulo tem 48 px). **Mantém.**
3. Vazio: "Nenhuma comanda fechada nesse dia" + "Ver a agenda". **Mantém**; acrescentar "Você atendeu R$ X hoje e ainda não fechou as comandas" quando houver horário concluído sem comanda (o número já existe: `caixa/page.tsx:123-148`).
4. Fim da 1ª tela: "Entrou no mês · Sobrou no mês · Comandas"; o valor "Comandas" fica **coberto pelo assistente** (A-14). **Conserto:** I-01.

**Computador:** coluna única de 720 px; o detalhe por forma de pagamento e por profissional ao lado do resumo do dia (2 colunas só a partir de 1280).

**Esforço:** P. **Risco:** baixo. Números: dependem da fonte única (C-26, Fase 2).

### 2.6 Clientes (`/admin/clientes`)

**Pergunta:** "Onde está fulano?" **Ação:** buscar e abrir a ficha.

**Veredito:** a busca é a ação da tela e está no meio dela.

**Problemas.** FATO: busca em y=401; acima dela, "Ticket médio R$ 66,35", "Voltam de novo 100%" e aniversariantes (A-dobra; `capturas/admin_clientes-390-claro.png`). FATO: ordem aleatória (por UUID) (C-18). FATO (reproduzido nesta fase): com o servidor falhando, a busca diz "Nenhum resultado · Confira a grafia" (C-19). FATO: "Voltam de novo 100%" na tela em que 6 cartões dizem "sumido" (A-12). FATO: com 295 clientes, 6,6 s até o título no celular 4× (F-21, medida única). FATO: "Cadastrar cliente" é só ícone; "Baixar todos em planilha" em 12 px.

**Proposta (celular).** Título + contagem → **busca** (y<200) → filtros em 1 trilho (Aniversariantes, Primeira visita sem volta, Gasto alto) → lista **em ordem alfabética** com a letra como separador, ou "visitou por último" como alternativa no mesmo controle. "Nova" com rótulo visível. Os números do dono ("Gasto médio por visita", "Voltam de novo") vão para o Mês. Valor em R$ por linha só para quem tem `report:read` [INFERÊNCIA: a recepção não decide nada com ele]. Busca que falha: "Não consegui buscar agora. Tocar para tentar de novo." (I-04).

**Proposta (computador).** Lista à esquerda (420 px), ficha à direita (I-05). A URL muda (`/admin/clientes/[id]`), para o voltar do navegador funcionar.

**Sai ou esconde.** "Ticket médio" e "Voltam de novo" (para o Mês); "Baixar todos em planilha" (para o menu da tela).

**Ganho.** Busca y=401 → <200 (A-dobra). Achar alguém rolando passa a ser possível (hoje a ordem é aleatória).

**Esforço:** M (lista + computador). **Risco:** baixo.

**Protótipo:** coluna da lista em `prototipos/ficha-e-comanda.html` (computador).

### 2.7 Ficha do cliente (`/admin/clientes/[id]`)

**Pergunta:** "Como atender esta pessoa?" **Ação:** marcar o próximo horário ou mandar mensagem.

**Veredito:** a estrutura (abas, "Como atender" no topo) resolveu o `docs/11` E1 (A, §5). Falta tirar números e o que cobre a ação.

**Problemas.** FATO: assistente cobre "Mensagem" (A-01; `capturas/admin_clientes_ID-390-claro.png`: "Mensage" cortado). FATO: 5 números na aba Resumo, com "Valor atendido R$ 225,00" ao lado de "Sobrou R$ 0,00 · nenhuma comanda fechada ainda" (A-22, D-18). FATO: "Criar orçamento" e "Indicar" como botões cheios no meio da aba. FATO: rótulos de estado no feminino ("Atendida", "Cancelada") (D-13).

**Proposta (celular).** Cabeçalho igual. "Como atender" igual. Aba Resumo com **2 números**: "Visitas" e "Gasto médio por visita"; "Sobrou" só quando houver comanda fechada; "Faltas" só quando > 0. Menu "⋯ Mais" no cabeçalho com "Criar orçamento", "Indicar", "Exportar dados", "Apagar cadastro". Barra de ação: "Marcar de novo" (primário, abre Agenda/novo com cliente **e** último serviço) e "Mensagem" (secundário). Assistente acima da barra (I-01).

**Proposta (computador).** Ficha à direita da lista de clientes (I-05); abas viram seções lado a lado a partir de 1280 (Resumo | Histórico).

**Sai ou esconde.** 3 dos 5 números (condicionais); 2 botões cheios (menu).

**Ganho.** "Mensagem" 100% tocável a 360/390 (hoje ~metade, A-01). "Marcar de novo" leva a agendar em 4 toques (cliente e serviço já vêm) [INFERÊNCIA].

**Esforço:** P–M. **Risco:** baixo.

**Protótipo:** `prototipos/ficha-e-comanda.html`.

### 2.8 Recuperar (`/admin/recuperar`)

**Pergunta:** "Quem eu chamo agora?" **Ação:** chamar a próxima pessoa pelo WhatsApp.

**Veredito:** a resposta está embaixo de 3 fileiras de filtro. Refazer a ordem, **sem atropelar** o PR #149 e o `docs/95`.

**Problemas.** FATO: 25 interativos na 1ª tela; a lista (ou o vazio) começa em y≈665; "Recalcular agora" fora da dobra no celular e no computador (A-07; `capturas/admin_recuperar-390-claro.png`). FATO: "Atrasadas" e "Atrasado" em fileiras diferentes; "Ouro/Prata/Bronze", "nota 72", "na janela" sem explicação (D-14, D-19). FATO: aviso "6 serviços sem custo do material" numa conta sem cliente (F-26). FATO: trocar filtro sem rede deixa a lista anterior sob o rótulo novo (C-20, código).

**O que já está em andamento (não refazer).** O PR #149 (aberto) põe "Ordenar", classe e perfil dentro de "Mais filtros" e leva o aviso de custo para dentro do "Como a conta é feita" (`git diff origin/main...origin/simplifica/interface-2026-10-08 -- src/app/admin/recuperar/recuperar.tsx`). A fila de chamadas do `docs/95` E2 já existe (`recuperar/fila.tsx`: "X de Y na fila de hoje", "Chamar pelo WhatsApp").

**Proposta (celular), por cima do #149.**
1. Título "Quem sumiu" (nome depende da decisão D-17) + 1 linha: "R$ 1.240 parados em 18 pessoas · estimativa".
2. **Fila de hoje** no topo: o cartão da próxima pessoa (nome, serviço, há quanto tempo passou da hora, último valor) com "Chamar pelo WhatsApp" (primário) e "Pular" / "Não chamar mais" (secundários).
3. **Um** trilho de situação (Todos · Na hora de voltar · Passou da hora · Em risco · Sem previsão) + botão "Filtrar" que abre um sheet com Ordenar, Quanto gasta e Perfil.
4. A lista completa abaixo da fila.
5. Vazio: o motivo certo (sem cliente; Motor não rodou; ninguém atrasado) e **uma** ação, sem filtros na tela.

**Proposta (computador).** Fila e lista à esquerda; à direita, a mensagem pronta da pessoa selecionada, editável, com "Abrir no WhatsApp" (I-05).

**Sai ou esconde.** 2 fileiras de filtro e o "Ordenar" (para o sheet "Filtrar"); filtros inteiros quando a lista está vazia; "Campanhas" do topo (vai para o menu); aviso de custo sem cliente.

**Ganho.** Lista/fila começa em y<420 (hoje y≈665); interativos na 1ª tela 25 → ≤ 12 (A-07, régua `A-dobra`). Medir com `A-varredura` depois do seed com Motor rodado (E-07).

**Esforço:** M. **Risco:** médio: conflita com o PR #149 e com o E2–E4 do `docs/95` (mesmo arquivo). Fazer **depois** de o #149 entrar, no mesmo arquivo, sem reabrir a decisão da fila.

**Protótipo:** `prototipos/recuperar.html`.

### 2.9 Campanhas (`/admin/campanhas`)

**Veredito:** ajustar. FATO: "Nova campanha" e "Criar a primeira" são dois primários para o mesmo destino; o voltar leva a Configurações, embora se chegue pela Hoje (A-13; `components/shell/navegacao.ts:24-25`). FATO: "Voltaram este mês R$ 0,00 · 0 de 0 mensagens" na conta sem campanha. FATO: o paywall vende "mandar para todos de uma vez" e o produto manda uma por toque (D-01, S1, ver `06-copy.md`).

**Proposta.** Um primário ("Nova campanha"); vazio sem 2º botão; números somem quando zero; voltar pelo caminho de chegada (`paiDaRota` passa a aceitar a origem, ou volta para Hoje, que é a entrada mais comum). Computador: lista de campanhas + resultado ao lado.

**Esforço:** P. **Risco:** baixo.

### 2.10 Mês (`/admin/mes`)

**Veredito:** ajustar. FATO: com o mês vazio, o 1º bloco é "Testar antes de decidir" (A-23). FATO: com ~220 comandas em 90 dias a tela **cai** (B-00b, E-05; S1 da Fase 2). FATO: "Sobrou" e "lucro" na mesma tela (D-18).

**Proposta.** 1º bloco: "Entrou no mês" e "Sobrou no mês" com a comparação com o mês passado; depois vazamentos; "Testar antes de decidir" só com 1 mês fechado. Recebe os números que saem de Clientes ("Gasto médio por visita", "Voltam de novo", com a definição escrita). Computador: 2 colunas (resumo | vazamentos).

**Esforço:** P (interface). **Risco:** baixo.

### 2.11 Configurações (`/admin/config`)

**Veredito:** reordenar. FATO: a 1ª tela é "Sua conta" + "Sair da conta" com botão de largura cheia + Tema; os itens do 1º dia começam em y=674; 3,4 telas de rolagem; descrições cortadas com "…" (A-08; `capturas/admin_config-390-claro.png`).

**Proposta.** Grupos, nesta ordem: **Seu negócio** (Negócio e página, Horários, Serviços, Equipe) · **Dinheiro** (Taxas da maquininha, Aluguel e contas, Comissão) · **Clientes e mensagens** (Mensagens, Automações, Clube mensal, Campanhas) · **Avançado** (Módulos, Cofre, Segurança, Notificações) · **Sua conta** (Meu plano, Tema, Sair, Excluir conta). Descrição em 1 linha, sem corte. "Sair" vira linha comum, não botão cheio. Computador: lista à esquerda, subtela à direita (I-05).

**Ganho.** Itens do 1º dia em y<200 (hoje 674). **Esforço:** P. **Risco:** baixo.

### 2.12 Orçamentos (`/admin/orcamentos`)

**Veredito:** polir. FATO: "< Configurações" como voltar, mas chega-se também pela ficha; "Orçamentos · 0 orçamentos" repete o vazio. **Proposta:** voltar pela origem; subtítulo só com número > 0; computador lista + orçamento ao lado. **Esforço:** P.

### 2.13 Página do negócio (`/[slug]`)

**Veredito:** manter. FATO: um primário ("Agendar horário", y=239), 6 serviços com preço e duração, nada sobrando (A §3.13). **Ajustes:** nota com vírgula ("4,5", D-36); "Contato" que existe de verdade (conta nova não tem telefone público, F-04); artigo antes do nome do negócio (D-26, F-15). Computador: coluna de 720 px com serviços em 2 colunas.

### 2.14 Agendar público (`/[slug]/agendar`)

**Pergunta:** "Que horário eu consigo?" **Ação:** pedir o horário.

**Veredito:** o desenho é bom (passos numerados, Manhã/Tarde/Noite). O comportamento tem um S0 e a mensagem de conflito some.

**Problemas.**
- FATO: **grava outro dia** do que mostra (F-01, S0). Conferi no banco local nesta fase: os 3 agendamentos da medição do agente F estão em "Tue 13/10 09:00" (Bruna, Vitória, Larissa), e a tela tinha dito quinta 15, sábado 17 e domingo 18. Causa no código: `agendar.tsx:448-501` grava `setSlots` depois do `await` sem descartar resposta velha; o resumo monta o dia com `dia` e a hora com `slotEscolhido.startsAt` (`:1202-1208`, `:703-710`).
- FATO: horário tomado (409): o aviso é apagado no mesmo instante e não há alternativas (F-02; `capturas/F-agendar-ocupado-celular.png`).
- FATO (reproduzido nesta fase): reenviar o mesmo pedido depois de perder a resposta dá 409 "Esse horário acabou de ser reservado" para o próprio horário (C-04; `medidas/fase2-reproducoes.json` → `c04`).
- FATO: o sucesso diz "é só chamar por telefone" numa conta sem telefone (F-04); o botão diz "Confirmar agendamento" e o pedido nasce pendente (D-04).
- FATO: 6 tarefas longas na carga fria do celular (859 ms somados) (B-15). FATO: dias fechados com critério diferente (DOM aparece, SEG não) (A-24).

**Proposta (celular).** Passos iguais. Mudanças: (1) o resumo da barra fixa e o sucesso mostram **dia e hora tirados do horário escolhido** ("quinta, 15/10, às 09:00"); (2) trocar de dia limpa a lista e mostra esqueleto até a resposta **daquele** dia; (3) 409: aviso que fica, 3 horários próximos tocáveis, nome e telefone mantidos; (4) botão "Pedir este horário"; (5) sucesso: "Pedido enviado para {negócio}: quinta, 15/10, às 09:00. Quem atende confirma pelo telefone que você deixou." + "Adicionar à agenda do celular"; (6) dias fechados sempre aparecem riscados com "fechado", ou nunca aparecem (uma regra só).

**Proposta (computador).** Duas colunas a partir de 1024: escolhas à esquerda; resumo fixo à direita.

**Ganho.** S0 eliminado (critério: 0 de 20 com resposta fora de ordem forçada, `F-corrida-dia.mjs`). 409 com saída na mesma tela.

**Esforço:** M. **Risco:** alto (é a página que fala pelo negócio). Medir antes de divulgar.

**Protótipo:** `prototipos/publico.html` (estados: carregando horários, sem horário no dia, 409 com alternativas, enviando, sucesso, sem conexão; corrida mostrada lado a lado: "antes" × "depois").

### 2.15 Confirmar (`/confirmar/[token]`)

**Pergunta:** "É este o meu horário?" **Ação:** confirmar.

**Veredito:** refazer. FATO: "Confirma seu horário?" sem dizer qual (a página não carrega nada no servidor); "Preciso desmarcar" cancela num toque, sem confirmação nem desfazer; token inválido só aparece depois do toque; reabrir depois de confirmar pergunta de novo (A-03, C-21, F-07; `capturas/confirmar_TOKEN-FALSO-390-claro.png`). FATO: hoje a página não recebe tráfego, porque o lembrete que gera o link está desligado (`cron.yml:196-253`; F-07).

**Proposta.** Carregar no servidor pelo token: "{Negócio} · Corte · quinta, 15/10, às 14:00 · com Anderson". Botões: "Vou sim" (primário) e "Preciso desmarcar" (secundário). Desmarcar abre o 2º passo: "Desmarcar quinta, 15/10, às 14:00? O horário fica livre para outra pessoa." + "Sim, desmarcar" / "Voltar"; depois, "Horário desmarcado" + "Desfazer" por 10 s. Já confirmado: "Você já confirmou. Até quinta!" Token inválido: abre no estado de erro, com o link da página do negócio quando o token traz o negócio (A-10). Página com `noindex` (Fase 6).

**Esforço:** M (precisa de GET público pelo token). **Risco:** baixo.

**Protótipo:** `prototipos/publico.html` (aba "Confirmar").

---

## 3 · As 15 telas × checklist de 17 itens (antes → depois)

Antes = medição do agente A (`agentes/A-interface.md` §4). Depois = meta com as propostas acima. **P** passa · **F** falha · **~** parcial · **?** não visto · **—** não se aplica. Onde "depois" ainda não é P, a nota diz por quê.

| # | Item | Hoje | Agenda | Ag/novo | Comanda | Caixa | Clientes | Ficha | Recuperar | Campanhas | Mês | Config | Orçam. | Salão | Agendar | Confirmar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 pergunta, 1 ação, 1 primário | F→P | ~→P | ~→P | ?→P | P | ~→P | F→P | F→P | F→P | P | ~→P | P | P | P | P |
| 2 | Leitor e decisão em cada elemento | ~→P | P | P | ?→P | P | ~→P | ~→P | F→P | ~→P | ~→P | ~→P | P | P | P | F→P |
| 3 | Hierarquia título→estado→ação→detalhe | F→P | P | P | ?→P | P | ~→P | P | F→P | ~→P | ~→P | F→P | P | P | P | ~→P |
| 4 | Ação principal na zona do polegar | ~→P | P | P | ?→P | — | ~→P | F→P | F→P | ~→P | — | — | P | ~→P | P | P |
| 5 | 7 estados de botão | P | P | P | ?→P | P | P | P | P | P | P | P | P | P | P | P |
| 6 | Estados de tela | ~→P | P | P | F→P | P | P→P¹ | ~→P | P | P | P | ~→P | P | ~→P | P | ~→P |
| 7 | Consistência com o design system | P | P | ~→P | P | P | P | P | ~→P | P | P | P | P | P | P | P |
| 8 | Escala tipográfica | ~→P | ~→P | P | P | ~→P | ~→P | ~→P | ~→P | ~→P | P | ~→P | P | ~→P | ~→P | P |
| 9 | Ícone com rótulo; cor nunca sozinha | F→P | F→P | F→P | F→P | F→P | F→P | F→P | F→P | F→P | F→P | F→P | F→P | P | P | P |
| 10 | Destrutiva separada, confirmação, ≥ 48 | P | P→P² | P | ?→P | — | P | ~→P | — | — | — | ~→P | — | — | — | F→P |
| 11 | Voltar leva aonde se espera | P | P | P | P | P | P | P | P | F→P | ~→P | P | ~→P | — | — | — |
| 12 | Computador: 2 colunas, ação visível | F→P | F→P | ~→P | F→P | F→~³ | F→P | F→P | F→P | F→P | F→P | F→P | F→P | ~→P | ~→P | ~→P |
| 13 | Escuro com o mesmo contraste | P | P | P | P | P | P | P | P | P | P | P | P | —⁴ | —⁴ | —⁴ |
| 14 | A11y (AA, foco, ordem, leitor, zoom) | ~→P | P | P | ?→P | P | P | P | P | P | P | P | P | P | P | P |
| 15 | Movimento com `prefers-reduced-motion` | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| 16 | Densidade: vê o que precisa sem rolar | F→P | P | P | ?→P | P | ~→P | ~→P | F→P | P | P | F→P | P | P | ~→P | ~→P |
| 17 | Sem rolagem horizontal cortada | P | ~→P | P | P | P | ~→P | ~→P | ~→P | P | P | P | P | P | ~→P | P |

¹ Clientes: o estado de erro existe, mas a busca mente quando o servidor falha (C-19, reproduzido): o item passa a exigir o aviso.
² Agenda: o alvo destrutivo passa, mas o "Cancelar" está na mesma pilha das ações de estado (I-08).
³ Caixa: coluna única de 720 px no computador é aceitável (tela de leitura); 2 colunas só a 1280.
⁴ Públicas cravam tema claro de propósito (`tela-publica.tsx:50`, `[slug]/layout.tsx:84`): é a cor do negócio. Não propor escuro sem decisão.

Item 9 (ícone com rótulo) falha em todas as telas do painel por causa do botão central e do assistente (I-02). Item 14 "zoom 200%" ficou [NÃO VERIFICADO] como zoom; o A inferiu pela largura CSS de 640 px.

---

## 4 · Demais telas (55), agrupadas

Cada grupo: veredito, o que muda, checklist (só os itens que falham hoje), esforço. Capturas em `capturas/<rota>-390-claro.png` e `-1280-claro.png`.

### 4.1 Configurações · 17 subtelas

| Subtela | Veredito | O que muda | Itens que falham hoje | Esforço |
| --- | --- | --- | --- | --- |
| `automacoes` | Ajustar | Contraste de 3 nós (A-17); toast com `aria-live` | 14, 6 | P |
| `cofre` | Manter | — | — | — |
| `custo-fixo` | Manter | Título "Aluguel e contas" (D, glossário) | — | P |
| `excluir-conta` | Ajustar | `loading.tsx` (único do painel sem, A §2); avisar que a fila offline será descartada (C, "Excluir conta descarta a fila sem avisar"); 401 na carga a investigar ([NÃO VERIFICADO] qual recurso) | 6 | P |
| `horarios` | **Consertar** | Folga sem `try` derruba a tela (C-05, **reproduzido**: `capturas/fase2-C05-folga-rede-caiu-390.png`); folga com padrão +3h no HTML do servidor (C-08, **reproduzido**: `05:44` em UTC × `02:44` em SP); salvar por `onBlur` ou botão, não a cada tecla (C-22) | 6 | P–M |
| `mensagens` | Polir | Modelo de indicação promete desconto (D-10); emoji (D-47) | — | P |
| `meu-plano` | Ajustar | Data de fim em UTC (C-49); "Cancelar meu plano" ≠ "Cancelar clube" (D-21) | — | P |
| `modulos` | Manter | Menu do topo passa a obedecer (I-06) | — | — |
| `negocio` | Ajustar | Pedir WhatsApp do negócio e nome de exibição (F-04, F-20) | — | P |
| `notificacoes` | Ajustar | Sem toast e sem `aria-live` (A §2.5); copy técnica ("Web Push", "neste ambiente", D-41) | 6, 14 | P |
| `planos` | Ajustar | "Clube mensal" (D-21); "do plano Avançado" (D-02, S1) | — | P |
| `profissionais` | **Consertar** | Convite gera link 404 (C-37, **reproduzido**: `curl /convite/abc123` → 404); sem entrada para o expediente por profissional (C-39): link "Expediente e folgas" em cada linha | 2, 6 | M |
| `profissionais/[id]` | Ajustar | Ganha entrada (C-39); toast sem `aria-live` | 14 | P |
| `seguranca` | Manter | — | — | — |
| `servicos` | **Consertar** | Cai com ~220 comandas em 90 dias (B-00b); formulário de 11 campos, 8 vão para "Mais opções" (F, "1º serviço") | 6, 16 | P (interface) |
| `servicos/[id]/ficha` | Polir | "Registrar compra" com 15 px (A-19): botão próprio | 10 | P |
| `taxas` | Manter | — | — | — |

### 4.2 Clientes · subtelas

| Tela | Veredito | O que muda | Esforço |
| --- | --- | --- | --- |
| `clientes/nova` | Ajustar | Volta para a ficha (já faz); `push` + `refresh` duplicado (C-32); "{Cliente} novo" com gênero (D-27) | P |
| `clientes/importar` | **Consertar** | Telefone ruim descarta a pessoa (importar sem o telefone e avisar); data americana aceita errada; serviço do Motor pré-escolhido gera "97% atrasados" (F-09); prévia mostra "com X dias de ritmo" antes de importar | M |
| `clientes/ja-atendo` | Manter | "Pôr {n} no Motor" → "Pôr {n} na lista de quem volta" (D-49) | P |
| `clientes/exportar` | Manter | — | — |
| `clientes/vindo-de-outro-sistema` | Ajustar | Só alcançável pelo onboarding (C-44): link em Clientes vazio; "Me manda que eu faço" sem botão sem env (F-25) | P |
| `clientes/[id]/estrutura` | Advocacia | Ver 4.5 | — |

### 4.3 Vendas e relatórios

| Tela | Veredito | O que muda | Esforço |
| --- | --- | --- | --- |
| `campanhas/nova` | Ajustar | Toast sem `aria-live`; voltar pela origem; texto honesto "uma pessoa por toque" (D-01) | P |
| `orcamentos/novo` | Ajustar | Total mostrado é a prévia local, não o do servidor; link de WhatsApp à mão (C-28); checar plano | P |
| `comissao` | Ajustar | Dono vê "chega aqui em breve" (C-42, D-39): trocar rótulo ou mostrar o próprio extrato | P |
| `estoque` | Ajustar | "do plano Avançado" (D-02); "100% de margem" com custo 0 (C, tabela de dinheiro); PR #149 mexe nesta tela (venda de balcão): esperar | P |
| `experimentos` | Manter | Sem voltar para o Mês no PWA (A, item 11): voltar explícito | P |
| `series` | Ajustar | Título "Horários que se repetem" (D-20); toast sem `aria-live` | P |
| `comanda/agendamento/[id]` | Ajustar | Link direto para a comanda quando existe (B-11) | P |

### 4.4 Públicas por token e institucionais

| Tela | Veredito | O que muda | Esforço |
| --- | --- | --- | --- |
| `/avaliar/[token]` | Ajustar | Erro sem saída (0 interativos, A-10): botão para a página do negócio; ler no servidor (2,3 s até o útil, F-23); "Como foi seu Barba?" (D-06); "Ela agenda" (D-07) | M |
| `/lista-espera/[token]` | Ajustar | Reabrir mostra erro a quem já garantiu (F-08): "Você garantiu: quinta, 14h"; sucesso com dia e hora | P |
| `/orcamento/[token]` | Ajustar | Erro sem saída (A-10); "já foi avisado" sem garantia (D-08); ler no servidor (3,4 s, F-23) | M |
| `/[slug]/orcamento` | [NÃO VERIFICADO] | Só existe com serviço "sob orçamento"; nenhum catálogo do seed tem (F, tabela de públicas) | — |
| `/links`, `/calculadora`, `/precos` | Polir | `aria-label` no logo (A-17, F-17); "Ticket médio" na calculadora (D-16); `og:image` (F-14) | P |
| `/privacidade`, `/termos` | Revisão jurídica | Links inline de 17 px (A-19); "salão" fixo (D-29); contato que depende de env (F-25) | P (fora de jurídico) |
| Landing `/` | Manter | Falta prova de produto na 1ª dobra (F, `docs/38` peça 2): fora desta fase, decisão de marketing | — |
| 404 de slug | Ajustar | "Voltar ao início" leva a cliente do negócio para a landing do CICLO (F-24): texto para quem procurava um negócio | P |

### 4.5 Entrada, onboarding e infraestrutura

| Tela | Veredito | O que muda | Esforço |
| --- | --- | --- | --- |
| `/cadastro` | **Consertar** | "Quase lá" sem conta criada com senha de 8–9 (F-03, S1); "Leva menos de um minuto" sem fonte (D-38) | P |
| `/entrar` | Ajustar | `push` + `refresh` (B-17): só performance | P |
| `/recuperar-senha`, `/nova-senha` | **Consertar** | Link falha em outro navegador (F-05); senha curta → "Algo deu errado do nosso lado" (F-06) | M |
| `/verificar` | Polir | Aba "Confirme seu e-mail" numa tela de código (D-22) | P |
| `/onboarding` | Ajustar | Pedir WhatsApp do negócio (F-04) | P |
| `/onboarding/perfil` | Ajustar | "Pular" com 16–18 px (A-11); respostas não mudam o 1º dia (F-11) | P–M |
| `error.tsx`, `admin/error.tsx` | Ajustar | Boundary do admin diz "Nada do que você salvou foi perdido" quando a folga digitada **foi** perdida (visto nesta fase no C-05): o texto não pode afirmar o que não sabe | P |
| `not-found` no `/admin` | Ajustar | Soft 404 com HTTP 200, sem a barra do painel, "Voltar ao início" vai para `/` (A-18): `not-found.tsx` dentro de `/admin` | P |
| Advocacia (7 rotas) | Fora desta fase | Sem login de demonstração (A, incertezas); `ADVOCACIA_ABERTA` desligada (D) | — |
| `/dev/ui` | Manter | 404 em produção (medido) | — |

---

## 5 · Protótipos

Todos em `docs/98-aprimoramento/prototipos/`, HTML estático **sem dependência** (sem fonte externa, sem script de CDN), com dados fictícios. Cada um tem, no topo, três seletores: **aparelho** (celular 390 · celular 360 · computador 1280), **tema** (claro · escuro) e **estado**. As cores são os tokens de `src/app/globals.css` (claro e escuro).

| Arquivo | Telas | Estados | Demonstra |
| --- | --- | --- | --- |
| `prototipos/index.html` | índice | — | links e régua de medida |
| `prototipos/hoje.html` | Hoje | normal · carregando · vazio · erro de bloco · sem conexão · dia longo (14 horários) | I-01, I-02, I-04, I-05; agenda do dia no topo |
| `prototipos/agendar-painel.html` | Agenda/novo + Agenda (computador) | normal · carregando horários · dia sem horário · conflito 409 com alternativas · enviando · sucesso (volta ao dia) · sem conexão (fila) | I-03, I-05, I-08; grade de horários livres |
| `prototipos/recuperar.html` | Recuperar | normal (fila) · lista longa · filtro aberto · vazio sem clientes · vazio "Motor não rodou" · erro no filtro · sem conexão | fila no topo, 1 trilho, sheet "Filtrar", computador com mensagem ao lado |
| `prototipos/ficha-e-comanda.html` | Ficha, Clientes (computador), Comanda | ficha normal · comanda aberta com item · com desconto · enviando · fechada (desfazer) · erro de rede · busca que falhou | I-01 na ficha; comanda que nasce com o serviço; "Receber R$ X" |
| `prototipos/publico.html` | Agendar público + Confirmar | escolher · carregando · 409 com alternativas · enviando · sucesso · sem conexão · confirmar · desmarcar (2º passo) · desmarcado (desfazer) · já confirmado · token inválido | F-01 (antes × depois do resumo), F-02, A-03 |

**Como medir os protótipos pela mesma régua.** Abrir cada um a 390×844 e 1280×800, rodar a sondagem de dobra do agente A (`medidas/A-varredura.mjs`, função de "interativos na dobra" e posição y da ação principal) e o axe. A régua de aceite está em cada ficha (§2). Os protótipos não medem tempo: são HTML local.

**Medido nos protótipos nesta fase** (Playwright + Chrome do sistema; scripts `medidas/fase1-proto-capturas.mjs.txt` e `medidas/fase1-proto-axe.mjs.txt`; capturas `capturas/proto-*.png`):

| Protótipo | y da resposta da tela (celular 390) | Rolagem lateral (360, 390, 1280) | axe WCAG A/AA (claro e escuro) |
| --- | --- | --- | --- |
| Hoje | 175 (próximo horário); vazio: 129 | 0 / 0 / 0 | 0 |
| Recuperar | 199 (cartão da fila; hoje a lista começa em y≈665) | 0 / 0 / 0 | 0 |
| Confirmar | 134 (o horário, antes dos botões) | 0 / 0 / 0 | 0 |
| Agendar (painel), Ficha/Comanda, Agendar (público) | formulários: a ação fica na barra fixa, sempre visível | 0 / 0 / 0 | 0 |

**O que a medição dos protótipos corrigiu na proposta** (registrado para a Fase 8):
1. O assistente "acima da `ActionBar`" ainda cobria a linha de lista que estivesse embaixo dele (captura da 1ª versão do Recuperar). Virou botão do topo no celular (I-01 revisto).
2. A 1ª versão da comanda tinha 48 px de rolagem lateral a 390 (dois campos lado a lado sem `min-width: 0`), e a ficha 22 px a 360 (abas). Corrigido e medido de novo: 0.
3. O axe acusou `--ok` (#2a8148) sobre `--surface-2` (#f1eee9) com **4,18:1**, abaixo de 4,5. É a mesma combinação que o agente A achou em `config/automacoes` (`automacoes.tsx:85`, `bg-ok/15 text-ok`; A-17). Regra para a implementação: selo de estado com texto semântico fica sobre `--surface`, nunca sobre `--surface-2`.
4. No 409 do painel, o aviso nascia abaixo da dobra no celular. A proposta passa a rolar até ele e pôr o foco nele.

Contagem de "interativos na tela" do script inclui a casca (barra de 5 itens, menu e assistente) e não é comparável 1:1 com a do agente A; a régua comparável é a posição y da resposta.

---

## 6 · Ordem sugerida e dependências

1. **Junto com a Onda U** (porque são a mesma linha de código do S0/S1): Agendar público (F-01, F-02, C-04), Comanda que nasce com o item (C-01, C-13), folga que não derruba (C-05), hora no fuso certo (C-07).
2. **Transversais baratas**: I-01, I-03, I-06, I-07, I-08.
3. **Hoje** e **Agenda/novo** (as duas de maior frequência; dependem de C-07 e de A-05).
4. **Ficha**, **Clientes**, **Configurações**, **Campanhas**, **Mês**.
5. **Recuperar**, depois do PR #149 entrar.
6. **Confirmar** (pode esperar: hoje não tem tráfego, porque o lembrete está desligado).
7. **I-02** (cor única), depois da decisão do nome do botão central (D-17).
8. **I-05** (computador em 2 colunas), por último.

Dependências com outras fases: a copy de cada tela redesenhada entra no **mesmo ticket** (Fase 5 lista as frases); números (Hoje, Caixa, Ficha, Mês) dependem da fonte única (Fase 2, C-26); retorno de toque (I-03) é medido na Fase 4.

## 7 · O que **não** fazer agora

- **Tema escuro nas páginas públicas.** Elas usam a cor do negócio e cravam claro de propósito.
- **Animação de transição entre telas** (`docs/11` E3, "continua"): sem custo medido, não entra (D5). Primeiro o retorno de toque (I-03), que custa quase nada.
- **Virtualizar a lista de clientes** antes de medir com volume real: a paginação por cursor já existe (`clientes/lista.tsx`); a lentidão de F-21 (6,6 s com 295) precisa de perfil antes de escolher o conserto (Fase 4).
- **Refazer o Recuperar por cima do PR #149** ou mexer na fila do `docs/95`: esperar o merge.
- **Trocar o nome do botão central** sem a decisão do Eduardo (D-17); a guarda `tests/unit/core/pacotes.test.ts` fixa o literal.
- **Prova de produto na landing** (`docs/38` peça 2): é decisão de marketing, fora do escopo de interface do painel.

## 8 · Gate G1

- Cada uma das 15 telas tem antes × depois (§2) e checklist de 17 itens (§3). As outras 55 estão agrupadas com veredito e mudança (§4).
- As 10 mais usadas: 9 com protótipo, Caixa com captura anotada (§1, §2.5).
- **Ressalva:** densidade com o dia cheio (Comanda com vários itens, Caixa, Mês, Recuperar com lista) segue [NÃO VERIFICADO] até o seed do E-07. O protótipo usa dado fictício plausível, não medido.

**G1 fechado com ressalva.**

---

## Correções após a revisão adversarial (prevalecem)

Fonte: `09-revisao-adversarial.md`. Onde esta seção contradiz o que está acima, **vale esta seção**.

1. **Agendar público, sucesso (§2.14, R-22).** Sai "Quem atende confirma pelo telefone que você deixou": é promessa em nome do negócio que o CICLO não garante. Texto: "Pedido enviado para {negócio}: {dia}, às {hora}." + "Guarde este horário. Se precisar mudar, fale com {negócio}: {botão}" (botão só se houver contato). "Adicionar à agenda do celular" fica fora do ticket até ter custo medido.
2. **Agendar público, aceite do S0 (§2.14, R-05).** "0 de 20" conta divergências entre o **dia tocado** e o horário gravado, e entre o dia selecionado e o `data-dia` de cada chip mostrado. Não basta conferir o resumo contra o banco.
3. **Confirmar (§2.15, R-16, R-17).** Sai o "Desfazer" de 10 s depois de desmarcar: exigiria um endpoint público novo de escrita por token. Fica o 2º passo com a consequência. A tela vai para depois da APR-617, porque hoje não recebe tráfego.
4. **Hoje (§2.1, R-21).** O que sai da 1ª tela (2 cartões, "Ver meu site") segue a ≤ 1 toque. O cartão que fica é escolhido por regra escrita e testada (maior valor), e não pela ordem do código.
5. **Ficha (§2.7, R-21).** Os 3 números que saem do Resumo ficam a 1 toque ("Ver mais números").
6. **Recuperar (§2.8, R-27).** Além do PR #149, esperar a branch `feat/fila-e4-biblioteca` (fila do `docs/95`, em curso na árvore principal), que mexe em `recuperar/fila.tsx`. O aceite ganha "toques até Chamar a 1ª pessoa ≤ 2".
7. **Comanda (§2.4, R-24).** O conserto do toque engolido (C-13: o `close` leva desconto e gorjeta; sem `onBlur` que grava) sai **antes** e separado do layout novo (112a × 112b).
8. **Clientes (§2.6, R-27).** "Valor em R$ por linha só para `report:read`" depende da decisão nova sobre a recepção (`09` §5 item 3).
9. **I-03 (R-21).** O retorno < 100 ms não pode ser obtido deixando o conteúdo velho na tela por mais tempo: o tempo até o conteúdo novo não piora. A sonda tem 25 ms de resolução (meta ⇒ mediana ≤ 75 ms).
