# Mapa de operadores (LGPD art. 39 e art. 33)

> **J2 do `docs/86`.** A fonte é a constante `src/core/legal/operadores.ts`, que `/privacidade` lê e uma
> guarda amarra ao código (`tests/unit/legal/operadores-cobrem-os-terceiros-do-codigo.test.ts`). Este
> documento é a mesma lista com o que o repositório **não** consegue dizer. Conferido contra o fonte em
> 03/10/2026. **Não é parecer jurídico.**

## Quem recebe dado, e o que o CÓDIGO manda

| Operador | Papel | O que recebe (lido do fonte) | Onde processa | Quando age |
|---|---|---|---|---|
| **Supabase** | banco, login, arquivos | todo dado cadastrado, isolado por negócio | Brasil (São Paulo, `sa-east-1`, `DECISOES.md:30`); empresa dos EUA | sempre |
| **Vercel** | hospedagem e funções | cada pedido (com o endereço de rede) e as respostas | funções em São Paulo (`vercel.json`, `gru1`); páginas públicas e estáticos de qualquer ponto da rede, empresa dos EUA | sempre |
| **Mercado Pago** | assinatura do plano | e-mail do dono, plano, id do negócio (`external_reference`); cartão só no ambiente deles | Brasil `[conferir]` | com `MERCADOPAGO_ACCESS_TOKEN` |
| **Meta (WhatsApp)** | lembretes e recuperação | telefone e campos do modelo aprovado | fora do Brasil | com as credenciais do WhatsApp |
| **Resend** | e-mail do sistema | e-mail, assunto e texto | fora do Brasil (EUA) | com `RESEND_API_KEY` |
| **Sentry** | avisar erro | o erro e a tela, com dado pessoal removido (`sendDefaultPii: false` + `redigirEventoSentry`) | fora do Brasil (Alemanha ou EUA, pela região da conta) | com `SENTRY_DSN` |
| **Notificação do navegador** | aviso no aparelho | endereço de entrega + aviso cifrado de ponta a ponta | fora do Brasil (Google, Apple ou Mozilla) | para quem ativou |
| hCaptcha | anti-robô na página pública | o teste resolvido | EUA | **desligado**: sem conta, sem chave, e a CSP não o libera |
| Google Gemini | assistente de IA | **nada**: nenhuma rota o instancia | — | **desligado**: o assistente é o Motor próprio |

**Não são operadores (conferido):** PostHog e Upstash têm variável no `.env.example` e **nenhuma linha
de código**; o agendador (GitHub Actions) só chama rotas de rotina; Google Maps, WhatsApp (`wa.me`),
Instagram e as caixas de e-mail são links que a pessoa abre com um clique.

## O que o navegador de quem usa o painel pode chamar

A CSP (`src/middleware.ts`) deixa o navegador falar apenas com o próprio CICLO, o Supabase e o
`*.ingest.sentry.io`/`*.ingest.de.sentry.io`. Imagens só do CICLO, de `data:`, `blob:` e do Supabase;
fonte, script e quadro só do CICLO. Por isso a política pode dizer, com prova: **sem Google Analytics,
sem pixel, sem fonte ou vídeo de terceiro.** A guarda confere que a CSP e os operadores declaram as
mesmas origens.

**Achado lateral:** se o hCaptcha for ligado um dia, a CSP vai bloqueá-lo (não lista a origem dele). Quem
ligar tem que acrescentar na CSP e passar `naPolitica` para `true`.

## O que SÓ o Eduardo vê (o repositório não mostra)

Conferir no painel de cada um e anotar aqui. Até lá, a política diz "só entra em ação quando está
ligado", e nunca afirma que está.

| Conferir | Onde | Por quê importa |
|---|---|---|
| **Região e plano do projeto Supabase de produção** | painel Supabase | a política diz "banco em São Paulo"; confirmar `sa-east-1` e o plano (o Free não faz backup) |
| **Vercel: plano, região das funções, retenção de log** | painel Vercel | Hobby é só uso pessoal e não comercial; o log do Hobby guarda 1 hora |
| **Mercado Pago está ligado em produção?** | variáveis da Vercel | muda "Como se paga" nos termos e em `/precos` (auditoria 27/09, B5) |
| **WhatsApp: credenciais existem?** | variáveis da Vercel | lembrete e recuperação automáticos só existem se sim |
| **Resend: conta, domínio verificado, região** | painel Resend | e o SMTP do Supabase Auth (cadastro em volume) |
| **Sentry: DSN existe? região da conta?** | painel Sentry | decide "Alemanha ou EUA" |
| **Contrato de proteção de dados de cada um aceito** | painel de cada fornecedor | o suporte a transferência internacional (cláusulas-padrão da ANPD, Res. 19/2024) é do fornecedor; o aceite é com a conta do Eduardo |

## Quando mudar

Terceiro novo no código: a guarda reprova até ele entrar em `operadores.ts` (ou na lista de links).
Operador que sai: tirar de lá, senão a guarda reprova por falta de rastro. Mudou a lista: a política muda
sozinha, e a data de `VERSOES_LEGAIS.privacidade` muda junto (quem edita o texto troca a data).
