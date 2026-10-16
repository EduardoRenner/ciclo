# Plano de entrada do CICLO no mercado do AppBarber

Escrito em 16/10/2026 a partir do prompt `prompt-plano-estrategico.md` (v2). Só plano: nada foi construído, nada foi para produção, nenhum cliente foi contatado.

Rótulos: **FATO** (com fonte), **INFERÊNCIA** (de quais fatos), **HIPÓTESE** (com o teste que a decide). Valores em reais são de 16/10/2026.

## Resumo em 10 linhas

1. **Alvo primeiro:** o dono de barbearia pequena (1 a 5 cadeiras) que já paga o AppBarber e não depende da vitrine dele para ganhar cliente novo. Já provou que paga por software, tem base cadastrada e sofre com cliente que some sem aviso.
2. **Caminho recomendado: C.** Entrar **ao lado** do AppBarber, de graça, como a lista de quem está sumindo. Só depois, com sinais medidos, oferecer a troca completa.
3. **Por quê:** trocar de sistema é o maior medo do dono (dor 13 do `docs/07`). Conviver não pede troca. E o AppBarber não tem nada parecido com a fila do Motor de Ciclo.
4. **O furo que precisa ser fechado antes:** hoje a fila não sabe quem voltou pelo AppBarber. Sem um botão "Já voltou" na própria fila, a lista enche de alarme falso em duas semanas e o dono desiste.
5. **Passo 1:** botão "Já voltou" na fila do Recuperar (código, tamanho P).
6. **Passo 2:** a tela "Vindo de outro sistema" nomeia o AppBarber e explica o pedido de exportação no chat deles (código, P).
7. **Passo 3:** lembrete semanal da fila, por e-mail ou notificação (código, M; depende do SMTP).
8. **Passo 4:** página "Use o CICLO junto com o AppBarber" e piloto com 5 a 10 barbearias numa cidade (marketing).
9. **Passo 5:** medir a premissa "a maioria usa AppBarber" contra "70% estão no caderno" antes de investir em aquisição (seção 1).
10. **Decisões pendentes do Eduardo:**
    - canal de contato;
    - SMTP;
    - se a convivência fica no plano Grátis;
    - aprovação jurídica de qualquer abordagem direta;
    - provedor de pagamento para Pix e sinal (só na fase de troca).

---

## 1. A premissa: quantos barbeiros usam mesmo o AppBarber

O pedido parte de "a maioria dos barbeiros já usa o AppBarber". O `docs/83` (§0, item 1) diz o contrário para o setor como um todo.

| Fato | Fonte | Rótulo |
| --- | --- | --- |
| Menos de 30% dos salões usam sistema de gestão | Sebrae via UAI, 18/09/2026, citado no `docs/83` §0 | FATO (sobre **salões**, não só barbearias) |
| O AppBarber diz ter 4 mil estabelecimentos somando AppBarber e AppBeleza | Suno, 14/05/2022 | FATO, mas velho e declarado pela própria empresa |
| A vitrine pública lista 64 barbearias do AppBarber em Chapecó (87 negócios no total) | contagem agregada da busca pública, 16/10/2026 | FATO |
| Nas capitais a vitrine bate no teto de 120: São Paulo 107 e Rio 105 do AppBarber | idem | FATO (o número real é maior e desconhecido) |
| O `docs/07` §4.1 põe "WhatsApp e caderno" como "o concorrente real" | `docs/07` | FATO (é o que o documento afirma; ele mesmo pede para verificar números) |

**INFERÊNCIA:** as duas coisas são verdade em grupos diferentes.
- **Entre as barbearias que já usam algum sistema**, o AppBarber deve ser o líder: é o que mais aparece nas buscas, tem 1 milhão de downloads do app do cliente e domina a vitrine nas cidades testadas.
- **No total de barbeiros**, a maioria ainda está no caderno e no WhatsApp, principalmente o profissional solo e o de cadeira alugada.

**Consequência para o plano:**
- O AppBarber é a porta de entrada para **quem já paga** por software.
- O caderno é o volume.
- O plano trata o AppBarber como a frente de **receita rápida** (quem já paga é mais fácil de converter) e não como a frente de volume.

**Como fechar a dúvida, do mais barato ao mais caro:**
1. **Dados próprios.** O evento `perfil_respondido` da Pergunta 1 do onboarding grava onde estão os clientes de cada conta nova (`src/server/services/perfil-onboarding.ts`). Pedir ao Eduardo uma contagem agregada de produção: quantos responderam "outro sistema" e, desses, quantos "appbarber". Custo zero. **NÃO VERIFICADO** hoje (não há acesso à produção).
2. **Uma cidade média.** Comparar as 64 barbearias do AppBarber em Chapecó com o total de barbearias da cidade nos dados abertos de CNPJ (CNAE 9602-5/01, filtrando "barb" no nome fantasia). Dá a participação real do AppBarber numa cidade. Custo: algumas horas.
3. **Conversa.** Perguntar a 20 barbeiros, em pessoa ou em grupo, o que usam para agendar. Custo: um dia.

