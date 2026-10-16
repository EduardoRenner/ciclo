# 108 · Modelo de negócio: quanto cobrar, como cobrar e o que dar de graça

Escrito em 16/10/2026. **É recomendação, não decisão:** os itens marcados **DECISÃO DO EDUARDO** precisam do sim dele, e nada aqui mexe em código.

O que entrou na conta:
- o teste de rua do Eduardo numa barbearia que usa o AppBarber;
- a conversa com um fundador de outro SaaS da região, que atende autônomos;
- o que o projeto já mediu (`docs/18`, `docs/87`, `docs/88`, `docs/103-conversor/00b-mercado.md`);
- a página do BarbUp, conferida hoje.

Rótulos: **FATO** (com fonte), **INFERÊNCIA**, **HIPÓTESE** (com o teste que decide).

## 1. A recomendação em 6 linhas

1. **Um produto horizontal, vendido nicho por nicho.** Mesmo preço e mesmo app para todos; a abordagem de rua e o texto de venda mudam por nicho, um de cada vez.
2. **R$ 39 por mês, até 2 profissionais.** Equipe: **R$ 79 até 6**. Tudo incluído nas duas faixas.
3. **30 dias grátis, sem cartão.** Depois, a conta fica só para ler e exportar até assinar; nada some.
4. **Pix Automático pelo Mercado Pago** como forma principal (cerca de 1%), cartão como opção. **Anual: 10 meses pelo preço de 12**.
5. **Sem taxa por serviço e sem comissão sobre atendimento.** O CICLO não é marketplace; cobrar por atendimento seria cobrar pelo cliente que já é do profissional.
6. **Antes de tudo isso funcionar:** o cadastro não pode depender de e-mail (seção 6).

## 2. O que o mercado cobra (o piso e o teto)

| Concorrente | Preço | Critério | Fonte |
| --- | --- | --- | --- |
| Simples Agenda | R$ 39,90 | 1 profissional, tudo incluído | FATO, `docs/18` §A.2 (página do fornecedor, medido em ago/2026) |
| BarbUp | R$ 49,90 / 89,90 / 129,90 | até 2 / 5 / 12 profissionais; 14 dias grátis sem cartão; anual com 20% de desconto | FATO, barbup.com.br, conferido em 16/10/2026 |
| Gendo | R$ 69,90 / 124,90 | faixas | FATO, `docs/103-conversor/00b-mercado.md` |
| Avec | R$ 88,90 | 1 a 2 profissionais | idem |
| AppBarber | R$ 79,90 a 219,90 | por profissional; módulos à parte | FATO, relatório do AppBarber |
| Booksy | R$ 99,99 + R$ 20 por agenda | por agenda | `docs/103-conversor/00b-mercado.md` |
| InfinitePay Agendamentos | grátis | ganha na maquininha | FATO, pesquisa de 26/08/2026 |

**INFERÊNCIA:**
- **Agenda sozinha vale zero:** a InfinitePay dá de graça.
- **Sistema sério começa em R$ 39,90** (Simples Agenda).
- **Quem já paga sistema paga R$ 80 a R$ 110** (AppBarber, Avec).
- **O mercado inteiro cobra por faixa de profissionais**, e o cliente já sabe ler esse formato (`docs/18` §A.2).

**R$ 39 até 2 profissionais fica:**
- abaixo do BarbUp (R$ 49,90 até 2);
- no mesmo preço do Simples Agenda, que é para 1 profissional só;
- na metade do AppBarber.

## 3. O que o teste de rua disse

**FATO** (relato do Eduardo, 16/10/2026): numa barbearia com 2 barbeiros que **já usa o AppBarber**, o preço de R$ 39 para os dois foi achado barato, e eles gostaram da funcionalidade, chamada de "coisa simples que funciona".

**O que isso prova e o que não prova:**
- **Prova:** o preço não assusta, e a proposta "usar junto com o AppBarber" faz sentido para quem a ouve.
- **Não prova** que eles pagam: "achar barato" numa conversa é diferente de pôr o Pix. É um ponto de dado, não uma amostra.
- **Muda uma coisa no norte:** a barbearia que usa o AppBarber entra no teste de nicho como **terceiro grupo**, e não só como frente passiva. Custa pouco testar, e houve sinal real (ver `00-decisao.md` §4).

## 4. A conta, sem ilusão

O custo não é só o Supabase. É pouco, mas existe (FATO, `docs/88`):

