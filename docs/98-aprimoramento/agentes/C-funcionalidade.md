# Agente C · Funcionalidade (Fase 0 · subfases 0.1 e 0.6)

> Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md` (A3, A5, A8, A9, B1–B3, Fase 0, checklist da Fase 2).
> Worktree `ciclo-aprimoramento`, branch `aprimoramento/plano-2026-10-13`, base `origin/main` `33058dd0`. Data: 13/10/2026.
> Escrita só nesta pasta. Nenhum código, migration ou configuração foi alterado. Nada foi commitado. Produção não foi tocada.

**Ambiente (A2).** Banco: Supabase **local**. Host: `127.0.0.1:54321`, conferido no `.env.local` pela URL, sem imprimir chave. Não é produção. Unit tests rodaram sem banco. Integração e RLS rodaram contra o banco local, que subiu durante o trabalho. Máquina em `America/Sao_Paulo` (offset 180, FATO `node -e`). Navegador: **não usado** por este agente. Tudo o que depende de ver a tela está marcado [NÃO VERIFICADO] ou [HIPÓTESE] com "como validar".

**Método.** Leitura ponta a ponta das 15 tarefas-régua de B3: página → componente → `/api/v1` → `src/server` → `src/core` → banco. Também rodei `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (três vezes, em três fusos), `pnpm test:integration` e `pnpm test:rls`.

Quatro auditorias paralelas, todas só leitura e todas com retorno conferido por mim:
- crons e migrations;
- números de dinheiro;
- offline e tempo;
- rotas órfãs.

Reli o código de **todo** S0/S1 antes de aceitar. Ver a coluna "conferido" e a seção EVIDÊNCIAS.

---

## Resumo em 10 linhas

1. A base técnica está verde onde não depende de banco: typecheck, lint e **3.757 testes unitários em 389 arquivos** passam. Passam também com `TZ=UTC` e `TZ=Asia/Tokyo`.
2. Banco local, rodada paralela: integração com 5 de 69 arquivos vermelhos e RLS com 2 de 11. Em série, 6 desses 7 passam, porque o vermelho era carga. O único vermelho real é um **teste-bomba de calendário** (`HOJE = '2026-10-08'` fixo), que reprova todo dia desde 09/10 e deixa a CI vermelha (C-36). Detalhe na seção "saída do verify".
3. **A comanda de um atendimento nasce vazia.** Ela oferece o 1º serviço do catálogo, não o agendado, e cobra o preço de **hoje**, não o combinado (C-01, S0 condicional).
4. **Pacote não entra no caixa.** A tabela `payments` não tem nenhum leitor nem escritor em `src/`. "O Motor trouxe" infla quando o pacote acaba (C-02, C-03, S1).
5. **O agendamento público não tem `Idempotency-Key`.** Se a resposta se perde, a nova tentativa diz "esse horário acabou de ser reservado" para o horário que a própria cliente marcou, e ela marca outro (C-04, S1).
6. **"Bloquear um dia" derruba a tela inteira quando a rede pisca.** A guarda `rede-nao-derruba-tela` não vê o arquivo, porque só varre `src/app` (C-05, S1, guarda cega de raiz).
7. **O plano pago nunca cai para o Grátis.** O job `expirar-graca` não tem gatilho nenhum, e a tela promete a queda (C-06, S1 condicional ao Mercado Pago ligado).
8. **Hora errada no painel.** Hoje e Agenda formatam hora sem o fuso do salão em componente que renderiza no servidor (UTC na Vercel). Agendar, remarcar e folga convertem pelo fuso do **aparelho** (C-07 S1, C-08 S2).
9. **Promessas sem caminho.**
   - O convite de equipe gera link que dá **404** (C-37).
   - "Pacote vendido · use na comanda": a comanda não sabe usar pacote nem crédito (C-38).
   - O expediente por profissional não tem entrada (C-39).
   - A fila offline só sai no evento `online`, nunca ao abrir o app (C-45). Todos S1.
10. **Telas e vigias que mentem por omissão.**
    - Lista de clientes em ordem aleatória (UUID), e busca que mostra "nenhum cliente" quando o servidor falha.
    - Na Hoje, o sheet fica no estado otimista quando a ação falha.
    - Falha parcial do Motor bate heartbeat.
    - A guarda de update isenta update por identidade, que é onde mora a corrida da comanda.

---

## ACHADOS

Legenda:
- **Conf.** = conferido por mim relendo o código (✔), ou só aceito da auditoria paralela (·).
- **Origem:** C = este agente; Cr = auditoria de crons/migrations; $ = dinheiro; Of = offline/tempo; Ro = rotas órfãs.
- Severidade conforme A8.
- "Reprodução" está em EVIDÊNCIAS quando não cabe na linha.

### S0 / S1

