# CICLO · Plano para subir na App Store (e no Google Play) com a interface otimizada

Data: 15/10/2026. Base: `origin/main` em `33058dd0`. Este documento **junta** três coisas que estavam separadas:

1. o **plano de aprimoramento geral** (`docs/98-aprimoramento/08-plano-e-tickets.md`, 167 tickets, execução pela metade);
2. o **plano da loja** (`APP_STORE_READINESS.md` e `docs/64-APP-STORE-CAPACITOR-PLANO.md`, parado desde 19/09);
3. o que apareceu agora: **o e-mail de cadastro não chega** e o código está espalhado em branches que não entraram na main.

Regra de leitura: **FATO** tem arquivo ou comando; **[INFERÊNCIA]** diz de onde veio; **[NÃO VERIFICADO]** diz quem destrava. Este plano **não implementa nada**.

---

## 0. Resumo em 12 linhas

1. **O app já existe como casca.** É o mesmo site embrulhado com Capacitor. Android builda e rodou no emulador. iOS tem a pasta, mas **nunca foi compilado nem aberto num iPhone**.
2. **O código nativo parou em 19/09.** Nenhuma branch tem nada mais recente (FATO: `git log --since=2026-09-19` vazio em todas as worktrees).
3. **O plano 98 está em ~50%** (84 de 167 tickets com commit). As ondas Facilidade, Velocidade, Copy e Geral (71 tickets) não começaram.
4. **Nada disso está na main.** Só o PR #150 está aberto. O resto está empilhado em `aprimoramento/onda-1` (+358 commits).
5. **Migrations 0101, 0118 e 0121 a 0141 existem no repositório e não estão na main**, então não estão em produção. Sem a 0102 aplicada, **todo login cai**.
6. **O cadastro de cliente real não funciona hoje:** o Supabase só envia e-mail para quem é do time da organização. O código esconde esse erro.
7. **A loja tem 4 bloqueios que são seus:** onde buildar o iOS (Mac ou Codemagic), conta Apple (US$ 99/ano), conta Google Play (US$ 25) e a decisão do login social.
8. **Achei 12 lacunas novas para a loja** que o `docs/64` não lista (seção 4). As mais perigosas: a landing e os preços aparecem dentro do app (risco da regra 3.1.1), a conta do revisor não está marcada como demonstração, e o app roda em iPad sem ter sido pensado para iPad.
9. **Interface:** as 10 telas do dono têm a lista de consertos pronta no plano 98. O que falta é executar, na ordem, e acrescentar 9 itens que só a loja exige.
10. **Caminho crítico:** destravar produção e e-mail → juntar o código → consertar interface e lacunas → conta Apple e build → TestFlight em aparelho → submeter.
11. **Ordem de trabalho:** 7 faixas (seção 2). As faixas 0 e 1 são pré-requisito de tudo.
12. **O que depende de você** está na seção 8, em ordem.

---

## 1. Onde estamos (medido)

| Frente | Estado | Fonte |
| --- | --- | --- |
| Plano 98, tickets com commit | 84 de 167 (+2 resolvidos sem commit) | contagem de `APR-xxx` em `git log origin/main..aprimoramento/onda-1` |
| Onda U (urgentes) | 40 de 41. Falta a 017 (pacote) | `_progresso.md` |
| Onda 1 (interface) | 24 de 31. Faltam 116 e 126–131 | idem |
| Onda 2 (funcionalidade) | 20 de 24. Faltam 209 e 220 | idem |
| Ondas 3, 4, 5, 6 | 0 de 71 | idem |
| PRs abertos | #150 (verde), #149 (verde), #142 (conflito), #144 (conflito) | `gh pr list` |
| Execução do plano 98 | **pausada em 14/10** a seu pedido, para o plano automotivo | `docs/105-ciclo/_estado.md` |
| Código nativo | scaffold Capacitor 8, iOS e Android, parado em 19/09 | `APP_STORE_READINESS.md` |
| iOS | nunca compilado, nunca testado em aparelho | `APP_STORE_READINESS.md` §8 |
| Android | builda; testado em emulador só sem login | `docs/64` |
| Cadastro por e-mail | não entrega para cliente real | ver §3 |

---

## 2. As 7 faixas (ordem e porta de saída)

