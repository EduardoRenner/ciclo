# CICLO — PROMPT-CONTRATO DO CONVERSOR DE DADOS UNIVERSAL (13/10/2026)

> **Como usar:** cole tudo abaixo do risco numa sessão com acesso ao repositório do CICLO.
> **Fonte de verdade desta missão.** Se o contexto for resumido, RELEIA este arquivo e
> `docs/103-conversor/_progresso.md` antes de continuar.
> **Esta missão vai do começo ao fim:** pesquisa → plano com tickets → execução ticket por ticket.

---

# PARTE A · CONTRATO

## A0. O que eu quero

Sou o Eduardo, fundador do CICLO. Escreva simples, frase curta, sem jargão (termo técnico só com a
explicação na mesma frase).

Quero o **conversor de dados universal** do CICLO: **qualquer coisa entra, tudo sai**.

- **Entra QUALQUER coisa:** planilha de qualquer tipo (`.xlsx`, `.xls`, `.ods`, `.numbers` se der),
  CSV/TSV de qualquer separador e codificação, export de outro sistema de salão, contatos do celular
  (`.vcf`), CSV do Google Contatos e do Outlook, texto colado (lista do WhatsApp, notas), conversa
  exportada do WhatsApp (`.txt`), JSON, documento (`.docx`, `.odt`, `.rtf`, `.html` com tabela),
  **PDF** (com texto e escaneado), **print de tela** do app antigo e **foto** de relatório ou de
  caderno. Print e foto passam por OCR **no aparelho**, com revisão linha a linha e telefone
  conferido dígito a dígito (`docs/97-PLANO-CONVERSOR-DE-DADOS.md` §6).
- **Sai:** a base inteira do negócio, de um jeito que **qualquer ferramenta** lê (planilha que o Excel
  brasileiro abre com acento certo, CSV seguro contra fórmula, `.zip` com `LEIA-ME.txt` e
  `datapackage.json`), e que o próprio CICLO **reimporta sem perder nada** (ida e volta).
- **No meio:** a esteira de `docs/97` (estações E0 a E11): identifica o formato, acha a tabela,
  descobre o que cada coluna é pelo conteúdo, limpa, junta duplicados, separa ouro / pergunta /
  quarentena, mostra o **valor em reais** antes de gravar e entrega ao Motor de Ciclo o que ele
  precisa.

A promessa, dita com honestidade (de `docs/97` §0): **nunca errado e calado.** Todo dado sai em ouro,
pergunta ou quarentena. Invariante: **lidas = ouro + com aviso + quarentena + ignoradas**.

## A1. Papéis

Arquiteto(a) de dados e de produto; engenheiro(a) de qualidade que vê o teste reprovar; engenheiro(a)
de segurança (arquivo hostil, CSV injection, LGPD); designer de interação para o dono no celular;
auditor(a) adversarial que desconfia de "já funciona".

## A2. Permissões e proibições

**Pode:** ler tudo; pesquisar na web; escrever código, testes, migrations **aditivas** e documentos na
branch `conversor/esteira-universal`; rodar `pnpm verify`, testes, build e o app local; medir com
Playwright fora do repositório; commitar e empurrar a branch.

**Não pode:** tocar produção (banco, Vercel, Supabase de produção); usar dado real de cliente em
teste, captura ou documento; mandar dado de cliente para IA ou OCR de terceiros (`docs/97` §7);
importar dado de saúde fora do cofre (`docs/97` §8); gerar caixa, comissão ou baixa de estoque a
partir de importação; disparar mensagem para contato importado; abrir PR antes de a base dele entrar
na `main` (memória "PR empilhado não chega na main"); instalar dependência sem conferir licença,
manutenção e histórico de falha de segurança.

## A3. Evidência

Toda afirmação sai como **FATO** (`arquivo:linha`, comando, medição), **[INFERÊNCIA]** (com a
derivação), **[HIPÓTESE]** (com como validar) ou **[NÃO VERIFICADO]** (com motivo e quem destrava).
"O teste passou" não é prova (`CLAUDE.md`, "Verde não é prova").

## A4. Insumos obrigatórios

1. `CLAUDE.md` inteiro (regras invioláveis, teste-guarda, armadilhas).
2. `docs/97-PLANO-CONVERSOR-DE-DADOS.md` (o plano da esteira: estações, níveis N0–N3, ondas, medição).
3. `docs/99-PLANO-MESTRE-DO-ECOSSISTEMA.md` (portão de evidência GO-0/GO-1; foco AppBarber, Belasis,
   BarbUp, caderno e planilha; migração sempre grátis).
4. `docs/83*`, `docs/84*` (onboarding e dados), `docs/DECISOES.md` (grep: import, export, planilha,
   ja-atendo).
