# 110 · Um app, dois públicos: plano (20/10/2026)

Pedido do Vitor em 20/10/2026: funcionalidade para quem é **autônoma** e para quem é **dona de salão** administrar; login **só com número e nome**; e uma **versão da cliente** que não seja só agendamento, onde ela vê os lugares que frequenta e a conta dela. "Vai ser um app só para dois públicos."

Rótulos: **FATO** (lido no código, com caminho), **DECISÃO** (o que este plano escolhe), **PENDENTE DO VITOR** (só ele resolve).

---

## 0. Duas decisões antigas que este plano revoga, por escrito

O CICLO tem dois vetos registrados quando o Eduardo decidia, e os dois batem de frente com o pedido. Fica revogado aqui para não ficar contradição solta no repositório:

| Veto | Onde | O que muda |
| --- | --- | --- |
| "Não construir vitrine, diretório ou **app do cliente**. Veto permanente" | `docs/53-VANTAGEM-ZERO-A-UM-PLANO.md:538`, `docs/52:57`, `docs/CONTEXTO-CICLO-PARA-IA.md:24` | **Revogado em parte.** Passa a existir a **área da cliente**. Continua proibido **vitrine e diretório**: a cliente nunca vê negócio onde ela nunca foi atendida |
| Identidade da cliente **entre negócios** é proibida "salvo revogação explícita" | `docs/09-PLATAFORMA.md` §3.5 (:380-393) | **Revogado com limite.** A cliente, **depois de provar que o número é dela**, vê os negócios onde ela já tem histórico. O negócio nunca vê que ela frequenta outro |

**Por que o limite preserva o que o veto protegia (DECISÃO):** o medo do veto era o da queixa nº 1 do Booksy e da Trinks, a profissional mandar o link e a cliente esbarrar na concorrente no caminho. A área da cliente não tem busca, mapa, "perto de você" nem sugestão. Ela mostra **só os dados dela mesma**, que pela LGPD (art. 18, II) ela já tem direito de ver. A guarda `pagina-do-negocio-e-so-dele` continua de pé, e ganha uma irmã (§6).

**O que a home promete continua verdade:** "quem vai marcar não precisa baixar app nem criar conta" (`src/app/page.tsx:240`). A conta da cliente é **opcional**. Agendar pelo link segue sem login.

---

## 1. O que já existe (FATO, levantado no código em 20/10)

**Profissional:**
- entra com e-mail e senha (`src/app/api/v1/auth/login/route.ts`), Google/Apple se ligados no painel do Supabase, e segundo fator por aplicativo (TOTP);
- papéis `owner`, `manager`, `professional`, `reception`, `finance` (`supabase/migrations/0001_initial.sql:20`, `src/server/auth/rbac.ts`);
- **equipe já tem login próprio**: convite por e-mail com token de 7 dias (`src/server/services/convites.ts`, `(public)/convite/[token]`), e com `restrict_professional_view` cada uma vê só a própria agenda;
- o onboarding já pergunta "Só eu / Eu e mais gente" e liga ou desliga o módulo de equipe (`src/server/services/perfil-onboarding.ts:86-106`);
- **o convite depende de e-mail, e o envio de e-mail está desligado** (`RESEND_API_KEY` vazio): hoje a dona não consegue trazer a equipe sem copiar link à mão.

**Cliente:**
- marca com nome e telefone, sem conta (`src/server/services/public-booking.ts:467`); o cliente é achado ou criado por `(tenant_id, phone_hash)`;
- `clients` é **por negócio**: a mesma pessoa em dois salões são duas linhas;
- `clients.user_id` existe desde a 0001 com o comentário "se criou conta no app da cliente", e **nada escreve nele**;
- o `phone_hash` usa sal **global**, então o mesmo número tem o mesmo hash em todo negócio. É o que permite juntar as linhas da mesma pessoa sem guardar telefone em lugar novo;
- confirmar e cancelar vão por link assinado de 72 h; **remarcar não existe**;
- o reconhecimento depois de agendar vive no `localStorage`, um por negócio, 180 dias (`src/lib/reconhecimento-local.ts`).

