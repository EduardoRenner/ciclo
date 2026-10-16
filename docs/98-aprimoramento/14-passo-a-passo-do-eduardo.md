# Passo a passo do Eduardo: do PR #151 até o app na loja

Tudo o que só você pode fazer, na ordem. O que eu faço depois de cada passo está marcado com **EU**. Nunca cole senha, chave de API ou keystore no chat: guarde e me diga só "feito".

## Parte 1 · Hoje, sem gastar nada (cerca de 1 hora)

**1. Trocar as senhas das contas de teste de produção** (5 min). Os scripts de semente usavam uma senha escrita no código, e o repositório é público.
- supabase.com → projeto `eqzlvthzdjnsbogymcsw` → **Authentication → Users**.
- Procure `revisor-apple@ciclo.app` e as contas de demonstração (digite "demo" na busca).
- Em cada uma: três pontinhos → **Send password recovery** não serve (o e-mail não chega, ver passo 3). Use **Edit user → Password** e ponha uma senha nova e forte, que só você sabe.
- Se alguma conta não existir, tudo bem: era só risco.

**2. Revisar e liberar o PR #151** (10 min).
- Abra https://github.com/EduardoRenner/ciclo/pull/151 → confira que os 5 checks estão verdes.
- **EU** troco a data da política de privacidade para o dia do merge (`src/core/legal/versoes.ts`). Me avise o dia.
- Clique em **Ready for review** e depois **Merge pull request**. A Vercel publica sozinha.
- Esse PR não tem migration de banco, então não mexe em dados.

**3. Pôr um canal de contato no site** (5 min). A loja exige uma URL de suporte que responda.
- vercel.com → projeto do CICLO → **Settings → Environment Variables** → ambiente **Production**.
- Crie `NEXT_PUBLIC_CONTATO_WHATSAPP` com o número só com dígitos, ex. `5551999999999`.
- Crie `NEXT_PUBLIC_CONTATO_EMAIL` com o e-mail de suporte.
- **Deployments → Redeploy** do último deploy de produção. Depois abra `seuciclo.com.br/contato` e veja se abre um canal.

## Parte 2 · E-mail de cadastro funcionando (cerca de 1 hora, grátis no começo)

Sem isto, ninguém de fora do time recebe o link de confirmação. O Supabase só entrega e-mail para membros da sua organização.

**4. Criar o envio por Resend.**
- resend.com → criar conta (plano grátis: 3.000 e-mails por mês).
- **Domains → Add Domain** → `seuciclo.com.br`. O Resend mostra 3 a 4 registros DNS (SPF, DKIM e um MX de retorno).
- No lugar onde o domínio é gerenciado (Registro.br ou Cloudflare), crie esses registros exatamente como aparecem. Clique em **Verify** no Resend. Pode levar de minutos a algumas horas.
- **API Keys → Create** com permissão "Sending access". Copie a chave (aparece uma vez).

**5. Ligar no Supabase.**
- Supabase → **Authentication → Emails → SMTP Settings** → ativar **Custom SMTP**.
- Host `smtp.resend.com`, porta `465`, usuário `resend`, senha = a chave do passo 4.
- Remetente: `nao-responda@seuciclo.com.br`, nome "CICLO".
- Salve. Depois em **Authentication → Rate Limits**, suba "emails por hora" (o padrão com SMTP próprio é baixo).
- **Teste:** cadastre um e-mail seu que **não** seja do time e veja se o link chega em menos de 1 minuto. Me avise se chegou.

## Parte 3 · Decisões (5 minutos, só responder)

Responda estas e eu sigo:
1. **Apple: conta de pessoa ou de empresa?** Pessoa sai mais rápido. Empresa precisa de CNPJ e número D-U-N-S e demora mais, mas o nome da empresa aparece como vendedor na loja.
2. **Como montar o app do iPhone sem Mac?** Recomendo **Codemagic** (grátis no começo, liga no GitHub). Ou você consegue acesso a um Mac?
3. **Nome do app:** "CICLO" está livre na App Store? Só dá para saber ao criar o app lá (passo 7). Se não estiver, uso "CICLO: agenda e retorno".
4. **Cadastro:** seguir com confirmação por e-mail (o que você vai deixar pronto na Parte 2)? É a recomendação.

## Parte 4 · Contas e dinheiro (aqui começa a gastar)