---

## 2. O primeiro cliente, exatamente

| Segmento | Tamanho | Dor principal | O que o CICLO entrega hoje | O que falta | Custo de alcançar |
| --- | --- | --- | --- | --- | --- |
| Dono solo no AppBarber pagando R$ 79,90 | INFERÊNCIA: parte grande dos clientes do AppBarber (a faixa de 1 profissional é a primeira da tabela deles) | Pagar caro por muito recurso que não usa | Plano Grátis e Solo a R$ 49, fila de quem sumiu | Nada essencial para conviver; para trocar, pagamento online | Médio |
| **Barbearia de 2 a 5 cadeiras no AppBarber** | INFERÊNCIA: o cliente típico do AppBarber (faixa de R$ 109,90) | Cliente some sem aviso; comissão; não sabe o que sobra | Fila do Motor, comissão, lucro por atendimento | "Já voltou" na fila, lembrete semanal | Médio |
| Barbeiro comissionado ou de cadeira alugada | FATO no `docs/07` §2.2: segmento B, "grande", R$ 40 a 90 | A carteira é dele, mas o sistema é do dono | Grátis com 1 profissional, página própria sem conta para o cliente | Nada para começar | Baixo (é o próprio barbeiro que adota) |
| Quem tem clube de assinatura e sofre com cobrança | FATO: cerca de 40 das 60 reclamações recentes no Reclame Aqui | Cobrança depois de cancelar | Clube com margem do assinante, sem cobrança automática | Cobrança recorrente com cancelamento pelo cliente | Alto (depende de provedor de pagamento) |
| Quem está de saída | FATO: donos "prestes a cancelar" no Reclame Aqui | App "parou no tempo", suporte | O pacote todo | Pagamento online, migração do clube | Alto |

**Escolha: barbearia de 1 a 5 cadeiras que já paga o AppBarber**, entrando pela convivência.
- **Quem já paga software** converte mais fácil do que quem nunca pagou. Isso é INFERÊNCIA; confirmar no piloto.
- **Tem a base cadastrada**, então a fila aparece logo.
- **A dor "cliente sumiu" o AppBarber não resolve.** O relatório "dias sem vir" deles é uma janela escolhida à mão, igual para todos (FATO, `docs/83` §0 item 3).

O **barbeiro comissionado** fica como **canal**, não como alvo pagante: ele usa o Grátis na própria carteira e leva o CICLO para o dono.

**Fora do primeiro alvo:**
- quem ganha muito cliente novo pela vitrine do AppBarber (sair seria perder aquisição, `docs/83` §7.2);
- quem usa a Belasis (`docs/83` §7.6);
- redes com mais de 5 cadeiras (`docs/07` §2.2, segmento D).

---

## 3. Caminho A, conviver

### 3.1 A proposta numa frase

> **"Continue agendando no AppBarber. O CICLO te mostra quem está sumindo e quanto vale chamar de volta, de graça."**

Variações para testar no piloto:
- "Seu AppBarber agenda. O CICLO traz de volta."
- "Quem não volta há mais tempo do que costuma: a lista com nome, telefone e valor."

### 3.2 O fluxo real do dono, com tempo estimado

| Momento | O que o dono faz | Tempo (HIPÓTESE) | Existe hoje? |
| --- | --- | --- | --- |
| Dia 1 | Cria a conta, responde "outro sistema" na Pergunta 1 e cai na tela "Vindo de outro sistema" | 2 min | FATO: existe (`vindo-de-outro-sistema/page.tsx`) |
| Dia 1 | Pede a exportação no chat do AppBarber, com a mensagem pronta da tela | 1 min, mais a espera da resposta deles | FATO: a mensagem pronta existe; a exportação deles é NÃO VERIFICADA |
| Dia 1, sem planilha | Digita de memória os 20 a 50 clientes que lembra, com "faz uns 15 dias" | 10 a 15 min | FATO: existe (`ja-atendo`) |
| Dia 1 ou 2, com planilha | Importa o CSV do Excel, com acento e data dd/mm | 2 min | FATO: consertado no BL-51 (`decodificar-texto.ts`, `data-informada.ts`) |
| Logo depois | Vê a fila com quem passou do tempo e o valor | imediato | FATO: o Motor roda na importação (`preverEPersistirCiclos`) |
| **Toda semana** | Abre a fila, toca "Chamar" em quem quer trazer e **"Já voltou" em quem voltou pelo AppBarber** | **5 min (HIPÓTESE)** | **NÃO EXISTE: a fila só tem "Chamar" e "Pular hoje" (FATO, `recuperar/fila.tsx:128`)** |
| Toda semana | Recebe um lembrete "5 pessoas passaram do tempo esta semana" | 0 | **NÃO EXISTE** (nenhum resumo semanal no código) |

