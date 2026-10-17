# 103 · 01 — Plano e tickets do conversor universal (13/10/2026)

Base: `00-pesquisa.md` (decisões P1–P15), `00a-estado-atual.md` (lacunas e defeitos D1–D23),
`00b-mercado.md` (posicionamento e funil), `00c-documentos-pdf-print-foto.md` (pilha por entrada),
`docs/97-PLANO-CONVERSOR-DE-DADOS.md` (estações E0–E11, níveis N0–N3).

## Princípios que todo ticket respeita
1. **Nunca errado e calado.** Toda linha lida sai em ouro, ouro com aviso, pergunta, quarentena ou
   ignorada, com motivo. Invariante testada: `lidas = ouro + aviso + quarentena + ignoradas`.
2. **Uma grade, um caminho.** Todo formato vira grade de células (ou registros) e entra no mesmo E3 →
   E9. Leitor novo só escreve "bytes → grade".
3. **No aparelho.** O arquivo cru não sobe; o servidor recebe linhas normalizadas em lotes e revalida com
   Zod. OCR e leitores rodam num Web Worker.
4. **O R$ vem antes do botão** (diferencial nº 1 do mercado), calculado pelo mesmo `computeCycle` que
   grava, marcado como estimativa quando faltar histórico.
5. **Importados sem consentimento de marketing**, sem disparo automático, sem caixa/comissão/estoque.
6. **Exportar é tão fácil quanto importar**, no mesmo formato (ida e volta testada).

## Ordem e por quê
| Onda | Conteúdo | Por que nesta ordem |
|---|---|---|
| **A · Núcleo** | E0–E8 puros no core + corpus | tudo depende deles; sem biblioteca; mede falso-aceite desde o dia 1 |
| **B · Saída completa** | exportação da conta em `.zip` aberto, versão Excel, escape OWASP, ida e volta | barata, prova o formato canônico, é argumento de confiança ("seus dados são seus") e conserta D15–D18 |
| **C · Formatos** | Worker, planilhas, contatos, texto colado, WhatsApp, documentos, PDF, print e foto | "qualquer coisa entra" |
| **D · Prévia, valor e carga** | `import_batches`, carga em lotes idempotente, prévia com R$, desfazer, nova tela, funil | o "aha" e a segurança da escrita |
| **E · Defeitos do importador atual** | D2, D4–D14, D19–D21 | o que roda hoje continua certo enquanto a nova tela não substitui |
| **F · Histórico e entidades** | N2/N3, serviços, produtos, agenda futura, pacotes e saldos (com revisão) | dinheiro e agenda: depois de a esteira provar qualidade |
| **G · Aprendizado e mercado** | assinaturas de sistema (k-anonimato), receitas por origem, páginas `/migrar/*` | escala e aquisição |

Feitos: **CNV-000** (prompt), **CNV-001** (E0–E2), **CNV-002** (D1, telefone sem DDD), **CNV-003** (E1
delimitado + E3).

---

## Onda A · Núcleo da esteira (`src/core/ingestao/`)

### CNV-004 · Perfilar e classificar as colunas pelo conteúdo (E4 + E5)
**Problema:** o chute atual é "a primeira coluna cujo nome contém" (`importador.tsx:103-111`, D21);
"Nome do profissional" vira nome da cliente e "Total de atendimentos" vira data.
**Proposta:** `perfilarColunas(tabela)` (fração de telefone, e-mail, data e formato, dinheiro, nome
próprio, documento, categoria de poucos valores, vazio, cardinalidade) e `classificarCampos(perfis,
cabecalho)` com quatro sinais (conteúdo pesa mais que o nome, dicionário PT/EN/ES com sinônimos e
Jaro-Winkler, vizinhança) e **restrições da tabela inteira** (um nome, um telefone principal, uma coluna
não é duas coisas). Saída: campo canônico + confiança (≥ 0,9 segue; 0,6–0,9 sugere; < 0,6 pergunta ou
ignora). Detecta o **grão** (telefone repetido = uma linha por atendimento), **CPF** (descartado,
minimização) e **saúde** (alergia, medicamento, gestante… → fora, com aviso).
**Aceite:** corpus (CNV-008) com acerto de coluna ≥ 95% e **falso-aceite = 0**; "Nome do profissional"
ao lado de "Cliente" não vira nome; "Alergias" nunca vira etiqueta (D14).
**Teste:** unitário + corpus; mutação no peso do conteúdo reprova.