| ID | Sev | Fluxo (B3) | Problema | Evidência | Correção | Teste que pega | Conf. |
|---|---|---|---|---|---|---|---|
| C-01 | **S0 condicional** (cobra errado se o preço mudou entre marcar e atender) | 5 Fechar comanda | Concluir abre uma comanda **vazia**. Na comanda, o serviço padrão é `servicos[0]` do catálogo, não o do agendamento. O preço do item é o de catálogo **atual**, mas `appointments.price_cents` foi congelado na criação ("o combinado não pode mudar"). A página da comanda nem carrega o agendamento. | FATO: `agendamentos.ts:744-751` (insert sem item); `comanda/[id]/comanda.tsx:63` (`servicos[0]`); `comanda.tsx:91-101` (não envia `unitPriceCents`); `services/comanda.ts:119` (`entrada.unitPriceCents ?? servico.price_cents`); `agendamentos.ts:367` (preço congelado). Origem C+$ | Ao concluir, criar a comanda **já com** o item do agendamento (`service_id`, `appointment.price_cents`). Se ficar na tela, pré-selecionar o serviço do agendamento. | Integração: agenda a R$45 → sobe o serviço para R$50 → conclui → a comanda tem 1 item de R$45. Mutação: voltar ao `servico.price_cents` e ver reprovar. | ✔ |
| C-02 | **S1** | 5, 6 (caixa/mês) | Pacote não entra em "Entrou". A venda grava só `packages.paid_cents`. A sessão grava só `package_uses`. `payments` não é lida nem escrita em `src/`. Se a equipe fechar comanda em cada sessão, entra o preço cheio (4×R$100 contra R$320 pagos) e ainda pode haver taxa. A regra da casa "dinheiro em `payments`, receita em `ticket_items`" não está implementada. | FATO: grep `from('payments')` em `src/` = 0; `pacotes.ts:36-51,108-131`; `taxa-de-pagamento.ts:13`. Origem $ | Registrar a venda em `payments` (`kind=package`). Na sessão, item com `paid_cents/total_sessions`, forma `package`, taxa 0. | Integração: pacote 4×R$320 → soma das 4 comandas = R$320, taxa 0. | ✔ (grep) |
| C-03 | **S1** | 1 Hoje, 7 Recuperar | "O Motor de Ciclo trouxe" decide pelo saldo de **hoje** se a visita foi paga por pacote ou clube. Quando a última sessão é consumida, visitas antigas passam a valer preço cheio. | FATO: `atribuicao.ts:29-46` (saldo atual), `:173-178`. Origem $ | Excluir visita com `package_uses.appointment_id`. Para o clube, usar a assinatura vigente na data da visita. | Integração: atribuir → consumir a última sessão → o total não muda. | ✔ |
| C-04 | **S1** | 13 Cliente agenda sozinho | `POST /api/v1/public/[slug]/book` não usa `comIdempotencia` e o cliente não manda chave. A rede cai depois do commit → o `catch` diz "se o horário já tiver sido marcado, ele **aparece** ao escolher o dia". Na verdade ele **some** da lista. A nova tentativa recebe `SLOT_TAKEN`: "Esse horário acabou de ser reservado. Escolha outro." A cliente escolhe outro e fica com **dois** agendamentos, um que ela desconhece (vira falta). | FATO: `agendar.tsx:607-654` (sem header `idempotency-key`, textos citados); `book/route.ts` sem `comIdempotencia` (grep); `public-booking.ts:576-670` | Chave gerada **uma vez por confirmação**, guardada no estado e reenviada na nova tentativa. A rota usa `comIdempotencia` por tenant. Em `SLOT_TAKEN`: se o agendamento daquele horário tem o mesmo `phone_hash`, devolver sucesso. Corrigir o texto do `catch`. | Integração: mesma chave 2× → 1 agendamento e a mesma resposta. Integração: 2º POST sem chave com o mesmo telefone e horário → 200 com o mesmo `appointmentId`. Ver reprovar retirando a checagem. | ✔ |
| C-05 | **S1** | 12 Bloquear um dia | `criarFolga` faz `await fetch` **sem `try`** dentro de `useTransition`. Uma piscada de rede relança para o error boundary e a tela de horários some com o que foi digitado (armadilha nº 1 do `CLAUDE.md`). A guarda `rede-nao-derruba-tela` passa verde porque só varre `src/app`, e o arquivo está em `src/components/config`. O mesmo detector, rodado por mim sobre `src/components`, acusa exatamente este arquivo. | FATO: `components/config/editor-expediente.tsx:134-148`; guarda `tests/unit/design/rede-nao-derruba-tela.test.ts:80` (`telas('src/app')`); saída do detector em EVIDÊNCIAS | `try/catch` com toast "Não consegui falar com o servidor…", sem limpar o formulário. Ampliar a guarda para `src/components` e `src/lib`, com piso de arquivos varridos em cada raiz. | A guarda ampliada **reprova hoje** neste arquivo: é o controle positivo pronto. | ✔ |
| C-06 | **S1 condicional** (Mercado Pago ligado) | Cobrança | `GET /api/cron/expirar-graca` não tem gatilho: não está no `schedule`, nem nas `options` do `workflow_dispatch`, nem no cron-job.org. O comentário diz "só workflow_dispatch". O gating lê `tenants.plan`, e só esse job rebaixa. A tela diz "Depois disso, cai para o Grátis". Inadimplente fica pago para sempre. No laço, um `throw` aborta os tenants seguintes. | FATO: `.github/workflows/cron.yml:65-72`; `api/cron/expirar-graca/route.ts:8`; `admin/config/meu-plano/page.tsx:186`; `assinatura-mp.ts:254-285`. Origem Cr | Agendar quando o MP ligar, com heartbeat `expirar_graca`. Defesa que não depende de cron: o gating lê `graca_ate`/`acesso_ate` na hora. `try` por tenant. | Guarda: toda rota de `ROTAS_DE_CRON` fora de `ROTAS_AGENDADAS` está nas `options` do dispatch **ou** numa lista "sem gatilho, com motivo". Integração: `paused` + `graca_ate` no passado → `contextoDePlano` = `gratis`. | ✔ |
| C-07 | **S1** [HIPÓTESE do sintoma visível; FATO do código] | 1 Hoje, Agenda | `horaLocal(iso)` é chamada **sem fuso** em `hoje.tsx` e `agenda.tsx`, que são `'use client'` e renderizam primeiro no servidor. Na Vercel o servidor está em UTC, então o HTML chega com a hora **+3h** (10:00 vira 13:00) até hidratar. O "Forma do dia" e o "A seguir" mostram a hora errada no 4G lento. Há ainda erro de hidratação em todo carregamento. A página já tem `ctx.tenant.timezone` e não passa. | FATO: `lib/formato.ts:39-40` (`timeZone: timezone` opcional); `hoje.tsx:51,101,415,479,516`; `agenda.tsx:203`; `hoje/page.tsx:63` (tem o fuso). `vercel.json` sem `TZ` | Passar `timezone` do servidor para `Hoje`/`Agenda` e para `horaLocal`. Tornar `timezone` obrigatório em `horaLocal`. | Guarda: `horaLocal(` com 1 argumento reprova (contar argumentos até o `)` real). Medição: `TZ=UTC pnpm build && pnpm start`, Playwright com `timezoneId: 'America/Sao_Paulo'`, JS desligado → a hora no HTML bate com a da agenda. | ✔ |
| C-08 | **S2** (impacto de S1, gatilho raro: aparelho num fuso diferente do salão) | 2 Agendar, 3 Remarcar, 12 Folga | O `datetime-local` é convertido com `new Date(valor).toISOString()`, no fuso do **aparelho**, não do salão. Celular em outro fuso (viagem, recepção com PC mal configurado, Android antigo com regra de horário de verão) grava a hora errada. O valor padrão da folga é calculado no SSR em UTC (+3h) e não é corrigido na hidratação. As datas das folgas aparecem sem fuso. O próprio comentário admite: "Por ora o horário do navegador é tratado como o do tenant". | FATO: `agenda/novo/formulario.tsx:29-31,275`; `agenda/detalhe.tsx:48-52,144`; `editor-expediente.tsx:15-29,138,263,295,305` | Mandar data e hora **local** mais o fuso do tenant e converter no servidor (Temporal), como o agendamento público já faz. | Unitário de `paraInstante(local, tz)`; Playwright com `timezoneId: 'America/Manaus'` para um salão de São Paulo → grava a hora do salão. | ✔ |

### S2

