# Prompt: plano de entrada do CICLO no mercado dominado pelo AppBarber (v2)

Copie tudo abaixo da linha e use como pedido numa sessão nova. Versão 2, de 16/10/2026: reescrita com medições novas e com o que o código do CICLO já tem para essa entrada.

---

## 0. Por que este plano é a fundação do CICLO

A maioria dos barbeiros que o CICLO quer atender **já usa o AppBarber**. Então a primeira pergunta do negócio não é "como convencer alguém a usar um sistema", e sim "como entrar numa barbearia que já tem sistema". Tudo o que vier depois (preço, produto, marketing, app nas lojas) depende da resposta.

Você vai montar esse plano. **Só planeje:** não escreva código, não crie migration, não mexa em produção, não fale com cliente, não gaste dinheiro. Seja estratégico, desconfie do óbvio, e prefira o caminho que usa o que o CICLO já tem a construir coisa nova.

## 1. O que já sabemos (fatos medidos, use como base e não refaça)

### 1.1 Sobre o AppBarber (fontes em `docs/concorrentes/appbarber/relatorio-appbarber.html`)

**Empresa e preço**
- StarApp, de Chapecó (SC), no mercado desde 2015.
- Preço: R$ 79,90 por mês para 1 profissional, R$ 109,90 para 2 a 5, R$ 55,90 no anual (parcelado em 12x). Não tem plano grátis, só 30 dias de teste.
- Recepcionista e gestor contam como "profissional" na faixa de preço.
- Vendidos à parte, sem preço público: clube de assinatura, app com a marca da barbearia, nota fiscal, robô de WhatsApp, totem e API. WhatsApp automático e SMS são créditos pagos.
- Pagamento online pela Zoop, com taxa não divulgada, e só para CNPJ.

**Reputação**
- 4,9 nas lojas, mas inflado: 44% das notas altas têm menos de 15 letras.
- Reclame Aqui "Regular", nota 6,6. As maiores dores, em ordem:
  1. assinatura que segue cobrando depois de cancelar;
  2. login quebrado;
  3. suporte lento;
  4. bugs a cada atualização.

**Cliente final e vitrine**
- O cliente precisa **criar conta no primeiro clique em "Agendar"**.
- A vitrine mostra a barbearia concorrente ao lado.

**Dados e termos**
- Para tirar a própria base de lá, o dono **pede no chat**.
- Termo de uso de dezembro de 2020: chamado técnico "sem previsão" e nenhum reembolso.

**O que não tem**
- Nenhuma previsão de quem vai sumir.
- Nenhum lucro por atendimento.
- Nenhuma IA de análise.

### 1.2 Medido hoje (16/10/2026) e ainda não está no relatório

1. **O AppBarber só importa clientes, serviços e produtos, nunca histórico de atendimentos.** Fonte: artigo "Como solicito a importação de dados?" da central de ajuda deles (`appbarber-appbeleza.zendesk.com`, artigo 9396829609997, atualizado em 03/09/2026). Se eles não importam histórico, provavelmente também não entregam histórico com facilidade na saída. Isso é **INFERÊNCIA**, a confirmar com uma exportação real.
2. **A vitrine pública deles mostra quem usa o AppBarber, cidade por cidade.** O endereço `sites.appbarber.com.br/api/new-establishment-search?city=<código>` devolve, por negócio:
   - qual sistema usa (código 2 = AppBarber, 1 = AppBeleza);
   - se usa o pagamento online deles;
   - a nota.
   A busca tem **teto de 120 resultados**: nas capitais o total real é maior e desconhecido.

   | Cidade | Negócios | AppBarber | Com pagamento online |
   | --- | --- | --- | --- |
   | Chapecó/SC | 87 (número real) | 64 | 11 (13%) |
   | São Paulo/SP | 120 (teto) | 107 | 31 (26%) |
   | Rio de Janeiro/RJ | 120 (teto) | 105 | 33 (28%) |

   Em São Paulo, 106 dos 120 aparecem com nota 5,0. Conclusão: **cerca de 3 em cada 4 barbearias do AppBarber não usam o pagamento online deles**. Isso é FATO só para as amostras acima; para o resto é INFERÊNCIA.
3. A vitrine também mostra **telefone e e-mail públicos** de cada negócio. Ver as regras da seção 2.

### 1.3 O que o CICLO já tem para essa entrada (confira no código antes de usar)

- **`docs/83-ONBOARDING-E-MIGRACAO-PLANO.md`**: plano de entrada para quem vem de outro sistema. Leia inteiro; este plano estende o 83, não o substitui.
- **Tela `src/app/admin/clientes/vindo-de-outro-sistema/page.tsx`**, com três saídas:
  1. "Traga agora" (planilha ou memória);
  2. "Use junto por enquanto" (camada de recuperação ao lado do sistema atual);
  3. "Me manda que eu faço" (só aparece se houver canal de contato).
  Também traz pronta a mensagem para pedir a exportação ao suporte do sistema antigo.
