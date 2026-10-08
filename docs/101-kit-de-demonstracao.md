# Kit de demonstração · pacote Advocacia (docs/101 T5b.4)

> Para o Eduardo levar a um escritório. Tudo aqui foi conferido contra o que está construído na branch
> `feat/advocacia-mvp` em 2026-10-08, no escritório-modelo `demo-alvorada-advocacia` (gerado por
> `scripts/seed-demo-escritorio.mjs`, só local). Onde o anexo 06 pedia algo que ainda não existe, está
> escrito "não mostrar". A uma página e as respostas difíceis estão marcadas **precisa_revisao**: texto de
> publicidade de serviço jurídico passa pelo advogado revisor antes de sair.

## 1. Antes de começar

- Rodar o gerador de novo (cada rodada sorteia senha nova e recoloca os cenários no lugar):
  `SEED_SENHA=<uma senha> node scripts/seed-demo-escritorio.mjs`. O teste de sanidade também o recria.
- Entrar como a direção (e-mail impresso no fim do gerador). O pacote exige segundo fator.
- Celular ou janela estreita: o pacote foi desenhado para 390 px e medido a 375, 768 e 1280.
- A faixa "Dados fictícios de demonstração" aparece em toda tela e não some. É de propósito.

## 2. Roteiro de 5 a 7 minutos (falado, tela a tela)

1. **Abertura (30 s).** "Isto é um escritório fictício. Vou mostrar o que acontece de manhã, quando a pessoa
   abre o painel." Abrir **Hoje**.
2. **Hoje e a intimação de ontem (90 s).** Filtro **Exige direção**. A intimação de ontem já aparece vinculada
   ao caso. Tocar nela: o texto da publicação e a sugestão com a conta feita passo a passo (memória de
   cálculo). O campo da data fica vazio até a pessoa tocar em **Usar a sugestão**; onde a regra de contagem
   ainda não foi confirmada pela direção, nem há data sugerida, e a tela diz qual regra falta. Dizer: "o
   sistema sugere e mostra a conta; quem confirma a data é a pessoa." Usar a sugestão, criar o prazo e mostrar
   o prazo interno antes do fatal.
3. **Pendências (60 s).** O centro de cobrança: um cartão por cliente, com quantas faltam e há quantos dias.
   Onde a fila pede, **Cobrar pelo WhatsApp** abre o WhatsApp da própria pessoa com o texto pronto, sem dado do
   caso. Dizer: "nada sai sozinho; quem envia é você." Mostrar **Recebi** e **Conferi**.
4. **Ficha do caso (45 s).** Próximo passo no topo, prazos com **Cumpri** e **Corrigir data** (corrigir pede
   motivo e fica no histórico), documentos (abrir gera registro de quem abriu), **Mudar estado ou avisar o
   cliente** com a frase que o cliente lê.
