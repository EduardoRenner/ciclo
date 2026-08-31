-- TICKET-039/09-PLATAFORMA: "Marcaram horário: 0" e "R$ 0,00" em toda campanha (docs/DECISOES.md,
-- 2026-08-31, "A tela de campanhas dizia que toda campanha valeu R$ 0,00").
--
-- `messages` nunca guardou de qual campanha uma linha `kind='campaign'` saiu — a atribuição de
-- receita (`atribuirReceita`) só sabia casar por `client_id` + tempo, no agregado do tenant
-- inteiro, nunca por campanha. `registrarCampanha` (crm.ts) passa a gravar esta coluna nas
-- mensagens que ela mesma insere; a atribuição passa a devolver `campaignId` em cada item, e a
-- tela de campanhas agrupa por ele em vez de ler `campaigns.booked_count`/`revenue_cents`
-- (colunas que nunca tiveram escritor — continuam sem, de propósito).
--
-- `on delete set null`, não cascade: apagar uma campanha não pode apagar o HISTÓRICO de que a
-- mensagem foi enviada — só perde a atribuição fina por campanha, volta a contar só no agregado.
alter table messages add column campaign_id uuid references campaigns(id) on delete set null;

create index messages_campaign_id_idx on messages (campaign_id) where campaign_id is not null;
