# 03 · Funcionalidade (Fase 2)

Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md`, Parte C, Fase 2. Base: `origin/main` em `33058dd0`, 13/10/2026.
Insumos: `agentes/C-funcionalidade.md` (52 achados), `E-dados.md` (14), `F-publico-primeiro-dia.md` (26), `B-desempenho.md` (os de comportamento), `A-interface.md` (os que são defeito e não só forma), `01-diagnostico.md`; reproduções feitas nesta fase (seção 1).

**Ambiente (A2, registrado antes de qualquer consulta).** Banco: Postgres do Supabase **local** · contêiner `supabase_db_ciclo` · `127.0.0.1:54322` (API em `127.0.0.1:54321`) · `docker exec … psql` só com `select` · **não é produção**. App: build de produção em `http://localhost:3200` (fuso da máquina, São Paulo), não reiniciado. Para C-07 subi o **mesmo build** uma segunda vez em `localhost:3201` com `TZ=UTC` (simula a Vercel), só durante a medição, e parei depois. Navegador: Playwright 1.48 + Chrome do sistema, perfil celular 390×844 com toque; login do dono `demo-dom-estilo` com o `storageState` do agente A, fora do repositório.

**Como ler.** Um defeito por linha, com o ID original do agente. Colunas: **Sev.** (A8) · **Reprodução** (passos curtos; os longos estão no relatório do agente) · **Esperado × obtido** · **Causa** (com evidência) · **Correção** · **Teste que pega** (e como vê-lo reprovar) · **Risco** do conserto · **Migration** (não · aditiva **antes** do deploy · restritiva **depois** do deploy). Rótulos A3 em cada linha.

---

## 1 · Reproduções feitas nesta fase (os S1 que estavam [HIPÓTESE] ou [NÃO VERIFICADO])

Script: `medidas/fase2-reproducoes.mjs.txt` (partes `c07 c05 c19 c04 c01 c13 c45`), `medidas/fase2-c07-html-por-fuso.mjs.txt`, `medidas/fase2-c07-janela-hora-errada.mjs.txt`. Resultado bruto: `medidas/fase2-reproducoes.json`. Capturas: `capturas/fase2-*.png`.

| ID | Rótulo antes | O que fiz | Resultado | Rótulo agora |
| --- | --- | --- | --- | --- |
| **C-07** | [HIPÓTESE do sintoma] | Mesmo build em `TZ=UTC` (porta 3201) × fuso da máquina (3200). Li a hora no HTML do servidor de `/admin/agenda?date=2026-10-14` e `/admin/hoje`. Depois, celular com CPU 4× e 4G lenta, sondei o texto a cada 25 ms, 5 cargas | HTML em UTC: **12:11 e 13:16** para horários das **09:11 e 10:16**; Hoje: **12:15** para **09:15**. Em SP: horas certas. A hora errada fica **visível de 819 a 1093 ms** (mediana 973 ms) até a hidratação trocar. 0 erro de console capturado (o React troca o texto sem avisar) | **FATO** |
| **C-08** (parte) | FATO de código | Mesmo par de servidores, `/admin/config/horarios`: valor padrão do campo "Início" da folga no HTML | UTC: `2026-10-13T05:44`; SP: `2026-10-13T02:44` (relógio da máquina 02:44). **+3 h** no padrão | **FATO** |
| **C-05** | [HIPÓTESE pela regra do React 19] | Configurações › Horários; rede da rota `/api/v1/time-off` cortada; motivo digitado; "Adicionar" | A tela inteira virou **"Não consegui carregar esta tela · Pode ter sido a conexão. Nada do que você salvou foi perdido."** O formulário sumiu com o motivo digitado. Nenhum toast. (`capturas/fase2-C05-folga-rede-caiu-390.png`) | **FATO**. Achado extra: o texto do boundary afirma "nada foi perdido" logo depois de perder o que a pessoa digitou (ver C-05b) |
| **C-19** | FATO de código | Clientes; API de busca respondendo **500**; digitei "Ana" | "**0 clientes na lista. Nenhum resultado. Confira a grafia do nome ou o telefone digitado.**" Nenhum aviso de falha (`capturas/fase2-C19-busca-servidor-500-390.png`) | **FATO** |
| **C-04** | FATO de código | `POST /api/v1/public/demo-dom-estilo/book` duas vezes com o **mesmo corpo** (simula: a resposta do 1º se perdeu e a cliente tocou de novo) | 1º: **200**, agendamento `d27202ab…` criado. 2º: **409 `SLOT_TAKEN` "Esse horário acabou de ser reservado."** para o horário que ela mesma marcou | **FATO** |
| **C-01** | FATO de código | Agendamento seed "Corte + barba · R$ 70,00" (14/10 09:11, confirmado) → `arrive` → `complete` → abri a comanda | Comanda **vazia** ("Nenhum item ainda"), seletor em **"Barba · R$ 35,00"** (`capturas/fase2-C01-comanda-nasce-vazia-390.png`) | **FATO** (a parte "preço de hoje × combinado" segue FATO de código: `comanda.ts:119`) |
| **C-13** | [HIPÓTESE do toque engolido] | Na mesma comanda: adicionei o serviço, escolhi Pix, toquei no desconto e digitei 10, depois **um** toque em "Fechar comanda" | Saiu **só o `PATCH`** do desconto. A comanda **não fechou** (total R$ 60,00, Pix marcado, botão habilitado na captura) (`capturas/fase2-C13-fechar-com-desconto-focado-390.png`) | **FATO** |
| **C-45** | FATO de código | Agenda/novo **sem rede**: preenchi e toquei "Confirmar agendamento" (vai para a fila offline). Fechei a página, voltei a rede e abri `/admin/hoje` | Fila com **1 item** ao abrir; **0 POST em 10 s**; faixa "**1 alteração pendente · enviando quando possível**"; item ainda na fila no fim (`capturas/fase2-C45-fila-nao-sai-ao-abrir-390.png`) | **FATO** |
| **C-48** | [HIPÓTESE] | Mesmo roteiro: o que a tela mostra logo depois de enfileirar | A página foi para **`chrome-error://chromewebdata/`**, a tela do dinossauro "ERR_INTERNET_DISCONNECTED" (`capturas/fase2-C48-depois-de-enfileirar-offline-390.png`). O service worker não tem página offline para `/admin` (`public/sw.js:7`, `NUNCA_CACHEAR`) | **FATO**; sobe para **S1** (junto com C-45: a pessoa vê "sem internet" do navegador e o horário só sai se o evento `online` acontecer com o app aberto) |
| **C-37** | FATO de código | `curl http://localhost:3200/convite/abc123` | **404** | **FATO** |
| **F-01** | FATO (agente F) | Conferi no banco local os 3 agendamentos da medição do F | `cce7078a`, `6de7506c`, `95886ec1`: todos **"Tue 13/10 09:00"** (Bruna, Larissa, Vitória); a tela tinha dito qui 15 / sáb 17 / dom 18. Código conferido: `agendar.tsx:448-501` grava `setSlots` depois do `await`, sem descartar resposta antiga | **FATO** (conferido) |
| **E-04** | FATO (catálogo) | `pg_policies` e `pg_trigger` de `tickets`/`ticket_items` | `tickets_delete`, `tickets_update`, `ticket_items_update`, `ticket_items_delete` = `has_tenant(tenant_id)`; **0 gatilhos** | **FATO** do desenho; execução por um profissional **[NÃO VERIFICADO]**: não há login de profissional no seed. Quem destrava: seed com usuário `professional` |
| **C-02 / C-38** | FATO (grep) | `grep -rn "from('payments')" src` e chamadores de `packages/[id]/use` e `wallet/debit` | 0 linhas; as duas rotas só aparecem nos próprios `route.ts` | **FATO** |
| **C-06** | FATO (código) | `grep expirar-graca .github/workflows/cron.yml` | 0 linhas | **FATO** no repositório; produção **[NÃO VERIFICADO]** (Eduardo) |
| **E-03** | FATO (código) | `segmentos.ts:55-61` | `last_visit_at: dados?.ultimaVisita ?? null` para todo cliente, inclusive sem atendimento | **FATO** de código; execução [NÃO VERIFICADO] (exige rodar o cron no tenant importado) |
| **F-03** | FATO (agente F) | `signup/route.ts:46-64` | 4xx que não é 429 vira `{ status: 'confirmacao_enviada' }` | **FATO** (conferido) |

