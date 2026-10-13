# 103 · 00 — Pesquisa técnica: ler qualquer arquivo e devolver tudo (13/10/2026)

Os documentos da Fase 0:
- `00a-estado-atual.md`: o que existe hoje, as lacunas e 23 defeitos.
- `00b-mercado.md`: o mercado, o posicionamento e as métricas do funil.
- `00c-documentos-pdf-print-foto.md`: documento, PDF, print e foto no aparelho.
- **Este** documento: planilha, CSV, codificação, telefone, contatos, junção de registros, Web Worker,
  exportação e LGPD.

Medições feitas em 13/10/2026 no npm registry, com esbuild 0.25.10 e `npm audit`, marcadas **[medido]**.
O app usa Next 15.5.27 com webpack (`next dev` sem turbopack), `papaparse ^5.6.0`,
`libphonenumber-js ^1.13.11` e CSP `worker-src 'self'` (`src/middleware.ts:163`).

## Decisões

| # | Tema | Decisão |
|---|---|---|
| P1 | `.xlsx` / `.xls` / `.ods` | **SheetJS CE 0.20.3**, do tarball oficial, vendorizado em `vendor/xlsx-0.20.3.tgz` (SHA-256 `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`). Carregado só no Worker. **Proibido o `xlsx` do npm** (0.18.5, com CVE-2023-30533 e CVE-2024-22363 sem conserto lá), com guarda no lockfile e `overrides` |
| P2 | CSV | Leitor RFC 4180 próprio no core (CNV-003). Papa Parse 5.7.0 continua no importador antigo, nunca com `worker:true` |
| P3 | Codificação | Cascata própria (CNV-001): BOM → UTF-16 → UTF-8 estrito → Windows-1252, mais o conserto de "JoÃ£o". Troca manual na prévia. jschardet não (691 KB gzip) |
| P4 | Telefone | `libphonenumber-js` 1.13.15 com metadata `/max` no Worker (a `min` não dá o tipo). Regras próprias antes: sem DDD não inventa (CNV-002), DDD do salão perguntado uma vez e marcado na linha, nono dígito em celular de 10 dígitos com primeiro dígito local de 6 a 9 (marcado como "corrigido"). Fixo ou tipo diferente de celular vai para revisão quando o destino é WhatsApp |
| P5 | vCard | Parser próprio no core: 2.1 com quoted-printable e CHARSET, 3.0 e 4.0, linha dobrada, `FN`/`N`/`TEL`/`EMAIL`/`BDAY`/`NOTE`, ignora `PHOTO` |
| P6 | Contatos em CSV | Sinônimos de cabeçalho: Google novo (`Phone N - Value`), Google antigo (`Phone 1 - Type`, `E-mail 1 - Value`), Outlook em inglês e em pt-BR (cabeçalho segue o idioma), Trinks |
| P7 | Mapeamento | Dicionário PT/EN/ES + Jaro-Winkler no cabeçalho + perfil do conteúdo. Sem IA |
| P8 | Junção de registros | Jaro-Winkler e Levenshtein próprios no core; Fellegi-Sunter simplificado (peso `log2(m/u)` por campo); bloqueio por telefone, e-mail e fonético + nascimento; junção automática só com telefone ou e-mail exato; faixa do meio vira pergunta; **nunca junta só por nome** |
| P9 | Fonética | Portar as regras do metaphoneBR do Ipea (MIT, preserva a vogal final) |
| P10 | Worker | `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })` **literal**, criado sob demanda num componente cliente, `ArrayBuffer` transferido, `terminate()` no fim. Testar com a CSP no navegador antes de mudar para turbopack ou Next 16 (bootstrap por `blob:` seria bloqueado) |
| P11 | Servidor | Recebe lotes de linhas já normalizadas (≈ 500), `Idempotency-Key` por lote, revalida com Zod e devolve erro por linha |
| P12 | Relatório de erros | A planilha original com as colunas "situação" e "motivo", gerada no navegador |
| P13 | Exportação | `fflate` 0.8.3 (4,6 KB gzip) para o `.zip`. Data Package v2: `datapackage.json` + CSV UTF-8 **sem** BOM com `,` (o padrão aberto). Variante "Para abrir no Excel": BOM e `;`, ou `.xlsx` pelo SheetJS |
| P14 | Fórmula em CSV | Escape OWASP completo: `=`, `+`, `-`, `@`, TAB, CR, LF e as versões de largura cheia (`＝＋－＠`); só em colunas de texto. O prefixo `'` "not reliable" depois que o Excel salva: neutralizar com TAB dentro do campo entre aspas. Telefone na versão Excel em formato nacional, `(11) 98765-4321`, porque o `+` é lido como fórmula (defeito D16) |
| P15 | LGPD | Exportação completa em autosserviço para o salão (controlador); exportação por cliente para o pedido do titular; as duas com `audit_log`. Arquivo bruto nunca persistido: só hash e metadados do lote |

