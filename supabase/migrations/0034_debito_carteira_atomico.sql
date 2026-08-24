-- Auditoria de segurança de 2026-08-23, achado S11 (ALTO).
--
-- `debitarCarteira` era ler-decidir-escrever em três idas de rede separadas: somava
-- `wallet_entries`, comparava com o valor pedido num `if` do JavaScript, e inseria o lançamento
-- negativo. Nada no banco impedia a soma de ficar negativa — a regra "não pode ficar devendo"
-- existia só naquele `if`.
--
-- Cinco `POST /api/v1/wallet/debit` em paralelo, cada um com `Idempotency-Key` próprio (a
-- idempotência não ajuda: ela deduplica chamadas IGUAIS, e estas são cinco operações
-- declaradamente distintas), liam o mesmo saldo, passavam todas pelo `if` e inseriam todas.
-- R$ 100 de crédito pagavam R$ 500 em serviço, e o rombo aparecia na tela como "cliente deve",
-- indistinguível de um lançamento manual. Nem precisa de má-fé: a fila offline do PWA drena
-- mutações em paralelo quando a rede volta.
--
-- ## Por que `security invoker` (o padrão), e não `security definer`
--
-- A regra da casa desde a 0004 é que função `security definer` que ESCREVE precisa de
-- `revoke execute from anon, authenticated`, senão o PostgREST a publica em `/rest/v1/rpc/` e
-- `anon` escreve por cima da RLS. Aqui a função não precisa de privilégio nenhum além do de
-- quem chama: a rota usa o cliente do usuário (`criarClienteDoUsuario`), então rodando como
-- invoker a RLS de `wallet_entries` e de `clients` continua valendo inteira, e quem é de outro
-- tenant não enxerga linha nenhuma para somar nem consegue inserir (`with check`). É a opção
-- mais restritiva, não a mais conveniente.
--
-- ## Por que travar a linha de `clients`, e não as de `wallet_entries`
--
-- `select ... for update` sobre as linhas do extrato trava o que JÁ existe — e não impede um
-- INSERT concorrente. Em READ COMMITTED, a segunda transação destravaria e continuaria sem
-- enxergar a linha que a primeira acabou de inserir (fantasma), que é exatamente a corrida que
-- se quer fechar. A linha de `clients` existe sempre e é uma só: travá-la serializa todo débito
-- daquela cliente, e o `sum` que vem depois é um comando novo, com snapshot novo, que já enxerga
-- o lançamento anterior.
create or replace function public.debitar_carteira(
  p_tenant  uuid,
  p_client  uuid,
  p_valor   bigint,
  p_reason  text,
  p_source  uuid default null
)
returns bigint
language plpgsql
volatile
set search_path = public
as $$
declare
  v_saldo bigint;
begin
  if p_valor <= 0 then
    raise exception 'valor de débito precisa ser positivo' using errcode = '22023'; -- invalid_parameter_value
  end if;

  -- Serializa os débitos desta cliente. A RLS de `clients` (`has_tenant`) decide se a linha
  -- sequer é visível: de outro tenant, não trava nada porque não acha nada.
  perform 1 from public.clients
   where id = p_client and tenant_id = p_tenant
     for update;

  if not found then
    raise exception 'cliente não encontrada neste estabelecimento' using errcode = 'P0002'; -- no_data_found
  end if;

  select coalesce(sum(amount_cents), 0) into v_saldo
    from public.wallet_entries
   where tenant_id = p_tenant and client_id = p_client;

  if v_saldo < p_valor then
    -- SQLSTATE cravado em vez de nome de condição: `insufficient_resources` e `no_data_found`
    -- têm código diferente do que a intuição sugere (`P0002`, não `02000`), e o serviço compara
    -- pelo `code` que o PostgREST devolve. Distinguir por errcode, e não pelo texto, é o que
    -- deixa a mensagem em pt-BR mudar sem quebrar o tratamento.
    raise exception 'saldo insuficiente' using errcode = '53000'; -- insufficient_resources
  end if;

  insert into public.wallet_entries (tenant_id, client_id, amount_cents, reason, source_id)
  values (p_tenant, p_client, -p_valor, p_reason, p_source);

  return v_saldo - p_valor;
end;
$$;

comment on function public.debitar_carteira(uuid, uuid, bigint, text, uuid) is
  'Débito de carteira atômico (auditoria S11). Trava a linha da cliente, confere o saldo e insere o lançamento na mesma transação.';

-- Privilégio mínimo. Sendo `security invoker`, `anon` chamando não consegue nada — a RLS de
-- `clients` não deixa nem travar a linha. Ainda assim, o PostgREST publica toda função de
-- `public` em `/rest/v1/rpc/`, e um endpoint que só sabe responder "não achei" a quem não tem
-- sessão é superfície sem contrapartida. Só quem tem sessão debita carteira.
revoke execute on function public.debitar_carteira(uuid, uuid, bigint, text, uuid) from public, anon;
grant  execute on function public.debitar_carteira(uuid, uuid, bigint, text, uuid) to authenticated, service_role;
