-- CICLO · aceite versionado dos termos e da privacidade (BL-50)
--
-- ## O que faltava
--
-- `tenants.created_at` sempre deu o carimbo de "quando a conta nasceu" — a evidência mínima do
-- aceite pelo ato de contratar (decisão registrada em `termos/page.tsx`: sem checkbox). O que não
-- existia era a ligação entre esse carimbo e QUAL VERSÃO dos termos estava no ar naquele dia:
-- reconstruir exigia cruzar `created_at` com `git log` de `termos/page.tsx`, à mão.
--
-- O BL-50 dizia para esperar a terceira mudança de termos. Ela chegou: a cláusula de dados
-- agregados (docs/84, DECISOES 28/09) muda os termos de novo, e a partir dela "o que valia quando
-- esta conta assinou" passa a ter resposta diferente conforme a conta.
--
-- ## O desenho
--
-- Uma linha por aceite: quem, qual documento, qual versão, quando, por qual caminho. Append-only —
-- é prova, não estado: sem política de UPDATE nem DELETE, e com RLS forçada ausência de política é
-- negação (mesmo padrão de `product_events`, 0088, e `wallet_entries`, 0083). Quem grava é o
-- servidor no cadastro (`executarOnboarding`, com a chave de serviço); ninguém grava pela API.
--
-- `versao` é a data ISO em que o texto entrou no ar — a mesma constante que a página mostra
-- (`core/legal/versoes.ts`), para a prova e a página não divergirem.
--
-- ## O que NÃO faz: preencher o passado
--
-- Contas que já existem ficam sem linha. Não há como afirmar qual versão cada uma viu sem
-- reconstruir pelo git — e gravar uma versão deduzida como se fosse aceite registrado seria criar
-- prova que não existe. "Sem linha" quer dizer "anterior ao versionamento": `created_at` × histórico
-- da página, como sempre foi.
--
-- `user_id` com `on delete set null`: a pessoa pode ser apagada (LGPD, art. 18), e a prova de que
-- a CONTA aceitou aquela versão continua.

create table terms_acceptances (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  documento  text not null check (documento in ('termos', 'privacidade')),
  versao     text not null check (versao ~ '^\d{4}-\d{2}-\d{2}$'),
  via        text not null check (via in ('cadastro', 'reaceite')),
  aceito_em  timestamptz not null default now()
);

create index terms_acceptances_tenant_idx on terms_acceptances (tenant_id, documento, aceito_em);
create index terms_acceptances_user_idx on terms_acceptances (user_id);

alter table terms_acceptances enable row level security;
alter table terms_acceptances force row level security;

-- Só leitura, e só do próprio negócio. Escrita é do servidor, no cadastro.
create policy terms_acceptances_select on terms_acceptances
  for select using (public.has_tenant(tenant_id));

comment on table terms_acceptances is
  'Append-only: qual versão dos termos/privacidade cada conta aceitou, e quando. Versão = data ISO de core/legal/versoes.ts. Contas anteriores à 0095 não têm linha (não se inventa prova). Ver BL-50.';
