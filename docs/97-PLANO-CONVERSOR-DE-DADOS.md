# 97 · A esteira de dados: qualquer arquivo entra, o Motor de Ciclo recebe ouro

Escrito em 2026-10-07, v3 (mesmo dia): inclui a pesquisa de mercado, o que copiar e o que inovar, e
traz para dentro do plano o que antes estava "fora" (OCR, IA, dado de saúde, texto jurídico), cada um
com a sua trava.

O plano-mestre que junta esta trilha com cobrança, agentes, confiança e operação está em
`docs/99-PLANO-MESTRE-DO-ECOSSISTEMA.md`.

A revisão que mediu este plano contra o estado da arte (e que revisa o Motor) está em
`docs/98-REVISAO-ECOSSISTEMA-E-MOTOR.md`; o que ela mudou aqui está marcado com **(rev. 98)**.

**A ideia em uma frase.** O salão joga qualquer coisa (planilha, CSV, export de outro sistema, lista
colada, contatos do celular, até foto ou PDF escaneado). Uma esteira com estações fixas, **rodando no
navegador por padrão**, identifica o formato, acha a tabela, descobre o que cada coluna é olhando o
conteúdo, limpa, junta duplicados, separa o que prestou do que não prestou, mostra o resultado e o
valor antes de gravar, e entrega ao Motor de Ciclo o que ele precisa para dizer "estes 47 clientes
sumiram e valem R$ 6.300".

## 0. A promessa, dita com honestidade

"Identifica e separa 100% de qualquer arquivo" é impossível: planilha é texto livre digitado por
gente, e foto de relatório é pior. A promessa que uma esteira industrial cumpre, e que vale mais:

> **Nunca errado e calado.** Todo dado que entra sai em uma de três caixas: **ouro** (entendido com
> confiança alta), **pergunta** (ambíguo: uma pergunta curta, com a resposta provável já marcada) ou
> **quarentena** (não prestou, com o motivo, em arquivo baixável). Nada é descartado nem adivinhado
> sem aparecer.

Invariante testável: **lidas = ouro + com aviso + quarentena + ignoradas (título, total, rodapé)**.
Se a conta não fecha, o teste reprova.

Metas, medidas em corpus de teste (seção 12) e não em fé:
- **falso-aceite = 0** no corpus (dado na coluna errada sem pergunta);
- ≥ 70% dos arquivos concluídos **sem nenhuma pergunta**, depois de a esteira aprender os 5 sistemas
  mais comuns;
- do arquivo ao valor na tela: p95 abaixo de 3 minutos para 5.000 linhas;
- **fotos e PDFs escaneados nunca são aceitos sem revisão linha a linha** (OCR erra; seção 6).

## 1. O mercado: o que já existe (pesquisado em 2026-10-07)

Fonte: páginas comerciais e comparativos de cada fornecedor, lidos hoje. **Não testamos nenhum
produto**, e página comercial diz o que o fornecedor quer que se leia. Serve para decidir direção,
não para afirmar capacidade.

### 1.1 Importadores de dados para SaaS (a categoria da esteira)
| Produto | O que faz | Onde processa | Lição |
|---|---|---|---|
| **Flatfile** | importador embutido, virando "migração de dados com IA"; preço só sob consulta | servidor do fornecedor | o mercado está indo de "mapear colunas" para "agentes que entendem a bagunça" |
| **OneSchema** | edição em massa dentro da importação, autocorreção, achar-e-trocar, **Excel anotado explicando os erros**, biblioteca de validações, até 10 milhões de linhas, visão por LLM para campos | não informado | o dono corrige **dentro** do fluxo, e o erro volta explicado |
| **Dromo** | importador com mapeamento de colunas por IA e validação; **"Private Mode": o arquivo fica no dispositivo da pessoa**; certificações SOC 2 e HIPAA; US$ 599/mês no plano profissional | navegador (no modo privado) | privacidade por arquitetura é vendável, e hoje é item pago |
| **CSVBox** | widget barato, mapeamento e validação básicos, tetos por plano, sem HIPAA | servidor | o piso do mercado: só mapeia coluna |
| **Ingestro** | "agentes de IA integram os dados dos clientes"; ISO 27001, SOC 2 | servidor | mesma direção do Flatfile |

**O que todos têm em comum:** foram feitos para o desenvolvedor que embute o importador em um
produto genérico. **Nenhum conhece o destino.** Mapeiam para "o esquema que o cliente definiu", sem
saber se o dado vai virar uma previsão de retorno ou um relatório fiscal.

