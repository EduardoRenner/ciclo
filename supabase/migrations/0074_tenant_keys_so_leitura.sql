-- CICLO · `tenant_keys` deixa de aceitar escrita de qualquer membro do tenant
--
-- ## O buraco
--
-- Desde a `0001`, `tenant_keys` entra no laço de 25 tabelas (`0001:688-709`) que recebem uma
-- política única: `for all using (has_tenant(tenant_id))`. `has_tenant` (`0001:627`) só pergunta
-- "é membro ativo deste tenant?" — não olha papel. Somado à `0038`, que dá
-- `select, insert, update, delete on all tables` a `authenticated`, e ao fato de a anon key ser
-- `NEXT_PUBLIC_*`, qualquer membro do tenant (inclusive `professional` e `reception`) podia
-- chamar a REST API do Supabase DIRETAMENTE, com o próprio JWT, e executar:
--
--     DELETE FROM tenant_keys WHERE tenant_id = '<o meu>'
--
-- `tenant_keys.dek_wrapped` é a DEK do tenant embrulhada pela KEK da aplicação. É a única cópia:
-- a DEK em claro só existe em memória, dentro do cache de `crypto/vault.ts`. Apagar essa linha
-- transforma TODA anamnese do estabelecimento em ciphertext ilegível — permanentemente, sem
-- caminho de recuperação, porque não há de onde reconstruir a chave.
--
-- O risco aqui é DESTRUIÇÃO, não vazamento: ler `dek_wrapped` sozinho não decifra nada, já que a
-- KEK vive na variável de ambiente `VAULT_KEK` e nunca sai do servidor.
--
-- ## Por que o SELECT fica, e por que isso não é meia-correção
--
-- A rota do cofre (`api/v1/clients/[id]/vault/route.ts:29`) monta o cliente com
-- `criarClienteDoUsuario()`, NÃO com `service_role`. Daí `abrirFicha` → `decryptVault` →
-- `dekDoTenant` (`crypto/vault.ts:64`) lê `tenant_keys` com o JWT do usuário, passando pela RLS.
-- Derrubar o `select` junto com as escritas quebraria o cofre em produção, e o sintoma apareceria
-- como falha de criptografia — longe da causa.
--
-- Ler a linha não é o risco (ver acima). Escrever é. Então a política de leitura permanece
-- exatamente como estava, e só as três escritas saem.
--
-- ## Por que remover as escritas não quebra nada
--
-- Levantado antes de escrever esta migration, um chamador por vez:
--
--   · INSERT — só `services/onboarding.ts:130`, e usa `svc` (service_role), que ignora RLS.
--   · UPDATE — só `scripts/rotacionar-kek.mjs:138`, também com `svc`.
--   · DELETE — nenhum chamador legítimo em todo o repositório. A linha morre por cascade
--     quando o tenant é apagado (`references tenants(id) on delete cascade`, `0001:84`), e
--     cascade não consulta política de DELETE da tabela filha.
--
-- Nenhum caminho de produto perde capacidade. O que sai é só a porta lateral.
--
-- ## A forma da correção
--
-- Sem política de INSERT/UPDATE/DELETE, a RLS nega por padrão — é isso que fecha a porta.
-- Deixar as três políticas escritas como `using (false)` diria a mesma coisa em três linhas a
-- mais, e daria a impressão errada de que existe um caso em que passariam.

drop policy if exists tenant_keys_tenant_all on tenant_keys;

-- Único acesso que sobra para `authenticated`. Mesma régua de antes: membro ativo do tenant.
-- Quem escreve é `service_role`, que não passa por aqui.
create policy tenant_keys_select on tenant_keys for select
  using (public.has_tenant(tenant_id));

comment on table tenant_keys is
  'DEK do tenant embrulhada pela KEK da aplicacao. Leitura: membro ativo (o cofre le com o cliente do usuario, ver crypto/vault.ts). Escrita: SO service_role -- apagar esta linha torna toda anamnese ilegivel para sempre, e nenhum fluxo de produto escreve aqui pela chave anonima.';
