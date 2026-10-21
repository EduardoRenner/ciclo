-- docs/112 EXP-S04 · as profissões de beleza feminina abrem a lista do cadastro.
--
-- A ordem é decisão do `docs/109` §5 (o feminino entra pela ordem) e está em
-- `docs/112-experiencia/04-salao.md` §7.1: Unhas, Cílios, Sobrancelhas, Cabelo, Depilação e
-- Estética, que a tela mostra abertas; Barbearia, Tatuagem e o resto vão para "Outras áreas".
-- Antes, Barbearia era a 3ª e Cabelo a 8ª. "Estética facial e corporal" vira "Estética": o nome
-- longo quebrava a linha na lista (os sinônimos "estética facial" e "esteticista" continuam).
--
-- Só dados. Pode subir antes do código: a tela antiga só passa a mostrar a ordem nova.

update professions as p
   set posicao = nova.posicao
  from (values
    ('nails', 1), ('lashes', 2), ('brows', 3), ('hair', 4), ('waxing', 5), ('aesthetics', 6),
    ('barber', 7), ('tattoo', 8)
  ) as nova(slug, posicao)
 where p.slug = nova.slug;

update professions set nome = 'Estética' where slug = 'aesthetics';