Cada faixa tem uma **porta**: só passa para a próxima quando a porta fecha com evidência.

| Faixa | Nome | Quem | Porta (como saber que acabou) |
| --- | --- | --- | --- |
| **0** | Destravar o que quebra tudo | Eduardo + eu | Login e cadastro funcionam em produção com uma pessoa de fora |
| **1** | Juntar o código | eu + Eduardo | A main tem tudo que está pronto; migrations aplicadas na ordem |
| **2** | Interface e velocidade | eu | As 10 telas do dono cumprem as metas da seção 5 |
| **3** | Lacunas da loja no código | eu | Lista LOJA-20 a LOJA-39 fechada, cada uma com teste |
| **4** | Contas e ambiente de build | Eduardo | Apple Developer ativa, build iOS rodando, Play Console ativo |
| **5** | Teste em aparelho real | Eduardo + eu | TestFlight instalado num iPhone e num iPad; roteiro da seção 6 passa |
| **6** | Submissão | Eduardo + eu | App enviado para revisão, com ficha, imagens e notas ao revisor |

### Faixa 0 · Destravar o que quebra tudo

| ID | O quê | Quem | Aceite |
| --- | --- | --- | --- |
| LOJA-00 | **Conferir em produção, só leitura, por nome:** migrations 0092 a 0117, em especial a **0102** | Eduardo autoriza; eu leio | Lista "aplicada / não aplicada" por nome, sem tocar em nada |
| LOJA-01 | **SMTP próprio no Supabase** (Resend, domínio `seuciclo.com.br` com SPF e DKIM) e subir o limite de e-mails por hora (vem em 30) | Eduardo (painel e DNS) | Cadastro de um e-mail **que não é do time** recebe o link em menos de 1 minuto |
| LOJA-02 | **Código: o cadastro para de esconder o erro de e-mail.** O 400 `email_address_not_authorized` hoje vira "mandamos o link". Passa a registrar um evento próprio e a responder com o texto "não conseguimos enviar agora" | eu | Teste que simula o erro e reprova antes do conserto |
| LOJA-03 | **Decidir o cadastro:** A (SMTP e confirmação por e-mail), B (desligar a confirmação, entra direto) ou C (só telefone) | Eduardo | Decisão escrita em `DECISOES.md` |
| LOJA-04 | **Contato público:** `NEXT_PUBLIC_CONTATO_WHATSAPP` e `NEXT_PUBLIC_CONTATO_EMAIL` na Vercel. A ficha da loja exige uma URL de suporte | Eduardo | `/contato` abre um canal que responde |
| LOJA-05 | **Hospedagem e backup:** a Vercel Hobby é só para uso não comercial; o projeto Supabase está num plano sem backup. Ficha de saúde sem backup é risco inaceitável (`docs/87` itens 5 e 6) | Eduardo | Plano e backup confirmados por escrito [NÃO VERIFICADO em produção] |

### Faixa 1 · Juntar o código

Ordem segura (INFERÊNCIA a partir de `08` §C8.6 e das dependências entre branches):

1. Confirmar a 0102 por nome (LOJA-00).
2. Mesclar o **#150** (U1, sem migration).
3. Aplicar as migrations aditivas **0121, 0122, 0125, 0126** e mesclar a U2. Depois **0123 e 0124** (RLS), uma de cada vez, com o teste de isolamento antes e depois e 48 h de observação.
4. Mesclar o **#149** (traz a 0118; o texto do PR diz "sem migration", e isso está errado).
5. Aplicar a **0101** e só então refazer a base e mesclar o **#142**.
6. Mesclar a onda-1 em pedaços: Onda 1, depois Onda 2, depois o conversor (0128, 0129).
7. **Separar** o trabalho do ciclo automotivo (0132 a 0141), que o plano 98 não pede, e decidir se entra agora.
8. Migrations **restritivas por último:** 0127, 0135, 0139.

| ID | O quê | Aceite |
| --- | --- | --- |
| LOJA-10 | Decidir se o plano 98 **retoma antes** de mais ciclos do Motor e do automotivo | Decisão escrita |
| LOJA-11 | Executar a ordem acima, um passo por vez | Cada passo com suíte verde, migration conferida e deploy de prévia testado |
| LOJA-12 | Reabrir os tickets que dependem do #149 e do #142: 116, 508, 312 | Os três com guarda reprovando antes |

