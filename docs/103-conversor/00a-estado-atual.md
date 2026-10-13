# 103 · 00a — Importação e exportação hoje (auditoria de código, 13/10/2026)

Branch `conversor/esteira-universal` sobre `d7801326`. Leitura do código mais sondas executadas contra
os módulos reais (marcadas **[verificado]**). O que não foi medido está como **[HIPÓTESE]**.

## 1. Importação: duas portas que não se falam

### 1a. Planilha (`/admin/clientes/importar`)
- **Só CSV/TSV** (`importador.tsx:175`, "Até 5 MB, 5.000 linhas" em `:171`). `papaparse` acha o
  separador; `;` funciona [verificado]. A mensagem de erro diz "separado por vírgula"
  (`importacao-clientes.ts:121-123`).
- `.xlsx/.ods/.xls` reconhecidos pelos bytes e **recusados** com instrução de salvar em CSV
  (`core/text/decodificar-texto.ts`, chamado nas rotas `import` e `import/preview`). Motivo em
  `DECISOES.md:13712`: `xlsx` do npm com CVE e alternativa com fork sem manutenção.
- **Parse no servidor.** O arquivo cru sobe duas vezes (prévia e importação) e não é guardado.
- Limites: 5 MB (depois do `formData()`), 5.000 linhas (depois do parse), nome 120, e-mail 254.
- Decodificação: UTF-8 estrito → Windows-1252. **UTF-16 virava lixo** [verificado] (resolvido na
  CNV-001). Sem data serial do Excel, sem várias abas.
- Mapeamento manual com 5 `<select>`; chute por "primeira coluna cujo nome contém" (`:103-111`),
  sem conteúdo, sem confiança, sem sinônimo ("cel", "whats", "fone"). **Um único serviço para a base
  inteira** (`importador.tsx:79,266-285`).
- Normalização: telefone por `normalizarTelefoneBR` (libphonenumber + DDDs da Anatel), **sem DDD do
  salão**; nome só `trim`; **e-mail sem validar formato**; etiquetas cortadas em silêncio; data
  dd/mm e ISO, **data no futuro aceita**; nenhuma coluna de dinheiro.
- Deduplicação só por hash de telefone (no arquivo e contra a base, lotes de 100). **Sem telefone,
  duplica.** Sem nome, sem fonética, sem enriquecer ficha existente.
- **Sem idempotência** (isenção em `escrita-passa-por-idempotencia.test.ts:121`), **sem transação**,
  **sem `batch_id`**, **sem desfazer**. Auditoria `client.import` fora de fechamento.
- Ao Motor: só a **última visita** (N1), `computeCycle` com um ponto de histórico. **Sem R$ antes
  de gravar**; depois de gravar, só contagem.
- Entidades: só `clients`. Erros: a tela mostra os 10 primeiros; **sem quarentena baixável**.
- Papel: `client:create` (recepção importa), sem AAL2.

### 1b. "Quem você já atende" (`/admin/clientes/ja-atendo`)
- Rota com `comIdempotencia` e auditoria dentro. Até 200 pessoas. Texto colado
  (`core/ciclo/lista-de-nomes.ts`, puro) e Contact Picker (Chrome Android). **Não lê `.vcf`.**
- Dedup por hash contra a base numa consulta `.in` só; **não dedup dentro do lote**.

### 1c. Quem vem de outro sistema
- `admin/clientes/vindo-de-outro-sistema/page.tsx`: mensagem para pedir o arquivo e três saídas
  (importar, de memória, "me manda que eu faço"). Roteiro no runbook de suporte §3.

## 2. Exportação

| O quê | Onde | Formato | Quem | Observações |
|---|---|---|---|---|
| Base de clientes | `GET /api/v1/clients/export`, tela `admin/clientes/exportar` | CSV UTF-8 com BOM | dono + AAL2, 1×/30 dias | **Só 4 colunas** (nome, telefone, email, ultima_visita); auditado |
| Escape de fórmula | `core/text/csv-seguro.ts:19-23` | `'` antes de `= + - @ \t \r` | | não aplicado no telefone |
| Dados de uma cliente (LGPD) | `GET /api/v1/clients/[id]/data-export` → `lgpd.ts` | JSON | dono + AAL2 | decifra saúde e registra no `vault_access_log`; **incompleto** (sem notas, fidelidade, clube, carteira, comandas) |
| **Conta inteira** | **não existe** | | | sem zip, LEIA-ME, `datapackage.json`, agenda, serviços, caixa |

## 3. Testes
Integração de importação (com `service_role`, sem RLS), "já atendo", unitários de CSV seguro,
decodificação, data e lista de nomes. **Não existem:** teste HTTP das rotas, ida e volta, corpus
(`tests/fixtures/` não existe), e2e.

## 4. Lacunas contra o `docs/97`