| Custo | Valor |
| --- | --- |
| Fixo (Supabase Pro + Vercel Pro, contador, domínio) | R$ 433 por mês hoje |
| Imposto (ME no Simples, Anexo III com Fator R) | 6% da receita (Anexo V seria 15,5%; o contador confirma) |
| Pix Automático (Mercado Pago) | cerca de 1% |
| Cartão | cerca de 4 a 5% |
| WhatsApp automático | **zero enquanto o envio for pelo WhatsApp do próprio profissional (`wa.me`).** Mensagem de marketing pela API oficial custa em torno de R$ 0,31 cada (pesquisa de 26/08; o fundador local citou R$ 0,30 a 0,50) |
| Suporte | **o custo de verdade.** É o tempo do Eduardo |

**Quanto sobra de cada assinatura,** com Pix e 6% de imposto:

| Preço | Sobra por mês | Contas para pagar o fixo de hoje | Contas para R$ 30 mil por mês de receita |
| --- | --- | --- | --- |
| R$ 30 | R$ 27,90 | 16 | 1.000 |
| **R$ 39** | **R$ 36,27** | **12** | **770** |
| R$ 49 | R$ 45,57 | 10 | 613 |

**R$ 39 em vez de R$ 30:** são 30% a mais por conta, e o teste de rua disse que R$ 39 é barato. Com R$ 30, o CICLO precisa de 230 contas a mais para chegar no mesmo lugar, e cada conta a mais é suporte a mais.

### Mil clientes é possível? Sim. A pergunta certa é em quanto tempo.

**O que segura o número não é o custo, é a entrada e a saída de clientes.** Pequeno negócio cancela de 3 a 10% por mês; o saudável é de 3 a 5% (pesquisa de 26/08).

| Para manter | Com 5% de cancelamento por mês | Com 25% dos testes virando assinatura (HIPÓTESE) |
| --- | --- | --- |
| 770 assinantes (R$ 30 mil a R$ 39) | 39 assinaturas novas por mês só para ficar parado | cerca de 155 testes por mês, uns 5 por dia |
| 1.000 assinantes (R$ 30 mil a R$ 30) | 50 por mês | cerca de 200 testes por mês, uns 7 por dia |

**INFERÊNCIA:**
- Nada disso sai sem anúncio pago e sem indicação. O teto de quanto se pode gastar para ganhar um cliente fica em uns R$ 100 a R$ 180 (pesquisa de 26/08).
- Com uma pessoa só no suporte, o limite medido é de umas 40 contas novas por mês (`docs/88`).
- **Para chegar em 770:**
  - **suporte quase zero:** onboarding sozinho e o "me manda que eu faço" só no começo;
  - **indicação embutida:** "convide outra profissional e ganhe um mês";
  - **canais que não pedem o Eduardo a cada conta:** Instagram, como fez o fundador local, grupos e criadores do nicho.
- **Prazo realista:** de 18 a 30 meses, nicho por nicho. Não é impossível; é um trabalho de distribuição, não de produto.

## 5. Grátis para sempre ou teste?

| Opção | A favor | Contra |
| --- | --- | --- |
| Grátis para sempre com limite (o que o código tem hoje, com 50 clientes de limite suave) | Porta de entrada para o barbeiro de cadeira alugada; boca a boca | O brasileiro adora grátis (o fundador local avisou: "vai ter cliente que só usa grátis"). Cada conta grátis gasta suporte, que é o recurso escasso |
| **Teste de 30 dias, sem cartão, depois só leitura até assinar** | Filtra quem tem interesse; 30 dias cobrem um a dois ciclos de volta (unha 15, cílios 21, corte 21), então o Motor mostra quem voltou; é o que BarbUp, Simples Agenda e o fundador local fazem | Perde quem só queria a agenda, mas essa pessoa não é cliente: a InfinitePay dá a agenda de graça |
| Teste com cartão desde o início | Filtra mais | Afasta exatamente o público leigo e sem cartão |

**Recomendação: o teste de 30 dias, sem cartão.**
- **No fim do teste, a conta não morre.** Fica só para ler e exportar, com a página pública mostrando "indisponível", até assinar. É o desenho do `docs/87` D1, com 30 dias em vez de 21.
- **A alavanca do fundador local** ("depois do teste, mais um tempo grátis só para quem põe o cartão") fica de reserva. Usar só se, no piloto, menos de 20% dos testes virarem assinatura.
- **O argumento de venda no fim do teste é o número da própria pessoa:** "nestes 30 dias, X clientes voltaram depois que você chamou, R$ Y". Isso depende de a medida "chamado e voltou" existir (CONV-01 no plano do AppBarber; para quem agenda no CICLO, já conta).