| ID | Sev | Fluxo | Problema | Evidência | Correção | Teste | Conf. |
|---|---|---|---|---|---|---|---|
| C-09 | S2 | 4 Chegou/faltou (Hoje) | O otimista da Hoje é `setSelecionado` dentro da transição, não `useOptimistic`. Se a ação falha, o sheet **fica** no estado novo (mostra "Concluir" para quem não chegou), junto com a mensagem de erro. Na Agenda o mesmo componente usa `useOptimistic` e volta sozinho. | FATO: `hoje.tsx:547` contra `agenda.tsx:75,226`; `detalhe.tsx:87-107` | Usar `useOptimistic` na Hoje também, ou desfazer no `catch` via callback. | Teste de componente (jsdom não existe; ver RECOMENDAÇÕES) ou Playwright com rota bloqueada. | ✔ |
| C-10 | S2 | 3 Remarcar | O 409 `SLOT_TAKEN` traz `details.alternatives` (`agendamentos.ts:620-630`), mas o detalhe mostra só o texto. A pessoa adivinha outro horário. Criar mostra as alternativas. | FATO: `detalhe.tsx:146-151` contra `novo/formulario.tsx:190-193,446-453` | Reaproveitar os chips de alternativa. | Integração de rota já devolve. Falta UI: Playwright. | ✔ |
| C-11 | S2 | 2 Agendar | Depois de criar, vai para `/admin/agenda` (hoje). Agendamento para outro dia não aparece na tela de destino. A pessoa não vê o que criou. | FATO: `novo/formulario.tsx:186`; `agenda/page.tsx:38` aceita `?date=` | `router.push('/admin/agenda?date=<dia do agendamento no fuso>')`. | Playwright. | ✔ |
| C-12 | S2 | 2 Agendar (rede) | A chave de idempotência nasce a cada toque (`crypto.randomUUID()` dentro de `enviar`). Se a resposta se perde e a pessoa toca de novo, a constraint devolve `SLOT_TAKEN` para o **próprio** agendamento: "Esse horário acabou de ser reservado", com alternativas. Mesmo desenho de C-04 no painel. Vale para comanda, detalhe e cliente novo. | FATO: `novo/formulario.tsx:166`; `comanda.tsx:28`; `detalhe.tsx:42`; `clientes/nova/formulario.tsx:51` | Chave por **intenção** (gerada ao abrir o formulário ou ao montar o corpo, reaproveitada na nova tentativa). | Integração: 2 POSTs com a mesma chave → mesma resposta (já existe em `idempotency.test.ts`). Falta a guarda de UI: "chave não nasce dentro do handler de envio". | ✔ |
| C-13 | S2 | 5 Comanda | O desconto e a gorjeta salvam no `onBlur`. Tocar em "Fechar comanda" com o campo focado faz o blur iniciar o PATCH. `pendente` vira `true` e o botão "Fechar" fica `disabled` com spinner **antes** do clique, que é engolido. O spinner some e a comanda continua aberta. [HIPÓTESE do toque engolido; precisa medir no celular.] | FATO: `comanda.tsx:318,331,446-453`; `button.tsx` + `core/ui/botao-travado.ts:18` (`carregando` → `disabled` nativo) | Salvar o desconto no próprio "Fechar" (o corpo do close leva desconto e gorjeta), ou um `pendente` separado por ação. | Playwright: digitar desconto → tocar "Fechar" uma vez → comanda fechada com o desconto. | ✔ |
| C-14 | S2 | 5 Comanda (concorrência) | `atualizarDescontoEGorjeta`, `adicionarItemComanda` e `removerItemComanda` checam `status='open'` e depois gravam com WHERE **só de identidade**. `recalcularSubtotal` regrava `total_cents` sem guarda. Com dois aparelhos (recepção fecha, profissional lança item), o item ou desconto entra em comanda **fechada** e o `total_cents` muda depois de congelados taxa, comissão e "Sobrou". O caixa diverge. A guarda `update-com-guarda-confere-linhas` isenta update por identidade, então não pega. [INFERÊNCIA: precisa de 2 aparelhos.] | FATO: `services/comanda.ts:212-240` (`buscarTicketAberto` depois `update ... .eq('id')`); `:221-227` | `.eq('status','open')` no próprio UPDATE e INSERT por RPC que confere o estado, ou trigger que recusa `ticket_items` em comanda não aberta. | Integração: fechar, depois `adicionarItemComanda` → 409 e `total_cents` inalterado. | ✔ |
| C-15 | S2 | 5 Comanda (falha parcial) | `fecharComanda` não é atômico. Ordem: grava comissão item a item → fecha → baixa estoque (`Promise.all`) → auditoria. Se a baixa ou a auditoria falha, a rota devolve erro, a reserva de idempotência é solta e a comanda **já está fechada**. A tela diz que falhou. A nova tentativa diz "Essa comanda já foi fechada". O estoque fica parcial, sem reconciliação. | FATO: `services/comanda.ts:285-387`; `estoque.ts:51-61`; `http/idempotency.ts:91-113`; `tickets/[id]/close/route.ts` | RPC única em transação (fechar, baixar, auditar), ou gravar resposta antes da baixa e baixar com reprocessamento idempotente por `source_id`. | Integração: mock de `registrarMovimento` lançando no 2º produto → ou tudo volta, ou a comanda fica marcada "baixa pendente" e reprocessa. | ✔ |
| C-16 | S2 | 5 Receber | Não existe pagamento parcial, dividido em duas formas, nem troco. A comanda aceita **uma** forma. B3-5 pede "Pix, cartão, dinheiro, parcial". O sinal (`deposit_cents`) não é abatido na comanda nem no caixa (achado de $). | FATO: `comanda.tsx:71,425-442`; `EsquemaFechamento` (1 forma) | Decisão de produto (Eduardo). Mínimo: mostrar "sinal já pago R$X" e abater como forma, não como desconto. | — | ✔ |
| C-17 | S2 | 11 Venda de revenda | No `main` não há como abrir comanda sem agendamento. O único `insert` em `tickets` é `concluirAgendamento`. Vender um produto no balcão exige inventar um atendimento. A memória cita o PR #149 ("venda de balcão") **aberto**. [NÃO VERIFICADO se o PR resolve.] | FATO: grep `from('tickets')…insert` → só `agendamentos.ts:744`; não existe `POST /api/v1/tickets` | Ver PR #149 antes de propor; não duplicar. | — | ✔ |
| C-18 | S2 | 9 Achar a ficha | A lista de clientes é ordenada por `id` desc, e o `id` é `gen_random_uuid()`: a ordem fica **aleatória** (nem alfabética, nem recente). Rolar para procurar alguém é impossível. | FATO: `services/clientes.ts:147`; `0001_initial.sql:224`; `lista.tsx` sem `sort` | Ordem por `name_busca` (cursor composto), ou por última visita. | Integração: 3 clientes A, B, C criados em ordem aleatória → lista em ordem alfabética. | ✔ |
| C-19 | S2 | 9 Busca | `buscar()` não confere `r.ok`. Um 401/500 vira `json.data` indefinido → `setClientes([])` e a tela mostra "nenhum cliente" **como resultado**. Respostas fora de ordem (digitar rápido) podem deixar o resultado de um termo antigo. Telefone parcial (menos de 8 dígitos, "4321") cai na busca por nome e não acha. | FATO: `clientes/lista.tsx:74-90`; `services/clientes.ts:119-141` | Conferir `r.ok` e mostrar `falhou`. Descartar resposta de termo velho (contador ou `AbortController`). Buscar também pelos últimos 4 dígitos (coluna gerada). | Teste de componente ou Playwright com rota 500. | ✔ |
| C-20 | S2 | 7 Recuperar | `trocarFiltro` não tem `catch`. Rede caída deixa a lista do filtro **anterior** sob o rótulo novo (o mesmo defeito que o `CLAUDE.md` cita), e vira rejeição não tratada. Sem controle de ordem entre respostas. | FATO: `recuperar/recuperar.tsx:95-113` | `catch` com toast e voltar o `filtro`; descartar resposta antiga. | Playwright offline. | ✔ |
| C-21 | S2 | 14 Confirmar pelo link | A página de confirmação não diz **qual** horário: não mostra dia, hora, serviço nem salão. "Preciso desmarcar" cancela num toque, sem confirmação nem desfazer. Token inválido só aparece depois do toque. | FATO: `(public)/confirmar/[token]/page.tsx` (só passa `token`); `confirmar.tsx:59-72,81-104` | Carregar o agendamento pelo token no servidor e mostrar o resumo. Desmarcar com segundo passo. | Integração da rota de leitura; Playwright. | ✔ |
| C-22 | S2 | 12 Expediente | Cada `onChange` de `<input type="time">` dispara um PUT que **substitui** a semana inteira. Digitando no computador saem vários PUTs concorrentes, e o último a chegar ganha (pode ser um valor intermediário). | FATO: `editor-expediente.tsx:69-114,220,230` | Salvar no `onBlur` ou com botão, e serializar (descartar resposta antiga). | Playwright digitando "10:00". | ✔ |
| C-23 | S2 | Motores | Falha parcial fica verde: `recompute-cycles` e `segments` batem heartbeat com `processados > 0` mesmo com N−1 tenants falhando. | FATO `recompute-cycles/route.ts:94-98`; `segments/route.ts:64-70`. Origem Cr | Heartbeat com contagem de falhas; o health reprova falha repetida. | Unitário com 2 tenants, 1 lançando. | · |
| C-24 | S2 | LGPD/motor | `segments` lê `clients(id,name)` e faz **upsert com `name`**. Uma eliminação LGPD entre a leitura e a escrita devolve o nome real ("Cliente eliminada" volta a ser o nome). | FATO `segmentos.ts:49-69`; `lgpd.ts:508,522`. Origem Cr | UPDATE sem tocar `name`, filtrado por `anonymized_at is null`. | Integração intercalando `eliminarCliente`. | · |
| C-25 | S2 | Dinheiro | "Sobrou … e do aluguel" desconta só a fração das horas **agendadas**. A hora parada nunca sai: 50% de ocupação deixa metade do aluguel fora. A margem por serviço não desconta aluguel nenhum. Os dois são margem de contribuição com nome de lucro. | FATO `custo-fixo.ts:87-90`; `margem-do-servico.ts:137`; texto em `caixa.tsx:152`. Origem $ | No mês, linha "hora parada" (`custo fixo mensal − Σ fixed_cost_cents`). | Unitário `sobraDoMes`. | ✔ (`custo-fixo.ts`) |
| C-26 | S2 | Dinheiro | "Entrou" tem dois sentidos: na comanda é sem gorjeta (`sobra-explicada.ts:111`); no caixa e no mês, com gorjeta (`caixa.ts:87`). "Dá para recuperar" (receita) contra "Parado em quem sumiu" (lucro) leva do Mês ao Recuperar com outro número. "Atendido hoje", Ficha e Motor usam preço de tabela, sem desconto. O estorno só troca status: o caixa do dia passado muda e "Atendido"/"Motor" não. | FATO, tabela completa na seção DINHEIRO. Origem $ | Glossário de números e uma função por número. | Testes de propriedade cruzando as telas (ver DINHEIRO). | · |
| C-27 | S2 | Migrations | `scripts/conferir-schema-prod.mjs` compara o banco com o código **já publicado** (constante no bundle), e por **contagem**. Linhas extras mascaram uma migration faltando no meio. "Vigilância desligada" sai como "schema OK". | FATO `conferir-schema-prod.mjs:9-11,42-44`; `core/schema/versao.ts:15-22,70-99`. Origem Cr | Comparar o **conjunto de nomes** com `supabase/migrations/` do disco; reprovar em "vigilância". | Guarda `schema-esperado-bate-com-o-disco` por nome. | · |
| C-28 | S2 | Orçamento | O link de WhatsApp do orçamento é montado à mão (`wa.me/55${dígitos}`), cópia divergente de `linkWhatsApp`. Telefone com "+55" digitado vira `55 55…`; número estrangeiro vira `55+351…`. O total "Orçamento pronto · R$X" é a prévia local, não o `total_cents` do servidor. | FATO `orcamentos/novo/formulario.tsx:62,109-111,127`; `lib/mensagens.ts:64-69` | Usar `linkWhatsApp(e164)` e o total devolvido. | Unitário de montagem do link. | ✔ |

