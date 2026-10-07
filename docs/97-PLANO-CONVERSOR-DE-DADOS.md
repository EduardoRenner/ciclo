# 97 · A esteira de dados: qualquer arquivo entra, o Motor de Ciclo recebe ouro

Escrito em 2026-10-07, revisado no mesmo dia (v2). Substitui o plano de "conversor por sistema".

**A ideia em uma frase.** O salão joga qualquer coisa (planilha, CSV, export do AppBarber, lista
colada, contatos do celular). Uma esteira com estações fixas identifica o formato, acha a tabela,
descobre o que cada coluna é **olhando o conteúdo**, limpa, junta duplicados, separa o que prestou do
que não prestou, mostra o resultado antes de gravar, e entrega ao Motor de Ciclo o que ele precisa
para dizer "estes 47 clientes sumiram e valem R$ 6.300".

Não é um conversor por sistema. Conversor por sistema quebra no dia em que o sistema muda uma coluna,
e exige uma amostra de cada concorrente para existir. A esteira funciona sem conhecer o sistema, e
**aprende** a assinatura de cada um à medida que os arquivos passam (estação E11).

## 0. A promessa, dita com honestidade

"Identifica e separa corretamente 100% de qualquer arquivo" é impossível: planilha é texto livre
digitado por gente. A promessa que uma esteira industrial consegue cumprir, e que vale mais:

> **Nunca errado e calado.** Todo dado que entra sai em uma de três caixas: **ouro** (entendido com
> confiança alta e gravado), **pergunta** (ambíguo: uma pergunta curta ao dono, com a resposta mais
> provável já marcada) ou **quarentena** (não prestou, com o motivo, em arquivo baixável). Nada é
> descartado nem "adivinhado" sem aparecer.

Isso é um invariante testável: **lidas = ouro + com aviso + quarentena + ignoradas (título, total,
rodapé)**. Se a conta não fecha, o teste reprova.

Métricas-alvo, medidas em corpus de teste (seção 5), não em fé:
- **falso-aceite = 0** no corpus: nenhum dado entra na coluna errada sem pergunta;
- arquivos que o dono conclui **sem nenhuma pergunta**: ≥ 70% depois de a esteira aprender os 5
  sistemas mais comuns;
- do arquivo ao valor na tela ("quanto dá para recuperar"): p95 abaixo de 3 minutos para 5.000 linhas.

## 1. O que sabemos (verificado em 2026-10-07)

