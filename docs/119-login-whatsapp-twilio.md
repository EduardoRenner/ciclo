# 119 · Login por código no WhatsApp, pelo Twilio Verify (22/10/2026)

Pedido: entrar com um código que chega no WhatsApp, enviado pelo Twilio Verify, **só para número que já tem cadastro**. Número desconhecido recebe a mesma resposta e nenhuma mensagem. Nada de mensagem automática ou de marketing para cliente.

Continua o `docs/110` (L1, que deixou o código pronto com a Meta) e respeita o `docs/114` L-03 (entrar é com número e senha; o código volta como segundo caminho quando o envio existir).

---

## 1. Como o login funciona hoje (antes deste PR)

| Peça | Onde | Estado |
| --- | --- | --- |
| Número + senha (principal) | `api/v1/auth/login`, `(auth)/entrar/formulario.tsx` | no ar. Conta nasce sem verificar o número (`enable_confirmations = false`, L-03) |
| Código pelo WhatsApp | `api/v1/auth/codigo` (pedir), `codigo/entrar` (conferir), `formulario-numero.tsx` | pronto e **fora da tela** (`ENTRAR_COM_CODIGO = false`) |
| Quem gera e confere o código | Supabase Auth (`signInWithOtp` / `verifyOtp`, phone) | local com provedor de mentira e números `test_otp` |
| Quem entregava | hook `send_sms` → `codigo/hook` → WhatsApp Cloud API da Meta | sem credencial da Meta |
| Limites | por IP (10/10 min pedir, 20/5 min conferir), por número (5/h pedir, 8/15 min conferir), `max_frequency = 30s` do Auth | no código |

Dois problemas para o pedido de hoje: o pedido de código mandava para **qualquer** número (`shouldCreateUser: true` criava a conta), e o envio dependia da Meta.

## 2. Decisão: phone OTP do Supabase com o Twilio Verify como provedor

**Escolhido:** o Supabase Auth continua gerando a sessão, e o provedor de telefone dele passa a ser o **Twilio Verify**, com o canal `whatsapp` pedido pelo app (`signInWithOtp({ phone, options: { channel: 'whatsapp' } })`).

Por que esse e não chamar a API do Twilio Verify direto do nosso servidor:

- **A sessão.** Quem abre sessão no CICLO é o Supabase Auth. Se o nosso servidor conferisse o código no Twilio, depois precisaria "fabricar" uma sessão do Supabase para um usuário de telefone, e não existe API para isso sem e-mail (o `generateLink` só serve para e-mail). Os contornos (senha temporária, JWT assinado à mão) são piores que o problema.
- **Expiração e tentativas de graça.** O Twilio Verify expira o código em **10 minutos** e aceita no máximo **5 conferências** por código; o Auth ainda tem `max_frequency` e o limite por IP de verificação. Somados aos nossos baldes, ninguém chuta um milhão de combinações.
- **Menos código nosso:** o hook `send_sms` e o envio pela Meta deixam de ser caminho do login. Ficam no repositório, desligados, caso a Meta volte (ver §6).

**O preço:** as chaves moram em dois lugares. O Supabase precisa delas para mandar e conferir; a Vercel precisa delas para o app saber que o envio está ligado (é o que acende a opção na tela e troca o canal para `whatsapp`). Mesmas três chaves nos dois painéis.

## 3. Regras do fluxo

1. **Só número cadastrado recebe código.** Antes de pedir ao Auth, o servidor chama `numero_tem_cadastro(telefone, hash)` (migration `0147`), que responde "sim" para:
   - conta do Auth com esse telefone (profissional que se cadastrou com número e senha);
   - perfil com esse telefone (conta antiga de e-mail que informou o WhatsApp);
   - cliente de algum negócio com o mesmo `phone_hash`, que não foi apagada nem anonimizada.
   A função é `security definer` e só a `service_role` executa (`revoke` de `anon`, `authenticated` e `public`, `grant` explícito para `service_role`). Ela só é chamada por `numeroTemCadastro` em `with-tenant.ts`.
2. **Resposta neutra.** `pedirCodigoDeAcesso` (`src/server/services/codigo-de-acesso.ts`) devolve `{ enviado: true }` nos dois casos, com:
   - os limites (IP e número) contados **antes** de olhar o cadastro, então o 429 também não diz nada;
   - falha do envio para número cadastrado virando a mesma resposta (o log `codigo_de_acesso_nao_enviado` acusa);
   - **piso de tempo de 1,5 s**: o envio pelo Twilio demora, a consulta não. Sem o piso, o relógio contaria o que o corpo esconde.
   A tela diz "Se o número tiver cadastro no CICLO, o código chega em instantes. Ele vale por 10 minutos."