**O ponto que decide o caminho A:**
- O dono **não vai** lançar no CICLO cada atendimento que fez no AppBarber.
- O desenho certo é confirmar só **quem o Motor acha que sumiu**: poucas pessoas por semana, já na tela da fila.
- A busca de "retornos" que existe em `ja-atendo` exige procurar nome por nome. Serve para o primeiro dia, não para toda semana.

**Ressalva honesta sobre o diferencial:**
- O ritmo pessoal do Motor depende do histórico. Com um único ponto (a última visita), ele usa o ciclo padrão do serviço; com 1 a 2 intervalos, mistura o pessoal com o padrão; com 3 ou mais, usa a mediana dos últimos 5 (FATO, `src/core/cycle/compute.ts`, passo 3).
- **No começo da convivência, o CICLO também trabalha com um prazo padrão por serviço.** A vantagem sobre o relatório do AppBarber no dia 1 não é o ritmo pessoal. É a lista pronta, com nome, valor e o botão de chamar, sem configurar nada.
- O ritmo pessoal aparece com o tempo, conforme os "Já voltou" se acumulam.
- **A página de venda não pode prometer "ritmo de cada cliente" para quem acabou de chegar.** Ela promete a lista; o ritmo vem depois.

### 3.3 O que mudar no produto para conviver

| Ticket | O quê | Por quê | Tamanho |
| --- | --- | --- | --- |
| CONV-01 | **Botão "Já voltou" em cada pessoa da fila** (`recuperar/fila.tsx` e `recuperar.tsx`): grava um retorno com a data de hoje pela mesma função de `quem-ja-atendo` (`retornos`), e a pessoa sai da fila | Sem isso a fila acumula falso alarme. É o ticket que segura a convivência | P |
| CONV-02 | **A tela "Vindo de outro sistema" usa o sistema escolhido na Pergunta 1** e nomeia o AppBarber ("Peça no chat do AppBarber...") | Hoje fica genérica porque a escolha não é repassada (registrado em `docs/DECISOES.md`). Nomear concorrente com fato verificável já foi aprovado (`docs/83`, decisão 2) | P |
| CONV-03 | **Lembrete semanal da fila**, por e-mail e notificação: "5 pessoas passaram do tempo, R$ X" | Sem lembrete, o dono esquece o CICLO em 3 semanas (HIPÓTESE, medir no piloto) | M (o e-mail depende do SMTP) |
| CONV-04 | **Painel enxuto para quem só quer recuperar:** Hoje mostra a fila primeiro; menu sem comanda e caixa | Dois sistemas cansam. Os módulos já podem ser desligados pelo dono (FATO: Configurações, Módulos), mas a **Agenda é "sempre ligada"** (FATO, `planos.ts`, `CATALOGO`) | M |
| CONV-05 | **Exportação da base sem segundo fator obrigatório:** reautenticar com senha, como foi feito na exclusão de conta (LOJA-27) | A exportação completa existe (FATO, `api/v1/clients/export`, uma vez por mês), mas exige verificação em duas etapas. Isso enfraquece a promessa "leve seus dados quando quiser" | P |

### 3.4 Preço da convivência

**FATOS**
- O plano Grátis tem limite de 50 clientes, mas é limite **suave**: o dono cadastra a base inteira e recebe um aviso (FATO, `planos.ts`, `SEVERIDADE.clientes = 'suave'`, e `podeCriar` deixa passar).
- O Grátis já inclui a fila do Motor e os lembretes.

**Recomendação:** a convivência fica **no Grátis**. Não criar um plano "Recuperação" agora.
- Mais um plano complica a tabela.
- O dono convivendo ainda não tirou dinheiro do AppBarber.

**Quando cobrar:** quando ele quiser o que o Solo e o Equipe dão a mais:
- comanda e lucro por atendimento;
- clube;
- campanhas em lote;
- remover o selo do CICLO.

**A conta para o Solo** (HIPÓTESE com números reais):
- O preço de corte do persona Rafa é R$ 45 (`docs/07` §3.1).
- Recuperar **2 cortes por mês** paga os R$ 49 do Solo.
- Uma barbearia de 3 cadeiras com centenas de clientes e 30 a 40% da base inativa (dor 3 do `docs/07`) tem bem mais que 2 pessoas na fila. Medir no piloto quantos voltam por mês depois de "Chamar".

**DECISÃO DO EDUARDO:** confirmar que a convivência fica no Grátis e que o limite de 50 continua suave.

### 3.5 Riscos e mitigação

