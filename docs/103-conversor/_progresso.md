# 103 · Progresso do conversor universal

| Fase | Estado | Entregável |
|---|---|---|
| 0 · Pesquisa | CONCLUÍDA (13/10) | `00-pesquisa.md`, `00a-estado-atual.md` (23 defeitos), `00b-mercado.md`, `00c-documentos-pdf-print-foto.md` |
| 1 · Plano | CONCLUÍDO (13/10) | `01-plano-e-tickets.md` (CNV-004 a CNV-043, ondas A–G) |
| 2 · Execução | EM CURSO na branch `conversor/esteira-universal` (sobre `aprimoramento/onda-u2`, sem PR até a base entrar) | |

## Tickets feitos
| Ticket | Commit | O quê |
|---|---|---|
| CNV-000 | e163def8 | prompt-contrato `docs/103-PROMPT-CONVERSOR-UNIVERSAL.md` |
| CNV-001 | 7d21d8a3 | E0–E2: formato pelos bytes (planilha, documento, PDF, imagem, vCard, JSON, texto; recusa programa, macro, senha), codificação (UTF-16, Windows-1252, "JoÃ£o"); `decodificarTexto` delega |
| CNV-002 | ab2ff29e | D1: telefone sem DDD não ganha DDD inventado |
| CNV-003 | 132130de | E1 delimitado próprio + E3 achar a tabela (título, filtro, total, rodapé, grupo, cabeçalho repetido, duas tabelas) |

## Próximos
CNV-004 (perfil e classificação), CNV-005, CNV-006, CNV-007, CNV-008 (corpus) → Onda B (exportação).
