# 106 · CICLO AUTOMOTIVO — PLANO MESTRE (14/10/2026)

> **O que é:** o plano completo, antes de qualquer código, para levar o Motor de Ciclo às oficinas:
> cada carro (e cada moto) com o seu plano de manutenção — por marca, modelo, versão e ano —, cada
> item (óleo, freio, correia, filtros, pneus, bateria…) com os seus relógios (quilometragem, tempo,
> desgaste medido), e a oficina chamando o cliente na hora certa, com o motivo certo.
>
> **Ordem de leitura:** Parte 1 (por que) → 2 (a experiência) → 3 (o dado) → 4 (o Motor) → 5 (o
> negócio) → 6 (riscos) → 7 (as fases e os tickets) → 8 (o que o Eduardo decide).
> A pesquisa com fontes está em `01-pesquisa.md`. Nada aqui foi executado.
>
> **Rótulos:** FATO (fonte), INFERÊNCIA (conta nossa), HIPÓTESE (o piloto prova ou derruba).

---

# PARTE 1 · POR QUE (a lógica de fundador, não a de técnico)

## 1.1 O problema, visto pelo motorista

O dono de um Onix 2021 não sabe que o filtro de combustível vence junto com a troca de óleo, que o
fluido de freio vence por TEMPO mesmo com o carro parado, nem que a correia dentada é a peça que, se
esquecida, funde o motor. **Ele vai à oficina quando o carro faz barulho** (54% dos motoristas, FATO,
Webmotors 2025). A manutenção no Brasil é reativa — e reativa é mais cara, mais perigosa e pior para
todo mundo.

## 1.2 O problema, visto pela oficina

A oficina independente atende 90% da manutenção depois da garantia (FATO, Roland Berger/Sindirepa),
são ~118 mil no país (FATO, Sindirepa 2025) e a frota envelhece (11 anos e 2 meses de idade média,
FATO, Sindipeças). Mas a oficina **não sabe quando cada carro do seu cliente vai precisar de quê**.
O caderno, a planilha e o "sistema de oficina" guardam o passado (a OS) e quase nunca o futuro.
Quando lembram, lembram pela regra do manual ("12 meses") — o que, para quem roda muito, chega meses
atrasado (medido no C-002: motorista de aplicativo, 290 dias depois do vencimento).

A receita da oficina é imprevisível porque ela espera o carro quebrar.

## 1.3 O segredo (a pergunta de Thiel)

> **Que verdade importante pouca gente concorda com você?**

**A oficina não perde cliente para a concorrente; perde para o esquecimento.** E esquecimento se
resolve com uma previsão por carro — não por tabela —, que só existe se três coisas se juntarem no
mesmo lugar:

1. **O plano do modelo** (o que o manual daquele carro manda, item a item);
2. **O ritmo daquele carro** (quantos km por dia ele roda — medido nas leituras de cada visita);
3. **O estado medido** (a pastilha estava com 40%, o pneu com 3 mm de sulco).

Concessionária tem (1) e perde o cliente quando acaba a garantia. Software de oficina tem o histórico
e um lembrete por data fixa. Ninguém junta os três. É isso que o Motor de Ciclo faz na beleza (o ritmo
de cada cliente) e o que o C-002 provou no carro: com o ritmo de cada veículo, o erro do lembrete cai
de 78–290 dias para 8–30 dias (sintético).

## 1.4 As sete perguntas de *Zero to One*

| Pergunta | Resposta |
| --- | --- |
| **Engenharia** — é 10× melhor, não marginalmente? | Lembrete no momento certo, por item, com o motivo: o erro do lembrete cai uma ordem de grandeza (C-002: 290 → 8 dias para quem roda muito). Nenhum concorrente mede o ritmo do carro. |
| **Momento** — por que agora? | Frota envelhecendo (mais manutenção por carro), WhatsApp universal, carros novos caros (o dono mantém o velho), Pix e link de orçamento normalizados. E a base já existe: o CICLO tem agenda, orçamento por link, comanda, mensagens e o Motor. |
| **Monopólio** — começa grande num mercado pequeno? | Começa no **bairro**: uma oficina com 300–800 carros ativos vira a dona do calendário de manutenção desses carros. O histórico por placa acumula (fosso de dado). |
| **Pessoas** — o time certo? | Fora do escopo deste plano; registrar quem conhece oficina por dentro (o StarkOS nasceu de uma especificação de oficina real). |
| **Distribuição** — como chega ao cliente? | Ver 5.4: distribuidores de lubrificante e de peças visitam as oficinas toda semana; sindicatos (Sindirepa); a própria oficina vira canal do motorista. Produto bom sem distribuição morre. |
| **Durabilidade** — daqui a 10 anos ainda vale? | Carro elétrico tem menos óleo e mais pneu, freio, suspensão, ar-condicionado, bateria 12 V. O modelo de "item com relógio" serve igual — o catálogo muda, o Motor não. |
| **Segredo** — o que ninguém vê? | Acima, 1.3. |