**Dados que esta fase criou no banco local** (só em `demo-dom-estilo`): 1 agendamento público "Teste Fase2 Reenvio" (`d27202ab…`, 22/10 18:15); o agendamento seed `e32a7863…` passou a `done`, com a comanda `f9b4129c…` **aberta**, com 1 item e desconto de R$ 10. O teste de C-05 e o de C-45 não gravaram nada (rede cortada; a fila morreu com o contexto descartável). Quem medir este tenant depois verá esses dados.

**Não reproduzido nesta fase, e por quê:** C-14 e C-15 (precisam de duas sessões e de falha forçada no meio do fechamento; S2, a integração proposta pega); E-02 (precisa de tenant com mais de 1.000 linhas **e** login; o tenant de 10 mil linhas não tem membro); E-03 em execução (precisa rodar o cron no tenant importado do F); F-05 em produção (link no app de e-mail); C-06 e a `0102` em produção (só leitura com autorização).

---

## 2 · Defeitos por fluxo

### 2.1 Agendar pela página pública (tarefa-régua 13)

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **F-01** | **S0** | Celular 4×/4G: tocar serviço, em 300 ms tocar outro dia, tocar horário, confirmar (2 de 6 natural; 3 de 3 com a 2ª consulta segurada 2,5 s) | Grava o dia mostrado × grava **outro dia** (e às vezes outro profissional) | FATO: `agendar.tsx:448-501` sem descarte de resposta velha; resumo `:1202-1208` e sucesso `:703-710` montam o dia com `dia` e a hora com `slotEscolhido.startsAt` | (1) contador de requisição ou `AbortController`: só a resposta da consulta mais recente escreve; (2) zerar `slotEscolhido` quando `slots` muda; (3) dia **e** hora do resumo e do sucesso tirados de `slotEscolhido.startsAt` no fuso do negócio; (4) o servidor recusa `startsAt` fora do dia pedido? Não: o dia pedido não vai no corpo; a defesa é do cliente | Playwright fora do repo (`F-corrida-dia.mjs`): 2ª consulta segurada, 20 repetições → 0 divergências entre tela e banco. Ver reprovar: rodar contra o código atual (3 de 3). Unit da função pura "resumo a partir do horário" | Médio: mexe na tela que fala pelo negócio. Reverter: o componente é isolado | não |
| **C-04** | S1 | 2 POSTs iguais ao `/book` (reproduzido, seção 1) | 2º devolve o mesmo agendamento × **409 para o próprio horário**; a cliente escolhe outro e fica com 2 | FATO: `book/route.ts` sem `comIdempotencia`; `agendar.tsx:607-654` sem `idempotency-key` | Chave por **intenção** (gerada uma vez por pedido, guardada no estado, reenviada); a rota usa `comIdempotencia` por tenant; em `SLOT_TAKEN`, se o agendamento daquele horário tem o mesmo `phone_hash`, devolver sucesso com o mesmo id; corrigir o texto do `catch` (F-19) | Integração: mesma chave 2× → 1 agendamento e mesma resposta; sem chave, mesmo telefone e horário → 200 com o mesmo id. Ver reprovar: retirar a checagem de `phone_hash` | Baixo | não |
| **F-02** | S1 | Outra pessoa marca o horário entre a escolha e o envio | Aviso que fica + alternativas × aviso **apagado no mesmo instante**, formulário some | FATO: `agendar.tsx:634-637` chama `buscarDisponibilidade(dia)`, que faz `setErro(null)` (`:456`) | Recarregar a lista **sem** limpar o erro; mostrar `details.alternatives` (a API já devolve); manter nome e telefone | Playwright (`F-agendar.mjs … ocupado`): depois do 409, o texto "acabou de ser marcado" está visível e há ≥ 1 alternativa. Ver reprovar no código atual (`alertas: []`) | Baixo | não |
| **F-04** | S1 | Conta nova, agendar pela página | Sucesso sem prometer canal × "é só chamar por telefone" sem telefone em lugar nenhum | FATO: `agendar.tsx:740-744`; conta nova sem telefone público | Frase sem promessa (ver `06-copy.md`); pedir WhatsApp do negócio no onboarding | Guarda de copy: "chamar por telefone" só renderiza se `perfil.telefone` existe (positivo: demo com telefone) | Baixo | não |
| F-19 | S3 | Sem rede ao confirmar | Frase verdadeira × "ele **aparece** ao escolher o dia" (o marcado **some**) | FATO: `agendar.tsx:648-652` | Texto: "Se o pedido chegou, este horário some da lista. Toque de novo: com a mesma chave, não duplica." (depende de C-04) | Unit do texto do catch | Baixo | não |
| A-24 | S3 | Abrir `/demo-dom-estilo/agendar` | Dias fechados com uma regra só × DOM aparece, SEG não | [HIPÓTESE] fim da janela de 6 dias. Como validar: ler a geração dos dias em `agendar.tsx` | Uma regra: mostrar riscado com "fechado" | Unit da função que monta os dias | Baixo | não |
| F-20 | S3 | Conta nova, página pública | Nome de exibição escolhido × nome completo do cadastro público; "Onde vai ser" em negócio `no_local` | FATO (agente F) | Perguntar nome de exibição; campo de endereço só em `vai_ate` | Integração do perfil público | Baixo | não |
| B-16b | S3 | Agendamento público concluído | Aviso à equipe enviado × `void notificarEquipe` sem `after()` pode ser cortado na Vercel | [INFERÊNCIA]: `public-booking.ts:648` + função serverless encerra ao responder | `after(() => notificarEquipe(...))` | Unit que verifica o uso de `after` (guarda casando a **chamada**, não o nome) | Baixo | não |

