# Suporte e onboarding assistido

> `docs/87` §4.1 item 9. Feito para UMA pessoa atender (o Eduardo, pelo WhatsApp) as 10 contas do
> alpha e as até 40 da janela pública, todas de barbearia e salão pequeno, com 1 a 3 profissionais.
> Os textos abaixo saem prontos para copiar e colar. O que é fato de produto foi lido no código em
> 2026-09-30; o que ainda não existe está na caixa "Antes de usar" e não vira promessa em lugar nenhum.
>
> **Regras de voz, valem para tudo que sai daqui:** direta, concreta, honesta. Não prometer WhatsApp
> automático, não dar data para recurso que não existe, não prometer gratuidade sem fim, não nomear
> concorrente, não usar vocabulário de IA para o Motor de Ciclo (ele calcula o ritmo de cada
> cliente), não supor o gênero de quem lê (nenhum agradecimento flexionado na voz de profissional),
> sem travessão, sem emoji.

## Antes de usar (o que este roteiro supõe e ainda precisa existir ou ser decidido)

| # | O que falta | Por que importa aqui | Quem resolve |
|---|---|---|---|
| 1 | **A cortesia no código** (`docs/87` §3): 60 dias, 7 de graça, pausa de 90 dias. Hoje não existe no produto | O FAQ descreve o desenho decidido. Até a cortesia entrar, a tela "Meu plano" pode dizer outra coisa. Confira a tela antes de mandar o texto para alguém | Código (tarefa 4 do P0) |
| 2 | **Como o Eduardo entra na conta para importar.** Não há convite de equipe funcionando (não existe a página de aceite do convite) nem "acesso de suporte" com prazo | O "me manda que eu faço" só funciona hoje com o dono presente, na mesma chamada ou na visita, digitando o próprio login. **Nunca peça nem guarde senha por WhatsApp.** Se quiser importar sem o dono presente, é preciso construir um acesso de suporte com prazo e trilha. Decisão do Eduardo | Eduardo |
| 3 | **Apagar o negócio inteiro.** O botão "Excluir minha conta" apaga só o LOGIN; o negócio e os clientes continuam. Os termos prometem "peça e a gente apaga" | Não há procedimento testado para apagar um negócio todo. Defina e teste em conta de demonstração ANTES de prometer prazo a alguém | Eduardo e código |
| 4 | **Exportação só cobre a lista de clientes** (nome, telefone, e-mail, última visita). Exige verificação em duas etapas e sai uma vez a cada 30 dias | Agenda e caixa não têm exportação própria. O FAQ não promete o que não existe | Já dito no FAQ |
| 5 | **Canal de contato** (`NEXT_PUBLIC_CONTATO_WHATSAPP` e `_EMAIL`) e o **horário de atendimento** | O FAQ manda a pessoa para o seu WhatsApp. Preencha `[HORÁRIO]` abaixo | Eduardo |

Valores de preço, quando mudarem em `docs/87` D2, mudam aqui também: Solo R$ 49 (1 profissional) e
Equipe R$ 99 (até 5).

---

## 1 · Perguntas que o dono de salão faz

Uma pergunta por bloco, resposta curta, do jeito que se fala. Pode colar no WhatsApp como está.
Atendimento: **[HORÁRIO DE ATENDIMENTO, preencher]**, pelo WhatsApp do CICLO.

**O que é o CICLO?**
Uma agenda que mostra, pelo nome, quais clientes seus já passaram da hora de voltar e quanto isso
vale. Ele calcula o ritmo de cada cliente e deixa a mensagem pronta para você chamar, pelo seu
WhatsApp. Também tem página para o cliente marcar horário sozinho.

**Quanto custa depois dos 60 dias?**
R$ 49 por mês para 1 profissional, R$ 99 para até 5. Sem fidelidade e sem multa. Quem entrou na fase
de 60 dias e assina até 30 dias depois do fim dela mantém esse valor por 12 meses.