## 1.5 Foco: o que este produto NÃO é (Jobs: dizer não a mil coisas boas)

- **Não é ERP de oficina.** Estoque completo, NF-e, contas a pagar, controle de peças por fornecedor:
  existe muito software que faz; não é o nosso segredo. Integramos depois, se a oficina pedir.
- **Não dá diagnóstico.** A IA não diz o que o carro tem (decisão já registrada no StarkOS: "IA sem
  poder de dar diagnóstico"). O sistema lembra o que o MANUAL e a MEDIÇÃO dizem.
- **Não vende peça.** Não somos marketplace no começo.
- **Não substitui o manual.** O plano de manutenção vem do manual, com fonte; quando não tivermos o
  manual do modelo, usamos o plano genérico e DIZEMOS que é genérico.

A única promessa: **"o carro do seu cliente volta na hora certa, e ele sabe por quê."**

---

# PARTE 2 · A EXPERIÊNCIA (de ponta a ponta, como o cliente vive)

## 2.1 As pessoas

| Quem | O que quer | O que teme |
| --- | --- | --- |
| **Dono da oficina** | agenda cheia e previsível; ticket médio maior sem parecer "empurrador" | perder tempo com sistema; cliente achar que é golpe de venda |
| **Balcão/atendente** | abrir a OS em segundos; mandar orçamento e receber o "sim" | digitar muito; errar placa |
| **Mecânico** | saber o que fazer; registrar o que viu | burocracia; ver dado do cliente (não deve ver valor nem contato — regra do StarkOS) |
| **Motorista** (cliente final) | não ser enganado; não ficar na mão; gastar o necessário | ser "empurrado" para trocar o que não precisa |
| **Motorista de aplicativo / motoboy** | carro/moto parado é renda parada; troca rápida | perder um dia de trabalho |

## 2.2 A jornada, momento por momento

**1. Chegada (balcão, 20 segundos).** Digita a placa. Se o carro já existe: marca, modelo, versão,
ano, última visita, **o plano dele** aparecem. Se é novo: escolhe marca → modelo → ano em 3 toques
(catálogo FIPE) — ou, se contratarmos o provedor, a placa preenche sozinha (marca/modelo/ano, NUNCA
o dono). Pergunta única obrigatória: **"Km do painel agora?"** (é o relógio; sem ela, o sistema usa
o ritmo médio e diz).

**2. O plano do carro (a tela herói).** Para cada item do plano daquele modelo: uma barra de "vida
usada" (por km, por tempo e por medição — a que estiver mais perto do fim manda), a data prevista e o
valor estimado. Em vermelho o que já venceu, em amarelo o que vence até a próxima visita provável, o
resto recolhido. Exemplo:

```
Onix 1.0 Turbo 2021 · 41.300 km · roda ~38 km/dia (medido em 4 visitas)
● VENCIDO    Fluido de freio — 2 anos, venceu há 3 meses (tempo)
● NESTA VISITA  Óleo + filtro de óleo + filtro de combustível — 10 mil km (faltam 300 km)
● PRÓXIMA (≈ jan/2027)  Filtro de ar — 30 mil km · Velas — 40 mil km
  ▸ mais 9 itens em dia
```

**3. Orçamento por item (balcão → motorista, por link).** O orçamento já vem montado com o que o plano
diz, cada linha com O MOTIVO ("pelo manual do Onix 2021: a cada 10 mil km") e a medição quando houver
("pastilha dianteira com 30%, foto"). O motorista aprova item a item no link (já existe no CICLO:
`/orcamento/[token]`). **Confiança é o produto:** o motivo verificável é o que separa "manutenção" de
"empurrar peça".

**4. Execução (mecânico).** Vê só a lista do que fazer e onde registrar o que mediu (pastilha %, sulco
do pneu em mm, bateria em teste). Não vê valor nem telefone.

**5. Entrega.** Comanda fecha (já existe). O sistema grava, por item, "feito em 41.300 km, em
14/10/2026". O motorista recebe o comprovante com **o próximo passo** ("próxima troca de óleo:
~51.300 km, por volta de mar/2027").

**6. O meio (o que faz a mágica).** Ninguém faz nada. O Motor recalcula toda noite, por carro e por
item. Quando um item entra na janela (ex.: 15 dias antes do vencimento previsto), a oficina vê na
lista "chamar hoje" — e, com canal configurado, a mensagem sai sozinha, com o motivo:
*"Oi, Ana! Pela quilometragem, o Onix deve estar perto da troca de óleo (faltam ~500 km). Quer marcar?
Sexta às 8h está livre."*

**7. A volta.** O motorista agenda pelo link (já existe), e o ciclo recomeça. A prestação de contas
(já existe) mostra à oficina: "o Motor trouxe 47 carros de volta este mês, R$ 18.400".

## 2.3 O que tiramos da tela (Jobs)

- Formulário de veículo com 20 campos: só placa, marca/modelo/ano, km. O resto é opcional e escondido.
- Lista de 30 itens de manutenção: só o vencido, o que vence nesta visita e o próximo. O resto recolhido.
- "Sistema completo de estoque": não no começo.

## 2.4 Moto (o mesmo produto, outro ritmo)

Motoboy roda ~150 km/dia (FATO, SindimotoSP) e troca óleo a cada 1.500–3.000 km ⇒ **a cada 5–10
dias**. Para a oficina de moto, o Motor não é "lembrar 1× por ano": é **a fila da semana**. A
experiência muda em um ponto: o motoboy não pode parar — o lembrete oferece o horário mais cedo do
dia, e o atendimento é rápido. Mesma base, outro catálogo (relação, pastilha, pneu, óleo de moto).

---

# PARTE 3 · O DADO (o que precisa existir, e de onde vem)

## 3.1 O sujeito do ciclo (pré-requisito, C-003)

Na beleza quem volta é o cliente; na oficina é o **veículo**. Sem isso, o tutor/dono com 2 carros
vira uma série só e a perda de um some (medido no C-003: 0% vista × 100% por sujeito). Desenho:

- `subjects` — o que volta: `tenant_id`, `client_id` (dono atual), `kind` (`veiculo`, `animal`…),
  `label` (placa ou nome), `attributes jsonb`, `active`. Placa única por tenant (o StarkOS faz
  "placa repetida TRANSFERE o veículo": o histórico fica no veículo, o dono muda).
- `appointments.subject_id`, `ticket_items.subject_id` — **nuláveis** (beleza segue sem sujeito).
- Os ciclos passam a ser por (cliente, serviço, sujeito) — sujeito nulo = o próprio cliente.

## 3.2 O veículo: marca, modelo, versão, ano

- `vehicle_specs` (por sujeito do tipo veículo): `fipe_brand_id`, `fipe_model_id`, `fipe_year_id`,
  `brand_name`, `model_name`, `model_year`, `fuel` (flex, gasolina, etanol, diesel, elétrico,
  híbrido), `transmission` (manual, automático, CVT, automatizado), `engine` (ex.: "1.0 turbo"),
  `body` (hatch, sedã, SUV, picape, moto), `plate`, `vin` (opcional).
- **Fonte de marca/modelo/ano: Tabela FIPE** pela API gratuita (Parallelum v2) — importada para um
  catálogo GLOBAL nosso (`catalog_brands`, `catalog_models`, `catalog_model_years`), atualizado por
  rotina mensal. Não consultamos a FIPE a cada tela: copiamos o catálogo (resiliência e custo zero).
- **Placa → veículo** (opcional, Fase 6): provedor pago com contrato e DPA (ex.: Infosimples).
  Só marca/modelo/ano/combustível. **Nunca** nome/CPF/telefone do dono (LGPD; FATO).

## 3.3 O catálogo de itens de manutenção (o coração)

Cada **item** é uma coisa que se troca ou se verifica, com **relógios** próprios:

| Item | Relógio de uso (km) | Relógio de tempo | Desgaste medido | Observações |
| --- | --- | --- | --- | --- |
| Óleo do motor + filtro de óleo | 5–15 mil (manual) | 6–12 meses | — | uso severo = metade; óleo especificado por motor (0W-20 × 5W-30) |
| Filtro de combustível | 10–20 mil | — | — | Onix: junto com o óleo (FATO) |
| Filtro de ar do motor | 10–30 mil | 1–2 anos | sujo/limpo | poeira = severo |
| Filtro de cabine (ar-condicionado) | — | 6–12 meses | cheiro | |
| Velas de ignição | 15–100 mil (comum ~40 mil; irídio 100 mil+) | — | — | depende do tipo de vela |
| Correia dentada (+ tensor) | 40–100 mil (média ~60 mil) | ~3 anos | — | **crítico**: se romper, funde o motor; alguns motores usam corrente (sem troca) ou correia banhada a óleo (regra própria) |
| Correia de acessórios | 40–60 mil | ~3 anos | trincas | |
| Pastilhas de freio | 20–50 mil (automático gasta mais) | — | **% de espessura** | o melhor relógio é a medição |
| Discos de freio | 2 trocas de pastilha (regra prática) | — | espessura mínima | |
| Fluido de freio | (alguns 40 mil) | **1–2 anos** | umidade (teste) | vence por TEMPO, mesmo parado |
| Líquido de arrefecimento | — | ~2 anos (alguns 5–10) | — | |
| Fluido de câmbio automático/CVT | 40–80 mil (severo) | — | — | só automáticos |
| Alinhamento e balanceamento | 10 mil | 12 meses | desgaste irregular | |
| Rodízio de pneus | 10 mil | — | — | |
| Pneus | — | ~5 anos de fabricação | **sulco (mm)**, mínimo legal 1,6 mm | |
| Bateria (12 V) | — | 2–4 anos | teste de carga | |
| Amortecedores | 40–80 mil | — | vazamento/teste | |
| Kit de embreagem | variável | — | patinando | só manual |
| Palhetas | — | 6–12 meses | — | |
| Higienização do ar-condicionado | — | 12 meses | — | |
| Revisão geral (inspeção) | 10 mil | 12 meses | — | o "guarda-chuva" da visita |
| **Moto:** óleo | 1.000 (1ª), 1.500–3.000 | 3–6 meses | — | uso de entrega = metade |
| **Moto:** relação (corrente, coroa, pinhão) | 15–25 mil | — | folga/desgaste | |
| **Moto:** pastilhas/lonas, pneus, velas, cabos | por item | | | |

(Faixas: FATO de imprensa especializada — `01-pesquisa.md` §2. **O manual do modelo prevalece.**)

## 3.4 O plano por modelo: herança de três camadas

Não existe base aberta de planos de manutenção por modelo (FATO: não encontrada). Então o catálogo
é construído em **camadas que herdam**, cada valor com **fonte e data**:

1. **Plano genérico por perfil** (`maintenance_profiles`): carro flex aspirado manual; carro turbo;
   automático/CVT; diesel; elétrico; híbrido; moto de baixa cilindrada; moto de média/alta. Valores
   das faixas acima, escolhendo o meio conservador. Rótulo visível: "plano genérico".
2. **Plano por família de motor/plataforma** (`maintenance_plans` com `scope = 'engine_family'`):
   ex.: "GM 1.0 turbo CSS Prime", "Fiat Firefly 1.0/1.3", "VW EA211 1.0 TSI". Muitos modelos
   compartilham motor; um plano cobre vários.
3. **Plano do modelo/ano** (`scope = 'model_year'`): o manual do modelo, item a item, com
   `source_url`, `source_kind` (manual do proprietário, site da montadora, imprensa), `checked_at`.

**Regra de resolução:** para cada item, vale a camada mais específica que tiver valor; o que faltar
herda da de baixo. A tela diz de onde veio ("pelo manual do Onix 2021" × "pelo plano genérico de
carro turbo").

**Por onde começar (INFERÊNCIA):** os **30 modelos mais presentes na frota** (Gol, Onix, HB20, Uno,
Palio, Strada, Fiesta, Ka, Sandero, Kwid, Mobi, Argo, Polo, Corolla, Civic, Fox, Celta, Prisma, Saveiro,
Toro, Compass, Renegade, T-Cross, Creta, Kicks, Hilux, S10, Spin, Cronos, Voyage) × anos comuns
cobrem a maior parte da frota de uma oficina de bairro. O resto usa família de motor ou genérico.
**HIPÓTESE a medir no piloto:** % dos carros atendidos com plano de modelo × família × genérico.

**A oficina corrige e o sistema aprende o intervalo real** (sem vocabulário de "IA": é a mesma
calibração que o Motor já faz em `calibracao.ts`): se esta oficina troca a correia do Gol a cada 50 mil
porque usa a peça X, ela ajusta o item no plano dela (camada 4: `tenant_overrides`), e o sistema
mede, nas voltas reais, se o intervalo previsto bate.

## 3.5 As leituras e as medições

- `odometer_readings` (`subject_id`, `read_at`, `km`, `source`: balcão, foto do painel, cliente,
  importado). Toda OS pede o km. Leitura que desce é marcada e não entra no ritmo (C-002).
- `item_measurements` (`subject_id`, `item_key`, `measured_at`, `value`, `unit`: %, mm, V, sim/não,
  `photo_media_id`): o relógio de desgaste.
- `subject_item_state` (o "plano vivo" de cada veículo): por item, `last_done_at`, `last_done_km`,
  `due_by_km`, `due_by_date`, `due_by_wear`, `predicted_due_on`, `clock` que venceu, `confidence`.
  Recalculado pela rotina noturna e a cada OS fechada.

## 3.6 Segurança e LGPD

- Tabelas do tenant com RLS + política + teste de isolamento (regra 1 do CLAUDE.md).
- Catálogo global (marcas, modelos, planos genéricos e de modelo) é **leitura pública para usuários
  autenticados**, escrita só por `service_role` (rotina de importação e curadoria).
- Placa é dado pessoal comum (identifica pessoa indiretamente): não em log, não em URL.
- Foto do painel/peça: bucket privado, URL assinada, como as fotos da ficha.

---

# PARTE 4 · O MOTOR AUTOMOTIVO (o algoritmo)

## 4.1 Por item, "o que vencer primeiro" de três relógios

Para cada veículo e cada item do plano resolvido:

1. **Uso:** `due_by_km = last_done_km + interval_km` (× fator severo). A data sai do **ritmo do
   veículo** (km/dia, mediana robusta das leituras — `core/cycle/relogios.ts`, C-002); sem 2 leituras,
   ritmo médio do Brasil (~36 km/dia) **e a tela diz que é estimado**.
2. **Tempo:** `due_by_date = last_done_at + interval_months` (limite fixo do manual; no carro o tempo
   NÃO segue o ritmo do cliente — a pessoa volta quando o carro pede; C-002 `tempoPeloRitmo: false`).
3. **Desgaste medido:** pastilha com 40% medida há 8 mil km ⇒ taxa de desgaste ⇒ data em que chega ao
   mínimo (ex.: 15%). É o relógio mais preciso quando existe, e o que dá ao motorista a prova.
4. **Item nunca feito nesta oficina:** sem histórico, o vencimento sai do km atual pelo plano ("a cada
   40 mil km": se está com 41 mil e nunca trocou aqui, **pergunte** — "já trocou as velas?" — em vez de
   afirmar que venceu). Promessa honesta.

## 4.2 A visita, não o item: agrupar

O motorista não volta 9 vezes; volta 2 ou 3 por ano. O Motor agrupa os itens que vencem perto um do
outro numa **visita sugerida** ("pacote da próxima visita": óleo + filtro de combustível + alinhamento
— vencem no mesmo mês), escolhendo a data que minimiza visitas sem deixar nada vencer (item crítico —
correia, freio — nunca é empurrado para depois do vencimento). É a mensagem única com 3 motivos.

## 4.3 Uso severo detectado, não perguntado

Ritmo alto em trajetos urbanos (aplicativo, entrega) ou ritmo baixo com muitas partidas curtas são os
dois perfis de uso severo. O cadastro pergunta "uso do carro: normal / aplicativo / entrega / terra"
(1 toque), e o Motor sugere "severo" quando o ritmo passa de ~100 km/dia. O fator aplica a metade do
intervalo onde o manual manda (óleo, filtro de ar).

## 4.4 A medida (o backtest antes do ar)

O placar do C-001/C-002 vira o banco de provas do Motor automotivo: perfis de motorista (pouco uso,
médio, muito, aplicativo, irregular, moto de entrega), itens com relógios diferentes, leituras
erradas injetadas, carro parado. Métrica: erro do vencimento por item, % de lembretes tarde, visitas
por ano (agrupamento), "item crítico vencido" (deve ser zero). Nenhuma mudança no Motor entra sem
vencer o placar (guarda já existente).

## 4.5 A visão da oficina (o futuro em dinheiro)

Somando os vencimentos previstos de todos os carros: **"nos próximos 30 dias, 84 carros devem voltar:
R$ 31 mil em serviços previstos (óleo R$ 9,8 mil, freio R$ 7,2 mil, alinhamento R$ 4,1 mil…)"**. É a
receita previsível que a oficina nunca teve — e a prova diária do valor do produto.

---

# PARTE 5 · O NEGÓCIO

## 5.1 Mercado inicial (onde ser monopólio primeiro)

| Segmento | Por que sim | Por que não | Nota |
| --- | --- | --- | --- |
| **Oficina mecânica de bairro** (mecânica geral, troca de óleo, freio, suspensão) | é onde está 90% da manutenção pós-garantia; ticket médio alto; relação de confiança | dono sem tempo, pouco digital | **começar aqui** |
| Centro rápido de troca de óleo / auto center | ciclo curto, alto volume, km sempre registrado | margem apertada, cliente menos fiel | segundo |
| Oficina de moto de entrega | ciclo de DIAS (5–10); o Motor vira a fila da semana | ticket baixo, pouca capacidade de pagar | terceiro, como plano barato |
| Frotas pequenas (empresas com 5–50 veículos) | pagam por disponibilidade | venda B2B mais longa | depois |
| Concessionária | — | já tem o plano do modelo e sistema próprio | não |

## 5.2 Preço (HIPÓTESE, a validar)

Referência: OficinaTop grátis até 10 OS/mês, R$ 89,90 (100 OS), R$ 109,90 (ilimitado) (FATO,
Capterra). Nós não vendemos "OS": vendemos **carros que voltam**. Desenho a testar:
- grátis: até 30 veículos ativos (a oficina sente o produto);
- pago fixo na faixa do mercado (R$ 99–149/mês) com veículos ilimitados e o plano do carro;
- **serviço como software** (trilha 5 do 105): componente por resultado, ex.: R$ X por carro que
  voltou pelo lembrete — medido pela prestação de contas. **Decisão do Eduardo** (jurídico/fiscal).

## 5.3 A métrica que manda (North Star)

**Carros que voltaram na janela certa, por mês, por oficina** (e o dinheiro que trouxeram). Métricas de
apoio: % de OS com km registrado (sem isso o Motor não enxerga), % de carros com plano de modelo (×
genérico), taxa de aprovação de orçamento por link, % de lembretes que viraram agendamento, erro
mediano do vencimento (prestação de contas por item).

## 5.4 Distribuição (o que Thiel diz que quase todo mundo ignora)

1. **Distribuidores de lubrificante e de autopeças** visitam as oficinas toda semana e vivem de a
   oficina trocar mais óleo e mais peça. Para eles, uma oficina que chama o cliente na hora certa
   compra mais. Canal natural (parceria, não venda direta de porta em porta).
2. **Sindirepa e associações** (cartilhas, eventos; FATO: o Sindirepa-SP já faz cartilha de gestão).
3. **O motorista como canal:** o link do plano do carro é compartilhável ("veja o plano do meu carro")
   e cada motorista que usa leva o nome da oficina — e do produto — junto.
4. **A importação do concorrente** (conversor universal, `docs/103`): a oficina traz a planilha/caderno
   e em minutos vê "você tem R$ X parados em 140 carros com revisão vencida".

---

# PARTE 6 · RISCOS E REVISÃO ADVERSARIAL (antes de existir)

| Risco | O que acontece | Como o plano evita |
| --- | --- | --- |
| Plano de manutenção errado para um modelo | lembrete errado; responsabilidade se o motor quebrar | toda regra tem fonte e data; plano genérico rotulado; "siga o manual" no texto; a oficina pode corrigir; NUNCA dizer "não precisa" (só "vence em") |
| Oficina não registra km | relógio de km cego | km obrigatório no check-in (1 campo); foto do painel lida (OCR local, sem enviar a terceiro — regra da casa); métrica "% de OS com km" no painel |
| Leitura de km errada (digitação 10×) | ritmo absurdo | filtro (desce = ignora; teto km/dia); conferência no balcão contra o ritmo esperado (aposta A-11) |
| Placa → dono (LGPD) | multa, dano de marca | só marca/modelo/ano; provedor com DPA; nunca base vazada; nunca "proprietário pela placa" |
| Garantia de concessionária | cliente perde garantia por fazer revisão fora | o plano mostra "em garantia até …" e avisa; não somos contra a concessionária |
| Mensagem que parece golpe de venda | cliente desconfia, descadastra | o motivo verificável em toda mensagem; frequência máxima por cliente; opt-out ("PARAR" já tem escritor) |
| Canal de WhatsApp sem credencial | promessa falsa ("vamos avisar") | regra do CLAUDE.md: só promete canal com rota agendada e credencial; sem isso, a oficina recebe a lista "chamar hoje" e manda pelo link wa.me |
| Catálogo FIPE muda/API sai do ar | cadastro trava | catálogo copiado (não consultado ao vivo); rotina mensal; fallback "outro modelo" livre |
| Carro elétrico/híbrido | itens diferentes | perfil próprio no catálogo (freio regenerativo dura mais; sem óleo do motor no elétrico) |
| Transferência de veículo | histórico vai com o carro, mas o dono antigo recebia lembrete | trocar o dono atualiza o `client_id`; mensagens só para o dono atual; histórico preservado |
| Dois carros do mesmo dono | ciclos misturados | o sujeito (Parte 3.1) — pré-requisito |
| Segunda FK quebra embed do PostgREST | telas quebram no deploy | `subjects` não aponta de volta para `appointments`; conferir embeds antes (armadilha paga) |
| Migration na ordem errada | produção quebra | aditivas antes do código; restritivas (PK de ciclos) depois, em migration própria |

---

# PARTE 7 · AS FASES E OS TICKETS

Formato do `docs/98` (aceite MEDIDO, teste visto reprovando). Esforço P (≤1 d), M (1–3 d), G (3–5 d).
**HIPÓTESE de prazo total: 8–12 semanas de trabalho do agente até o piloto**, sem contar decisões.

## Fase 0 · Decisões (antes de tudo)
| ID | Decisão | Padrão de trabalho se não houver resposta |
| --- | --- | --- |
| AUT-D1 | Automotivo nasce como **pacote do CICLO** (uma base, um Motor) ou evolui o **StarkOS**? | Pacote do CICLO; o StarkOS vira fonte de domínio (ver Parte 8) |
| AUT-D2 | Segmento inicial | oficina de bairro (5.1) |
| AUT-D3 | Contratar provedor de placa → veículo | não no começo (catálogo FIPE manual) |
| AUT-D4 | Preço e componente por resultado | não decidir; preparar a medida |

## Fase 1 · Fundação: o sujeito e o veículo
| ID | Proposta | Aceite (MEDIDO) | Teste | Migration | Dep. | Esf. |
| --- | --- | --- | --- | --- | --- | --- |
| AUT-101 | `subjects` + `subject_id` nulável em agendamentos e itens de comanda + ciclos por sujeito (= EXP-001) | beleza idêntica (suíte inteira); 2 carros do mesmo dono = 2 ciclos | test:rls + integração; placar C-003 com banco | aditiva; troca de chave do ciclo em migration própria equivalente | C-003 | G |
| AUT-102 | `vehicle_specs` (marca, modelo, ano, combustível, câmbio, motor, carroceria, placa) | cadastrar veículo em ≤ 3 toques após a placa | unitário de normalização da placa (Mercosul e antiga) | aditiva | 101 | M |
| AUT-103 | `odometer_readings` + km obrigatório no check-in, com leitura que desce sinalizada | 100% das OS do roteiro com km | integração; guarda "OS do pacote automotivo sem km não fecha sem motivo" | aditiva | 101 | M |
| AUT-104 | Pacote `oficina` (abas, vocabulário: cliente, veículo, OS, mecânico, orçamento) e profissão no catálogo | onboarding cria uma oficina utilizável | guarda `pacote-tem-registro` | aditiva (catálogo) | 101 | M |
| AUT-105 | Papel mecânico sem valor e sem contato (servidor manda `null`) — conferir o `professional` do CICLO | roteiro como mecânico: 0 valores, 0 telefones na tela e na resposta da API | integração das rotas | não | 104 | M |

## Fase 2 · O catálogo
| ID | Proposta | Aceite | Teste | Migration | Dep. | Esf. |
| --- | --- | --- | --- | --- | --- | --- |
| AUT-201 | Catálogo global FIPE (marcas, modelos, anos: carros e motos) + rotina mensal de importação | busca "onix" → modelos e anos em < 200 ms | integração da importação com resposta gravada (sem rede no teste) | aditiva (tabelas globais, leitura autenticada, escrita service_role) | — | M |
| AUT-202 | Catálogo de **itens** (Parte 3.3) com chaves estáveis, unidades e relógios possíveis | 24 itens de carro + 8 de moto | unitário: todo item tem ao menos um relógio | aditiva | — | P |
| AUT-203 | **Perfis genéricos** (flex aspirado, turbo, automático/CVT, diesel, elétrico, híbrido, moto baixa, moto média) com faixas e fonte | todo veículo resolve um plano (nunca vazio) | unitário de resolução | aditiva | 202 | M |
| AUT-204 | Planos por **família de motor** e por **modelo/ano** com `source_url`, `source_kind`, `checked_at` + regra de herança | os 30 modelos da frota com plano de modelo para os anos comuns | guarda: regra de modelo sem fonte reprova | aditiva | 203 | G (curadoria) |
| AUT-205 | `tenant_overrides`: a oficina ajusta o intervalo de um item para ela | ajuste vale só no tenant | test:rls | aditiva | 204 | P |

## Fase 3 · O Motor por item
| ID | Proposta | Aceite | Teste | Migration | Dep. | Esf. |
| --- | --- | --- | --- | --- | --- | --- |
| AUT-301 | `core/manutencao/` (puro): resolver o plano (herança), três relógios por item (uso, tempo, desgaste), "o que vencer primeiro", fator severo | placar: erro mediano por item ≤ placar C-002; item crítico vencido = 0 | backtest com perfis e itens; mutações | não | C-002, 204 | G |
| AUT-302 | Relógio de **desgaste medido** (taxa por km entre medições; mínimo por item) | pastilha medida 2× → data prevista; sem 2ª medição, só o plano | unitário + placar | não | 301 | M |
| AUT-303 | **Agrupar em visitas** (minimizar visitas sem deixar item crítico vencer) | perfis do placar: visitas/ano caem sem item crítico vencido | placar | não | 301 | M |
| AUT-304 | `subject_item_state` + rotina noturna incremental (só veículos com OS/leitura nova) e recálculo ao fechar OS | rotina lê só o que mudou (contagem de linhas medida) | integração; guarda consulta-sem-teto | aditiva | 301, 103 | M |
| AUT-305 | Item nunca feito aqui: **pergunta** em vez de afirmar vencido | 0 itens "vencidos" sem histórico; vira pergunta no check-in | unitário | não | 301 | P |

## Fase 4 · A experiência
| ID | Proposta | Aceite | Teste | Migration | Dep. | Esf. |
| --- | --- | --- | --- | --- | --- | --- |
| AUT-401 | Check-in pela placa (existe → plano; novo → marca/modelo/ano em 3 toques) + km | roteiro 390 px: OS aberta em ≤ 20 s e ≤ 6 toques | roteiro Playwright no build | não | 102, 103 | M |
| AUT-402 | **O plano do carro** (tela herói: vencido / nesta visita / próxima / recolhido) com origem do plano dito | roteiro: os 3 grupos certos para 5 carros do seed; axe 0 | roteiro + unitário de agrupamento visual | não | 304 | G |
| AUT-403 | Orçamento montado pelo plano, cada linha com o motivo e a medição/foto | aprovação item a item no link existente | integração do orçamento | não | 402 | M |
| AUT-404 | Execução do mecânico: lista + registrar medições (% , mm, foto) | medição gravada e usada pelo relógio de desgaste | integração | não | 302, 105 | M |
| AUT-405 | Comprovante de entrega com o próximo passo | mensagem/tela com próxima data e km | roteiro | não | 304 | P |
| AUT-406 | Link do plano do carro para o motorista (público por token, sem dado do dono) | token inválido abre erro com saída (padrão APR-119) | roteiro | não | 402 | M |

## Fase 5 · Serviço como software
| ID | Proposta | Aceite | Teste | Migration | Dep. | Esf. |
| --- | --- | --- | --- | --- | --- | --- |
| AUT-501 | Lista "chamar hoje" por item/visita com o motivo e o valor | lista do seed bate com o placar | integração | não | 303, 304 | M |
| AUT-502 | Mensagem que diz o relógio ("pela quilometragem…") e oferece horário livre | mensagem verificável; sem canal, wa.me | guarda: promessa de canal só com canal (já existe) | não | 501 | M |
| AUT-503 | Envio automático por regra (com canal real), frequência máxima, opt-out | 0 mensagens a quem disse PARAR; ≤ 1/semana por veículo | integração | não | 502 + credencial | M |
| AUT-504 | "Receita prevista dos próximos 30 dias" no Mês/Hoje da oficina | soma bate com a lista | integração | não | 304 | M |
| AUT-505 | Prestação de contas por item ("o Motor trouxe 47 carros, R$ 18.400") | usa `algo_version` | integração | não | 304 | P |

## Fase 6 · Moto e placa
| ID | Proposta | Aceite | Teste | Migration | Dep. | Esf. |
| --- | --- | --- | --- | --- | --- | --- |
| AUT-601 | Catálogo e perfis de moto (entrega = severo); fila da semana | perfil "entrega 150 km/dia": troca a cada ~10 dias no placar | placar | aditiva | 203, 301 | M |
| AUT-602 | Provedor placa → marca/modelo/ano (com DPA; só se AUT-D3 = sim) | 0 campo de dono gravado ou logado | guarda de campos | não | D3 | M |
| AUT-603 | Recall: aviso "consulte o recall no gov.br" quando o modelo/ano tiver campanha conhecida (curadoria manual; sem base aberta) | link oficial, sem prometer o que não sabemos | — | aditiva | 204 | P |

## Fase 7 · Prova
| ID | Proposta | Aceite | Teste | Migration | Dep. | Esf. |
| --- | --- | --- | --- | --- | --- | --- |
| AUT-701 | Seed de oficina realista (300 carros, 30 modelos, leituras, medições) — **medir o agregado** (lição "seed parece certo e é absurdo no agregado") | km/ano do seed bate com ~13 mil e a dispersão dos perfis | conferência do seed | não | Fases 1–3 | M |
| AUT-702 | Demo navegável (kit no padrão da Advocacia `docs/101`) | roteiro de 5 minutos: chegada → plano → orçamento → entrega → lembrete | roteiro gravado | não | Fases 1–5 | M |
| AUT-703 | Piloto com 1–3 oficinas reais (Eduardo) | North Star e métricas de apoio medidas por 60 dias | prestação de contas | — | 702 + Eduardo | — |

## Ordem e dependências (resumo)

`D1–D4 → 101 → (102, 103, 104) → 105 → 201–205 → 301 → (302, 303, 305) → 304 → 401–406 → 501–505 → 601–603 → 701 → 702 → 703`

Cada fase fecha com: suíte inteira, integração, test:rls, roteiro no build a 390 px quando há tela,
diário (104) e `_estado` (105). A cada fase, uma revisão adversarial curta e as sete perguntas.

---

# PARTE 8 · O QUE O EDUARDO DECIDE

1. **CICLO pacote "oficina" × evoluir o StarkOS.** Recomendação: **pacote do CICLO.** Motivo: o
   segredo é o Motor, e ele mora no CICLO (backtest, relógios, sujeito, prestação de contas, agenda,
   orçamento por link, mensagens, conversor de planilha). Duas bases = dois Motores para manter e o
   segredo dividido. O StarkOS entra como fonte de domínio (orçamento obrigatório, placa como espinha
   dorsal, mecânico sem dado do cliente) e pode continuar como está até a decisão.
2. **Segmento inicial:** oficina de bairro (recomendado), troca rápida, ou moto de entrega.
3. **Provedor de placa** (custo por consulta, DPA) — agora ou depois.
4. **Preço** e a parte por resultado (jurídico/fiscal).
5. **Piloto:** quais oficinas e quem conversa com elas.
6. **Marca:** "CICLO para oficinas" × nome próprio.

O laço do 105 segue sem estas respostas pelo padrão de trabalho de cada uma; elas mudam a ordem das
fases 6–7 e o go-to-market, não a fundação (Fases 1–3).
