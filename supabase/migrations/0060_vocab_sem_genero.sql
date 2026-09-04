-- O `vocab` das profissoes (0022/0026) existe para o produto falar a lingua de cada uma. Duas das
-- seis chaves nomeiam PESSOA -- `profissional` (quem usa o produto) e `cliente` -- e nove valores
-- vinham so no masculino: barbeiro, tatuador, fotografo, jardineiro, professor, psicologo,
-- tecnico, aluno, tutor.
--
-- Aplicar isso faria o produto chamar a barbeira de "barbeiro" e a aluna de "aluno", que e o T8 do
-- docs/20 e o defeito que `copy-nao-supoe-genero` existe para impedir. E aquela guarda NAO pegaria:
-- ela varre TypeScript, e estes valores moram em seed SQL, entao a palavra nunca aparece no fonte.
-- A guarda foi estendida junto com esta migration.
--
-- Onde existe palavra neutra de verdade, ela entra e o sentido se mantem (estudante, terapeuta,
-- artista, docente, responsavel). Onde nao existe -- barbeiro, fotografo, jardineiro, tecnico --
-- cai no padrao "profissional": generico e correto vale mais que especifico e errado. Nada de
-- barra nem parenteses, que o docs/20 ja vetou.
update professions set vocab = jsonb_set(vocab, '{profissional}', '"profissional"')
  where vocab->>'profissional' in ('barbeiro', 'fotógrafo', 'jardineiro', 'técnico');

update professions set vocab = jsonb_set(vocab, '{profissional}', '"artista"')
  where vocab->>'profissional' = 'tatuador';

update professions set vocab = jsonb_set(vocab, '{profissional}', '"terapeuta"')
  where vocab->>'profissional' = 'psicólogo';

update professions set vocab = jsonb_set(vocab, '{profissional}', '"docente"')
  where vocab->>'profissional' = 'professor';

update professions set vocab = jsonb_set(vocab, '{cliente}', '"estudante"')
  where vocab->>'cliente' = 'aluno';

-- Pet shop: quem leva o animal e o "responsavel", que e o termo corrente e e neutro.
update professions set vocab = jsonb_set(vocab, '{cliente}', '"responsável"')
  where vocab->>'cliente' = 'tutor';