**Vocês vão me cobrar sem eu saber?**
Não. Você não coloca cartão para começar. Nada é cobrado se você não tocar no botão de assinar. Se
não tocar, a conta só para de criar coisa nova (explico abaixo), e nunca vira cobrança.

**Meu dado é meu? Posso levar embora?**
É seu. O CICLO não vende nem passa seus clientes para ninguém, e nenhum outro negócio enxerga a sua
lista. A lista de clientes (nome, telefone, e-mail e última visita) você baixa sozinho em Clientes,
"Baixar meus clientes". Para isso o CICLO pede a verificação em duas etapas ligada na sua conta
(Configurações, Segurança), e o download sai uma vez a cada 30 dias. O que mais você quiser levar,
me pede aqui.

**Como eu trago minha base de clientes?**
Três jeitos, escolhe o mais fácil.
1. **Planilha do Excel:** salve como "CSV UTF-8" (Arquivo, Salvar como). Datas como 15/08/2026 e
   acentos funcionam. Vale até 5 MB e 5.000 linhas por vez. Em Clientes, "Importar".
2. **De memória:** em "Quem você já atende", cole uma lista (um nome por linha, telefone junto se
   tiver) e diga mais ou menos quando cada um veio. No Android dá para escolher direto dos contatos.
   Leva uns 5 minutos.
3. **Me manda que eu faço:** você me passa a planilha e eu coloco para dentro, com você na chamada.
   Depois eu apago o arquivo do meu aparelho.

O que faz o CICLO mostrar quem sumiu é a data da última visita. Sem ela, ele não tem o que calcular.

**Meu cliente precisa baixar aplicativo?**
Não. Ele marca horário pelo link da sua página, no navegador do celular. Você também usa o CICLO
pelo navegador, sem baixar nada da loja.

**Funciona junto com o sistema que eu já uso?**
Funciona. Você não precisa trocar hoje. Continue marcando horário onde marca, e use o CICLO só para
ver quem está sumindo e chamar de volta. Quando alguém voltar, marque "já é sua cliente" para o
cálculo continuar certo.

**Ele manda mensagem sozinho?**
Hoje você manda com um toque, do seu próprio WhatsApp. O CICLO escolhe quem chamar e deixa o texto
pronto. Quem aperta é você. Mensagem automática ainda não tem.

**O que acontece quando os 60 dias acabam?**
1. Você ganha **7 dias de graça**: tudo continua funcionando, e aparece uma faixa vermelha avisando.
2. Se não assinar, a conta entra em **pausa**: você continua vendo tudo e exportando tudo, mas não
   cria nada novo, e a sua página de agendamento mostra "indisponível".
3. A pausa dura **90 dias**, e a gente avisa 30 e 7 dias antes do fim.
4. **Assinar reativa tudo na hora**, do jeito que estava.

A data do fim aparece no topo do seu painel desde o primeiro dia.

**Como eu cancelo?**
Nos 60 dias não tem o que cancelar: não tem cartão nem cobrança. Se não quiser seguir, é só parar de
usar. Depois de assinar, você cancela em Configurações, "Meu plano", sem multa e sem fidelidade, e
continua com acesso até o fim do período que já pagou.

**Como eu apago tudo?**
Duas coisas diferentes:
- **Seu login:** Configurações, "Excluir minha conta". Apaga só o seu acesso. O negócio e os clientes
  continuam lá.
- **O negócio inteiro, com os clientes:** não tem botão. Me peça aqui, eu apago e te aviso quando
  terminar. Antes, baixe a lista de clientes se quiser guardar.

**Esqueci minha senha.**
Na tela de entrar, toque em "Esqueci minha senha", digite o e-mail da conta e abra o link que chega.
O link vale só no aparelho em que você pediu, e expira. Se pediu num aparelho e clicou em outro, peça de novo
e abra no mesmo. Se o e-mail não chegar, olhe o spam e me chame.

---

## 2 · Mensagens de WhatsApp (sequência de uma conta nova)

