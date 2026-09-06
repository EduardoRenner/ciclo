# 56 · ESTRATÉGIA DE PROSPECÇÃO LOCAL — O PRIMEIRO LOTE DE PAGANTES

> **Contexto que muda tudo, confirmado no código em 2026-09-06:** o Motor de Ciclo (a razão do
> produto existir) já funciona por completo no plano **Grátis**, sem depender de nenhuma
> integração pendente. `podeUsarCapacidade` (`core/billing/planos.ts`) mostra que o grátis inclui
> `cycle_engine` e `reminders`, e o envio manual usa `wa.me` — abre o WhatsApp da PRÓPRIA dona do
> salão com a mensagem pronta, sem API, sem F0, sem custo, para sempre. O que o grátis não dá é
> **mandar para todos de uma vez** (`envio_em_lote`, trava do plano Essencial).
>
> **Conclusão prática: você não precisa esperar nada técnico para começar a prospectar e demonstrar
> valor real.** O que falta (PSP, WhatsApp automático) muda *como* você cobra, não *se* você pode
> começar a mostrar o produto e fechar a primeira venda manual.

---

# 1 · Quem procurar primeiro, e por quê

O `docs/18-MONETIZAÇÃO-PLANO.md` §B.2 já decidiu isso com pesquisa por trás — não é chute novo:

**Barbearia e salão pequeno, 1 a 4 profissionais, na sua própria cidade.**

Motivos que continuam valendo:
- É a única profissão com catálogo real testado (o `dom-rocha` é um negócio de verdade).
- Ciclo de retorno curto (2-4 semanas) — o dono vê o Motor de Ciclo acertar em semanas, não meses.
- Já tem hábito de pagar por sistema (é por isso que Trinks/Belasis/Booksy existem).

**Dentro disso, o filtro que importa para VOCÊ especificamente:** escolha os primeiros 10-15 numa
área que dê pra visitar a pé ou de carro em 20 minutos. Densidade geográfica não é conveniência sua
— é o motor do boca a boca: barbeiro conhece barbeiro do bairro ao lado, e a Fase G do `docs/18`
já registra isso como o laço de crescimento mais barato que existe (parceria/indicação local, custo
de engenharia zero).

**Quem NÃO procurar agora:** salão de 5+ profissionais (território de sistema já instalado, ciclo
de venda mais longo, exige o módulo `team` que está mais recente e menos testado), e qualquer
profissão fora de beleza — mesmo o produto funcionando, você não tem munição de vendas pronta
(objeção, catálogo, prova) para outra categoria ainda.

---

# 2 · O que vender HOJE vs. o que prometer para depois

| Já funciona, sem esperar nada | Ainda não — não prometa data |
|---|---|
| Agenda com link público, sem marcar 2 no mesmo horário | Cobrança automática recorrente (você mesmo vai cobrar por Pix, combinado, por enquanto) |
| Motor de Ciclo: lista de quem sumiu, ordenada por quanto vale chamar | Lembrete automático por WhatsApp (F0 ainda desligado) |
| Mensagem pronta, um toque, abre o WhatsApp da pessoa | Envio em massa para todos de uma vez (isso é Essencial pago, e funciona — não é o que falta) |
| Comanda, caixa, "quanto sobrou" (Essencial+) | — |
| Site do salão com todos os serviços, sem concorrente aparecendo do lado | — |

**A regra de ouro da demo:** mostre o que já roda. Não mencione WhatsApp automático nem cobrança
automática como coisa que "está chegando" — o `docs/50`/`51` desta base tem uma regra repetida
várias vezes: nunca prometer o que a tela de hoje não mostra. Vale para código, vale para venda.

---

# 3 · O roteiro de visita — passo a passo

## 3.1 · Antes de entrar

Não vá na hora de pico (a dona/dono não vai te dar atenção com cliente na cadeira). Vá no fim da
tarde de segunda ou início de tarde de terça — os dias historicamente mais fracos do setor.

## 3.2 · A abertura — pergunta, não apresentação

Não comece com "eu tenho um sistema". Comece com a dor, na linguagem da pesquisa que já embasa
todo o produto (`docs/47` P01/P02):

> "Você tem ideia de quantos clientes pararam de vir esse ano sem avisar?"

A resposta quase sempre é "não sei" ou um chute. É aí que o produto entra — não como feature, como
resposta a uma pergunta que a pessoa acabou de admitir não saber.

## 3.3 · A demonstração — no celular dela, com os dados dela

Não mostre slide, não mostre a conta demo. **Cadastre o salão de verdade ali, na hora**, com o
catálogo de serviços real (o catálogo por profissão já vem pronto — ela só ajusta preço). Em menos
de 5 minutos ela tem uma página pública de verdade. Se ela tiver telefone de cliente na cabeça de
memória ou numa agenda de papel, cadastre uns 10-15 ali mesmo.

Isso faz duas coisas ao mesmo tempo: ela sai da conversa com o produto rodando no negócio dela de
verdade (não uma promessa), e você começa a validação de campo que o `docs/54` desta base não
conseguiu fazer sozinho — está literalmente conversando com um dono de salão real, a pergunta que
faltava responder.

