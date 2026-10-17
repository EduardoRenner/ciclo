# 108 · Pronto para vender: o que falta, em ordem

Escrito em 16/10/2026, a pedido do Eduardo: "o que falta para eu começar a vender para elas, prepara o produto com esse foco, tira o inútil, e o plano para começar a rodar e prospectar".

Público: a profissional de cílios, sobrancelha e unhas que trabalha sozinha ou em dupla, começando pelas 16 da região de Maravilha (lista privada em `C:/Users/Usuario/.claude/code/leads-privados/`).

## 1. A linha de chegada

**Ela cria a conta pelo celular dela, traz as clientes em 10 minutos, vê quem passou da manutenção e quanto vale, chama uma pelo WhatsApp dela, e o link da página dela vai para a bio do Instagram.**

Hoje, em produção, isso **não** acontece por quatro motivos:
- o cadastro de quem é de fora não confirma (falta SMTP);
- a `main` está atrás da pilha;
- não há conta de demonstração de beleza para mostrar;
- o lembrete automático não sai.

## 2. O que só o Eduardo pode fazer (bloqueia a venda)

| # | O quê | Por quê | Tempo |
| --- | --- | --- | --- |
| 1 | **Desligar a confirmação de e-mail** no Supabase de produção (Authentication → "Confirm email") | Sem isso ninguém de fora entra. O código que deixa a conta abrir na hora está no PR #153 | 2 min |
| 2 | **Revisar e mesclar**, nesta ordem: o **#152** (pilha), o **#153** (preço R$ 39 e cadastro direto) e o **#154** (conta enxuta da beleza) | Tudo o que foi feito e testado está fora do ar. As migrations seguem `docs/runbooks/lote-0118-a-0141.md` | 1 a 2 h de revisão |
| 3 | **Rodar as contas de demonstração de beleza em produção** (`demo-studio-olhar`, `demo-esmalteria-rosa`, com o `seed-demo-dinheiro`) e trocar as senhas | Os prints de hoje são da barbearia: "máquina", "barba" e "bebida de sempre" não falam com ela. A demonstração tem de ser de cílios e de unhas | 15 min |
| 4 | **Canal de contato** (`NEXT_PUBLIC_CONTATO_WHATSAPP`) | O "me manda que eu faço" e o socorro aparecem só com ele | 5 min |
| 5 | **Credencial da Meta** para o lembrete de horário pelo WhatsApp (mensagem de utilidade, uns R$ 0,03) | É o básico do nicho; Simples Agenda e Agendiva incluem | dias (aprovação da Meta) |
| 6 | **SMTP** só para "esqueci a senha" | Com a confirmação desligada, deixa de bloquear o cadastro | 30 min |

**A venda pode começar depois dos itens 1, 2 e 3.** O 5 melhora muito, mas não impede o alpha.

## 3. O produto com o foco (feito hoje, nos PRs)

| Mudança | Onde | Estado |
| --- | --- | --- |
| Cadastro abre na hora, sem depender de e-mail | PR #153 | testado; no navegador, `/cadastro` vai direto aos primeiros passos |
| Preço R$ 39 até 2 profissionais, R$ 79 até 6; o cartão fala em manutenção | PR #153 | testado; no navegador, `/precos` correto |
| **Conta nova de cílios, sobrancelha, unhas e depilação nasce enxuta:** sem orçamento, estoque, campanhas, clube e documentos | PR #154 | unidade 12/12, integração 9/9, mutação reprova |
| **"Minha comissão" só aparece com equipe** | PR #154 | para a solo, era um item que nunca tinha conteúdo |
| Serviço de volta certo ao trazer a clientela (cílios = manutenção, unhas = manicure, sobrancelha = design) | PR #152 | medido no navegador nos 4 nichos |
| Página da profissional pronta para o Google (título, descrição, dados estruturados, sitemap) | já na `main` | conferido no código |

**O que continua no produto, mas não aparece para ela no começo** (ela religa em Configurações → Módulos):
- orçamento, estoque e ficha de consumo, campanhas em lote, clube de assinatura, documentos;
- a análise "de quem depende o que sobra" e a comissão, que só fazem sentido com equipe.

**Nada foi apagado.** Barbearia, cabelo e estética começam como antes.

## 4. O que ainda vale construir antes de crescer (não antes do alpha)