### S3

| ID | Problema | Evidência | Correção |
|---|---|---|---|
| C-29 | Vínculo orçamento → agendamento com `.catch(() => {})`: falha invisível (`fetch` não rejeita em 4xx/5xx). | `agenda/novo/formulario.tsx:179-183` | Conferir `r.ok` e toast discreto. |
| C-30 | `remarcarAgendamento` grava sem `.eq('status', atual.status)`. A corrida com "Chegou" pode remarcar quem já chegou. | `agendamentos.ts:603-614` | Guarda de estado no UPDATE. |
| C-31 | `POST /appointments` relê `tenants.settings, timezone` em série. O fuso já vem no contexto. | `api/v1/appointments/route.ts:36` | Usar `ctx.tenant.timezone`; buscar `settings` em paralelo. (Agente B mede.) |
| C-32 | `router.push(...)` seguido de `router.refresh()` ao cadastrar cliente: duas idas. São 32 `router.refresh()` em 21 arquivos. | `clientes/nova/formulario.tsx:73-74`; grep | Agente B prioriza. |
| C-33 | Formatação de data e hora sem fuso em telas do cliente: detalhe do agendamento, ficha (`{{data}}`/`{{hora}}` das mensagens), alternativas de horário. | `detalhe.tsx:165`; `ficha.tsx:267-270`; `novo/formulario.tsx:33-36` | Formatar sempre com o fuso do tenant. |
| C-34 | 29 rotas de escrita sem `comIdempotencia` (107 com escrita, 78 com). Fora `auth/*` e as naturalmente idempotentes (confirmar/cancelar por token), restam: `public/[slug]/book` (C-04), `public/[slug]/quote-request`, `clients/import` (+preview), `tenant/payment-fees`, `fixed-cost`, `loyalty-config`, `automacoes`, `vitrine`(2), `cycles/recompute`, `onboarding`, `assistant`(2), `memberships/accept`, `tickets/[id]/items/[itemId]` (DELETE), `public/waitlist/claim`. | grep (EVIDÊNCIAS) | Classificar caso a caso. Importar duas vezes duplica cliente sem telefone. [HIPÓTESE] |
| C-36 (**S2**) | Teste-bomba de calendário: `legal-casos-estado.test.ts:21` fixa `HOJE = '2026-10-08'` e o caso nasce com `opened_on = current_date`. Reprova **todo dia desde 09/10** (rodado em série: 2 falhas determinísticas). A CI da `main` roda essa suíte (`ci.yml:253`). | `tests/integration/legal-casos-estado.test.ts:21,38-40,58-68`; `0105_legal_casos.sql:38,47` | `HOJE` = `hojeNoFuso(tz, new Date())`, ou inserir o caso com `opened_on: HOJE`. Teste vermelho por motivo conhecido mascara os outros. |
| C-35 | `cron/jobs` tem `HANDLERS = {}` e nenhum `enfileirar(` em `src/`: rota sem função. Comentários desatualizados (`registro.ts` inexistente). | `api/cron/jobs/route.ts:20,27`. Origem Cr | Remover ou documentar. |

---

## TEMPO (item 4)

**Testes e fuso.** FATO: `vitest.config.ts` **não fixa `TZ`**. Rodei a suíte unitária três vezes:

| TZ | Resultado |
|---|---|
| máquina (`America/Sao_Paulo`) | 389 arquivos verdes |
| `TZ=UTC` | 389 arquivos verdes |
| `TZ=Asia/Tokyo` | 389 arquivos verdes |

Nenhum teste unitário depende do fuso da máquina hoje (FATO medido). O risco que fica é estrutural: a CI roda em UTC e a máquina do Eduardo em UTC-3, e nada **obriga** um terceiro fuso. Recomendação: um job de CI com `TZ=Pacific/Kiritimati` (UTC+14) ou `America/Noronha`.

**Achados de tempo deste agente:** C-07 (SSR em UTC na Hoje e na Agenda), C-08 (conversão no fuso do aparelho), C-33 (formatação sem fuso).

**`billing_day` 29–31 e a seção de offline:** ver "OFFLINE E TEMPO (auditoria paralela)" abaixo.

---

## OFFLINE (item 5) e TEMPO, auditoria paralela "Of"

Os S1 foram relidos por mim (✔).

### Como a fila funciona hoje (FATO)

| Pergunta | Resposta | Evidência |
|---|---|---|
| Onde guarda | IndexedDB `ciclo-offline`, store `mutations` | `lib/offline/db.ts:16-31` |
| Chave de idempotência | Gerada **uma vez** (`mutacao.id`) e reusada em todo reenvio. O servidor prefixa com o tenant e confere o hash do corpo | `api-client.ts:48,140-146`; `http/idempotency.ts:16-84` |
| Quando reenvia | Só no evento `online`, ou num backoff (2/5/15 s) que só o caminho **online** do `apiFetch` dispara | `api-client.ts:101-121,154-162` |
| Limite de tentativas | Nenhum. 401, 403, 429 e 5xx viram "tentar de novo" para sempre. Não há prazo de validade, mas o servidor só guarda a chave por 30 dias | `core/offline/queue.ts:33-46`; `idempotency.ts:129` |
| 409 / 4xx / 5xx | **409**: card de conflito, o item fica. **400/402/404/422**: descarta com card. **5xx/429/401/403**: tenta de novo | `queue.ts:36-45`; `resolucao-de-fila.tsx` |
| Avisa | Faixa com a contagem pendente, mais cards de conflito e de descarte. Só dentro de `/admin` | `indicador-de-conexao.tsx`; `admin/layout.tsx:150,176` |
| Logout | Tenta enviar, relê a fila, conta e avisa ("N alterações… serão descartadas"), deixa escolher, e só então apaga. O bug antigo está corrigido e tem teste | `config/sair.tsx:47-93`; `tests/unit/shell/sair-da-conta.test.ts:78-126` |
| Excluir conta | Descarta a fila **sem** avisar (S3) | `excluir-conta/formulario.tsx:52-55,78` |
| Troca de usuário ou tenant | A mutação não guarda dono (C-46) | `queue.ts:8-14` |
| Deny-list do service worker | Correta: `/api`, `/admin`, `/auth` e mídia assinada nunca entram no cache. É SW escrito à mão; não existe Workbox, e o `CLAUDE.md` diz "Workbox" (texto desatualizado) | `public/sw.js:30,55-75`; `tests/unit/shell/service-worker.test.ts` |
| Quem usa a fila | **Só** `agenda/novo`, e só quando já está offline (`formulario.tsx:156`). Todas as outras escritas (cerca de 60 telas) usam `fetch` direto. Não existe Server Action (`'use server'` = 0) | grep `apiFetch(` |

### Achados de offline

| ID | Sev | Problema | Evidência | Correção | Teste | Conf. |
|---|---|---|---|---|---|---|
| C-45 | **S1** | **A fila não sai sozinha.** `drenarFilaPendente()` só é chamada no evento `online`, no backoff (que nunca roda no único chamador) e nos botões "sair" e "tentar". Abrir ou recarregar o app com fila e com rede não envia nada, mas a faixa diz "enviando quando possível". Enquanto isso, a página pública pode ocupar o horário: quando sair, vira 409, e a cliente vem para um horário que não existe [INFERÊNCIA]. | grep `drenarFilaPendente(`: `api-client.ts:110,119`, `sair.tsx:49`, `excluir-conta:54`, `resolucao-de-fila.tsx:73`. Nenhuma chamada ao montar o shell | Drenar ao montar o shell, em `visibilitychange` e depois do login. Se sobrar item, backoff exponencial com teto enquanto houver fila. | Unit `proximaTentativa(resultado, n)` em `core/offline`. Guarda exigindo a drenagem no `useEffect` do shell. DevTools: offline → criar → fechar aba → online → abrir → POST sai. | ✔ |
| C-46 | S2 | A fila não tem dono (usuário e tenant). Com a sessão vencida, a próxima pessoa que entra no aparelho envia a fila da anterior: autoria trocada no `audit_log`, ou descarte (404/422) que a dona nunca vê. | `queue.ts:8-14` | Gravar `userId` e `tenantId` na mutação e drenar só as do contexto atual | Unit `filtrarFilaDoContexto` | · |
| C-47 | S2 | No caminho offline, `await apiFetch(...)` fica **fora** do `try` da transição. Se o IndexedDB falhar (cheio, bloqueado), a tela cai no boundary. A guarda só procura `await fetch`. | `agenda/novo/formulario.tsx:156-161` | `try` em volta. A guarda passa a procurar `await apiFetch(` também | Guarda ampliada, vista reprovando | ✔ |
| C-48 | S2 | A faixa promete "Sem conexão · mudanças serão guardadas", mas só "criar agendamento" é guardado. Os cards de conflito e de descarte não dizem **qual** agendamento (os dados estão no corpo). Depois de enfileirar, o `router.push('/admin/agenda')` precisa de rede [HIPÓTESE: o navegador mostra "sem internet"]. | `indicador-de-conexao.tsx:25`; `resolucao-de-fila.tsx:32-39,70-99`; `formulario.tsx:159` | Texto verdadeiro; card com cliente e horário; ficar na tela depois de enfileirar | Unit `textoDaConexao`, `descrever()` | · |