| Risco | Probabilidade | Mitigação |
| --- | --- | --- |
| Dono para de atualizar e a fila fica errada | Alta (HIPÓTESE) | CONV-01 e CONV-03; a fila mostra "atualizado há X dias"; o lembrete semanal pede só os "Já voltou" |
| Previsão errada com dado velho | Média | Na importação, só usar quem tem última visita; dizer na tela que o ritmo melhora com as visitas |
| O AppBarber copia a fila | Média, em meses (o produto deles anda devagar: blog parado 22 meses, termo de 2020) | O histórico acumulado no CICLO melhora a previsão de cada cliente (FATO, `compute.ts`); quem copia começa sem esse histórico |
| LGPD: dado vindo de outro sistema | Baixa, se bem feito | O dono é o controlador e traz os próprios dados (`docs/83`); o CICLO é operador; nada de importar dado de saúde do AppBarber |
| "Dois sistemas" cansa | Alta | CONV-04 e a promessa honesta "5 minutos por semana" |

---

## 4. Caminho B, superar

### 4.1 Cada dor do AppBarber contra o CICLO

| Dor medida no AppBarber | Promessa do CICLO | Prova que o CICLO mostra hoje | Falta |
| --- | --- | --- | --- |
| Cobrança depois de cancelar o clube | Cancelamento pelo cliente, sem cobrança surpresa | Hoje o clube do CICLO não cobra cartão, então não tem como cobrar depois | A cobrança recorrente, já com o cancelamento do cliente |
| Login e cadastro quebrados | Entrar sem dor | Login por e-mail funciona; **o e-mail de confirmação não chega para quem é de fora (falta SMTP)** | SMTP (LOJA-01). Sem isso, o CICLO repete o defeito deles |
| Suporte lento, chamado "sem previsão" | Resposta no WhatsApp do fundador | "Me manda que eu faço" já existe na tela (só aparece com canal configurado) | Canal de contato (LOJA-04) |
| Preço escondido em módulos e créditos | Um preço só | Tabela pública: Grátis, R$ 49, R$ 99 | Nada |
| Cliente obrigado a criar conta | Agenda com nome e telefone | FATO: a página pública não pede conta | Nada |
| Vitrine com a barbearia concorrente | A página é só do negócio | FATO: a página pública mostra só o negócio | Nada |
| Exportação só pedindo no chat | Botão de baixar | FATO: existe | CONV-05 (sem o segundo fator obrigatório) |
| Termo de 2020, sem reembolso | Termos atualizados | FATO: termos de 03/10/2026 | Nada |
| Só 30 dias de teste | Plano grátis | FATO | Nada |
| Recepcionista conta como profissional | Cobra por quem atende | FATO: o teto é de profissionais | Nada |

### 4.2 Lacunas para trocar sem medo

Para o primeiro alvo (1 a 5 cadeiras):