### CNV-005 · Normalizar no core (E6)
**Proposta:** nome (sem estragar "da Silva", "McDonald"; caixa só quando tudo maiúsculo ou minúsculo),
e-mail com **sugestão** para domínio errado (`gmial.com`, nunca troca calado) e validação (D12), data
(dd/mm × mm/dd pela distribuição; serial do Excel 1900/1904; **futuro vai para quarentena**, D13),
dinheiro em centavos (`R$ 1.234,56`, `80`, `80,5`), telefone puro no core (dígitos nacionais, DDD do
salão perguntado uma vez, nono dígito marcado como "corrigido", vários telefones na célula → celular
primeiro, D2) com a decisão de liberar `libphonenumber-js/max` no core registrada em DECISOES.
**Aceite:** tabela de casos com o resultado esperado e o aviso de cada correção.

### CNV-006 · Juntar a mesma pessoa (E7)
**Proposta:** Jaro-Winkler e metaphoneBR portados; Fellegi-Sunter simplificado (bloqueio por telefone,
e-mail, fonético + nascimento); junta sozinho **só** com telefone ou e-mail exato; faixa do meio vira
pergunta; **nomes muito diferentes no mesmo telefone = telefone compartilhado, não junta**; homônimo com
telefone diferente não some (D11). Nunca sobrescreve preenchido com vazio.
**Aceite:** casos "Ana / Aninha mesmo telefone" (pergunta ou compartilhado), "Maria Silva × 2 sem
telefone" (não junta), "mesmo e-mail com caixa diferente" (junta).

### CNV-007 · Validar, separar em caixas e conferir totais (E8)
**Proposta:** expectativas declarativas nomeadas ("telefone com 10 ou 11 dígitos", "data não está no
futuro", "nome não vazio"); cada linha com destino e motivo em código; **controle de totais** (quantos o
sistema antigo mostra × quantos lidos); **planilha anotada** (a original com "situação" e "motivo"), no
formato que a esteira relê como correção do mesmo lote.
**Aceite:** a invariante fecha em todo arquivo do corpus; a planilha anotada reimportada só traz as
corrigidas.

### CNV-008 · Corpus sintético e métricas
**Proposta:** gerador em `tests/fixtures/ingestao/` com gabarito (título e filtros no topo, cabeçalho na
linha 4, `;` + Windows-1252, datas em número, telefone em 6 formatos, uma linha por atendimento, agrupado
por profissional, total no rodapé, Google/Outlook/Trinks/AppBarber-like); métricas (acerto de coluna,
F1 por campo, taxa de pergunta, quarentena, falso-aceite); **propriedades** (embaralhar colunas, trocar
separador e codificação, inserir título não muda o resultado); **portão no CI** com piso.
**Aceite:** falso-aceite = 0; mutação em qualquer classificador reprova o corpus.

## Onda B · Saída completa

### CNV-009 · Exportar a conta inteira, aberta e reimportável
**Problema:** só existe CSV de 4 colunas de clientes e JSON por cliente; não há exportação da conta.
**Proposta:** `src/core/exportacao/` puro: monta recursos (clientes completos, serviços e preços,
profissionais, agendamentos, comandas e itens, pacotes, carteira, fidelidade, produtos, estoque) em CSV
UTF-8 sem BOM com `,` + `datapackage.json` (Data Package v2) + `LEIA-ME.txt`; versão "Para abrir no
Excel" (BOM, `;`, telefone em formato nacional). `.zip` com `fflate`. Rota `GET` com `client:export` +
AAL2, auditada; saúde **fora** (continua no JSON por cliente com AAL2).
**Aceite:** zip validado contra o schema do Data Package; ida e volta (exportar → importar em conta
vazia → mesmas contagens e campos).

