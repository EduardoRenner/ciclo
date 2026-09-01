# 34 · Página pública — plano de evolução

Plano escrito pelo Eduardo em 31/08/2026, medido no navegador a 375px em `/dom-rocha` e
`/dom-rocha/agendar`, com consulta aos 7 tenants em produção. Guarda o texto original para
referência de fase/prioridade; o estado de cada item é atualizado aqui conforme executado.

## Diagnóstico (medido, não deduzido do código)

- 0 imagens na página inteira antes da Fase 1 (sem logo, capa, foto de serviço, foto de profissional).
- 1 item personalizável: a cor de acento.
- 66 botões numa tela só; 42 horários listados de 15 em 15 minutos sem hierarquia.

## Fase 1 · a marca

- [x] **Logo e capa** (commit `bf1b870`, TICKET-062) — bucket público `vitrine`, upload no painel.
- [x] **Foto no serviço e no profissional** (commits `b866051`/`274f41f`, TICKET-065/066).
- [x] **Acabamento — presets de cor** (TICKET-070) — 6 swatches curados (`core/text/cor.ts`
      `PALETA_PRESET`) ao lado do seletor livre existente, cada um com contraste ≥4,5:1
      garantido por `corDeContraste`. Corrigido de quebra um bug latente: `--on-acc` (texto do
      botão primário) era fixo `#0d0c0c` global — um dono que escolhesse acento escuro no
      seletor livre já existente ganhava texto invisível. Agora `--on-acc` é calculado por
      luminância do `--acc` do tenant, no `[slug]/layout.tsx`.
      Decisão consciente: não virou "temas" (claro/escuro/vibrante) como o texto original do
      plano sugeria — só `--acc`/`--acc-2`/`--acc-soft`/`--on-acc` são escopados por tenant hoje;
      trocar `--bg`/`--surface` por tenant exigiria reauditar contraste em toda a árvore de
      componentes da vitrine (risco maior que o "baixo esforço" que o plano supôs). Presets de
      cor entregam o "não sei escolher cor, sei escolher essa aqui" sem esse risco.

## Fase 2 · a conversão

- [x] **Horários por faixa** (commit `27269e1`, TICKET-063).
- [x] **Sinal visível para a cliente** (commit `7756402`, TICKET-064) — exibição; cobrança de
      verdade continua bloqueada por Asaas (031/032/033).
- [x] **Reconhecer quem já é cliente** (TICKET-071) — banner "Oi, {nome}! Da última vez foi
      {serviço}, faz N dias. Quer marcar de novo?" com botão que pré-marca serviço e
      profissional. Implementado SEM lookup por telefone digitado (o risco de enumeração que
      este item avisava): `POST .../book` devolve um `reconhecimentoToken` HMAC-assinado
      (`{tenantId}:{phone}`, escopo próprio, 180 dias), guardado só no `localStorage` do
      navegador de quem agendou. Na próxima visita, o front reenvia esse token para
      `GET .../reconhecer` — só quem já provou (agendando) que aquele telefone é dele recebe
      nome/ciclo de volta; um visitante não pode consultar o telefone de outra pessoa digitando
      ele na hora. Nome/telefone são pré-preenchidos direto do `localStorage`, sem round-trip ao
      servidor (são os mesmos dados que a própria pessoa digitou da última vez).

## Fase 3 · o outro negócio

- [ ] **Caminho de solicitação e de orçamento na página pública** (alto) — quando
      `inicio = orcamento_antes`/`solicitacao` (migration 0023, 4 eixos), a página pública ainda
      só sabe fazer o caminho `direto` (grade de horário). 5 de 7 tenants têm os 4 eixos nulos;
      os 2 preenchidos são ambos `no_local/fixo/direto/avulso` — caminho nunca exercitado.

      **Duas correções ao texto acima, medidas em 01/09/2026 ao tentar executar esta fase:**

      1. *"Depende do onboarding passar a perguntar os eixos"* — **não depende.** O onboarding já
         **escreve** os quatro eixos (`onboarding.ts`, copiados da profissão escolhida). Ele não
         *pergunta*, mas grava; tenant novo já nasce com eixo preenchido. Os 5 nulos são anteriores
         a esse caminho.
      2. Ao medir, achei que o módulo `quotes` estava **escondido** de quem tem
         `inicio = orcamento_antes` — a condição de eixo comparava com um valor que a coluna não
         aceita. Corrigido antes desta fase (ver `docs/DECISOES.md`, 01/09). Sem isso, a tela
         pública seria construída em cima de um módulo que o painel escondia.

      **O que ainda trava, e é decisão de produto:** `solicitacao` e `orcamento_antes` são jornadas
      diferentes (uma pede confirmação, a outra pede preço antes) e **não existe tabela de "pedido
      do cliente"** — `quotes` nasce sempre do salão, via `criarOrcamento`, e a cliente só aprova ou
      recusa por link assinado. Ligar a página pública a isso é **desenhar um fluxo novo**
      (quem cria, em que estado nasce, como o salão é avisado, o que a cliente vê enquanto espera),
      não expor um que já existe. Precisa de decisão antes de código.

## Ideias registradas, não uma fase numerada

- **Prova social que se escreve sozinha** (reclassificado de médio para **alto** ao investigar,
  31/08) — a leitura original assumia que só faltava "o dono autorizar exibição pública" em cima
  de upload+consentimento já prontos. Não é o caso: `mediaParaPortfolio` (filtro por
  `image_use` ativo) existe desde TICKET-051/052, mas é **código morto** — não há UI nenhuma,
  em lugar nenhum do admin, para (a) capturar consentimento de uso de imagem, (b) subir uma foto
  de antes/depois, ou (c) visualizar as que já existem (a ficha só mostra uma contagem, sem
  abrir). E `fazerUploadMedia` nem aceita `consentId` — mesmo com UI, nenhuma foto nasceria
  elegível para portfólio hoje. "Publicar no site" seria a QUARTA camada em cima de três que
  ainda não existem. Fica registrado como próximo TICKET candidato, fora do escopo deste plano
  (que é sobre a página pública, não sobre completar TICKET-052).

## Não fazer

Marketplace / comissão por agendamento — contradiz a promessa em `/llms.txt` ("não fica entre o
salão e a cliente dele, não cobra comissão"), que hoje é argumento de venda contra concorrentes
que cobram 11–18%.