## 3.4 · O fechamento da primeira visita — nunca peça para pagar ainda

O objetivo da primeira visita **não é vender o plano pago.** É:
1. Conta criada, catálogo real cadastrado.
2. Ela mandou pelo menos UMA mensagem pelo wa.me para um cliente que sumiu, na sua frente.
3. Combinado um retorno seu em 10-14 dias.

Isso funciona porque o grátis já entrega a parte que mais impressiona (a lista de quem sumiu) —
vender antes disso seria pedir fé; voltar depois é pedir baseado em resultado que ela já viu.

## 3.5 · O retorno — é aqui que a venda acontece

Volte em 10-14 dias com uma pergunta específica, não genérica:

> "Quantos dos que você chamou voltaram?"

Se pelo menos um voltou, você tem a venda: "Isso que você acabou de me contar é exatamente o que
o Motor de Ciclo existe pra fazer, e é de graça. O que é pago é poder chamar todo mundo de uma vez
em vez de um por um, e ter o caixa fechando sozinho." Ofereça o Essencial ali.

**Se ninguém voltou ainda:** não force. Pergunte por que ela não usou o wa.me (esquecimento é a
resposta mais comum) e ofereça marcar um horário fixo por semana pra vocês dois revisarem a lista
juntos nas primeiras semanas — suporte de mão na mão é exatamente o que sustenta um lançamento
manual, e é o que separa "lançamento suave" de simplesmente distribuir link e sumir.

---

# 4 · Como cobrar, enquanto o PSP não está integrado

Sem cobrança automática (docs/55, item técnico 4), o caminho é manual e é o que o próprio `/precos`
já diz hoje: "a mudança de degrau é combinada caso a caso". Na prática:

1. Combine o valor (Essencial R$49 ou Equipe R$99) e cobre por Pix, você mesmo, todo mês.
2. **Ofereça preço de fundador, travado.** Quem entra nos primeiros 10-15 fecha o preço de hoje
   **para sempre**, mesmo se o preço subir depois — o `/precos` já promete isso para clientes
   existentes em geral ("quem já é cliente fica no preço antigo por 12 meses"); para o primeiro
   lote, estender essa garantia é um incentivo de peso e custa pouco (são poucos clientes).
3. **Anote manualmente quem pagou o quê e quando.** Uma planilha simples por enquanto — não vale a
   pena automatizar isso antes de ter 15-20 pagantes; o próprio `scripts/promover-tenant.mjs` já
   existe para você mesmo promover o plano deles no painel depois que o Pix cair.

---

# 5 · Puxando o laço de indicação, sem esperar o mecanismo automático

O `docs/18` Fase H desenhou recompensa automática por indicação (crédito em `billing_credits`) —
isso **não existe implementado ainda**. Não espere por ele para começar a pedir indicação:

Quando o segundo retorno (§3.5) fechar em venda, pergunte na hora:

> "Conhece mais alguém aqui perto que também vive perdendo cliente sem saber?"

Barbeiro conhece barbeiro. Ofereça manualmente o mesmo desconto que o mecanismo formal dará no
futuro (ex.: um mês de desconto para quem indicou, quando o indicado virar pagante) — anotado à
mão por enquanto, formalizado quando o H.2 (`billing_credits`) for construído.

---

# 6 · O que NÃO fazer

1. **Não gaste em anúncio.** O próprio `docs/18` §13.1 já decidiu isso: o CAC não fecha nessa
   categoria. Prospecção pessoal e indicação são os únicos laços que funcionam nesta fase.
2. **Não vá atrás de salão de 5+ profissionais ainda.** Ciclo de venda mais longo, módulo `team`
   menos testado, e você não tem tempo de suporte de mão na mão pra escalar isso ainda.
3. **Não prometa WhatsApp automático nem cobrança automática com data.** Quando perguntarem
   "e isso manda sozinho?", a resposta honesta é "hoje você manda com um toque; automático está a
   caminho" — nunca uma data que você não controla.
4. **Não recrute o primeiro lote fora da sua região.** Suporte de mão na mão physical/local é
   exatamente o que compensa a cobrança manual e a ausência de WhatsApp automático — sem isso, o
   risco vira o mesmo que o `docs/55` já descreveu: bug de dinheiro batendo em cliente real sem
   ninguém por perto pra pegar.
5. **Não deixe o preço de fundador current genérico demais.** Trave o número exato e a data — "R$49
   para sempre, se fechar até [data]" — pressão de escassez real, não flexível depois.

---

# 7 · A métrica que decide se isto está funcionando

Não é "quantos cadastrei". É: **de quem cadastrei, quantos mandaram pelo menos uma mensagem pelo
wa.me na primeira semana, e quantos desses tiveram um cliente voltar em 30 dias.**

Se esse número for baixo, o problema não é preço nem feature — é que a promessa central do produto
(o Motor de Ciclo prevê e vale a pena chamar de volta) ainda não está provada com dados reais fora
de demo, e essa é a pergunta mais importante que só clientes de verdade respondem.