### Faixa 2 · Interface e velocidade

O plano 98 já descreve cada conserto. Aqui só está a **ordem para a loja** e o que falta.

**As 10 telas do dono** (as que a Apple e o primeiro cliente vão ver): Hoje, Agenda, Comanda e Receber, Clientes, Recuperar, Caixa, Serviços, Mês, Entrar, Cadastro.

| Prioridade | Tickets do 98 | O que muda para o dono |
| --- | --- | --- |
| 1 | **401** (login sem `refresh`), 403 e 404 (Receber e Ver comanda), 402 e 413 (Chegou, Faltou, Confirmar), 412, 408, 407 (Hoje) | Login com 69 idas ao banco vai a ~15. Receber e Ver comanda deixam de levar 3 segundos |
| 2 | **418 e 419** (Clientes com 295 leva 6,6 s), 414 (Mês e Serviços) | Lista de clientes abre sem esperar |
| 3 | **502** (frase de trava por plano em um lugar só), **503** (campanha por grupo), 504, 505, 508 (63 cópias de "Não consegui falar com o servidor" viram uma) | Erro sempre diz o que fazer |
| 4 | 116 (Recuperar com a fila no topo), 126 a 131 (uma cor de ação, "Quem sumiu", duas colunas no computador) | Esperam suas decisões |
| 5 | 305 (recepção sem R$), 310, 311, 312 | Equipe vê só o que é dela |
| 6 | **611** (página "sem internet"), 609 (foco depois de sheet), 603 (roteiros de verificação) | **Sem esses, a loja reprova por tela quebrada sem conexão** |
| 7 | Ondas 3 a 6 completas | Depois da primeira submissão |

**Metas** (as do contrato `docs/97`, não mudam): resposta ao toque < 100 ms; troca de tela < 1 s; nunca tela em branco; sem rolagem lateral em 390 e 360 px; alvos ≥ 48 px; tema claro e escuro; contraste AA.

### Faixa 3 · Lacunas da loja no código (novas)

Tickets **LOJA-20 a LOJA-39**, detalhados na seção 4.

### Faixa 4 · Contas e ambiente

| ID | O quê | Quem | Observação |
| --- | --- | --- | --- |
| LOJA-40 | **T0:** onde buildar o iOS. Xcode só roda em Mac. Recomendado: **Codemagic** (plano gratuito, liga ao GitHub) | Eduardo | `docs/64` §1.2 |
| LOJA-41 | **T5:** conta Apple Developer, US$ 99/ano | Eduardo | Escolher **pessoa** ou **empresa**: muda o nome do vendedor na loja. Conta de empresa costuma pedir CNPJ e número D-U-N-S e demora mais [NÃO VERIFICADO: conferir no site da Apple] |
| LOJA-42 | Conta Google Play, US$ 25 uma vez | Eduardo | Contas pessoais novas podem ter um período de teste fechado obrigatório antes de publicar [NÃO VERIFICADO: conferir no Play Console antes de prometer prazo] |
| LOJA-43 | Guardar o **keystore** do Android com backup | Eduardo | Perder o keystore impede atualizar o app |
| LOJA-44 | Bundle ID `br.com.seuciclo.app` **confirmado** | Eduardo | É permanente depois da primeira submissão |

### Faixa 5 · Teste em aparelho real

Roteiro na seção 6.

### Faixa 6 · Submissão

| ID | O quê |
| --- | --- |
| LOJA-50 | Ficha: nome, subtítulo, descrição, palavras-chave, categoria, URL de suporte, URL de política de privacidade |
| LOJA-51 | Imagens: iPhone e **iPad** (se o app continuar rodando em iPad), tema claro, sem dado real |
| LOJA-52 | Questionário de privacidade ("nutrition label") e, no Google, o Data Safety |
| LOJA-53 | Notas ao revisor (rascunho em `docs/64` T7 item 7, revisar o inglês) com a conta `apple-review` |
| LOJA-54 | Conferir a conta do revisor **no dia do envio** (a armadilha já está documentada) |
| LOJA-55 | Versão e build reais no lugar de `1.0` e `1` |

---

## 3. O e-mail de cadastro (bloqueio de lançamento, não só da loja)

