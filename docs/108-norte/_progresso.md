# 108 · Progresso do norte

Uma linha por passo. É o primeiro arquivo a ler depois de um resumo de contexto.

| Data | Passo | Estado | Onde |
| --- | --- | --- | --- |
| 16/10 | Decisão de uma página | Feita | `00-decisao.md`; linha em `docs/DECISOES.md` |
| 16/10 | Plano dos 60 dias | Feito | `01-plano-60-dias.md`; plano do AppBarber marcado "frente passiva" |
| 16/10 | Kit de campo (roteiro, ficha, abordagem, decisão do nicho) | Feito | `02-kit-de-campo.md`, `ficha-de-campo.csv` |
| 16/10 | Mapa da pilha e conflitos medidos | Feito | `03-guia-da-pilha.md` |
| 16/10 | Branch de integração `integracao/norte-2026-10-16` (onda-1 + #149 + #151) | Conflitos resolvidos; typecheck, lint e unidade 4.419/4.419 verdes; integração e RLS na CI | PR #152 em rascunho (https://github.com/EduardoRenner/ciclo/pull/152) |
| 16/10 | Consertos achados na integração | Guarda `toda-rota-passa-pelo-rota` aceita `rota<Ctx>(`; venda de balcão do #149 respeita `own` e usa `fetchComTentativa`; mutações reprovam | PR #152 |
| 16/10 | Jornada corrigida: link de confirmação já resolvido na `onda-1` (APR-026) | Feito; falta colar os modelos de e-mail no painel (Eduardo) | `jornada-do-dono.md`, `00-decisao.md` §6 |
| 16/10 | Docker local | Socket quebrado de novo; pasta `run` renomeada (`run.quebrado-20261016-1930`) e Docker reaberto | memória `docker-socket-af-unix-quebrado` |

## Próximos (ao meu alcance, sem produção)

1. Integração e RLS num Supabase local isolado (`sb-norte`, portas 574xx, já montado no scratchpad), além da CI do PR #152.
2. Ler a CI do #152 quando o app avisar; consertar o que for da integração.
3. `docs/runbooks/lote-0118-a-0141.md`: cada migration classificada (aditiva antes do deploy, restritiva depois), no formato do runbook de 0092 a 0098.
4. Medir o teste de 10 minutos no navegador, a 390 px, nos 4 nichos (cílios, sobrancelha, unhas, barbeiro), numa conta nova do Supabase local, e consertar o que travar.

## Do Eduardo (não faço)

SMTP · revisar e mesclar · canal de contato · senhas das demonstrações · lista do alpha · cidade do piloto · advogado para desconhecidos.
