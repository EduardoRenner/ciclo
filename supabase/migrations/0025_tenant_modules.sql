-- =====================================================================
-- CICLO · TICKET-064 · Módulos por tenant (P3, camada de dado)
--
-- docs/09-PLATAFORMA.md §6: nem todo negócio precisa de anamnese, clube de
-- assinatura ou estoque. Duas fontes de verdade combinadas: PLANO (o que a
-- assinatura libera) e ESCOLHA DO DONO (o que ele quer ver) — `origem`
-- registra qual delas decidiu, pra a tela poder explicar "bloqueado pelo
-- plano" vs "você desligou".
--
-- Escopo desta migration é só a tabela — nenhuma tela lê ainda (mesma
-- disciplina de P0/P2: schema primeiro, comportamento depois, sem duas
-- decisões arriscadas na mesma migration). "Modo solo" (esconder interface
-- de equipe quando o tenant tem 1 profissional) é mecanismo DIFERENTE —
-- deriva de `professionals.length`, não é módulo, não precisa de linha
-- aqui, e já foi corrigido em 2 telas nesta mesma sessão (TICKET-064).
-- =====================================================================
create table tenant_modules (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  modulo     text not null,
  ligado     boolean not null,
  origem     text not null check (origem in ('plano', 'dono')),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, modulo)
);

alter table tenant_modules enable row level security;
alter table tenant_modules force row level security;

-- mesmo padrão de settings/professionals: dono e gerente enxergam e mexem,
-- porque é configuração do negócio, não dado operacional do dia a dia.
create policy tenant_modules_tenant_all on tenant_modules for all
  using (has_tenant(tenant_id))
  with check (has_tenant(tenant_id));
