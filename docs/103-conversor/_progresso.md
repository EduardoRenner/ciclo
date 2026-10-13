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

| CNV-012 | 9174efbd | a esteira de um arquivo num Web Worker (`rodarEsteira`), mesma função no worker e na janela; leitor de JSON/NDJSON |
| CNV-014 | a02df268 | contatos do celular (.vcf 2.1/3.0/4.0) |
| CNV-015 | 9723e5db | conversa exportada do WhatsApp vira lista de pessoas; lista esparsa não some |
| CNV-016 | dd4e3a71 | tabela colada (HTML), Word (.docx), LibreOffice (.odt/.ods) e zip (um nível, teto antes de inflar) |
| CNV-013 | 25c4a16e | .xlsx com leitor próprio (OOXML, só valores; sem SheetJS, ver DECISOES) |
| CNV-017 | a67ee185 | PDF com texto (pdf.js 6, tabela por posição das palavras) |
| CNV-014b | 95e09218 | lista livre (uma pessoa por linha) vira tabela; E3 mais firme |
| CNV-018 | acdef820 | print e foto por OCR NO APARELHO (tesseract.js 7 + português, servidos de `/ocr`); modo escuro invertido; tudo de imagem para conferir, nível ≤ N1; imagem truncada não derruba mais o processo |

**Ondas A, B e C concluídas.** Pendente de prova no navegador (junto com a tela nova, CNV-023, a 390 px): o Worker, o OCR baixando de `/ocr` e o cartão "Tudo do seu negócio".

## Próximos
CNV-018b PDF escaneado (renderizar página e passar no OCR). Onda D: CNV-019 lotes de importação (migration), 020 carga em lotes, 021 prévia com R$, 022 desfazer, 023 tela nova sobre `rodarEsteira`, 024 funil.
