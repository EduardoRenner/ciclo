# 06 · Copy (Fase 5)

Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md`, Parte C, Fase 5 (12 regras da casa). Base: `origin/main` em `33058dd0`, 13/10/2026.
Insumos: `agentes/D-copy.md` (4.839 textos únicos extraídos por árvore de sintaxe, 51 achados, glossário, 12 famílias sem fonte única) e `medidas/textos/` (`_classificacao.json` com classe por texto); achados de copy dos agentes A, C, F; textos vistos na tela nesta rodada (reproduções da Fase 2 e protótipos da Fase 1); vocabulário por profissão lido do banco local (`professions.vocab`, consulta só leitura).

**Regras usadas** (código na coluna "Regra"): **R1** botão = verbo + objeto · **R2** erro diz o que fazer · **R3** vazio explica e convida · **R4** sucesso com o dado · **R5** destrutiva com consequência e desfazer · **R6** sem supor gênero · **R7** sem jargão · **R8** número, data e dinheiro de um lugar só · **R9** palavra do vertical de um lugar só · **R10** a página pública fala pelo negócio e não promete canal · **R11** WhatsApp e e-mail · **R12** notificação · **C1** mesmo conceito, mesmo nome, uma fonte.

**Rótulos.** Todo texto proposto é **[PROPOSTA]**. A origem de cada problema está no relatório citado (FATO com arquivo:linha lá). O que é jurídico ou regulatório (termos, privacidade) fica **marcado para revisão**, não reescrito.

---

## 0 · Inventário (gate G5)

| Medida | Valor | Fonte |
| --- | --- | --- |
| Textos únicos extraídos | **4.839** (132 entradas de rota + `core`, `server`, `lib`, API) | `medidas/textos/_classificacao.json` |
| Internos (não chegam a gente) | 467 | idem |
| OK | 3.449 | idem (heurística) |
| Reescrever (revisado à mão) | 206 → ligados aos achados abaixo | idem |
| Remover | 4 | idem |
| **"A revisar" (sinal automático, não lido um a um pelo D)** | **713** | idem |

**O que fiz com os 713 nesta fase.** Separei por sinal: **339** "erro sem ação", **107** "vazio sem passo", **43** "botão genérico", **~120** de gênero, **~40** de canal, **~35** de jargão (contagem por `flags` no próprio JSON). Li um a um os **40 de canal** (a promessa mais cara, A5) e classifiquei:
- **Verdadeiros** (abrem o WhatsApp do próprio dono ou da pessoa, sem prometer envio do CICLO): "Mandar no WhatsApp", "Chamar pelo WhatsApp", "Falar no WhatsApp", "Cole na bio do Instagram ou mande no WhatsApp" e afins. **Manter.**
- **Falsos quando o estado é outro**: "Quase lá! Mandamos um link de confirmação" (`cadastro/formulario.tsx:98`) é mentira no caso F-03 (senha recusada); "Manda sua lista pelo WhatsApp que a gente importa" (`vindo-de-outro-sistema/page.tsx:115`) depende de `NEXT_PUBLIC_CONTATO_*` (F-25). Entram na tabela.
- **Jurídicos**: "a gente avisa" em privacidade e termos (`privacidade/page.tsx:269,278`; `termos/page.tsx:176,199,308`). Marcados para revisão jurídica.
- **Internos**: mensagens de `mensageria.ts`/`push.ts` ("Inscrição de push inválida") vão para log, não para tela ([INFERÊNCIA] pelo uso; conferir no ticket de fonte única).

Os 339 "erro sem ação" e os 107 "vazio sem passo" **não** viram 446 reescritas: a maioria é a mesma família (fallback de erro, D-25; "Nenhum …"). A proposta é **fonte única** (seção 5) e uma varredura na tela das 10 telas mais usadas no ticket de copy (salvar `innerText` por rota, como o D recomendou), antes de mexer.

---

## 1 · Tabela de reescritas

Ordem: S1, depois S2 por área, depois S3 relevantes. "Origem" = ID do achado.

### 1.1 S1 (promessa que o produto não cumpre)

| Rota | Elemento | Texto atual | Problema | Texto proposto | Regra | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin/campanhas`, `campanhas/nova`, `/precos`, `config/meu-plano` | Paywall e cartão do plano | "Para mandar a mesma mensagem para todos de uma vez, é preciso o Solo" · "Chamar de volta a base inteira de uma vez" | O produto manda **uma pessoa por toque** (`nova.tsx:179`); o lote foi tirado de propósito (`recuperar.tsx:376-382`) | "Para montar campanha por grupo e ver quem voltou, é preciso o Solo. Chamar uma pessoa de cada vez continua de graça." · Cartão: "Campanha por grupo, com a mensagem pronta para cada pessoa" | R10, A5 | D-01 |
| `estoque`, `clientes/[id]`, `config/planos` | Motivo de botão travado | "Cadastrar produto é do plano Avançado" · "Registrar compra é do plano Avançado" · "Assinatura e clube fazem parte do plano Avançado." | O Avançado **não está à venda** (`PLANOS_A_VENDA = [essencial, equipe]`, `planos.ts:227`) | Gerado por uma função: "{Ação} faz parte do {plano}. Veja em Configurações › Meu plano." → "Cadastrar produto faz parte do Solo. Veja em Configurações › Meu plano." | C1 | D-02 |
| `/cadastro` | Sucesso | "Quase lá! Mandamos um link de confirmação para {e-mail}…" | Aparece com senha de 8–9 caracteres que o Supabase recusou: nenhuma conta, nenhum e-mail | Sucesso só quando a conta foi aceita. Senha recusada: "Essa senha é curta demais. Use pelo menos {mínimo} caracteres." (o mínimo vem do mesmo lugar que o Supabase usa) | R2 | F-03 |
| `/[slug]/agendar` | Sucesso (conta sem telefone) | "Se não tiver retorno em algumas horas, é só chamar por telefone." | Não há telefone em lugar nenhum da página | "Quem vai te atender confirma com você, e pode não ser na hora. O contato fica com o WhatsApp que você deixou: {telefone}." · Com telefone do negócio cadastrado: + "Se precisar, fale com {negócio}: {botão}" | R10, A5 | F-04 |
| `/[slug]/agendar` | Horário tomado (409) | "Esse horário acabou de ser reservado. Escolha outro." (some no mesmo instante) | Apagado antes de ser lido (F-02); e é o texto que a cliente vê quando a **própria** resposta se perdeu (C-04) | "Esse horário acabou de ser marcado por outra pessoa. Seu nome e telefone continuam aqui. Estes estão livres, perto do que você queria:" + 3 horários | R2, R10 | F-02, C-04 |