### 2.2 Agendar, remarcar e cancelar no painel (tarefas-régua 2 e 3)

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C-12** | S2 | Agenda/novo com rede lenta: resposta se perde, tocar de novo | Mesma resposta × 409 "acabou de ser reservado" para o **próprio** horário | FATO: chave nasce dentro de `enviar` (`novo/formulario.tsx:166`); idem `comanda.tsx:28`, `detalhe.tsx:42`, `clientes/nova/formulario.tsx:51` | Chave por intenção (ao montar o corpo; reusada até mudar o corpo) | Guarda: "`randomUUID()` não aparece dentro do handler de envio" casando a chamada dentro da função, com controle positivo plantado; integração já cobre a idempotência do servidor | Baixo | não |
| **C-08** | S2 (impacto S1, gatilho raro) | Aparelho em fuso diferente do negócio; marcar 14:00 | Grava 14:00 no fuso do negócio × grava 14:00 no fuso do **aparelho**. Padrão da folga +3 h no HTML do servidor (**reproduzido**) | FATO: `novo/formulario.tsx:29-31,275`; `detalhe.tsx:48-52,144`; `editor-expediente.tsx:15-29,138,263,295,305` | Mandar data e hora **locais** + fuso do tenant; converter no servidor (Temporal), como o público já faz. Com I-10 (grade de horários), o painel passa a mandar `startsAt` da grade | Unit `paraInstante(local, tz)`; Playwright com `timezoneId: 'America/Manaus'` num negócio de SP → grava a hora do negócio. Ver reprovar no código atual | Médio: toca 3 formulários | não |
| C-11 / F-12 | S2 | Marcar para amanhã | Ver o horário criado × volta para **hoje** ("Nada marcado") | FATO: `novo/formulario.tsx:186` | `router.push('/admin/agenda?date=<dia no fuso>')` + destaque da linha | Playwright: depois de marcar, a linha nova está visível | Baixo | não |
| C-10 | S2 | Remarcar para horário ocupado | Alternativas tocáveis × só o texto | FATO: `detalhe.tsx:146-151` × `novo/formulario.tsx:190-193,446-453` | Reusar os chips de alternativa (e a grade de I-10) | Playwright | Baixo | não |
| C-30 | S3 | Remarcar e marcar "Chegou" ao mesmo tempo | Uma vence × remarca quem já chegou | FATO: `agendamentos.ts:603-614` sem `.eq('status', atual.status)` | Guarda de estado no `UPDATE` + contar linhas (lição "update de zero linhas") | Integração intercalando as duas | Baixo | não |
| C-29 | S3 | Converter orçamento em agendamento com falha no vínculo | Aviso × `.catch(() => {})` silencioso (e `fetch` não rejeita em 4xx) | FATO: `novo/formulario.tsx:179-183` | Conferir `r.ok` e toast discreto | Teste de unidade da função de vínculo | Baixo | não |
| F-13 | S2 | Barbearia (ritmo avulso) com plano Equipe abre Agenda/novo | Motivo real × "Repetir é do Solo" (oferta de plano que não libera) | [INFERÊNCIA]: `agenda/novo/page.tsx:37-38` usa `menorPlanoCom` para qualquer estado ≠ liberado; `planos.ts:388` exige ritmo recorrente | Texto por estado (`fora_do_eixo` ≠ `bloqueado_pelo_plano`); avaliar liberar repetir para barbearia (decisão do Eduardo) | Unit da função de motivo | Baixo | não |
| F-22 | S3 | Marcar com telefone de cliente existente e outro nome | Aviso "já é cliente: {nome}" × agenda no existente sem avisar | FATO (agente F, banco local) | Mostrar o cliente achado antes de confirmar | Playwright | Baixo | não |
| B-12 | S3 | Agenda/novo vindo da ficha (`?cliente=`), tocar Confirmar logo | Botão pronto × formulário recusa porque o GET do cliente ainda não voltou | FATO: `formulario.tsx:94-111` (agente B, 1ª rodada) | Buscar o cliente no servidor junto com o resto | Playwright com CPU 4× | Baixo | não |
| C-33 | S3 | Detalhe do horário, ficha, alternativas | Data e hora no fuso do negócio × fuso do runtime | FATO: `detalhe.tsx:165`; `ficha.tsx:267-270`; `novo/formulario.tsx:33-36` | Provider do fuso do tenant (igual ao `VocabularioProvider`) | Guarda junto com C-07 | Baixo | não |

### 2.3 Hoje e Agenda (tarefas-régua 1 e 4)

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C-07** | S1 | Servidor em UTC (como a Vercel); abrir Hoje/Agenda no celular (**reproduzido**) | 09:11 × **12:11** no HTML, visível ~1 s em toda abertura | FATO: `lib/formato.ts:39-40` (`timeZone` opcional); `hoje.tsx:51,101,415,479,516`; `agenda.tsx:203`; a página tem `ctx.tenant.timezone` (`hoje/page.tsx:63`) e não passa | Passar o fuso do servidor para `Hoje`/`Agenda`; `timezone` **obrigatório** em `horaLocal` | Guarda: `horaLocal(` com 1 argumento reprova, contando argumentos até o `)` que fecha a chamada (não por janela de caracteres); controle positivo: plantar uma chamada sem fuso. Medição: `fase2-c07-html-por-fuso.mjs.txt` com servidor `TZ=UTC` → horas do HTML iguais às do banco no fuso do negócio | Baixo | não |
| C-51 | S2 | Mesma classe de C-07 em **datas** | Data no fuso do negócio × fuso do runtime no SSR | FATO: `ficha.tsx:103,267,269`; `notas.tsx:13`; `pacotes-carteira.tsx:29`; `profissionais/lista.tsx:438`; `orcamentos/lista.tsx:70`; `cofre/trilha.tsx:17`; `estoque/lista.tsx:39-45` | Mesmo provider | Mesma guarda, estendida a `toLocaleDateString(` sem `timeZone` | Baixo | não |
| C-09 | S2 | Hoje: "Chegou" com a ação falhando | Sheet volta ao estado anterior × fica no estado novo (mostra "Concluir" para quem não chegou) | FATO: `hoje.tsx:547` (`setSelecionado` na transição) × `agenda.tsx:75,226` (`useOptimistic`) | `useOptimistic` na Hoje também | Playwright com a rota bloqueada | Baixo | não |
| A-05 / C-26a | S2 | Abrir a Hoje de manhã | Comparação justa × "100% abaixo do costume" (dia parcial contra dias inteiros) | FATO: `resumo-hoje.ts:140,154,175`; `core/ciclo/comparacao-com-costume.ts` | Comparar "até esta hora" nos dias anteriores, ou só depois do fim do expediente | Unit da função de `core/ciclo/comparacao-com-costume.ts` com relógio às 10h → não diz "abaixo" com o dia em andamento igual ao costume do mesmo horário | Baixo | não |
| E-06 | S2 | Cliente `late` apagado ou com opt-out | Alarme da Hoje = Recuperar × alarme conta, Recuperar não | FATO: `resumo_central_de_acoes` → `v_clientes_a_recuperar` (sem `clients`) × `v_recover_revenue` + filtros em memória | Uma view com as 4 regras; os dois números saem dela | Integração: cenário com apagado e opt-out → os dois números iguais (ver reprovar no atual) | Médio (view) | aditiva antes (view nova `security_invoker`) |
| A-12 | S2 | Clientes × Recuperar numa conta importada | Mesma resposta para "quem sumiu" × "Voltam de novo 100%" com 6 "sumido" e Recuperar "0" | [INFERÊNCIA]: três fontes (C/E) | Depende de E-06 e do glossário (C-26) | Teste de propriedade cruzando as telas | Baixo | não |
| B-06 | S3 | Confirmar na Agenda com CPU 4× | Estado otimista estável × [HIPÓTESE] "piscada" quando a transição termina e o refresh chega | Como validar: vídeo da linha entre o toque e o refresh | Atualização local sem `router.refresh()` (P1-c do `docs/28`) | Playwright com gravação | Baixo | não |