**DECISÃO DO EDUARDO:**
- trocar o grátis para sempre do código pelo teste de 30 dias;
- trocar R$ 49 / 99 do `docs/87` D2 por **R$ 39 / 79**.

Ainda não é hora de mexer na tabela: o `docs/87` mandou não mexer em preço público antes de 30 pagantes. Como ninguém paga ainda, este é o momento mais barato de decidir.

## 6. O que o fundador local ensinou e já vale para o CICLO

| Lição dele | O que vira no CICLO |
| --- | --- |
| "Nosso público de 40+ não tinha acesso ao e-mail; com menos de 2 meses tivemos que mudar a verificação." Ele perdeu clientes por isso | **O mesmo público, o mesmo risco.** Hoje o cadastro do CICLO depende de e-mail de confirmação, e o e-mail nem sai sem SMTP. **Proposta:** desligar a confirmação obrigatória no Supabase ("Confirm email"). A conta funciona na hora e o e-mail fica só para recuperar a senha. **DECISÃO DO EDUARDO**, porque troca um pouco de segurança (e-mail falso) por muito menos atrito. **Isso também tira o SMTP do caminho do cadastro** (continua precisando para "esqueci a senha"). Depois, entrar com código pelo WhatsApp, que é a categoria barata da Meta |
| "Tem que levar no colo: às vezes tu cria a conta do cara" | É o "me manda que eu faço" que já existe (falta o canal de contato). No alpha e no teste de nicho, o Eduardo cria junto, ao vivo (kit de campo) |
| "Não dá para cobrar de cara; quando ele fecha um negócio de R$ 150, a assinatura se pagou" | No CICLO a prova é ainda mais direta: **2 clientes que voltam pagam o mês** (corte de R$ 45, manutenção de cílios de R$ 120). A tela de fim de teste mostra isso com o número da pessoa |
| "Tem que prender o cliente: a plataforma tem que fazer parte do dia" | **Prender pelo valor, nunca pelo dado:** a exportação continua livre, e é promessa nos termos. O que prende é a agenda do dia, o caixa e a comissão, e o histórico que faz o Motor acertar o ritmo de cada cliente (quem sai recomeça do zero noutro lugar) |
| "App só para o profissional; o cliente final usa o site" | O CICLO já é assim: app do dono e página pública sem conta para o cliente |
| "Crescer com um nicho só primeiro" | É o `00-decisao.md`. Produto horizontal, venda vertical |
| WhatsApp: o número banido se troca, mas o portfólio banido é o problema; marketing é caro, utilidade é barata | **Não automatizar "volta" pelo WhatsApp oficial agora:** é marketing, o caro. O `wa.me` do próprio profissional já resolve. Lembrete de horário, que é utilidade, é candidato a pacote pago no futuro |
| Ele usa Stripe (3% no saque) | Para o CICLO, o Pix Automático do Mercado Pago (cerca de 1%) é melhor: alcança quem não tem cartão. Já é a decisão de 06/09 |

## 7. O que NÃO fazer

- **Cobrar por atendimento ou comissão** sobre o cliente do profissional.
- **Preço por nicho diferente.** Complica e não há motivo: o custo é igual.
- **Plano grátis para sempre com a fila do Motor dentro.** É dar o diferencial e ficar com o suporte.
- **Prender dado.** A exportação continua livre; é promessa nos termos e a melhor resposta ao AppBarber, onde é preciso "pedir no chat".
- **WhatsApp ilimitado em qualquer preço.** O custo cresce com o sucesso (pesquisa de 26/08).
- **Desconto por escassez falsa.** O preço de fundador travado por 12 meses (`docs/87` D5) já recompensa quem chega primeiro.

## 8. Próximos passos

1. **Eduardo decide:**
   - R$ 39 / 79;
   - teste de 30 dias no lugar do grátis para sempre;
   - confirmação de e-mail desligada.
   As três estão em "DECISÃO DO EDUARDO" acima.
2. **No teste de nicho:** perguntar o preço com o número na tela ("você pagaria R$ 39 por isto?"), em todos os grupos, e anotar na ficha. A coluna já existe no `ficha-de-campo.csv`; atualizar o texto de R$ 49 para R$ 39 se ele aprovar.
3. **Código, depois do sim:** mudar o preço em `planos.ts` (há guarda `preco-em-um-lugar-so`) e o teste de 30 dias no lugar do Grátis. É pequeno, mas mexe em cobrança: entra num PR só, revisado.
