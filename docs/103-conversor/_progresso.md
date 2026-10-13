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
| CNV-004 | 82bc8a71 + 8bbe5779 | E4 perfil + E5 classificação pelo conteúdo, com confiança; D14 e D21 |
| CNV-005 | 7fe53baf | E6 normalização no core (telefone sem biblioteca com paridade, nome, e-mail com sugestão, data com serial do Excel e futuro barrado, dinheiro em centavos); D2, D12, D13 |
| CNV-006 | 64a5b939 | E7 junção (telefone compartilhado não junta; homônimo não some; D11) |
| CNV-007 | 40f72e7b | `processarGrade`: caixas, perguntas, nível N0–N3, controle de totais, planilha anotada; invariante lança erro |
| CNV-008 | db4a659f | corpus de 48 variações com gabarito: falso-aceite 0, perda 0, CPF/alergia nunca em ficha; achou e consertou 3 defeitos |

**Onda A (núcleo) concluída.**

## Próximos
Onda B: CNV-009 (exportação da conta inteira), CNV-010 (escape e telefone no Excel), CNV-011 (cota e LGPD). Depois Onda C (formatos).
