# 114 · Revisão das duas jornadas a 375 px (F1, 21/10/2026)

Feita na branch `marca/feminina-2026-10-20` (commit `bb0ef1e7`), banco local isolado, navegador do app a 375 × 812. Contas: uma profissional nova criada pelo número de teste `(11) 90000-0004` ("Studio Bianca Teste", Cílios) e a conta de demonstração `demo-carol-cilios` (EXP-S02) para o lado da cliente.

Cada tela passou por um auditor em JavaScript que mede: largura da página contra a da tela, alvos de toque abaixo de 44 px (com a área do `toque-48`), texto de plano/preço/"assine", promessa de canal e masculino genérico. Medido, não deduzido.

## Telas percorridas

| Jornada | Tela | Rolagem lateral | Toque < 44 px | Achado |
| --- | --- | --- | --- | --- |
| Profissional | `/` (home) | não | nenhum | rodapé com "Preços" (B2) |
| Profissional | `/cadastro` | não | nenhum | pede e-mail e senha (B1) |
| Profissional | `/entrar` pelo número | não | nenhum | código com teclado numérico e `one-time-code` (bom) |
| Profissional | `/onboarding` | não | nenhum | seis de beleza abertas (EXP-S04) |
| Profissional | `/onboarding/perfil` | não | nenhum | "Onde estão seus clientes hoje?" (B6) |
| Profissional | `/admin/hoje` | não | nenhum | limpo |
| Profissional | `/admin/config/servicos` | não | nenhum | pacote novo na ordem (EXP-S06) |
| Profissional | `/admin/config/horarios` | não | nenhum | limpo |
| Profissional | `/admin/clientes/nova` | não | caixinha de 20 px (M4) | "Só marque se o cliente disse que pode", "Digite o nome do cliente primeiro" (B6) |
| Profissional | `/admin/recuperar` (vazio) | não | nenhum | "Cadastre suas clientes" (B6) |
| Profissional | `/studio-bianca-teste` (página pública) | não | — | "Remoção" marcável (M2) |
| Cliente | `/demo-carol-cilios/agendar` | não | nenhum | oferece hoje (B3); próximos dois dias sem horário (M1) |
| Cliente | confirmação do pedido | não | nenhum | sem "Remarcar ou cancelar" (B4); sem promessa de canal (bom) |
| Público | `/precos` | não | — | "R$ 39 por mês" e planos (B2) |

## Bloqueios (consertar antes de lançar)

| # | O quê | Onde | Ticket |
| --- | --- | --- | --- |
| B1 | O cadastro pede e-mail e senha; a decisão é entrar só pelo número. O caminho pelo número já funciona em `/entrar` ("o código cria a sua conta"), mas o botão "Criar minha conta" da home leva ao formulário de e-mail. | `/cadastro`, home | L-03 |
| B2 | `/precos` mostra "R$ 39 por mês", os dois planos e "teste"; a home linka para lá no rodapé. A decisão é tudo grátis no lançamento. | `/precos`, rodapé da home | L-01 |
| B3 | A agenda pública oferece horários de hoje; a decisão é 1 dia de antecedência, com "Para hoje, chame no WhatsApp". | `/[slug]/agendar` | L-04 |
| B4 | A confirmação não tem "Remarcar ou cancelar". O link de gestão (`/confirmar/[token]`) existe, mas só chega pela mensagem de lembrete (Meta, desligada) ou pelo WhatsApp da profissional: sem a Meta, a cliente só desmarca ligando. | confirmação do agendamento | L-07 (ou junto do L-05) |
| B5 | Não existe a entrada "Sou cliente / Sou profissional". | home, `/entrar` | L-02 |
| B6 | Masculino genérico em telas da profissional: "Onde estão seus clientes hoje?" (perfil), "Só marque se o cliente disse que pode", "Digite o nome do cliente primeiro" e o título "Cliente novo" (nova cliente); e o oposto em "Cadastre suas clientes" (Recuperar vazio), que supõe o gênero de quem é atendido. A guarda `copy-nao-supoe-genero` pega "as clientes", mas não "suas clientes". | perfil, nova cliente, Recuperar | ticket curto antes do L-01 (parte do EXP-S12) |

## Melhorias (depois do lançamento)

| # | O quê | Onde |
| --- | --- | --- |
| M1 | Na demonstração, a agenda futura semeada deixa quinta e sexta sem nenhum horário livre e sábado com um só: quem testa "Ver funcionando" acha que a agenda não funciona. Pesar menos os próximos 3 dias no `seed-demo-agenda-futura`. | `demo-carol-cilios` |
| M2 | "Remoção" aparece para a cliente marcar online na conta nova (o pacote ainda grava `bookable_online` verdadeiro para o serviço sem retorno). | página pública; EXP-S09 |
| M3 | A confirmação não mostra o endereço com mapa nem "Falar no WhatsApp" quando a profissional não cadastrou WhatsApp (só "Ligar"). | confirmação; ideia "confirmação que acalma" do 114 |
| M4 | A caixinha "Autorizou receber promoções e lembretes" tem 20 × 20 px; conferir se o rótulo inteiro é clicável (área de toque real). | `/admin/clientes/nova` |
| M5 | "Endereço da sua página: localhost:3000/" no cadastro do negócio é a variável de ambiente local; em produção sai o domínio. Registro só para não virar falso achado. | `/onboarding` |

## O que esta revisão NÃO cobriu (e por quê)

- **Aviso no aparelho** da profissional ao chegar o pedido: a permissão de notificação está bloqueada neste navegador (já registrado no EXP-A02), e não mexo nela.
- **Remarcar e cancelar pelo lado da cliente:** sem o link na confirmação (B4), não há como chegar à tela pela jornada; `/confirmar/[token]` existe e precisa ser revista quando o B4 entrar.
- **Marcar a próxima manutenção** e a **busca**: ainda não existem (L-05 e L-06).
- **Hoje com o pedido novo** e a **primeira cliente cadastrada à mão**: ficaram para a revisão do fim do F2, depois dos tickets que mudam essas telas.