### 1.2 Como os sistemas de salão tratam a migração
| Sistema | O que oferece |
|---|---|
| **Belasis** | migração **feita por eles**: importação assistida de clientes, **agenda e histórico**, "para começar sem perder nada" |
| **Actana** | equipe técnica faz a migração completa, sem interrupção das atividades |
| **Zenamu** | gratuita e **feita pelo suporte**: o cliente baixa a lista e os saldos e manda; aceita CSV em lote; ainda envia o e-mail de boas-vindas aos clientes na importação |
| **MioSalon** | **autoatendimento**: planilha-modelo para preencher, importação com mapeamento automático; traz clientes, **serviços e preços, produtos e estoque, assinaturas, vales e saldos pré-pagos** |
| **AppBarber** (lado de saída) | exportação **pelo chat do suporte**, não por botão |
| **Trinks / Avec / Salão99 / Belle / Simples Agenda** | **não achamos documentação pública** de importação ou exportação. Nada a afirmar |

**Leitura.** O concorrente brasileiro trata migração como **serviço de onboarding feito por gente**
(grátis, para fechar a venda). Ninguém mostra, antes de gravar, quanto dinheiro aquela lista
representa. E quem faz autoatendimento (MioSalon) obriga a pessoa a **reformatar a planilha no modelo
dele**, que é exatamente o atrito que a esteira remove.

### 1.3 Tecnologia que roda sem mandar dado para fora
- **OCR no navegador:** `tesseract.js` (porte do Tesseract em WebAssembly) lê imagem em mais de 100
  idiomas, incluindo português, **sem servidor**, e os materiais descrevem isso como ganho de
  privacidade e de custo.
- **Modelo de linguagem no navegador:** `WebLLM` (WebGPU, API no formato da OpenAI, modelos desde
  ~360 milhões de parâmetros) e `Transformers.js` (WebGPU com **reserva em WebAssembly/CPU**; faz
  classificação, embeddings, visão e geração). Tudo roda no aparelho. Limite real: precisa de
  baixar o modelo (centenas de MB) e de hardware razoável; celular barato não é o alvo.
- **Direito do titular:** a portabilidade (LGPD art. 18, V) é do **titular** (o cliente final), contra
  o controlador, e depende de regulamentação da ANPD. **O salão não é o titular: é o controlador.**
  O pedido dele ao sistema antigo se apoia em ser a lista **dos dados da empresa dele** e em o antigo
  sistema ser seu operador (que age conforme a instrução do controlador). Não citar o art. 18, V no
  texto do pedido.

## 2. Copiar e inovar, decidido

**Copiar (já provado por alguém):**
1. **Processar no navegador** (Dromo). Aqui vira o **padrão**, não um plano caro (seção 3).
2. **Corrigir dentro do fluxo e devolver o Excel anotado** (OneSchema): a quarentena baixável
   volta como a mesma planilha com as células problemáticas marcadas e uma coluna de explicação.
3. **Migração assistida feita por gente** (Belasis, Actana, Zenamu): o "modo assistido" (seção 10) é a
   arma de venda do alpha, usando a **mesma esteira**, não um processo paralelo.
4. **O leque de entidades de salão** (MioSalon): serviços e preços, produtos, saldos e vales
   pré-pagos, pacotes e assinaturas, além de clientes.
5. **Agenda e histórico** (Belasis): sem agenda futura o salão não consegue virar de sistema sem
   marcar horário em dobro.