**Causa provável.** Sem servidor de e-mail próprio, o Supabase só entrega para membros do time da organização e recusa o resto com `email_address_not_authorized` (docs oficiais do Supabase). O projeto de produção não tem SMTP próprio. **[NÃO VERIFICADO no projeto:** meu acesso aos logs deu "sem permissão"; confirmar em Authentication → Logs.**]**

**Por que ninguém viu.** `src/app/api/v1/auth/signup/route.ts` só trata 429 e 500. O 400 vira um aviso no log, e a tela diz "mandamos o link".

| Caminho | O que é | Prós | Contras |
| --- | --- | --- | --- |
| **A** | SMTP próprio (Resend) e manter a confirmação | Seguro; também conserta o "esqueci a senha" | Precisa de domínio verificado e de você no painel |
| **B** | Desligar "Confirm email". O cadastro entra direto | Sem espera, sem e-mail | Qualquer um cadastra o e-mail de outro. A rota precisa tratar a sessão devolvida |
| **C** | Só telefone (sem confirmar) | Menos campos | Número reciclado; sem recuperar senha por e-mail; identidade não verificada. As docs do Supabase recomendam MFA nesse caso |

**Recomendação:** **A** para a loja. A Apple testa o cadastro e a recuperação de senha; os dois precisam de e-mail que chega. O **B** serve como ponte nos primeiros dias, se você quiser abrir antes.

**Regra do projeto que limita o desvio:** `service_role` só pode ficar em `src/server/db/with-tenant.ts`. Criar usuário "já confirmado" pela rota **não** é caminho permitido.

---

## 4. Lacunas novas da loja (o que o `docs/64` não lista)

Cada uma foi conferida por amostragem no código. Gravidade: **A** pode reprovar, **M** piora a impressão, **B** polimento.