### 2.4 Comanda e receber (tarefa-régua 5)

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C-01** | **S0 cond.** | Concluir "Corte + barba R$ 70" (**reproduzido**) | Comanda com o item combinado × **vazia**, "Barba R$ 35" pré-escolhido; ao lançar, preço de **hoje** | FATO: `agendamentos.ts:744-751` (insert sem item); `comanda.tsx:63` (`servicos[0]`); `comanda.tsx:91-101` (não manda `unitPriceCents`); `services/comanda.ts:119` (`?? servico.price_cents`); `agendamentos.ts:367` (preço congelado) | Ao concluir, criar a comanda **com** o item do agendamento (`service_id`, `appointment.price_cents`) na mesma operação; na tela, pré-selecionar o serviço do agendamento | Integração: agenda a R$ 45 → serviço sobe para R$ 50 → conclui → 1 item de R$ 45. Mutação: voltar a `servico.price_cents` e ver reprovar | Alto (dinheiro): ordem "conclui → cria comanda com item" dentro da mesma função; comanda existente não ganha item duplicado (`23505` já tratado) | não |
| **C-13** | S2 | Desconto focado + **um** toque em "Fechar" (**reproduzido**) | Fecha com o desconto × só salva o desconto; não fecha | FATO: `comanda.tsx:318,331` (`onBlur` → PATCH), `:446-453` (`carregando={pendente}`) + `core/ui/botao-travado.ts:18` (`disabled`) | O `close` leva desconto e gorjeta no corpo; tirar o `onBlur`; `pendente` separado por ação | Playwright (`fase2-reproducoes.mjs.txt` parte `c13`): 1 toque → "Comanda fechada" com total R$ 60. Ver reprovar no código atual (FATO acima) | Médio (dinheiro): o servidor valida desconto ≤ subtotal na mesma transação | não |
| **B-07** | S2 | Dois "Adicionar item" que escapem da trava (chaves diferentes) | 1 item × **2 itens** (cobrança a mais) | FATO: `B-duplo-api.mjs` (200, 200, 2 itens) | Chave por intenção (C-12); não deduplicar por conteúdo (2 itens iguais podem ser legítimos) | Integração: 2 POSTs com a mesma chave → 1 item | Baixo | não |
| **C-14** | S2 | Recepção fecha; profissional lança item em outro aparelho | Recusa × item/desconto entra em comanda **fechada**; `total_cents` muda depois de congelar taxa e comissão | FATO: `services/comanda.ts:212-240` (lê `status`, grava com `.eq('id')`); `recalcularSubtotal` sem guarda | `.eq('status','open')` no `UPDATE`/`INSERT` + contar linhas; e o gatilho de E-04 no banco como rede | Integração: fechar, depois `adicionarItemComanda` → 409 e `total_cents` igual. Ver reprovar no atual | Médio | restritiva depois (gatilho, junto com E-04) |
| **C-15** | S2 | Falha na baixa de estoque ou na auditoria durante o fechamento | Tudo ou nada × comanda **fechada**, tela diz "falhou", nova tentativa diz "já foi fechada", estoque parcial | FATO: `services/comanda.ts:285-387`; `estoque.ts:51-61`; `idempotency.ts:91-113` | RPC única em transação (fechar, baixar, auditar), ou gravar a resposta antes da baixa e baixar com reprocesso idempotente por `source_id` | Integração com `registrarMovimento` lançando no 2º produto | Alto (dinheiro + estoque) | aditiva antes (RPC) |
| **E-04** | S1 | Profissional, pelo REST com o próprio JWT: `PATCH ticket_items.commission_cents` de comanda fechada; `DELETE tickets` | 42501 × permitido (política `has_tenant`, 0 gatilhos, **conferido**) | FATO: `pg_policies`; 0073 justifica com premissa falsa ("rotas usam service_role"; `close/route.ts:22` usa `criarClienteDoUsuario`) | (1) `drop policy tickets_delete` + `revoke delete on tickets from authenticated`; (2) gatilho `before update or delete` que recusa mudança de dinheiro em `closed/paid` e DELETE de item fora de `open`; (3) corrigir o comentário da 0073 | `test:rls` por papel: profissional → PATCH → 42501; DELETE → 42501. Ver reprovar **antes** do gatilho | Médio: pode quebrar fluxo legítimo (estorno C-41 deve passar pelo gatilho) | **restritiva depois** do deploy |
| C-41 | S2 | Fechou errado | "Desfazer fechamento" × não há; tela diz "Nada mais pode mudar" | FATO: `POST /tickets/[id]/cancel` sem chamador; `comanda.tsx:460` | Botão "Desfazer fechamento" com confirmação, só em `closed` (compensação, não DELETE: regra 11) | Integração + guarda "rota de escrita tem chamador" | Médio (dinheiro) | não |
| C-16 | S2 | Receber em duas formas, parcial, troco, sinal | Suportado × uma forma só; sinal (`deposit_cents`) não abatido | FATO: `comanda.tsx:71,425-442`; `EsquemaFechamento` | Decisão do Eduardo. Mínimo: "sinal já pago R$ X" abatido como forma | — | Médio | depende |
| C-17 | S2 | Vender produto no balcão sem atendimento | Possível × exige inventar atendimento | FATO: único insert em `tickets` é `agendamentos.ts:744`. **PR #149 aberto** traz `venda-de-produto.ts` e `products/[id]/sale` (`git diff --stat`) | Esperar o #149; não duplicar | Os testes do próprio #149 (`venda-de-produto.test.ts`) | — | 0118 do #149 (aditiva) |
| A-04 | S2 | `/admin/comanda/<id que não existe>` | "Essa comanda não existe" × "Pode ter sido a conexão" + 503 | FATO (agente A) | `notFound()` quando `buscarComanda` não acha | Integração da página | Baixo | não |
| B-11 | S2 | "Ver comanda" pelo horário | 1 render × `redirect()` refaz auth e vínculo (3118 ms no celular) | FATO (B) | Link direto para `/admin/comanda/<ticketId>` quando existe | Contagem de requisições (`B-idas-ui.mjs`) | Baixo | não |
| C-28 | S2 | Orçamento com telefone "+55…" ou estrangeiro | Link certo × `wa.me/55 55…`; total mostrado é a prévia local | FATO: `orcamentos/novo/formulario.tsx:62,109-111,127`; `lib/mensagens.ts:64-69` | `linkWhatsApp(e164)` e o total devolvido | Unit da montagem do link | Baixo | não |

### 2.5 Caixa, Mês e números (tarefa-régua 6)

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **B-00b / E-05** | S1 | ~220 comandas fechadas em 90 dias (reproduzido pelo B com 230 sintéticas) | Mês e Serviços abrem × **"Não consegui carregar esta tela"** (HTTP 414 no gateway) | FATO: `caixa.ts:265-276` `.in('ticket_id', ids)`; `mes/page.tsx:95` sem `catch` | Filtrar `ticket_items` por `tickets!inner(status, closed_at)` como `concentracaoDoMes` (`caixa.ts:197-208`), ou RPC por serviço | Integração com 250 comandas fechadas → as duas funções devolvem; `B-repro-414.sh` como prova | Baixo | não |
| **E-02** | S1 | Tenant com > 1.000 linhas em `done`/ciclos/mensagens | Número completo × **cortado em 1.000 sem aviso** (7 consultas) | FATO: `supabase/config.toml:18` `max_rows = 1000`; `atribuicao.ts:142,150,237`; `resumo-hoje.ts:127`; `recuperar-receita.ts:63,74`; `crm.ts:475,685` | Agregados em RPC/view com `group by`; listas com `buscarTudoPaginado` + `order`; exclusão `on_track` como `not exists` na view | Integração com 1.200 linhas em cada fonte → número igual ao `count` do banco; guarda "consulta sem teto em tabela que cresce" que só encolhe (piso = os 7 conhecidos) | Médio | aditiva antes (RPCs) |
| **C-02** | S1 | Vender pacote de 4 por R$ 320; fechar comanda em cada sessão | "Entrou" = R$ 320, taxa 0 nas sessões × venda **não** entra; cada sessão entra a preço cheio (4 × R$ 100) | FATO: `payments` sem leitor/escritor (`grep` = 0); `pacotes.ts:36-51,108-131`; `taxa-de-pagamento.ts:13` | Venda em `payments` (`kind=package`); sessão como item com `paid_cents/total_sessions`, forma `package`, taxa 0 | Integração: soma das 4 comandas + venda = R$ 320 | Alto (dinheiro) | aditiva antes (se `payments` precisar de coluna) |
| **C-38** | S1 | Vender pacote ou lançar crédito, depois abrir a comanda | "Usar 1 sessão" / "Abater do crédito" × a comanda não sabe; toasts prometem | FATO: `pacotes-carteira.tsx:165,235`; `packages/[id]/use` e `wallet/debit` sem chamador (**conferido**) | Na comanda com cliente: "Usar 1 sessão do pacote X" e "Abater do crédito"; até lá, toasts verdadeiros | Guarda "rota de escrita não pública tem chamador ou motivo" (pega C-37, C-40, C-41) | Alto (cobrança dupla) | não |
| **C-03** | S1 | Atribuir; consumir a última sessão do pacote | "O Motor trouxe" estável × **sobe** (visitas antigas viram preço cheio) | FATO: `atribuicao.ts:29-46,173-178` (saldo de **hoje**) | Excluir visita com `package_uses.appointment_id`; clube pela assinatura vigente na data | Integração: atribuir → consumir → total igual | Médio | não |
| C-25 | S2 | Ocupação 50%, aluguel informado | "Sobrou" desconta o aluguel do mês × só a fração das horas **agendadas** | FATO: `custo-fixo.ts:87-90`; `margem-do-servico.ts:137`; `caixa.tsx:152` | Linha "hora parada" no Mês (`custo fixo − Σ fixed_cost_cents`) | Unit `sobraDoMes` | Baixo | não |
| C-26 | S2 | Cenário único (corte R$ 100, −R$ 10, +R$ 5 de gorjeta) | Um número por pergunta × R$ 100 / 95 / 90 / 85 conforme a tela; estorno muda o caixa e não muda Hoje, Ficha, Motor | FATO: tabela DINHEIRO do agente C | Glossário "um nome por número" (`06-copy.md`) + uma função por número | Teste de propriedade cruzando as telas no cenário único | Médio | não |
| E-13 | S3 | Mudar o percentual de comissão | Margem do clube = comissão paga × recalcula com o % de hoje | FATO: `clube.ts:77-118` × `comanda.ts:286-290` | Ler `ticket_items.commission_cents` quando há comanda | Integração | Baixo | não |
| E-14 | S3 | Mês congelado | `revenue − material − fee − commission = profit` × diferença sem nome | FATO: colunas de `monthly_profit` | `fixed_cost_cents` e `tip_cents` em `monthly_profit` | Unit de `congelarMesesFechados` | Baixo | aditiva antes |
| C-42 | S2 | Dono abre "Minha comissão" | Extrato próprio × "chega aqui em breve" | FATO: `comissao/page.tsx:54-66` | `my_professional_id` para o escopo `all` | Página como `owner` | Baixo | não |