| Item | Situação |
|---|---|
| E0 recepção e segurança | parcial (só recusa planilha binária; arquivo cru sobe ao servidor) |
| E1 formato | parcial mínimo (só CSV; texto colado e contatos fora da esteira) |
| E2 decodificação | parcial (UTF-16 resolvido na CNV-001; sem serial do Excel, sem abas) |
| E3 achar a tabela | **não existe** (título acima do cabeçalho derruba o arquivo) |
| E4 perfil de colunas | não existe |
| E5 classificação | mínimo (substring no cabeçalho) |
| E6 normalização | parcial (sem DDD do salão, sem e-mail, sem dinheiro, sem casar serviço) |
| E7 junção de registros | mínimo (hash de telefone exato) |
| E8 validação, quarentena, totais | parcial (10 erros na tela; sem planilha anotada; sem controle de totais) |
| E9 prévia | mínimo (tabela crua; sem R$, sem nível, sem declaração) |
| E10 carga | parcial (sem idempotência, `batch_id`, desfazer, `job_queue`) |
| E11 aprendizado | não existe |
| N0 / N1 | existem (N1 com um serviço para todos) |
| N2 / N3 | não existem |
| Onda 6 (saída completa) | parcial (CSV de 4 colunas e JSON por cliente) |
| Medição (§12) | não existe |

## 5. Defeitos achados (viram tickets)

| # | Defeito | Onde | Prova |
|---|---|---|---|
| D1 | Celular sem DDD vira número de outro DDD, sem aviso (`99999-0000` → `+55999990000`) | `server/services/telefone.ts:25-33` | [verificado] |
| D2 | Célula com dois telefones descarta a cliente inteira | `importacao-clientes.ts:181-186` | [verificado] |
| D3 | Título ou "Período:" acima do cabeçalho derruba o arquivo com instrução errada | `:121-123` | [verificado] |
| D4 | Linha `;;;` vira erro "Nome em branco" (`skipEmptyLines` não é `'greedy'`) | `:111-115` | [verificado] |
| D5 | Reimportar duplica toda cliente sem telefone (sem idempotência) | rota `import` | DECISOES:11708 |
| D6 | Erro depois de gravar: ficha gravada, tela diz "falhou", sem auditoria | `ciclo-de-quem-ja-atende.ts:82,133`, `import/route.ts:51` | leitura |
| D7 | Runbook manda "importe de novo só essas linhas" (não funciona) | runbook `:188-190` | leitura |
| D8 | Mesmo telefone duas vezes no "já atendo" derruba o lote (23505 → INTERNAL) | `quem-ja-atendo.ts:142-156` | leitura |
| D9 | "Já atendo" pode estourar URL com 200 hashes num `.in` | `quem-ja-atendo.ts:119-125` | [HIPÓTESE] |
| D10 | "Já atendo" descarta telefone inválido sem avisar | `:105-108` | leitura |
| D11 | Texto colado: homônimo com outro telefone some; telefone sem DDD fica no nome | `lista-de-nomes.ts:33-58` | [verificado] |
| D12 | E-mail sem validação na importação | `importacao-clientes.ts:190-194` | leitura |
| D13 | Última visita no futuro aceita | `data-informada.ts:20-36` | leitura |
| D14 | Etiquetas cortadas em silêncio; "Alergias" mapeada em etiqueta grava saúde em claro | `:196-205` | leitura |
| D15 | Cota mensal de exportação gasta antes do arquivo existir | `export/route.ts:44` | leitura |
| D16 | Telefone exportado com `+` vira notação científica no Excel e não reimporta | `clientes.ts:226` | [verificado] na volta |
| D17 | Ida e volta altera nomes (`'` do escape fica); escape não cobre `＝` | `csv-seguro.ts:21-23` | [verificado] |
| D18 | Exportação LGPD sem trilha quando não há saúde; portabilidade incompleta | `lgpd.ts:52-61` | leitura |
| D19 | `packages` e `client_subscriptions` lidos sem paginação no ciclo | `ciclo-de-quem-ja-atende.ts:123-131` | leitura |
| D20 | Arquivo entre 4,5 e 5 MB: 413 da Vercel quebra o `r.json()` da tela | `importador.tsx:53-54` | [HIPÓTESE] |
| D21 | Chute de coluna pega "Nome do profissional" e "Total de atendimentos" | `importador.tsx:104-110` | leitura |
| D22 | Recepção importa 5.000 fichas sem AAL2 | `rbac.ts:32` | decisão |
| D23 | Testes de importação com `service_role` não provam o caminho sob RLS | testes | leitura |

## 6. Regras que a construção respeita
- `core/` puro: a guarda `core-nao-conhece-o-mundo` só permite `@js-temporal/polyfill` e `zod`.
  Biblioteca de leitura (papaparse, libphonenumber, leitor de planilha) no core exige decisão e entrada
  na lista; o hash do telefone **não vai ao navegador** (sal secreto).
- Escrita por `/api/v1` com `rota()`, `comIdempotencia` e `writeAudit` dentro; rota nova entra em
  `ROTAS_DE_ESCRITA` (pausa); alcance `own`; RLS + `force` + política + isolamento em tabela nova;
  `.in()` em lotes; leitura paginada; centavos; nunca apagar auditoria.
- Decisões em vigor: migração grátis; Trinks fora do foco; "já atendo" é o caminho principal;
  exportação da base só do dono com AAL2. **GO-1 ("não construir xlsx/PDF/print") e o bloqueio do
  xlsx por segurança são revistos em `DECISOES` 2026-10-13 (CNV)**, a pedido do Eduardo.