| Lacuna | Classificação | Motivo |
| --- | --- | --- |
| App do dono nas lojas | **Obrigatória** | Barbeiro usa celular; o AppBarber tem app. Já está em preparação (PR #151) |
| Sinal e pagamento por Pix, aceitando CPF | Desejável | FATO: 3 em cada 4 barbearias do AppBarber nem usam o pagamento online deles. Não é o que segura o dono lá |
| Clube com cobrança automática | **Obrigatória só para quem tem clube** | Sem isso, quem tem assinantes não sai. Dá para atender os outros antes |
| Nota fiscal | Desejável, a confirmar | O blog deles diz que a nota de serviço pelo Portal Nacional é obrigatória desde setembro de 2026. Confirmar o que vale para MEI antes de classificar |
| Fila por ordem de chegada | Dispensável para o primeiro alvo | Atende barbearia sem hora marcada, que não é o primeiro alvo |
| Várias unidades | Dispensável | Rede não é alvo nos primeiros 18 meses (`docs/07` §2.2) |

### 4.3 A troca em um dia

| Passo | Hoje | Falta |
| --- | --- | --- |
| Importar clientes e serviços | FATO: planilha e memória existem; o Eduardo importa pelo WhatsApp nas primeiras contas (decisão do `docs/83`) | Um arquivo real exportado do AppBarber para conferir as colunas (GO-1: nada de importador próprio antes disso) |
| Recriar os assinantes sem cobrar em dobro | Não dá: o CICLO não cobra cartão | A cobrança recorrente, com data de virada: cobra no CICLO só depois de cancelar no AppBarber |
| Avisar o cliente final do link novo | A página pública e o link existem | Mensagem pronta e QR para o balcão |
| Guardar o histórico antigo | O AppBarber não importa histórico nem para dentro dele (FATO, artigo 9396829609997) | Aceitar a planilha antiga como consulta; não prometer histórico completo (regra do `docs/83` §8) |
| Benefício | Aprovado: 1 mês do Essencial (hoje Solo) para quem importa com a última visita (`docs/83`, decisão 1) | Ainda não existe no código (FATO: a tela diz que ficou de fora por ser decisão de preço; já foi decidido) |

### 4.4 O que não copiar

- **Vitrine com concorrente.** Os donos odeiam ver a barbearia da esquina ao lado da sua.
- **Créditos de WhatsApp**, que viram custo escondido.
- **Módulo sem preço**, vendido por formulário.
- **Recepcionista contando como profissional** na faixa de preço.
- **Conta obrigatória** para o cliente final agendar.
- **Exigir CNPJ** para receber online.

---

## 5. Caminho C, conviver primeiro e trocar depois

**Gatilhos medidos** que tornam um dono em convivência candidato à troca. Todos são HIPÓTESE a calibrar no piloto:

1. **Uso:** 4 semanas seguidas abrindo a fila.
2. **Resultado:** pelo menos 3 clientes recuperados com "Chamar" que voltaram (o "O Motor de Ciclo trouxe" já conta quem volta pelo link: FATO, `fila.tsx:165`).
3. **Pedido espontâneo:** o dono pergunta por agenda, comanda ou cobrança no CICLO.

**O que o produto oferece em cada gatilho:**

| Gatilho | Oferta |
| --- | --- |
| Uso | Mostrar quanto a fila já trouxe ("R$ X voltaram em 4 semanas") |
| Resultado | Convite para experimentar a agenda e a comanda num dia de movimento fraco |
| Pedido | A troca em um dia, com o Eduardo importando e o mês do Solo grátis já aprovado |

---

## 6. A reação do AppBarber

| Reação provável | Probabilidade | Impacto | O que mantém o CICLO na frente |
| --- | --- | --- | --- |
| Copiar uma "lista de quem sumiu" | Média em 6 a 12 meses (INFERÊNCIA: o ritmo de produto deles é lento) | Médio | O ritmo de cada cliente aprende com as visitas acumuladas; a cópia começa do zero. Somar o lucro por atendimento e a margem do clube, que eles não têm |
| Baixar preço ou criar plano grátis | Baixa no curto prazo (vivem da mensalidade e de módulos) | Alto | O CICLO não briga por preço de agenda; briga por receita recuperada |
| Dificultar a exportação | Média | Alto para a troca, baixo para a convivência | A convivência não depende de exportação: a memória funciona sem planilha |
| Marketing contra o CICLO | Baixa enquanto o CICLO for pequeno | Baixo | Comparação honesta, com data e fonte |

---

## 7. Comparação e recomendação

| | A: conviver | B: superar | C: conviver e depois trocar |
| --- | --- | --- | --- |
| Custo de construir | 3 a 4 semanas (CONV-01 a 05) | 3 a 6 meses (clube com cobrança, Pix, nota fiscal, migração) | 3 a 4 semanas para começar, o resto conforme os gatilhos |
| Tempo até o primeiro pagante | Médio: precisa provar valor antes do Solo | Longo | Médio |
| Risco | Abandono por cansaço | Construir muito antes de saber se trocam | Baixo: cada etapa é medida |
| Público alcançável | Todo dono de AppBarber, sem medo de troca | Só quem está insatisfeito e sem clube | Os dois, em sequência |
| Depende do Eduardo | SMTP, canal, Grátis | Provedor de pagamento, preço, contas, jurídico | SMTP, canal e Grátis agora; o resto depois |
| Reforça o que só o CICLO tem | Muito (a fila é o produto) | Pouco (vira briga de recurso) | Muito |

**Recomendação: C.**
- Entrar pela fila de graça custa poucas semanas, usa o que o CICLO já tem e não pede o salto que o dono teme.
- Cada dono que vê dinheiro voltando pela fila vira o candidato certo à troca, com dados para provar.
- Construir pagamento, clube e nota antes disso seria apostar sem evidência.

**O que me faria mudar de ideia:**
- Se no piloto menos de 3 em cada 10 donos ainda abrirem a fila na semana 4 → a convivência não se sustenta: rever para B só com quem está insatisfeito.
- Se a contagem da seção 1 mostrar que o AppBarber é minoria até entre quem tem sistema → priorizar o caderno (`docs/07`, segmento A).

---

## 8. Posicionamento, prova e objeções

### 8.1 Frase e mensagens

> **"O CICLO mostra quem está sumindo da sua barbearia e quanto vale chamar de volta. Funciona junto com o AppBarber."**

1. **"Uma lista com nome, telefone e valor, sem configurar nada."** O AppBarber tem um relatório "dias sem vir" em que o dono escolhe o período à mão (FATO, `docs/83` §0 item 3).
2. **"Seu cliente agenda sem criar conta."** No AppBarber, o primeiro clique em "Agendar" pede login (FATO, visto no site em 16/10/2026). Usar só para quem já pensa em trocar; não serve como argumento de troca para quem ganha cliente pela vitrine (`docs/83` §7.2).
3. **"Um preço só, sem módulo escondido."** No AppBarber, clube, nota, robô e app próprio são vendidos à parte, sem preço público (FATO).

**O pilar verificável** (`docs/83` §0 item 3): o AppBarber trata "cliente sumido" por uma janela igual para todos; o CICLO calcula o ritmo de cada cliente.
- **Mostrar com os dados do dono, nunca como frase** (`docs/83` §7.1).
- **Ressalva da seção 3.2:** o ritmo pessoal aparece com as visitas acumuladas.

### 8.2 A prova em menos de 10 minutos

1. O dono digita de memória 20 clientes com "faz quanto tempo" (FATO: `ja-atendo`).
2. A fila aparece na hora, com os atrasados e o valor estimado (FATO: o Motor roda na hora).
3. Ele toca "Chamar" em um e manda a mensagem pelo próprio WhatsApp (FATO: o botão existe).

**Isso já existe:** o fim da importação de memória e o da planilha mostram o cartão "N pessoas já estão atrasadas para voltar", que leva à fila (FATO, `ja-atendo/formulario.tsx:163` e `importar/importador.tsx:380`). Falta só pôr o **valor** nesse cartão (CONV-06).

### 8.3 A página "Use o CICLO junto com o AppBarber"

**Títulos, em ordem**
1. "Continue no AppBarber. Descubra quem está sumindo."
2. "Como funciona": 3 passos, em 10 minutos.
3. "Quanto custa": grátis para usar junto.
4. "E se eu quiser trocar depois?": a troca em um dia, com o mês do Solo grátis.
5. Perguntas frequentes (as objeções abaixo).

**Tabela honesta**
- Colunas "O que o AppBarber já faz bem" e "O que o CICLO acrescenta", datada de 16/10/2026.
- Sem atacar a marca.
- Cada linha com a fonte, no rodapé.

### 8.4 As 7 objeções

| Objeção | Resposta |
| --- | --- |
| "Meus clientes já têm o app do AppBarber" | Ótimo, continue com ele. O CICLO não troca o agendamento, só mostra quem parou de agendar |
| "Não quero dois sistemas" | Você abre o CICLO uma vez por semana, 5 minutos, para ver a lista e chamar quem sumiu. Se não valer, você para. É grátis |
| "E meus dados?" | Os dados são seus. Você baixa todos os seus clientes numa planilha quando quiser (depois do CONV-05, sem segundo fator obrigatório) |
| "O AppBarber já tem relatório de quem não volta" | Tem, e você escolhe o período à mão, igual para todos. O CICLO calcula para cada cliente e já põe o valor e o botão de chamar. Faça o teste com 20 clientes seus |
| "Não tenho tempo" | Digitar 20 clientes de memória leva 10 minutos. Se preferir, o Eduardo importa para você pelo WhatsApp |
| "Vai sumir em seis meses e eu perco tudo" | A planilha sai no mesmo formato em que entra. Você nunca fica preso (`docs/83` §7.4) |
| "Quanto custa depois?" | Usar junto é grátis. Se quiser comanda, lucro e campanhas, o Solo custa R$ 49 por mês, um preço só |

---

## 9. Aquisição com custo perto de zero

| Canal | Como funciona | Custo | Medida | Primeiro teste de 2 semanas e critério de sucesso |
| --- | --- | --- | --- | --- |
| Busca "alternativa ao AppBarber", "AppBarber preço", "AppBarber cancelar" | A página da seção 8.3 e um artigo honesto. Hoje essas buscas são de comparativos de concorrentes (FATO, com a ressalva de que a busca testada é dos EUA) | Tempo de escrita | Visitas e cadastros com origem na página (o CICLO grava a origem: FATO, `docs/82`) | Publicar e medir impressões no Search Console; sucesso: aparecer para as 3 buscas |
| O barbeiro como canal | O comissionado usa o Grátis na própria carteira, com a página pública dele, e mostra ao dono | Zero | Contas que mudam de 1 para 2 ou mais profissionais | Convidar 10 barbeiros conhecidos; sucesso: 3 usando na semana 2 |
| Cidade de teste | Chapecó: 64 barbearias do AppBarber, número real (FATO). Ou outra cidade média abaixo do teto de 120 | Deslocamento | Participação: contas do CICLO sobre as barbearias do AppBarber da cidade | Visitar 15 barbearias com o teste de 10 minutos; sucesso: 5 contas ativas na semana 2 |
| Instagram e criadores do meio | Vídeo curto mostrando a fila com dados de exemplo | Baixo | Cadastros com origem no criador | 1 criador local; sucesso: 10 cadastros |
| Eventos (Barber Week, Barber Day) | Estande pequeno ou presença com o teste de 10 minutos no celular | Médio (só se der) | Contas criadas no evento | Fora dos primeiros 90 dias, salvo convite grátis |
| Material gratuito | Guia "Quem sumiu da sua barbearia: como medir e chamar de volta" com números reais do piloto | Tempo | Downloads e cadastros | Depois do piloto, quando houver números |
| Barbearias que reclamaram em público | **Descartado por agora.** Abordar alguém a partir de uma reclamação pública expõe a pessoa e pede avaliação jurídica | — | — | Só com parecer jurídico e decisão do Eduardo |

**Regra para qualquer contato direto** (seção 2 do prompt):
- um a um, com mensagem pensada para aquele negócio;
- opção de não receber mais;
- nenhum disparo em massa nem automação de WhatsApp;
- nada de usar telefone ou e-mail da vitrine do AppBarber para montar lista.

**DECISÃO DO EDUARDO, COM ADVOGADO,** antes da primeira abordagem.

---

## 10. Execução nos primeiros 90 dias

### 10.1 Fases de 2 semanas

| Fase | Objetivo | Entregas | "Pronto" quando |
| --- | --- | --- | --- |
| 1 (semanas 1 e 2) | Fechar o furo da convivência | CONV-01, CONV-02, CONV-05; medir a premissa (seção 1, passos 1 e 2) | "Já voltou" tira a pessoa da fila e o Motor recalcula (teste); a contagem de Chapecó está escrita |
| 2 (3 e 4) | Não deixar o dono esquecer | CONV-03 (lembrete semanal); CONV-07 (mês do Solo); SMTP e canal de contato (Eduardo) | Lembrete chega num e-mail de fora do time |
| 3 (5 e 6) | Página e prova | Página "Use junto com o AppBarber"; CONV-06; CONV-04 se o tempo der | A página está no ar e o teste de 10 minutos roda sem ajuda |
| 4 (7 e 8) | Piloto | 5 a 10 barbearias do AppBarber numa cidade, em convivência | 5 contas ativas com fila aberta na semana 2 do piloto |
| 5 (9 e 10) | Medir | Painel semanal das métricas da seção 10.3 | Dados de 4 semanas de piloto |
| 6 (11 e 12) | Decidir | Escolher entre manter A, acelerar para B ou priorizar o caderno, pelos critérios da seção 7 | Decisão escrita em `docs/DECISOES.md` |

### 10.2 Tickets

**Código** (padrão do CICLO: um ticket, um commit, teste que reprova antes)

| ID | Prioridade | Tamanho | Arquivo provável | Teste que prova |
| --- | --- | --- | --- | --- |
| CONV-01 "Já voltou" na fila | P0 | P | `src/app/admin/recuperar/fila.tsx`, `recuperar.tsx`; reusar `retornos` de `quem-ja-atendo.ts` | Integração: marcar "Já voltou" grava a visita, recalcula o ciclo e tira a pessoa da fila |
| CONV-02 Tela nomeia o sistema de origem | P0 | P | `vindo-de-outro-sistema/page.tsx`, `perfil-onboarding.ts` | Unidade: quem escolheu "appbarber" vê o texto do AppBarber; quem escolheu "outro" vê o genérico |
| CONV-05 Exportar sem segundo fator obrigatório | P0 | P | `src/app/api/v1/clients/export/route.ts` | Unidade: sem segundo fator, pede a senha; com segundo fator cadastrado, continua exigindo |
| CONV-03 Lembrete semanal da fila | P1 | M | novo trabalho agendado (`src/app/api/cron/...`), `mensageria.ts` | Integração: segunda-feira gera um aviso por dono com fila não vazia; nenhum para conta de demonstração |
| CONV-06 Valor no cartão do fim da importação (o cartão que leva à fila já existe) | P2 | P | `ja-atendo/formulario.tsx`, `importar/importador.tsx` | Navegador: depois de importar, o cartão mostra quantos passaram do tempo e quanto vale |
| CONV-07 Benefício de 1 mês do Solo na importação com última visita | P1 | M | `src/core/billing/`, `quem-ja-atendo.ts` | Unidade: importar com última visita concede 30 dias; sem última visita, não concede |
| CONV-04 Painel enxuto "só recuperar" | P2 | M | `admin/layout.tsx`, `CATALOGO` em `planos.ts` | Navegador: com o modo ligado, o menu não mostra comanda e caixa |

**Decisões do Eduardo**, em ordem:
1. Canal de contato (`NEXT_PUBLIC_CONTATO_*`): sem ele, "Me manda que eu faço" não aparece.
2. SMTP: sem ele, o cadastro de quem é de fora não confirma e o lembrete por e-mail não sai.
3. A convivência fica no Grátis, com o limite de 50 clientes suave.
4. Aprovação jurídica de qualquer contato direto com donos.
5. Escolha do provedor de pagamento para Pix, sinal e clube, só quando a fase de troca chegar.

**Marketing**
- página "Use o CICLO junto com o AppBarber";
- artigo honesto de comparação;
- roteiro do teste de 10 minutos;
- recrutamento do piloto.

### 10.3 Métricas

| Métrica | Partida | Meta em 90 dias |
| --- | --- | --- |
| Donos vindos do AppBarber | A medir (evento `perfil_respondido`) | 15 contas (HIPÓTESE: o equilíbrio do CICLO é 8 pagantes, FATO `docs/88`) |
| Tempo até ver a primeira fila | A medir | Menos de 10 minutos |
| Donos que abrem a fila na semana 4 | A medir | 50% dos que entraram |
| Clientes recuperados por conta por mês | A medir ("O Motor de Ciclo trouxe") | 3 ou mais |
| Receita recuperada por conta por mês | A medir | Pelo menos 2 vezes o preço do Solo |
| Ativação na semana 1 (importou e chamou alguém) | A medir | 60% |
| Permanência em 30 e 60 dias | A medir | 70% e 50% |
| Conversão de convivência para Solo | A medir | 20% em 60 dias |

### 10.4 Piloto

- **Quem:** 5 a 10 barbearias de 1 a 5 cadeiras que usam o AppBarber, numa cidade média abaixo do teto de 120 na vitrine, de preferência onde o Eduardo possa ir pessoalmente.
- **Recrutamento:** pessoalmente ou por indicação (seção 9, dentro das regras); nada de lista montada com a vitrine deles.
- **O que medir toda semana:** se abriu a fila, quantos "Chamar", quantos "Já voltou", quantos voltaram pelo link, quanto valeu.
- **Quando parar:** se na semana 3 menos de 3 donos ainda abrirem a fila, parar e entrevistar quem largou.
- **Decisão no fim:** os critérios da seção 7.

---

## 11. O que não sabemos e como descobrir

| Dúvida | Teste mais barato |
| --- | --- |
| O que vem numa exportação real do AppBarber (colunas, se traz a última visita, formato da data) | Pedir a um dono do piloto que solicite a exportação no chat deles e mande o arquivo (com o consentimento dele) |
| Quantos donos aguentam atualizar a fila toda semana | O piloto (métrica "abre a fila na semana 4") |
| Quanto o barbeiro comissionado pagaria do próprio bolso | Perguntar a 10 comissionados depois de 2 semanas usando o Grátis: "você pagaria R$ 29? R$ 49?" |
| Qual parte das barbearias usa o AppBarber de verdade | Contagem de Chapecó contra os dados abertos de CNPJ (seção 1) |
| Se a nota fiscal obrigatória pesa para MEI | Ler a regra do Portal Nacional da NFS-e para MEI; perguntar ao contador |
| Se "Já voltou" deixa o Motor melhor ou só mais limpo | Comparar no piloto a taxa de acerto das previsões (o Motor já mede acerto: FATO, tela do Recuperar mostra "previsões conferidas") |

---

## 12. Revisão adversarial deste plano

Reli o plano procurando os cinco problemas pedidos no prompt. O que achei e corrigi:

1. **Promessa que o produto não cumpre.** A primeira versão da mensagem dizia "ritmo de cada cliente" para quem acabou de chegar. O Motor só usa o ritmo pessoal com histórico (`compute.ts`, passo 3). Corrigido: a promessa do dia 1 é a lista; o ritmo vem com as visitas (seções 3.2 e 8.1).
2. **Afirmação sobre o CICLO não conferida.** Eu ia escrever que existe resumo semanal da fila. Procurei no código e não existe; virou o ticket CONV-03. Também conferi que a exportação existe mas exige segundo fator (virou CONV-05) e que o limite de 50 clientes é suave.
3. **Estratégia apoiada em suposição não testada.** A premissa "a maioria usa AppBarber" choca com o Sebrae. Não escondi: a seção 1 diz o que se sabe, o que é inferência e os 3 testes que fecham a dúvida. A recomendação tem uma condição de mudança ligada a isso (seção 7).
4. **Número sem rótulo.** Revisei as tabelas. As metas da seção 10.3 são HIPÓTESE de partida, ancoradas no equilíbrio de 8 pagantes do `docs/88`; ficaram marcadas como metas, não como previsões.
5. **Uso da vitrine fora das regras.** O canal "barbearias que reclamaram em público" e qualquer lista montada com a vitrine foram descartados. A vitrine só entra como contagem agregada.

6. **Lacuna que já estava fechada.** Eu tinha marcado como HIPÓTESE que o fim da importação não levava à fila. Conferi: as duas telas já mostram o cartão "N pessoas atrasadas" com link para o Recuperar. O CONV-06 encolheu para pôr só o valor no cartão.

Ficaram sem verificação, e estão na seção 11: o formato real da exportação do AppBarber, o dado de produção da Pergunta 1 e a regra da nota fiscal para MEI.