### Achados de tempo da auditoria paralela (somados a C-07, C-08, C-33)

| ID | Sev | Problema | Evidência | Correção | Conf. |
|---|---|---|---|---|---|
| C-49 | S2 | "Você continua no plano até DD/MM" sai em UTC num Server Component. Recusa às 22:30 BRT do dia 10 mostra o dia 18; o acesso cai no dia 17 às 22:30. A linha 176 do mesmo arquivo já usa `diaDeBrasilia`. | `config/meu-plano/page.tsx:187` contra `:176` | `descreverDia(diaDeBrasilia(...))` | ✔ |
| C-50 | S2 | `legal_checklist_items.rodada_desde default current_date` é avaliado em UTC, e a criação não preenche o campo. Caso aberto entre 21h e 24h BRT tem todos os lembretes (D0/D+3/D+7/D+10) 1 dia atrasados. O mesmo padrão de C-36, aqui no produto. | `0106_legal_checklists.sql:62`; `advocacia/casos.ts:137-151` | Preencher com `hojeNoFuso` no insert; guarda "coluna `default current_date` tem escritor explícito" | ✔ |
| C-51 | S2 | Mesma classe de C-07, em datas: datas formatadas sem fuso em componentes do cliente que renderizam no servidor. | `ficha.tsx:103,267,269`; `notas.tsx:13`; `pacotes-carteira.tsx:29`; `profissionais/lista.tsx:438`; `orcamentos/lista.tsx:70`; `cofre/trilha.tsx:17`; `estoque/lista.tsx:39-45` (`diasAte`) | Provider do fuso do tenant, igual ao `VocabularioProvider` | · |
| C-52 | S3 | A view `v_daily_cash` trunca o dia em UTC. Está abandonada, mas existe, e é armadilha para quem reusar. | `0001_initial.sql:798-811` | Remover numa migration | · |

**Correto, sem achado (FATO, Of e relido em parte por mim):**
- **"Hoje" e "mês"** nas páginas usam `Temporal` no fuso do tenant. `core/tempo/dia.ts` é a fonte única.
- **`billing_day`** vai de 1 a 28 por `check` no banco (`0019:84`) e por Zod. `janelaDeCobranca` funciona em fevereiro. O teste dos dias 29–31 foi corrigido (`crm.test.ts:403-409`).
- **Recorrência mensal** é por "N-ésima semana", e o ordinal 5 significa "a última". Não há problema nos dias 29–31.
- **Somas de `86_400_000`** são só sobre `Date.UTC` de datas puras ou são durações.
- **Testes:** todo `vi.setSystemTime` usa literal com `Z`. Três testes forçam `Pacific/Kiritimati` com checagem de que o fuso foi aplicado. A suíte unitária passa em UTC, São Paulo, Tóquio e Manaus (medido por mim e por Of).
- **Limite da medição:** a hora do dia não foi variada (sem faketime). Um teste com `new Date()` solto pode falhar só entre 21h e 24h BRT.
- **[INFERÊNCIA]** Testes de integração que usam o dia UTC como "hoje" (`ciclo.test.ts:114,157,172`, `risco.test.ts:258`…) podem divergir entre 00:00 e 02:59 UTC. Risco S3.

---

## CRONS E MOTORES (item 6)

Quem dispara o quê (FATO, auditoria Cr conferida em `cron.yml` e `vercel.json`):

| Agendador | Rotas | Observação |
|---|---|---|
| Vercel Cron | nenhuma (`"crons": []`) | De propósito |
| GitHub Actions `schedule` | `recompute-cycles`, `segments`, job `vigia` (lê `/api/health`) | Atraso medido de 5 a 6,5 h (`cron.yml:32-36`); já parou 54 h por cobrança |
| cron-job.org | `recompute-cycles`, `segments` a cada 3 h | Configuração real [NÃO VERIFICADO] (conta do Eduardo) |
| pg_cron `0087` | `recompute-cycles`, `segments` de hora em hora | Inerte se faltar secret no Vault [NÃO VERIFICADO] |
| pg_cron `0090` | keep-alive `/api/health` */5 min | Ignora o 503 |
| Só manual | `stock-alerts`, `jobs`, `reminders`, `campaigns` | `reminders`/`campaigns` desligadas de propósito |
| **Sem gatilho nenhum** | `expirar-graca` (C-06), `lgpd-retention`, `legal-intimacoes` | |

Respondem 200 sem processar:
- `campaigns`, `reminders` e `legal-intimacoes` batem heartbeat **incondicional**.
- `recompute-cycles` e `segments` não batem com 0 tenants (bom), mas batem com falha parcial (C-23).

Ninguém vigia o vigia fora do GitHub. Se o Actions parar, o único leitor automático de `/api/health` para junto (Cr A-9, S2).

Latentes, que viram S1 quando ligarem:
- `campaigns` filtra janela de 3 h com cron que atrasa 5 a 6 h, e a receita do rodapé é validada em horário nominal (Cr A-4).
- A captura de intimações fica verde quando a RPC falha (Cr A-3).
- `lgpd-retention` trava a fila com 100 falhas persistentes (Cr A-7).

---

## MIGRATIONS (item 7)

FATO: há **116** arquivos em `supabase/migrations`, até a `0117_privilegio_minimo`. A `0101` não existe (pulo de número). O contrato fala em "0001–0101" e está **desatualizado**: `MIGRATIONS_ESPERADAS = 116` (`core/schema/versao.ts:22,25`).

As últimas 10 (status em produção [NÃO VERIFICADO]: não consultei produção):

| Migration | O que faz | Depende de | Tipo |
|---|---|---|---|
| 0108 | `legal_case_meetings` (caso ↔ agendamento) | 0105, `appointments` | Aditiva |
| 0109 | OAB em `professionals` + 7 tabelas de intimação e prazo + RPCs | 0104–0107 | Aditiva |
| 0110 | Gatilho: estagiário não tira pendência de rascunho (LGL01) | 0106, 0109 | Restritiva de comportamento, tabela nova |
| 0111 | RPC `legal_registrar_abertura_do_caso` | 0105, 0107 | Aditiva |
| 0112 | RPC `legal_intimacao_decidir` | 0105, 0109 | Aditiva |
| 0113 | Reescreve `legal_intimacoes_gravar` + `legal_intimacoes_falha` | 0109 | Corretiva (sem ela toda gravação falha) |
| 0114 | Gatilho: estagiário não confirma prazo | 0109 | Restritiva, tabela nova |
| 0115 | Revoga `anon` e DELETE nas 21 `legal_*` | 0104–0109 | Restritiva em tabela nova (pode ir antes) |
| 0116 | Função `legal_membros_sem_segundo_fator` | 0102, `auth.mfa_factors` | Aditiva |
| 0117 | Revoga `anon`/TRUNCATE/DELETE sem política em todo `public` | catálogo | **Restritiva → DEPOIS do deploy** |

Risco "produção atrás do código" (conferido por mim): `src/server/auth/tenant.ts:89` lê `professions(vocab, pacote)` em **todo request autenticado** e lança `INTERNAL` em erro.
- Se a `0102_pacote_advocacia` não estiver em produção junto com o código atual, o painel cai para **todos** os tenants. É **S0 condicional** [NÃO VERIFICADO].
- O runbook de 08/10 registra "103 aplicadas contra 100 esperadas … não sei quais são as 3 a mais" (`docs/runbooks/ir-pro-ar-2026-10-08.md:13-15`).
- Quem destrava: o Eduardo, com leitura autorizada de `supabase_migrations.schema_migrations` em produção, comparando por **nome**.

