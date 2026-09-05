# 46 · A escolha do mecanismo, e o ataque a ela

**2026-09-05.** Continuação do `docs/45`. Aqui não há pesquisa nova: há a tabela que impede
escolher por gosto, a escolha, e o red team que quase a derrubou.

---

## Fase 2 · Os cinco candidatos

Restrições que nenhum candidato pode violar, decididas antes de gerar a lista:

- veto permanente de nunca mostrar concorrência ao **cliente final** (`DECISOES`, com guarda);
- nada que exija credencial de terceiro nova, mudança de preço, ou envio automático sem
  confirmação humana;
- **nada que dependa de F0** (WhatsApp ligado) — F0 depende do dono e está parado há semanas. O
  mecanismo tem que valer com o WhatsApp desligado.

### A · Benchmark anônimo entre negócios parecidos

Agregar, com anonimização, a taxa de retorno por profissão e mostrar ao dono como ele se compara.

| Dimensão | |
|---|---|
| Framework | Zero a Um eixo 2 (rede) · 7 Powers: efeitos de rede |
| Christensen | não se aplica — não é counter-positioning |
| Tempo de cópia **[E]** | **negativo.** O AppBarber tem 1M+ instalações **[P]**; ele faz benchmark melhor que o CICLO no dia em que quiser, por definição de volume |
| Depende de | volume de tenants pagantes. O CICLO tem **zero** **[M]** |
| Custo **[E]** | 4-6 tickets (migration, agregação, piso de anonimização, tela) |
| Valor para o dono | alto — se houver base. Com 3 tenants é ficção |
| Melhora sozinho? | sim, mas a favor de quem tem mais base — ou seja, contra o CICLO |
| Risco | LGPD alto (agregação entre tenants), e "grupo de 1" |

**Rejeitado.** Era o meu palpite inicial e a tabela o derruba: um mecanismo cuja força é
proporcional ao tamanho da base é um mecanismo em que o líder vence por definição. Construir isso
seria escolher o único campo onde a assimetria joga contra.

### B · Portabilidade radical — exportar tudo, inclusive o que o Motor aprendeu

| Dimensão | |
|---|---|
| Framework | Blue Ocean: Elevar · aparenta counter-positioning |
| Christensen | ❌ **falha.** Nada impede o concorrente de exportar. Não há cliente dele que puna isso |
| Tempo de cópia **[E]** | **1 sprint** — é um botão de CSV |
| Depende de | nada |
| Custo **[E]** | 2 tickets |
| Valor para o dono | médio — atende um medo real (`45` §1.5 queixa 5) |
| Melhora sozinho? | não. Estático |
| Risco | baixo |

**Rejeitado, e o motivo vale registro:** a LGPD já define o salão como **controlador** e o sistema
como **operador** — o banco já é dele por lei **[P]**. Vender como diferencial uma coisa que a lei
obriga é o tipo de alegação que não sobrevive a um comprador informado. Vale construir um dia como
higiene; não vale como fosso.

### C · Previsão de no-show por pessoa

| Dimensão | |
|---|---|
| Framework | Zero a Um eixo 1 (tecnologia 10x) |
| Christensen | ❌ **falha.** Nada impede o líder |
| Tempo de cópia **[E]** | **< 6 meses**, e com vantagem: ele deriva de 12 anos de histórico parado **[P]** |
| Depende de | volume de faltas registradas por tenant |
| Custo **[E]** | 5+ tickets |
| Valor para o dono | alto |
| Melhora sozinho? | sim, com dado do próprio tenant |
| Risco | marcar no-show automaticamente é vetado pelo `CLAUDE.md` — o sistema sugere, quem marca é o profissional |

**Rejeitado.** Mesmo defeito do candidato óbvio: o fosso seria "nós prevemos e eles não", e o `45`
§1.3 mostrou que essa frase é frágil por construção.

### D · Registro de previsão + prestação de contas do Motor

Guardar **o que o Motor previu, na data em que previu**, antes de saber o resultado. Depois,
confrontar com o que aconteceu e medir o erro: acertou? errou por quantos dias? para mais ou para
menos?

| Dimensão | |
|---|---|
| Framework | **Blue Ocean: Criar** (o único quadrante vazio do setor, `45` §1.4) · 7 Powers: **recurso cativo** |
| Christensen | não é counter-positioning — e o fosso não depende disso (ver Fase 3) |
| Tempo de cópia **[E]** | o código, dias. **O dado, não é copiável:** previsão feita depois do fato não é previsão. 12 anos de histórico bruto não produzem isso retroativamente |
| Depende de | **nada externo.** Funciona com 1 tenant, sem WhatsApp, sem credencial |
| Custo **[E]** | 2-3 tickets |
| Valor para o dono | **indireto sozinho** — ver o candidato E, que é onde vira dinheiro |
| Melhora sozinho? | sim, e por tempo, não por número de usuários |
| Risco | baixo — dado próprio do tenant, nada cruza fronteira |

### E · Auto-calibração do ciclo padrão a partir do erro medido

