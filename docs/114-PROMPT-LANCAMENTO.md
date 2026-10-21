# 114 · Prompt e plano do LANÇAMENTO do CICLO (21/10/2026)

Releia este arquivo, o `docs/113-PROMPT-PROXIMA-FASE.md` e o `docs/112-experiencia/_progresso.md` se o contexto for resumido. **Este documento passa na frente do 113:** o que estiver aberto no 113 e não estiver aqui continua depois do lançamento.

## O pedido do Vitor (21/10, manhã)

Lançar o app novo **hoje**. Antes de tudo, uma correção final. A logo ele refaz em paralelo (só o nome "CICLO"). Foco na experiência dos dois lados (profissional e cliente): simplicidade, facilidade, notificações. Decisões dele, já tomadas:

1. **Tudo grátis por enquanto.** Sai pagamento, plano e cobrança da tela; fica só o cadastro. O código de cobrança fica atrás de chave desligada (não apagar).
2. **Cadastro e entrada pelo número do WhatsApp, sem e-mail** (o código já existe: `docs/110` L1, migration `0142`, hook `send_sms`, runbook `docs/runbooks/login-por-numero.md`). Falta só a Meta e o Supabase (passos do Vitor, abaixo).
3. **Entrada clara: "Sou cliente" e "Sou profissional"**, e daí entrar ou cadastrar.
4. **Agendar online só com 1 dia de antecedência**; para hoje, o botão do WhatsApp da profissional ("Quer para hoje? Chame no WhatsApp"). (Interpretação do pedido; se ele quis dizer "o lembrete sai 1 dia antes com o botão do WhatsApp", as duas coisas cabem e as duas entram.)
5. **Recorrência para a cliente:** a cliente vê e marca o próximo horário do serviço que ela repete (manutenção a cada X dias) sem refazer tudo.
6. **Uma aba de busca como a do AppBarber:** a cliente procura serviço e profissional (por serviço, bairro/cidade), vê e marca.

## Ordem do dia

### F0 · congelar (agora)
- **Estado ao abrir o 114 (conferido pela sessão do loop às 8h45 de 21/10):** o ticket em andamento era o EXP-S10/K05 (o S11 já estava em `6682ba20`), fechado em `53d4b386`. Da Onda 1 ficam para depois do lançamento o S12 (masculino genérico no painel) e o A07; o S01 parte 2 (prints) é o L-08. Suíte do último commit: 4.549 unitários, 361 isolamento, 688/688 integração. O `next build` rodou às 7h58 e passou, antes do S11 e do S10: o F0 roda o `verify` inteiro de novo.
- Fechar o ticket em andamento e parar de abrir tickets da fila do 113.
- `pnpm verify` inteiro, **com o `next build`** (não rodou nas rodadas da noite).

### F1 · correção final (bloqueia o lançamento)
Revisão das duas jornadas no celular a 375 px, na branch, banco local, contas de salão (EXP-S02):
- **Profissional:** baixar/abrir → "Sou profissional" → cadastro pelo número → profissão → serviços prontos → horários → link público → primeira cliente → Hoje → Recuperar.
- **Cliente:** link do salão ou busca → serviço → dia (a partir de amanhã) → horário → número → confirmar → aviso → remarcar/cancelar → marcar a próxima.
- Cada tela: sem rolagem lateral, toque ≥ 48 px, nenhum texto com preço/plano/"grátis por X dias"/"assine", nenhuma promessa de canal que não existe (CLAUDE.md, "Prometer canal"), nenhum masculino genérico, erro que diz o que fazer.
- Saída: lista de bloqueios (consertar já) e de melhorias (depois do lançamento), no `docs/114-revisao.md`.

### F2 · o que o lançamento precisa (em ordem, um ticket por rodada)
1. **L-01 · Grátis:** esconder planos, preços, checkout, trial e "assine" atrás de `CICLO_COBRANCA` desligada; `/precos` vira "grátis no lançamento" ou sai do menu; nenhuma rota de pagamento acessível. Guarda: nenhuma tela pública cita valor de plano.
2. **L-02 · Entrada em duas portas:** tela inicial do app com "Sou cliente" / "Sou profissional"; cada uma leva ao entrar/cadastrar pelo número; e-mail fica como "outra forma de entrar" (para quem já tem conta).
3. **L-03 · Cadastro só com o número:** profissional cria a conta sem e-mail (nome + WhatsApp + código). Conferir que nada no caminho exige e-mail (convite, recuperação, notificações).
4. **L-04 · Antecedência mínima de 1 dia + botão do WhatsApp:** a agenda pública não oferece horários de hoje; no lugar, "Para hoje, chame no WhatsApp" com `wa.me` e mensagem pronta ("Oi, vi seu link no CICLO, tem horário hoje para [serviço]?"). A profissional pode mudar a antecedência nas configurações (padrão 1 dia).
5. **L-05 · Recorrência da cliente:** depois do atendimento, a cliente vê "Sua próxima manutenção: por volta de [data]" com "Marcar agora" (serviço e profissional já escolhidos); na área da cliente, "Marcar de novo" em cada serviço que ela repete.
6. **L-06 · Aba de busca:** a cliente procura por serviço (unha, cílios, sobrancelha, cabelo…) e cidade/bairro; lista profissionais com foto, serviço, preço "a partir de", próxima data livre; abre a página pública e marca. Só aparece quem ligou "aparecer na busca" (padrão ligado para quem tem link público e pelo menos 1 serviço e horários).
7. **L-07 · Avisos que funcionam no lançamento:** sem a Meta ligada, não prometer lembrete automático. O que há: aviso no aparelho (push) para a profissional; confirmação na tela e "Adicionar à minha agenda" para a cliente; lembrete do dia anterior com botão de WhatsApp **que a profissional toca** (um toque manda a mensagem pronta). Com a Meta ligada (passos abaixo), o lembrete sai sozinho no nível 3 do dial.
8. **L-08 · Primeira impressão:** a home e a página "Ver funcionando" abrem num salão (EXP-S01 parte 2: regerar os prints com a logo nova quando o Vitor mandar).