---

## BOTÕES MORTOS E ROTAS ÓRFÃS (item 8)

Auditoria Ro. Os três S1 foram relidos por mim (✔).

**Método.** Varri todos os literais de rota em `src/`: 354 destinos de página e 220 de API. Casei cada um com a árvore real de `page.tsx`/`route.ts`, considerando grupos `( )`, segmentos dinâmicos, redirects de `next.config.ts` e middleware. Reli cada candidato à mão.

**Inventário FATO:** 70 páginas (51 em `/admin`), 137 handlers de API e redirects 308 de `/{hoje|agenda|clientes|recuperar|comanda|caixa|config}/*` para `/admin/*`.

O contrato fala em "64 páginas e 118 rotas". A contagem está **desatualizada**: o pacote Advocacia acrescentou `casos`, `intimacoes`, `pendencias` e `clientes/[id]/estrutura`.

| ID | Sev | Problema | Evidência | Correção | Teste | Conf. |
|---|---|---|---|---|---|---|
| C-37 | **S1** | **Convite de equipe leva a 404.** O link gerado é `/convite/{token}`, mas não existe página `convite` em `src/app`. `POST /memberships/accept` não tem chamador. O toast diz "Link copiado. É só colar e mandar". Ninguém entra na equipe por convite. | `api/v1/memberships/invite/route.ts:50`; `find src/app -path '*convite*'` só acha `meu-plano/compartilhar-convite.tsx`; grep `memberships/accept` só em `core/billing/pausa.ts:75` | Criar `(public)/convite/[token]/page.tsx`: sem sessão leva para `/entrar?proximo=`; com sessão, "Aceitar" chama `POST accept` e vai para `/admin/hoje`. Tratar e-mail divergente. | Guarda: todo `` `${APP_URL}/<seg>/` `` em `src/` tem pasta `<seg>` em `src/app`. Positivo conhecido: `orcamento`, `avaliar`, `confirmar`, `lista-espera`. | ✔ |
| C-38 | **S1** | **Pacote e crédito prometem a comanda, que não os usa.** "Pacote vendido · As sessões já podem ser usadas na comanda" e "Crédito lançado · O saldo aparece na comanda dela". A comanda não tem nenhuma referência a pacote ou carteira. `POST /packages/[id]/use` e `POST /wallet/debit` não têm chamador. O cliente pagou e não há como abater: risco de **cobrar duas vezes**. Junto com C-02, o pacote existe só como saldo na ficha. | `clientes/[id]/pacotes-carteira.tsx:165,235`; grep `packages/\|wallet` em `admin/comanda` = 0 | Na comanda com cliente: "Usar 1 sessão do pacote X" e "Abater do crédito". Até lá, copy verdadeira nos toasts. | Guarda "rota de escrita `/api/v1` não pública tem chamador em `src/app|components` ou entrada com motivo" (pega também C-37, C-40, C-41). | ✔ |
| C-39 | **S1** | **Expediente e folgas por profissional sem entrada.** `/admin/config/profissionais/[id]` existe e é a única tela de horário próprio por profissional, mas nenhum link leva até ela. A lista só abre o sheet de nome, bio e cor. Sem ela não há como dar férias ou folga a um profissional (recurso do plano Equipe). | grep `profissionais/${` → só `[id]/page.tsx:23` (o próprio `Request` interno); `profissionais/lista.tsx:368` | `Link` irmão "Expediente e folgas" em cada linha, ou dentro do sheet. | Guarda "toda `page.tsx` tem referência real", com allowlist das entradas externas. Positivo: `/admin/hoje`. | ✔ |
| C-40 | S2 | Lista de espera sem porta de entrada: `entrarNaLista` só é chamado pela rota `waitlist`, que não tem chamador. `/lista-espera/[token]` e o aviso ao cancelar ficam mortos. | `api/v1/waitlist/route.ts:28` | Pôr a entrada na agenda e na página pública quando não há vaga, ou retirar. | Guarda de rota sem chamador | · |
| C-41 | S2 | Não há estorno de comanda pela interface: `POST /tickets/[id]/cancel` não tem chamador, e a tela diz "Nada mais pode mudar aqui". Fechamento errado não tem conserto, e o caixa e a comissão ficam errados. | `comanda.tsx:460`; `services/comanda.ts:394` | "Desfazer fechamento" com confirmação, só para `closed`. | Guarda de rota sem chamador + componente | ✔ |
| C-42 | S2 | "Minha comissão" aparece para o dono e abre "…chega aqui em breve". Quem atende sozinho nunca vê o próprio extrato. | `config/page.tsx:57`; `comissao/page.tsx:54-66` | Usar `my_professional_id` para o escopo `all`, ou trocar o rótulo. | Página como `owner` | · |
| C-43 | S2 | Os slugs `agenda`, `caixa`, `config`, `clientes`, `comanda` e `recuperar` são aceitos no cadastro, mas o redirect **308** do `next.config` sequestra a página pública do salão (permanente, cacheável). Também falta `opengraph-image` [INFERÊNCIA]. | `next.config.ts:31`; `core/tenants/slugs-reservados.ts:24-48` | Reservar os 7 prefixos; a guarda `slugs-reservados-cobrem-as-rotas` passa a ler os `redirects()` | Ver reprovar removendo `'agenda'` | · |
| C-44 | S3 | `vindo-de-outro-sistema` só é alcançável pela resposta do onboarding. `<Link><Button>` aninhado em `/admin/campanhas:139`. Rotas GET sem uso (`cash/*`, `commissions/extract`, `cycle/attribution`, `vault/access-log`, `me`). `docs/02-API.md` lista cerca de 12 rotas que não existem (`POST /tickets`, `tickets/:id/pay`, `refund`, `clients/merge`…). | Ro, seções 3, 5 e A9–A11 | Links de entrada; reescrever `docs/02 §2` a partir da árvore | Teste doc × rotas | · |

**Sem achado** (FATO Ro):
- Nenhum `fetch`/`apiFetch` aponta para rota inexistente ou usa método não exportado (42 PUT/PATCH/DELETE conferidos).
- Nenhum `onClick` vazio, TODO ou toast "em breve", exceto o caso C-42.
- Os `href="#"` de `ficha.tsx:814,845` são inalcançáveis, protegidos por `telefoneUtilizavel`.

---

## DINHEIRO (item 3) · cada número e sua fonte

(Auditoria $, com os S0/S1 relidos por mim. Abreviações das colunas: **Desc.** = inclui desconto; **Estorno exclui** = estorno ou cancelado fica de fora.)

| Tela | Número | Fonte | Desc. | Pacote | Estorno exclui | Taxa | Aluguel |
|---|---|---|---|---|---|---|---|
| Hoje | "Atendido hoje" | `resumo-hoje.ts:140` (Σ `appointments.price_cents` `done` de hoje) | Não | Sessão a preço cheio | **Não** | Não | Não |
| Hoje | "% acima/abaixo do costume" | `resumo-hoje.ts:126-154` | Não | idem | Não | Não | Não |
| Hoje / Recuperar | "O Motor trouxe este mês" | `atribuicao.ts:106-205` | Não | **Saldo de hoje** (C-03) | Não | Não | Não |
| Hoje / Recuperar | "Dá para recuperar" | `recuperar-receita.ts:103` ← `v_recover_revenue` ← `valor-em-risco.ts:41` | Não (catálogo × chance) | 0 com saldo | n/a | Não | Não |
| Caixa / Mês | "Entrou no dia/mês" | `caixa.ts:74-93` (Σ `tickets.total_cents` `closed`/`paid` por `closed_at`) | Sim, **com gorjeta** | Venda nunca (C-02) | Sim, retroativo | Bruto | n/a |
| Caixa / Mês | "Sobrou" | `tickets.profit_cents` ← `totals.ts:91` | Sim | idem | Sim | Sim, se configurada | Só horas agendadas (C-25) |
| Caixa | Material / Taxa / Comissão / Aluguel | `caixa.ts:88-91` | — | — | Sim | — | — |
| Caixa (vazio) | "Você concluiu R$X" | `caixa/page.tsx:123-148` (cópia de "Atendido") | Não | | Não | | |
| Caixa | Comissão por profissional | `comissao.ts:53-101` (só **ativos**) | Antes do desconto da comanda | | Sim | | |
| Mês | Taxa por forma + "Se tudo fosse…" | `taxa-por-forma.ts:59-81` | Sim | | Sim | própria | |
| Mês | "Parado em quem sumiu … de lucro" | `recuperar-receita.ts:104` | Não | 0 com saldo | n/a | **Não** | **Não** |
| Mês | Série "subiu/caiu X%" | `serie-mensal.ts:51-80` + `monthly_profit` (0071) | Sim | | congelado | varia | varia |
| Comanda | Subtotal / Total | `totals.ts:50` (`max(0, sub−desc)+gorjeta`) | Sim | | | | |
| Comanda | "Sobrou" / "Entrou" (sem gorjeta) | `sobra-explicada.ts:110-112` | Sim | | só `closed`/`paid` | Sim | parcial |
| Comissão | Total do mês | `comissao.ts:74-101` | Antes do desconto | | Sim | | |
| Ficha | "Valor atendido" / "Ticket médio" | `crm.ts:305,340` (preço de tabela) | Não | cheio | Não | | |
| Ficha | "Sobrou" / "Lucro por ano" | `crm.ts:263-272,344`; `lucro-do-cliente.ts:56-67` | Sim | | Sim | Sim | parcial |
| Clientes (lista) | Valor por cliente | `clients.ltv_cents` (cron `segmentos.ts`) | Não | cheio | Não | | |
| Orçamentos | Total | `quotes.total_cents` ← `orcamento/calcular.ts:7` (`ceil`) | | | | | |
| Orçamento novo | "Orçamento pronto · R$" | **conta local** `formulario.tsx:62` (C-28) | | | | | |
| Estoque | "Margem R$ (x%)" | `estoque/lista.tsx:206-207` | | | | Não | Não; "100%" com custo 0 |
| Config | Custo/hora, taxas, preço do plano | `custo-fixo.ts:76`; `taxas-de-pagamento.ts`; `planos.ts:251` (= cobrado, FATO) | | | | | |