### 2.6 Clientes, ficha e importação (tarefas-régua 8, 9 e 15)

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **E-03** | S1 | Importar cliente com data da última visita, sem atendimento; rodar `segments` | `last_visit_at` mantido × vira **null** e `visits_count` 0 | FATO: `segmentos.ts:55-61` (**conferido**); teste só monta cliente com atendimento (`segmentos.test.ts:128-139`) | Não tocar `last_visit_at` sem atendimento; com atendimento, `greatest`; tirar `name` do upsert (C-24) | Integração com cliente importado → `last_visit_at` igual. Ver reprovar no atual | Baixo | não |
| C-18 | S2 | Abrir Clientes | Ordem alfabética × **aleatória** (UUID desc) | FATO: `services/clientes.ts:147`; `0001_initial.sql:224` | Ordem por `name_busca` com cursor composto | Integração com A, B, C inseridos fora de ordem | Baixo | não |
| **C-19** | S2 | Busca com servidor 500 (**reproduzido**) | Aviso de falha × "Nenhum resultado · Confira a grafia" | FATO: `clientes/lista.tsx:74-90` (não confere `r.ok`) | Conferir `r.ok` → `setFalhou(true)`; descartar resposta de termo velho; últimos 4 dígitos do telefone | Playwright (`fase2-reproducoes.mjs.txt` parte `c19`): com 500, aparece o aviso. Ver reprovar no atual (FATO) | Baixo | não |
| F-09 | S2 | Importar 300 (planilha fictícia do F) | Importar o que dá e avisar × 7 descartados por telefone; data americana aceita errada; 97% "atrasados" pelo serviço pré-escolhido | FATO (agente F) | Importar sem o telefone e avisar; formato de data pela coluna inteira; não pré-escolher serviço do Motor | Integração com a planilha de 300 (`F-gerar-csv.mjs`) | Médio | não |
| C-34 | S3 | Importar a mesma planilha duas vezes | 1 cadastro × duplica quem não tem telefone [HIPÓTESE] | Como validar: integração | Idempotência por hash da planilha | Integração | Baixo | não |
| E-08 | S2 | Perguntar ao assistente sobre faltas | Faltas reais × "0 faltas" para todos | FATO: `clients.no_show_count` sem escritor; lido em `ferramentas.ts:237` | Tirar a coluna do contexto do modelo; calcular ao vivo, como a ficha | Unit da ferramenta | Baixo | não (limpeza depois) |
| F-21 | S2 | Clientes com 295 | Lista em < 2 s × 6,6 s até o título (medida única) | [HIPÓTESE]: lista inteira renderizada; como validar na Fase 4 | Ver `05-velocidade.md` | — | — | — |

