# Tickets das jornadas (EXP-J), medidos no navegador em 21/10/2026

Formato B2 do `docs/111`. A evidência de cada "Hoje" está em `../01-diagnostico.md`.

```
EXP-J01 · Um número só de "dá para recuperar"
Frente: jornada · Lado: profissional · Jornada: P2, P3
Classe: Recomendado · Quando: antes do lançamento (Onda 0: número errado)
Hoje (FATO): Hoje mostra R$ 355,40 e Recuperar mostra R$ 800,00 para as mesmas 6 clientes da demo-studio-olhar
Depois (meta): o mesmo valor nas duas telas, vindo de uma função só
O que muda: o cálculo do cartão do Hoje e o do topo do Recuperar passam a chamar a mesma função de core
Aceite medido: na demo-studio-olhar, os dois valores iguais ao centavo; abrir as duas telas e comparar
Guarda: teste que monta clientes com e sem lucro/sinal e confere que as duas telas leem a mesma função; mutação: trocar uma tela para a fórmula antiga e ver reprovar
Risco: um dos dois números estava certo de propósito (ex.: lucro x preço cheio). Antes de unificar, decidir QUAL número é a verdade (Do Vitor se for lucro x preço)
Tamanho: P
```

```
EXP-J02 · Marcar quem já é cliente sem redigitar
Frente: jornada · Lado: profissional · Jornada: P4
Classe: Recomendado · Quando: serve ao piloto
Hoje (FATO): ≈ 8 toques; "Isad" no campo Cliente não sugere a Isadora; autocomplete="name" puxa o nome da profissional
Depois (meta): ≤ 5 toques: 3 letras, tocar na cliente (telefone e serviço de volta preenchidos), dia, horário, salvar
O que muda: o campo Cliente de /admin/agenda/novo vira busca na base (nome, apelido, telefone, sem acento), com "nova cliente" no fim da lista; autocomplete="off"; cada sugestão mostra o final do telefone, para não marcar a "Ana" errada quando há duas (mudança da revisão, 08-revisao.md)
Aceite medido: contar os toques no navegador a 375 px, com uma cliente existente e com uma nova
Guarda: teste de componente que digita 3 letras e espera a sugestão; teste que o campo não tem autocomplete="name"
Risco: busca lenta em base grande; medir com 500 clientes (semente)
Tamanho: M
```

```
EXP-J03 · Quem volta já vê a manutenção marcada
Frente: jornada · Lado: os dois · Jornada: C1, P1, P4
Classe: Recomendado · Quando: serve ao piloto
Hoje (FATO): o serviço que vem marcado é a aplicação (R$ 220), na página pública e no Marcar do painel
Depois (meta): para cliente reconhecida (aparelho, link de volta ou busca do J02), vem marcado o serviço de volta dela (EXP-S08); para quem é nova, a lista começa pelo serviço mais marcado do mês, não pelo primeiro em ordem
O que muda: a ordem e o pré-selecionado do passo "Serviço" em /[slug]/agendar e /admin/agenda/novo
Aceite medido: abrir o link de volta da Isadora e ver "Manutenção volume russo" marcada; contar 1 toque a menos
Guarda: teste que o pré-selecionado vem do serviço de volta quando há cliente reconhecida
Risco: marcar o serviço errado para quem quer outro; o "Trocar" continua a um toque
Tamanho: M
```

```
EXP-J04 · O dia da autônoma fechado sem comanda
Frente: jornada · Lado: profissional · Jornada: P5
Classe: Do Vitor (muda o que conta como "entrou") · Quando: depois do piloto
Hoje (FATO): Caixa de hoje diz "Nenhuma comanda fechada hoje" com 3 atendimentos confirmados no Hoje
Depois (meta): na autônoma, marcar "Concluído" com o valor do serviço fecha a comanda sozinha; o dia aparece em ≤ 1 toque
O que muda: o fluxo "Chegou → Concluído" do Hoje, para conta sem equipe
Aceite medido: concluir 3 atendimentos e ver o total do dia no Caixa, sem abrir comanda
Guarda: teste de que concluir sem comanda gera a comanda com o preço congelado do agendamento (livro-caixa como fonte única, memória livro-caixa-fonte-unica)
Risco: contar 2x o mesmo dinheiro (memória livro-caixa-fonte-unica); somar o que a cliente não pagou
Tamanho: M
```