**Calculado em mais de um lugar.** Equivalentes (FATO):
- "Atendido" (Hoje) e a tela vazia do caixa;
- caixa mensal e Mês;
- "Motor trouxe" e "Dá para recuperar", em Hoje e Recuperar (mesma função).

**Divergentes:**
- Atendido × Entrou (caixa) × Entrou (comanda) × Motor;
- margem por serviço × Sobrou;
- lucro em risco × Sobrou real;
- margem do estoque × Sobrou do produto.

**Cenário único que mostra todas as divergências.** Corte de R$100, 60 min, material R$8, comissão 40%, crédito a 3%, aluguel R$15/h. Comanda com −R$10 de desconto e +R$5 de gorjeta:

| Tela | Número |
|---|---|
| Hoje | Atendido **R$100** |
| Caixa | Entrou **R$95** · Sobrou **R$24,15**. Os quadros não fecham por causa da gorjeta |
| Comanda | Entrou **R$90** |
| Serviços | "sobra 43%" |
| Ficha | R$100 |
| Recuperar | "R$85 · R$44,20 de lucro" |
| Motor | R$100 |

Depois do estorno: o caixa zera; Hoje, Ficha e Motor continuam em R$100.

**Arredondamento:**
- comissão, taxa, total do item e aluguel usam `Math.round`;
- valor e lucro em risco usam `Math.floor`;
- orçamento e sinal usam `Math.ceil`;
- o contrafactual da taxa é `round` da soma, não soma dos `round` (diferença de centavos visível).

**Soma dupla:** nenhuma FATO hoje. O risco é a [HIPÓTESE] de a equipe lançar comanda na venda do pacote **e** em cada sessão.

---

## EVIDÊNCIAS

### Linha de base de testes que pulam (0.1)

FATO: grep em `tests/` por `.skip`, `.todo`, `skipIf`, `runIf`, `xit`, `ctx.skip`:
- **zero** `describe.skip`, `it.skip`, `it.todo`, `skipIf` ou `runIf`;
- **5** `ctx.skip()` condicionais, todos com motivo escrito.

| Teste | Quando pula | Motivo |
|---|---|---|
| `integration/resumo-hoje.test.ts:218,246,280,308` | Perto da meia-noite no fuso do teste | Não cabe passado + futuro no mesmo dia. O comentário diz que sem o skip "passaria vazio" |
| `integration/health-advocacia.test.ts:134` | TOTP desligado no Supabase local | **Na CI vira erro**, não skip (`:132`) |

Na rodada de hoje, **6 casos pularam**:
- 1 por TOTP local;
- 5 porque o `beforeAll` de `servico-arquivado-sai-das-telas` estourou o tempo. É **falha de hook contada como skip** pelo Vitest: o arquivo aparece como FAIL, mas os 5 casos aparecem como "skipped".

**Testes que passam vazios por condição** (early `return` dentro de `it`). São 9 casos, todos guardas de copy ou estado que se "desligam" quando a condição muda:

| Teste | Condição que o torna vazio |
|---|---|
| `agendamento-publico-nao-promete-demais:34` | `reminders` agendado |
| `home-nao-promete-demais:60,77` | `reminders` / `recompute-cycles` agendados |
| `promessa-de-canal:118` | `reminders` agendado |
| `caixa-nao-promete-taxa:73/86` | Par mutuamente exclusivo: sempre um dos dois é vazio, **por desenho** |
| `portfolio-nao-promete-foto:91/101` | Par mutuamente exclusivo, **por desenho** |
| `capacidade-paralela-o-banco-recusa:75` | O banco já conta capacidade |
| `automacoes-nao-prometem-autonomia:45` | Metade ou menos das automações com teto |
| `prazo-sugestao:267` | Gabarito completo |
| `onboarding-conta-os-campos-certos:80` | H1 sem número (reprovado com nome próprio em outro caso) |

Hoje, com `cron.yml` agendando `recompute-cycles` (FATO, A.0), `home-nao-promete-demais:77` **passa vazio**. É legítimo pelo desenho, mas o verde não prova nada sobre a copy de cadência.

**Asserção de vazio sem cenário: amostra de 9.** Existem 154 asserções `toEqual([])`, `toHaveLength(0)` ou `toBe(0)` em `integration/` e `rls/`.

| Teste | Montou cenário? |
|---|---|
| `crm.test.ts:233` (`publicoDaCampanha 'sumidos'` → `[]`) | **Não monta positivo.** Só comenta "Ninguém está atrasado neste tenant recém-criado". Uma consulta que sempre devolve `[]` passaria. O positivo existe em outro caso do arquivo (`:220-222`), mas para outro segmento |
| `crm.test.ts:591` (`margensDoClube` de tenant novo → `[]`) | Mesmo padrão: vazio por tenant vazio |
| `orcamentos.test.ts:317` | Prova de isolamento com tenant novo, sem contraprova no mesmo caso. O positivo do tenant A está em outros casos do arquivo |
| `recorrencia.test.ts:449` | Mesmo padrão de `orcamentos.test.ts:317` |
| `rls/isolation.test.ts:645` (select do B em cada tabela → `[]`) | O controle positivo (`sobrou.length > 0`) existe só no caso de **delete** e só para `nomesAlcancaveis`. Para tabelas `NEGADAS_POR_DESIGN`, o select é provado sem saber se o A tinha linha |
| `rls/cadastro-e-dinheiro-por-papel.test.ts:214-243` | Bom: o par positivo existe (`:218-223`, "a Ana continua enxergando a PRÓPRIA") |
| `resumo-hoje.test.ts:316-318` | Bom: o cenário é montado e há `ctx.skip` quando não dá |

### Guarda cega encontrada (C-05)

```
$ node detector.mjs src/components src/app src/lib     # o MESMO detector do teste, copiado para o scratchpad
DEFEITO src/components/config/editor-expediente.tsx
```

O teste chama `telas('src/app')` (`rede-nao-derruba-tela.test.ts:80`): a guarda não olha onde o defeito mora (memória "guarda cega de raiz"). Uma varredura mais larga (qualquer transição com `await` sem `try` nem `.catch`) achou outros 11 lugares em `components/advocacia` e `admin/casos|intimacoes|pendencias|config/advocacia`. Todos chamam `escreverJuridico`, que **não lança** (conferido em `lib/advocacia`). Não são defeito.

### Reproduções (passos)

- **C-01:**
  1. Serviço "Corte" a R$45; agendar para amanhã.
  2. Em Configurações, subir o Corte para R$50.
  3. Amanhã: "Chegou" → "Concluir" → "Ver comanda".
  4. Esperado: 1 item "Corte R$45". Obtido: comanda vazia, seletor no **1º serviço do catálogo**; ao escolher Corte e Adicionar, o item sai a R$50.
