# Runbook · pacote Advocacia (docs/101 T6.4)

> Para quem opera o CICLO quando o pacote Advocacia estiver aberto. Hoje (`ADVOCACIA_ABERTA = false`)
> só existe o escritório-modelo fictício, e nada aqui foi exercitado em produção.

## 1. Publicar o pacote (ordem que não quebra nada)

1. **Migrations antes do código** (memória `migration-que-tira-privilegio-inverte-a-ordem`): 0102 a 0113
   são aditivas (tabelas, funções, políticas novas), então sobem ANTES do deploy. Conferir que a 0101
   da branch da fila já está aplicada; a numeração do pacote começa na 0102 por causa dela.
   Aplicar pelo `docs/runbooks/aplicar-migrations-pendentes.md`. Depois, `/api/health` sem "schema atrás".
2. **TOTP ligado no projeto Supabase** (Authentication → MFA → TOTP enroll e verify). O pacote exige
   segundo fator em toda tela e rota; sem TOTP, ninguém entra.
3. **Deploy do código.** Com a chave fechada, nenhuma conta real escolhe o pacote.
4. **Abrir** (`src/core/pacotes/advocacia-aberta.ts` → `true`) só depois do checklist "pode entrar dado
   real" (relatório de verificação, §5) inteiro verde e da revisão do dossiê (`docs/101-dossie-advogado.md`).
   Registrar em `docs/DECISOES.md` quem decidiu e quando.

## 2. Captura de intimações

- Rota: `GET /api/cron/legal-intimacoes` com `Authorization: Bearer $CRON_SECRET`. Uma vez por dia útil,
  de manhã (o DJEN publica de madrugada). Agendar no cron-job.org como as outras
  (`docs/runbooks/cron-externo.md`) e acrescentar `legal-intimacoes` em `ROTAS_AGENDADAS`
  (`src/core/cron/agendadas.ts`) no mesmo commit: só então o `/api/health` passa a vigiar o heartbeat.
- Escritório de demonstração é pulado de propósito: a OAB fictícia existe no DJEN.
- **Captura parada** (faixa em Hoje para a direção, ou Configurações → Escritório mostrando "Conferir"):
  1. ver `legal_intimation_sync.detalhe` do dia (http, rede, timeout, formato, "gravadas X de Y");
  2. `http`/`timeout`: o DJEN caiu; a próxima rodada refaz o dia sozinha (até 31 dias para trás);
  3. `formato`: a API mudou o JSON. Não "consertar" o dado: ajustar `normalizarResposta`/
     `normalizarComunicacao` com teste e rodar a rota de novo;
  4. "gravadas X de Y" com itens `de_outro_alvo`: o DJEN ignorou o filtro da OAB; nada foi gravado
     a mais (o que não é do alvo não entra). Avisar o escritório para conferir em comunica.pje.jus.br.
- Mais de 31 dias parado: o produto marca lacuna. O escritório precisa conferir o intervalo à mão.

## 3. Prazo errado (o incidente que mais importa)

1. Não apagar nada (não há como: prazo não tem DELETE). Corrigir a data pela tela, **com motivo**:
   o histórico (`legal_deadline_changes`) guarda antes, depois, quem e por quê.
2. Se a data veio de sugestão: ler `calc_memo` do prazo e a `calc_rule_version`. A divergência entre o
   sugerido e o confirmado já fica em `calc_divergence`.
3. Se o erro é de regra (não de leitura do texto): desconfirmar a regra em Configurações → Escritório,
   o que faz toda sugestão nova vir sem data, e abrir correção com teste no núcleo
   (`src/core/advocacia/prazo-calculo.ts`, casos de referência calculados à mão antes).

## 4. Suspeita de acesso indevido

- Trilha de leitura sensível: `legal_access_log` (documento aberto, caso sigiloso aberto, intimação
  aberta), só leitura pelo servidor. Consulta pelo SQL do projeto, filtrando `tenant_id`.
- Trilha de escrita: `audit_log` (ações `legal_*`), sem texto de caso nem de intimação (redigido).
- Revogar acesso: tirar a pessoa da equipe do caso (`legal_case_members`) ou desativar a membership;
  vale na próxima requisição (o papel é relido a cada ação).

## 5. Restauração

- O banco do CICLO usa o backup do Supabase (PITR conforme o plano contratado). Os arquivos do bucket
  `legal-docs` **não** entram no PITR do banco: restaurar o banco para trás deixa versões apontando para
  arquivos que ainda existem (bom) e nunca o contrário, porque versão nunca sobrescreve arquivo.
- **Exercício de restauração: ainda não feito.** É item do checklist "pode entrar dado real".

## 6. Escritório-modelo (demonstração)

- Gerar ou refazer: `SEED_SENHA='...' node scripts/seed-demo-escritorio.mjs` (só roda contra banco local).
- O teste `tests/integration/demo-escritorio-sanidade.test.ts` roda o gerador e mede o agregado; se ele
  reprovar, a demo está mostrando algo que nenhum escritório real teria.