3. **Cliente cadastrada sem conta.** Quem é só cliente de um negócio não tem usuário no Auth; o código cria a conta dela no primeiro acesso (`shouldCreateUser: true`, alcançável só depois do passo 1). Sem área da cliente ainda (L4), ela cai no mesmo destino de hoje para conta sem negócio.
4. **Nenhuma mensagem que a pessoa não pediu.** O único envio do fluxo é o código, disparado pela própria pessoa na tela de entrar. Nada de lembrete, aviso ou marketing por este canal.
5. **Limites:** por IP 10 pedidos/10 min e 20 conferências/5 min; por número 5 pedidos/h e 8 conferências/15 min; `max_frequency` de 30 s do Auth; 5 conferências por código e 10 min de validade no Twilio Verify.
6. **Modos** (`modoDoCodigo` em `src/server/auth/login-por-numero.ts`):
   - `twilio`: as três chaves no ambiente. Canal `whatsapp`.
   - `teste`: fora de produção, sem as chaves. Vai para o Auth **local**, que só tem o provedor de mentira do `config.toml`: nada sai da máquina. Os números de `[auth.sms.test_otp]` aceitam `123456`.
   - `desligado`: produção sem as chaves. A opção some da tela e a rota responde "não consegui mandar" para qualquer número, sem consultar nada.

## 4. Tela

- `/entrar` abre em **número e senha** (L-03). Abaixo, "Receber um código no WhatsApp" troca para o código; "Entrar com senha" volta.
- A tela do código pede só o número (o nome saiu: o código não cria conta de negócio nova). O número fica lembrado no aparelho.
- Copy sem supor gênero ("Que bom te ver de novo", "Se o número tiver cadastro"). Medida a 375 px, sem rolagem lateral.

## 5. Testes (só banco local)

- `tests/unit/server/codigo-de-acesso.test.ts`: cadastrado envia por `whatsapp`; desconhecido não envia; mesma resposta e mesmo tempo; falha de envio neutra; limite antes da consulta; modo de teste; modo desligado.
- `tests/unit/server/login-por-numero-disponivel.test.ts`: os três modos e a tela obedecendo.
- `tests/unit/design/login-por-numero-pede-codigo.test.ts` (guarda): a rota passa pelo serviço, o envio fica **dentro** do `if` do cadastro, o limite vem antes, um só retorno. Vista reprovando com mutação (envio fora do `if`, limite depois da consulta, consulta desligada).
- `tests/integration/codigo-so-para-cadastrado.test.ts`: a função `numero_tem_cadastro` no Postgres local (conta por número, perfil de e-mail, cliente, anonimizada, apagada, desconhecido) e `anon`/`authenticated` sem permissão.

## 6. Decisões tomadas no lugar do Vitor (padrão mais seguro)

| Pergunta | Decisão | Motivo |
| --- | --- | --- |
| Twilio direto ou pelo Supabase? | Pelo Supabase (provedor Twilio Verify) | §2: sessão sem gambiarra, expiração e tentativas do Verify |
| Código vira o login principal? | Não. Segundo caminho abaixo de número e senha | Mantém a decisão L-03 do Vitor |
| Cliente sem conta recebe código? | Sim, se está cadastrada em algum negócio e não foi apagada nem anonimizada | Pedido: "profissional ou cliente que já existe no banco" |
| Falha de envio aparece para a pessoa? | Não, resposta neutra; só o log | Mostrar a falha só para número cadastrado entrega quem tem cadastro |
| SMS de reserva se o WhatsApp falhar? | Não | Sem pedido; cada canal é gasto e fornecedor a mais |
| Hook da Meta | Fica no código, desligado | Volta se a Meta for ligada; com o Verify, o hook precisa ficar desligado no painel |
| `enable_confirmations` | Fica `false` | Ligar muda o cadastro com senha (L-03); fica para quando o Vitor quiser verificar no cadastro |

## 7. Pendências (fora deste PR)

- "Esqueci a senha" pelo código (hoje é com a equipe pelo WhatsApp do CICLO).
- Verificar o número no cadastro com senha (`enable_confirmations = true`) agora que o código pode sair.
- Envio real nunca foi visto: sem as chaves, só o modo de teste rodou.

---

## O que o Vitor configura (nesta ordem)

1. **Twilio, sender do WhatsApp:** no console do Twilio, registrar o número do CICLO como sender do WhatsApp (Messaging > Senders > WhatsApp senders). Isso pede ligar a conta do **Meta Business** e aprovar o nome de exibição. Depois, em **Verify > Services**, criar um serviço "CICLO", ligar o canal **WhatsApp** e escolher esse sender.
2. **As 3 chaves:** `TWILIO_ACCOUNT_SID` (começa com `AC`), `TWILIO_AUTH_TOKEN` e `TWILIO_VERIFY_SERVICE_SID` (começa com `VA`, o serviço do passo 1).
   - **Vercel** (projeto CICLO, Production): as três variáveis, depois um novo deploy.
   - **Supabase** (projeto CICLO, painel): Authentication > Sign In / Providers > Phone, ligar, provedor **Twilio Verify**, com as mesmas três (o "Message Service SID" é o `VA...`). Em Authentication > Hooks, deixar o **Send SMS hook desligado**.
3. **Migration:** aplicar a `0147_codigo_so_para_numero_cadastrado.sql` (aditiva, antes do deploy), pelo processo de sempre.
4. **Teste no seu número:** em `/entrar`, toque em "Receber um código no WhatsApp", digite o seu número (que já tem conta) e confira que o código chega e entra. Depois teste um número que não tem cadastro: a tela diz o mesmo e **nada** chega. Nos logs da Vercel não pode aparecer `codigo_de_acesso_nao_enviado`.