```
EXP-J05 · Remarcar pelo link do agendamento
Frente: jornada · Lado: cliente · Jornada: C3
Classe: Recomendado · Quando: depois do piloto
Hoje (FATO): não existe; o link manda para /[slug]/agendar como pedido novo
Depois (meta): ≤ 3 toques a partir do link: dia, horário, confirmar; o horário antigo é liberado e a profissional é avisada
O que muda: rota pública de remarcar com token assinado (mesma família de confirmar/cancelar), tela curta, aviso à profissional (EXP-A03)
Aceite medido: remarcar uma marcação de teste em 3 toques; a agenda da profissional mostra o horário novo e não o antigo
Guarda: teste de integração: remarcar não cria segundo agendamento e respeita appointments_no_overlap
Risco: remarcar em cima da política de cancelamento do salão; mostrar a regra antes
Tamanho: M
```

```
EXP-J06 · O botão leva até o campo que falta
Frente: jornada · Lado: cliente · Jornada: C1
Classe: Recomendado · Quando: antes do lançamento
Hoje (FATO): depois do horário, nome e telefone ficam abaixo da dobra; o botão fixo "Pedir este horário" aparece travado
Depois (meta): ao escolher o horário, a tela rola até "Seu nome" com foco; tocar no botão travado leva ao primeiro campo vazio
O que muda: o passo final de /[slug]/agendar
Aceite medido: a 375 px, depois do horário, o campo de nome visível sem rolar à mão
Guarda: teste de componente: clique no botão travado foca o primeiro campo vazio
Risco: rolar sozinho atrapalhar quem ainda queria ver outro horário; só rolar depois do toque no horário
Tamanho: P
```

```
EXP-J07 · A área da cliente (L3 a L5 do docs/110)
Frente: jornada · Lado: cliente · Jornada: C5, C6
Classe: Decidido (docs/110) · Quando: depois do piloto
Hoje (FATO): não existe; L1 (login por número) pronta no PR #155
Depois (meta): entrar pelo número em ≤ 30 s, "meus lugares", histórico, sair e baixar os dados em ≤ 1 min
O que muda: as fases L3 (ligação clients.user_id e RLS), L4 (/minha-conta) e L5 (dados e avisos) do docs/110
Aceite medido: os da tabela §7 do docs/110
Guarda: area-da-cliente-nao-e-vitrine e o teste de isolamento da cliente (docs/110 §6)
Risco: o maior do plano: RLS nova; ver docs/110 §6.2
Tamanho: G
```

```
EXP-J08 · Entrar pelo número só quando o código sai (corrige a L1 do PR #155)
Frente: jornada · Lado: os dois · Jornada: P1, C5
Classe: Recomendado · Quando: antes do lançamento (Onda 0: deixa a pessoa presa)
Hoje (FATO): /entrar abre no número; sem a credencial da Meta, a resposta é "tente de novo em instantes", que nunca vai funcionar (medidas/copy-e-acessibilidade.md K-02)
Depois (meta): o número só é a porta principal quando o envio está configurado; sem ele, abre no e-mail e o número não aparece
O que muda: /entrar decide o modo inicial no servidor pela presença da credencial (fora de produção, sempre disponível)
Aceite medido: com as variáveis do WhatsApp vazias e NODE_ENV=production, /entrar abre no e-mail sem o botão de número
Guarda: teste do componente nos dois estados; mutação: forçar o número com envio desligado e ver reprovar
Risco: a Meta ligada sem o hook do Supabase; a conferência é por variável, não por envio real
Tamanho: P
```