**6. Conta Google Play: US$ 25, uma vez.** play.google.com/console → criar conta de desenvolvedor, pagar, validar identidade (envia documento). Contas pessoais novas podem exigir um período de teste fechado antes de publicar. **Não verificado:** confira no Play Console antes de prometer prazo.

**7. Conta Apple Developer: US$ 99 por ano.** developer.apple.com/programs → entrar com o Apple ID → pagar. A aprovação da conta pode levar de horas a alguns dias. Depois, em appstoreconnect.com → **Apps → +** → novo app, nome CICLO, idioma português (Brasil), **Bundle ID `br.com.seuciclo.app`**. Esse ID é permanente depois da primeira publicação: só crie quando tiver certeza.

**8. Opcional, mas eu recomendo antes de ter cliente pagante:** a Vercel Hobby é só para uso não comercial (Pro: US$ 20 por mês) e o Supabase Free não tem backup (Pro: US$ 25 por mês). Com ficha de saúde guardada, ficar sem backup é risco sério. Não trava a loja.

## Parte 5 · Android: gerar a chave (15 min, no seu computador)

**9. Criar a chave de upload.** É o arquivo que prova que o app é seu. **Se perder, nunca mais atualiza o app.**
- Terminal na pasta `ciclo-loja\android`:
  `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
- Ele pergunta uma senha (anote) e dados (nome etc.).
- **Faça 2 cópias de `upload.jks` e da senha**: uma no gerenciador de senhas, outra num pen drive ou nuvem privada. O arquivo já está bloqueado no `.gitignore`; ele nunca sobe para o GitHub.
- Crie `android\keystore.properties` com 4 linhas: `storeFile=upload.jks`, `storePassword=...`, `keyAlias=upload`, `keyPassword=...`. Também fica fora do git.
- Me avise "chave feita". **EU** gero o pacote `.aab` assinado e conferimos.

## Parte 6 · iPhone (depende das partes 3 e 4)

**10. EU** configuro o Codemagic (ou o Mac) para gerar o app, assim que a conta Apple estiver aprovada. Você só precisa: criar uma chave de API no App Store Connect (**Users and Access → Integrations → App Store Connect API**) e colar no Codemagic, que eu abro e te guio na hora.

## Parte 7 · A conta do revisor (na véspera de cada envio)

Sem estes passos o revisor abre telas vazias e a Apple reprova.
1. `SEED_SENHA='uma-senha-nova' node scripts/seed-tenant-teste.mjs apple-review barber "Barbearia do Revisor" "revisor-apple@ciclo.app" avancado` (contra produção; **você** roda, eu não tenho acesso à chave de produção).
2. `node scripts/seed-demo-agenda-futura.mjs apple-review`
3. `node scripts/seed-demo-imagens.mjs apple-review`
4. Rode o Motor ou espere a rodada da noite, e **olhe**: "Recuperar" tem que mostrar pessoas, "Clientes" tem "sumido" e "fiel".
5. Entre no celular com a senha que vai na ficha e abra Hoje, Clientes, uma ficha e Agenda.

## Parte 8 · Testar no celular de verdade

Quando houver o primeiro app (TestFlight no iPhone, link de teste no Android), siga o roteiro da seção 6 de `11-rumo-a-app-store.md`. Os pontos que mais reprovam: aparecer a landing ou preço dentro do app; cadastro sem e-mail chegando; excluir conta; modo avião mostrando a tela "Não conseguimos abrir o CICLO". Me mande print de qualquer coisa estranha.

## Parte 9 · Enviar

- **Textos e imagens:** estão prontos em `13-material-de-envio-lojas.md` (ficha, privacidade, segurança dos dados, notas ao revisor). **EU** refaço as imagens de dia, com a conta do revisor já preparada, no tamanho que cada loja pede.
- **Ficha:** cole os textos, URL de privacidade `seuciclo.com.br/privacidade`, URL de suporte `seuciclo.com.br/contato`.
- **Questionários de privacidade:** responda como está no documento 13.
- **Enviar para revisão.** Apple costuma levar de 1 a 3 dias; o Google, de horas a alguns dias. Se reprovarem, me mande a mensagem exata e eu corrijo.

## Ordem curta

Hoje: 1, 2, 3 → depois 4, 5 → responder as decisões → 6, 7 → 9 → eu faço o resto → Parte 7 na véspera → testar → enviar.
