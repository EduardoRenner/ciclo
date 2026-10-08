# T4.2-T4.5 · mutações da decisão de intimação (2026-10-08)

Commit a21b39b8 antes de mutar. A função foi lida do banco (`pg_get_functiondef`), alterada e recriada;
ao fim a 0112 foi reaplicada e conferida em `pg_proc` (as duas checagens de alcance presentes), e a suíte
voltou a 7 de 7.

| Mutação na `legal_intimacao_decidir` | Resultado |
|---|---|
| papel `reception` aceito | `legal-intimacao-decidir` reprovou (secretaria decidiu) |
| só a checagem de alcance da intimação já vinculada removida | **passou**: a função checa o alcance de novo no caso (`v_caso := coalesce(informado, vinculado)`). Defesa em dobro, não guarda cega |
| as duas checagens de alcance removidas | reprovou (outra advocacia decidiu intimação de caso sigiloso) |
