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

| CNV-018b | baef7275 | PDF escaneado: cada página vira imagem (OffscreenCanvas no Worker) e passa no mesmo OCR, teto de 10 páginas |
| CNV-019 | 7bc08e99 | 0128: `import_batches` (RLS forçada, sem DELETE, mesmo arquivo não abre dois lotes vivos) + `clients.import_batch_id/import_row` únicos |
| CNV-020 | d274dc81 + teste | `POST /api/v1/imports` e `/imports/{id}/rows`: pedaços de 500, idempotente pela linha (D5), contagem do banco e "concluído" só no último (D6), alcance `own` recusado |
| CNV-022 | bba5886b | 0129 `desfazer_lote_de_importacao` + `/undo`: tira o que ninguém usou, mantém o usado e diz quantas; 7 dias, uma vez |

**Ondas A, B e C concluídas; Onda D com o servidor pronto.** 0128 e 0129 aplicadas só no banco LOCAL. Pendente de prova no navegador (junto com a tela nova, CNV-023, a 390 px): o Worker, o OCR baixando de `/ocr` e o cartão "Tudo do seu negócio".

| CNV-021 | 90c0f43b | `previaDoDinheiro`: o R$ parado antes de gravar, pela mesma conta que a Hoje soma (paridade em integração) |
| CNV-023 | 8ffc17dc + 8439190a | tela nova `importar/esteira.tsx` (substitui a de CSV); escolha de tabela quando há mais de uma |
| CNV-024 | 8c3a91a7 | funil em `product_events` (aberta, retomada, concluída, desfeita) |
| Onda E | 10a143f6 | linha em branco no meio da lista partia a tabela e sumia com quem vinha depois (achado ao provar D2/D4/D12/D14) |
| CNV-025 | a934b2f5 | importação antiga por CSV aposentada (D2, D4, D12, D14 provados ausentes na esteira; D20, D21 morreram com a tela) |
| D8–D10 | c53c1fef | "já atendo": repetido na lista, telefone inválido avisado, `.in()` em fatias (D9 confirmado real pela mutação) |
| D19 | 7217a479 | assinante e pacote lidos só da leva, em fatias |
| D7 | 22e343e6 | runbook de importação assistida reescrito para a tela nova |

D13 (data futura) ficou sem efeito: o leitor antigo não tem mais chamador e a esteira já barra data no futuro.

**Ondas A–E concluídas.** Pendente: prova LOGADA no navegador da tela nova (o classificador barrou
criar sessão de teste no navegador; precisa do Eduardo).

## Funil da importação (CNV-024)

Eventos em `product_events`, sem dado de pessoa: `importacao_aberta` (origem, formato, nível, pessoas),
`importacao_retomada`, `importacao_concluida` (origem, formato, fichas), `importacao_desfeita`.
Taxa de conclusão por origem:

```sql
select meta->>'origem' as origem,
       count(*) filter (where event_type = 'importacao_aberta')    as abertas,
       count(*) filter (where event_type = 'importacao_concluida') as concluidas,
       round(100.0 * count(*) filter (where event_type = 'importacao_concluida')
             / nullif(count(*) filter (where event_type = 'importacao_aberta'), 0), 1) as taxa
from product_events
where event_type in ('importacao_aberta', 'importacao_concluida')
group by 1 order by 2 desc;
```

Ainda não medido: "abriu a tela" e "viu a prévia" (precisam de evento do navegador; não há rota
genérica de evento, e a prévia mora toda no aparelho).

## Próximos
Onda G primeiro (CNV-041 receitas por origem, CNV-042 páginas `/migrar/*`): é o que transforma a
esteira em argumento de venda. Onda F (histórico como atendimentos, serviços, estoque, agenda,
pacotes) mexe em dinheiro e agenda e pede revisão antes de começar.
