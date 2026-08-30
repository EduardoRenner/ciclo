-- A trilha e a chave de idempotência guardavam o dado pessoal que a eliminação apagava.
--
-- Achado da auditoria de 2026-08-28. `writeAudit` grava a linha INTEIRA da cliente em
-- `audit_log.after` (`client.create`) e em `before`+`after` (`client.update`) — nome, telefone,
-- e-mail, data de nascimento, CPF (`document`), endereço, `emergency_contact` (nome e telefone de
-- um TERCEIRO) e `preferences`. E `comIdempotencia` guarda a MESMA linha em
-- `idempotency_keys.response_body`, porque o corpo da resposta é a cliente.
--
-- `eliminarCliente` nunca tocou nenhuma das duas. O sistema respondia `anonymized: true`, a tela
-- dizia "Cliente eliminada", e o cadastro completo continuava legível em `audit_log` — que tem
-- política de leitura para `owner`, `manager` e `finance`.
--
-- Por que a guarda `lgpd-cobertura` não pegou: ela varre as migrations procurando tabela com
-- `references clients(id)` e coluna de tipo textual. `audit_log` não referencia `clients` (o
-- vínculo é `entity_id`, um uuid solto) e o dado mora em `jsonb`. `idempotency_keys` não
-- referencia nem `tenants`. As duas eram invisíveis para o detector — o ponto cego é o jsonb.
--
-- ## Por que uma função, e por que SÓ a chave de serviço a executa
--
-- Nem `audit_log` nem `idempotency_keys` têm política de UPDATE — de propósito: trilha que o
-- auditado escreve não é trilha. Então nem o cliente do usuário nem o `authenticated` conseguem
-- redigir nada por conta própria, e é assim que tem que continuar: uma `security definer` que
-- apaga trilha, concedida a `authenticated`, é a ferramenta perfeita para quem quer sumir com o
-- próprio rastro — e nenhuma checagem dentro dela compensa ter aberto a porta.
--
-- Por isso o `execute` é concedido **apenas a `service_role`**, e `eliminarCliente` chega até aqui
-- pelo `withTenant()`, o único lugar do código com a chave de serviço (regra 2). A autorização de
-- quem pode eliminar já foi feita antes, na rota: `client:delete` + AAL2 (segundo fator).
--
-- Dentro da função sobra a trava que não depende de quem chamou e vale para todos, inclusive para
-- a chave de serviço:
--
--   **a cliente já tem que estar eliminada (`anonymized_at is not null`).**
--
-- Não existe caminho para redigir a trilha de uma cliente ativa. Só se alcança esta função depois
-- de a eliminação ter acontecido, que é quando a lei manda.
--
-- ## Por que `response_body` vira um marcador e não `null`
--
-- Apagar a LINHA de `idempotency_keys` seria pior: uma repetição da fila offline com a mesma
-- chave voltaria a EXECUTAR a mutação — recriando a cliente que acabou de ser eliminada. E `null`
-- faria a repetição devolver `null` onde a API promete um objeto. O marcador mantém a chave
-- reservada, a repetição continua não reexecutando nada, e o corpo não carrega mais ninguém.

create or replace function public.redigir_trilha_do_cliente(p_tenant uuid, p_client uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  n_trilha bigint;
  n_chaves bigint;
  agulha   text;
begin
  if not exists (
    select 1 from public.clients
     where id = p_client and tenant_id = p_tenant and anonymized_at is not null
  ) then
    raise exception 'a trilha so e redigida depois da eliminacao da cliente';
  end if;

  agulha := '%' || p_client::text || '%';

  -- A linha da trilha SOBREVIVE (regra 11: nunca delete registro de auditoria). O que sai é o
  -- conteúdo pessoal — mesmo tratamento `redige` que `TRATAMENTO_NA_ELIMINACAO` já aplica em
  -- `appointments`, `messages` e `consents`. Quem, quando, de onde e qual ação continua tudo lá.
  --
  -- O `like` sobre o texto do jsonb pega os dois formatos de vínculo: a linha da própria cliente
  -- (`entity_id`) e o `client_id` que aparece dentro do corpo de um agendamento, de uma comanda
  -- ou de uma mensagem. É varredura, e é aceitável: eliminação é ato manual e raro.
  update public.audit_log
     set before = null,
         after  = null
   where tenant_id = p_tenant
     and (before is not null or after is not null)
     and (
       (entity = 'clients' and entity_id = p_client)
       or before::text like agulha
       or after::text  like agulha
     );
  get diagnostics n_trilha = row_count;

  update public.idempotency_keys
     set response_body = jsonb_build_object('eliminado', true)
   where tenant_id = p_tenant
     and response_body is not null
     and response_body::text like agulha;
  get diagnostics n_chaves = row_count;

  return jsonb_build_object('audit_log', n_trilha, 'idempotency_keys', n_chaves);
end
$fn$;

-- `revoke ... from public` tira o EXECUTE que toda função ganha de fábrica. `authenticated` sai
-- junto e não volta: quem está logado nunca chama isto diretamente.
revoke all on function public.redigir_trilha_do_cliente(uuid, uuid) from public, anon, authenticated;
grant execute on function public.redigir_trilha_do_cliente(uuid, uuid) to service_role;