**Inovar (ninguém tem):**
1. **Importador que conhece o destino.** A prévia mostra **o valor em reais** ("47 clientes já
   deviam ter voltado, R$ 6.300") calculado pelo mesmo `computeCycle` que vai gravar. Importador
   genérico nunca poderá dizer isso.
2. **A esteira diz o que falta e como pedir.** Níveis N0 a N3 e, ao fim, a mensagem pronta para o
   suporte do sistema antigo pedir o que subiria o nível ("a data de cada atendimento").
3. **Aprendizado entre contas, com privacidade** (k-anonimato): as assinaturas de sistema nascem do
   uso. Os concorrentes de importação aprendem esquema por cliente; aqui o setor inteiro alimenta.
4. **IA e OCR sem terceiros**, no aparelho. Resolve de uma vez "manda dado para fora" e "pesa na
   Vercel", o que quebrava a regra da política de privacidade (seção 7).
5. **Controle de totais** (técnica de contabilidade, que nenhum importador pergunta): "quantos
   clientes o seu sistema antigo mostra?" O dono digita; a esteira compara com o que leu e **acusa a
   diferença**. Se faltarem 214, algo ficou para trás.
6. **Correção que volta.** O CSV da quarentena, corrigido e devolvido, é reconhecido como correção
   do mesmo lote, não como um arquivo novo.
7. **Retroteste (rev. 98):** quando vier histórico (N2), mostrar "se o CICLO existisse em março,
   teria mandado você chamar 38 pessoas; 14 voltaram; eram R$ 2.100", **medido nos dados do próprio
   salão** e com a amostra dita. É a prova no momento da decisão de pagar (`docs/98`, seção 5).
8. **Lista de virada.** Ao fim: "o que fazer no dia em que você parar de usar o outro sistema" (agenda
   futura, saldos, avisos de mudança de número).

## 3. Arquitetura: no navegador por padrão

**Decisão:** o núcleo da esteira (`src/core/ingestao/`, funções puras, sem I/O, regra 5) roda em um
**Web Worker no navegador**. O servidor **nunca recebe o arquivo cru**: recebe só as linhas já
normalizadas, em lotes, e **revalida tudo com Zod** (nunca confiar no que o navegador diz).

**Por que:**
- **Privacidade por arquitetura:** a lista de clientes de um salão não passa por servidor nosso
  antes de o dono ver e confirmar. Dromo cobra por isso; aqui é o padrão.
- **Tira do servidor** o parser de formato hostil (zip-bomb, macro, XML externo): se o arquivo for
  malicioso, trava a aba de quem o enviou, não o nosso servidor.
- **Resolve o limite de tamanho:** a Vercel limita o corpo da requisição de função (conferir o valor
  atual no plano; era 4,5 MB). Hoje o teto declarado é 5 MB. No navegador não há esse teto, e só as
  linhas normalizadas sobem.
- **Habilita OCR e modelo no aparelho** (seções 6 e 7) sem enviar nada a terceiro.

**Custos e como mitigar (sem fingir que não existem):**
- *Celular fraco e arquivo grande:* o pipeline determinístico é leve e roda em qualquer aparelho. O
  que é pesado (OCR, modelo) é **opcional e sob demanda**, com aviso de download.
- *Mobile-first:* quem tem a lista no computador do salão importa lá. Para quem está no celular,
  oferecer "continuar no computador" (link ou QR).
- *Sem o arquivo no servidor, o suporte não consegue ver o que o cliente viu:* por isso existe o
  **modo assistido** (seção 10), em que a pessoa envia o arquivo de propósito.
- *Duas execuções (navegador e servidor) da mesma regra:* é o mesmo código em TypeScript, importado
  dos dois lados, **com um teste que roda o corpus nos dois e exige saída idêntica**.

## 4. O contrato de saída: o que o Motor consome

O Motor (`computeCycle`) recebe, por cliente e serviço, o **histórico de datas de visita**. Hoje a
importação só entrega a última visita; por isso o Motor usa o ritmo padrão do serviço. A esteira
produz um **registro canônico** por pessoa:

| Nível | O que veio | O que o Motor entrega |
|---|---|---|
| N0 | nome + telefone | lista de clientes, chamar à mão, sem previsão |
| N1 | + última visita | quem já devia ter voltado, pelo ritmo padrão do serviço |
| N2 | + histórico de visitas | **ritmo real de cada cliente** |
| N3 | + serviço, valor e profissional por visita | **valor em risco em reais**, ticket, serviço e profissional preferidos |
| Extras | aniversário (`clients.birth_date` já existe), observações, e-mail, origem | aniversariantes, texto de volta personalizado |

**Outras entidades de salão** (copiadas da pesquisa), cada uma na sua onda e com o seu cuidado:
serviços e preços; produtos e estoque; **pacotes com sessões restantes e saldos pré-pagos**
(dinheiro do cliente final: entram **só depois de revisão**, nunca calados); assinaturas do clube;
**agenda futura** (entra como agendamento real, com aviso, para não marcar horário em dobro).

Cada importação termina dizendo o nível alcançado e o que faltou para subir.

## 5. As estações

Cada estação tem entrada, saída, modo de falha e teste próprio.

**E0 · Recepção e segurança.** Tipo decidido pelos **bytes** (nunca pela extensão); limites de
tamanho e de expansão (zip-bomb); macro recusada; XML sem entidade externa; **fórmula vira texto e
nunca é avaliada**. O arquivo cru não sobe e **não é guardado**.

**E1 · Formato, por conteúdo.** Texto delimitado (vírgula, ponto e vírgula, tab, barra vertical,
detectado pelo que se repete), Excel (`.xlsx`, `.xls`, `.ods`), JSON e NDJSON, vCard (`.vcf`, contatos
do celular), CSV de contatos do Google, tabela HTML colada, texto colado, PDF com texto, e
**imagem e PDF escaneado** (seção 6). Não identificou: diz os formatos aceitos, sem adivinhar.

**E2 · Decodificação.** Codificação (UTF-8 com ou sem BOM, Latin-1, Windows-1252, UTF-16) escolhida
por pontuação de acentos plausíveis; datas do Excel guardadas como número (calendários 1900 e 1904);
células mescladas; linhas e colunas ocultas reportadas; **todas as abas**, cada uma candidata.

**E3 · Descoberta de tabelas.** O cabeçalho quase nunca está na linha 1. Acha o bloco denso, a linha
de cabeçalho, descarta título, filtros ("Período: ..."), total e rodapé (contados como ignoradas),
separa **duas tabelas na mesma aba** e desdobra relatórios **agrupados por profissional** (o nome
solto numa linha vira coluna). **(rev. 98)** Achar a tabela em planilha bagunçada é difícil até
para o estado da arte (um modelo dedicado da Microsoft, o TableSense, fica em ~86% de precisão): a
heurística **vai** errar, então a prévia (E9) deixa **ajustar o retângulo da tabela**, e um erro de
detecção nunca vira dado errado calado.

**E4 · Perfilamento de colunas.** Mede o conteúdo antes de dar nome: fração que parece telefone,
e-mail, data (e em qual formato), dinheiro (`1.234,56`, `R$ 80`, centavos), nome próprio, texto livre,
documento, identificador, ou categoria de poucos valores (serviço, profissional, situação); taxa de
vazio, cardinalidade, tamanho médio.

**E5 · Classificação de campo.** Quatro sinais, **o conteúdo pesa mais que o nome**: perfil da coluna;
cabeçalho normalizado contra um dicionário PT/EN/ES com sinônimos ("cel", "whats", "fone",
"contato"); assinatura conhecida (E11); vizinhança. Cada coluna sai com **campo canônico +
confiança**: ≥ 0,9 segue; 0,6 a 0,9 sugere e pede um toque; abaixo disso pergunta ou ignora. **(rev. 98)** A
classificação é **da tabela inteira de uma vez**, com restrições entre colunas (um telefone
principal, um nome, datas coerentes entre si, uma coluna não pode ser duas coisas): o ganho dos
modelos de tipagem de coluna da literatura (Sato) vem do contexto das outras colunas, não da coluna
isolada. Por regra, não por sorte:
- **dia/mês ou mês/dia** pela distribuição (valor com primeiro número acima de 12 define); se nenhum,
  pergunta mostrando os dois;
- coluna que mistura "Maria 11 99999-0000": separa; vários telefones numa célula: separa e usa o
  celular;
- **o grão do arquivo:** uma linha por cliente ou por atendimento? Telefone repetido denuncia
  histórico. É a decisão que separa N1 de N2/N3;
- **documento (CPF/CNPJ):** reconhecido e **descartado** (o Motor não precisa; minimização);
- **coluna que parece saúde:** marcada sensível, regra da seção 8.

**E6 · Normalização.** Telefone para E.164 (sem DDD assume o do salão; com 55 ou parênteses; nono
dígito; fixo separado de celular); nome sem estragar "da Silva" nem "McDonald"; e-mail com
**sugestão** (nunca troca calado) para erro comum (`gmial.com`); data em ISO; dinheiro em
**centavos** (regra 3); serviço e profissional casados por similaridade com o catálogo do salão, e o
que não casa vira pergunta.

**E7 · Resolução de entidades.** Mesma pessoa em várias linhas, no arquivo e **contra a base já
existente**. **(rev. 98)** Em vez de uma regra única, **pontuação por campo** no estilo
Fellegi-Sunter (a técnica clássica de junção de registros, usada no Splink): bloqueio para não
comparar todos com todos (mesmo hash de telefone, mesmo aniversário, mesma chave fonética do nome);
peso para telefone igual, nome parecido (distância de edição) e aniversário igual; **ajuste de
frequência** (um "Maria Silva" vale menos como evidência do que um nome raro). Três destinos:
**funde**, **pergunta** ("estas duas são a mesma pessoa?") ou **não funde**. O hash do telefone (já
usado hoje) continua sendo o bloqueio principal. Nomes muito diferentes no mesmo telefone são
**família ou recepção**: marca "telefone compartilhado", não funde. Nunca sobrescreve dado preenchido pelo salão com vazio; em conflito vence o mais recente e o
outro vai ao relatório.

**E8 · Validação, quarentena e controle de totais.** **(rev. 98)** As validações são uma **lista
declarativa de expectativas nomeadas** ("telefone com 10 ou 11 dígitos", "data não está no futuro",
"nome não vazio"), no estilo dos contratos de dados (Great Expectations, Frictionless Table Schema), e
o relatório da importação sai **sempre no mesmo formato**. Cada linha sai com destino (ouro, ouro com aviso,
quarentena com motivo em código, ignorada). A quarentena sai como **a mesma planilha anotada** (copiado
do OneSchema): célula problemática marcada e coluna com a explicação, no formato que a esteira relê,
para o dono corrigir e devolver. **Controle de totais:** pergunta quantos clientes o sistema antigo
mostra e acusa a diferença.

**E9 · Prévia: "entendi assim".** Uma tela: cinco linhas *como veio → como vai ficar*, contagens, no
máximo **três perguntas** (com a resposta provável marcada), o **valor em reais** ("47 clientes, R$
6.300"), o nível alcançado e o que falta para subir, a **declaração** (seção 9), **o ajuste do retângulo da tabela (rev. 98)** e edição em massa
(achar-e-trocar, corrigir uma coluna inteira) sem sair da tela.

**E10 · Carga.** Lotes de 100, transacional por lote, **idempotente** (hash do arquivo + chave da
linha: o mesmo arquivo duas vezes não duplica). Cada linha criada leva o `batch_id`; **"desfazer esta
importação" por 7 dias** apaga o que ela criou e devolve o que alterou. **Não gera caixa, comissão nem
baixa de estoque.** Enfileira o cálculo do Motor em `job_queue` (com `dedupe_key`) e mostra progresso.

**E11 · Aprendizado.** Ao confirmar um mapeamento, a esteira guarda a **assinatura estrutural** (lista
normalizada de cabeçalhos e perfil de colunas, **nunca dado de pessoa**) ligada ao mapeamento. Na
próxima conta com o mesmo sistema: "parece um arquivo do AppBarber", sem perguntas. Só vira assinatura
global depois de aparecer em **3 contas diferentes** (k-anonimato), para o cabeçalho não carregar nome
de salão.

## 6. Foto, PDF escaneado e print de tela (entra no plano, com regras)

Entra como **Onda 4**, e só no aparelho. Nada de OCR de terceiros.

- **Como:** `tesseract.js` no navegador, idioma português, sob demanda (baixa os dados do idioma só
  quando a pessoa escolhe uma foto). PDF escaneado: renderiza cada página em imagem no navegador e
  passa pelo mesmo OCR. Print de tela e foto de papel: igual.
- **A parte difícil não é ler as letras, é reconstruir a tabela.** O OCR devolve texto com posição;
  a esteira agrupa por linhas e colunas pela posição, e depois entra no E3 em diante como se fosse
  uma planilha. Fotos tortas, sombra, papel dobrado e letra manuscrita reduzem muito a qualidade.
- **Regras de honestidade (não negociáveis):**
  1. **Toda linha vinda de OCR passa por revisão**, com a imagem original ao lado. Nunca "ouro"
     automático.
  2. **Telefone vindo de OCR é conferido dígito a dígito**: 1 dígito trocado é um cliente que nunca
     receberá a mensagem, e pior, outra pessoa pode recebê-la.
  3. A tela diz a **confiança por linha** e coloca no topo as que o OCR duvidou.
  4. Conta como N0 ou N1, **nunca N3**: valores lidos de foto não alimentam "valor em risco".
- **Quando vale:** a pessoa só tem um relatório impresso ou uma foto do caderno. É o último recurso,
  porque funciona onde nada mais funciona, e a barra de qualidade é a mais baixa de todas.
- **Custo:** o dado do idioma e o motor pesam alguns megabytes e rodam no aparelho da pessoa. Não
  pesa na Vercel e não manda nada para fora.

## 7. IA: no aparelho primeiro, de terceiros só com parecer

**Camada 1, sem IA (padrão e base de tudo):** regras, estatística e dicionário. Resolve a grande
maioria e é a única exigida para o alpha.

**Camada 2, modelo no aparelho (opcional, ligado pela pessoa):** `Transformers.js` ou `WebLLM`, com
modelo pequeno, para os casos que a camada 1 deixou como pergunta (coluna ambígua, serviços com
nomes parecidos, observação em texto livre). **Nenhum dado sai do aparelho.** Desligado em aparelho
sem WebGPU/RAM suficiente. A saída do modelo **nunca decide sozinha**: vira uma sugestão marcada na
prévia, com a confiança dita.

**Camada 3, IA de terceiros (servidor ou API externa):** **só com parecer jurídico**, e desligada
por padrão. A política de privacidade e a guarda do PR #144 dizem que o CICLO não manda dado de
cliente a provedor de IA externo; ligar isto muda a política, a lista de operadores, a página pública
e exige contrato de operador e análise de transferência internacional. Se algum dia entrar, só
cabeçalhos e **amostra anonimizada**, nunca a lista.

**Pergunta ao advogado:** processar no aparelho da própria pessoa, com modelo baixado de uma CDN
(só o modelo, nenhum dado de cliente), conta como "compartilhar com terceiro"? A leitura provável é
que não, mas é ele que responde.

## 8. Dado de saúde numa planilha

**Padrão (decidido): não importar.** A esteira detecta colunas e linhas que parecem saúde (alergia,
queixa, medicamento, "obs. clínica", gestante, procedimento estético invasivo) e **as deixa de fora**,
dizendo na prévia: "Esta coluna parece dado de saúde. Não importei. Dá para registrar na ficha de
cada cliente, onde fica protegido." O CICLO já cifra o dado de saúde por negócio (AES-256-GCM, chave
própria) e exige verificação em duas etapas na exportação; importar texto livre por fora disso seria
um retrocesso.

**Caminho possível, só com decisão e parecer:** importar essas colunas **direto para o cofre
cifrado**, com (a) a declaração de base legal do salão marcada de forma própria, (b) trilha de
acesso e (c) nunca passando pela área de espera em texto aberto (cifrar no navegador antes de subir,
ou subir direto ao cofre). Decisão do Eduardo com o advogado. Sem ela, vale o padrão.

## 9. O texto da prévia (proposta para o advogado reescrever)

A prévia mostra, antes do botão "Importar", uma declaração que a pessoa precisa marcar. **O texto
abaixo é proposta minha, não é parecer, e não vai ao ar sem a redação do advogado.**

> **Proposta curta:** "Declaro que tenho o direito de usar esta lista de clientes para atendê-los e
> chamá-los de volta, e que o CICLO a processa a meu pedido, só para isso."

> **Proposta longa (se o advogado preferir):** "Esta lista é da minha empresa. Declaro que os
> clientes nela me passaram os dados para eu atendê-los, e que posso usá-los para chamá-los de volta
> quando fizerem sentido. Entendo que a responsabilidade pelo uso da lista é minha e que o CICLO só
> a processa a meu pedido e para esse fim."

**Pontos que o advogado precisa fechar:**
1. Se "chamá-los de volta" é compatível com a finalidade original dos dados no sistema antigo. A
   resposta muda o texto.
2. **Importar o número não é consentimento para mandar mensagem.** O Motor hoje só abre o WhatsApp do
   próprio dono (manual); a lista importada deve entrar com o estado de comunicação "desconhecido" e
   **nunca disparar nada automático**.
3. **Como provar a declaração:** gravar em trilha (`audit_log`, ação própria, com a versão do texto e
   o `batch_id`), no mesmo espírito do `terms_acceptances`.
4. Se o salão precisa avisar os clientes importados de que mudou de sistema (aviso de mudança de
   operador).

## 10. Modo assistido: "manda o arquivo que a gente importa" (copiado dos concorrentes)

É como o mercado brasileiro vende (Belasis, Actana, Zenamu) e é como o alpha vai ser vendido. Usa
**a mesma esteira**, rodando em modo de operador.

- O salão **envia o arquivo de propósito** por um link seguro (não há o arquivo cru no fluxo normal;
  aqui há, porque a pessoa decidiu enviar).
- O arquivo fica no **mínimo necessário e pelo mínimo de tempo** (apaga em 7 dias, como a área de
  espera), cifrado, e **toda abertura é registrada** em trilha.
- Quem opera vê a mesma prévia que o dono veria, resolve as perguntas com o dono por mensagem, e
  confirma. O dono vê o valor ("47 clientes, R$ 6.300") antes de dizer sim.
- **O que muda para a política:** o CICLO passa a ter acesso a uma lista de terceiros por pedido do
  salão. É uso previsto de operador, mas **o texto da política e o contrato de operador (minuta do
  #144) precisam citar este caso**, e o advogado confirma.
- Para o alpha: dá para começar **só com isso**, sem nenhuma tela nova, usando o importador atual e
  as ondas seguintes aos poucos.

## 11. Onde mora e o que existe no banco

- `src/core/ingestao/` (puro, roda no navegador **e** no servidor): `farejarFormato`, `decodificar`,
  `acharTabelas`, `perfilarColunas`, `classificarCampos`, `normalizar`, `resolverEntidades`,
  `validar`, `controleDeTotais`.
- `src/server/services/ingestao/`: recepção das linhas já normalizadas (revalidação Zod), carga,
  desfazer, aprendizado, modo assistido.
- Tabelas novas, **cada uma com RLS + `force` + política + teste de isolamento**: `import_batches`
  (hash, nível, contagens, estado, versão da declaração), `import_rows` (área de espera, só o
  normalizado) com **retenção de 7 dias**, `import_signatures` (global, **sem `tenant_id` e sem dado de
  pessoa**, escrita só pelo servidor).
- Migrations só aditivas e aplicadas antes do código.
- Bibliotecas de leitura de Excel: **conferir licença e histórico de falhas de segurança antes de
  instalar**. Rodam no Web Worker; limite de memória e de tempo.

## 12. Como saber que extrai corretamente

1. **Corpus ouro** em `tests/fixtures/ingestao/` (arquivo + gabarito por campo). Começa **sintético**:
   um gerador produz dezenas de variações imitando estilos de sistema (título e filtros no topo,
   cabeçalho na linha 4, `;` e Windows-1252, datas em número, telefone em 6 formatos, uma linha por
   atendimento, relatório agrupado por profissional, totais no rodapé). Cobre as **classes** de
   problema sem nenhuma amostra de concorrente; amostras reais, anonimizadas, refinam depois. Para o
   OCR: imagens geradas (texto renderizado com ruído, rotação e baixa resolução) com gabarito.
2. **Métricas:** acerto de classificação de coluna, F1 por campo, taxa de pergunta, taxa de
   quarentena, tempo e, acima de tudo, **falso-aceite** (meta zero).
3. **Propriedade:** o resultado **não muda** se embaralhar as colunas, trocar separador ou
   codificação, inserir título ou reordenar linhas.
4. **Invariante de contagem** e **controle de totais** em todo arquivo do corpus.
5. **Mutação:** cada classificador é quebrado de propósito e o corpus tem que reprovar.
6. **Paridade navegador e servidor:** mesmo corpus nos dois, saída idêntica.
7. **Hostil:** zip-bomb, macro, XML externo, fórmula, arquivo gigante, binário com extensão errada.
8. **Ida e volta:** exporta uma base, importa em conta vazia, compara contagens e campos.
9. **Prova no navegador** a 390 px com arquivo real, e em aparelho Android fraco para o que é pesado.
10. **(rev. 98) Modo sombra:** toda versão nova de classificador roda em paralelo à atual e só
    **registra** o que faria, até haver semanas de resultado real.
11. **(rev. 98) Portão de regressão no CI:** as métricas do corpus (falso-aceite, acerto de coluna)
    têm piso; PR que as piora reprova.
12. **(rev. 98) Telemetria de correção:** a taxa em que o dono corrige a coluna que a esteira
    classificou é a métrica de qualidade real (sem dado pessoal); cada correção em produção vira caso
    permanente do corpus.

## 13. O que precisa do advogado (lista única, para o dossiê do #144)

1. Processamento **no aparelho** (IA e OCR locais) conta como compartilhamento com terceiro? (seção 7)
2. Redação da **declaração da prévia** e as 4 perguntas da seção 9.
3. **Dado de saúde** em planilha: manter "não importa" ou liberar para o cofre cifrado? (seção 8)
4. **Modo assistido:** o texto da política e o contrato de operador cobrem o recebimento do arquivo
   pelo CICLO? Retenção de 7 dias é adequada? (seção 10)
5. Se um dia houver **IA ou OCR de terceiros:** operador, transferência internacional e política.
6. Lista importada **sem consentimento de contato**: limites para o uso do Motor.

## 14. Ondas de construção

Cada onda é uma sequência de PRs pequenos, com teste, mutação e prova no navegador. **Nenhuma onda
depende de amostra de concorrente para começar.**

- **Onda 0 · Modo assistido já (sem código novo grande).** Usar o importador atual + um procedimento
  escrito para o alpha: o salão manda o arquivo, o Eduardo importa com ele, mostra o valor. Depende de
  decidir a seção 10 com o advogado.
- **Onda 1 · Esteira mínima, no navegador (N0 e N1).** E0 a E6, E8 com planilha anotada e controle de
  totais, E9 com o valor na tela, `.xlsx`, corpus sintético de 40 variações, paridade
  navegador/servidor. *Pronto quando:* corpus com falso-aceite zero, invariante fechando, e um arquivo
  bagunçado (título, cabeçalho na linha 4, `;`, Windows-1252) entra sem uma pergunta.
- **Onda 2 · Histórico e entidades (N2 e N3).** Grão, relatório agrupado, E7 completo, visitas
  importadas como atendimentos **marcados como importados** (sem caixa, comissão nem estoque).
  **Revisão antes de começar** (dinheiro).
- **Onda 3 · Aprendizado, desfazer, retenção** (E11, E10 completo).
- **Onda 4 · Formatos extras e OCR no aparelho:** vCard, CSV do Google, JSON, HTML colado, PDF com
  texto, e foto/PDF escaneado/print com as regras da seção 6.
- **Onda 5 · Outras entidades:** serviços e preços, produtos, **saldos e pacotes** (revisão), assinaturas
  e **agenda futura** (aviso de horário em dobro).
- **Onda 6 · Saída completa:** exportação `.zip` de tudo com `LEIA-ME.txt`, teste de ida e volta,
  escape de fórmula via `csv-seguro.ts`; **(rev. 98)** descritor `datapackage.json` (Frictionless
  Data Package) para qualquer ferramenta ler a base; dado de saúde só com o AAL2 que a exportação de
  conta já exige.
- **Onda 7 · Modelo no aparelho (opcional)**, depois que as camadas 1 e 4 estiverem medidas. Camada
  de terceiros: **só com parecer jurídico**.

## 15. Riscos

| Risco | Resposta |
|---|---|
| Classificar errado e ninguém notar | Falso-aceite com meta zero, confiança por coluna, prévia obrigatória, controle de totais |
| OCR trocar um dígito de telefone | Revisão obrigatória linha a linha, conferência dígito a dígito, nunca N3 |
| Importar a mesma lista duas vezes | Idempotência por hash + chave da linha |
| Fundir duas pessoas (família no mesmo telefone) | Telefone compartilhado nunca funde |
| Importação ruim estragando base boa | Desfazer por 7 dias; nunca sobrescreve preenchido com vazio |
| Arquivo malicioso | Roda no navegador de quem o enviou; E0; testes hostis |
| Lista de terceiros guardada para sempre | Retenção de 7 dias na área de espera e no modo assistido |
| Celular fraco travando | Camada leve em qualquer aparelho; OCR e modelo opcionais e sob demanda; "continuar no computador" |
| Importar contato e mandar mensagem sem consentimento | Estado de comunicação "desconhecido", nada automático |
| Prometer na venda o que o arquivo não traz | Nível dito na tela; texto público só cita um sistema depois de ele passar pelo corpus |

## 16. Texto pronto para o salão pedir o arquivo (corrigido)

"Olá, quero exportar a base de clientes da minha empresa (nome, telefone, e-mail, data de cada
atendimento, serviço e valor, se houver) em planilha. Podem me enviar ou dizer como baixar?"

Sem citar o art. 18, V: aquele direito é do titular (o cliente final), não da empresa.

Pedir **a data de cada atendimento**, e não só o cadastro, é o que leva o salão de N1 a N2.

## 17. Fora do escopo agora

Financeiro completo do outro sistema (comissões, fechamentos de caixa, notas): errar custa o dinheiro
do cliente e raramente exportam. IA de terceiros e OCR de terceiros (seções 6 e 7).
