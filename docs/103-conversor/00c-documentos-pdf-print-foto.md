# 103 · 00c — Documento, PDF, print e foto no aparelho: estado da arte (13/10/2026)

Pesquisa de 13/10/2026. Versões, licenças e tamanhos vêm do registro npm, da API do Hugging Face e do
jsDelivr (tamanho "br" = transferido com compressão, medido com `curl`). [NÃO VERIFICADO] onde não
houve fonte primária.

## Conclusão
1. **PDF com texto, docx, tabela colada e `.txt` do WhatsApp:** 100% no navegador, determinístico,
   menos de 1 MB por formato.
2. **Print nítido:** tesseract.js 7 com `por` (≈ 2,5 MB) basta, com pré-processamento (ampliar 2–3×,
   inverter modo escuro) e revisão.
3. **Foto de papel impresso:** perspectiva + OCR + revisão. Se o tesseract não bastar no corpus, o
   salto é o PP-OCRv5 mobile via onnxruntime-web (≈ 20 MB e COOP/COEP).
4. **Manuscrito em português:** sem solução automática confiável nem na nuvem (Google Vision erra
   23,8% dos caracteres e 59,9% das palavras em redações brasileiras). O produto honesto é
   **digitação assistida linha a linha**.
5. **Modelos de visão no navegador** (Florence-2 ≈ 223 MB, granite-docling ≈ 206–264 MB): fora do alpha.

## 1. PDF com texto
| Lib | Versão | Licença | Tamanho | Nota |
|---|---|---|---|---|
| **pdfjs-dist** | 6.4.299 (03/10/2026) | Apache-2.0 | `pdf.min.mjs` 132 KB br + worker 380 KB br | `getTextContent()` dá texto com posição (`transform[4..5]`) |
| unpdf | 1.8.1 | MIT | 2,1 MB | pdf.js serverless; `extractTextItems()` com coordenadas |
| pdf-parse | 2.4.5 | Apache-2.0 | 21 MB | feito para Node |