### F3 · logo (Vitor, em paralelo)
Quando a logo chegar (SVG): trocar em cabeçalho, favicon, ícones do app (192/512, maskable), imagem de compartilhamento (1200×630), splash do PWA, e-mails; regerar os prints. Guarda: nenhum arquivo da logo antiga referenciado.

### F4 · publicar (Vitor faz; o loop prepara e confere)
1. Empurrar a branch e abrir/atualizar o PR #155 (gera prévia na Vercel: conferir a prévia no celular antes).
2. Migrations em produção **na ordem**: 0142 e 0143 **antes** do código; 0144, 0145 e 0146 a qualquer hora.
3. Merge e deploy.
4. Ligar o login por número (passos da Meta e do Supabase abaixo).
5. O loop confere produção **só lendo**: as duas jornadas no celular, logs da Vercel sem erro.

## Passo a passo da Meta e do Supabase (login pelo número)

O código está pronto; em produção ele cai num erro honesto ("entre com e-mail") até isto ser feito. Detalhe no `docs/runbooks/login-por-numero.md`.

1. **Meta Business** (business.facebook.com): portfólio da empresa → **criar app do tipo Business** → adicionar o produto **WhatsApp**.
2. **Número do CICLO:** cadastrar um número **só para o CICLO** (que não esteja no WhatsApp comum de nenhum celular); verificar por SMS ou ligação.
3. **Verificar a empresa** no Meta Business (CNPJ e documentos): sem isso, o limite de mensagens é baixo.
4. **Modelo de mensagem:** categoria **Autenticação**, nome `codigo_de_acesso`, idioma **Português (BR)**, botão **Copiar código**. Aprovação costuma sair em minutos.
5. **Token permanente:** em Configurações do negócio → Usuários do sistema → criar usuário do sistema (Admin) → gerar token com `whatsapp_business_messaging` e `whatsapp_business_management`.
6. **Anotar:** ID do número (`WHATSAPP_PHONE_NUMBER_ID`), token (`WHATSAPP_ACCESS_TOKEN`), segredo do app (`WHATSAPP_APP_SECRET`).
7. **Forma de pagamento** na conta do WhatsApp (cada código ~R$ 0,035).
8. **Supabase** (projeto de produção) → Authentication → **Hooks → Send SMS hook**: HTTPS, `https://seuciclo.com.br/api/v1/auth/codigo/hook`, gerar o segredo.
9. **Supabase** → Authentication → **Providers → Phone**: ligar. **Rate limits**: conferir o limite de SMS por hora (é também o teto de gasto).
10. **Vercel** (Production): `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_TEMPLATE_CODIGO=codigo_de_acesso`, `SEND_SMS_HOOK_SECRET` (o do passo 8); novo deploy.
11. **Conferir:** `/entrar` no celular → número → o código chega no WhatsApp → entra. Nos logs, nenhum `codigo_de_acesso_nao_enviado`.

Os mesmos três valores da Meta destravam os lembretes automáticos (outro modelo, categoria Utilidade, "lembrete_de_horario", com botões Confirmar/Remarcar).

## Ideias para ficar perfeito (o loop faz as que não dependem do Vitor, depois de F2)
- **Instalar como app:** convite discreto "Pôr na tela de início" depois do primeiro agendamento (PWA), com ícone da logo nova.
- **Link do salão em 1 toque:** botão "Copiar meu link" e "Mandar no WhatsApp" no Hoje, e um QR para o balcão.
- **Primeiro dia guiado:** 3 passos visíveis (serviços, horários, link) com o progresso; some quando terminar.
- **Confirmação que acalma:** depois de marcar, a cliente vê data, hora, endereço com mapa, "Adicionar à agenda", "Falar no WhatsApp" e "Remarcar".
- **Faltas sem constrangimento:** a profissional marca falta em 1 toque; a cliente recebe "Quer remarcar?" (manual até a Meta).
- **Busca com distância:** "perto de mim" (com permissão) e filtro "tem horário amanhã".
- **Medir o lançamento:** quantas profissionais se cadastram, quantas publicam o link, quantos agendamentos por cliente, em quanto tempo o 1º agendamento.

## Como trabalhar (não muda)
- Um ticket por rodada, um commit por ticket (`feat(...): ... (L-0X)`), teste antes visto reprovando, guarda vista reprovando, `pnpm verify` **com build**, navegador a 375 px.
- **Nunca:** empurrar, deploy, produção, conta real, mensagem a pessoas, credencial. Decisão do Vitor = padrão atrás de chave, anotar e seguir.
- Registro de cada rodada no `docs/112-experiencia/_progresso.md`, seção "Lançamento".
