# 108 · Modelo de negócio: quanto cobrar, como cobrar e o que dar de graça

Escrito em 16/10/2026.

## 0. DECIDIDO (16/10/2026, por delegação do Eduardo: "decida por mim o modelo de negócio mais eficiente")

Substitui o `docs/87` D2 (R$ 49 / 99) e D3 (21 dias de teste). O resto do `docs/87` continua valendo:
- a cortesia até o lançamento;
- os 7 dias de graça;
- a conta pausada só para ler e exportar;
- o teto de contas por onda.

| # | Decisão | Por quê | O que faz mudar |
| --- | --- | --- | --- |
| M1 | **R$ 39 por mês até 2 profissionais. R$ 79 até 6. Acima de 6, "fale com a gente".** Tudo incluído nas duas faixas | O teste de rua achou R$ 39 barato. Fica abaixo do BarbUp (R$ 49,90 até 2) e na metade do AppBarber. Sobram R$ 36,27 por conta. É a cunha para entrar ao lado de quem já paga outro sistema | **Com 30 pagantes:** se mais de 40% dos testes virarem assinatura, o preço para quem chega **sobe para R$ 49** (quem já assina fica no seu, M4). Se menos de 15% virarem e o motivo dito for preço, testa R$ 29 numa cidade |
| M2 | **30 dias grátis, sem cartão. Depois, 7 dias de graça. Depois, conta pausada** (lê e exporta tudo, não cria nada, página pública "indisponível") **até assinar; assinar reativa na hora** | 30 dias cobrem 1 a 2 retornos e deixam o Motor mostrar quem voltou com o número da pessoa. Sem cartão porque o público é leigo e sem cartão | Se menos de 20% dos testes virarem assinatura: no fim do teste, oferecer **mais 15 dias para quem cadastra o Pix Automático** (a alavanca do fundador local) |
| M3 | **Sem plano grátis para sempre depois do lançamento oficial.** Até lá, `ACESSO_ABERTO` segue como cortesia | Grátis para sempre gasta o suporte, que é o recurso escasso. A agenda grátis já existe no mercado (InfinitePay); o diferencial não se dá | Se o barbeiro de cadeira alugada se mostrar canal forte no teste de nicho, reabrir um grátis só de agenda e página, **sem a fila do Motor** |
| M4 | **Preço de fundador:** quem entra antes do lançamento oficial (11/01/2027) e assina até 30 dias depois fica com o preço travado por 12 meses | Recompensa quem chega primeiro sem desconto nem escassez falsa (`docs/87` D5) | — |
| M5 | **Pix Automático pelo Mercado Pago** como forma principal; cartão como opção. **Anual: 10 meses pelo preço de 12 (R$ 390)** | Cerca de 1% contra uns 4 a 5% do cartão; alcança quem não tem cartão. O anual segura quem gostou (menos cancelamento) e adianta caixa | — |
| M6 | **Indicação: quem indica e quem é indicado ganham 1 mês cada, quando o indicado paga a primeira mensalidade** | É o único canal que cresce sem o Eduardo a cada conta, e o caminho dos 770 assinantes depende dele. Custa R$ 36 por cliente novo, bem abaixo do teto de custo de aquisição | Se virar fraude (conta-fantasma), exigir 2 mensalidades pagas |
| M7 | **Sem taxa por atendimento, sem comissão, sem preço por nicho, sem WhatsApp ilimitado** | O cliente é do profissional; o custo é igual em todo nicho; o WhatsApp de marketing cresce com o sucesso | Lembrete automático por WhatsApp (categoria utilidade, barata) pode virar **adicional pago** quando houver credencial da Meta |
| M8 | **Cadastro sem depender de e-mail:** a confirmação obrigatória de e-mail sai; o e-mail fica para recuperar a senha. Depois, entrar com código pelo WhatsApp | O público de mais de 40 anos não usa e-mail (lição do fundador local, que perdeu clientes por isso). Também tira o SMTP do caminho do cadastro | Se aparecer abuso com e-mail falso, volta a confirmar, depois do primeiro dia de uso |

**O que fica com o Eduardo,** por ser produção ou conta dele:
- desligar "Confirm email" no painel do Supabase de produção;
- criar os planos R$ 39, R$ 79 e R$ 390 anual no Mercado Pago, quando o CNPJ e a conta existirem (`docs/87` D6).

**O que entra no código,** num PR revisado, como manda o congelamento (é o que destrava o piloto):
- `planos.ts`;
- a tela de preços;
- o fim do teste;
- o cadastro que entra direto quando não há confirmação.

O resto deste documento é a pesquisa e a conta que sustentam a decisão.

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

**Decidido em 16/10 (M1 a M3, seção 0).** Ninguém paga ainda, então este era o momento mais barato de decidir. Depois de 30 pagantes, só o gatilho de M1 mexe no preço.

## 6. O que o fundador local ensinou e já vale para o CICLO

| Lição dele | O que vira no CICLO |
| --- | --- |
| "Nosso público de 40+ não tinha acesso ao e-mail; com menos de 2 meses tivemos que mudar a verificação." Ele perdeu clientes por isso | **O mesmo público, o mesmo risco.** Hoje o cadastro do CICLO depende de e-mail de confirmação, e o e-mail nem sai sem SMTP. **Proposta:** desligar a confirmação obrigatória no Supabase ("Confirm email"). A conta funciona na hora e o e-mail fica só para recuperar a senha. **Decidido em 16/10 (M8).** Troca um pouco de segurança (e-mail falso) por muito menos atrito; desligar em produção é com o Eduardo. **Isso também tira o SMTP do caminho do cadastro** (continua precisando para "esqueci a senha"). Depois, entrar com código pelo WhatsApp, que é a categoria barata da Meta |
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

1. **Decidido** (seção 0). Do Eduardo, só o que é produção: desligar a confirmação de e-mail no painel e criar os planos no Mercado Pago quando houver CNPJ.
2. **No teste de nicho:** perguntar o preço com o número na tela ("você pagaria R$ 39 por isto?") em todos os grupos, e anotar na ficha (`ficha-de-campo.csv`, já com R$ 39).
3. **Código:** preço em `planos.ts` (há guarda `preco-em-um-lugar-so`), teste de 30 dias no lugar do Grátis e cadastro que entra direto. Mexe em cobrança: entra num PR só, revisado.
