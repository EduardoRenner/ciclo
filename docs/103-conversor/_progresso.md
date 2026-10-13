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

| CNV-009a/010 | 9ab1dd70 | núcleo da exportação: 13 recursos, dialeto aberto + datapackage.json (Data Package v2) e dialeto Excel (BOM, `;`, telefone nacional — D16), fórmula neutralizada com TAB e desfeita na volta (D17); ida e volta pela esteira |
| CNV-009b | a25feb94 | `GET /api/v1/account/export` (.zip com fflate 0.8.3), dono + duas etapas + auditoria, 1 por dia gasto depois do arquivo; cartão na tela de exportar |
| CNV-011 | 9c9cf170 | exportação por cliente completa (notas, pontos, clube, créditos, comandas, pagamentos) e sempre auditada (D18); D15 na exportação antiga |

**Onda A (núcleo) e Onda B (saída completa) concluídas.** Pendente de prova no navegador: o cartão "Tudo do seu negócio" (verificar no próximo build, a 390 px).

## Próximos
Onda C (formatos): CNV-012 Worker, CNV-013 planilhas (SheetJS 0.20.3 vendorizado), CNV-014 contatos, CNV-015 WhatsApp, CNV-016 documentos, CNV-017 PDF, CNV-018 print e foto. Depois Onda D (prévia com R$, carga em lotes, tela nova).
