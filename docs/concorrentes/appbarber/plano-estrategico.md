# Plano de entrada do CICLO no mercado do AppBarber

Escrito em 16/10/2026 a partir do prompt `prompt-plano-estrategico.md` (v2). Só plano: nada foi construído, nada foi para produção, nenhum cliente foi contatado.

Rótulos: **FATO** (com fonte), **INFERÊNCIA** (de quais fatos), **HIPÓTESE** (com o teste que a decide). Valores em reais são de 16/10/2026.

**Versão 2 (16/10/2026, mesmo dia).** Revisei o plano contra o código de ponta a ponta e escrevi a jornada completa do dono em **[`jornada-do-dono.md`](jornada-do-dono.md)**: baixar o app, criar a conta, trazer os clientes, uso semanal. Achei 5 defeitos que derrubariam a convivência e que a versão 1 não via; estão na seção 3.0. O que mudou está no fim, na seção 13.

## Resumo em 10 linhas

1. **Alvo primeiro:** o dono de barbearia pequena (1 a 5 cadeiras) que já paga o AppBarber e não depende da vitrine dele para ganhar cliente novo.
2. **Caminho recomendado: C.** Entrar **ao lado** do AppBarber, de graça, como a lista de quem está sumindo. Só depois, com sinais medidos, oferecer a troca.
3. **A regra da convivência:** o AppBarber agenda; o CICLO decide quem chamar e fica sabendo quem voltou. O CICLO **nunca** agenda nesse modo. Hoje a mensagem "Chamar" leva à agenda do CICLO e criaria duas agendas que não se enxergam (CONV-10).
4. **Trazer os clientes pelo celular:** o importador da `main` só aceita CSV, e no celular ninguém converte Excel em CSV. O importador novo já lê Excel, PDF e **print de tela**, mas está numa branch não mesclada. Colocá-lo na `main` é o passo 0 (CONV-00).
5. **A porta mais rápida** é o print da lista de clientes do AppBarber, lido no próprio aparelho: não depende do chat deles responder.
6. **Saber quem voltou sem trabalho:** "Já voltou" na fila (CONV-01), print da agenda do dia (CONV-11) e planilha do mês que atualiza quem já tem ficha (CONV-12).
7. **O Motor hoje nunca aprende o ritmo de quem convive:** cada "voltou" substitui a data anterior. Sem uma tabela de visitas de fora (CONV-08), o diferencial do CICLO não aparece para esse dono.
8. **Bloqueio número 1 é do Eduardo:** sem SMTP nenhum dono de fora cria conta. Depois vêm o canal de contato e o app nas lojas. O piloto pode começar pelo site.
9. **Antes de investir em aquisição:** medir a premissa "a maioria usa AppBarber" contra "70% estão no caderno" (seção 1) e pegar com o piloto um arquivo e um print reais do AppBarber.
10. **Decisões pendentes do Eduardo**, em ordem:
    1. SMTP;
    2. revisar e mesclar a pilha que leva ao conversor;
    3. canal de contato;
    4. convivência no Grátis;
    5. advogado antes de qualquer abordagem direta;
    6. provedor de pagamento, só na fase de troca.

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

### 3.0 Os 5 defeitos que a versão 1 não via

Todos conferidos no código; detalhe e etapa em [`jornada-do-dono.md`](jornada-do-dono.md).

| # | Defeito | Prova | Efeito na convivência |
| --- | --- | --- | --- |
| 1 | A mensagem "Chamar" leva o link de agendamento do CICLO | `src/lib/mensagens.ts:127`, `textoDeVolta` | O cliente marca no CICLO, o dono olha o AppBarber, os horários batem. **Pior que não ter o CICLO** |
| 2 | O Motor recebe uma data só por ficha importada; cada "voltou" substitui a anterior | `ciclo-de-quem-ja-atende.ts:40`, `history: [{ date: c.ultimaVisita }]` | O ritmo de cada cliente nunca é aprendido: o pilar do CICLO não existe para quem convive |
| 3 | O importador da `main` só aceita CSV e manda "salvar como CSV" | `importador.tsx:175`, `decodificar-texto.ts` | No celular a instrução é impossível; o dono para na etapa 4 |
| 4 | A segunda importação pula quem já tem ficha | `importacao-clientes.ts:283`; o mesmo na esteira nova, `lote-de-importacao.ts:198` | A planilha do mês não atualiza ninguém |
| 5 | No app nativo não há notificação nenhuma | LOJA-24 escondeu o Web Push no app; não há push nativo | O lembrete semanal só pode ser por e-mail, que depende do SMTP |

