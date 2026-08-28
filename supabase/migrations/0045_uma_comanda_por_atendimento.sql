-- Uma comanda por atendimento.
--
-- `concluirAgendamento` (src/server/services/agendamentos.ts) faz select-then-insert: procura a
-- comanda do agendamento e cria se não achar. O comentário no código chamava isso de "idempotente
-- por appointment_id", e a linha seguinte já dizia a verdade — "que não tem índice único ainda".
-- Sem o índice, select-then-insert não é idempotente: é uma corrida. Dois toques simultâneos em
-- "concluir" criavam DUAS comandas para o mesmo atendimento, e o sintoma só aparece depois, quando
-- `buscarTicketIdPorAgendamento` faz `.maybeSingle()` sobre duas linhas e o link "Ver comanda" da
-- agenda passa a devolver erro para sempre naquele atendimento.
--
-- A corrida em si foi fechada no código, com a transição de estado virando compare-and-swap
-- (`.eq('status', atual.status)` dentro do próprio UPDATE). Este índice é a segunda camada: ele
-- vale para qualquer caminho futuro que insira em `tickets`, inclusive um que ninguém lembrou de
-- proteger.
--
-- Parcial (`where appointment_id is not null`) porque comanda de balcão — venda sem agendamento —
-- é caso normal e nasce com `appointment_id` nulo. Em Postgres, nulos não colidem entre si num
-- índice único, mas o `where` deixa a intenção escrita e mantém o índice menor.

do $$
declare
  duplicados bigint;
begin
  select count(*) into duplicados
  from (
    select appointment_id
    from public.tickets
    where appointment_id is not null
    group by appointment_id
    having count(*) > 1
  ) d;

  -- Falha alto e explica. Criar o índice direto daria um erro de constraint sem contexto, e
  -- "resolver" apagando comanda é proibido pela regra 11 (nunca delete comanda, agendamento ou
  -- movimento de estoque) — a saída é decidir qual linha continua ligada ao atendimento.
  if duplicados > 0 then
    raise exception
      'Há % agendamento(s) com mais de uma comanda. O índice único não pode ser criado sobre esse dado. Liste com: select appointment_id, count(*) from tickets where appointment_id is not null group by 1 having count(*) > 1; e, para cada caso, escolha qual comanda fica com o atendimento (as outras ficam com appointment_id nulo — não apague nenhuma).',
      duplicados;
  end if;
end $$;

create unique index if not exists tickets_um_por_agendamento
  on public.tickets (appointment_id)
  where appointment_id is not null;