### CNV-010 · Escape de fórmula completo e telefone que o Excel não estraga (D16, D17)
**Proposta:** escape OWASP (`= + - @`, TAB, CR, LF, largura cheia) só em coluna de texto, neutralizado
de forma que a reimportação devolva o valor original; telefone em formato nacional na versão Excel.
**Aceite:** `-Ana` exporta e volta `-Ana`; `＝1+1` neutralizado; telefone abre como texto.

### CNV-011 · Cota de exportação só depois do arquivo pronto, e LGPD completa (D15, D18)
**Aceite:** erro no meio não gasta a cota do mês; exportação por cliente inclui notas, fidelidade,
clube, carteira e comandas, e sempre deixa trilha.

## Onda C · Formatos ("qualquer coisa entra")

### CNV-012 · Web Worker da esteira
`new Worker(new URL(...), import.meta.url)` literal, sob demanda, `ArrayBuffer` transferido, progresso e
cancelamento. **Aceite:** roda no navegador com a CSP atual (prova no navegador); a esteira roda igual no
Worker e no servidor (paridade no corpus).

### CNV-013 · Planilhas `.xlsx`, `.xls`, `.ods` (todas as abas)
SheetJS CE 0.20.3 vendorizado com SHA-256 conferido; guarda que reprova se o lockfile tiver `xlsx` do
npm; células mescladas e linhas ocultas reportadas; serial de data; fórmula vira o valor, nunca avaliada;
limite de tamanho e de expansão antes de ler. **Aceite:** corpus de planilhas; arquivo-bomba recusado.

### CNV-014 · Contatos: `.vcf`, Google Contatos, Outlook, texto colado unificado
Parser de vCard (2.1 QP, 3.0, 4.0) no core; sinônimos de Google novo e antigo e Outlook EN/PT; o
"já atendo" passa a usar o mesmo E6/E7 (conserta D8, D10, D11). **Aceite:** 40 contatos de um `.vcf` de
Android e de iPhone viram clientes com telefone normalizado e sem duplicata, a 390 px.

### CNV-015 · Conversa exportada do WhatsApp (`.txt` e `.zip`)
Parser próprio (Android e iOS, pt-BR, LRM/RLM) ou `whatsapp-chat-parser` 4.0.2; extrai participantes,
telefones no texto e `.vcf` anexos; linhas não reconhecidas contadas. **Aceite:** amostras sintéticas dos
dois formatos.

### CNV-016 · JSON, NDJSON, HTML colado, `.docx`, `.odt`
JSON/NDJSON e HTML (DOMParser) próprios; `.docx` via mammoth 1.13.0 (HTML sanitizado, nunca no DOM) ou
JSZip + `document.xml`; `.odt` via `content.xml` respeitando `number-columns-repeated`; `.rtf` → pede
`.docx`/PDF. **Aceite:** tabela de cada formato vira a mesma grade.

### CNV-017 · PDF com texto (e escaneado → OCR)
pdfjs-dist 6.4.299 no Worker; algoritmo **stream** (linhas por y, colunas pela moda, faixas x); página
sem texto vai para o CNV-018. **Aceite:** relatório PDF sintético de outro sistema vira a mesma tabela do
CSV equivalente.

### CNV-018 · Print de tela e foto (OCR no aparelho, com revisão)
tesseract.js 7 + `por` hospedados no próprio domínio, sob demanda, com aviso de download (≈ 2,5 MB);
pré-processamento (ampliar 2–3×, cinza, **inverter modo escuro**); caixas de palavra → linhas →
"registro por bloco" (lista de app) ou stream (tabela); **toda linha vai para revisão** com o recorte ao
lado; **telefone conferido dígito a dígito** e travado até confirmar; nunca N3. Manuscrito = **digitação
assistida**. **Aceite:** corpus de prints sintéticos (claro e escuro) com CER por campo e **erro
silencioso de telefone = 0 gravado sem confirmação**; tempo e memória medidos num celular médio.

## Onda D · Prévia, valor e carga

