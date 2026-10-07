# 97 · Plano do conversor de dados: trazer a base de outro sistema e levar a própria base embora

Escrito em 2026-10-07. Objetivo: quem usa AppBarber, Trinks, Avec, Salão99, Simples Agenda, Booksy
ou planilha própria chega ao CICLO sem digitar, e vê na primeira conversa quem sumiu e quanto vale
chamar de volta. A saída tem que ser tão boa quanto a entrada: a base é do dono.

Regra deste plano: **nada de promessa sobre um sistema que não vimos um arquivo dele.** Cada
conversor só entra no ar depois de testado com um export real.

## 0. O que sabemos (e o que não)

**Verificado em 2026-10-07**
- **AppBarber:** o site diz que dá para exportar a base ("Consigo exportar minha base de dados? Sim.
  Entre em contato conosco pelo chat on-line que informamos como proceder"). Ou seja, **não é um
  botão de autoatendimento: o salão precisa pedir ao suporte.** A central de ajuda
  (`appbarber-appbeleza.zendesk.com`) bloqueou a leitura automática (403).
- **Trinks:** a central de ajuda tem uma seção "Cliente" (cadastro, débito, anamnese, crédito) e
  **nenhum artigo de exportação ou importação** nos títulos. Não confirma nem nega que exista.

**Não verificado (a busca não achou documentação pública):** exportação de Avec, Salão99, Belle,
Simples Agenda, Booksy. Não afirmar nada sobre elas até ver o arquivo.

**Consequência para a venda:** a oferta "traga sua lista do AppBarber" depende de o salão pedir o
arquivo ao suporte do AppBarber e esperar. Isso vira passo da abordagem (seção 5), com roteiro
pronto, em vez de ser tratado como um clique.

## 1. O que o importador já faz (lido no código em 2026-10-07)

`src/server/services/importacao-clientes.ts`, tela `/admin/clientes/importar`:
- CSV com cabeçalho; o separador (`,` ou `;`) é detectado; a **codificação do Excel em português é
  tratada** (BL-51); até 5.000 linhas e 5 MB.
- Mapeamento manual de colunas, com chute pelo nome: `name`, `phone`, `email`, `tags`, `lastVisit`,
  mais "que serviço essas pessoas fazem com você?" (necessário para entrar no Motor de Ciclo).
- Datas em `dd/mm/aaaa`; a prévia avisa quando a coluna de data não é legível (BL-51).
- Telefone normalizado para E.164 e deduplicado por hash; linha ruim vira "pulada" ou "erro", sem
  derrubar o arquivo.
- Arquivo `.xlsx` é recusado com instrução de salvar em CSV.
- Depois de importar, calcula a previsão do Motor ("47 já deviam ter voltado").

## 2. As lacunas, em ordem de impacto na venda

| # | Lacuna | Por que importa |
|---|---|---|
| L1 | Só clientes: **sem histórico de atendimentos** | O Motor prevê melhor com 2 ou mais visitas por cliente. Com só a última visita, a previsão usa o ritmo padrão do serviço |
| L2 | `.xlsx` não é lido | Muitos sistemas exportam Excel. O salão tem que converter, e é aí que desiste |
| L3 | Sem predefinição por sistema | O dono tem que mapear coluna por coluna, num arquivo que ele não conhece |
| L4 | Campos que o export traz e o CICLO não lê: aniversário, observações, número de visitas, ticket médio, profissional preferido, origem | Perde valor que já existia no outro sistema |
| L5 | Telefone com formatos esquisitos (sem DDD, com 55, com texto) | Cliente sem telefone válido não pode ser chamado |
| L6 | Sem **relatório do que não entrou** para baixar | O dono vê "12 puladas" e não sabe quais |
| L7 | A exportação de saída leva só 4 colunas de clientes (nome, telefone, e-mail, última visita) | Ver seção 4 |

## 3. Entrada: o que construir, em ordem

Cada etapa é um PR pequeno, com teste e prova no navegador. Etapas E1 a E3 não dependem de arquivo de
concorrente; E4 em diante dependem.

- **E1 · Ler `.xlsx` direto** (L2). Biblioteca de leitura só no servidor, limite de tamanho e de linhas
  iguais ao CSV, só a primeira planilha, fórmulas viram texto. Sem macro. Teste com arquivo gerado.
- **E2 · Relatório do que não entrou** (L6). Botão "baixar linhas que não entraram" em CSV, com o
  motivo por linha. **Reusar o escape de fórmula que já existe** (`src/core/text/csv-seguro.ts`, usado
  pela exportação de clientes), nunca escrever outro.
- **E3 · Telefone tolerante** (L5). Aceitar `55`, parênteses, ponto, vários telefones na mesma célula
  (usar o primeiro celular) e contar quantos ficaram sem número. Teste com a lista de formatos reais
  de BR.
- **E4 · Coleta de amostras reais.** Meta: 1 export de cada sistema que os primeiros salões usam.
  Como conseguir: pedir ao salão que já usa (e que concorda) e anonimizar antes de guardar. Guardar em
  `tests/fixtures/importacao/<sistema>.csv`, **sem dado pessoal real** (nomes e telefones trocados
  por fictícios mantendo o formato). Sem amostra, não há predefinição.
- **E5 · Predefinição por sistema** (L3). Uma lista `{ sistema, reconhecer(colunas), mapa }`: se as
  colunas do arquivo batem com a assinatura conhecida, a tela diz "parece um arquivo do AppBarber" e
  já vem mapeada. Se não bate, cai no mapeamento manual de hoje. Cada predefinição nasce com uma
  fixture e um teste que a reprova se a assinatura mudar.
- **E6 · Campos extras** (L4). Aniversário e observação entram se o CICLO já tem onde guardar
  (verificar `clients`); número de visitas e ticket só se forem usados por alguma tela, senão não
  coletar (minimização, LGPD).
- **E7 · Histórico de atendimentos** (L1), só se algum export trouxer. Importar visitas passadas como
  atendimentos concluídos marcados como importados, para o Motor ter ritmo real. É a etapa mais
  arriscada (dinheiro, comissão, estoque): **não gerar caixa, comissão nem baixa de estoque**. Passa
  por revisão antes de começar.

## 4. Saída: levar a própria base embora (L7)

Hoje existem a exportação da ficha individual do cliente (LGPD) e `/admin/clientes/exportar`, que
baixa um CSV só de clientes com 4 colunas, no mesmo formato que o importador lê. O que falta para o
dono sentir que a base é dele, e para a oferta "se um dia você sair, leva tudo" ser verdade:
- **S1 · Exportação completa em um arquivo:** clientes, atendimentos, serviços, profissionais,
  pagamentos, estoque. CSV por tabela dentro de um `.zip`, com cabeçalhos em português e um
  `LEIA-ME.txt` explicando cada arquivo. Dados de saúde (anamnese) **só com o AAL2 que a exportação
  de conta já exige** e cifrados no arquivo ou separados, a decidir com o parecer jurídico.
- **S2 · O formato de saída deve ser relido pelo próprio importador.** Teste de ida e volta:
  exportar uma base, importar em uma conta vazia, comparar contagens. É o teste que impede a
  exportação de virar enfeite.
- **S3 · Toda célula de texto nova passa por `csv-seguro.ts`**, como a exportação de clientes já faz.

## 5. A abordagem de venda que este plano sustenta

1. O salão que usa AppBarber **pede o arquivo ao suporte** (mensagem pronta na seção 6). Enquanto o
   arquivo não chega, o CICLO já mostra a calculadora ("escreva quem você lembra").
2. Quando chega, a importação é feita **com o dono na tela**, em 15 minutos.
3. A tela Recuperar mostra o valor. É isso que fecha.
4. Se o arquivo não entra do jeito certo, o fallback é a planilha mínima (nome, telefone, última
   visita), que o dono monta em 10 minutos. Modelo de planilha para baixar na própria tela.

## 6. Textos prontos

**Pedido ao suporte do concorrente (o salão envia):** "Olá, quero exportar minha base de clientes
(nome, telefone, e-mail e data da última visita) em planilha. Podem me enviar ou dizer como baixar?"
Vale para qualquer sistema; é direito do titular dos dados (LGPD, art. 18, V, portabilidade).

**Aviso na tela de importar (a escrever só com amostra real):** "Parece um arquivo do {sistema}. Já
escolhi as colunas; confira antes de importar."

## 7. Critério de pronto

- E1 a E3: testes verdes, provado no navegador a 390 px com arquivo real gerado pela própria pessoa.
- E5: **uma predefinição só vale com fixture real anonimizada e teste que a reprova ao mudar a
  assinatura**. Predefinição sem fixture não entra.
- S2: o teste de ida e volta passa em CI.
- Nenhum texto público promete "importamos de {sistema}" antes de a predefinição dele estar no ar.

## 8. Fora do escopo agora

Conversor de agenda futura (agendamentos marcados no outro sistema), de financeiro e de estoque.
Raramente exportam, e errar aqui custa dinheiro do cliente.
