-- =====================================================================
-- CICLO · o dado de saúde sai do alcance do JWT de usuário (migration 0077)
--
-- Unidade 10 da auditoria de 2026-09-08.
--
-- ## O buraco
--
-- `health_records` guarda a anamnese cifrada (`ciphertext`/`iv`/`auth_tag`) e,
-- em CLARO, o par `has_alert` + `alert_label` — o rótulo curto ("Alergia a
-- látex", "Gestante"), que a `0001` deixou em claro de propósito para o cartão
-- do próximo atendimento não precisar decifrar nada.
--
-- A tabela tinha só a política genérica `health_records_tenant_all`, de
-- `for all using (has_tenant(tenant_id))`. Qualquer papel do tenant — recepção
-- inclusive — que chame a REST API do Supabase com o próprio JWT lia
-- `alert_label` E o `ciphertext` de qualquer cliente do salão.
--
-- É a mesma classe da `0073` (financeiro de um profissional vazando para
-- outro), com uma diferença que pesa: aqui é dado de saúde, categoria especial
-- na LGPD. E a rota `/vault`, que é a porta oficial do mesmo dado, exige TRÊS
-- coisas — `exigirPermissao('vault:own')`, `exigirAal2()` e registro em
-- `vault_access_log`. A porta lateral não exigia nenhuma.
--
-- ## Por que privilégio por COLUNA, e não política por papel
--
-- A recepção PRECISA do booleano: é o que a faz avisar quem atende antes de o
-- atendimento começar (`appointment-row.tsx`: "nunca o rótulo clínico, só o
-- sinal"). Uma política de SELECT por papel, no formato da `0073`, é
-- row-level: ela tiraria a linha inteira e a recepção perderia o sinal junto
-- com o rótulo. O conserto de privacidade viraria um apagão de segurança do
-- atendimento — e o `docs/20` já registra que o conserto pode ser pior que o
-- defeito.
--
-- Privilégio por coluna corta na medida exata: a linha continua legível, as
-- colunas sensíveis não. É o que a auditoria propôs, com estas palavras
-- ("provável privilégio por coluna com grant select (has_alert)").
--
-- ## Por que isto não quebra o cofre
--
-- Papel de banco não é papel do produto: `owner`, `manager` e `reception` são
-- todos `authenticated` para o Postgres, então o grant não sabe distingui-los.
-- Quem distingue é o app, e ele já distinguia — o que faltava era a segunda
-- camada embaixo.
--
-- As leituras privilegiadas passam a ir por `withTenant` (service_role, que
-- não é afetado por grant de `authenticated`): `abrirFicha` na rota `/vault` e
-- `rotuloDoAlerta` na ficha do cliente. As duas conferem permissão ANTES, na
-- rota e na página. Continua valendo a regra de duas camadas do CLAUDE.md: a
-- permissão decide, o grant impede a porta lateral.
--
-- `anon` entra junto por higiene. A RLS já o barra (`has_tenant()` não tem
-- `auth.uid()` para responder), mas grant que não serve a ninguém é grant que
-- só espera um descuido de política para virar vazamento.
-- =====================================================================

revoke select on public.health_records from anon, authenticated;

-- Tudo menos `ciphertext`, `iv`, `auth_tag` e `alert_label`. A lista é
-- explícita, e não "todas menos": coluna NOVA nasce sem privilégio, que é o
-- lado seguro de errar. Se um dia entrar uma coluna que a equipe precisa ler
-- direto, o erro será visível na hora — melhor que uma coluna sensível nascer
-- legível porque ninguém lembrou de tirá-la.
grant select (
  id,
  tenant_id,
  client_id,
  form_key,
  key_version,
  has_alert,
  filled_by,
  created_at,
  updated_at
) on public.health_records to anon, authenticated;
