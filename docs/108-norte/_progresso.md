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
| 16/10 | Integração e RLS no Supabase isolado (`sb-norte`, 574xx) | RLS 361/361; integração 641 + 1 pulado; teste de disponibilidade que dependia do seed reescrito | PR #152 |
| 16/10 | Runbook das migrations 0118 a 0141 | 19 antes do deploy, 3 depois (0127, 0135, 0139) | `docs/runbooks/lote-0118-a-0141.md` |
| 16/10 | Teste de 10 minutos medido a 390 px nos 4 nichos | Caminho inteiro em ~12 s de máquina; serviço errado em 3 nichos achado e consertado; sem rolagem lateral | `04-teste-10-minutos-medido.md`, PR #152 |
| 16/10 | Docker local | Socket quebrado de novo; pasta `run` renomeada (`run.quebrado-20261016-1930`) e Docker reaberto | memória `docker-socket-af-unix-quebrado` |

## Próximos (ao meu alcance, sem produção)

1. Ler a CI do #152 quando o app avisar; consertar o que for da integração.
2. Atualizar o corpo do PR #152 com os commits novos (disponibilidade, serviço de volta).
3. Nada mais de código até o alpha, salvo o que o campo pedir (congelamento).

## Do Eduardo (não faço)

SMTP · revisar e mesclar · canal de contato · senhas das demonstrações · lista do alpha · cidade do piloto · advogado para desconhecidos.