### 2.7 Recuperar e campanhas (tarefa-régua 7)

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-20 | S2 | Trocar filtro sem rede | Aviso e filtro anterior × lista antiga sob o rótulo novo; rejeição não tratada | FATO: `recuperar/recuperar.tsx:95-113` | `catch` com toast e volta do filtro; descartar resposta antiga | Playwright com a rota abortada | Baixo (mesmo arquivo do PR #149: fazer depois) | não |
| D-01 | S1 (copy) | Ler o paywall de Campanhas | Promessa verdadeira × "todos de uma vez" (o produto manda um por toque) | FATO (agente D) | Ver `06-copy.md` | Guarda de copy | Baixo | não |
| **N-01** (novo nesta fase) | S2 (latente; vira S1 se o limite subir ou o gateway de produção for menor) | Recuperar com 200 pessoas na lista | Tela abre × `comNotas` monta `.in('client_id', <até 200 ids>)` na URL; o agente B mediu 414 a partir de 220 ids (8,1 KB) no gateway local; a margem é de ~10%. Erro vira `AppError('INTERNAL')` e a página espera sem `catch` (`recuperar/page.tsx:127`) → a tela inteira cai | [INFERÊNCIA]: `notas-do-cliente.ts:79-83` + `LIMITE_PADRAO = 200` (`recuperar-receita.ts:49`) + limite medido em `B-url-longa.mjs` | Filtrar `client_scores` por join/RPC com o mesmo recorte da lista, sem lista de ids; ou lotes de 100 | Integração com 250 itens na lista → a página abre; guarda "nenhum `.in(` com lista sem teto em `src/server`" com a lista dos que têm teto | Baixo | não |
| C-40 | S2 | Procurar como pôr alguém na lista de espera | Entrada × nenhuma (`waitlist` sem chamador) | FATO: `api/v1/waitlist/route.ts:28` | Pôr a entrada ou retirar a função (decisão) | Guarda de rota sem chamador | Baixo | não |
| F-10 | S2 | Hoje logo depois de importar | Um número por pergunta × "266 para chamar" e "261 sumindo" | [HIPÓTESE] critérios diferentes; como validar: E-06 | Mesma view de E-06 | Teste de E-06 | — | — |

### 2.8 Equipe, horários e configurações (tarefa-régua 12)

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C-05** | S1 | Folga com a rede cortada (**reproduzido**) | Aviso, campos mantidos × **tela inteira some** no boundary, motivo perdido | FATO: `editor-expediente.tsx:134-148` (`await fetch` sem `try` na transição); guarda só varre `src/app` (`rede-nao-derruba-tela.test.ts:80`) | `try/catch` com toast, sem limpar o formulário; guarda varre `src/app`, `src/components`, `src/lib` com **piso de arquivos por raiz** | A guarda ampliada **reprova hoje** neste arquivo (controle positivo pronto, saída no relatório C) | Baixo | não |
| C-05b | S2 | Mesmo roteiro | Texto verdadeiro × boundary afirma "**Nada do que você salvou foi perdido**" depois de perder o que foi digitado | FATO (visto nesta fase) | "Não consegui carregar esta tela. O que já estava salvo continua salvo; o que você estava digitando pode ter se perdido." | Guarda de copy do boundary | Baixo | não |
| **C-37** | S1 | Copiar link de convite e abrir (**reproduzido**: 404) | Página de aceitar × **404** | FATO: `memberships/invite/route.ts:50` gera `/convite/{token}`; não existe `app/**/convite`; `memberships/accept` sem chamador | `(public)/convite/[token]/page.tsx`: sem sessão → `/entrar?proximo=`; com sessão → "Aceitar" → `POST accept` → `/admin/hoje`; e-mail divergente tratado | Guarda: todo `` `${APP_URL}/<seg>/` `` em `src/` tem pasta `<seg>` em `src/app` (positivos: `orcamento`, `avaliar`, `confirmar`, `lista-espera`) | Baixo | não |
| **C-39** | S1 | Procurar expediente e folga de um profissional | Link na equipe × nenhum (só por URL) | FATO: grep de `profissionais/${` só acha o próprio `page.tsx:23` | Link "Expediente e folgas" em cada linha da equipe | Guarda "toda `page.tsx` tem referência real", com lista de entradas externas | Baixo | não |
| C-22 | S2 | Digitar "10:00" no expediente no computador | 1 gravação × vários PUTs; o último a chegar ganha | FATO: `editor-expediente.tsx:69-114,220,230` | Salvar no `onBlur` ou botão; descartar resposta antiga | Playwright | Baixo | não |
| C-49 | S2 | Cancelar plano às 22:30 | Data certa × "até 18" quando o acesso cai dia 17 | FATO: `meu-plano/page.tsx:187` × `:176` | `descreverDia(diaDeBrasilia(...))` | Unit com relógio às 22:30 BRT | Baixo | não |
| C-43 | S2 | Cadastrar negócio com slug `agenda` | Recusado × aceito; o redirect 308 sequestra a página pública | FATO: `next.config.ts:31`; `slugs-reservados.ts:24-48` | Reservar os 7 prefixos; a guarda lê os `redirects()` | Ver reprovar removendo `'agenda'` | Baixo | não |

### 2.9 Offline

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C-45** | S1 | Enfileirar offline, fechar, abrir com rede (**reproduzido**) | Fila sai ao abrir × **0 POST em 10 s**; faixa "enviando quando possível" | FATO: `drenarFilaPendente()` só no evento `online`, no backoff (que não roda no único chamador) e em "sair"/"tentar" | Drenar ao montar o shell, em `visibilitychange` e depois do login; backoff com teto enquanto houver fila | Unit `proximaTentativa`; guarda exige a drenagem no efeito do shell (casando a chamada); Playwright `c45` → POST em < 3 s | Baixo | não |
| **C-48** | **S1** (era S2) | Mesmo roteiro (**reproduzido**) | Ficar na tela com "Guardado" × navega para a **página de erro do navegador** | FATO: `formulario.tsx:159` faz `router.push('/admin/agenda')` depois de enfileirar; `sw.js:7` não serve nada offline para `/admin` | Ficar na tela; toast "Guardado neste aparelho. Sai quando a internet voltar."; cards de conflito dizem **qual** horário | Playwright `c45`: depois de enfileirar, a URL continua `/admin/agenda/novo` | Baixo | não |
| C-46 | S2 | Sessão vence; outra pessoa entra no aparelho | Fila só do dono × envia a fila da anterior | FATO: `queue.ts:8-14` sem `userId`/`tenantId` | Gravar dono na mutação; drenar só as do contexto | Unit `filtrarFilaDoContexto` | Baixo | não |
| C-47 | S2 | IndexedDB cheio ou bloqueado no caminho offline | Aviso × boundary | FATO: `novo/formulario.tsx:156-161` (`await apiFetch` fora do `try`) | `try` em volta; guarda procura `await apiFetch(` também | Guarda ampliada vista reprovando | Baixo | não |
| — | S3 | Excluir conta com fila | Aviso × descarta sem avisar | FATO: `excluir-conta/formulario.tsx:52-55,78` | Contar e avisar, como "Sair" | Unit | Baixo | não |

### 2.10 Entrada: cadastro, senha, verificação

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **F-03** | S1 (S0 se o mínimo de produção > 8) | Cadastro com senha de 8–9 caracteres | Motivo × "Quase lá! Mandamos um link" e **nenhuma conta** | FATO: `signup/route.ts:46-64` (**conferido**); app 8 × Supabase local 10 | Piso único (ler do mesmo lugar que o Supabase, ou subir o do app); distinguir `weak_password`/`validation_failed` (devolver motivo) de "e-mail já existe" (resposta idêntica) | Integração contra o Auth local: senha de 9 → 422 com motivo; e-mail existente → resposta igual à de e-mail novo | Médio (não pode virar verificador de conta) | não |
| **F-05** | S1 | Recuperar senha; abrir o link em outro navegador (app de e-mail) | Troca a senha × "link não é mais válido" sempre | FATO: PKCE só troca no mesmo navegador (`auth/callback/route.ts:29-33`) | `token_hash` + `verifyOtp` (independe do navegador) para recuperação e confirmação; no erro, "seu e-mail foi confirmado, entre com sua senha" quando for o caso | Playwright com 2 contextos (`F-senha.mjs`) | Médio (auth) | não; **configuração** do template do Supabase (produção, Eduardo) |
| F-06 | S2 | Nova senha curta | Motivo × "Algo deu errado do nosso lado" | FATO (agente F) | `exigirSenhaForte` antes; traduzir o 422 | Integração | Baixo | não |
| A-18 / F-24 | S3 | Rota inexistente dentro de `/admin`; slug inexistente | 404 do painel e texto para quem procurava um negócio × soft 404 com 200 sem a casca; "Voltar ao início" para a landing | FATO (A, F) | `not-found.tsx` no `/admin`; texto do 404 público | Integração de status | Baixo | não |

### 2.11 Páginas públicas por token

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-21 / A-03 / F-07 | S2 | Abrir `/confirmar/[token]` | Ver o horário antes de decidir × nenhum dado; desmarcar num toque; token ruim só no toque | FATO: `page.tsx` só passa o token; `confirmar.tsx:59-72,81-104` | GET pelo token no servidor; desmarcar com 2º passo e desfazer; estado "já confirmado"; token ruim abre no erro | Integração da rota de leitura; Playwright | Baixo. Hoje sem tráfego (lembrete desligado) | não |
| F-08 | S2 | Reabrir `/lista-espera/[token]` depois de garantir | "Você garantiu: qui 14h" × "Não consegui reservar · já foi usado" | FATO (F) | Distinguir "usado por você" | Integração | Baixo | não |
| A-10 / F-18 | S2 | Token inválido em avaliar, lista de espera, orçamento | Saída × 0 interativos | FATO (A) | Devolver o `slug` e oferecer a página do negócio (`docs/15` §24) | Playwright: ≥ 1 interativo no erro | Baixo | não |
| D-08 | S2 | Aprovar orçamento numa conta sem push | Verdade × "{negócio} já foi avisado" | [INFERÊNCIA]: `orcamentos.ts:197` + `mensageria.ts:202-223` ignora `enviados` | Texto sem afirmar o aviso (`06-copy.md`) | Guarda de copy | Baixo | não |
| F-23 | S3 | Abrir avaliar/orçamento no celular | Conteúdo útil < 1 s × 2,3–3,4 s ("Carregando…") | FATO (F) | Ler no servidor | Medição (F) | Baixo | não |

### 2.12 Crons e motores (falha silenciosa)

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C-06** | S1 cond. (Mercado Pago ligado) | Plano em graça vencida | Cai para o Grátis × fica pago para sempre | FATO: sem gatilho no `cron.yml` (**conferido**), nem `vercel.json`; `expirar-graca/route.ts:8`; tela promete (`meu-plano/page.tsx:186`) | Gating lê `graca_ate`/`acesso_ate` na hora (não depende de cron); agendar o job com heartbeat; `try` por tenant | Guarda: rota de `ROTAS_DE_CRON` fora de `ROTAS_AGENDADAS` está no `workflow_dispatch` **ou** numa lista "sem gatilho, com motivo"; integração `graca_ate` no passado → `gratis` | Médio (cobrança) | não |
| C-23 | S2 | `recompute-cycles` com 1 de N tenants falhando | Heartbeat com falhas × verde | FATO: `recompute-cycles/route.ts:94-98`; `segments/route.ts:64-70` | Heartbeat com contagem de falhas; o health reprova falha repetida | Unit com 2 tenants, 1 lançando | Baixo | não |
| C-24 | S2 | Eliminação LGPD entre leitura e escrita do `segments` | Nome anonimizado mantido × nome real volta | FATO: `segmentos.ts:49-69`; `lgpd.ts:508,522` | `UPDATE` sem `name`, filtrado por `anonymized_at is null` | Integração intercalando | Baixo | não |
| C-35 | S3 | `cron/jobs` | Rota com função × `HANDLERS = {}` | FATO | Remover ou documentar | — | Baixo | não |
| latentes | S2→S1 quando ligar | `campaigns` (janela de 3 h com cron que atrasa 5–6 h), `legal-intimacoes` verde com RPC falhando, `lgpd-retention` trava com 100 falhas | — | FATO (auditoria Cr do C) | Consertar **antes** de ligar cada uma | Unit de cada job | — | não |
| B-13 | S3 | "Chamar" e outros | Evento de produto depois da resposta × `await` no caminho | FATO: `recuperar-receita.ts:434` e outros 4 | `after()` | — | Baixo | não |

### 2.13 Banco, migrations e segurança

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **0102 em produção** | S0 cond. | — | Painel abre × `tenant.ts:89` lê `professions(vocab, pacote)` em todo request e lança `INTERNAL` se a coluna não existe | [NÃO VERIFICADO] em produção. Quem destrava: Eduardo (`schema_migrations` por **nome**) | Conferir antes de qualquer deploy | `conferir-schema-prod` por nome (C-27) | — | — |
| **B-00a / E-01** | S1 (escala) | Contagem com RLS em 10 mil linhas | < 50 ms × 1.028–4.552 ms; a Hoje para de abrir entre ~18 mil e 80 mil agendamentos (projeção) | FATO: políticas chamam função `security definer` com argumento de coluna (por linha) | Pertença calculada uma vez (initplan): `meus_tenants()`, `tenants_onde_vejo_tudo()`, `meus_profissionais()` | `test:rls` verde antes e depois + mutação na política reprovando o isolamento; `explain` < 50 ms em 10 mil | **Alto** (RLS). Ordem: política nova equivalente; não é restritiva, mas sobe junto do deploy e com teste por papel | aditiva/equivalente (junto) |
| E-09 | S2 | Mesclar o PR #142 (0101) e o #149 (0118) | Numeração sem colisão × 0101 < 0117 (push recusa) e 0118 colide | FATO: `git` (agente E) | Renumerar no merge; conferir `schema_migrations` remoto antes | — | Médio | — |
| C-27 | S2 | `conferir-schema-prod` com uma migration faltando no meio | Reprova × "schema OK" (compara contagem com o publicado) | FATO: `conferir-schema-prod.mjs:9-11,42-44` | Comparar o **conjunto de nomes** com o disco; reprovar em "vigilância" | Guarda por nome | Baixo | não |
| E-10 | S3 | `anon` nas 5 views e funções `definer` | Só `authenticated` com `select` × `GRANT ALL` | FATO (catálogo) | `revoke` | `test:rls` | Baixo | restritiva depois |
| E-11 | S3 | 3 políticas jurídicas | Initplan × `auth.role()` por linha | FATO | `(select auth.role())` | — | Baixo | equivalente |
| C-50 | S2 | Caso aberto entre 21h e 24h BRT | Lembretes no dia certo × 1 dia atrasados | FATO: `0106_legal_checklists.sql:62`; `advocacia/casos.ts:137-151` | Preencher com `hojeNoFuso` no insert | Guarda "coluna `default current_date` tem escritor explícito" | Baixo | não |

### 2.14 Testes e guardas

| ID | Sev. | Reprodução | Esperado × obtido | Causa | Correção | Teste que pega | Risco | Migration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C-36** | S1 (processo) | `pnpm test:integration` em qualquer dia depois de 08/10 | Verde × 2 falhas determinísticas | FATO: `legal-casos-estado.test.ts:21` fixa `HOJE='2026-10-08'`; `opened_on default current_date` | `HOJE = hojeNoFuso(tz, new Date())` ou inserir `opened_on: HOJE` | O próprio teste volta a passar todo dia | Baixo | não |
| guarda cega de raiz | S1 (processo) | `rede-nao-derruba-tela` só olha `src/app` | Varre onde o defeito mora × não vê `src/components` (C-05) | FATO | Ver C-05 | Piso de arquivos por raiz | Baixo | não |
| testes vazios | S2 | 9 casos com `return` por condição; amostra de 154 asserções de vazio | Cenário montado × `crm.test.ts:233`, `:591`, `rls/isolation.test.ts:645` sem positivo | FATO (C, seção EVIDÊNCIAS) | Montar o positivo no mesmo caso | Mutação: a consulta que sempre devolve `[]` passa a reprovar | Baixo | não |
| suíte de banco | S2 | Integração e RLS em paralelo com a máquina carregada | Verde estável × 6 de 7 vermelhos de carga | FATO (C) | `--no-file-parallelism` no verify local ou timeouts maiores nos pesados | — | Baixo | não |

---

## 3 · Checklist da Fase 2 por fluxo (onde está o furo)

**✗** furo achado (ID) · **✓** conferido sem furo · **?** não verificado.

| Fluxo | 1 Caminho feliz | 2 Erro (rede, 409, sessão) | 3 Duplo toque | 4 Offline | 5 Dinheiro | 6 Tempo | 7 Multi-tenant | 8 LGPD | 9 `catch` que descarta | 10 Cron | 11 Migrations | 12 Testes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Agendar público | ✗ F-01 | ✗ F-02, C-04 | ✓ (B, F) | ✗ F-19 | — | ✓ (Temporal) | ✓ | ? | ✓ | — | — | ✗ sem e2e |
| Agendar/remarcar painel | ✗ C-11 | ✗ C-10, C-12 | ✓ (B) | ✗ C-45, C-48 | — | ✗ C-08, C-33 | ✓ | — | ✗ C-29 | — | — | ✗ |
| Hoje/Agenda | ✓ | ✗ C-09 | ✓ | ? | ✗ A-05 | ✗ C-07 | ✓ | — | ✗ Hoje engole 4 de 5 (`hoje/page.tsx:83-126`) | — | — | ✗ |
| Comanda/receber | ✗ C-01 | ✗ C-13, C-15 | ✗ B-07 | ? | ✗ C-02, C-38, C-14 | ✓ | ✗ E-04 | — | ✓ | — | — | ✗ |
| Caixa/Mês | ✗ B-00b | ✓ | — | — | ✗ C-25, C-26, E-02 | ✓ (C, Of) | ✓ | — | ✗ Mês sem `catch` em `margemDosServicos` | ✗ E-14 | — | ✗ |
| Clientes/importar | ✗ C-18 | ✗ C-19 | ? C-34 | — | ✗ E-08 | ✓ | ✓ | ✗ C-24 | ✗ C-19 | ✗ E-03 | — | ✗ E-03 sem caso |
| Recuperar | ✓ | ✗ C-20 | ✓ (dedupe no serviço) | — | ✗ C-03 | ✓ | ✓ | — | ✗ C-20 | ✗ C-23 | — | ✗ |
| Equipe/horários | ✗ C-37, C-39 | ✗ C-05 | — | — | — | ✗ C-49 | ✓ | — | — | — | — | ✗ guarda cega |
| Entrada | ✗ F-03 | ✗ F-05, F-06 | — | — | — | — | — | — | ✗ F-03 (4xx vira sucesso) | — | ? 0102 | ? |
| Públicas por token | ✗ C-21 | ✗ A-10 | ✓ | ✓ (`/confirmar` tem "tentar de novo") | — | — | ✓ | — | — | ✗ lembrete desligado | — | — |
| Cobrança | ? | — | — | — | ✗ C-06 | ✓ | — | — | — | ✗ C-06 | ? | ✗ |

---

## 4 · Ordem dos consertos e o que vai junto

**Onda U (antes de tudo, porque grava errado, cobra errado, mostra número errado, trava ou perde dado):**
F-01 · C-01 · E-04 · C-04 + F-02 · B-00b · C-02 + C-38 + C-03 (épico de pacote, precisa de decisão) · E-02 · E-03 · C-05 (+ guarda) · C-07 (+ guarda) · C-45 + C-48 · C-37 · C-39 · F-03 · F-05 · C-36 · B-00a/E-01 (escala; ordem com o agente E) · C-06 (antes de ligar o MP) · conferir a `0102` em produção.

**Junto com a interface (Onda 1), porque é o mesmo arquivo:** C-13 (comanda), C-11/F-12 e C-10 (agendar/remarcar), C-09 (Hoje), C-19 e C-18 (Clientes), C-21 (Confirmar), A-04, A-10.

**Onda 2:** o resto dos S2 desta lista, agrupados por arquivo.

**Ordem de migrations** (lição "migration que tira privilégio inverte a ordem"): aditivas antes do deploy (RPCs de E-02 e C-15, view de E-06, colunas de E-14); equivalentes junto do deploy com teste por papel (B-00a); restritivas **depois** do deploy (E-04 gatilho e `revoke`, E-10). Antes de mesclar qualquer migration: resolver a numeração (E-09).

## 5 · O que **não** fazer agora

- **Deduplicar item de comanda por conteúdo** (B-07): dois itens iguais podem ser legítimos. Só chave por intenção.
- **Pagamento parcial e troco** (C-16) sem decisão de produto: o mínimo é abater o sinal.
- **Reescrever a venda de balcão** (C-17): está no PR #149.
- **Ligar `reminders` e `campaigns`** antes de consertar os latentes (janela de 3 h, texto do lembrete D-09).
- **Mexer na trilha de auditoria** para ganhar tempo no fechamento (`docs/28` §8).

## 6 · Gate G2

- Cada defeito acima está reproduzido (seção 1 e relatórios) ou marcado [NÃO VERIFICADO]/[HIPÓTESE] com motivo e quem destrava.
- S0/S1 conferidos por mim: F-01 (banco), C-01, C-04, C-05, C-07, C-13, C-19, C-37, C-45, C-48 (reproduzidos); E-04, C-02, C-38, C-06, E-03, F-03 (catálogo ou código, relidos). Não conferidos por execução: E-02 e B-00a (dependem de volume com login; B mediu a forma do custo), C-06 e `0102` em produção (autorização).

**G2 fechado.**

---

## Correções após a revisão adversarial (prevalecem)

Fonte: `09-revisao-adversarial.md`. Onde esta seção contradiz o que está acima, **vale esta seção**.

1. **F-01, mecanismo (R-05, R-26).** O POST manda `slotEscolhido.startsAt` (`agendar.tsx:608-614`). O defeito é a lista **velha mostrada como do dia novo**: a cliente escolhe "09:00" achando que é quinta, o horário é de terça, e o resumo e o sucesso dizem quinta porque montam o dia com o estado `dia`. A severidade S0 fica. O teste que pega precisa comparar com o **dia tocado** (a intenção), não só "sucesso = banco".
2. **C-04 (R-06).** Sai a correção "em `SLOT_TAKEN`, mesmo `phone_hash` devolve sucesso". `phone_hash` é `sha256(e164 + sal global)` em `clients` (`telefone.ts:36-39`): o ramo vira oráculo de quem tem horário e quando. Fica só a `Idempotency-Key` por tentativa. Teste: sem chave e mesmo telefone → 409.
3. **C-12 / B-07 (R-07, R-08).** A chave vive **por tentativa** (nasce no 1º envio, morre no sucesso ou no 4xx), e não "até o corpo mudar", porque isso engoliria o 2º item igual legítimo. Escopo real: 68 ocorrências em 44 arquivos geram a chave a cada toque, inclusive `pacotes-carteira.tsx` (vender pacote, crédito) e `fidelidade.tsx`.
4. **C-14 (R-20).** O furo vale também para `removerItemComanda` (`comanda.ts:212-219`) e `recalcularSubtotal` (`:225`), e não só para inserir item e desconto.
5. **E-04 (R-02).** Não existe estorno de dinheiro: `cancelarComandaFechada` (`comanda.ts:394-418`) só troca `closed`→`canceled` e gera `return` no estoque. O gatilho é **só `before update`**, por `OLD.status` e só nas colunas de dinheiro. O DELETE de item fora de `open` é recusado por política. `revoke delete` só em `tickets` (o "remover item" usa DELETE em `ticket_items` com o JWT do usuário). Um gatilho `before delete` quebraria o teardown da suíte (`tenants.delete()` em cascata) e os seeds. Close, cancel e complete usam o JWT do usuário (`close/route.ts:22`, `cancel/route.ts:20`, `complete/route.ts:20`), o que confirma que a premissa da 0073 estava errada.
6. **C-15 (R-03).** Uma RPC `security invoker` não grava `audit_log` (só `service_role`, `audit/write.ts:108-113`) nem baixa estoque quando quem fecha é profissional (`products_update` só dono e gerente, `0075:103-105`). Correção: RPC `security definer` com a checagem de papel dentro dela; a auditoria fica na rota, antes da resposta.
7. **Defeito novo, R-04 [INFERÊNCIA]: profissional fecha comanda com produto → 500 depois de fechar.** S1 condicional à reprodução. Causa provável em `estoque.ts:122-143` × `0075:103-105`. Teste: integração com o cliente do usuário profissional (não `svc`). Ticket APR-038.
8. **Defeito novo, R-33 [HIPÓTESE]: "Tanto faz" com dia em UTC** (`public-booking.ts:585`, `startsAt.slice(0, 10)`). Como validar: marcar "Tanto faz" às 21h BRT no local. Ticket APR-223.
9. **C-16 (R-18).** O sinal (`deposit_cents`) é só exibido (`detalhe.tsx:184-189`) e nunca registrado como recebido. "Abater o sinal" subcontaria o "Entrou". Mínimo: mostrar na comanda sem abater.
10. **E-02 (R-19).** A correção com "agregados em RPC" vale só para soma ou contagem **sem regra de negócio**. A atribuição (regras em `atribuicao.ts`) fica em `src/core` com paginação (`CLAUDE.md` regra 5; lição "duas cópias da mesma fórmula"). Toda RPC nova: `revoke execute … from public, anon`.
11. **B-00a / E-01 (R-11).** A semântica tem 3 armadilhas que o teste precisa cobrir: o "vê tudo" também vale para negócio sem `restrict_professional_view`; `my_professional_id` tem `limit 1`; e `memberships.active`. `appointment_series`, `quotes` e comissões também chamam `can_see_appointment` por linha.
12. **E-10 (R-10).** A `0117` já revogou as tabelas de `anon`. Faltam as 5 views e as sequências. As 4 funções auxiliares ficam executáveis **de propósito** (`0004`, `0036`).
13. **C-24 / LGPD e cancelamento (R-16).** Cancelar pelo painel avisa a lista de espera na hora (`appointments/[id]/route.ts:81-100`); pela página pública, não avisa. Registrado na APR-214. O "Desfazer cancelamento" não pode existir depois de o aviso sair.
14. **C-36 (R-26, R-29).** `legal-captura.test.ts:25` usa `HOJE` como argumento de um DJEN falso, sem `current_date`: não é o mesmo defeito. O conserto commitado (`7d198a2b`) grava `opened_on` explícito, então o caminho `default current_date` (C-50) precisa de caso próprio na APR-221.
15. **Gate G2:** continua fechado, com R-04 e R-33 acrescentados como [INFERÊNCIA]/[HIPÓTESE] a reproduzir.