| ID | Lacuna | Gravidade | Evidência | Conserto | Esforço |
| --- | --- | --- | --- | --- | --- |
| LOJA-20 | **Landing e preços aparecem dentro do app.** O app abre `/`, que é estática e não olha o tipo de aparelho. `/precos` mostra planos com botão para `/cadastro`. A guarda de teste isenta a landing e nem varre `/precos` | **A** (regras 3.1.1 e 3.1.3, `docs/64` §0.2) | `src/app/(public)/precos/page.tsx:250`; `tests/unit/design/precos-nunca-sozinho-no-app-nativo.test.ts:24` | No app: abrir direto em `/entrar`; esconder preços e botões de plano; incluir `/precos` na guarda | M |
| LOJA-21 | **Login social dentro do app.** `login-social.tsx` oferece Google e Apple. O Google costuma bloquear login em tela embutida [INFERÊNCIA]. Se só o Google estiver ligado, a regra 4.8 exige Apple também [INFERÊNCIA: `docs/64` só cita o link] | **A** | `src/lib/auth/provedores-sociais.ts:20-31` | Esconder no app nativo **ou** fazer fluxo nativo. Decisão sua | M |
| LOJA-22 | **`apple-review` não está na lista de demonstração.** O código trata esse negócio como real: sitemap, lembretes e campanhas. O revisor pode disparar WhatsApp para número fictício | **A** (2.1) | `src/core/tenants/demonstracao.ts:56-70` | Incluir o slug; teste que reprova antes | P |
| LOJA-23 | **Plano do negócio do revisor.** A tela "Sumindo" é do Pro; o seed não grava plano | **A** (2.1) | `seed-tenant-teste.mjs`; `precos/page.tsx:164` | Conferir o plano em produção e fixar no seed | P |
| LOJA-24 | **"Adicionar à Tela de Início" aparece dentro do app iOS**, em Configurações → Notificações | **M** (4.2 e 2.1) | `src/app/admin/config/notificacoes/ativar.tsx:19-23,36,133` | No app, trocar por texto próprio; esconder Web Push no iOS (não funciona na tela embutida [INFERÊNCIA]) | P |
| LOJA-25 | **Permissão de câmera e fotos.** As telas de foto usam o seletor do sistema e o `Info.plist` não tem texto de uso | **M** | `fotos.tsx`, `upload-de-foto.tsx`, `imagens.tsx`; `ios/App/App/Info.plist` | Acrescentar `NSCameraUsageDescription` e `NSPhotoLibraryUsageDescription`; confirmar com o Mac | P |
| LOJA-26 | **O app roda em iPad e em paisagem.** `TARGETED_DEVICE_FAMILY = "1,2"` e o `Info.plist` aceita as 4 orientações. A Apple pede imagens de iPad e testa nele. O `manifest.json` diz só retrato | **M** | `ios/App/App.xcodeproj/project.pbxproj:316,337`; `Info.plist:64-76` | Decisão: só iPhone e só retrato (menos trabalho) **ou** testar iPad e paisagem | P a G |
| LOJA-27 | **Exclusão de conta exige verificação em duas etapas.** Conta nova sem isso é mandada ativar antes de excluir. Dono com equipe é mandado falar com o suporte | **M** (5.1.1(v)) | `src/server/auth/session.ts:77-79`; `excluir-conta/formulario.tsx:122-125`; `conta.ts:57-69` | Aceitar reautenticação por senha no lugar do segundo fator; caminho próprio para dono com equipe | M |
| LOJA-28 | **Sentry está instalado e a privacidade não o cita.** A página de privacidade nomeia Mercado Pago, WhatsApp, Resend e Supabase, mas não Sentry nem Vercel | **M** (privacidade) | `package.json:34`; `privacidade/page.tsx` | Se o DSN estiver ativo: declarar. Se não: confirmar desligado [NÃO VERIFICADO] | P |
| LOJA-29 | **Dado de saúde (a ficha).** `docs/64` não cita a regra 5.1.3, só o questionário genérico | **M** | `privacidade/page.tsx:120,185-195` | Revisar o texto e preencher o questionário com a ficha como "saúde" | P |
| LOJA-30 | **Ícones da barra de status** ficam sempre brancos, mesmo com tema claro | **B** | `src/components/shell/configurar-status-bar-nativo.tsx:29` | Trocar o estilo conforme o tema | P |
| LOJA-31 | **Android:** sem assinatura de release; `allowBackup="true"` (o backup do Google pode levar a fila offline com dado de cliente); `.gitignore` tem keystore e `google-services.json` **comentados**, o que convida a commitar segredo | **M** | `android/app/build.gradle:19-24`; `AndroidManifest.xml:4`; `android/.gitignore:57-58,65` | Ignorar os arquivos de segredo **antes** de gerar a chave; `allowBackup` falso; `signingConfigs` | P |
| LOJA-32 | **`PrivacyInfo.xcprivacy`** não existe | **M** | `docs/64` T7 item 5 | Só o Mac confirma o que o binário usa | P |
| LOJA-33 | **Push nativo (T3) e Face ID (T4).** Hoje só existe Web Push | **B** (recomendado, não bloqueia) | `@capacitor/push-notifications` ausente | Depois da conta Apple | M |
| LOJA-34 | **Universal Links.** Sem `apple-app-site-association` nem `assetlinks.json` | **B** | `git ls-files public/.well-known` vazio | Precisa do Team ID | P |
| LOJA-35 | **Texto do app.** Todas as frases com "Instalar o app" ou "baixe" têm de sumir quando já estiver no app | **B** | busca por "instal" e "baixar" em `src` | Varredura e ajuste | P |
| LOJA-36 | **Conflito entre documentos:** `docs/55` ainda diz que o Capacitor foi "adiado conscientemente" | **B** | `docs/55-PLANO-DE-LANCAMENTO.md:76` | Atualizar o documento | P |

> Os números LOJA-37 a LOJA-39 ficam reservados para o que o teste em aparelho achar.

**Risco 4.2 ("app que é só um site").** O `docs/64` conta como capacidade nativa: toque com vibração, compartilhar, barra de status e aviso de sem conexão. Não há push nativo nem Face ID, e o site é carregado de fora (`server.url`), o que o próprio `docs/64` chama de bandeira vermelha. **Plano B:** LOJA-33 (push nativo) e um Face ID simples sobem de "recomendado" para "necessário" se a primeira revisão reprovar.

---

## 5. Otimização da interface (o que a loja acrescenta ao plano 98)

Além dos tickets do 98, a loja exige:

| # | Item | Por quê |
| --- | --- | --- |
| I-A | **Abrir no app direto em `/entrar`** (sem landing) | Evita a regra 3.1.1 e o "site embrulhado" |
| I-B | **Tela de "sem internet" própria** (APR-611) | Sem ela, o app mostra erro do navegador |
| I-C | **Áreas seguras** no iPhone (entalhe e barra de baixo) e **teclado** sem cobrir o botão de salvar | Checar em 390×844 e 375×667 por emulação; confirmar em aparelho |
| I-D | **Tema claro e escuro** com ícones da barra de status certos | LOJA-30 |
| I-E | **Zoom 200% e fonte grande** sem quebrar (o zoom já não é bloqueado: `layout.tsx:76-81`) | Acessibilidade |
| I-F | **VoiceOver e TalkBack** nas 10 telas do dono | Hoje só existe o APR-618, "fora das ondas até haver aparelho". Nada testado em leitor real |
| I-G | **Foco e retorno do toque** em todo botão (resposta < 100 ms) | APR-609 e `docs/98` §I-03 |
| I-H | **Imagens da loja** com a demonstração `apple-review` limpa, sem dado real | LOJA-51 |

**As 10 telas e a pergunta que cada uma responde** (regra do `docs/97`): Hoje ("o que faço agora?"), Agenda ("quem vem?"), Receber ("quanto e como?"), Clientes ("quem é?"), Recuperar ("quem sumiu?"), Caixa ("quanto entrou?"), Serviços ("o que vendo?"), Mês ("como estou?"), Entrar e Cadastro ("como começo?").

---

## 6. Roteiro de teste em aparelho (Faixa 5)

Em **iPhone** e **iPad** (se LOJA-26 mantiver iPad), claro e escuro, retrato e paisagem (se permitida):

1. Instalar pelo TestFlight; abrir; **não** aparece landing nem preço.
2. Cadastrar com e-mail que não é do time: o link chega; confirma; entra.
3. Esqueci a senha: o e-mail chega; troca a senha.
4. Entrar com a conta `apple-review`: aparecem clientes, agenda e "Sumindo" **sem bloqueio de plano**.
5. Criar agendamento, marcar "Chegou", fechar comanda, receber. Nenhuma tela pede para pagar o CICLO.
6. Tirar foto no cadastro de cliente: pede permissão com o texto certo.
7. Ligar o modo avião: aparece a tela "sem internet" e a fila offline guarda o que foi feito; religa e sincroniza.
8. Login com Google, se estiver ligado: volta ao app (ou está escondido).
9. Excluir a conta recém-criada: consegue sem etapa extra.
10. VoiceOver ligado: percorrer Hoje e Receber sem ficar preso.
11. Fonte grande e zoom 200%: nenhuma tela corta botão.
12. Trocar tema: ícones da barra de status legíveis.

Cada item gera **evidência** (vídeo curto ou captura) em `docs/98-aprimoramento/capturas/loja/`.

---

## 7. Cronograma em faixas (estimativa, não promessa)

Tempo em dias de trabalho **efetivo**, sem contar espera de terceiros. Tudo é **[HIPÓTESE]**.

| Faixa | Esforço meu | Espera externa |
| --- | --- | --- |
| 0 | 1 dia | DNS e Resend: horas a 2 dias; plano e backup: mesmo dia |
| 1 | 3 a 5 dias | 48 h de observação depois das migrations de RLS |
| 2 | 8 a 12 dias para os itens das prioridades 1 a 6 | Decisões 4 e 5 da seção 8 |
| 3 | 4 a 6 dias | LOJA-21, 26 e 27 esperam decisão |
| 4 | — | Conta Apple: de 1 dia a algumas semanas, conforme pessoa ou empresa [NÃO VERIFICADO] |
| 5 | 2 a 3 dias | Aparelho e TestFlight |
| 6 | 2 dias | Revisão da Apple: dias a semanas, e pode voltar com pedido de ajuste |

**Caminho crítico:** conta Apple (Faixa 4). Ela é a única coisa que não anda por esforço. **Comece por ela hoje**, em paralelo com as faixas 0 e 1.

---

## 8. O que depende de você, em ordem

