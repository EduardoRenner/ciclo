# C-020 · Ambiente: o Docker volta, e o que estava sem prova de banco é provado

**F1 · Objetivo:** cinco tickets da fundação automotiva (AUT-101..105), a prova no navegador e a
integração do C-015 dependiam do banco local, fora do ar desde o começo do C-007. Número: suítes de
banco rodando, e quanto do trabalho dos ciclos C-007..C-019 passa nelas.

**F2 · Diagnóstico:** `backend.error.json` = o mesmo socket AF_UNIX velho da memória
("docker-socket-af-unix-quebrado"), primeiro em `Docker\run\sailor-ingest.sock` e, depois de renomear,
em `docker-secrets-engine\engine.sock`.

**F3/F4:** matar os processos do Docker, renomear as duas pastas (`run.quebrado-20261014-1044`,
`docker-secrets-engine.quebrado-20261014-1047`), apagar o `backend.error.json` velho, reabrir. Motor no ar
em ~12 s (29.7.2). `npx supabase start`: volumes reaproveitados, migrations até a 0131 aplicadas.
`.env.local` conferido: aponta para o banco local.

**F5 · Medida:**
- Integração do ciclo e da fila de recuperar (3 suítes, 36 testes): verdes, nenhum pulado.
- C-015 provado contra o banco: caso novo grava `sample_size` 2 (dois intervalos) e 0 (uma visita), e a
  fila devolve o ritmo com a amostra. Mutação: sem o escritor, "esperado 2, veio 0".
- **RLS inteira:** 15 arquivos, 349 testes, verde.
- **Integração inteira:** 620 passaram, 1 pulado, **4 falharam** (comanda, 2 em saúde, resumo da central
  de ações), todas com o mesmo erro genérico de gravação ("Algo deu errado do nosso lado") saindo de
  `adicionarItemComanda`, `registrarHeartbeat` e `criarCliente`, com 429 de limite de taxa no mesmo log.
  Os 3 arquivos, rodados isolados: 35 de 35 verdes. Nenhum desses serviços mudou desde o C-007. Leitura:
  intermitência da suíte de banco sob carga (memória "suíte de banco intermitente por rate limit"),
  não regressão desta sessão. **Não chamo de verde:** a suíte inteira não passou de uma vez.

**Nota:** cliente 5 · segredo 3 · engenharia 9. **Próximo (C-021):** com o banco no ar, a fundação
automotiva começa: AUT-101 (o sujeito no banco: `subjects` + RLS + teste de isolamento, desenho do
EXP-001 no C-003) com revisão adversarial própria; e a prova do cartão da fila no navegador a 390 px.