- **`src/server/services/quem-ja-atendo.ts`**, com três portas:
  - **planilha**;
  - **memória**: "uns 15 dias atrás" basta, porque o Motor usa o ritmo padrão do serviço;
  - **`retornos`**: "essa pessoa voltou", sem reabrir cadastro, escrita justamente para quem continua operando no AppBarber.
- **`src/core/onboarding/perfil.ts`**: `SISTEMAS_ANTERIORES` já lista o AppBarber, mas a escolha **não chega** à tela "vindo de outro sistema" (registrado em `docs/DECISOES.md`).
- **Conversor universal de planilhas**: `docs/103`, branch `conversor/esteira-universal`, ainda não está na `main`.
- **Página pública de agendamento sem conta** (`src/app/(public)/[slug]/agendar`): o cliente agenda com nome e telefone.
- **Planos:**
  - Grátis: 1 profissional, até 50 clientes;
  - Solo: R$ 49;
  - Equipe: R$ 99, até 5 profissionais;
  - hoje está tudo liberado (`ACESSO_ABERTO = true`).
- **Aviso de assinante no prejuízo** (`src/core/loyalty/margem-do-clube.ts`), que o AppBarber não tem.

### 1.4 O que já foi decidido (não reabra sem fato novo, e diga qual)

Fonte: `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` (atualização de 28/09/2026) e `docs/DECISOES.md`.

**Decisões do Eduardo**
1. **Benefício para quem traz a base: sim.** Um mês do Essencial (hoje Solo) para quem importa com a data da última visita.
2. **Nomear concorrentes no produto: sim**, só com fato verificável.
3. **O Eduardo importa pelo WhatsApp para as primeiras contas: sim** ("Me manda que eu faço").
4. **Foco:** AppBarber, Belasis, BarbUp, caderno e planilha. O Trinks saiu do foco.

**Regras do 83 e do GO-1**
5. **GO-1** (`.claude/ciclo/growth-opportunities.md`, 21/09): não construir importador por concorrente nem detector de exportação por cabeçalho antes de ter um arquivo real; não importar histórico completo antes de saber se algum concorrente o exporta. O 83 concorda e só melhora roteamento, argumento e confiança.
6. **A autocrítica do 83 (§7) derrubou argumentos.** Respeite:
   - "Seu cliente não baixa app" **não serve como argumento de troca**: para quem ganha cliente novo pela vitrine do AppBarber, sair é perder aquisição. Esse dono é candidato a **conviver**, não a trocar.
   - "Usar junto" só sobrevive se manter custar quase zero: o dono, uma vez por semana.
   - O argumento mais forte é **a lista de quem sumiu, com os clientes do próprio dono, no minuto em que ele termina de importar**, não uma frase nem uma tabela.
   - "Leve seus dados quando quiser" só depois que o botão existir. Confira: a tela de Clientes do CICLO já mostra "Baixar todos em planilha"; se for a exportação completa, essa promessa está liberada.
   - A Belasis (IA de retorno e gerente de conta) **não é o primeiro alvo**.

### 1.5 A premissa que precisa ser testada antes de tudo

O pedido parte de "a maioria dos barbeiros já usa o AppBarber". O docs/83 cita que **cerca de 70% do público usa caderno** (fonte em `docs/07`). As duas coisas podem ser verdade ao mesmo tempo (o AppBarber pode dominar entre quem **tem** sistema), mas o plano muda conforme a resposta.

**Antes de recomendar, estime as duas fatias com o que existe** e rotule o que é palpite:
- `docs/07`;
- as respostas da Pergunta 1 do onboarding (`SISTEMAS_ANTERIORES`), se houver dado de produção agregado;
- a contagem agregada da vitrine por cidade, comparada com o número de barbearias da mesma cidade;
- conversas registradas com barbeiros.

Proponha o teste mais barato para fechar a dúvida.

## 2. Regras que não se negociam

- **Evidência:** todo número e toda afirmação levam **FATO** (com fonte: arquivo e linha, ou URL e data), **INFERÊNCIA** (de quais fatos) ou **HIPÓTESE** (com o teste mais barato que a confirma ou derruba). Não invente número de mercado, conversão ou receita. O que está NÃO VERIFICADO continua assim.
- **Código manda:** afirmação sobre o que o CICLO faz só vale conferida no código. Documento antigo pode estar desatualizado.
- **Dados da vitrine do AppBarber:**
  - use só **contagens agregadas** (quantos por cidade, quantos com pagamento online), lidas pela busca normal do site como qualquer visitante;
  - **não** monte lista de contatos, **não** guarde telefone nem e-mail, **não** varra milhares de cidades.
  - Se o plano propuser abordar donos de barbearia, a abordagem é um a um, com mensagem pensada para aquele negócio, base legal registrada (legítimo interesse de contato comercial entre empresas, com avaliação escrita), opção clara de não receber mais e nada de disparo em massa nem automação de WhatsApp (as regras da Meta proíbem).
  - Marque como **DECISÃO DO EDUARDO, COM ADVOGADO** antes de qualquer abordagem.