**Telefone e WhatsApp:**
- login por telefone **não está ligado em lugar nenhum** (`supabase/config.toml`: `[auth.sms] enable_signup=false`, Twilio desligado);
- o código de envio pelo WhatsApp oficial existe (`src/server/providers/messaging/whatsapp.ts`), mas **sem credencial**. Hoje o canal real é o `wa.me` que a profissional toca.

**App:** o PWA abre em `/admin/hoje`, e o app nativo (Capacitor) é só da profissional (`src/middleware.ts:256-261` manda `/` e `/precos` para `/entrar`).

---

## 2. Login só com número e nome

### 2.1 O que não dá para fazer

Login **só** com número e nome, sem conferir nada, deixa qualquer pessoa que saiba o número de outra entrar na conta dela: a agenda inteira da profissional, ou o histórico de saúde da cliente (anamnese de cílios). **Não entra.**

### 2.2 O que entra (DECISÃO)

Para quem usa, continua sendo **número e nome**:

1. digita o número (e o nome, se for a primeira vez);
2. recebe um **código de 6 dígitos** no WhatsApp (ou SMS, se o WhatsApp falhar);
3. digita o código uma vez, e **o aparelho fica lembrado** (sessão longa com renovação; no app nativo, praticamente nunca mais pede).

É o mesmo jeito do iFood e do Nubank, que esse público já conhece.

### 2.3 Como, no Supabase

