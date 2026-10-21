# Meta (WhatsApp oficial) para quem nunca mexeu · passo a passo

Para: ligar o **login pelo número** (o código chega no WhatsApp) e, depois, os **lembretes automáticos**. Tempo: 1 a 2 horas, mais a espera da verificação da empresa (de horas a alguns dias). Guarde cada valor anotado num lugar seguro: **nunca mande em chat, e-mail ou print**.

## Antes de começar, tenha à mão
- Um **chip novo** (ou um número que **não** esteja em nenhum WhatsApp, nem no Business do celular). Esse vira "o WhatsApp do CICLO". Se o número estiver no WhatsApp de um celular, apague a conta do WhatsApp nele antes.
- CNPJ, nome da empresa, site (`seuciclo.com.br`), um documento da empresa (cartão CNPJ ou contrato social).
- Um cartão de crédito (cada código custa ~R$ 0,035).
- Login no Facebook pessoal (a Meta exige; ninguém vê).

## Parte 1 · Conta de negócios
1. Abra **business.facebook.com** no computador → **Criar conta** → nome da empresa, seu nome, e-mail da empresa → confirme o e-mail.
2. No menu da esquerda: **Configurações** (engrenagem) → **Informações da empresa** → preencha CNPJ, endereço, site.
3. **Central de segurança** → **Iniciar verificação** → envie o documento. Pode seguir os próximos passos enquanto espera.

## Parte 2 · O app
4. Abra **developers.facebook.com** → **Meus apps** → **Criar app**.
5. Tipo: **Outro** → **Empresa (Business)** → nome "CICLO" → escolha a conta de negócios da Parte 1 → **Criar**.
6. Na tela do app, em **Adicionar produtos**, ache **WhatsApp** → **Configurar**.

## Parte 3 · O número do CICLO
7. No menu do app: **WhatsApp → Configuração da API (API Setup)**.
8. **Adicionar número de telefone** → nome de exibição "CICLO" → categoria **Beleza, spa e salão** → digite o número do chip → receba o código por SMS ou ligação → confirme.
9. Anote o **ID do número de telefone** (Phone number ID) que aparece na tela. → é o `WHATSAPP_PHONE_NUMBER_ID`.

## Parte 4 · O modelo da mensagem do código
10. **business.facebook.com** → **Gerenciador do WhatsApp** → **Modelos de mensagem** → **Criar modelo**.
11. Categoria: **Autenticação**. Nome: `codigo_de_acesso`. Idioma: **Português (BR)**.
12. Entrega do código: **Copiar código** (botão "Copiar código"). Marque "adicionar aviso de segurança". → **Enviar**. Aprovação costuma sair em minutos.

## Parte 5 · O token (a "senha" do sistema)
13. **business.facebook.com** → **Configurações** → **Usuários → Usuários do sistema** → **Adicionar** → nome "ciclo-servidor", função **Administrador**.
14. Nele: **Atribuir ativos** → **Apps** → o app CICLO com **controle total**; **Contas do WhatsApp** → a conta com **controle total**.
15. **Gerar novo token** → app CICLO → validade **Nunca** → marque `whatsapp_business_messaging` e `whatsapp_business_management` → **Gerar**. Copie na hora (só aparece uma vez). → é o `WHATSAPP_ACCESS_TOKEN`.
16. **developers.facebook.com** → app CICLO → **Configurações do app → Básico** → **Chave secreta do app** → **Mostrar**. → é o `WHATSAPP_APP_SECRET`.

## Parte 6 · Pagamento
17. **Gerenciador do WhatsApp** → **Configurações da conta** → **Pagamentos** → adicione o cartão.

## Parte 7 · Supabase
18. **supabase.com** → projeto de produção do CICLO → **Authentication** → **Hooks** → **Send SMS hook** → **Ativar**.
19. Tipo **HTTPS**; URL `https://seuciclo.com.br/api/v1/auth/codigo/hook`; clique **Gerar segredo** e copie (começa com `v1,whsec_`). → é o `SEND_SMS_HOOK_SECRET`. **Salvar.**
20. **Authentication → Sign In / Providers → Phone** → **Ativar**. Se pedir um provedor de SMS, escolha qualquer um sem preencher (o hook manda no lugar dele).
21. **Authentication → Rate Limits** → "SMS por hora": 30 para começar (é também o teto de gasto).

## Parte 8 · Vercel
22. **vercel.com** → projeto do CICLO → **Settings → Environment Variables** → ambiente **Production** → adicione as cinco:
    `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_TEMPLATE_CODIGO` = `codigo_de_acesso`, `SEND_SMS_HOOK_SECRET`.
23. **Deployments** → no último → **⋯ → Redeploy**.

## Parte 9 · Testar
24. No celular: `seuciclo.com.br/entrar` → seu número → **Mandar código** → o código chega no WhatsApp, do número do CICLO → digite → entrou.
25. Não chegou? Vercel → **Logs** → procure `codigo_de_acesso_nao_enviado`; a frase da Meta ao lado diz o motivo (modelo não aprovado, token, número).

## Depois (lembretes automáticos)
Novo modelo, categoria **Utilidade**, nome `lembrete_de_horario`, texto com {{1}} serviço, {{2}} dia, {{3}} hora, botões "Confirmar" e "Remarcar". Aprovado, avise o loop: o código liga.