## 1. Planilhas
- **SheetJS:** CE em Apache-2.0, uso comercial permitido, exige atribuição
  ([licença](https://docs.sheetjs.com/docs/miscellany/license)). Versão atual 0.20.3; o npm "is out of
  date" e parou na 0.18.5 ([instalação](https://docs.sheetjs.com/docs/getting-started/installation/frameworks)).
  - CVE-2023-30533 (prototype pollution) até 0.19.2.
  - CVE-2024-22363 (ReDoS) antes da 0.20.2 ([NVD](https://nvd.nist.gov/vuln/detail/CVE-2024-22363)).
  - [medido] `npm audit`: 0.18.5 dá **high** "No fix available"; o tarball 0.20.3 dá 0 vulnerabilidades.
  - [medido] Lê e escreve BIFF8 (`.xls`), `.ods` e `.xlsx` com acento sem perda.
  - [medido] Tamanho: `read` + `utils` = **123 KB gzip** (com codepages, 323 KB; só para Excel 95/DBF).
  - Worker: há demo oficial com `dense: true`; `writeFile` não roda no Worker, usar `write({ type: 'buffer' })`
    ([demo](https://docs.sheetjs.com/docs/demos/bigdata/worker)).
- **exceljs 4.4.0** (2023): manutenção "INACTIVE"; CVE-2026-78208 (path traversal) e CVE-2026-78206 (zip
  bomb, CVSS 8,7) publicados em 24/08/2026 ([OSV](https://osv.dev/vulnerability/CVE-2026-78206)). Não serve.
- **read-excel-file 9.3.12** (MIT, 07/10/2026): só `.xlsx`, 17 KB gzip. Plano B.

## 2. CSV e codificação
- Papa Parse 5.7.0 (MIT, 24/08/2026). [medido] acerta `;` em amostras brasileiras. `worker: true` não
  aceita função na configuração ([issue 623](https://github.com/mholt/PapaParse/issues/623)).
- `TextDecoder('utf-8', { fatal: true })` lança erro em Windows-1252 e UTF-16. `iso-8859-1` cai em
  `windows-1252` (WHATWG). O BOM UTF-16 tem de ser checado à mão
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/TextDecoder)).

## 3. Telefone
libphonenumber-js 1.13.15 ([README](https://gitlab.com/catamphetamine/libphonenumber-js)). A metadata `min`
só valida tamanho; `/max` custa 50 KB gzip e dá o tipo. [medido] com `max`:

| Entrada | Resultado |
|---|---|
| `11987654321`, `+55 11 9 8765-4321`, `(011) 98765-4321` | MOBILE |
| `0 21 11 98765-4321` | MOBILE, sem o código de operadora |
| `(11) 3456-7890` | FIXED_LINE |
| `0800 123 4567` | TOLL_FREE |
| `1187654321` (celular antigo, 8 dígitos) | inválido |
| `987654321` (sem DDD) | inválido |

Nono dígito: formato único `9AXXX-XXXX` desde 06/11/2016 ([Tecnoblog](https://tecnoblog.net/117184/anatel-brasil-nono-digito/)).

## 4. Contatos
- vCard: `vcard4` 4.0.5 só lê 4.0; os demais parados. Android emite CHARSET e QP com caractere
  não-ASCII ([AOSP](https://android.googlesource.com/platform/frameworks/base/+/30a2e36%5E%21/)).
  Versões por aparelho [NÃO VERIFICADO]: montar fixtures reais.
- Google Contatos ([ajuda](https://support.google.com/contacts/answer/15147365?hl=pt-BR)): `First Name`,
  `Middle Name`, `Last Name`, `Phone N - Label/Value`, `Email N - Label/Value`, `Birthday`, `Labels`,
  `Notes`. Limite de 3.000 por importação.
- Outlook: `First Name`, `Last Name`, `E-mail Address`, `Mobile Phone`, `Home Phone`, `Business Phone`,
  `Birthday`, `Notes`; traduzidos no Outlook em português (sinônimos [NÃO VERIFICADO]).

## 5. Junção de registros
`fastest-levenshtein` 1.0.16 (MIT). Jaro-Winkler: pacotes parados, implementar (≈ 40 linhas). Fonética:
metaphoneBR do Ipea ([CRAN](https://cran.r-project.org/web/packages/metaphonebr/refman/metaphonebr.html)).
Fellegi-Sunter como no Splink ([teoria](https://moj-analytical-services.github.io/splink/topic_guides/theory/fellegi_sunter.html)):
`m` = probabilidade de concordar sendo a mesma pessoa, `u` = por acaso; peso `log2(m/u)`; probabilidade
`2^M / (1 + 2^M)`. Antes de comparar: tirar acento (NFD), minúsculas, sem "de/da/dos".

## 6. Web Worker no Next 15
Webpack 5 aceita `new Worker(new URL(...), import.meta.url)` literal
([webpack](https://webpack.js.org/guides/web-workers/)). Turbopack: bootstrap por `blob:` até o 16.2
(barrado pela nossa CSP), regressão relatada no 16.2.4 [NÃO VERIFICADO na estável]. Comlink 4.4.2
opcional.

## 7. Exportação
- Data Package v2 (26/06/2024): obrigatório `resources`; recurso com `name` e `path`; recomendados
  `type: "table"`, `format`, `mediatype`, `encoding` ("UTF-8 sem BOM"), `schema` (`fields[].name`,
  `type`), `dialect`, `hash`, `bytes` ([padrão](https://datapackage.org/standard/data-package/)).
- Excel em pt-BR abre UTF-8 só com BOM
  ([Microsoft](https://support.microsoft.com/en-us/excel/opening-csv-utf-8-files-correctly-in-excel)); `;`
  porque a vírgula é o decimal.
- OWASP CSV Injection ([OWASP](https://community.owasp.org/attacks/CSV_Injection)).

## 8. LGPD
- Art. 18, V: portabilidade "de acordo com a regulamentação da autoridade nacional"; §5 sem custo.
- Art. 19, §3: cópia eletrônica integral "em formato que permita a sua utilização subsequente".
- Art. 39: o operador segue o controlador. Art. 16: eliminação ao fim do tratamento
  ([Lei 13.709](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)).
- Regulamento de portabilidade **ainda não existe**; direitos do titular seguem na agenda 2025-2026
  ([Unicamp](https://www.privacidade.unicamp.br/2026/01/07/anpd-publica-mapa-de-temas-prioritarios-2026-2027-e-atualiza-agenda-regulatoria-2025-2026/)).

## Riscos
SheetJS fora do npm (atualização manual, acompanhar `cdn.sheetjs.com/advisories`; dependência transitiva
pode puxar 0.18.5); CSP × turbopack; arquivo gigante ou zip bomb trava a aba (limite antes de ler);
datas ambíguas e vírgula decimal (confirmação na prévia); fundir duas "Maria Silva" (só telefone ou
e-mail juntam sozinhos); nono dígito "corrigido" errando fixo antigo começado em 6 (marcado e revisado);
regulamento de portabilidade pode impor formato; cabeçalhos de Google e Outlook mudam (fixtures e
teste que reprova quando um sinônimo some).