### 1.2 S2 · Página pública (fala pelo negócio)

| Rota | Elemento | Texto atual | Problema | Texto proposto | Regra | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| `/[slug]/agendar` | Botão principal | "Confirmar agendamento" | O pedido nasce pendente; a tela seguinte diz que a confirmação vem depois | "Pedir este horário" · título do sucesso: "Pedido enviado" | R1, R10 | D-04 |
| `/[slug]/agendar` | Metadado (prévia no WhatsApp) | "Sem ligar, sem esperar resposta" | Espera resposta, sim | "Escolha o horário pelo celular. {Negócio} confirma com você." | R10 | F-14 |
| `/[slug]/agendar` | Erro sem rede | "Se o horário já tiver sido marcado, ele aparece ao escolher o dia outra vez." | O marcado **some** da lista | "Não consegui falar com o servidor. Se o pedido chegou, este horário sai da lista. Toque em Pedir de novo: não vai duplicar." (depende de C-04) | R2 | F-19 |
| `/avaliar/[token]` | Título | "Como foi seu {serviço}?" | "Como foi seu Barba?" | "Como foi o atendimento de {serviço}?" | R6 | D-06 |
| `/avaliar/[token]` | Indicação | "Ela agenda o primeiro horário sem esperar resposta, e {negócio ?? 'o salão'} fica sabendo que foi você." | Supõe mulher; "o salão" para qualquer vertical | "Quem você indicar marca o primeiro horário por aqui, e {negócio ?? 'quem te atendeu'} fica sabendo que foi você." | R6, R9 | D-07 |
| `/orcamento/[token]` | Sucesso | "{negócio} já foi avisado. Combine o horário por lá." | Aviso só por push, e só se houver inscrição | "Pronto: sua aprovação ficou registrada para {negócio}. Para combinar o horário, fale direto:" + botão de contato | R10 | D-08 |
| `/[slug]`, `/[slug]/agendar`, `/avaliar`, compartilhar | Nome do negócio com artigo | "Agende seu horário na {nome}" · "A equipe da {nome} agradece." · "Super recomendo a {nome}" · "Oi! Vim pelo site da {nome}." | O artigo supõe gênero do nome | "Agende seu horário em {nome}" · "{nome} agradece." · "Recomendo demais {nome}." · "Oi! Vim pelo seu site." | R6, R10 | D-26, F-15 |
| `/[slug]` | Nota | "4.5" | Ponto decimal | "4,5" (função de formato) | R8 | D-36 |
| `/confirmar/[token]` | Página inteira | "Confirma seu horário? · Toque numa opção abaixo." | Não diz qual | Título "Você vem?" + cartão "{serviço} com {profissional} · {dia por extenso}, às {hora} · {negócio}" | R4, R10 | A-03, C-21 |
| `/confirmar/[token]` | Depois de desmarcar | "Sentimos falta! Quando quiser, é só marcar de novo." | Soa como cobrança logo depois de desmarcar | "Horário desmarcado. Quando quiser, é só marcar de novo." + "Desfazer" (10 s) | R4, R5 | D-45 |
| `/lista-espera/[token]` | Sucesso e reabertura | "Encaixe garantido!" · reabrir: "Não consegui reservar · Esse encaixe já foi usado." | "Encaixe" é palavra de quem atende; erro para quem já garantiu | "Horário garantido: {dia}, às {hora}. Te esperamos." · reabrir pela mesma pessoa: "Você já garantiu este horário: {dia}, às {hora}." | R4, R10 | D-45, F-08 |
| Erro das páginas por token | Saída | "Chame quem vai te atender pelo WhatsApp: por lá dá para resolver na hora." (sem botão) | Beco sem saída | Com negócio conhecido: "Este link não vale mais. Seu horário não mudou por causa disso." + "Ver a página de {negócio}" · Sem negócio: "Peça um link novo a quem te mandou este." | R2, R10 | A-10, F-18 |
| 404 de slug | Título e botão | "CICLO" · "Voltar ao início" (leva à landing) | Quem procurava um negócio cai na propaganda do CICLO | "Não achei esta página. Confira o link com quem te mandou." | R2 | F-24 |
| Metadado raiz e PWA | Descrição | "Gestão para profissionais da beleza: agenda, Motor de Ciclo e recuperação de receita." | Fecha 9 de 17 profissões; jargão | "Agenda, página de agendamento e a lista de quem parou de voltar, para quem atende com hora marcada." | R7, R9 | D-15 |

### 1.3 S2 · Painel: gênero