Segurança: CVE-2024-4367 (CVSS 8,8, JS arbitrário a partir de PDF) afetava até 4.1.392, corrigido na
4.2.67 ([GHSA-wgrm-67xf-hhpq](https://github.com/advisories/GHSA-wgrm-67xf-hhpq)). PDF é entrada
hostil: sempre em Worker, versão atual.

Tabela de PDF: não há lib JS madura. Reproduzir o modo **stream** do Camelot sobre os `TextItem`:
agrupar palavras por linha (sobreposição em y), número de colunas pela moda, faixas x das colunas
pelas linhas típicas, atribuir cada palavra pela posição
([Camelot](https://camelot-py.readthedocs.io/en/latest/user/how-it-works.html),
[pdfplumber](https://github.com/jsvine/pdfplumber)).

## 2. OCR no navegador
- **tesseract.js 7.0.0** (Apache-2.0): core `simd-lstm` 1,04 MB br + `por` `4.0.0_best_int` 1,39 MB ≈
  **2,5 MB**, cache em IndexedDB. Não lê PDF. Posição só pedindo `blocks`. Memória do worker ≈ 164 MB.
  Regras: texto escuro em fundo claro (inverter modo escuro), ≈ 300 DPI (ampliar 2–3× o print), borda,
  `psm` 4/6/11, whitelist de dígitos no telefone
  ([ImproveQuality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html),
  [performance](https://github.com/naptha/tesseract.js/blob/master/docs/performance.md)).
  Velocidade em celular: **sem benchmark público, medir**.
- **PaddleOCR PP-OCRv5** (Apache-2.0): detector mobile 4,7 MB, reconhecedor latino 14 MB (84,7%).
  No navegador: `@paddleocr/paddleocr-js` 0.4.2 (exige COOP/COEP) ou `ffocr` 0.1.13 (MIT). Total
  ≈ 19–26 MB com onnxruntime-web 1.30.0 e OpenCV.js.
- ocrs 0.13.1 (preview, só latino); docTR (Apache-2.0) [NÃO VERIFICADO no navegador].
- Modelos de visão via transformers.js 4.3.1: Florence-2 ≈ 223 MB, granite-docling ≈ 206–264 MB,
  TrOCR-small ≈ 64 MB (inglês, uma linha), Qwen2-VL-2B ≈ 2,7 GB.
- WebGPU: Chrome Android 121+ (Android 12+, Qualcomm/ARM), Safari iOS 26; Firefox Android não
  ([status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)).
- Referência de qualidade (servidor, 0,9–1,2 bi de parâmetros): OmniDocBench v1.5 — PaddleOCR-VL-1.5
  94,50; MinerU2.5 90,67; dots.ocr 88,41 ([arXiv 2601.21957](https://arxiv.org/pdf/2601.21957)).
- `TextDetector` nativo: atrás de flag, não serve.

## 3. Tabela a partir do OCR
No aparelho: caixas de palavra do tesseract + o mesmo algoritmo stream. Print de app costuma ser
**lista**, não tabela: modo "registro por bloco" (linhas próximas, blocos separados por espaço
vertical, campos por regex: telefone, data, hora, R$). Table Transformer: repositório **arquivado em
21/09/2026**, ≈ 30 MB em ONNX. DocLayout-YOLO: código **AGPL-3.0**. Alpha: só heurística.

## 4. Manuscrito em português
Estudo UFRPE 2025 (22.927 linhas de 1.071 redações):
| Modelo | CER | WER |
|---|---|---|
| HTR-VT | 9,20% | 25,75% |
| StackMix | 11,72% | — |
| HTR-Flor | 14,10% | — |
| GCP Vision | 23,83% | 59,94% |
| AWS Textract | 36,19% | 81,38% |
| TrOCR | 50,64% | — |

([Dias, UFRPE](https://arandu.ufrpe.br/bitstreams/63211594-4bab-483e-9a69-94cb83fae757/download)).
Corpus possível: BRESSAY (ICDAR 2024, 30.090 linhas em pt-BR, [Zenodo](https://zenodo.org/records/11637681)).
**Recomendação:** digitação assistida — perspectiva, segmentar linhas, recorte de cada linha ao lado
dos campos, palpite marcado "confira", nunca gravado sem confirmação.

## 5. Pré-processamento e captura
OpenCV.js (`@techstark/opencv-js` 5.0.0-release.1) 3,5 MB br; **scanic 1.6.0** (MIT, Rust/WASM, 99 KB)
para perspectiva, jovem; binarização Otsu/Sauvola dentro do Tesseract 5. Captura:
`<input type="file" accept="image/*" capture="environment">`. [NÃO VERIFICADO: HEIC → JPEG no iOS]

## 6. Documentos e WhatsApp
- **docx:** mammoth 1.13.0 (BSD-2, 105 KB br) `convertToHtml` mantém tabelas, **não sanitiza**;
  fallback JSZip + `word/document.xml`.
- **odt:** JSZip 3.10.2 + `content.xml`, respeitar `table:number-columns-repeated`.
- **rtf:** rtf.js parado desde 2022 → pedir "salve como .docx ou PDF".
- **Tabela colada:** `clipboardData` `text/html` → DOMParser; TSV em `text/plain`.
- **WhatsApp `.txt`:** whatsapp-chat-parser 4.0.2 (MIT) cobre Android (`dd/mm/aaaa hh:mm - Autor:`)
  e iOS (`[dd/mm/aaaa, hh:mm:ss] Autor:`), LRM/RLM, anexos. Extrair autor e telefones do texto
  (libphonenumber-js 1.13.15). `.vcf`: FN e TEL (RFC 6350), vcard4 4.0.5 ou parser próprio.

## 7. Document AI de mercado (referência, não usar com dado de cliente)
Google Document AI (OCR US$ 1,50/mil páginas; Form US$ 30), AWS Textract (texto US$ 1,50; tables
US$ 15; forms US$ 50), Azure (≈ US$ 1,50–30) [NÃO VERIFICADO na fonte oficial], Mindee (€0,035–0,05/pág.),
Reducto (US$ 0,01–0,015/pág.), LlamaParse (créditos), Unstructured (Apache, Python), Docling (MIT,
Python; JSON de blocos tipados com coordenadas), Marker (pesos com limite de receita), MinerU (licença
própria, 0,8–3 GB). **Copiar:** blocos tipados com coordenadas, confiança por campo, dois modos de
tabela (lattice/stream), baixa confiança → revisão humana, página e caixa de origem de cada valor.

## 8. Privacidade e cache
OCR em nuvem: provedor vira suboperador e há transferência internacional (Res. CD/ANPD 19/2024;
cláusulas-padrão desde 23/08/2025) → parecer jurídico antes. OCR local: a imagem não sai; **hospedar o
modelo no próprio domínio** evita expor uso a CDN. Cache: IndexedDB/Cache/OPFS dividem a cota; Safari
apaga dados de script após 7 dias sem interação → mostrar "baixando leitor de texto (2,5 MB)" sempre
que faltar ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).

## 9. Métricas
CER/WER por Levenshtein; corpus sintético de **prints falsos de app de agenda** (HTML/Canvas, nomes
com acento, `(11) 9xxxx-xxxx`, R$, claro e escuro) e fotos (rotação, perspectiva, blur, ruído, sombra);
acerto exato de nome com acento; telefone **dígito a dígito** e a **taxa de erro silencioso** (passa no
validador mas está errado) — o pior defeito; confusões 0/O, 1/l/I, 5/S, 8/B; conjunto-ouro de 30–50
imagens reais com consentimento; tempo de `createWorker` × `recognize` e memória num celular barato.

## Pilha por entrada
| Entrada | Pilha | Download |
|---|---|---|
| Print nítido | Canvas (ampliar, cinza, inverter) → tesseract.js 7 `por` `blocks` → agrupar por y/x → regex → revisão | ≈ 2,5 MB |
| Foto de impresso | `capture` → scanic (perspectiva) → tesseract.js → revisão; PP-OCRv5 só se o CER pedir | ≈ 2,6 MB (PP-OCRv5 ≈ 20 MB + COOP/COEP) |
| Manuscrito | perspectiva + linhas → digitação assistida | ≈ 0,1 MB |
| PDF com texto | pdfjs-dist 6.4.299 em Worker → stream próprio | ≈ 0,5 MB |
| PDF escaneado | página sem texto → render ≈ 300 DPI → trilha de foto; limitar páginas | ≈ 3 MB |
| docx | mammoth 1.13.0 → DOMParser (sanitizar) | ≈ 105 KB |
| odt | JSZip + `content.xml` | ≈ 100 KB |
| Tabela colada | `text/html` → DOMParser; TSV | 0 |
| WhatsApp `.txt` (+zip/.vcf) | whatsapp-chat-parser + JSZip + vCard + libphonenumber-js | ≈ 325 KB |

## Fora do alpha
Manuscrito automático; modelos de visão no navegador; Table Transformer (arquivado) e DocLayout-YOLO
(AGPL); RTF; PP-OCRv5 por padrão; OCR/IA na nuvem até parecer; qualquer biblioteca AGPL
(scribe.js, mupdf, webodf) — **guarda de licença no CI**.

## Riscos
1. Dígito trocado em telefone que continua "válido" → confirmação obrigatória.
2. Memória em celular barato (≈ 164 MB do worker) → um worker, imagem reduzida, página a página.
3. Modo escuro e fonte pequena derrubam o OCR sem inverter e ampliar.
4. COOP/COEP quebra iframes de terceiros → rota própria se adotar.
5. Cache volátil → download volta; hospedar modelo no próprio domínio.
6. PDF/docx hostis → Worker, versão atual, sanitizar HTML.
7. Formato do WhatsApp muda com idioma e versão → contar linhas não reconhecidas.
8. Licenças AGPL e pesos com limite de receita → guarda de licença.
9. Benchmark de laboratório não prevê o print do AppBarber → só o corpus próprio decide.