E o que **já existe** e a versão 1 subestimava:
- O **conversor universal** (`conversor/esteira-universal`, 94 commits, provado no navegador em 13/10) lê `.xlsx`, CSV com `;`, PDF, zip, contatos do celular, conversa do WhatsApp e **print de tela** por OCR no aparelho.
- Ele mostra o dinheiro parado antes de gravar e deixa desfazer em 7 dias (FATO, `docs/103-conversor/_progresso.md`).
- Está empilhado sobre `aprimoramento/onda-u2`, que está sobre a `onda-u1` (PR #150 aberto), com as migrations 0128 e 0129 só no banco local.

### 3.1 A proposta numa frase

> **"Continue agendando no AppBarber. O CICLO te mostra quem está sumindo e quanto vale chamar de volta, de graça."**

Variações para testar no piloto:
- "Seu AppBarber agenda. O CICLO traz de volta."
- "Quem não volta há mais tempo do que costuma: a lista com nome, telefone e valor."

### 3.2 O fluxo real do dono, com tempo estimado

| Momento | O que o dono faz | Tempo (HIPÓTESE) | Existe hoje? |
| --- | --- | --- | --- |
| Dia 1 | Cria a conta | 2 min | **Quebra sem SMTP** para quem é de fora; o link de confirmação provavelmente falha dentro do app (JORN-01) |
| Dia 1 | Responde "outro sistema", escolhe AppBarber, cai em "Vindo de outro sistema" | 1 min | FATO: existe, mas a tela não sabe que é o AppBarber (CONV-02) |
| Dia 1, porta A | Tira prints da lista de clientes no app do AppBarber e importa | 2 a 5 min | FATO: OCR existe no conversor; não está na `main` (CONV-00). Se a lista mostra a última visita: NÃO VERIFICADO |
| Dia 1, porta B | Pede a exportação no chat do AppBarber e importa o arquivo que chegar | minutos, mais a espera | Mensagem pronta existe; o formato deles é NÃO VERIFICADO; Excel só com o conversor |
| Dia 1, porta C | Digita de memória os 20 a 50 clientes que lembra | 10 a 15 min | FATO: existe (`ja-atendo`) |
| Logo depois | Vê "N passaram da hora, R$ X" e a fila | imediato | FATO: existe |
| **Toda semana** | Abre a fila, toca "Chamar" (a mensagem leva o link do AppBarber) e **"Já voltou"** em quem voltou | **5 min (HIPÓTESE)** | **Não existe:** a fila só tem "Chamar" e "Pular hoje" (FATO, `recuperar/fila.tsx:128`); o link é o do CICLO (CONV-10) |
| Fim do dia, opcional | Print da agenda do AppBarber: o CICLO confirma quem veio | 1 min | Não existe (CONV-11) |
| Toda semana | Recebe por e-mail "5 pessoas passaram do tempo esta semana" | 0 | Não existe; no app, nenhuma notificação (CONV-03) |
| Uma vez por mês, opcional | Importa de novo a lista do AppBarber; o CICLO atualiza as datas | 2 min | Não existe: a segunda importação pula quem já tem ficha (CONV-12) |

**O ponto que decide o caminho A:**
- O dono **não vai** lançar no CICLO cada atendimento que fez no AppBarber.
- O desenho certo é confirmar só **quem o Motor acha que sumiu**: poucas pessoas por semana, já na tela da fila.
- A busca de "retornos" que existe em `ja-atendo` exige procurar nome por nome. Serve para o primeiro dia, não para toda semana.

**Ressalva honesta sobre o diferencial:**
- O ritmo pessoal do Motor depende do histórico. Com um único ponto (a última visita), ele usa o ciclo padrão do serviço; com 1 a 2 intervalos, mistura o pessoal com o padrão; com 3 ou mais, usa a mediana dos últimos 5 (FATO, `src/core/cycle/compute.ts`, passo 3).
- **No começo da convivência, o CICLO também trabalha com um prazo padrão por serviço.** A vantagem sobre o relatório do AppBarber no dia 1 não é o ritmo pessoal. É a lista pronta, com nome, valor e o botão de chamar, sem configurar nada.
- O ritmo pessoal **só** aparece com o tempo **depois da CONV-08**. Hoje os "Já voltou" não se acumulam: cada um substitui o anterior (defeito 2 da seção 3.0).
- **A página de venda não pode prometer "ritmo de cada cliente" para quem acabou de chegar.** Ela promete a lista; o ritmo vem depois, e só quando a CONV-08 existir.

### 3.3 O que mudar no produto para conviver

| Ticket | O quê | Por quê | Tamanho |
| --- | --- | --- | --- |
| CONV-00 | **Levar o conversor universal à `main`**. Não é código novo: é revisar e mesclar a pilha `onda-u1` (PR #150), depois `onda-u2`, depois `conversor/esteira-universal`, e aplicar as migrations 0128 e 0129 na ordem certa | Sem ele o dono não importa nada pelo celular (defeito 3). O print de tela, porta mais rápida, só existe lá | P de código, G de revisão (Eduardo) |
| CONV-10 | **"Onde seus clientes marcam horário": No CICLO, ou Em outro sistema, por este link.** Em outro sistema, a mensagem de "Chamar" leva o link do AppBarber do dono (ou nenhum) e a página pública não agenda | Defeito 1: sem isso a convivência cria duas agendas | P |
| CONV-08 | **Visitas de fora no histórico do Motor:** tabela nova com RLS forçada, política e teste de isolamento; o cálculo e o recálculo da madrugada leem dela | Defeito 2: sem isso o ritmo pessoal nunca aparece para quem convive | M, com migration |
| CONV-01 | **Botão "Já voltou" em cada pessoa da fila** (`recuperar/fila.tsx` e `recuperar.tsx`): grava a visita de hoje (na tabela da CONV-08) e a pessoa sai da fila. **Se ela foi chamada nos últimos 30 dias, conta em "O Motor de Ciclo trouxe"** | Sem isso a fila acumula alarme falso, e o dono nunca vê o resultado: hoje só conta quem volta pelo link do CICLO, que na convivência ninguém usa | P |
| CONV-11 | **Print da agenda do dia do AppBarber:** OCR do conversor, casamento por nome com as fichas existentes, pergunta quando há dúvida, confirma "estes 8 vieram hoje?" | O jeito de o Motor saber de **todo mundo** que veio, com 1 minuto por dia | M |
| CONV-12 | **Planilha nova atualiza quem já tem ficha:** data mais recente que a da ficha vira visita em vez de "já existe uma ficha" | Defeito 4: é o caminho de quem prefere exportar uma vez por mês | M |
| JORN-01 | **Confirmar o cadastro por código de 6 dígitos** em vez de link | HIPÓTESE forte: o link abre fora do app, e a troca de código do `auth/callback` falha sem o dado do navegador original. Testar primeiro | P |
| CONV-09 | **Retornos em lote em "Quem você já atende":** lista com caixa de seleção agrupada por "faz 1 semana / 2 semanas / 1 mês / mais", no lugar da busca nome por nome | Para a base que entrou sem data (arquivo do AppBarber sem última visita) | P |
| CONV-02 | **A tela "Vindo de outro sistema" usa o sistema escolhido na Pergunta 1** e nomeia o AppBarber ("Peça no chat do AppBarber...") | Hoje fica genérica porque a escolha não é repassada (registrado em `docs/DECISOES.md`). Nomear concorrente com fato verificável já foi aprovado (`docs/83`, decisão 2) | P |
| CONV-03 | **Lembrete semanal da fila por e-mail**: "5 pessoas passaram do tempo, R$ X". No app, um aviso na tela Hoje ao abrir; push nativo fica para depois | Sem lembrete, o dono esquece o CICLO em 3 semanas (HIPÓTESE, medir no piloto). No app não há notificação nenhuma (defeito 5) | M (depende do SMTP) |
| CONV-04 | **Painel enxuto para quem só quer recuperar:** Hoje mostra a fila primeiro; menu sem comanda e caixa | Dois sistemas cansam. Os módulos já podem ser desligados pelo dono (FATO: Configurações, Módulos), mas a **Agenda é "sempre ligada"** (FATO, `planos.ts`, `CATALOGO`) | M |
| CONV-05 | **Exportação da base sem segundo fator obrigatório:** reautenticar com senha, como foi feito na exclusão de conta (LOJA-27) | A exportação completa existe (FATO, `api/v1/clients/export`, uma vez por mês) e a da conta inteira no conversor (CNV-009b, `.zip`). As duas exigem verificação em duas etapas, o que enfraquece a promessa "leve seus dados quando quiser" | P |

### 3.4 Preço da convivência

**FATOS**
- O plano Grátis tem limite de 50 clientes, mas é limite **suave**: o dono cadastra a base inteira e recebe um aviso (FATO, `planos.ts`, `SEVERIDADE.clientes = 'suave'`, e `podeCriar` deixa passar).
- O Grátis já inclui a fila do Motor e os lembretes.
- Hoje **tudo está liberado para todo mundo**: `ACESSO_ABERTO = true` no pré-lançamento (FATO, `acesso-aberto.ts`). Até a cobrança ligar, o preço da convivência não se testa, e o "1 mês do Solo de presente" (CONV-07) não muda nada para o dono. O piloto mede uso e resultado; a disposição de pagar se pergunta, não se mede.

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
| Cliente marca no CICLO e no AppBarber no mesmo horário | **Certa sem a CONV-10** | CONV-10 antes de qualquer piloto; teste que prova: no modo "outro sistema" a mensagem não leva o link do CICLO e a página pública não aceita agendamento |
| Print lido errado vira ficha errada | Média | Tudo que vem de imagem vai para conferência (FATO, CNV-018); "Já voltou" por print sempre pergunta antes de gravar |

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
2. **Resultado:** pelo menos 3 clientes que voltaram depois de "Chamar". Hoje "O Motor de Ciclo trouxe" só conta quem volta pelo link do CICLO (FATO, `fila.tsx:165`). Na convivência esse gatilho só é medível com a CONV-01 contando "chamado e voltou".
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
| Custo de construir | 5 a 6 semanas de código (CONV-10, 01, 08, 02, 03, 05, 11, 12), mais a revisão da pilha do conversor (CONV-00) | 3 a 6 meses (clube com cobrança, Pix, nota fiscal, migração) | As mesmas 5 a 6 semanas para começar, o resto conforme os gatilhos |
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

1. O dono tira 2 ou 3 prints da lista de clientes no app do AppBarber e importa (porta A, depois da CONV-00), **ou** digita de memória 20 clientes com "faz quanto tempo" (FATO: `ja-atendo`).
2. A fila aparece na hora, com os atrasados e o valor estimado (FATO: o Motor roda na hora).
3. Ele toca "Chamar" em um e manda a mensagem pelo próprio WhatsApp, com o link do AppBarber dele (FATO: o botão existe; o link certo depende da CONV-10).

**Isso já existe:** o fim da importação de memória e o da planilha mostram o cartão "N pessoas já estão atrasadas para voltar", que leva à fila (FATO, `ja-atendo/formulario.tsx:163` e `importar/importador.tsx:380`). Falta só pôr o **valor** nesse cartão (CONV-06), e a esteira do conversor já faz isso antes de gravar ("4 já passaram da hora: R$ 35,35", medido em 13/10). Com a CONV-00, a CONV-06 deixa de existir.

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

### 8.4 As 8 objeções

| Objeção | Resposta |
| --- | --- |
| "Meus clientes já têm o app do AppBarber" | Ótimo, continue com ele. O CICLO não troca o agendamento, só mostra quem parou de agendar |
| "Não quero dois sistemas" | Você abre o CICLO uma vez por semana, 5 minutos, para ver a lista e chamar quem sumiu. Se não valer, você para. É grátis |
| "E meus dados?" | Os dados são seus. Você baixa todos os seus clientes numa planilha quando quiser (depois do CONV-05, sem segundo fator obrigatório) |
| "O AppBarber já tem relatório de quem não volta" | Tem, e você escolhe o período à mão, igual para todos. O CICLO calcula para cada cliente e já põe o valor e o botão de chamar. Faça o teste com 20 clientes seus |
| "Não tenho tempo" | Tire 3 prints da sua lista de clientes no AppBarber e mande para o CICLO: ele lê sozinho. Ou digite 20 de memória em 10 minutos. Ou o Eduardo importa para você pelo WhatsApp |
| "Meu cliente vai marcar em dois lugares" | Não vai: no modo "uso junto", a mensagem do CICLO leva o link do seu AppBarber e o CICLO não recebe agendamento (CONV-10) |
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

**A ordem mudou na versão 2:**
1. primeiro o que impede o dano (duas agendas);
2. depois o que deixa entrar (o conversor);
3. depois o que faz o Motor aprender.

| Fase | Objetivo | Entregas | "Pronto" quando |
| --- | --- | --- | --- |
| 0 (antes da semana 1) | Destravar | SMTP (Eduardo); revisão da pilha `onda-u1`, `onda-u2`, conversor (Eduardo); canal de contato (Eduardo) | Um e-mail de fora do time cria conta; o conversor está na `main` com 0128 e 0129 aplicadas |
| 1 (semanas 1 e 2) | Convivência sem dano | CONV-10, CONV-01, CONV-02; JORN-01 se o teste do link falhar; medir a premissa (seção 1, passos 1 e 2) | No modo "outro sistema" a mensagem leva o link do AppBarber e a página pública não agenda (teste); "Já voltou" tira a pessoa da fila e conta "chamado e voltou" (integração); contagem de Chapecó escrita |
| 2 (3 e 4) | O Motor aprende | CONV-08 (visitas de fora, com migration); CONV-03 (lembrete por e-mail) | Três "Já voltou" com 20 dias de intervalo levam o ritmo para perto de 20 (integração com relógio avançado, recálculo rodado 2 vezes); lembrete chega num e-mail de fora do time |
| 3 (5 e 6) | Menos trabalho por semana, página e prova | CONV-11 (print da agenda) ou CONV-12 (planilha do mês), o que o arquivo e o print reais do primeiro dono indicarem; CONV-09; página "Use junto com o AppBarber" | A página está no ar; o teste de 10 minutos roda sem ajuda num celular, pelo site |
| 4 (7 e 8) | Piloto | 5 a 10 barbearias do AppBarber numa cidade, em convivência, pelo site ou pelo app se já aprovado | 5 contas ativas com fila aberta na semana 2 do piloto |
| 5 (9 e 10) | Medir | Painel semanal das métricas da seção 10.3; CONV-05 | Dados de 4 semanas de piloto |
| 6 (11 e 12) | Decidir | Manter A, acelerar para B ou priorizar o caderno, pelos critérios da seção 7 | Decisão escrita em `docs/DECISOES.md` |

**Antes da fase 3:** pegar **um arquivo exportado e dois prints** do AppBarber (a lista de clientes e a agenda do dia) com o primeiro dono que topar. Pode ser um conhecido do Eduardo, antes do piloto.
- Eles decidem se a CONV-11 ou a CONV-12 vem primeiro.
- E mostram se o print da lista traz a última visita (`jornada-do-dono.md`, testes no fim).

### 10.2 Tickets

**Código** (padrão do CICLO: um ticket, um commit, teste que reprova antes)

| ID | Prioridade | Tamanho | Arquivo provável | Teste que prova |
| --- | --- | --- | --- | --- |
| CONV-00 Conversor na `main` | P0 | revisão | PR #150, depois `aprimoramento/onda-u2`, depois `conversor/esteira-universal`; migrations 0128 e 0129 | A suíte inteira verde na `main`; o roteiro do navegador de 13/10 (`cnv023-importar.mjs`) passa contra a `main` |
| CONV-10 "Onde seus clientes marcam horário" | P0 | P | `src/lib/mensagens.ts` (`textoDeVolta`), quem monta o link na fila, página pública, `tenants.settings` | Unidade: com "outro sistema", o texto leva o link externo ou nenhum, nunca o do CICLO. Integração: a página pública recusa agendamento nesse modo |
| CONV-01 "Já voltou" na fila | P0 | P | `src/app/admin/recuperar/fila.tsx`, `recuperar.tsx`; gravar pela tabela da CONV-08 (ou, antes dela, pela porta `retornos` de `quem-ja-atendo.ts`) | Integração: marcar grava a visita, recalcula o ciclo, tira da fila e, se houve chamada em 30 dias, entra em "O Motor de Ciclo trouxe" |
| CONV-02 Tela nomeia o sistema de origem | P0 | P | `onboarding/perfil`, `rotaAposResponderPerfil` (`?de=appbarber`), `vindo-de-outro-sistema/page.tsx` | Unidade: "appbarber" vê o texto e as 4 portas do AppBarber; "outro" vê o genérico; valor fora da lista cai no genérico |
| JORN-01 Cadastro por código de 6 dígitos | P0 se o teste falhar | P | `api/v1/auth/signup`, `(auth)/verificar`, modelo de e-mail do Supabase | Integração: cadastrar, receber o código, digitar e entrar, sem abrir link nenhum |
| CONV-08 Visitas de fora no histórico | P1 | M | migration nova (RLS forçada + política + teste de isolamento), `ciclo-de-quem-ja-atende.ts`, `recomputarCiclosDoTenant` | Integração: 3 visitas de fora com 20 dias de intervalo dão ritmo perto de 20; recálculo 2 vezes dá o mesmo; RLS: outro salão não lê |
| CONV-03 Lembrete semanal por e-mail | P1 | M | novo trabalho agendado (`src/app/api/cron/...`), `mensageria.ts`; aviso na Hoje | Integração: segunda-feira gera um aviso por dono com fila não vazia; nenhum para conta de demonstração |
| CONV-11 Print da agenda do dia | P1 | M | `src/core/ingestao/imagem.ts`, `juntar.ts`, tela nova "Quem veio hoje" | Unidade com prints do corpus: nome igual casa, parecido pergunta, homônimo nunca casa sozinho |
| CONV-12 Planilha nova atualiza datas | P1 | M | `lote-de-importacao.ts` (passo 2, "já existe uma ficha") | Integração: data mais nova vira visita; mais velha ou igual não muda nada; rodar 2 vezes não duplica |
| CONV-09 Retornos em lote | P2 | P | `ja-atendo/formulario.tsx` | Navegador a 390 px: marcar 10 pessoas em "faz 2 semanas" grava as 10 |
| CONV-05 Exportar sem segundo fator obrigatório | P2 | P | `api/v1/clients/export/route.ts`, `api/v1/account/export` (conversor) | Unidade: sem segundo fator, pede a senha; com segundo fator cadastrado, continua exigindo |
| CONV-07 1 mês do Solo na importação com última visita | P3, só quando a cobrança ligar | M | `src/core/billing/`, `lote-de-importacao.ts` | Unidade: importar com última visita concede 30 dias; sem, não concede |
| CONV-04 Painel enxuto "só recuperar" | P3 | M | `admin/layout.tsx`, `CATALOGO` em `planos.ts` | Navegador: com o modo ligado, o menu não mostra comanda e caixa |

**CONV-06 saiu:** a esteira do conversor já mostra o valor antes de gravar.

**Decisões do Eduardo**, em ordem:
1. **SMTP:** sem ele nenhum dono de fora cria conta, e o lembrete por e-mail não sai. É o bloqueio número 1 de tudo.
2. **Revisar e mesclar a pilha até o conversor** (CONV-00), com as migrations na ordem.
3. **Canal de contato** (`NEXT_PUBLIC_CONTATO_*`): sem ele, "Me manda que eu faço" não aparece.
4. **A convivência fica no Grátis**, com o limite de 50 clientes suave.
5. **Aprovação jurídica** de qualquer contato direto com donos.
6. **Contas das lojas e envio do app.** O piloto não depende disso: pode rodar pelo site.
7. **Provedor de pagamento** para Pix, sinal e clube, só quando a fase de troca chegar.

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
| Clientes recuperados por conta por mês | A medir ("chamado e voltou", depois da CONV-01) | 3 ou mais |
| Clientes com ritmo próprio (3 ou mais visitas no histórico) | 0 para quem convive (FATO: o cálculo recebe uma data só) | 20% da base ativa em 90 dias, depois da CONV-08 |
| Minutos por semana no CICLO (perguntado) | A medir | 5 ou menos |
| Receita recuperada por conta por mês | A medir | Pelo menos 2 vezes o preço do Solo |
| Ativação na semana 1 (importou e chamou alguém) | A medir | 60% |
| Permanência em 30 e 60 dias | A medir | 70% e 50% |
| Conversão de convivência para Solo | A medir | 20% em 60 dias |

### 10.4 Piloto

- **Quem:** 5 a 10 barbearias de 1 a 5 cadeiras que usam o AppBarber, numa cidade média abaixo do teto de 120 na vitrine, de preferência onde o Eduardo possa ir pessoalmente.
- **Recrutamento:** pessoalmente ou por indicação (seção 9, dentro das regras); nada de lista montada com a vitrine deles.
- **Porta de entrada:** o site `seuciclo.com.br` no celular, se o app ainda não estiver nas lojas. O Eduardo ou alguém do time acompanha a importação do primeiro dono ao vivo, com a regra de não guardar o arquivo fora do CICLO.
- **O que medir toda semana:** se abriu a fila, quantos "Chamar", quantos "Já voltou", quantos "chamado e voltou", quanto valeu, e quanto tempo levou (perguntar).
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
| Se a lista de clientes e a agenda do AppBarber saem legíveis num print | Dois prints de um dono, passados na esteira do conversor em ambiente local |
| Se o link de confirmação de e-mail falha dentro do app | Cadastro de teste no Android com o Gmail, em ambiente de teste |
| Se o seletor de arquivo do Android esconde o CSV que veio pelo WhatsApp | Um CSV recebido pelo WhatsApp, num Android real |
| Se "Já voltou" deixa o Motor melhor ou só mais limpo | Comparar no piloto a taxa de acerto das previsões (o Motor já mede acerto: FATO, tela do Recuperar mostra "previsões conferidas") |

---

## 12. Revisão adversarial deste plano

### 12.1 Primeira rodada (versão 1)

Reli o plano procurando os cinco problemas pedidos no prompt. O que achei e corrigi:

1. **Promessa que o produto não cumpre.** A primeira versão da mensagem dizia "ritmo de cada cliente" para quem acabou de chegar. O Motor só usa o ritmo pessoal com histórico (`compute.ts`, passo 3). Corrigido: a promessa do dia 1 é a lista; o ritmo vem com as visitas (seções 3.2 e 8.1).
2. **Afirmação sobre o CICLO não conferida.** Eu ia escrever que existe resumo semanal da fila. Procurei no código e não existe; virou o ticket CONV-03. Também conferi que a exportação existe mas exige segundo fator (virou CONV-05) e que o limite de 50 clientes é suave.
3. **Estratégia apoiada em suposição não testada.** A premissa "a maioria usa AppBarber" choca com o Sebrae. Não escondi: a seção 1 diz o que se sabe, o que é inferência e os 3 testes que fecham a dúvida. A recomendação tem uma condição de mudança ligada a isso (seção 7).
4. **Número sem rótulo.** Revisei as tabelas. As metas da seção 10.3 são HIPÓTESE de partida, ancoradas no equilíbrio de 8 pagantes do `docs/88`; ficaram marcadas como metas, não como previsões.
5. **Uso da vitrine fora das regras.** O canal "barbearias que reclamaram em público" e qualquer lista montada com a vitrine foram descartados. A vitrine só entra como contagem agregada.

6. **Lacuna que já estava fechada.** Eu tinha marcado como HIPÓTESE que o fim da importação não levava à fila. Conferi: as duas telas já mostram o cartão "N pessoas atrasadas" com link para o Recuperar. O CONV-06 encolheu para pôr só o valor no cartão.

### 12.2 Segunda rodada (versão 2)

Reli a versão 1 seguindo o dono passo a passo no código, do download ao uso semanal, em vez de seguir as seções do prompt. A primeira rodada conferiu frases; esta conferiu o caminho. Achei:

7. **O plano recomendava uma convivência que o produto sabota.** A mensagem "Chamar" leva o link de agendamento do CICLO (`mensagens.ts:127`). Com o dono agendando no AppBarber, isso cria duas agendas. Virou a CONV-10, P0, antes de qualquer piloto.
8. **A ressalva sobre o ritmo era otimista.** A versão 1 dizia que o ritmo pessoal "aparece com o tempo, conforme os 'Já voltou' se acumulam". Não se acumulam: o cálculo recebe uma data só (`ciclo-de-quem-ja-atende.ts:40`). Virou a CONV-08.
9. **A etapa "importar" foi tratada como resolvida.** O importador da `main` só aceita CSV; no celular é um beco. O conserto já existe numa branch não mesclada (o conversor). Virou a CONV-00, e a porta do print passou a ser a primeira.
10. **A medida de sucesso não media a convivência.** "O Motor de Ciclo trouxe" só conta quem volta pelo link do CICLO. O gatilho 2 da seção 5 e a meta "clientes recuperados" dariam zero mesmo com o produto funcionando. A CONV-01 passou a contar "chamado e voltou".
11. **O lembrete prometia notificação que o app não tem.** O Web Push foi escondido no app (LOJA-24). O lembrete é por e-mail, e o SMTP subiu para o bloqueio número 1.
12. **Benefício sem efeito.** Com `ACESSO_ABERTO = true`, o "1 mês do Solo" não muda nada para o dono hoje. A CONV-07 desceu para P3.

O que ainda pode estar errado nesta versão:
- **O print pode não servir.** A porta A e a CONV-11 dependem de o app do AppBarber mostrar nomes legíveis e, para a fila no dia 1, a última visita. Nada disso foi visto. Se não servir, a porta B (arquivo) e a C (memória) continuam, e a CONV-12 sobe.
- **5 a 6 semanas de código é estimativa.** A CONV-00 depende da revisão do Eduardo, que já tem PRs abertos esperando (#142, #144, #149, #150 e #151). O gargalo real é a fila de revisão, não o código.

Ficaram sem verificação, e estão na seção 11:
- o formato real da exportação do AppBarber;
- os prints do AppBarber;
- o dado de produção da Pergunta 1;
- o link de confirmação dentro do app;
- a regra da nota fiscal para MEI.

---

## 13. O que mudou da versão 1 para a 2

| Antes | Agora | Por quê |
| --- | --- | --- |
| Passo 1: "Já voltou" | Passo 0: SMTP e conversor na `main`; passo 1: CONV-10 (sem agenda dupla) e "Já voltou" | A convivência sem a CONV-10 faz mal; sem SMTP e conversor ninguém entra |
| Ritmo pessoal "vem com o tempo" | Só vem com a CONV-08 | O cálculo recebe uma data só |
| Importar = planilha ou memória | 4 portas: print, arquivo, memória, "me manda" | O conversor já lê print, Excel e PDF |
| Lembrete "por e-mail ou notificação" | Só e-mail, mais um aviso na Hoje | O app não tem notificação |
| "O Motor de Ciclo trouxe" como medida | "Chamado e voltou" | Na convivência ninguém volta pelo link do CICLO |
| 7 tickets | 13 tickets, CONV-06 removido | Seções 3.3 e 10.2 |
| Sem jornada | [`jornada-do-dono.md`](jornada-do-dono.md), etapa por etapa | Pedido de 16/10 |
