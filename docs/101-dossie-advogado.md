# 101 · Dossiê para o advogado revisor (pacote Advocacia)

> docs/101 T6.2. Tudo o que o produto diz em nome do escritório, ou que pode ser lido como orientação
> jurídica, está aqui **com o texto exato** que está no código (2026-10-08, branch `feat/advocacia-mvp`).
> Nada disso vale para escritório real antes da revisão: `ADVOCACIA_ABERTA` está desligada e só o
> escritório-modelo fictício existe.
>
> Para cada bloco: o texto, onde mora, e a pergunta que precisa de resposta. Marque ✅ (pode), ✏️ (mudar
> para…) ou ❌ (tirar).

---

## 1. O que vai para o cliente do escritório (WhatsApp)

Nada é enviado sozinho: o produto monta o texto e a pessoa do escritório abre o WhatsApp dela e envia.
O texto **nunca** leva número de processo, valor em reais, CPF ou CNPJ: se algum campo preenchido trouxer
isso, a mensagem é recusada com o motivo (`src/core/advocacia/mensagens.ts`).

| Situação | Texto | Pergunta |
|---|---|---|
| Cobrança de pendências | "Oi, {primeiro nome}! Aqui é do {escritório}. Para seguir com {o que o cliente lê do caso}, ainda precisamos de: • {item} … Pode enviar por aqui mesmo. Agradecemos." | Tom e forma adequados ao Provimento 205/2021? |
| Andamento | "Oi, {nome}! Aqui é do {escritório}. Novidade sobre {caso}: {frase escrita pela advocacia}" | A frase livre precisa de alguma trava além das já existentes? |
| Confirmar reunião | "Oi, {nome}! Aqui é do {escritório}. Confirmamos nossa conversa {quando}? Se precisar mudar, é só responder." | ✅/✏️ |
| Cliente com dois casos | o nome do caso some e vira "os seus atendimentos" | Suficiente para sigilo? |