- **C-04:**
  1. Em `/{slug}/agendar`, escolher horário e preencher.
  2. Com o DevTools em "Offline" logo depois do envio (ou bloqueando só a resposta), tocar "Confirmar".
  3. Ver a mensagem de rede e tocar "Confirmar" de novo.
  4. Obtido: "Esse horário acabou de ser reservado. Escolha outro."
  5. No banco: 1 agendamento já existe para esse telefone.
- **C-05:**
  1. `/admin/config/horarios`, preencher a folga.
  2. DevTools → Network → Offline → "Adicionar".
  3. Esperado: aviso, campos mantidos. Obtido [HIPÓTESE pela regra do React 19 já medida em `docs/21` §5.4]: o error boundary do admin substitui a tela.
- **C-07:** `TZ=UTC pnpm build && pnpm start`, abrir `/admin/hoje` com JS desligado. A hora de "A seguir" aparece 3 h à frente da agenda.

### Saída resumida dos comandos (0.1)

```
pnpm typecheck   → EXIT 0   (tsc --noEmit, 20,8 s)
pnpm lint        → EXIT 0   (eslint ., 19,1 s)
pnpm test:unit   → Test Files 389 passed (389) · Tests 3757 passed (3757) · 91,99 s · EXIT 0
TZ=UTC        pnpm test:unit → Test Files 389 passed (389) · EXIT 0
TZ=Asia/Tokyo pnpm test:unit → Test Files 389 passed (389) · EXIT 0
pnpm test:integration (banco local) → Test Files 5 failed | 64 passed (69)
                                     Tests 5 failed | 533 passed | 6 skipped (544) · 246,7 s · EXIT 1
   FAIL servico-arquivado-sai-das-telas  → beforeAll "Hook timed out in 10000ms" (5 casos viram skipped)
   FAIL ciclo.test.ts:778               → "Test timed out in 5000ms"
   FAIL job-queue.test.ts:148           → "Test timed out in 60000ms" (1.000 jobs, workers concorrentes)
   FAIL legal-casos-estado.test.ts:60   → AppError INTERNAL em src/server/advocacia/casos.ts:287 (erro de gravação)
        legal-casos-estado.test.ts:68   → TypeError null.id (cascata do anterior)
   FAIL legal-casos.test.ts:191         → "Test timed out in 5000ms"
   + "Unhandled Error: [vitest-worker]: Timeout calling onTaskUpdate"
   + dezenas de 429 RATE_LIMITED em /public/booking-*/book no log (limitador por IP, esperado nos testes de limite)
pnpm test:rls    → Test Files 2 failed | 9 passed (11) · Tests 1 failed | 314 passed | 7 skipped (322) · 131,3 s · EXIT 1
   FAIL memberships-write-policy → beforeAll "Hook timed out in 10000ms" (7 casos viram skipped)
   FAIL legal-matriz.test.ts:167 → "Test timed out in 5000ms"
pnpm build       → não rodado por este agente (é do Agente B; a máquina estava sob carga de outra medição)

Rodada SERIAL dos 7 arquivos vermelhos (vitest --config vitest.banco.config.ts --no-file-parallelism ...):
   ✓ ciclo (17) · ✓ legal-matriz (14) · ✓ job-queue (6) · ✓ legal-casos (12)
   ✓ memberships-write-policy (7) · ✓ servico-arquivado-sai-das-telas (5)
   ❯ legal-casos-estado (4 tests | 2 failed)   → Test Files 1 failed | 6 passed (7) · Tests 2 failed | 63 passed (65)
```

**Leitura:** 6 dos 7 arquivos vermelhos eram **carga**. Em série, todos passam (FATO acima). A suíte rodou com paralelismo de arquivos, na mesma máquina e no mesmo banco que outros agentes usavam. Isso bate com a memória da casa ("suíte de banco sem paralelismo / intermitente").

O 7º é **defeito determinístico do teste** (C-36):
- `legal-casos-estado.test.ts:21` fixa `const HOJE = '2026-10-08'` e grava `closed_on: HOJE`;
- o `insert` do caso usa o padrão do banco `opened_on default current_date` (`0105_legal_casos.sql:38`), que hoje é 13/10;
- a constraint `closed_on >= opened_on` (`0105:47`) recusa a gravação, que vira `INTERNAL` em `casos.ts:287`;
- consequência: o teste reprova **todo dia a partir de 09/10/2026**.

O produto grava `opened_on` no fuso do salão (`casos.ts:124`), então não tem o defeito. Só o teste tem. A CI roda `pnpm test:integration` (`ci.yml:253`), portanto a CI da `main` deve estar **vermelha desde 09/10** [NÃO VERIFICADO: não li o GitHub]. CI vermelha por motivo conhecido esconde o próximo vermelho de verdade.

---

## INCERTEZAS

- **Navegador não usado.** C-07, C-09, C-10, C-11, C-13, C-19, C-20, C-21 e C-22 são FATO de código. O sintoma visível precisa de Playwright (perfis de A6). Quem destrava: Agente A/B ou a Fase 2.
- **C-13 (toque engolido)** depende de o `blur` acontecer antes do `click` e do re-render síncrono. [HIPÓTESE] Validar no celular emulado com `hasTouch`.
- **C-14** precisa de dois aparelhos ou duas abas. [INFERÊNCIA] Validar com integração que intercala as chamadas.
- **C-06 e o S0 da `0102`** dependem de produção: o MP está ligado? A `0102` foi aplicada? [NÃO VERIFICADO] Quem destrava: o Eduardo, com leitura autorizada.
- **Migrations em dev e em produção** não foram consultadas. Quem destrava: o Eduardo (produção) ou o Agente E (dev, se autorizado).
- **PR #149** ("venda de balcão" e enxugamento de Recuperar/serviço/produto, segundo a memória) pode mudar C-17, C-20 e as telas de Recuperar. [NÃO VERIFICADO] O estado do PR não foi lido.
- **O vermelho de `legal-casos-estado`** pode ser defeito real do pacote Advocacia ou efeito de carga.

---

## RECOMENDAÇÕES

1. **Onda U (urgente):**
   - C-01: a comanda nasce com o serviço e o preço combinados.
   - C-04: idempotência no agendamento público.
   - C-05: folga sem `try` + guarda ampliada.
   - C-02, C-03 e C-38: pacote no caixa, Motor sem inflar e comanda que consome pacote e crédito. Mesmo ticket-épico, exige decisão de produto sobre `payments`.
   - C-07: hora no fuso do salão no SSR.
   - C-37: página de convite.
   - C-39: link para o expediente por profissional.
   - C-45: a fila drena ao abrir.
   - C-36: o teste-bomba que deixa a CI vermelha (P, meia hora).
   - Antes de qualquer deploy: **conferir em produção a `0102`** (S0 condicional) e o estado do MP para C-06.
2. **Guardas a ampliar ou criar, cada uma com controle positivo:**
   - `rede-nao-derruba-tela` para `src/components` e `src/lib`. Reprova hoje: positivo pronto.
   - `horaLocal(` com 1 argumento reprova.
   - "chave de idempotência não nasce dentro do handler de envio".
   - `update-com-guarda-confere-linhas` passa a exigir guarda de estado quando a função lê `status` antes do update por identidade.
   - Rotas de cron sem gatilho precisam de motivo escrito.
3. **Fuso nos testes:** um job de CI com `TZ` fora de UTC e de UTC-3 (ex.: `Pacific/Kiritimati`). Hoje a suíte passa nos três fusos medidos, mas nada impede o primeiro teste dependente de fuso.
4. **Testes de componente:** o projeto não tem jsdom (`vitest.config.ts`: `environment: 'node'`). Vários achados de UI (C-09, C-13, C-19, C-20) só se provam no navegador. Rever a decisão de 31/08 (sem Playwright no repositório), pelo menos para os 5 fluxos de dinheiro e agenda, ou aceitar Playwright fora do repositório como gate da Fase 2.
5. **Suíte de banco:** rodar `test:integration` com `--no-file-parallelism` no verify local, ou subir os timeouts dos arquivos pesados (`job-queue`, `ciclo`, `legal-casos`). Hoje o verde depende da carga da máquina.
6. **Números:** antes de redesenhar Caixa/Mês/Hoje (Onda 1), fixar um glossário de **um nome por número** ("Atendido" = tabela; "Entrou" = com ou sem gorjeta, decidir). Uma função por número. Teste de propriedade cruzando as telas no cenário único da seção DINHEIRO.