Mande pelo WhatsApp do Eduardo, com o nome da pessoa e do negócio. Cada texto cabe numa tela.
Escolha o texto pela etapa da conta: a consulta Q3 de `placar-do-piloto.sql` diz "onde parou".

### 2.1 Boas-vindas (no mesmo dia do cadastro)

> Oi, [nome]! Aqui é o Eduardo, do CICLO. A conta do [negócio] está criada, com 60 dias de tudo
> liberado e sem cartão. A data de fim fica no topo do seu painel.
>
> O passo que mais vale: trazer seus clientes com a data mais ou menos da última vez que vieram.
> Com isso o CICLO mostra, pelo nome, quem já passou da hora de voltar.
>
> Três jeitos, escolhe o mais fácil:
> 1. Digitar de memória (uns 5 minutos)
> 2. Me mandar a planilha aqui, e a gente coloca para dentro juntos numa chamada rápida
> 3. Se estão em outro sistema, eu te mando o texto para pedir a lista para o suporte dele
>
> Nada é cobrado se você não tocar em assinar. Qualquer dúvida, responde aqui.

### 2.2 D+2 (a causa número 1 de parar é esquecer)

> Oi, [nome]! Passando para saber: você já chamou alguém da lista de quem passou da hora?
> Se ainda não, abre "Recuperar receita", escolhe um nome e toca em "Chamar". Abre o seu WhatsApp com
> o texto pronto. Uma pessoa já basta para ver se funciona.

### 2.3 D+7 (escolha pela etapa da conta)

**Etapa 1, não importou a base:**
> Oi, [nome]! Vi que a lista de clientes ainda está vazia. É normal, dá preguiça. Se você me mandar
> dez nomes com "faz um mês" ou "faz dois meses", já aparece quem passou da hora. Quer fazer isso
> agora, por mensagem, ou prefere que eu te ligue hoje?

**Etapa 2, importou e "quem sumiu" não apareceu:**
> Oi, [nome]! Você trouxe os clientes, mas o CICLO ainda não mostrou quem sumiu. Quase sempre é
> porque faltou a data da última visita. Me diz onde estão os seus registros (caderno, planilha ou
> memória) e a gente coloca a data junto.

**Etapa 3, viu quem sumiu e não chamou ninguém:**
> Oi, [nome]! Sua lista tem [N] pessoas que passaram da hora de voltar. Quer que eu olhe com você
> uns 10 minutos? Escolhe o horário que for melhor.

**Etapa 4 ou 5, já chamou:**
> Oi, [nome]! Vi que você já chamou gente pelo CICLO. Alguém respondeu? Se quiser, me conta como
> foi, que eu ajusto o que precisar.

### 2.4 D+10 a 14 (visita ou ligação de retorno)

Marcar:
> Oi, [nome]! Vamos fechar aquela conversa rápida? Eu só quero saber uma coisa: quantos dos que você
> chamou voltaram. Pode ser aí, por ligação ou por aqui mesmo.

Na conversa, **a única pergunta é: "Quantos dos que você chamou voltaram?"**
- **Voltou alguém:** peça o depoimento (autorização por escrito) e a indicação: "Conhece mais alguém
  aqui perto que vive perdendo cliente sem saber?". Não fale de preço nesta conversa.
- **Ninguém voltou:** não force. Pergunte por que não chamou (quase sempre foi esquecimento) e combine
  10 minutos por semana olhando a lista juntos.

Cuidado ao ler o placar antes da conversa: o número de "clientes voltaram" conta previsões que se
realizaram, tenha a pessoa chamado ou não. Quem responde "voltou por causa da mensagem" é ela.

---

## 3 · Roteiro de importação assistida pelo WhatsApp

Serve para o "me manda que eu faço". A planilha de clientes é **dado de terceiros**: chega no seu
celular, você usa e **apaga em seguida** (`docs/84` §2.5, boa prática a confirmar no parecer). Faça
tudo numa sentada, com o dono na chamada.