| Ordem | O quê | Por quê | Tamanho |
| --- | --- | --- | --- |
| 1 | **Escolher mais de uma especialidade no cadastro** (cílios + sobrancelha + lash lifting) | 9 de 13 da região fazem vários serviços; hoje ela cadastra a segunda à mão | P a M |
| 2 | **Assinatura da cliente na anamnese** pelo celular | É o básico do nicho (Simples Agenda, Agendiva, LashLab Pro) | M |
| 3 | **Fotos dos trabalhos fáceis de subir** na página | O catálogo do WhatsApp mostra que foto é o que vende; conferir o que já existe | P |
| 4 | **"Ficou devendo"** | Fiado é comum no bairro | M, se o alpha pedir |

## 5. Como prospectar as 16 (o roteiro)

**Regras** (do kit de campo, valem sempre):
- uma a uma, nunca disparo;
- mensagem pensada para aquela profissional;
- "se não quiser, é só me dizer";
- quem disser não sai da lista na hora (coluna "não quer contato?").

**Ordem sugerida:**
1. **Quem tem preço e agenda organizada** (posta tabela, horário configurado): entendem o valor de sistema. São 2 da lista.
2. **Quem tem mais audiência** (perfis com 2 a 4 mil seguidores): viram prova social na cidade. São 2 a 3.
3. **O resto,** por indicação das primeiras.
4. **A mentora de unhas da cidade** (lista de canais): conversa de parceria, não de venda.

**A primeira mensagem** (no WhatsApp dela, adaptar o nome e o nicho):

> Oi, [nome]! Sou o Eduardo, aqui de Maravilha. Vi teu trabalho de [cílios/unhas] no Instagram, muito bonito. Tô lançando um app que mostra quais clientes já passaram da manutenção e quanto vale chamar de volta, e ainda te dá uma página pra pôr no link da bio. É grátis pra quem entrar agora. Posso te mostrar em 10 minutos, aí no teu espaço, num horário vago? Se não quiser, tranquilo, é só falar.

**Os 10 minutos:** o roteiro do `02-kit-de-campo.md`, no celular dela, com as clientes **dela**, de memória ou colando a lista do WhatsApp. O momento que vende é a tela "X passaram da hora, R$ Y". Se ela tiver 20 clientes de manutenção, ali já aparece dinheiro que ela não está vendo.

**As objeções que vão aparecer** (`06-voz-e-canais.md` e a pesquisa):

| Ela diz | Resposta |
| --- | --- |
| "O WhatsApp já resolve" | Continua no WhatsApp: o CICLO só te diz **quem** chamar e escreve a mensagem. O envio é pelo teu número |
| "Mais um app para olhar" | Uma tela por dia: quem passou da manutenção. Dois minutos |
| "A InfinitePay é grátis" | Ela marca horário; não te diz quem sumiu nem quanto isso vale |
| "E se eu quiser sair?" | Sai quando quiser, sem multa, e leva tua lista de clientes |
| "Quanto custa?" | Grátis até janeiro. Depois R$ 39 por mês: menos que uma manutenção |

## 6. As métricas da primeira rodada (16 contatos)

| Medida | Meta |
| --- | --- |
| Aceitaram ver a demonstração | 8 de 16 |
| Criaram a conta e trouxeram 20 ou mais clientes | 5 |
| Chamaram alguém pelo CICLO na primeira semana | 4 |
| Ainda abrem na quarta semana | 3 |
| Dizem que pagariam R$ 39 | 3 |

**Anote tudo na planilha privada** (status, data, resposta). A cada segunda, os números entram em `docs/108-norte/medidas.md`, só agregados, sem nome.

## 7. A semana, em ordem

| Dia | Eduardo | Claude |
| --- | --- | --- |
| 1 | Itens 1, 3 e 4 da seção 2; começa a revisão do #152 | Pendências de revisão dos PRs; ajustes que você pedir |
| 2 | Mescla #152 → #153 → #154 com as migrations; pede a credencial da Meta | Confere produção depois do deploy (só leitura): health, página pública, cadastro |
| 3 e 4 | Primeiras 4 a 6 mensagens; marca as demonstrações | Escolher mais de uma especialidade no cadastro, se você quiser antes do alpha |
| 5 | Demonstrações; anota na planilha | Consolida a primeira leitura das fichas |