5. **Estrutura da família (90 s).** Cliente **Rogério Bittencourt Lago**: o grafo, a participação efetiva de
   cada pessoa e a **Lago Alimentos Ltda (exemplo)** com a soma em 110% em vermelho ("isto passaria batido
   numa planilha"). Depois o cliente **Antônio Moreira Alves** e o simulador "e se": mover uma parte para
   **Marina** e ver a efetiva de cada um mudar, com o aviso de revisão.
6. **Retroteste (30 s).** De volta ao Hoje: a nota "Simulação: nos últimos 90 dias este painel teria
   capturado…". Dizer: "esse número sai dos dados deste escritório fictício, e está escrito que é simulação."
7. **Fechamento (60 s).** As quatro perguntas da seção 5.

**Dizer:** "sugestão", "a pessoa confirma", "fictício", "o escritório é dono dos dados", "nada é enviado sozinho".
**Não dizer:** "especialista", "garante", "calcula o prazo" (sem "sugere"), "inteligência artificial",
promessa de resultado ou de economia em número fixo, nome de concorrente.

**Não mostrar (ainda não existe):** linha do tempo do Cliente 360 (o anexo 06 cita; foi adiada até a trilha
ter leitura por cliente), a tela "Quanto tempo isto custa" (cenário 7 do anexo 06) e reinício da demo por
botão (hoje é rodar o gerador).

## 3. Vídeo de 2 minutos (lista de tomadas)

A gravação de tela fica com o Eduardo (não há gravador no ambiente de construção). Sem narração de ganho.

| Tempo | Tela | O que aparece |
|---|---|---|
| 0:00 a 0:20 | Hoje | a intimação de ontem no topo da fila, vinculada ao caso |
| 0:20 a 0:50 | Triagem | a memória de cálculo e o campo da data vazio; a pessoa toca em "Usar a sugestão" e confirma |
| 0:50 a 1:20 | Pendências | um cartão com atraso; Cobrar abre o WhatsApp com o texto pronto |
| 1:20 a 1:50 | Estrutura | a Lago Alimentos com 110% em vermelho |
| 1:50 a 2:00 | Legenda | "Dados fictícios. O sistema sugere, a pessoa decide." |

## 4. O que mostrar a cada perfil

| Quem assiste | Comece por |
|---|---|
| Contencioso | Hoje, triagem da intimação, prazos da ficha do caso |
| Patrimonial e família | Estrutura (grafo, 110%, simulador), Pendências |
| Direção | filtro "Exige direção", Configurações do escritório (OAB da equipe, regras confirmadas pela direção) |
| Secretaria | Pendências: Cobrar, Recebi, Conferi; teclado no computador (j e k andam, c faz a primeira ação) |

## 5. Perguntas que coletam sinal

Depois da demonstração: "qual destes você usaria amanhã?", "o que faria você não usar?", "quanto pagaria por
mês para o escritório inteiro?", "quem mais precisa disso?". Anotar em `docs/entrevistas/<data>-<iniciais>.md`
(sem nome completo), com a frase exata e se houve compromisso por escrito.
Sinal forte: pedir para usar com dado real, perguntar preço antes de ser perguntado, indicar alguém.
Sinal fraco: "interessante", "bonito".

## 6. Uma página **precisa_revisao**

**O que é.** O painel do escritório dentro do CICLO: as intimações do diário oficial chegam sozinhas, viram
sugestão de prazo com a conta à mostra, e o que falta do cliente vira uma fila de cobrança.

**Para quem.** Escritórios pequenos e médios, sobretudo de família, sucessões e planejamento patrimonial, que
hoje controlam prazo em planilha e cobram documento pelo WhatsApp de cabeça.

**Como funciona.** O sistema sugere e explica; a pessoa confirma. Prazo fatal não é adiado pelo sistema, e
mudar a data pede motivo, que fica no histórico. Nenhuma mensagem sai sozinha: o botão abre o WhatsApp de
quem está usando, com o texto pronto.

**Segurança em cinco linhas.**
1. Cada escritório só enxerga o que é dele (isolamento testado papel por papel, a cada mudança).
2. Segundo fator obrigatório para entrar no pacote.
3. Caso sigiloso aparece só para a equipe dele e para a direção, e quem abre fica registrado.
4. Documento sai por link que vale 60 segundos, e cada abertura fica na trilha.
5. Nada jurídico é apagado: o que muda vira estado e histórico.

**O que não é.** Não é gestão processual completa, não protocola, não envia nada sozinho e não usa
inteligência artificial nos dados do escritório.

## 7. Respostas difíceis **precisa_revisao**

Respostas honestas, com o que existe hoje. Números, só os medidos.

- **"E se vazar?"** Cada escritório é isolado no banco, e isso é testado papel por papel (sete papéis, de
  direção a financeiro) a cada mudança. O pacote exige segundo fator. Ninguém apaga linha jurídica, nem a
  direção: o banco nega antes de qualquer regra. Quem abre documento ou caso sigiloso fica registrado. Há
  roteiro de resposta a incidente.
- **"Já uso um sistema de processos."** Este não substitui: ele organiza o que falta do cliente, a estrutura
  da família e a fila do dia. Pode conviver com o que vocês já usam.
- **"Quem calcula o prazo?"** A pessoa. O sistema sugere e mostra a conta, passo a passo. Enquanto a direção
  não confirma a regra de contagem do escritório, a data vem vazia para a pessoa digitar.
- **"E o sigilo?"** Caso sigiloso só para a equipe dele e para a direção. O assistente do CICLO não lê os dados
  jurídicos, e nenhum dado vai para serviço de inteligência artificial de fora.
- **"Onde ficam os dados?"** No Supabase, região São Paulo. Excluir a conta existe hoje. Exportar os dados
  jurídicos ainda **não** existe (só a lista de clientes): dizer isso, não prometer.
- **"Funciona sem internet?"** Dá para consultar o que já está na tela. Gravar prazo, caso ou documento só com
  conexão, de propósito: prazo gravado horas depois, com a data de quando foi digitado, é pior que não gravar.
  A tela avisa e mantém o que foi digitado.

## 8. Pedido ao advogado do escritório parceiro (texto pronto)

"Para o cálculo de prazo ficar pré-preenchido com segurança, precisamos de 50 intimações reais, anonimizadas
(sem nome de parte), com a data do prazo que você calculou à mão, cobrindo cível, trabalhista, juizado, recesso
e feriado municipal. Até lá o sistema mostra a conta e pede a data. Também precisamos do número e da UF da OAB
de cada pessoa da advocacia da equipe."

## 9. Pendente de decisão do Eduardo

- Link da demo com login de visitante (papel de secretaria, segundo fator, senha trocada a cada demo) ou só o
  vídeo (anexo 06 §7, decisão pendente).
- Amostra viva com a OAB da pessoa: o anexo 06 §6 recomenda **não fazer** agora.