| Rota | Elemento | Texto atual | Problema | Texto proposto | Regra | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin/hoje` | Indicações | "Suas clientes trouxeram {n} pessoas novas este mês." | Clientela feminina suposta | "Indicações trouxeram {n} pessoas novas este mês." | R6 | D-11 |
| `/admin/recuperar` (vazio) | Título | "Cadastre suas clientes para o Motor começar" | Gênero + "o Motor" sem explicação | "Cadastre quem você já atende" + "Com a última visita de cada pessoa, o CICLO mostra aqui quem passou da hora de voltar." | R6, R3 | D-12 |
| Ficha | Estado da visita | "Atendida" · "Cancelada" · "Confirmada" | Feminino de propósito; masculino na agenda | "Atendimento feito" · "Cancelou" · "Confirmou" · "Faltou" · "Chegou" · "Falta confirmar" (um mapa só) | R6, C1 | D-13 |
| Recuperar | Filtros, selos e perfis | "Todas · Atrasadas · Perdidas" · "Atrasada"/"Perdida" · "Sumido"/"Atrasado"/"Novo"/"Fiel" · "Pediu para não ser chamado" | Os dois gêneros na mesma linha | "Todos · Na hora de voltar · Passou da hora · Em risco · Sem previsão" · perfis "Vem sempre · Regular · Primeiras visitas · Costuma faltar · Sumiu" · "Pediu para não receber mensagem" | R6, C1 | D-14 |
| Vários | Frases soltas | "Quais clientes estão sumidas" · "se a cliente quiser" · "Cliente removida"/"removido" · "{Cliente} novo" · "com a {profissional}" | Gênero e duas formas | "Quem sumiu há mais de 60 dias?" · "se a pessoa quiser" · "Cadastro apagado" · "Cadastrar {cliente}" · "com {profissional}" | R6, C1 | D-27 |
| Validações | Nome e telefone | "Digite o nome do cliente." × "Digite o nome de quem vai ser atendido." | Duas redações, uma com masculino genérico | Uma constante: "Digite o nome de quem vai ser atendido." / "Digite o telefone de quem vai ser atendido." | R6, C1 | D-28 |

### 1.4 S2 · Painel: jargão e nome das coisas

| Rota | Elemento | Texto atual | Problema | Texto proposto | Regra | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| Barra inferior, `/admin/recuperar` | Botão central e título | "Recuperar receita" | "Receita" é palavra de contador; o botão é só ícone no celular | **"Quem sumiu"** (recomendação; decisão do Eduardo, ver §6). Título: "Quem sumiu". Mudar junto o literal de `tests/unit/core/pacotes.test.ts` | R7 | D-17 |
| Clientes, Ficha, Planos, `/calculadora` | Rótulo | "Ticket médio" | Jargão; na calculadora explica com o próprio termo | "Gasto médio por visita" · ajuda: "Quanto cada pessoa costuma pagar por visita. Exemplo: R$ 35,00." | R7 | D-16 |
| Ficha, Mês, Recuperar, assistente | Nome do número | "Sobrou" e "Lucro" lado a lado | O mesmo número com dois nomes (decisão aberta em `DECISOES.md` §"Sobrou ou Lucro?") | **"Sobrou"** em toda tela e no assistente, até o custo fixo entrar na conta (recomendação; ver §6). No Recuperar, "R$ X de lucro" vira "R$ X que sobraria" | C1 | D-18 |
| Recuperar | Linha da pessoa | "classe" (Ouro/Prata/Bronze) · "nota 72" · "na janela" · "Sem valor avulso" | 4 conceitos internos | "Quanto gasta: Mais · Médio · Menos" · tirar "nota" da linha · "no prazo" · "Próxima visita já paga (clube ou pacote)" | R7 | D-19 |
| Menu, Config, Séries, Preços | Título | "Recorrência" · "Séries de recorrência" | Jargão; o formulário já diz "Repetir este horário" | "Horários que se repetem" · cartão de plano: "Repetir horário e pacotes" | R7, C1 | D-20 |
| Config, Ficha, Meu plano | "Plano" e "assinatura" | "Fidelidade e assinatura" ao lado de "Meu plano"; "Cancelar assinatura" nos dois | Duas coisas com o mesmo nome | Cliente do negócio: "Clube mensal" ("Cancelar o clube de {nome}") · dono: "Meu plano do CICLO" ("Cancelar meu plano") | C1, R1 | D-21 |
| `/verificar` | Aba e título | aba "Confirme seu e-mail" · h1 "Confirmar identidade" | A aba fala de e-mail, a tela pede código | "Código de acesso" · "Abra o app autenticador e digite os 6 números." | C1 | D-22 |
| `/admin/agenda/novo` | Botão | "Confirmar agendamento" | Cria pendente | "Marcar horário" · toast "Marcado: {nome}, {dia}, às {hora}" | R1, R4 | D-05 |
| Agenda, Hoje (detalhe) | Cancelar | Botão "Cancelar" · "Cancelar esse agendamento?" / "Sim, cancelar" | "Cancelar" lido como "fechar a janela"; sem consequência | Botão "Cancelar horário" · confirmação "Cancelar o horário de {nome}, {dia}, às {hora}? Ele sai da agenda e o horário fica livre." + "Cancelado. Desfazer" (10 s). **Não** dizer "{nome} é avisado" (não é) | R1, R5 | D-23 |
| `/admin/clientes/ja-atendo`, Recuperar | Botão com marca | "Pôr {n} no Motor" · "Motor atualizado" | O dono precisa do efeito | "Pôr {n} na lista de quem volta" · "Lista atualizada" | R7, R1 | D-49 |
| `/admin/comanda/[id]` | Botão de dinheiro | "Fechar comanda" | Não diz o valor | "Receber R$ {total}" · enviando: "Recebendo R$ {total}…" · sucesso: "Recebido: R$ {total} no {forma}" | R1, R4 | D-42 |
| Clube, ficha, comanda | Motivo de trava | "Orçamento é do plano Essencial…" · "Repetir é do plano de cima." | "Essencial" é nome interno; "plano de cima" não diz qual | Mesma função de D-02 | C1 | D-03, D-44 |
| `/admin/agenda/novo` (barbearia com Equipe) | Motivo de trava | "Repetir é do Solo" | O motivo é a profissão, não o plano | "Repetir horário não faz parte de {profissão} por enquanto." (se a decisão for manter travado) | R2 | F-13 |

### 1.5 S2 · Erros, vazios e estados que mentem

| Rota | Elemento | Texto atual | Problema | Texto proposto | Regra | Origem |
| --- | --- | --- | --- | --- | --- | --- |
| 37 arquivos | Fallback de erro | `?? 'Não consegui salvar.'` (47 variantes; 42 sem instrução) | Aparece justo quando a API falha fora do padrão | Uma função: "Não consegui {verbo} agora. Confira a internet e toque de novo; o que você digitou continua aqui." | R2, C1 | D-25 |
| 40 arquivos | Erro de rede | "Não consegui falar com o servidor" (63 cópias) | Mesma frase espalhada, variações | Constante `ERRO_DE_REDE` | C1 | D-25 |
| `admin/error.tsx` (boundary) | Texto | "Não consegui carregar esta tela. Pode ter sido a conexão. Nada do que você salvou foi perdido." | Dito logo depois de perder o que a pessoa digitava (C-05, **visto nesta fase**) e para comanda que não existe (A-04) | "Não consegui carregar esta tela. O que já estava salvo continua salvo; o que você estava digitando agora pode ter se perdido." · comanda inexistente: "Essa comanda não existe." + "Voltar para a agenda" | R2 | C-05b, A-04 |
| `/admin/clientes` | Busca que falhou | "0 clientes na lista. Nenhum resultado. Confira a grafia do nome ou o telefone digitado." | Mostrado com o servidor em 500 (**reproduzido**) | "Não consegui buscar agora. Isso não quer dizer que a pessoa não existe. Tocar para tentar de novo." | R2 | C-19 |
| `/admin/hoje` | Blocos que falharam | (zero, sem aviso) | 4 de 5 consultas engolem erro | "Não consegui carregar {o valor do dia / a lista}. O resto da tela está certo. Tentar de novo." | R2 | A §4 nota 6 |
| Faixa de conexão | Sem rede | "Sem conexão · mudanças serão guardadas" | Só "criar agendamento" é guardado | "Sem internet. Dá para marcar horário: fica guardado neste aparelho. O resto espera a conexão voltar." | R10 interna, R2 | C-48 |
| Agenda/novo offline | Depois de guardar | (vai para a página de erro do navegador, **reproduzido**) | — | Ficar na tela: "Guardado neste aparelho: {nome}, {dia}, às {hora}. Sai quando a internet voltar." | R4 | C-48 |
| Faixa de fila | Pendente | "1 alteração pendente · enviando quando possível" | Não envia ao abrir (**reproduzido**, C-45) | Depois do conserto, manter; com falha repetida: "1 horário ainda não saiu. Tocar para mandar agora." | R2 | C-45 |
| Card de conflito/descarte da fila | Texto | "Uma alteração feita offline…" | Não diz qual; "offline" | "O horário de {nome}, {dia}, às {hora}, não entrou: alguém marcou antes. Escolher outro." | R2, R7 | C-48, D-41 |
| `/nova-senha` | Senha curta | "Algo deu errado do nosso lado. Tente de novo em instantes." | É senha curta, não erro do servidor | "Essa senha é curta demais. Use pelo menos {mínimo} caracteres." | R2 | F-06 |
| Link de recuperação em outro navegador | Erro | "Esse link não é mais válido. Peça um novo." | O novo vai falhar igual (F-05) | Depois do conserto `token_hash`, manter; antes: "Abra o link no mesmo navegador em que pediu. Se abriu pelo app de e-mail, copie o link e cole no navegador." | R2 | F-05 |
| `/admin/comissao` | Aviso | "…chega aqui em breve." | "Em breve" sem data | "Por enquanto, o extrato item a item de cada profissional fica no Caixa." | R10 interna | D-39 |
| Recuperar vazio | Aviso de custo | "6 serviços estão sem o custo do material…" (conta sem clientes) | Aviso sobre lista que não existe | Esconder sem clientes | R3 | F-26 |
| Mensagens padrão | "Pedir indicação" | "…Dê um desconto pra quem você indicar…" | Promete desconto que o produto não aplica | "{{nome}}, que bom que você confia no meu trabalho! Se lembrar de alguém, manda este link: a pessoa marca o primeiro horário direto por aqui. {{link}}" | R11 | D-10 |
| Lembrete (dormente) | Corpo | "Você tem {serviço} marcado em {negócio} no dia {data}. Responda para confirmar." | "Responda" não confirma; "Escova marcado" | "Você tem um horário de {serviço} em {negócio}, {data}. Para confirmar ou desmarcar, toque no link:" | R11, R6 | D-09 |
| E-mails de autenticação | Modelos | Nenhum versionado (padrão do Supabase, em inglês) [HIPÓTESE em produção] | "Confirm your signup" | Modelos em `supabase/templates/` com assunto "Confirme seu e-mail no CICLO" | R11 | D-24 |

### 1.6 S3 relevantes

| Rota | Texto atual | Texto proposto | Regra | Origem |
| --- | --- | --- | --- | --- |
| Vários | "Config → Meu plano" · "Configurações, Meu plano" · "em Config" | `CAMINHO.meuPlano = "Configurações › Meu plano"` | C1 | D-30 |
| `error.tsx`, servidor | "estabelecimento" (7) | "negócio" | C1 | D-31 |
| Menu, Config | "Time" | "Equipe" | C1 | D-32 |
| API | "Esse agendamento não pode ir para esse estado." · "Essa operação já foi enviada com outro conteúdo." | "Esse horário mudou. Atualize a agenda." · "Isso já foi enviado. Atualize a tela antes de mandar de novo." | R2, R7 | D-33 |
| Push à equipe | "Orçamento aprovado · Um orçamento foi aprovado pelo link." | "{nome} aprovou o orçamento de {total}. Combine o horário." | R12 | D-35 |
| Importar, séries, fidelidade | "{n} linha(s) com erro" | "1 linha com erro" / "3 linhas com erro" | `docs/20` §C.4 | D-37 |
| Cadastro, perfil, links | "Leva menos de um minuto." · "30 segundos" | Tirar, ou "Três perguntas." | `docs/20` §C.5 | D-38 |
| Notificações, faixa | "Web Push" · "neste ambiente" · "offline" | "Avisos no celular" · "Os avisos no celular ainda não estão ligados no CICLO. Fale com a gente." · "sem internet" | R7 | D-41 |
| Ficha, notas, assistente | "Salvar" · "Adicionar" · "Enviar" · "Confirmar" soltos | "Salvar anotação", "Adicionar item", "Enviar pergunta", "Confirmar código" | R1 | D-43 |
| Agenda vazia | "Toque no botão + para criar…" | "Toque em Marcar para criar o primeiro horário." | R3 | D-44 |
| Voltar | "Voltar para hoje" · "Ir para o Hoje" | "Voltar para Hoje" | C1 | D-46 |
| Entrar, Config | "login" | "entrar" / "acesso" | R7 | D-50 |
| Modelo "Promoção" | "Essa semana o {{servico}} está saindo por {{valor}}." | "Oi, {{nome}}! Essa semana, {{servico}} está saindo por {{valor}}. Quer que eu separe um horário?" | R6, R11 | D-51 |
| Erros com outra voz | "Não foi possível…" · "Não conseguimos…" · "Nao consegui salvar a ficha." | "Não consegui …" + o que fazer | R2, C1 | D-40 |
| `llms.txt`, Mercado Pago | Travessão em texto de `.ts` | Dois-pontos ou vírgula; guarda passa a ver `route.ts` | guarda | D-48 |
| Calculadora, Recuperar, Preços | "salão e barbearia" · "deste salão" · "o preço de um corte" | "quem tem agenda" · "deste negócio" · "menos de R$ 1,70 por dia" | R9 | D-29 |

### 1.7 Marcado para revisão jurídica (não reescrever sem advogado)

`/termos` e `/privacidade`: "salão" fixo (D-29), "estabelecimento" (D-31), "a gente avisa" (prazos de aviso, incidente com ANPD), canal de contato que depende de `NEXT_PUBLIC_CONTATO_*` (F-25), links inline de 17 px (A-19). Pacote Advocacia (`ADVOCACIA_ABERTA` desligada): "o cliente" no masculino, "Lead novo" (D, incertezas): baixa prioridade.

---

## 2 · Glossário do produto

Uma linha por termo: definição curta, onde aparece, forma que fica. Base: glossário do D, ajustado.

| Termo | Definição | Onde | Forma que fica |
| --- | --- | --- | --- |
| Hoje | A tela do dia: o que fazer agora | Barra, `/admin/hoje` | "Hoje" |
| Agenda | Os horários marcados, por dia | Barra, `/admin/agenda` | "Agenda" |
| Horário | Um atendimento marcado num dia e hora | 110 textos | "horário" para quem é atendido e para o dono; "agendamento" só em texto técnico do painel |
| Marcar | Criar um horário | Barra, agendar | "Marcar horário" (painel); "Pedir este horário" (página pública, porque nasce pendente) |
| Confirmar | Passar de "falta confirmar" para "confirmou" | Detalhe, link público | Reservado só para esta ação |
| Estados do horário | Falta confirmar · Confirmou · Chegou · Atendimento feito · Faltou · Cancelou | 3 mapas hoje | Um mapa em `core/`, sem gênero |
| Desmarcar · Cancelar horário | Tirar o horário da agenda (sem apagar) | Público, detalhe | "Desmarcar" (público) · "Cancelar horário" (painel) |
| Comanda | A conta de um atendimento: itens, desconto, gorjeta, forma de pagamento | `comanda/[id]` | "Comanda" |
| Receber | Fechar a comanda com a forma de pagamento | Botão da comanda | "Receber R$ X" |
| Caixa | O que entrou e sobrou por dia e por mês | `/admin/caixa` | "Caixa" |
| Atendido | Soma do preço combinado dos horários feitos (antes de fechar comanda) | Hoje | Só se continuar existindo depois da fonte única (C-26); senão, sai |
| Entrou | Dinheiro recebido nas comandas (decidir com ou sem gorjeta; hoje são os dois, C-26) | Caixa, Mês, Comanda | "Entrou", com uma definição só |
| Sobrou | Entrou menos material, taxa da maquininha, comissão e aluguel informado | Caixa, Comanda, Ficha, Mês | **"Sobrou"** (até a decisão D-18) |
| Gasto médio por visita | Entrou ÷ visitas | Clientes, Ficha, Mês | substitui "Ticket médio" |
| Taxa da maquininha | O que a máquina de cartão leva | `config/taxas` | igual |
| Aluguel e contas | Custo fixo do mês | `config/custo-fixo` | igual |
| Cliente (vocabulário) | Quem é atendido; muda por profissão | 223 textos fixos | sempre pelo vocabulário (§4) |
| Ficha | O cadastro de uma pessoa com histórico | `clientes/[id]` | igual |
| Quem sumiu | Quem passou da hora de voltar pelo ritmo dela | Botão central, Recuperar | "Quem sumiu" (decisão D-17) |
| Na hora de voltar · Passou da hora · Em risco · Sem previsão | Estados do ciclo de uma pessoa | Recuperar | sem gênero |
| Motor de Ciclo | A conta que prevê quando cada pessoa volta | 22 + 14 textos | nome próprio só em título, com uma linha de explicação na 1ª vez; em botão, o efeito |
| Chamar | Abrir o WhatsApp **do dono** com a mensagem pronta (grátis) | Recuperar, Hoje, Ficha | igual |
| Avisar | Mandar pelo número do CICLO (pago) | `promessa.ts:71` | só quando houver canal; nunca em paywall antes disso |
| Campanha por grupo | A mesma mensagem para um grupo, uma pessoa por toque | Campanhas | substitui "de uma vez" |
| Mensagem pronta | Modelo com {{nome}}, {{servico}} | `config/mensagens` | igual |
| Sua página · site de {negócio} | O endereço público de agendamento | Hoje, público | "sua página" (dono) · "página de {negócio}" (público) |
| Orçamento | Proposta com valor que a pessoa aprova pelo link | Orçamentos | igual |
| Sinal | Valor adiantado combinado | Público, detalhe | igual; nunca "pague online" sem pagamento online |
| Pacote | Sessões pagas antes, usadas depois | Ficha | igual |
| Clube mensal | O que a pessoa paga ao negócio todo mês | Config, Ficha | substitui "assinatura" desse lado |
| Meu plano do CICLO · Grátis · Solo · Equipe | O que o dono paga ao CICLO | Meu plano, Preços | nomes só de `NOME_DO_PLANO` |
| Horário que abriu | Vaga oferecida a quem esperava | Lista de espera | substitui "encaixe" na página pública |
| Horários que se repetem | Série semanal ou a cada N dias | Séries | substitui "Recorrência" |
| Equipe · profissional | Quem atende | Menu, Config | "Equipe" (área), "profissional" (pessoa, vocabulário) |
| Negócio | O salão, estúdio, consultório, escritório | Público, erros | "negócio", ou o vocabulário `local` quando existir |
| Ficha de saúde (cofre) | Anamnese cifrada, com trilha de quem abriu | Config, Ficha | igual |
| Módulos · Automações | O que o dono liga e desliga; o que o CICLO faz sozinho | Config | igual |

---

## 3 · Banco de microcopy

### 3.1 Erros (o que aconteceu + o que fazer)

| Situação | Texto |
| --- | --- |
| Sem internet, ao salvar | "Não salvou porque a internet caiu. O que você digitou continua aqui; toque de novo quando voltar." |
| Servidor não respondeu | "Não consegui {verbo} agora. Confira a internet e toque de novo; o que você digitou continua aqui." |
| Resposta perdida em ação com dinheiro | "Não tive resposta do servidor. Toque de novo: se já tinha {fechado}, a tela só confirma, não {fecha} duas vezes." (só com chave estável, C-12) |
| Horário ocupado (painel) | "Esse horário acabou de ser ocupado. Escolha um destes, perto do que você queria:" |
| Horário ocupado (público) | "Esse horário acabou de ser marcado por outra pessoa. Seu nome e telefone continuam aqui. Estes estão livres:" |
| Sem permissão | "Esta parte é do dono do negócio. Peça para liberar em Configurações › Equipe." |
| Módulo desligado | "Esta parte está desligada. Ligar em Configurações › Módulos." |
| Plano | "{Ação} faz parte do {plano}. Veja em Configurações › Meu plano." |
| Sessão vencida | "Sua sessão acabou. Entre de novo; o que você digitou fica aqui." |
| Registro não existe | "{Isto} não existe mais. Volte e atualize a lista." |
| Busca falhou | "Não consegui buscar agora. Isso não quer dizer que a pessoa não existe. Tentar de novo." |
| Bloco da tela falhou | "Não consegui carregar {isto}. O resto da tela está certo. Tentar de novo." |
| Tela inteira caiu (boundary) | "Não consegui carregar esta tela. O que já estava salvo continua salvo; o que você estava digitando agora pode ter se perdido." |
| Senha curta | "Essa senha é curta demais. Use pelo menos {mínimo} caracteres." |
| Link vencido (público) | "Este link não vale mais. Seu horário não mudou por causa disso." |

### 3.2 Vazios (por que está vazio + próximo passo)

| Tela | Texto |
| --- | --- |
| Hoje sem horário | "Nada marcado para hoje. Mande seu link para quem costuma vir: a pessoa escolhe o horário sozinha." · [Marcar horário] [Compartilhar meu link] |
| Agenda do dia | "Nada marcado neste dia. Toque em Marcar para criar o primeiro horário." |
| Clientes | "Ninguém cadastrado ainda. Traga quem você já atende: escreva os nomes que lembra ou importe uma planilha." |
| Quem sumiu (sem clientes) | "Cadastre quem você já atende. Com a última visita de cada pessoa, o CICLO mostra aqui quem passou da hora de voltar." |
| Quem sumiu (conta não rodou) | "A conta ainda não rodou. Seus atendimentos já estão aqui; a previsão é refeita algumas vezes por dia." · [Calcular agora] |
| Quem sumiu (ninguém atrasado) | "Ninguém passou da hora de voltar. Bom sinal." |
| Caixa do dia | "Nenhuma comanda fechada neste dia." · com atendimento feito: "Você atendeu R$ X hoje e ainda não fechou as comandas." · [Ver a agenda] |
| Mês | "Nenhuma comanda fechada este mês ainda." |
| Campanhas | "Nenhuma campanha ainda. Monte uma para um grupo (aniversariantes, quem sumiu) com a mensagem pronta para cada pessoa." |
| Orçamentos | "Nenhum orçamento ainda. Monte um, mande o link, e a pessoa aprova pelo celular." |
| Busca sem resultado (servidor ok) | "Ninguém com '{termo}'. Confira o nome ou busque pelos últimos números do telefone." |
| Página pública sem horário no dia | "{Profissional} não tem horário livre neste dia. {Outro dia} tem {n}." |

### 3.3 Sucessos (o que aconteceu, com o dado)

| Ação | Texto |
| --- | --- |
| Marcar (painel) | "Marcado: {nome}, {dia}, às {hora}." |
| Pedir horário (público) | "Pedido enviado: {serviço} com {profissional}, {dia}, às {hora}." |
| Confirmar | "Confirmado: {nome}, {dia}, às {hora}." |
| Chegou / Faltou | "Chegada de {nome} registrada." · "Falta de {nome} registrada." |
| Receber | "Recebido: R$ {total} no {forma}." |
| Cadastrar cliente | "Cadastro de {nome} feito." (nunca "cadastrado(a)": parêntese e gênero) |
| Folga | "Folga de {profissional}: {de} a {até}." |
| Importar | "{n} pessoas importadas. {m} sem telefone válido entraram sem o telefone." |
| Chamar | "Chamada de {nome} anotada. Se {nome} voltar, aparece em 'quem voltou'." |
| Guardado sem internet | "Guardado neste aparelho: {nome}, {dia}, às {hora}. Sai quando a internet voltar." |

### 3.4 Confirmações destrutivas (consequência + desfazer)

| Ação | Pergunta | Botões | Depois |
| --- | --- | --- | --- |
| Cancelar horário | "Cancelar o horário de {nome}, {dia}, às {hora}? Ele sai da agenda e o horário fica livre." | "Cancelar horário" / "Voltar" | "Cancelado. Desfazer" (10 s) |
| Desmarcar (público) | "Desmarcar {dia}, às {hora}? O horário fica livre para outra pessoa." | "Sim, desmarcar" / "Voltar" | "Horário desmarcado. Desfazer" (10 s) |
| Desfazer fechamento | "Reabrir a comanda de {nome}? O caixa de {dia} e a comissão de {profissional} mudam junto." | "Reabrir comanda" / "Voltar" | "Comanda reaberta." |
| Não chamar mais | "{nome} sai da fila e do Chamar. Dá para desfazer na ficha." | "Não chamar mais" / "Voltar" | — |
| Apagar cadastro (LGPD) | "Apagar o cadastro de {nome}? O nome vira 'Cadastro apagado' e não dá para desfazer. O histórico de dinheiro continua, sem o nome." | "Apagar cadastro" / "Voltar" | "Cadastro apagado." |
| Sair com fila | "{n} horários guardados neste aparelho ainda não saíram. Se sair agora, eles se perdem." | "Mandar e sair" / "Sair e perder" / "Voltar" | — |
| Excluir conta | "Isto apaga seu acesso ao CICLO para sempre. {n} alterações guardadas neste aparelho se perdem." | "Excluir minha conta" / "Voltar" | — |

---

## 4 · Termos por vertical

FATO (`professions.vocab`, banco local, só leitura):

| Profissão | `cliente` | `atendimento` | `servico` | `profissional` | `local` |
| --- | --- | --- | --- | --- | --- |
| Barbearia | cliente | atendimento | serviço | profissional | barbearia |
| Cabelo, Unhas, Cílios, Sobrancelhas, Depilação | cliente | atendimento | serviço | profissional | salão |
| Estética facial e corporal | cliente | atendimento | serviço | profissional | clínica |
| Banho e tosa | **responsável** | atendimento | serviço | profissional | pet shop |
| Tatuagem | cliente | **sessão** | **trabalho** | **artista** | estúdio |
| Personal trainer | **estudante** | **treino** | **treino** | **personal** | — |
| Professor particular | **estudante** | **aula** | **aula** | **docente** | — |
| Psicólogo | **paciente** | **sessão** | **sessão** | **terapeuta** | — |
| Faxina e diarista | cliente | **faxina** | serviço | profissional | — |
| Eletricista, Encanador, Jardineiro | cliente | **serviço** | serviço | profissional | — |
| Fotógrafo | cliente | **ensaio** | **ensaio** | profissional | — |
| Advocacia | cliente | **reunião** | serviço | profissional | escritório |
| Outra profissão | (padrão) | (padrão) | (padrão) | (padrão) | — |

**Onde o vocabulário não chega hoje** (D, E10): barra inferior "Clientes" (`core/pacotes/base.ts:26`), 223 textos com "cliente" fixo, títulos de Clientes e Recuperar, primeiros passos da Hoje (iguais para todos, F-11), mensagens de validação (D-28).

**Cuidados de concordância** (lição R6): "estudante", "responsável", "paciente" e "artista" servem aos dois gêneros, mas adjetivo junto não ("{Cliente} novo" vira "estudante novo"). Regra: o vocabulário entra em frase **sem** adjetivo concordando ("Cadastrar {cliente}", não "{Cliente} novo"). Sem `local`, usar "negócio".

---

## 5 · Textos que precisam de fonte única

| # | Família | Hoje | Fonte proposta | Guarda (vista reprovando) |
| --- | --- | --- | --- | --- |
| 1 | Nome do plano em frase de trava | 7 literais ("plano Essencial", "plano Avançado", "plano de cima") | Função sobre `NOME_DO_PLANO` + `planoQueLibera()` | Proibir os literais em `src/`; plantar "plano Avançado" e ver reprovar |
| 2 | Caminho de menu | 4 grafias | `CAMINHO.meuPlano`, `.horarios`, `.seguranca`, `.modulos` | Proibir "Config →" e "Configurações, " em texto |
| 3 | Estado do horário | 3 mapas (`appointment-row.tsx:36-42`, `detalhe.tsx:20-38`, `ficha.tsx:74-80`) | Um mapa em `core/` | Teste de que os 3 componentes importam o mesmo mapa |
| 4 | Estado do ciclo e perfil | `recuperar.tsx:36-47`, `nota-do-cliente.ts:70-79` | Um mapa em `core/ciclo` | idem |
| 5 | Sobrou / lucro | 8 textos com "lucro" para o mesmo número | Constante de rótulo | Proibir "lucro" em rótulo de número de comanda (com a exceção escrita) |
| 6 | Erro de rede e fallback | 63 + 47 cópias | `ERRO_DE_REDE`, `erroAoSalvar(verbo)` | Contagem de cópias só encolhe |
| 7 | Validação de nome e telefone | 4 serviços, 2 redações | Esquema Zod compartilhado | — |
| 8 | Registro apagado | 5 arquivos, 2 gêneros | `REGISTRO_APAGADO = 'Cadastro apagado'` | — |
| 9 | Descrição do produto | 5 versões (layout, manifest, landing, og, llms.txt) | Uma constante de marca | Teste que compara as 5 |
| 10 | Rótulos de navegação | `topbar.tsx`, `config/page.tsx`, `pacotes/base.ts` | Catálogo único (com vocabulário) | — |
| 11 | Dinheiro, data, nota | 9 `Intl.NumberFormat`, 25 arquivos com `toLocale*` | `core/text/formato.ts` (core não importa lib), com **fuso obrigatório** (liga com C-07) | Guarda de `toLocale*` sem `timeZone` |
| 12 | Vocabulário | 20 arquivos usam; 223 textos não | `useVocabulario` em todo rótulo de pessoa e serviço | Guarda de "cliente" literal em rótulo, com lista de exceções |
| 13 (novo) | Textos do boundary de erro | `app/error.tsx`, `admin/error.tsx` | Um módulo de textos de erro de tela, com público × painel por `usePathname()` (regra do `CLAUDE.md`) | Teste de que o boundary público não fala de "Hoje" |
| 14 (novo) | Nome do negócio em frase pública | Artigo antes do nome em 8 lugares (D-26) | Helper de frase sem artigo | Guarda: `(na|da|a) {` antes de nome do negócio |

**Guardas a ampliar** (do D, com o procedimento do `CLAUDE.md`: commitar antes de mutar, mutar cada defeito, confirmar a mutação, gritar se o padrão parar de casar): gênero ("suas clientes", "a cliente", particípio feminino como rótulo de estado, artigo antes de `{nome}`/`{servico}`); travessão em `route.ts` que devolve texto; "em breve"; número de tempo sem fonte.

---

## 6 · O que depende do Eduardo (decisões de copy)

| # | Decisão | Recomendação | Motivo |
| --- | --- | --- | --- |
| a | "Sobrou" ou "Lucro" (aberta em `DECISOES.md`, "### 1. 'Sobrou' ou 'Lucro'?") | **"Sobrou"** até o custo fixo entrar na conta | O número é margem de contribuição; chamar de lucro repete a lição "margem com nome de lucro". O Caixa já diz "Sobrou" |
| b | Nome do botão central | **"Quem sumiu"** | É como o dono fala (`docs/20` §C.3); cabe no botão com rótulo visível (I-02) |
| c | Emoji nos modelos padrão de mensagem | Sem emoji nos textos do CICLO (filtro, bio); nos modelos, decisão do Eduardo | É a voz do dono; `docs/20` §C.2 vale para a voz do CICLO |
| d | Plano pago vende "envio em lote" ou "campanha por grupo" | **"Campanha por grupo"** até existir canal configurado e rota agendada | Promessa de canal (A5) |
| e | Modelos de e-mail do Supabase em PT-BR | Versionar em `supabase/templates/` e conferir o painel de produção | "Migração não leva a config" (memória da casa) |

## 7 · O que **não** fazer agora

- Reescrever termos e privacidade sem revisão jurídica.
- Variações de frase do Motor (decisão de 29/09 em `DECISOES.md`: cada variação multiplica onde as regras de honestidade podem escapar).
- Trocar "cliente" por "pessoa" em massa: o vocabulário por profissão é a fonte; "pessoa" só onde a frase precisa ser neutra.
- Reescrever as 713 "a revisar" uma a uma antes da fonte única: a maioria some quando a família vira constante.

## 8 · Gate G5

- 100% do texto inventariado (4.839, pelo D); os 713 "a revisar" estão separados por sinal, os 40 de canal lidos um a um, e o resto coberto por fonte única + varredura na tela das 10 telas mais usadas no ticket de copy.
- Toda reescrita S1 e S2 está na tabela, com regra; S3 relevantes também.
- Jurídico marcado (§1.7).

**G5 fechado com ressalva:** a varredura `innerText` das 10 telas mais usadas (texto montado em tempo de execução e texto que mora no banco) fica como primeiro passo do ticket de copy.

---

## Correções após a revisão adversarial (prevalecem)

Fonte: `09-revisao-adversarial.md`. Onde esta seção contradiz o que está acima, **vale esta seção**.

1. **F-04, sucesso do agendar público (§1.1, R-22).** Sai "Quem vai te atender confirma com você, e pode não ser na hora": promete em nome do negócio uma confirmação que o CICLO não garante (R10). Texto: "Pedido enviado para {negócio}: {dia}, às {hora}." + "Guarde este horário. Se precisar mudar, fale com {negócio}: {botão}". O botão só aparece se houver contato. Sem contato, fica só a 1ª frase.
2. **D-45, depois de desmarcar (§1.2, R-16).** Sai "+ Desfazer (10 s)" na página pública. Texto: "Horário desmarcado. Quando quiser, é só marcar de novo."
3. **D-23, cancelar no painel (§1.4, R-16).** Com lista de espera avisada, a confirmação diz: "Cancelar o horário de {nome}, {dia}, às {hora}? Ele sai da agenda, o horário fica livre e a próxima pessoa da lista de espera é avisada." Sem "Desfazer" nesse caso.
4. **C-16, sinal na comanda (R-18).** Texto novo: "Sinal informado no agendamento: R$ {valor}. Confira se já recebeu." Nunca "Sinal já pago", porque o CICLO não sabe se foi pago.
5. **F-03, cadastro (§1.1, R-13).** O comentário de `signup/route.ts:61-63` ("quem já tem recebe um e-mail dizendo isso") não está provado. Nenhum texto de tela pode prometer esse e-mail.
6. **Lista de espera (§1.2, D-45).** "Te esperamos" pode ficar: o horário já foi gravado. Sem promessa de lembrete.
7. **Glossário "Entrou" (R-12, APR-036).** FATO conferido nesta revisão: o "Entrou" da comanda (`sobra-explicada.ts:111`) **não** soma gorjeta, e o do Caixa e do Mês (`caixa.ts:87`, `totals.ts:52`) **soma**. É o mesmo nome para dois números. Até a decisão "Entrou com ou sem gorjeta", a comanda diz "Entrou (sem gorjeta)".