5. O código atual: `src/server/services/importacao-clientes.ts`, `src/app/admin/clientes/importar/`,
   `src/app/admin/clientes/exportar/`, `src/app/api/v1/clients/{import,export,[id]/data-export}`,
   `src/app/api/v1/account/route.ts`, `src/app/api/v1/clients/ja-atendo`, o escape de CSV.

## A5. Regras de construção (do `CLAUDE.md` e das lições da casa)

- Regra de negócio em `src/core/ingestao/` e `src/core/exportacao/`, **funções puras, sem I/O**, que
  rodam no navegador e no servidor. O servidor **nunca confia** no que o navegador manda: revalida
  com Zod.
- Escrita por `/api/v1` com `Idempotency-Key`; tabela nova com RLS + `force` + política + teste de
  isolamento; dinheiro em centavos; tempo em `timestamptz`.
- Guarda nova só conta depois de vista **reprovando** (mutação), e com controle positivo.
- Suíte unitária inteira antes de cada commit; integração inteira quando mexer em leitura
  compartilhada.
- Um ticket, um commit, em português, com o código do ticket (`CNV-xxx`).
- Mudança que a pessoa vê se verifica no navegador a 390 px.

# PARTE B · FASES

## Fase 0 · Pesquisa e análise de mercado completas (entregáveis: `docs/103-conversor/00-pesquisa.md` e `docs/103-conversor/00b-mercado.md`)

1. **Estado atual medido:** o que o importador e os exportadores fazem hoje, com `arquivo:linha`;
   tabela de lacunas contra as estações E0–E11 e as ondas de `docs/97`; defeitos achados.
2. **Tecnologia:** biblioteca para `.xlsx/.xls/.ods` no navegador (licença, tamanho, falhas de
   segurança, versão exata); detecção de codificação; telefone BR; vCard; similaridade de nomes;
   Web Worker no Next 15; `.zip` e `datapackage.json`; escape de fórmula e BOM.
3. **Documento, PDF, print e foto:** estado da arte de extração de texto e de tabela no aparelho
   (pdf.js, OCR em WebAssembly/WebGPU, reconstrução de tabela por posição, manuscrito), com
   benchmark público e o que é realista num celular médio.
4. **Mercado, ponta de linha:** importadores (Flatfile, OneSchema, Dromo, CSVBox, Osmos…); como
   Fresha, Vagaro, Booksy, Square, Mindbody e os brasileiros (AppBarber, Belasis, BarbUp, Trinks,
   Avec…) importam e **deixam exportar**; reclamações públicas de quem não conseguiu sair; tamanho do
   mercado; o que é tabela-mesa e o que é diferencial defensável; métricas do funil de migração;
   posicionamento e copy da página de migração.
5. **LGPD:** portabilidade e retenção.

**G0:** cada item com fonte; recomendações com decisão.

## Fase 1 · Plano (entregável: `docs/103-conversor/01-plano-e-tickets.md`)

- Ondas na ordem de valor e risco. Começa pelo que destrava o alpha (planilha e lista colada, N0/N1,
  com valor na tela) e pela **saída completa** (exportar tudo e reimportar), que é barata e prova o
  formato canônico.
- Cada ticket: problema (com evidência), proposta, arquivos, **aceite medido**, teste que reprova
  antes, migration (aditiva/equivalente/restritiva), dependências, risco e reversão, commit.
- Corpus sintético em `tests/fixtures/ingestao/` com gabarito (`docs/97` §12) desde o primeiro
  ticket de leitura: falso-aceite = 0 é o piso.

**G1:** todo ticket com aceite medível; ordem justificada.

## Fase 2 · Execução (ticket por ticket)

Para cada ticket: implementar → teste que reprova sem o conserto → suíte unitária inteira → (banco:
`test:rls` e integração) → tela no navegador a 390 px quando houver tela → commit → `_progresso.md`.

## Fase 3 · Revisão adversarial

Ao fim de cada onda: tentar quebrar (arquivo hostil, codificação errada, telefone torto, linha
duplicada, ida e volta com perda, número de reais errado na prévia). Achado vira ticket.

# PARTE C · CONTROLE

- `docs/103-conversor/_progresso.md`: fase, tickets feitos (commit), medidas, pendências do Eduardo.
- **Pendências que só o Eduardo resolve** (não bloqueiam o resto): texto da declaração (advogado),
  dado de saúde no cofre, modo assistido com arquivo enviado, IA/OCR de terceiros.
- **Parar e perguntar** só se: for tocar produção; uma decisão de dinheiro ou de dado pessoal não
  tiver resposta em `docs/97`, `docs/99`, `DECISOES` ou `05-FAQ-DEV` e a opção mais simples puder
  causar dano.