**"O cliente lê"**: cada caso tem um título interno (só a equipe vê) e um título para o cliente (padrão por
tipo: "o planejamento da família", "o inventário", "a partilha", "o contrato", "a alteração da empresa", "o
seu processo"). O formulário avisa: *"Vai nas mensagens de WhatsApp. Nunca coloque número de processo,
valor ou nome de outra parte."*

## 2. Prazos: a sugestão e a memória de cálculo

O sistema **sugere e explica**; quem confirma a data é a pessoa. A data do prazo nasce vazia na triagem
mesmo com sugestão ("Usar a sugestão" preenche; "Confirmar prazo" grava).

Regras de contagem que a direção do escritório confirma em Configurações (`src/core/advocacia/configuracao.ts`,
vindas de `prazo-calculo.ts`). **Enquanto não confirmadas, a data não vem preenchida.**

| Regra | Rótulo na tela | Fonte citada | Validada na origem? |
|---|---|---|---|
| publicação | "publicação no 1º dia útil após a disponibilização; contagem a partir do 1º dia útil seguinte" | Lei 11.419/2006 art. 4º §3º e §4º; CPC art. 224 | sim |
| cível | "contagem em dias úteis no rito cível" | CPC art. 219 | não |
| trabalhista | "contagem em dias úteis no rito trabalhista" | CLT art. 775 | não |
| JEC | "contagem em dias úteis no Juizado Especial Cível" | Lei 13.728/2018 | não |
| penal | "contagem em dias corridos no rito penal" | CPP art. 798 | não |
| recesso | "suspensão dos prazos de 20/12 a 20/01" | CPC art. 220 | não |

Perguntas:
1. As fontes estão corretas e completas para cada rito?
2. Os casos em que o sistema **recusa** sugerir (e pede a data) estão certos? Hoje: comunicação que não é
   "Intimação"; texto que fala em juntada, citação, ciência, trânsito, edital ou mandado; caso sem rito
   marcado; unidade do texto diferente do rito; prazo em dobro em JEC ou penal; prazo penal que atravessa o
   recesso.
3. O "fazer até" padrão (2 dias úteis antes do fatal) é razoável?
4. **Gabarito**: para a data vir pré-preenchida com segurança, precisamos de 50 intimações reais
   anonimizadas com o prazo que a advocacia contou (anexo 06 §7). O gabarito nunca entra no repositório.

Textos da triagem: "Sugestão a confirmar", "Regra de contagem ainda não confirmada pela direção: confira e
digite a data.", "Não consegui ler o prazo com segurança. Informe a data.", "Prazo fatal", "Fazer até {data} ·
fatal {data}".

## 3. Modelos de checklist da plataforma (marcados "a revisar")

Cada caso novo pode nascer com estas pendências; as datas são em dias úteis a partir da abertura.

| Modelo | Pendência | De quem | Dias úteis |
|---|---|---|---|
| Holding patrimonial | Conferir quadro societário e bens | equipe | 0 |
| | Documento de identificação dos sócios | cliente | 5 |
| | Certidão de casamento e pacto antenupcial | cliente | 5 |
| | Matrícula atualizada de cada imóvel | cliente | 10 |
| | IPTU, ITR ou CCIR de cada imóvel | cliente | 10 |
| | Declaração de imposto de renda dos sócios | cliente | 10 |
| | Comprovante de endereço | cliente | 5 |
| | Assinar o contrato social | cliente | 20 |
| Inventário extrajudicial | Certidão de óbito | cliente | 3 |
| | Documento de identificação dos herdeiros | cliente | 5 |
| | Certidões negativas de débito | cliente | 10 |
| | Matrícula e avaliação dos bens | cliente | 10 |
| | Conferir plano de partilha | equipe | 15 |
| Planejamento sucessório | Levantamento dos bens da família | cliente | 5 |
| | Certidões civis da família | cliente | 10 |
| | Declaração de imposto de renda | cliente | 10 |
| | Reunião de apresentação do cenário | equipe | 15 |
| Divórcio consensual com partilha | Certidão de casamento | cliente | 3 |
| | Relação de bens e dívidas do casal | cliente | 7 |
| | Conferir proposta de partilha | equipe | 10 |
| Contrato e alteração societária | Contrato social atual e alterações | cliente | 5 |
| | Cartão CNPJ | cliente | 3 |
| | Conferir minuta da alteração | equipe | 10 |

Pergunta: faltam itens essenciais? Algum prazo é irreal?

## 4. Estrutura da família e simulador

Rodapé fixo do simulador: *"Simulação sem efeito jurídico ou tributário. Revisão da advocacia necessária."*
Alerta de soma: *"{empresa}: a soma das participações desta empresa passa de 100% ({n}%)."* A participação
efetiva mostra a conta ("20% direto + 55% × 80% via {holding}"). Usufruto aparece como "usufruto de {nome}"
e não altera o percentual de propriedade.

Pergunta: o rodapé basta? Alguma menção tributária deveria ser bloqueada?

## 5. Sigilo e dados

- Áreas criminal e tribunal do júri nascem sigilosas e não podem ser rebaixadas.
- Caso sigiloso: só a equipe do caso e a direção veem; abrir grava trilha; para os outros, o caso não existe
  (mesmo erro de "não encontrado").
- Texto da intimação e destinatários (nomes de partes) só pela porta que grava quem abriu.
- Documentos: bucket privado, abrir grava trilha antes de liberar um link de 60 segundos.
- Eliminação de cliente (LGPD): contato e anotações livres somem; estrutura, casos, prazos e documentos
  ficam (obrigação de guarda). **Pergunta**: o prazo e a base legal da guarda estão corretos para o
  escritório?

## 6. Demonstração

Faixa fixa no escritório-modelo: *"Dados fictícios de demonstração. Nenhuma pessoa, empresa ou processo aqui
existe."* Cartão de simulação: *"Simulação: nos últimos 90 dias este painel teria capturado {n} intimações
e antecipado {m} prazos com um dia interno antes do fatal. Números contados nos dados fictícios deste
escritório."*

Pergunta: o cartão de simulação pode ser lido como promessa de resultado (publicidade)?

## 7. Ainda sem texto (depende de outra entrega)

- **Adendo de aceite do pacote** (T0.5): espera o merge do PR de termos (#144); texto placeholder.
- **Política de privacidade** do pacote: a do CICLO não cobre dado de terceiros (partes de processo).
- **Página de venda**: não existe; nada foi publicado.