- **Login por telefone do próprio Supabase Auth** (`signInWithOtp({ phone })` e `verifyOtp`), com o **Send SMS Hook** apontando para uma rota nossa que manda o código pelo WhatsApp oficial (modelo de **autenticação**) e cai para SMS se falhar. Assim o código fica com o Supabase (expira, limita tentativa), e o canal fica com a gente.
- Alternativa sem código próprio: **Twilio Verify**, que o Supabase suporta direto com canal WhatsApp e SMS. Mais caro e mais um fornecedor.
- **Custo** (referência de terceiros, conferir na tabela da Meta): mensagem de autenticação no Brasil em torno de **R$ 0,035** ([Dragapp](https://www.dragapp.com/pt-br/blog/api-oficial-do-whatsapp/), [ChatMaxima](https://chatmaxima.com/pt-br/whatsapp-api-pricing/brazil/)). Com o aparelho lembrado, uma cliente gasta um código no primeiro acesso e quase nenhum depois.

### 2.4 Para a profissional

- O login por número vira o **jeito principal** no app nativo e na tela de entrar. E-mail e senha continuam existindo para quem já tem conta e para recuperação.
- Conta que já existe com e-mail ganha o telefone verificado no primeiro login por número, **se o número bater com o do perfil** (`profiles.phone`, preenchido no cadastro). Se não bater, pede o login antigo uma vez para ligar os dois.
- **O convite da equipe passa a ir por WhatsApp** (link `wa.me` com o convite, que a dona manda do próprio celular, como o "Chamar" do Recuperar). Isso destrava a equipe hoje, sem esperar o e-mail.

### 2.5 PENDENTE DO VITOR (bloqueia a fase L1 em produção, não o código)

1. **Conta do WhatsApp Business oficial (Meta)**, com um número só para o CICLO e um modelo de autenticação aprovado. É a mesma pendência que já trava os lembretes automáticos (`docs/108-norte/00-decisao.md` §6).
2. Ou, se quiser ir mais rápido, **conta Twilio** com Verify.
3. Ligar o login por telefone no painel do Supabase (Authentication, Providers, Phone) e cadastrar o hook.

Sem isso, o código fica pronto e testado no banco local, com o envio trocado por um registro no log, e **o login por número não aparece em produção** (mesma regra da casa: sem credencial, a função não finge que funcionou).

---

## 3. Um app, duas portas

**DECISÃO:** um app só (o mesmo site, o mesmo PWA, o mesmo app nativo). Depois do login, o número decide para onde a pessoa vai:

| O número verificado é de… | Abre em |
| --- | --- |
| alguém com acesso a um negócio (`memberships`) | o painel, como hoje (`/admin/hoje`) |
| só cliente | **a área da cliente** (`/minha-conta`) |
| os dois (a manicure que também faz cílios com outra profissional) | o painel, com uma troca "Ver como cliente" no menu |

A primeira tela do app deixa de ser "Entrar" e passa a ser **"Sou profissional / Sou cliente"**. Os dois caminhos levam ao mesmo número e código; a escolha só muda o texto e o que acontece se o número não tiver conta ainda (a profissional vai para o cadastro do negócio, a cliente entra direto).

---

## 4. Lado da profissional: autônoma e dona de salão

O CICLO já sabe a diferença por dentro (módulo `team`, papéis, plano). Falta **mostrar** a diferença.

### 4.1 Autônoma (trabalha sozinha)

- Sem nada de equipe na frente: nem "Time", nem comissão, nem "profissional" em seletor (hoje o item "Time" aparece sempre, `src/core/navegacao/atalhos-do-menu.ts`).
- O **Hoje** fala com ela: "suas clientes de hoje", "quem passou do dia da manutenção", "quanto entrou".
- **Autônoma que atende em salão de outra pessoa** (aluga cadeira): continua com a própria conta e a própria clientela. Não vira equipe de ninguém. É o caso mais comum em cílios e sobrancelha (`docs/concorrentes/beleza-feminina/05-relatorio.md` §3), e o produto não deve empurrá-la para dentro do salão de outra.

### 4.2 Dona de salão (com equipe)

- **Agenda por profissional** lado a lado no desktop e uma por vez no celular (já existe a agenda; muda o padrão para a dona).
- **Equipe por WhatsApp**: convidar, cada profissional entra com o próprio número (§2.4), vê só a própria agenda e as próprias clientes se a dona quiser (`restrict_professional_view`, já existe).
- **O dia de cada uma**: quanto cada profissional atendeu, comissão e o que falta pagar (comissão já existe; falta a tela do fechamento por pessoa na frente).
- **Recepção**: o papel `reception` já existe; ganha uma porta simples (agenda de todas, sem dinheiro).

### 4.3 Como escolher

No cadastro, a pergunta "Só eu / Eu e mais gente" (já existe) vira a primeira, com a palavra dela: **"Trabalho sozinha" / "Tenho salão com equipe"**. Dá para trocar depois em Configurações sem perder nada.

> Nota de copy: "sozinha" é a palavra do nicho e entra **só no rótulo da escolha**, com a alternativa sem gênero ao lado ("Trabalho por conta"). O resto do painel continua sem gênero (`docs/109-marca-feminina/00-pesquisa.md` §5).

---

## 5. Lado da cliente: `/minha-conta`

Tudo aqui é **só da própria cliente**, e só de negócio onde ela já foi atendida.

| Tela | O que tem | Existe hoje? |
| --- | --- | --- |
| **Início** | o próximo horário, com confirmar, cancelar e **remarcar**; e "sua manutenção de cílios vence em 4 dias", com um botão para marcar | confirmar e cancelar por link; remarcar **não** |
| **Meus lugares** | cada negócio onde ela tem histórico: nome, endereço, WhatsApp, a profissional preferida e "marcar de novo" (o mesmo serviço da última vez, num toque) | não |
| **Histórico** | o que fez, quando e com quem, por lugar | não |
| **Meus dados** | nome, aniversário, preferências; **baixar meus dados** e **pedir exclusão** (LGPD, já existe no painel e passa a existir para ela) | só pelo painel do negócio |
| **Avisos** | push do app e do navegador: lembrete, confirmação e "passou do dia" (o mesmo Motor de Ciclo, do lado dela) | push existe só para a profissional |

**O que a área da cliente NÃO tem, de propósito:** busca, mapa, "salões perto de você", avaliação pública, promoção de outro negócio. Se tiver, vira o Booksy, e a profissional para de mandar o link.

**O que o negócio vê:** nada novo. Ele não sabe que a cliente tem conta, nem onde mais ela vai.

**Dado de saúde** (anamnese de cílios, alergia): fica fora da área da cliente na primeira versão. Mostrar exige o consentimento já gravado e uma tela própria; entra numa fase depois.

---

## 6. Dados e segurança

### 6.1 Ligação conta ↔ cliente

- Ao verificar o número, o servidor procura `clients` com o mesmo `phone_hash`, não anonimizado nem apagado, em qualquer negócio, e grava `clients.user_id` (a coluna que existe e nunca foi escrita).
- Faz isso por uma função `SECURITY DEFINER` com `revoke execute from anon, authenticated` (regra da casa, `memory/ciclo`), chamada só pela rota de pós-login.
- Cliente nova que marca depois de já ter conta: o agendamento público liga o `user_id` na hora, se a sessão for de cliente com o mesmo número.

### 6.2 RLS nova (o ponto mais perigoso do plano)

- Políticas novas de **leitura** para a cliente: `clients` onde `user_id = auth.uid()`; `appointments` desses clientes; de `tenants`, só nome, slug, endereço e WhatsApp, por **view com `security_invoker`** (sem isso a view fura a RLS, armadilha conhecida).
- Escrita da cliente só pelas rotas `/api/v1/client/*` (remarcar, cancelar, dados), validadas com Zod, com `Idempotency-Key`.
- **Teste de isolamento novo**: cliente A não lê nada da cliente B; cliente não lê agendamento de outra pessoa no mesmo negócio; cliente não lê negócio onde não tem histórico; profissional não vê `user_id` de cliente de outro negócio.

### 6.3 Guardas novas

1. `area-da-cliente-nao-e-vitrine`: nenhuma consulta em `src/app/minha-conta/**` lê `tenants` sem passar pelo `user_id` da cliente; nenhum texto de busca, "perto", "descubra".
2. `login-por-numero-pede-codigo`: a rota de login por número nunca cria sessão sem `verifyOtp`.
3. As duas vistas reprovando antes de valer (CLAUDE.md, "teste-guarda").

### 6.4 LGPD

- A política de privacidade ganha um parágrafo: a cliente que cria conta vê o próprio histórico em cada negócio onde foi atendida.
- Os **termos da profissional** ganham a mesma frase (ela é a controladora do dado da cliente dela).
- Consentimento de criar conta gravado em `consents` (tipo `terms`), com a versão do texto.

---

## 7. Fases

Cada fase fecha com a suíte inteira verde (`typecheck`, `eslint`, `test:unit`, `test:rls` e `test:integration` no **banco local isolado por worktree**), e a tela vista no navegador a 375 px.

| Fase | Entrega | Depende de |
| --- | --- | --- |
| **L0** | Este plano, a revogação dos vetos registrada em `docs/DECISOES.md` | — |
| **L1** ✅ 20/10 | Login por número + código (Supabase phone auth, hook de envio pelo WhatsApp oficial, aparelho lembrado). Vitor escolheu a **Meta** (sem SMS de reserva). A porta "Sou profissional / Sou cliente" **foi para a L4**: sem a área da cliente pronta, ela levaria a uma tela que não existe | código: nada. **Produção: `docs/runbooks/login-por-numero.md`** |
| **L2** | Profissional: ligar conta de e-mail ao número; convite da equipe por WhatsApp; escolha "Trabalho sozinha / Tenho salão" no cadastro; menu sem "Time" para a autônoma | L1 |
| **L3** | Ligação `clients.user_id`, RLS da cliente, teste de isolamento | L1 |
| **L4** | `/minha-conta`: início, meus lugares, histórico, remarcar | L3 |
| **L5** | Meus dados (exportar, pedir exclusão) e avisos por push para a cliente; política e termos | L4 |
| **L6** | Dona de salão: fechamento por profissional, porta da recepção | L2 |

**Primeiro passo de código, se o Vitor aprovar:** L1 no banco local, com o envio trocado por log, e as guardas do §6.3 escritas e vistas reprovando.

---

## 8. Perguntas para o Vitor

1. **WhatsApp oficial (Meta) ou Twilio** para mandar o código? A Meta é mais barata e é a mesma conta que destrava os lembretes; a Twilio liga mais rápido.
2. **O app nativo continua com um nome só (CICLO)?** Com a cliente dentro, ele passa a ir para a loja como app das duas. A descrição da loja muda.
3. **O congelamento de funcionalidade do `docs/108-norte` (até 15/12) cai?** Este plano é funcionalidade nova grande. Se o piloto com as 10 a 20 profissionais continua, a ordem sugerida é L1 e L2 primeiro (servem ao piloto) e a cliente (L3 a L5) depois.
