# 35 · Fotos de antes/depois + consentimento — plano

**TICKET-114 executado e verificado ao vivo em 31/08/2026.** As três telas do escopo (§"Escopo
deste ticket") estão prontas: conceder/revogar `image_use` na ficha, upload com `consentId`
vinculado, visualização e exclusão (soft delete) de foto. `mediaParaPortfolio` deixa de ser código
morto — agora existe caminho real pra gerar o dado que ela filtra.

**TICKET-115 executado e verificado ao vivo em 31/08/2026 (mesmo dia).** "Publicar no site":
`portfolio_photos` (migration 0053) guarda a cópia reencodada no bucket público `vitrine`,
independente do `media` privado. Botão "Publicar no site" na ficha (revalida o consentimento NO
MOMENTO de publicar, nunca confia em estado que a tela já tinha carregado); galeria "Trabalhos"
na página pública, vazia por padrão. Três cascatas de remoção conferidas: revogar `image_use` tira
TODAS as fotos publicadas daquela cliente do site na hora; apagar a foto original (soft delete em
`media`) tira a cópia publicada também; e a eliminação LGPD (`eliminarCliente`) agora apaga
`portfolio_photos` e o arquivo do bucket `vitrine`, que tinha ficado de fora até esta rodada — achado
ao implementar, registrado em `docs/DECISOES.md`.

Achado ao implementar, fora do escopo deste ticket, registrado como tarefa separada: a limpeza do
bucket PRIVADO `media` dentro de `eliminarCliente` provavelmente falha em silêncio quando chamada
pelo botão manual da ficha (cliente de sessão, sem permissão de escrita no Storage) — só funciona
pelo caminho do cron noturno (service_role). Não é um bug desta rodada, mas foi visto de perto
consertando o mesmo problema pro bucket `vitrine`.

Aberto em 31/08/2026 a partir de um achado do plano da página pública
(`docs/34-PAGINA-PUBLICA-PLANO.md`): "prova social que se escreve sozinha" supunha que só faltava
"o dono autorizar exibição pública" em cima de upload+consentimento já prontos. Investigando pra
implementar, achei que não é o caso.

## O que já existe (TICKET-051/052) e nunca ganhou tela

- `media` (migration da 0001-era) — `client_id`, `phase` (`before`/`after`/`reference`),
  `consent_id`, bucket privado, URL assinada de 5 minutos, acesso registrado em
  `vault_access_log`.
- `consents` — `kind` (`health_data`/`image_use`/`marketing`), `granted`, `version`, `text_hash`,
  `signature_key`, `revoked_at`.
- `fazerUploadMedia` (`src/server/services/media-upload.ts`) — reencode pra WebP, strip de EXIF,
  upload no bucket `media`. **Não aceita `consentId`** — nenhuma foto enviada por aqui pode nascer
  vinculada a um consentimento, mesmo que um exista.
- `listarMediaDoCliente` / `urlAssinadaMedia` / `mediaParaPortfolio` (`src/server/services/media.ts`)
  — a última filtra por `consent_id` com `image_use` ativo, mas nunca é chamada em lugar nenhum.
- `registrarConsentimento` / `revogarConsentimento` / `statusConsentimentos`
  (`src/server/services/consentimentos.ts`) — todas expostas em `/api/v1/clients/[id]/consents`,
  chamadas por zero telas.
- `Saude` (`src/app/admin/clientes/[id]/saude.tsx`) — mostra "N fotos de antes/depois" e "Termos
  assinados" como **resumo somente-leitura**, sem abrir nada, sem upload, sem conceder/revogar.

Ou seja: banco, RLS, serviço e rota — prontos. Tela — zero, nas três pontas (consentimento, foto,
portfólio público).

## Escopo deste ticket (TICKET-114)

Só as duas primeiras pontas — consentimento e foto — que se sustentam sozinhas como registro
interno do salão (LGPD-conforme), independente de qualquer coisa aparecer no site público depois.
**"Publicar no site" fica de fora**, é o TICKET-115 natural, só depois de existir alguma foto de
verdade com consentimento pra publicar.

### 1. Migration — `media.consent_id` writable

`fazerUploadMedia` ganha `consentId?: string | null` em `EsquemaUploadMedia`, valida que o
consentimento pertence ao mesmo `tenant_id`/`client_id` (mesma disciplina de "nunca confiar no
corpo") antes de gravar. Sem migration nova — a coluna já existe desde a origem, só nunca era
escrita.

### 2. `Saude` vira interativa — consentimento

Abre um `Sheet` por tipo (`image_use` primeiro; `marketing` pode reaproveitar o mesmo componente
depois) com: texto fixo do consentimento (versão datada, mesmo padrão de termos de uso no
cadastro), toggle concedido/revogado, e quem registrou. `registrarConsentimento` grava
`granted: true` com o hash do texto mostrado; revogar chama `revogarConsentimento`. Sem captura de
assinatura nesta rodada — `signatureKey` fica `null` (é campo opcional desde o desenho original).

### 3. Upload de foto na ficha

Novo componente (`fotos.tsx`, ao lado de `saude.tsx`/`notas.tsx`) com:

- Grid de miniaturas das fotos existentes — cada uma busca a própria URL assinada ao entrar em
  view (5 min de validade, não dá pra pré-carregar a lista inteira de uma vez sem desperdiçar
  urls que talvez ninguém veja).
- Botão "Adicionar foto" → `<input type="file">` + seletor de fase (antes/depois/referência).
- Se `image_use` não estiver concedido no momento do envio, a tela **oferece conceder ali mesmo**
  (mesmo Sheet do item 2) antes de liberar o upload — nunca sobe foto e pergunta depois. Com
  consentimento já ativo, o `consentId` vai junto no `POST` automaticamente.
- Excluir foto: `media.deleted_at` (soft delete, regra 11 do CLAUDE.md — nunca hard delete).

### Fora de escopo, registrado pra não se perder

- Publicar foto no site público (bucket `vitrine`, TICKET-115) — depende deste ticket existir de
  verdade primeiro.
- Captura de assinatura (`signature_key`) — o campo existe, ninguém pediu ainda.
- Consentimento pelo PRÓPRIO cliente (link público, mesmo padrão de `/avaliar/[token]`) — hoje é
  sempre o profissional registrando em nome da cliente presente fisicamente; virar self-service
  é feature nova, não parte deste ticket.

## Critério de aceite

- [ ] `pnpm verify` limpo
- [ ] Teste de integração: upload sem consentimento não grava `consent_id`; upload com
      consentimento ativo grava; revogar consentimento não apaga foto já enviada (só afeta
      elegibilidade futura de portfólio)
- [ ] RLS: `media`/`consents` já têm política e teste de isolamento — nenhuma tabela nova nesta
      rodada
- [ ] Verificado ao vivo na ficha de um tenant descartável: conceder consentimento, subir foto,
      ver miniatura, revogar consentimento, excluir foto