- **AppBarber:** o site diz que dá para exportar a base ("Consigo exportar minha base de dados? Sim.
  Entre em contato conosco pelo chat on-line"). **Não é botão: o salão pede ao suporte.** A central de
  ajuda bloqueou a leitura automática (403).
- **Trinks:** a central tem seção "Cliente" (cadastro, débito, anamnese, crédito) e nenhum artigo de
  exportação nos títulos. Não confirma nem nega.
- **Avec, Salão99, Belle, Simples Agenda, Booksy:** a busca não achou documentação pública. Nada a
  afirmar sobre elas sem ver um arquivo.
- O importador atual (`importacao-clientes.ts`): CSV, separador detectado, codificação do Excel
  brasileiro tratada, mapeamento manual de 5 campos, 5.000 linhas e 5 MB, `.xlsx` recusado com
  instrução. Exportação de saída (`/admin/clientes/exportar`): CSV de 4 colunas, com escape de
  fórmula (`core/text/csv-seguro.ts`).
- O Motor de Ciclo (`computeCycle`) recebe, por cliente e serviço, o **histórico de datas de visita**
  (`history: { date }[]`). Hoje a importação só entrega a *última* visita, e por isso o Motor calcula
  com o ritmo padrão do serviço. Histórico real é o que transforma previsão em palpite bom.

**Consequência para a venda:** a esteira precisa funcionar bem com o pouco que o AppBarber entrega
(provavelmente nome, telefone e datas), e brilhar quando vier histórico.

## 2. O contrato de saída: o que o Motor consome (e o que cada nível vale)

A esteira produz um **registro canônico** por pessoa. Quanto mais campos, mais ouro:

| Nível | O que veio | O que o Motor entrega |
|---|---|---|
| N0 | nome + telefone | lista de clientes; chamar manualmente; sem previsão |
| N1 | + data da última visita | quem já devia ter voltado, com o ritmo padrão do serviço |
| N2 | + histórico de visitas (várias datas por cliente) | **ritmo real de cada cliente**, quem foge do próprio padrão |
| N3 | + serviço, valor e profissional por visita | **valor em risco em reais**, ticket, serviço preferido, profissional |
| Extras | aniversário (`clients.birth_date` já existe), observações, e-mail, origem | aniversariantes, personalização do texto de volta |

Cada importação termina dizendo o nível alcançado e **o que faltou para subir**: "Com a data de cada
visita, o Motor aprende o ritmo de cada cliente. Pede ao seu antigo sistema o relatório de
atendimentos."

## 3. As estações da esteira

Cada estação tem entrada, saída, modo de falha e teste próprio. Cada uma é uma função pura em
`src/core/ingestao/` (sem I/O, regra 5 do CLAUDE.md); só a recepção e a carga tocam servidor/banco.

**E0 · Recepção e segurança.** Limite de tamanho; tipo decidido pelos **bytes** (assinatura do
arquivo), nunca pela extensão nem pelo `Content-Type`; recusa de zip-bomb (limite de expansão), de
planilha com macro e de XML com entidade externa; fórmula vira texto, nunca é avaliada. O arquivo cru
**não é guardado**: processa em memória, e só o resultado normalizado vai para a área de espera
(seção 4).

**E1 · Identificação do formato, por conteúdo.** Texto delimitado (vírgula, ponto e vírgula, tab,
barra vertical; detecta pelo que se repete), Excel (`.xlsx`, `.xls`, `.ods`), JSON e NDJSON, vCard
(contatos do celular, `.vcf`), tabela HTML (copiar e colar do navegador), texto colado, PDF **com
texto** (extração de tabela). Não identificou: devolve "não consegui ler este formato" com os
formatos aceitos, sem tentar adivinhar.

**E2 · Decodificação.** Codificação (UTF-8, com ou sem BOM, Latin-1, Windows-1252, UTF-16) por
pontuação de acentos plausíveis em português, não por sorte; datas do Excel guardadas como número de
série (calendário de 1900 e de 1904); células mescladas desmescladas; linhas e colunas ocultas
reportadas; **todas as abas** lidas, cada uma como candidata.

**E3 · Descoberta de tabelas.** O cabeçalho quase nunca está na linha 1. Relatórios de sistema vêm
com título, logotipo, "Período: 01/01 a 30/09", filtros, linha de total e rodapé. A estação acha o
bloco retangular mais denso, a linha de cabeçalho (a primeira cuja natureza difere das de baixo),
descarta totais e rodapés (contados como "ignoradas") e trata a **mesma aba com duas tabelas** como
duas tabelas. Relatórios "agrupados por profissional" (o nome do profissional numa linha solta, e as
visitas embaixo) são desdobrados: o profissional vira coluna.

**E4 · Perfilamento de colunas.** Antes de dar nome a qualquer coluna, mede-se o conteúdo: que
fração parece telefone, e-mail, data (e em qual formato), dinheiro (`1.234,56`, `R$ 80`, centavos
inteiros), nome próprio, texto livre, número de documento, identificador, ou categoria de poucos
valores repetidos (serviço, profissional, situação). Também: taxa de vazio, cardinalidade, tamanho
médio.

**E5 · Classificação de campo.** Combina quatro sinais, **o conteúdo pesa mais que o nome**:
1. o perfil da coluna (E4);
2. o cabeçalho, normalizado (sem acento, minúsculo) e comparado a um dicionário PT/EN/ES com
   sinônimos ("cel", "whats", "contato", "fone", "tel.", "mobile");
3. a assinatura conhecida do arquivo (E11);
4. a vizinhança (a coluna ao lado de um nome e antes de uma data costuma ser telefone).

Cada coluna sai com **campo canônico + confiança (0 a 1)**: ≥ 0,9 segue sozinha; entre 0,6 e 0,9 vira
sugestão marcada com um toque para confirmar; abaixo de 0,6 pergunta ou ignora. Casos que a estação
resolve **por regra e não por sorte**:
- **dia/mês ou mês/dia:** pela distribuição. Se algum valor tem o primeiro número acima de 12, é
  dia/mês; se nenhum, pergunta com os dois exemplos lado a lado, nunca chuta;
- **coluna que mistura** "Maria 11 99999-0000": separa em duas;
- **várias pessoas ou telefones numa célula:** separa, usa o celular como principal;
- **o grão do arquivo:** uma linha por cliente, ou **uma linha por atendimento**? Telefone ou nome
  repetido em muitas linhas denuncia histórico. É a decisão que separa N1 de N2 e N3, e a mais
  importante da esteira;
- **documento (CPF/CNPJ):** reconhecido e **descartado** (o Motor não precisa; minimização, LGPD);
- **colunas que parecem saúde** ("alergia", "queixa", "obs. clínica"): marcadas sensíveis, ficam fora
  até decisão (seção 6).

**E6 · Normalização.** Telefone para E.164 (sem DDD assume o do salão, com 55 ou parênteses, nono
dígito, fixo separado de celular); nome com espaços e caixa limpos sem estragar "da Silva" nem
"McDonald"; e-mail em minúsculas, com **sugestão** (nunca troca calado) para erros de digitação
comuns (`gmial.com`); datas em ISO; dinheiro em **centavos** (regra 3); serviço e profissional
casados por similaridade com o catálogo do salão, e o que não casa vira pergunta ("estes 12 nomes
de serviço são os mesmos que os seus 4 cadastrados?").

**E7 · Resolução de entidades.** Mesma pessoa em várias linhas, dentro do arquivo e **contra a base
que já existe**. Chave principal: o hash do telefone (já usado hoje); secundária: nome + aniversário.
Regras: dois nomes muito diferentes com o mesmo telefone são **família ou recepção**, não a mesma
pessoa (marca "telefone compartilhado", não funde); duas linhas da mesma pessoa viram uma, com as
visitas somadas; **nunca sobrescrever dado que o salão já preencheu com um vazio**; em conflito de
valores, vence o mais recente, e o outro vai para o relatório.

**E8 · Validação e quarentena.** Cada linha sai com um destino: ouro, ouro com aviso, quarentena
(motivo em código: telefone inválido, nome vazio, data impossível, duplicata dentro do arquivo...) ou
ignorada. A quarentena é um **CSV baixável com o motivo por linha**, no mesmo formato que a esteira
lê: o dono corrige no Excel e joga de volta, e a esteira reconhece que é uma correção. O invariante
de contagem (seção 0) é verificado aqui.

**E9 · Prévia: "entendi assim".** Uma tela só, antes de gravar: cinco linhas de exemplo mostrando
*como veio → como vai ficar*; as contagens (ouro, aviso, quarentena); no máximo **três perguntas**,
cada uma com a resposta provável já marcada; e o **ouro já na tela**: "47 clientes já deviam ter
voltado, cerca de R$ 6.300 em jogo", calculado pelo mesmo `computeCycle` que vai gravar. É o momento
da venda: o dono vê o número antes de confirmar.

**E10 · Carga.** Lotes de 100 (limite de URL do gateway local), transacional por lote, **idempotente**
(hash do arquivo + chave da linha: jogar o mesmo arquivo duas vezes não duplica nada). Cada linha
criada leva o `batch_id`, e há **"desfazer esta importação"** por 7 dias (apaga o que a importação
criou e devolve o que ela alterou). Não gera caixa, comissão nem baixa de estoque. Termina
enfileirando o cálculo do Motor em `job_queue` (com `dedupe_key`), e a tela acompanha o progresso.
Acima do limite de hoje (5.000 linhas, 5 MB) o trabalho segue em segundo plano.

**E11 · Aprendizado: a esteira ensina a si mesma.** Cada vez que um dono confirma o mapeamento de um
arquivo, a esteira guarda a **assinatura estrutural** (a lista normalizada de cabeçalhos e o perfil
das colunas, **nunca um dado de pessoa**) ligada ao mapeamento confirmado. Na próxima conta que
trouxer o mesmo sistema, a esteira diz "parece um arquivo do AppBarber" e entra sem perguntas. É
assim que as "predefinições por sistema" passam a existir **sem eu precisar de uma amostra de cada
concorrente**: os próprios clientes alimentam. Para o cabeçalho não carregar nome de salão, só vira
assinatura global depois de aparecer em **3 contas diferentes** (k-anonimato).

## 4. Onde mora e o que precisa existir no banco

- `src/core/ingestao/` (puro): `farejarFormato`, `decodificar`, `acharTabelas`, `perfilarColunas`,
  `classificarCampos`, `normalizar`, `resolverEntidades`, `validar`. Nada importa de `server/` nem de
  `app/`.
- `src/server/services/ingestao/` (com I/O): recepção, carga, desfazer, aprendizado.
- Tabelas novas, **cada uma com RLS + `force` + política + teste de isolamento**: `import_batches`
  (um por arquivo: hash, nível alcançado, contagens, estado) e `import_rows` (a área de espera, só o
  resultado normalizado, com o destino de cada linha). **Retenção: 7 dias** e depois apaga (LGPD:
  lista de terceiros não fica guardada além do necessário). `import_signatures` é a global, **sem
  `tenant_id` e sem dado de pessoa**, escrita só pelo servidor.
- Migrations só aditivas, aplicadas antes do código (o lote de migrations de produção já tem ordem
  própria: ver o runbook).
- Bibliotecas de leitura de Excel: **decidir com conferência de licença e histórico de falhas de
  segurança antes de instalar** (o pacote popular de planilhas tem histórico de CVE em versões
  antigas). Rodam só no servidor, com limite de memória.

## 5. Como saber que "extrai corretamente" (sem acreditar na palavra de ninguém)

1. **Corpus ouro.** Pasta `tests/fixtures/ingestao/` com arquivos e **gabarito por campo**
   (`arquivo.csv` + `arquivo.esperado.json`). Começa **sintético**: um gerador produz dezenas de
   variações imitando o estilo de cada sistema (título + filtros no topo, cabeçalho na linha 4,
   `;` e Windows-1252, datas em número de série, telefone em 6 formatos, uma linha por atendimento,
   relatório agrupado por profissional, totais no rodapé). Isso cobre as *classes* de problema sem
   nenhuma amostra de concorrente; amostras reais, **anonimizadas**, refinam depois.
2. **Métricas por rodada de teste:** acerto de classificação de coluna, F1 por campo, taxa de
   pergunta, taxa de quarentena, tempo, e sobretudo **falso-aceite** (dado na coluna errada sem
   pergunta), que tem meta zero.
3. **Teste de propriedade:** o resultado **não muda** se embaralhar as colunas, trocar o separador,
   trocar a codificação, inserir linhas de título ou reordenar as linhas. Resultado diferente reprova.
4. **Invariante de contagem** em todo arquivo do corpus.
5. **Mutação:** cada classificador é quebrado de propósito e o corpus tem que reprovar. Classificador
   cujo teste passa com ele quebrado é classificador cego (a regra do CLAUDE.md).
6. **Ida e volta:** exporta uma base, importa em conta vazia, compara contagens e campos.
7. **Prova no navegador** a 390 px com arquivo real gerado pela própria pessoa, não só no teste.

## 6. Limites honestos e decisões que não são minhas

- **Sem IA de terceiros por padrão.** As minutas de privacidade e a guarda do PR #144 (jurídico) dizem
  que o CICLO não manda dado de cliente a provedor de IA externo. A esteira é **determinística primeiro**:
  regras, estatística e dicionário resolvem a grande maioria. Se um dia um modelo de linguagem ajudar
  em coluna ambígua, só poderia receber **cabeçalhos e amostra anonimizada**, **desligado por padrão e
  só depois de parecer jurídico**. Decisão do Eduardo, não do código.
- **Foto, PDF escaneado, print de tela:** exigem OCR. OCR de terceiros manda dado pessoal para fora;
  OCR local custa processamento na Vercel. **Fora da primeira versão.** Alternativa que já resolve:
  o dono cola o texto ou pede a planilha ao suporte do sistema antigo.
- **Dado de saúde numa planilha** (anamnese, alergia): a esteira detecta e **não importa** sem
  decisão. Hoje o dado de saúde do CICLO é cifrado por negócio; importar texto livre para fora dessa
  proteção seria um retrocesso. Decidir com o advogado.
- **Quem responde pela lista:** o salão é o controlador e o CICLO é operador. A tela de prévia
  deveria ter uma frase de que o salão tem o direito de usar aquela lista. **Perguntar ao advogado**
  o texto exato.
- **Portabilidade é direito do titular** (LGPD art. 18, V): o texto pronto para o salão pedir o
  arquivo ao suporte do antigo sistema está na seção 9.

## 7. Ondas de construção

Cada onda é uma sequência de PRs pequenos, com teste, mutação e prova no navegador. Nenhuma depende
de amostra de concorrente para começar.

**Onda 1 · Esteira mínima que já vende (N0 e N1 de verdade).** E0 a E3, E4, E5 (classificador por
conteúdo, sem aprendizado), E6, E8 com **quarentena baixável**, E9 com o valor na tela, leitura de
`.xlsx`. Corpus sintético com 40 variações. *Pronto quando:* o corpus passa com falso-aceite zero e
o invariante fecha, e um arquivo bagunçado (título, cabeçalho na linha 4, `;`, Windows-1252) entra
sem uma pergunta.

**Onda 2 · Histórico (N2 e N3).** Detecção de grão, desdobramento de relatório agrupado, E7 completo
(entidades contra a base), importação de visitas como atendimentos **marcados como importados**
(sem caixa, sem comissão, sem estoque), cálculo do Motor com `history` real. *Pronto quando:* o mesmo
arquivo de histórico dá ao Motor um ritmo por cliente, e o teste prova que nada de dinheiro foi
gerado. **Esta onda passa por revisão antes de começar** (é a que mexe com dados financeiros).

**Onda 3 · Esteira que aprende (E11) e desfazer.** Assinaturas, k-anonimato, "desfazer esta
importação" por 7 dias, retenção de 7 dias na área de espera.

**Onda 4 · Formatos extras.** vCard, JSON, tabela HTML colada, PDF com texto. Cada formato entra com
fixture e teste.

**Onda 5 · Saída completa.** Exportação em `.zip` (clientes, atendimentos, serviços, profissionais,
pagamentos, estoque, com `LEIA-ME.txt`), o teste de **ida e volta** (a esteira relê o que o CICLO
exporta), escape de fórmula via `csv-seguro.ts` em toda célula. Dado de saúde só com o AAL2 que a
exportação de conta já exige.

## 8. Riscos

| Risco | Resposta |
|---|---|
| Classificar errado e ninguém notar | Falso-aceite com meta zero, confiança por coluna, prévia obrigatória, quarentena baixável |
| Importar a mesma lista duas vezes | Idempotência por hash do arquivo + chave da linha; teste |
| Fundir duas pessoas diferentes (família no mesmo telefone) | Regra de telefone compartilhado, nunca funde por telefone sozinho |
| Importação ruim estragando uma base boa | Desfazer por 7 dias; nunca sobrescreve preenchido com vazio |
| Arquivo malicioso (zip-bomb, macro, XML externo, fórmula) | E0; limites; leitura só no servidor; teste com arquivos hostis |
| Lista de terceiros guardada para sempre | Área de espera com retenção de 7 dias |
| Prometer na venda o que o arquivo não traz | Nível alcançado dito na tela; texto público só cita sistema depois de ele passar pelo corpus |

## 9. Texto pronto para o salão pedir o arquivo

"Olá, quero exportar minha base de clientes (nome, telefone, e-mail, data de cada atendimento,
serviço e valor, se houver) em planilha. Podem me enviar ou dizer como baixar? É um pedido de
portabilidade dos dados da minha empresa."

Pedir **a data de cada atendimento**, e não só o cadastro, é o que leva o salão do nível N1 ao N2.

## 10. Fora do escopo agora

Agenda futura do outro sistema, financeiro e estoque (raramente exportam, e errar custa o dinheiro do
cliente); OCR (seção 6); modelo de linguagem de terceiros (seção 6).