1. **Peça a planilha, com o pedido certo.**
   > Me manda o arquivo com os clientes: nome, telefone e a data da última vez que cada um veio. Pode
   > ser Excel, foto do caderno ou uma lista digitada. A gente coloca para dentro juntos numa chamada
   > rápida. Depois eu apago o arquivo do meu aparelho.
2. **Entre na conta com o dono presente.** Ele digita o próprio login. Nunca peça senha por mensagem,
   nunca guarde login de ninguém. (Sobre o acesso de suporte, ver "Antes de usar", item 2.)
3. **Deixe o arquivo pronto.** O importador lê **CSV**, não `.xlsx`. No Excel: Arquivo, Salvar como,
   "CSV UTF-8". Até 5 MB e 5.000 linhas. Caderno ou lista digitada: digite ou cole em "Quem você já atende, Colar uma
   lista".
4. **Importe.** Clientes, "Importar". Escolha a coluna do **nome** (obrigatória), do telefone e da
   **última visita**. Depois escolha "Que serviço essas pessoas fazem com você?", porque é o ritmo
   desse serviço que o Motor usa. Confira a prévia e importe.
5. **Leia o resultado com o dono.** Anote **quantos passaram da hora** e o valor. Se aparecer "clientes
   entraram sem a última visita", a data estava fora do formato: corrija para 15/08/2026 e importe
   de novo só essas linhas.
6. **Faça a primeira chamada junto.** "Recuperar receita", um nome, "Chamar". Uma basta.
7. **Apague a planilha.** Na mesma hora, sem deixar para depois:
   - a mensagem com o arquivo ou a foto no WhatsApp ("Apagar para mim");
   - o arquivo baixado na pasta Downloads ou Documentos do celular e do computador;
   - se veio por e-mail, o anexo na caixa de entrada e na lixeira;
   - o CSV que você gerou a partir dela.
   Não copie nomes ou telefones para a sua planilha de leads.
8. **Avise o dono.**
   > Pronto, [nome]. Seus [N] clientes estão no CICLO e [M] já passaram da hora de voltar. O arquivo
   > que você me mandou já foi apagado do meu aparelho. Chama uma pessoa por dia da lista e me conta
   > quem voltou.

### Texto para pedir a lista ao suporte do sistema antigo

Sem nomear o sistema, serve para qualquer um. A mesma frase aparece na tela "Vindo de outro
sistema" do próprio CICLO.

> Olá! Quero receber a lista dos meus clientes numa planilha (Excel ou CSV), com nome, telefone e a
> data do último atendimento de cada um. Pode me enviar por e-mail?

Se a pessoa não achar onde pedir, diga que use o botão de ajuda ou o WhatsApp do sistema antigo. Não
prometa o caminho de dentro dele: cada um muda de lugar.

---

## 4 · Erros que o dono vai ver

Textos como aparecem na tela hoje. Se mudarem no código, mude aqui.

