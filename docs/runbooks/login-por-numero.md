> **Substituído em 22/10/2026 pelo `docs/119-login-whatsapp-twilio.md`** (Twilio Verify, só para número cadastrado). O roteiro abaixo, pela Meta e pelo hook `send_sms`, fica como histórico: com o Twilio Verify ligado no Supabase, o hook tem que ficar DESLIGADO.

# Runbook · ligar o login por número em produção (docs/110 L1)

O código está pronto e testado no banco local. Em produção ele fica **escondido atrás de um erro honesto** ("Não consegui mandar o código agora... entre com e-mail") até os quatro passos abaixo estarem feitos. Só o Vitor faz, porque são contas e painéis.

## 1. WhatsApp oficial (Meta)

1. Em [business.facebook.com](https://business.facebook.com), crie (ou use) o portfólio da empresa e um **app do tipo Business** com o produto **WhatsApp**.
2. Cadastre um **número só para o CICLO**. Não pode ser um número que já usa o WhatsApp comum no celular.
3. Crie um **modelo de mensagem** com:
   - categoria **Autenticação**;
   - nome `codigo_de_acesso` (ou outro, e aí ponha o nome em `WHATSAPP_TEMPLATE_CODIGO`);
   - idioma **Português (BR)**;
   - botão **Copiar código**.
   O texto da categoria Autenticação é fixo da Meta ("*{{1}}* é seu código de verificação..."). Espere a aprovação, que costuma sair em minutos.
4. Gere um **token de acesso permanente** de usuário do sistema, com `whatsapp_business_messaging`.

Anote: o ID do número (`WHATSAPP_PHONE_NUMBER_ID`), o token (`WHATSAPP_ACCESS_TOKEN`) e o segredo do app (`WHATSAPP_APP_SECRET`). São os mesmos três que destravam os lembretes automáticos.

## 2. Vercel (projeto do CICLO, ambiente Production)

| Variável | Valor |
| --- | --- |
| `WHATSAPP_PHONE_NUMBER_ID` | do passo 1 |
| `WHATSAPP_ACCESS_TOKEN` | do passo 1 |
| `WHATSAPP_APP_SECRET` | do passo 1 |
| `WHATSAPP_TEMPLATE_CODIGO` | `codigo_de_acesso`, ou o nome que você deu |
| `SEND_SMS_HOOK_SECRET` | o segredo gerado no passo 3 (começa com `v1,whsec_`) |

Depois, faça um novo deploy para as variáveis valerem.

## 3. Supabase (projeto `ciclo`, painel)

1. **Authentication → Hooks → Send SMS hook**: tipo **HTTPS**, URL `https://seuciclo.com.br/api/v1/auth/codigo/hook`. Clique em gerar segredo e copie para o `SEND_SMS_HOOK_SECRET` da Vercel.
2. **Authentication → Sign In / Providers → Phone**: ligue. Com o hook ligado, o provedor de SMS não é usado. Se o painel exigir um provedor, escolha qualquer um sem preencher credencial real.
3. **Authentication → Rate Limits**: confira se o limite de SMS por hora cabe no uso. Cada código é uma mensagem paga, então o limite também é teto de gasto.
4. **Aplicar a migration `0142_login_por_numero.sql`** junto com as outras da pilha, pelo processo de `publicar-a-branch-de-trabalho.md`. Ela é aditiva (troca o gatilho de perfil e cria uma função de leitura), então sobe **antes** do deploy do código.

## 4. Conferir

1. Abra `/entrar` no celular, digite nome e o seu WhatsApp e toque em **Mandar código**.
2. O código chega no WhatsApp do número do CICLO. Digite e entre.
3. Nos logs da Vercel não pode aparecer `codigo_de_acesso_nao_enviado`. Se aparecer, a mensagem de erro da Meta vem junto (modelo não aprovado, token vencido, número não registrado).

## Custo de referência

Mensagem de autenticação no Brasil: em torno de **R$ 0,035** cada (Dragapp e ChatMaxima, out/2026; conferir na tabela da Meta). Com o aparelho lembrado, cada pessoa gasta um código no primeiro acesso e quase nenhum depois.