Consequência direta de D. Hoje `services.cycle_days` é um **palpite**: 21 por padrão, ou o que veio
do pack da profissão **[M]**. Com o erro medido, o Motor corrige o padrão do serviço **daquele
salão** a partir do comportamento real da clientela **dele**.

| Dimensão | |
|---|---|
| Framework | Zero a Um eixo 1 · 7 Powers: **recurso cativo + custo de troca** |
| Christensen | não se aplica |
| Tempo de cópia **[E]** | o mecanismo, semanas. **A calibração de um salão específico: impossível sem ter operado naquele salão** |
| Depende de | D |
| Custo **[E]** | 2 tickets |
| Valor para o dono | **alto e sentido sem ler nada** — a lista de "chamar de volta" fica certa |
| Melhora sozinho? | **sim, por tenant, com o tempo de uso** |
| Risco | corrigir demais / oscilar. Precisa de amortecimento e de piso de amostra |

---

## A escolha: **D + E, como um mecanismo só**

D sozinho é medição — e medição que ninguém age em cima é dashboard. E sozinho é impossível, porque
não dá para corrigir um erro que não se mede. Juntos são uma coisa: **o Motor de Ciclo aprende com
os próprios erros, por salão.**

**Por que os outros quatro perderam, em uma linha cada:**
- **A** — o fosso cresce com o tamanho da base, e o líder tem 1M+; escolher esse campo é escolher perder.
- **B** — a LGPD já obriga; vender obrigação legal como vantagem não sobrevive a comprador informado.
- **C** — o fosso seria "prevemos e eles não", que o `45` §1.3 mostrou ser frágil.
- **A, B e C** dependem de volume, de nada, e de volume — nenhum deles compõe com o tempo de uso.

---

## Fase 3 · Red team — o ataque à própria escolha

### 1. Como o líder mata isso?

**Ele começa a registrar previsões amanhã.** Em 12 meses tem 12 meses de acurácia, e tem 1M+ de
instalações **[P]**. Se o fosso fosse "temos mais dado de acurácia que eles", **o fosso não
existiria** — perderíamos pelo mesmo motivo do candidato A.

**Isto quase derrubou a escolha, e o que a salvou foi reformular qual é o fosso.**

O fosso **não é agregado**, é **por salão**. A cadência é por pessoa e por serviço, dentro de um
salão. Saber que a clientela do Salão X volta a cada 26 dias em vez de 21 não ajuda em nada no
Salão Y. Um concorrente que chegue amanhã tem **zero** para aquele salão específico — mesmo com 12
anos de dado de outros salões. E o dono, para trocar de sistema, joga fora a calibração que o
CICLO levou meses construindo para ele.

