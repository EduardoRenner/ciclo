-- Busca de cliente que perdoa acento.
--
-- Medido em produção (30/08/2026), na base de teste: "Otávio" acha, "Otavio" **não acha nada**.
-- Mesma coisa para "Joao", "Vinicius", "Sergio" — 4 de 8 buscas falhavam, e são justamente as
-- que a pessoa digita de verdade: ninguém põe acento com pressa, no celular, com a cliente na
-- frente. `ilike` do Postgres é case-insensitive mas NÃO é accent-insensitive.
--
-- Desenho, e por que não é RPC: `unaccent()` é STABLE (depende do dicionário), então não pode
-- ir direto num índice de expressão. O caminho canônico é um wrapper IMMUTABLE — mas em vez de
-- usá-lo no PATH DE QUERY (que obrigaria RPC, porque `supabase-js` não aplica função no lado da
-- coluna), ele materializa uma coluna GERADA. O termo digitado é normalizado em JS
-- (`core/text/normalizar.ts`), a coluna já está normalizada no banco, e a comparação volta a ser
-- um `ilike` simples — que é o que o `supabase-js` sabe fazer e o que o trigram indexa bem.
--
-- Aditivo: nenhuma coluna some, nenhum dado muda, e `clients_name_trgm` continua onde estava
-- (ainda serve busca com acento digitado corretamente).

create extension if not exists unaccent;

-- `unaccent(regdictionary, text)` é a forma que aceita ser marcada IMMUTABLE: fixamos o
-- dicionário, então o resultado passa a depender só da entrada. Marcar o `unaccent(text)` de
-- uma coluna gerada sem isso faz o Postgres recusar a coluna.
create or replace function imutavel_sem_acento(texto text)
returns text
language sql
immutable
strict
parallel safe
as $$ select lower(unaccent('unaccent'::regdictionary, texto)) $$;

alter table clients
  add column if not exists name_busca text
  generated always as (imutavel_sem_acento(name)) stored;

-- Mesmo tipo de índice do `clients_name_trgm`: GIN trigram, que é o que faz `%termo%` não virar
-- varredura completa a cada letra digitada.
create index if not exists clients_name_busca_trgm on clients using gin (name_busca gin_trgm_ops);