### CNV-019 · Lote de importação no banco (migration aditiva)
`import_batches` (hash do arquivo, origem, nível, contagens, versão da declaração, estado, quem) com RLS
+ `force` + política + isolamento; `clients.import_batch_id`; `import_signatures` global sem dado de
pessoa (Onda G). Arquivo bruto nunca persistido.

### CNV-020 · Carga em lotes, idempotente, auditada (E10)
`POST /api/v1/imports/{id}/rows` (JSON, ≈ 500 linhas, `Idempotency-Key` por lote, Zod, erro por linha,
`writeAudit` dentro, rota em `ROTAS_DE_ESCRITA`, sem caixa/comissão/estoque, ciclo enfileirado em
`job_queue` com `dedupe_key`). Conserta D5 e D6. **Aceite:** o mesmo arquivo duas vezes não duplica
nada (nem sem telefone); falha no meio não deixa "falhou" com dado gravado.

### CNV-021 · Prévia "entendi assim", com o R$ antes do botão (E9)
Cinco linhas "como veio → como vai ficar", no máximo três perguntas com a resposta provável marcada,
ajuste do retângulo da tabela, edição em massa, nível N0–N3 e o que falta para subir, **"84 sumiram, ≈
R$ X/mês parado, estes 10 primeiro"** (estimativa marcada quando não há histórico), declaração (texto do
advogado pendente). **Aceite:** o R$ da prévia é igual ao que a Hoje mostra depois de gravar.

### CNV-022 · Desfazer a importação por 7 dias
Por `import_batch_id`: remove o que o lote criou e não foi tocado depois, devolve o que alterou;
compensação, nunca apagar auditoria. Decisão registrada para `clients` criados pelo lote.

### CNV-023 · A nova tela de importar (substitui a de CSV)
Um lugar só para arquivo, colar texto, contatos, print e foto; continua no computador por link/QR;
quarentena baixável; resultado com o valor. Prova a 390 px e alvos de 48 px.

### CNV-024 · Funil instrumentado (GO-0)
Eventos sem dado pessoal: abriu, escolheu origem/tipo, prévia vista, perguntas, concluiu, desfez,
exportou. **Aceite:** taxa de conclusão por origem calculável.

## Onda E · Defeitos do importador atual (enquanto a nova tela não substitui)
CNV-025 D2 (dois telefones na célula) · CNV-026 D4 (`;;;` não é erro) · CNV-027 D7 (runbook) · CNV-028
D8/D9/D10 ("já atendo": duplicado no lote, `.in` em lotes, telefone inválido avisado) · CNV-029 D12/D13
(e-mail e data futura) · CNV-030 D14 (etiqueta não leva saúde) · CNV-031 D19 (leituras paginadas) ·
CNV-032 D20 (413 da Vercel com JSON) · CNV-033 D21 (chute de coluna, até a troca da tela).

## Onda F · Histórico e entidades (revisão antes de começar: dinheiro e agenda)
CNV-034 N2/N3: visitas importadas como atendimentos **marcados como importados** (sem caixa, comissão,
estoque), ritmo real por cliente · CNV-035 serviços e preços · CNV-036 produtos e estoque inicial ·
CNV-037 agenda futura com aviso de horário em dobro · CNV-038 pacotes e saldos (só com revisão linha a
linha) · CNV-039 retroteste ("se o CICLO existisse em março…").

## Onda G · Aprendizado e mercado
CNV-040 assinaturas de sistema (E11, k-anonimato ≥ 3 contas) · CNV-041 receitas por origem (AppBarber,
Belasis, BarbUp, Trinks, Salão99) com fixtures e a mensagem pronta para pedir o arquivo · CNV-042 páginas
`/migrar/*` com a tabela pública "o que vem / o que não vem" e as headlines do `00b` · CNV-043 modelo no
aparelho (opcional, depois das camadas medidas).

## Pendências do Eduardo (não bloqueiam)
Texto da declaração (advogado); saúde direto para o cofre; modo assistido com arquivo enviado; IA/OCR de
terceiros; relógio do teste começando no 1º R$ (recomendação 10 do `00b`).