Isso reclassifica o poder: **não é efeito de rede, é custo de troca** (Helmer #3), com recurso
cativo (#5) como matéria-prima. Custo de troca é o único dos 7 poderes que **não depende de o CICLO
ser grande** — funciona com um cliente pagante.

### 2. O teste do Christensen sobrevive?

**Não, e está tudo bem — porque o fosso não é feito dele.** Nada impede o AppBarber de construir
isto. A durabilidade vem do tempo por cliente, não de o líder estar preso. Registrar isso
explicitamente evita a ilusão que o `43` produziu: tratar "somos diferentes" como se fosse sempre a
mesma coisa. Aqui a diferença é de **acumulação**, não de **posição**.

### 3. Qual é a suposição mais frágil?

**Que o dono se importa com acurácia.** Ele não se importa. Ele se importa com dinheiro e com não
passar vergonha mandando mensagem na hora errada.

Se essa suposição for falsa e a tela virar um painel de estatística, o mecanismo vira enfeite.

**Consequência de projeto, não observação solta:** a tela nunca mostra "acurácia de 78%" como
manchete. Mostra a consequência — *"o padrão deste serviço estava 5 dias curto; corrigido para 26.
Isso muda 12 clientes de lugar na sua lista."* A estatística fica disponível para quem quiser
conferir, nunca como o argumento.

### 4. Funciona com quantos tenants?

**Com um.** É a diferença central em relação ao candidato A. Precisa de tempo, não de escala:

- previsão só existe para quem tem histórico — `computeCycle` exige ao menos um atendimento **[M]**;
- para o erro ser medível, é preciso que a data prevista **já tenha passado** e que se saiba se a
  pessoa voltou;
- calibração honesta exige amostra mínima por serviço (definida na Fase 4, com piso e teste).

Para uma barbearia de ciclo curto (~21 dias), isso é da ordem de **2 a 3 meses de uso** **[E]**.
Para estética de ciclo longo, mais. É aposta em tempo de uso, e é consciente.

### 5. O que apodrece?

**A previsão registrada por uma versão antiga do algoritmo.** Se `computeCycle` mudar, comparar
previsões velhas com novas é comparar coisas diferentes. Por isso o registro guarda a **versão do
algoritmo** junto com a previsão — sem isso, a série histórica vira lixo silencioso na primeira
melhoria do Motor, que é exatamente a classe de defeito que esta base persegue.

Segundo item: se o produto abandonar a previsão como diferencial, a tabela vira peso morto. Aceito
— ela é pequena e append-only.

---

## Decisão

Construir **D + E**, nesta ordem, com a versão do algoritmo registrada desde a primeira linha.

O que isto **não** é: não é um fosso que impede o líder de entrar. É um fosso que torna caro o
cliente **sair** — e é o único dos cinco candidatos que funciona com o CICLO no tamanho que ele tem
hoje, que é zero.

---

## Fase 5 · Prova de defensabilidade

Construído nesta rodada, e é código com dado fluindo, não texto:

| Peça | Onde |
|---|---|
| Tabela append-only da previsão, com versão do algoritmo | `0064_registro_de_previsao.sql` |
| Registro (uma linha por visita) e resolução (fecha quando a pessoa volta) | `server/services/previsao.ts` |
| Calibração: mediana das voltas reais, com três freios | `core/cycle/calibracao.ts` |
| A régua medida ao lado da configurada, nunca por cima | `0065_ciclo_observado.sql` |
| O recálculo passando a usar a régua efetiva | `server/services/ciclo.ts` |
| A tela onde o dono vê o número e a procedência | `admin/config/servicos/lista.tsx` |
| Isolamento entre tenants | `tests/rls/isolation.test.ts` |

### O que um concorrente precisaria TER — não fazer — para replicar em menos de 6 meses

O código não é o obstáculo: `computeCycle` são ~80 linhas determinísticas, descritas em
`docs/01`, e `calibrarCiclo` é uma mediana com três guardas. Um time competente escreve os dois
numa semana.

O que ele precisaria **ter**, e não pode comprar:

1. **Uma série de previsões feitas antes do resultado, por salão.** Não é derivável de histórico de
   agendamento, por mais antigo que seja. Previsão registrada depois do fato não é previsão — é
   ajuste de curva sobre o gabarito. Um concorrente que comece hoje tem essa série a partir de
   hoje, para os salões dele, e nunca para trás.
2. **Tempo de operação naquele salão específico.** A cadência é por pessoa dentro de um
   estabelecimento. Saber que a clientela do Salão X volta a cada 30 dias não ajuda em nada no
   Salão Y — e é por isso que os 12 anos e 1M+ de instalações do líder **[P]** não são
   transferíveis para este eixo.

**Prazo estimado [E]:** um concorrente com time e dinheiro tem o mecanismo funcionando em **4 a 6
semanas**. O que ele não tem em prazo nenhum é a série do salão que já usa o CICLO — essa só se
constrói vivendo.

### O teste do Christensen sobrevive à revisão final?

**Não, e a honestidade aqui vale mais que a alegação.** Nada prende o AppBarber. Não há cliente
dele que puna a mudança, não há receita dele que dependa da régua fixa. Isto **não é**
counter-positioning, e chamar de counter-positioning seria repetir o erro do `docs/43`: tratar
"somos diferentes" como se fosse sempre o mesmo tipo de vantagem.

O poder aqui é **custo de troca** (7 Powers #3), com **recurso cativo** (#5) como matéria-prima. É
um fosso que não impede o líder de entrar — impede o cliente de sair.

### Volume mínimo para deixar de ser demonstração

| Marco | O que exige |
|---|---|
| Primeira previsão registrada | 1 atendimento concluído |
| Primeira previsão resolvida | a pessoa voltar uma vez |
| Primeira régua calibrada num serviço | **8 voltas** naquele serviço (`MINIMO_DE_AMOSTRA`) |
| Vira argumento de venda | um salão com número **medido** que ele reconheça como verdadeiro |

Para uma barbearia de ciclo curto (~21 dias) com movimento normal, 8 voltas num serviço popular
sai em **2 a 3 meses** de uso **[E]**. Estética de ciclo longo demora mais. **É aposta em tempo de
uso, e isso está sendo decidido conscientemente** — não descoberto em produção.

### Como se degrada

- **Se ninguém adotar:** sobra uma tabela pequena e append-only, e a régua continua sendo a
  configurada. Nada quebra, nada mente. O custo de estar errado aqui é baixo, o que é uma
  propriedade e não um consolo.
- **Se todos adotarem:** cada salão fica com a régua dele mais certa, independentemente dos outros.
  Não melhora por agregação — melhora por permanência. Isso é menos empolgante que efeito de rede e
  é justamente o motivo de funcionar com o CICLO no tamanho que ele tem hoje, que é zero.

### A frase, em dez segundos

> **"O sistema aprende de quanto em quanto tempo os SEUS clientes voltam, e corrige sozinho quando
> erra. Os outros usam 45 dias para todo mundo."**

Nenhum dos cinco concorrentes pode dizer isso sem mentir hoje — e o material deles admite que a
régua fixa está errada **[P]**. Se um deles construir, a frase deixa de ser exclusiva; o que não
deixa de ser exclusivo é o histórico do salão que já está com o CICLO.