- **Ética na comparação:** nada de atacar a marca deles, nada de número sem fonte, nada de prometer resultado que o CICLO não mede. Comparação honesta, com data.

## 3. As perguntas que o plano precisa responder

### 3.1 Quem é o primeiro cliente, exatamente

Não "barbearias". Segmente e escolha **um** primeiro alvo, com motivo:

- dono que trabalha sozinho e paga R$ 79,90 sem usar metade;
- barbearia de 2 a 5 cadeiras;
- **barbeiro comissionado ou de cadeira alugada**, que tem a própria carteira mas usa o AppBarber do dono (no AppBarber o profissional nem se cadastra sozinho: é o dono que cria o acesso);
- quem tem clube de assinatura e sofre com cobrança e cancelamento;
- quem está de saída (as reclamações públicas mostram donos "prestes a cancelar").

Para cada segmento: tamanho estimado (rotulado), dor principal, o que o CICLO entrega hoje, o que falta e o custo de alcançar.

### 3.2 Caminho A, conviver: o CICLO como camada de recuperação ao lado do AppBarber

1. A proposta numa frase que um barbeiro entende. Por exemplo: "Continue agendando no AppBarber. O CICLO te mostra toda segunda quem está sumindo e quanto vale chamar de volta." Teste outras.
2. **O fluxo semanal real do dono**, passo a passo e com tempo estimado:
   - como os clientes entram (pedido de exportação no chat do AppBarber, planilha, memória);
   - como o CICLO fica sabendo de quem voltou: porta `retornos`, planilha periódica, ou nada (o Motor trabalha só com a estimativa).
   Diga com franqueza **qual esforço semanal o dono aguenta sem largar**, e desenhe para esse esforço.
3. O que mudar no produto para conviver sem confundir:
   - um modo "só recuperação" que esconda agenda e comanda;
   - a tela "vindo de outro sistema" usando o sistema escolhido no cadastro;
   - textos que nomeiam o AppBarber;
   - lembrete semanal da fila.
   Liste os tickets.
4. **Preço da convivência:** o Grátis (50 clientes) basta para provar valor? Faz sentido um plano "Recuperação" mais barato que o Solo? Mostre a conta: quanto a fila precisa recuperar por mês para pagar o plano várias vezes, com os preços reais.
5. **Riscos:** o dono parar de atualizar; previsão errada com dado velho; o AppBarber copiar a fila; LGPD de dados vindos de outro sistema (o dono é o controlador). Para cada risco, a mitigação.

### 3.3 Caminho B, superar: o CICLO no lugar do AppBarber

1. Para cada dor medida no AppBarber (cobrança depois de cancelar, login, suporte, preço escondido, conta obrigatória para o cliente, vitrine com concorrente, exportação pedida no chat, termos de 2020, sem plano grátis): a promessa do CICLO, **a prova que o CICLO mostra hoje** e o que falta construir.
2. **Lacunas para trocar sem medo**, cada uma marcada como obrigatória, desejável ou dispensável para o primeiro alvo:
   - pagamento online e sinal por Pix, aceitando CPF (eles só aceitam CNPJ, e 3 em cada 4 nem usam o deles);
   - clube com cobrança automática e cancelamento pelo cliente;
   - nota fiscal (obrigatória desde setembro de 2026, segundo o blog deles: confirmar o que vale para MEI);
   - fila por ordem de chegada;
   - várias unidades;
   - app nas lojas.
3. **A troca em um dia:** importar clientes e serviços; recriar assinantes sem cobrar em dobro (cancelar lá só depois de cobrar aqui, com data marcada); avisar o cliente final do link novo (mensagem pronta, QR no balcão); manter o histórico do AppBarber como planilha de consulta. Diga o que dá para fazer hoje e o que precisa ser construído.
4. **O que não copiar:** vitrine com concorrente, crédito de WhatsApp, módulo sem preço, recepcionista contando como profissional, conta obrigatória para o cliente final.

### 3.4 Caminho C: conviver primeiro, substituir depois

Defina os **gatilhos medidos** que transformam um usuário de camada de recuperação num candidato a troca. Por exemplo: X semanas usando a fila, Y clientes recuperados, pedido espontâneo de agenda ou de cobrança. Diga o que o produto oferece em cada gatilho (convite, importação assistida, mês grátis), lembrando que mês grátis é decisão de preço do Eduardo.

### 3.5 A reação deles