1. **Abrir a conta Apple Developer** (US$ 99/ano) e decidir **pessoa ou empresa**. É o item que mais demora.
2. **Autorizar a leitura de produção, só leitura:** migrations 0092 a 0117 (0102 em especial), plano do Supabase, região do banco, DSN do Sentry, plano do negócio `apple-review`.
3. **Resend + DNS** do `seuciclo.com.br` e **SMTP no Supabase** (LOJA-01), ou escolher o caminho B.
4. **Escolher o caminho do cadastro:** A, B ou C (seção 3).
5. **Onde buildar o iOS:** Codemagic (recomendado) ou Mac.
6. **Login social:** ligar ou não; no app, esconder ou fluxo nativo (LOJA-21).
7. **iPad e paisagem:** só iPhone e retrato, ou testar os dois (LOJA-26).
8. **Link clicável de cobrança** (taxa de 15%) ou só texto. Hoje: só texto.
9. **Conta Google Play** (US$ 25) e guardar o keystore.
10. **Contato público** (WhatsApp e e-mail) para a ficha da loja.
11. As decisões abertas do plano 98: "Sobrou" × "Lucro", nome do botão central ("Quem sumiu" recomendado), "campanha por grupo", sinal e pagamento parcial, recepção vê o caixa, duas colunas no computador.
12. **Retomar o plano 98 antes de mais ciclos do Motor e do automotivo?** (LOJA-10)

---

## 9. Riscos de rejeição, em ordem

| # | Regra | O que o repositório já faz | O que falta |
| --- | --- | --- | --- |
| 1 | **2.1** completude e conta de demonstração | `apple-review` semeado; notas ao revisor em rascunho | LOJA-22, 23, 54 e prova de login em aparelho |
| 2 | **3.1.1 e 3.1.3** compra dentro do app | Cobrança bloqueada no app; guarda de teste | **LOJA-20** (landing e preços) |
| 3 | **4.2** "app que é só um site" | Vibração, compartilhar, barra de status, aviso offline | LOJA-24, 30; plano B: LOJA-33 |
| 4 | **4.8** login com Apple | Botão de Apple existe, desligado | LOJA-21 |
| 5 | **5.1.1(v)** exclusão de conta | Tela e rota existem | LOJA-27 |
| 6 | **5.1.3 / privacidade** dado de saúde | Cofre cifrado e log de acesso | LOJA-28, 29, 52 |
| 7 | **Dispositivo e orientação** | — | LOJA-25, 26 |

---

## 10. O que NÃO fazer

- Pagar a conta Apple **antes** de a Faixa 3 corrigir o LOJA-20 e o LOJA-21 só se for para esperar: a conta demora e pode correr em paralelo; **submeter** é que não pode vir antes.
- Mesclar as migrations restritivas (0127, 0135, 0139) antes de as aditivas.
- Commitar keystore, `google-services.json` ou qualquer chave.
- Escrever `PrivacyInfo.xcprivacy` às cegas, sem o Mac.
- Implementar Face ID sem aparelho para testar o caminho de erro.
- Usar `admin.createUser` na rota de cadastro (a regra do projeto proíbe `service_role` fora de `with-tenant.ts`).
- Medir desempenho com `pnpm dev`.
- Chamar de "pronto" o que só foi deduzido do código.

---

## 11. Fontes

`APP_STORE_READINESS.md`; `docs/64-APP-STORE-CAPACITOR-PLANO.md`; `docs/87-LANCAMENTO-2-MESES-GRATIS-PLANO.md` (itens 5, 6, 7); `docs/97-PROMPT-APRIMORAMENTO-GERAL.md`; `docs/98-aprimoramento/_progresso.md` e `08-plano-e-tickets.md`; `docs/105-ciclo/_estado.md`; `capacitor.config.ts`; `ios/App/App/Info.plist`; `ios/App/App.xcodeproj/project.pbxproj`; `android/app/build.gradle`, `AndroidManifest.xml`, `android/.gitignore`; `src/core/tenants/demonstracao.ts`; `src/core/plataforma/nativo.ts`; `src/app/api/v1/auth/signup/route.ts`; documentação oficial do Supabase Auth (SMTP padrão e login por telefone).

Dois relatórios de agentes só de leitura alimentaram as seções 1, 2 e 4 (estado do plano 98 e estado do app). Conferi à mão: LOJA-22 (lista de demonstração), LOJA-20 (botão de cadastro em `/precos`), LOJA-31 (`.gitignore` e `allowBackup`), LOJA-28 (Sentry instalado, ausente da privacidade), LOJA-30 (estilo fixo da barra), LOJA-26 (iPad e orientações). O resto vem dos relatórios e está rotulado.