| O que aparece | O que aconteceu | O que responder |
|---|---|---|
| "Esse arquivo é uma planilha do Excel, e o importador lê CSV..." | Subiu um `.xlsx` | "No Excel: Arquivo, Salvar como, escolhe CSV UTF-8, e sobe o arquivo novo. No Google Planilhas: Arquivo, Fazer download, valores separados por vírgula." |
| "Arquivo maior que 5 MB." ou "Envie no máximo 5000 linhas por vez." | Base grande | "Divide em duas planilhas e sobe uma de cada vez." |
| "Não consegui identificar as colunas. Confira se é um CSV separado por vírgula." | Arquivo que não é planilha, ou colunas sem separador | "Abre no Excel, salva de novo como CSV UTF-8 e sobe." |
| "O arquivo está vazio ou sem cabeçalho." | Falta a primeira linha com o nome das colunas | "A primeira linha precisa ter os títulos, tipo Nome, Telefone, Última visita." |
| "N clientes entraram sem a última visita: a data da planilha não estava num formato que eu reconheço." | Data escrita de outro jeito | "Os clientes entraram, mas sem data o CICLO não calcula. Escreve a data como 15/08/2026 e importa de novo só essas linhas." |
| "Nome em branco." / "Telefone inválido" | Linha com defeito, só ela é pulada | "Essas linhas ficaram de fora. Corrige na planilha e sobe só elas." |
| "Já existe uma ficha com esse telefone." | Cliente repetido, ou a base já entrou antes | "Não é erro. A ficha que já existe foi mantida." |
| Recuperar receita vazio, ou "ninguém atrasado", logo depois de importar | Importou sem a data da última visita, ou todo mundo veio há pouco | "O CICLO só mostra quem sumiu com a data. Preenche a última visita e importa de novo." |
| "E-mail ou senha não conferem." | Senha errada, **ou** e-mail ainda não confirmado (a tela não diz qual, de propósito) | "Procura no e-mail o link de confirmação, olha o spam. Se não achar, toca em Esqueci minha senha." |
| "Não consegui verificar seu acesso agora. Não é problema com a sua senha, tente de novo em instantes." | Falha do nosso lado no acesso | "Não é a senha. Tenta de novo daqui a pouco. Se repetir, me manda um print e a hora." |
| "Esse link não vale mais: eles expiram e só funcionam no aparelho em que você pediu." | Link de senha vencido ou aberto em outro aparelho | "Pede outro e abre no mesmo aparelho em que pediu." |
| "Use pelo menos 8 caracteres." / "Essa senha é fácil de adivinhar. Escolha algo que só você usaria." | Senha fraca | "Uma frase curta que só você conhece. Pelo menos 8 caracteres." |
| E-mail de confirmação não chega | Caixa de spam, ou cota de e-mail do projeto | "Olha o spam e a aba Promoções, espera uns minutos. Se não chegar, me manda o e-mail que você usou." (Eduardo: conferir o limite de envio, `docs/87` item 7) |
| "Esse endereço já está em uso. Escolha outro." | O nome da página já existe | "Acrescenta o bairro ou a cidade no final do endereço." |
| "Muitas tentativas seguidas. Espere um instante e tente de novo." | Limite de tentativas | "Espera uns minutos e tenta de novo." |
| "Sua sessão expirou. Entre de novo para continuar." | Ficou muito tempo parado | "Entra de novo. O que você já tinha salvo está lá." |
| "Confirme o código de verificação em duas etapas para continuar." | Ao baixar os clientes: falta ligar ou digitar o código | "Liga a verificação em duas etapas em Configurações, Segurança, com um app autenticador, e tenta de novo." |
| "Você já baixou a base este mês..." | Limite de um download a cada 30 dias | "É para proteger os dados dos seus clientes. Se precisar antes, me chama." |
| "Seu plano chegou ao limite. Veja o que muda em Config, Meu plano." | Conta na pausa (depois dos 60 dias e dos 7 de graça) | "A conta está só de leitura. Assinando em Meu plano, volta tudo na hora. Nada foi apagado." (Conferir o texto quando a cortesia entrar) |
| "Esse horário acabou de ser reservado." (cliente, na página de agendamento) | Duas pessoas escolheram o mesmo horário | "Escolhe outro horário da lista." |
| "Você é dona ou dono de um negócio com mais gente na equipe. Antes de excluir sua conta, alguém precisa assumir como titular." | Tentou excluir o login sendo o titular | "Para sair, alguém da equipe precisa assumir. Se quer apagar o negócio, me chama." |
| "Não consegui falar com o servidor" / "Sem conexão agora" | Internet | "Confere a conexão e tenta de novo." |
| "Algo deu errado do nosso lado. Tente de novo em instantes." | Erro nosso | "Desculpa. Me manda um print, a tela e a hora aproximada, que eu olho." (Eduardo: sem o erro chegando por Sentry, o print e a hora são a única pista, `docs/87` item 8) |

---

## 5 · Como este arquivo se liga ao placar

`placar-do-piloto.sql`, consulta Q3, lista as contas paradas há mais de 7 dias com a coluna
**onde parou** (1 a 5). Use o número para escolher o texto da §2.3. Uma conta que travou na etapa 1
nunca deve receber o texto da etapa 3.