O que o AppBarber faria ao perceber o CICLO: baixar preço, copiar a fila, criar plano grátis, dificultar a exportação. Para cada reação provável:
- a probabilidade (rotulada);
- o impacto;
- o que mantém o CICLO na frente. Por exemplo, a previsão melhora com o histórico acumulado no CICLO, o que é difícil de copiar de um dia para o outro: verificar se isso é verdade no Motor.

### 3.6 Comparação e recomendação

Tabela A, B e C com:
- custo de construir (semanas, estimado);
- tempo até o primeiro pagante;
- risco;
- público alcançável;
- dependência de decisões do Eduardo;
- quanto reforça o que só o CICLO tem.

**Recomende um caminho em até 5 linhas** e diga o que faria você mudar de ideia.

## 4. Posicionamento, prova e objeções

1. Uma frase de posicionamento e três mensagens de apoio, cada uma ligada a um fato (seção 1).
2. **A prova antes da promessa:** como mostrar valor em menos de 10 minutos com os dados do próprio dono. Por exemplo: a pessoa digita de memória 20 clientes e já vê a fila e o valor. Use o que existe; aponte o que falta.
3. A página "Use o CICLO junto com o AppBarber" (caminho A) e/ou "CICLO ou AppBarber?" (caminho B): estrutura, títulos e tabela honesta.
4. As 7 objeções mais prováveis e a resposta de cada uma. Inclua, no mínimo:
   - "meus clientes já têm o app";
   - "não quero dois sistemas";
   - "e meus dados?";
   - "o AppBarber é mais completo";
   - "não tenho tempo".

## 5. Aquisição com custo perto de zero

Para cada canal: como funciona, custo, como medir, e **o primeiro teste de 2 semanas** com critério de sucesso.

- **Busca:** quem procura "alternativa ao AppBarber", "AppBarber preço", "AppBarber cancelar". Hoje essas buscas são ocupadas por comparativos de concorrentes.
- **O barbeiro como canal:** o comissionado que usa o CICLO grátis na própria carteira leva o CICLO para o dono.
- **Cidade de teste:** uma cidade média onde o número de usuários do AppBarber é conhecido pela contagem agregada da vitrine (por exemplo, Chapecó, com 64). Defina a meta de participação.
- **Instagram e criadores do meio**, eventos (Barber Week, Barber Day), indicação com benefício.
- **Material gratuito** com números reais (como a websérie deles, mas com dado).
- **Barbearias que reclamaram em público:** só se passar pelas regras da seção 2. Caso contrário, descarte e diga por quê.

## 6. Plano de execução

1. Fases de 2 semanas para os primeiros 90 dias. Cada uma com objetivo, entregas e critério de "pronto" medido.
2. Tickets no padrão do CICLO (um ticket, um commit), separados em **código**, **decisão do Eduardo** e **marketing**, com:
   - prioridade P0 a P2;
   - dependências;
   - tamanho (P, M, G);
   - arquivo provável;
   - o teste que prova.
   Priorize o que usa o que já existe (seção 1.3).
3. **Métricas**, cada uma com valor de partida (medido ou "a medir") e meta:
   - donos vindos do AppBarber;
   - tempo até ver a primeira fila;
   - clientes recuperados;
   - receita recuperada;
   - ativação na semana 1;
   - permanência em 30 e 60 dias;
   - conversão de convivência para troca.
4. **O que precisa do Eduardo**, curto e em ordem. No mínimo:
   - canal de contato;
   - SMTP;
   - preço da convivência;
   - mês grátis na migração;
   - PSP para Pix e sinal;
   - avaliação jurídica da abordagem.
5. **Experimento-piloto:** 5 a 10 barbearias que usam o AppBarber, numa cidade, por 30 dias, em convivência. Como recrutar (dentro das regras), o que medir toda semana, quando parar, e o critério que decide entre A, B e C.

## 7. Entrega e revisão

- Escreva em `docs/concorrentes/appbarber/plano-estrategico.md`. Português simples, frases curtas.
- Comece com um resumo de 10 linhas: o alvo escolhido, o caminho recomendado, por quê, os 5 primeiros passos e as decisões pendentes.
- Termine com "O que não sabemos e como descobrir", com o teste mais barato para cada dúvida. Inclua obrigatoriamente: o que vem numa exportação real do AppBarber (colunas, se traz a última visita), quantos donos aguentam atualizar a camada de recuperação toda semana, e o preço que o barbeiro comissionado pagaria do próprio bolso.
- **Antes de entregar, faça uma revisão adversarial do próprio plano** e diga que fez. Procure:
  - número sem rótulo;
  - afirmação sobre o CICLO não conferida no código;
  - promessa que o produto não cumpre;
  - estratégia que depende de uma suposição não testada sem dizer qual;
  - qualquer uso dos dados da vitrine fora da seção 2.
  Corrija o que achar e liste o que mudou.
