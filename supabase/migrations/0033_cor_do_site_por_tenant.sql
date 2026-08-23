-- docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T3 + §7). Causa raiz do "layout roxo que volta":
-- `vertical_packs.accent_color` fixava a cor do site público POR PROFISSÃO, e duas das seis
-- entradas eram roxo puro (cílios #a855f7, sobrancelhas #8b5cf6) — o purple-500 que o
-- redesign de 08-REDESIGN-E-IDENTIDADE.md Parte II tirou do resto do produto em 2026-08-19,
-- mas nunca tirou daqui. A cor do site passa a ser escolha do dono do salão
-- (`tenants.settings.site.accent`, editável em /admin/config/negocio); sem escolha, o site
-- nasce osso (`#f0ebe3`), nunca herda cor de nicho.
--
-- `accent_color` deixa de ser NOT NULL e os seis valores atuais são zerados — a coluna NÃO é
-- removida nesta migration (só depois que o plano de docs/13 §10 estiver todo verde), porque
-- `vertical_packs` continua sendo lido para semear serviço/produto e reverter é mais barato
-- com a coluna ainda de pé.
--
-- Idempotente: rodar duas vezes dá o mesmo resultado (a coluna já nula fica nula; o `update`
-- sem `where` não depende do valor anterior). Reversível: os seis valores originais estão
-- registrados abaixo para o rollback ser copiar e colar.
--
-- ROLLBACK, se um dia for preciso desfazer:
--   update vertical_packs set accent_color = case vertical
--     when 'lashes'     then '#a855f7'
--     when 'nails'      then '#ec4899'
--     when 'barber'     then '#f59e0b'
--     when 'brows'      then '#8b5cf6'
--     when 'aesthetics' then '#10b981'
--     when 'waxing'     then '#f97316'
--   end;
--   alter table vertical_packs alter column accent_color set not null;

alter table vertical_packs alter column accent_color drop not null;

update vertical_packs set accent_color = null;
