-- =====================================================================
-- CICLO · TICKET-061 · Os 4 eixos como colunas em tenants (P2, parte 1)
--
-- docs/09-PLATAFORMA.md §4: toda profissão de serviço é um ponto num espaço
-- de 4 eixos (onde/cobranca/inicio/ritmo). Já existem como colunas em
-- `professions` (migration 0022) — aqui é a cópia editável por tenant, que
-- §3.3 já previa e ficou de fora do P0 por escopo. Cada tenant nasce com os
-- valores da profissão escolhida e pode ajustar depois (ex.: um eletricista
-- que decide aceitar agendamento direto para clientes recorrentes).
--
-- Nullable e não destrutiva: tenant sem `profession_id` (nenhum hoje, depois
-- do backfill de P0) fica com os 4 eixos em null, sem afetar nada — não há
-- leitura destas colunas em lugar nenhum do app ainda.
--
-- Achado ao escrever esta migration, registrado em docs/DECISOES.md: o app
-- HOJE não tem nenhum caminho de confirmação automática — todo agendamento
-- nasce pending e só sai daí quando a cliente confirma pelo link (redução
-- de falta) ou a equipe confirma no painel. `professions.inicio = 'direto'`
-- nas 8 verticais de beleza é vocabulário PARA QUANDO esse modo existir, não
-- descrição do que já acontece — não é bug, mas precisava estar escrito.
-- =====================================================================
alter table tenants add column onde text check (onde in ('no_local','vai_ate','remoto','hibrido'));
alter table tenants add column cobranca text check (cobranca in ('fixo','hora','visita_hora','diaria','orcamento','pacote','recorrente'));
alter table tenants add column inicio text check (inicio in ('direto','solicitacao','orcamento_antes'));
alter table tenants add column ritmo text check (ritmo in ('avulso','recorrente','sazonal','sob_demanda'));

update tenants t
set onde = p.onde, cobranca = p.cobranca, inicio = p.inicio, ritmo = p.ritmo
from professions p
where t.profession_id = p.id
  and t.onde is null;
