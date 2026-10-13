# Agente F · Público e primeiro dia (Fase 0)

Contrato: `docs/97-PROMPT-APRIMORAMENTO-GERAL.md` (A3, A5 "Copy e público", A6, A7, A8, B1 "Público"/"Entrada", B3 tarefas 13–15, Fase 3).
Ambiente: `docs/98-aprimoramento/medidas/AMBIENTE.md` — app em `http://localhost:3200` (build de produção), Supabase **local**, Mailpit em `127.0.0.1:54324`. Produção não foi tocada.
Data: 13/10/2026, de 01:30 a 02:50 (BRT).

**Método.** Playwright (`C:\temp\ciclo-medicao`) dirigindo o **Chrome do sistema** (`channel: 'chrome'`; o Chromium baixado pelo Playwright não abre nesta máquina: `spawn UNKNOWN`). Perfis de A6: celular 390×844, `hasTouch`, CPU 4× (`Emulation.setCPUThrottlingRate`) e rede 1,6 Mb/s + 150 ms (`Network.emulateNetworkConditions`); computador 1280×800 sem limitação. "Conteúdo útil" = do início da navegação até o elemento que responde à pergunta da tela ficar visível (seletor por página, no script). Públicas sem token: 5 cargas no celular e 3 no computador, mediana e pior. Tempos de fluxo são de **robô** (digita em milissegundos): servem para comparar telas e contar toques, não como tempo humano. Servidor e banco locais: TTFB ≈ 10–230 ms não representa produção (AMBIENTE.md item 11).

Scripts (todos em `docs/98-aprimoramento/medidas/`): `F-lib.mjs` (perfis, carga, SEO, axe, alvos), `F-publicas.mjs`, `F-agendar.mjs`, `F-corrida-dia.mjs`, `F-tokens.mjs`, `F-dados.mjs` / `F-dados-lista-espera.mjs` / `F-dados-desmarcar.mjs` (dados locais + tokens), `F-primeiro-dia.mjs`, `F-primeiros-cadastros.mjs`, `F-migracao.mjs`, `F-ja-atendo.mjs`, `F-gerar-csv.mjs`, `F-senha.mjs`, `F-explora*.mjs`. Resultados brutos em `medidas/F/*.json`; capturas em `capturas/F-*.png` (120 arquivos). Tokens e sessões ficaram fora do repositório (`C:\temp\ciclo-medicao\F-tokens.json`, `estado-F-*.json`).

---

## ACHADOS

| ID | Sev. | Página/passo | Problema | Evidência | Proposta |
|---|---|---|---|---|---|
| F-01 | **S0** | `/[slug]/agendar` (cliente final) | **O agendamento é gravado em outro dia (e às vezes com outro profissional) do que a tela mostra e confirma.** A resposta da busca de horários anterior (toque no serviço, dia de hoje) chega depois da do dia novo e sobrescreve a lista; a pessoa toca um horário de HOJE debaixo do cabeçalho "quinta-feira". O resumo e a tela de sucesso montam a data com `dia` (o dia tocado) e a hora com `slotEscolhido.startsAt` (o de hoje): ela lê "quinta-feira, 15 de outubro às 09:00" e o banco grava terça 13 às 09:00. | FATO. Reprodução natural no celular 4×/4G: **2 de 6** com 300 ms entre tocar o serviço e o dia (`medidas/F/corrida-dia-pausa300-atraso0.json`); 0 de 6 com 1 s localmente. Mecanismo provado segurando a 2ª consulta 2,5 s: **3 de 3** (`corrida-dia-pausa1000-atraso2500-espera3000.json`; captura `F-corrida-resumo-diverge-celular.png`: QUI 15 marcado, lista começando 09:45 = a de terça). Três agendamentos reais gravados no dia errado durante a medição (`appointments` `cce7078a…`, `6de7506c…`, `95886ec1…`: tela disse qui 15 / sáb 17 / dom 18, banco tem ter 13 09:00; o 3º com Vitória quando Bruna foi tocada). Código: `agendar.tsx:448-501` (`buscarDisponibilidade` sem descartar resposta velha; `setSlots` depois do `await`), resumo `:1202-1208`, sucesso `:703-710`. | (1) Só aceitar a resposta da consulta mais recente (contador de requisição ou `AbortController`), (2) zerar `slotEscolhido` também quando `slots` muda, (3) montar dia **e** hora a partir de `slotEscolhido.startsAt` no resumo e no sucesso, (4) teste com rede atrasada fora de ordem. [INFERÊNCIA] em produção (banco em outra máquina, latência maior e variável) a janela é maior que a medida aqui. |
| F-02 | **S1** | `/[slug]/agendar`, horário tomado por outra pessoa (409 `SLOT_TAKEN`) | A mensagem "Esse horário acabou de ser reservado. Escolha outro." é apagada no mesmo instante: `confirmar()` chama `setErro(...)` e logo `buscarDisponibilidade(dia)`, que faz `setErro(null)`. A pessoa toca Confirmar, o formulário some e a lista volta, **sem nenhuma explicação**. Também não há alternativas (o tipo prevê `details.alternatives`, a tela ignora). | FATO. `F-agendar.mjs celular … ocupado` com profissional fixo: concorrente reservou pela API (200), a tela recebeu 409 (console), `alertas: []`, texto final sem a frase (`medidas/F/agendar-ocupado-celular.json`, `capturas/F-agendar-ocupado-celular.png`). Código `agendar.tsx:634-637` + `:456`. | Manter o aviso depois de recarregar (não limpar o erro nessa recarga), mostrar 2–3 horários próximos ali mesmo e manter nome/telefone preenchidos. |
| F-03 | **S1** (S0 em produção se o mínimo do projeto for > 8) | `/cadastro` | Senha de 8–9 caracteres passa no app (`SENHA_MINIMA = 8`, `server/auth/password.ts`) e é **recusada pelo Supabase** (local: `minimum_password_length = 10`); a rota `api/v1/auth/signup` trata todo 4xx como "e-mail já existe" e responde sucesso. A tela diz "Quase lá! Mandamos um link…", **nenhuma conta é criada e nenhum e-mail sai**. | FATO local: tela "Quase lá!" (`capturas/F-cadastro-senha-fraca-celular.png`, `medidas/F/senha-e-entrar.json`), log do Auth `422 "Password should be at least 10 characters."` às 05:31:47Z, `auth.users` sem o e-mail `fraca-…`. Código `signup/route.ts:46-64`. Produção: [HIPÓTESE] — Como validar: painel Supabase → Auth → Password → tamanho mínimo; se for > 8, todo cadastro com 8–9 caracteres morre calado. | Igualar o piso do app ao do projeto **e** distinguir `weak_password`/`validation_failed` (devolver o motivo) do caso "e-mail já existe" (esse sim fica idêntico). |
| F-04 | **S1** | Conta nova → `/[slug]/agendar` sucesso | Conta recém-criada não tem telefone/WhatsApp público (o telefone do cadastro não é usado). A tela de sucesso diz "Se não tiver retorno em algumas horas, **é só chamar por telefone**." e não há telefone em lugar nenhum (a página do negócio não tem seção Contato). Fala em nome do negócio prometendo um canal que não existe. | FATO: `/limpeza-brilho-da-lu` sem "CONTATO" (comparar com `/demo-espaco-vitoria`, que tem); sucesso em `capturas/F-agendar-sucesso-conta-nova-computador.png`, `medidas/F/agendar-normal-computador-conta-nova.json`. Código `agendar.tsx:740-744`. | Sem canal: frase sem promessa ("quem vai te atender confirma por aqui ou pelo telefone que você deixou"). E pedir o WhatsApp do negócio no onboarding/perfil (ou usar o do cadastro com consentimento). |
| F-05 | **S1** | `/recuperar-senha` → link do e-mail | O link usa PKCE: o `code` só troca por sessão no **mesmo navegador** que pediu. Aberto em outro navegador (app de e-mail do celular abre no navegador embutido), cai em `/entrar?erro=link_invalido` — "Esse link não é mais válido. Peça um novo." — e o novo link vai falhar igual. A tela avisa "abra no mesmo aparelho", mas mesmo aparelho ≠ mesmo navegador. | FATO: outro contexto → `/entrar?erro=link_invalido`; mesmo contexto → `/nova-senha` e troca ok (`medidas/F/senha-e-entrar.json`, `capturas/F-recuperar-senha-outro-navegador-celular.png`). Cadastro em produção usa a mesma troca (`auth/callback/route.ts:29-33`): [HIPÓTESE] o e-mail é confirmado mas a pessoa lê "link não é mais válido". Como validar: cadastrar em produção e abrir o link no app do Gmail no iPhone. | Fluxo por `token_hash` + `verifyOtp` (não depende do navegador) para recuperação e confirmação; no erro de troca, dizer "seu e-mail foi confirmado, entre com sua senha" quando for o caso. |
| F-06 | S2 | `/nova-senha` | Senha nova curta → "Algo deu errado do nosso lado. Tente de novo em instantes." (erro 500 genérico); a pessoa repete a mesma senha para sempre. | FATO (`senha-e-entrar.json`, caso "nova-senha fraca"). | Validar com `exigirSenhaForte` antes e traduzir o 422 do Supabase. |
| F-07 | S2 | `/confirmar/[token]` | A página não diz **o quê** se confirma (dia, hora, serviço, negócio); token inválido/vencido mostra "Confirma seu horário? Vou sim / Preciso desmarcar" e só falha no toque; reabrir depois de confirmar pergunta de novo. Além disso o link só é gerado pelo cron `reminders`, que está fora do `schedule` — hoje a página não recebe tráfego. | FATO: textos em `medidas/F/tokens-celular.json` (confirmar-valido/vencido/escopo-errado, "reabertoMostra"); `lembretes.ts:137` é o único gerador; `cron.yml:196-253`. [INFERÊNCIA] sem lembrete agendado, ninguém chega aqui. | Carregar os dados do agendamento no servidor e mostrá-los; token ruim já abre no estado de erro; estado "já confirmado". |
| F-08 | S2 | `/lista-espera/[token]` | Reabrir o link depois de garantir mostra "Não consegui reservar · Esse encaixe já foi usado." para a própria pessoa que garantiu. O sucesso não diz dia/hora. | FATO (`tokens-celular.json` lista-espera-valido "reabertoMostra"; `tokens-computador-…json`). | Distinguir "usado por você" (mostrar o horário) de "usado por outra pessoa". |
| F-09 | S2 | `/admin/clientes/importar` (planilha de 300) | (a) Telefone inválido descarta a pessoa inteira: 7 de 300 sumiram por "1234"; (b) duplicata sem telefone entra duas vezes (5 duplicadas, 4 puladas); (c) data americana aceita **com data errada**: `10/3/26` (3 out) virou 10/03/2026, `8/3/26` virou 08/03 — o aviso só olha 10 linhas; (d) o serviço do Motor vem preso no 1º da lista ("Barba · 14 dias") e **266 de 273 (97%)** saem como "já passaram da hora de voltar", R$ 1.759,80 — número inflado no primeiro contato; `ja-atendo` usa outro padrão ("Corte · 21 dias"). | FATO: `medidas/F/migracao-barbearia.json`, `capturas/F-migracao-importar-resultado-barbearia.png`, consulta de `last_visit_at` dos 5 clientes de data americana. Planilha fictícia em `C:\temp\ciclo-medicao\F-clientes-300.csv` (`F-gerar-csv.mjs`). | Importar sem o telefone e avisar; detectar formato de data pela coluna inteira; não pré-escolher serviço (ou escolher o de ciclo mais longo/o mais usado) e mostrar "com X dias de ritmo" antes de importar. |
| F-10 | S2 | `/admin/hoje` depois de importar | Dois números concorrentes na mesma tela: "266 clientes para chamar de volta" e "261 clientes estão sumindo"; "R$ 1.759,80" e "R$ 1.759,80 de lucro" iguais em Recuperar. | FATO (`migracao-barbearia.json` → depois). [HIPÓTESE] critérios diferentes (atrasado vs. sumindo) e lucro sem custo de material; Como validar: Agente C/E conferem as fontes. | Um número por pergunta, com o critério escrito. |
| F-11 | S2 | `/onboarding/perfil` → painel | Respostas não mudam o primeiro dia: "Estou começando agora, ainda não tenho" + "Só eu" cai no mesmo Hoje que a barbearia com base, com "Traga quem você já atende — escreva os nomes…". O `docs/83` §5.3 manda "começando agora" para "Mande seu link de agendamento". | FATO: `medidas/F/primeiro-dia-faxina.json` vs `primeiro-dia-barbearia.json` (blocos "PRIMEIROS PASSOS" idênticos); `product_events.perfil_respondido` gravado com `base_em: comecando_agora`. | Primeiros passos por resposta: começando agora → "copie seu link" + "confira seus horários". |
| F-12 | S2 | `/admin/agenda/novo` (1º agendamento) | Depois de salvar volta para a agenda de **hoje** ("Nada marcado nesse dia") — o horário criado (amanhã) não aparece. Conflito com o próprio horário: "Esse horário acabou de ser reservado." sem alternativas (CLAUDE.md pede 409 com alternativas). Data/hora é um `datetime-local` vazio: nada de horários livres sugeridos. | FATO: `medidas/F/primeiros-cadastros-barbearia.json`, `capturas/F-primeiro-agendamento*-barbearia.png`. | Voltar para o dia do agendamento com ele destacado; oferecer horários livres; erro com 2–3 alternativas. |
| F-13 | S2 | `/admin/agenda/novo` | "Repetir é do Solo" (oferta de plano) aparece para barbearia com cortesia do plano **Equipe**; o motivo real é eixo da profissão (`ritmo = avulso` → `recurrence` "fora_do_eixo"): assinar não libera. | [INFERÊNCIA] `agenda/novo/page.tsx:37-38` usa `menorPlanoCom` para qualquer estado ≠ liberado + `planos.ts:388` (`recurrence` exige ritmo recorrente/sazonal) + banco (`tenants.ritmo = avulso`, evento `cortesia_concedida plano equipe`). | Texto por estado (`fora_do_eixo` ≠ `bloqueado_pelo_plano`); para barbearia, avaliar liberar repetição (cliente fixo semanal existe). |
| F-14 | S2 | Metadados das públicas | `/[slug]/agendar` promete "Sem ligar, **sem esperar resposta**" mas o pedido nasce pendente e o sucesso diz "a confirmação vem… pode não ser na hora". Entrar/cadastro/recuperar/404/páginas de token usam a descrição padrão "Gestão para **profissionais da beleza**: agenda, **Motor de Ciclo**…" (público é qualquer profissão; jargão). Links de token (confirmar/avaliar/orçamento/lista) saem com "· CICLO" e sem nome do negócio na prévia do WhatsApp; sem `noindex` e fora do `robots.txt`. `/precos`, `/calculadora`, `/links`, `/[slug]/agendar` sem `og:image`. | FATO: `medidas/F/publicas-*.json` (campo `seo`), `tokens-*.json`, `curl /robots.txt`. Código `agendar/page.tsx:25`. | Descrição honesta ("escolha o horário; quem atende confirma"); descrição por página; `noindex` nas de token; nome do negócio no título das de token. |
| F-15 | S2 | Copy pública (fala em nome do negócio) | Supõe gênero/artigo: "Agende seu horário **na** Espaço Vitória", "A equipe **da** Espaço Vitória agradece", "Super recomendo **a** {negócio}", "**Ela** agenda o primeiro horário" (indicação), "Como foi **seu** Progressiva / **seu** Extensão de cílios?", "Cadastre **suas clientes**" (painel da barbearia). | FATO: textos em `tokens-celular.json` (avaliar), `publicas-*.json` (description), `primeiro-dia-barbearia.json` (recuperar). Código `avaliar.tsx:121,129,139,161`, `[slug]/page.tsx:17`, `agendar/page.tsx:25`. | Frases sem artigo/gênero: "Agende seu horário em {negócio}", "Obrigado de {negócio}" → "{negócio} agradece", "Como foi o atendimento: {serviço}?", "quem você indicar agenda…". |
| F-16 | S3 | Alvos de toque | `/onboarding/perfil`: "Pular tudo e ir pro painel" 132×16 e "Pular esta pergunta" 103×16; `/admin/clientes` vazio: "Traga quem você já atende" 201×34 e "Importe uma planilha" 130×15; `/termos`: links 167×17 e 126×17. | FATO (`alvosPequenos` em `primeiro-dia-*.json`, `publicas-*.json`). | `min-h-12`/`toque-48` onde não divide linha. |
| F-17 | S3 | `/precos`, `/calculadora` | axe `link-name`: link do logo para "/" sem nome acessível. Todas as outras públicas e as de token: 0 violações axe (WCAG 2.0/2.1 A/AA). | FATO (`publicas-celular.json`). | `aria-label="CICLO, início"`. |
| F-18 | S3 | Erro das páginas de token | "Chame quem vai te atender pelo WhatsApp: por lá dá para resolver na hora." sem botão nem número, mesmo quando o negócio é conhecido (orçamento vencido sabe o nome; lista de espera sabe o tenant); em `/avaliar` "vai te atender" depois do atendimento. | FATO (`tokens-*.json`). `erro-publico.tsx:72-73`. | Quando houver tenant, botão para o canal dele; tempo verbal por página. |
| F-19 | S3 | `/[slug]/agendar` sem conexão | Mensagem boa, mas "Se o horário já tiver sido marcado, ele **aparece** ao escolher o dia outra vez" — o marcado **some** da lista. Depois da falha instantânea o botão destrava em < 80 ms e o 2º toque reenviou (2 POST, ambos falharam; sem duplicata). | FATO (`agendar-offline-celular.json`). Nessa mesma rodada a lista mostrada para "segunda 19" (dia fechado) era a de hoje — outra ocorrência natural de F-01. | Corrigir a frase; manter o botão travado ~1 s depois de falha de rede. |
| F-20 | S3 | Página pública de conta nova | "Quem atende: Dono faxina Agente F" — o nome completo do cadastro vira público sem perguntar; campo "Onde vai ser (opcional)" aparece até em negócio `no_local` (salão). | FATO (`F-explora` em `/limpeza-brilho-da-lu`; captura `F-agendar-formulario-celular.png`). | Perguntar o nome de exibição; mostrar "Onde vai ser" só em `vai_ate`. |
| F-21 | S2 | `/admin/clientes` com 295 | 6,6 s até o título no celular 4× (Hoje e Recuperar com a mesma base: 2,2 s). | FATO, medida única (`migracao-barbearia.json`). Encaminhar ao Agente B. | — |
| F-22 | S3 | Agenda (painel) | Mesmo telefone com outro nome agenda para o cliente existente sem avisar ("Domingo Agente F" virou "Cliente Primeira Agente F"). | FATO (consulta em `appointments` do tenant `barbearia-do-agente-f`). | Mostrar "já é cliente: {nome}" antes de confirmar. |
| F-23 | S3 | `/avaliar/[token]`, `/orcamento/[token]` | Conteúdo útil 2,0–3,4 s no celular (busca no cliente depois de hidratar, tela "Carregando…") contra 0,5 s de `/confirmar`. | FATO (`tokens-celular.json`, `utilMs`). | Ler no servidor (como `/[slug]`). |
| F-24 | S3 | Slug inexistente (404) | Título só "CICLO", 2,6 s até o h1 no celular, "Voltar ao início" leva a cliente do salão para a landing do CICLO. | FATO (`publicas-celular.json`). | Texto para quem procurava um negócio ("confira o link com quem te mandou"). |
| F-25 | S2 | Termos/privacidade/vindo-de-outro-sistema | Sem `NEXT_PUBLIC_CONTATO_*`, o canal de contato vira "responda o e-mail que você recebeu ao criar a conta" (é o e-mail do Supabase Auth) e "Me manda que eu faço" fica sem botão. | [HIPÓTESE] Como validar: conferir as duas variáveis no Vercel e o remetente/reply-to do SMTP de produção. Código `termos/page.tsx:345-351`, `lib/contato.ts:45-47`. | Pré-requisito de lançamento (já dito no `.env.example`). |
| F-26 | S3 | `/admin/recuperar` vazio | Conta vazia já recebe "6 serviços estão sem o custo do material, então a ordem da lista pode estar errada" — aviso sobre lista que não existe. Importados contam como "295 cadastros esse mês". | FATO (`primeiro-dia-*.json`, `migracao-barbearia.json`). | Esconder o aviso sem clientes; separar importados de novos. |

**O que está bom (medido, não suposto):** 0 violação axe em 12 de 14 públicas; 0 rolagem lateral em todas (390 e 1280); CLS ≤ 0,013; duplo toque em "Confirmar agendamento" não grava duas vezes (botão `disabled` + `aria-busy` em < 80 ms, 1 POST); confirmar/desmarcar/avaliar/aprovar respondem em 0,36–0,59 s; erro de rede em `/confirmar` oferece "Tentar de novo"; importador lê Windows-1252 e `dd/mm/aaaa` (0 caractere quebrado em 300 nomes acentuados) e explica o `.xlsx`; "Quem você já atende" põe 10 pessoas no Motor em 6 toques; entrar com senha errada mantém o e-mail e não revela se a conta existe.

---

## Primeiro dia do dono (celular 4×CPU / 4G lenta; robô)

| Passo | Tempo (robô) | Toques | Campos | Problema |
|---|---|---|---|---|
| `/cadastro` abre | 0,6 s | — | — | — |
| Preencher e criar conta | 7,5 s | 5 | 4 (nome, e-mail, telefone, senha) | F-03 (senha 8–9 → "Quase lá" falso). Login social pronto e desligado (`DECISOES` 13/09). |
| E-mail de confirmação | **não medido** | (abrir app de e-mail + 1 toque) | — | Local tem `enable_confirmations = false` (Mailpit: 0 mensagens; sessão já criada). F-05 indica o risco do link em outro navegador. |
| `/onboarding` abre | 1,0 s | — | — | Na 1ª rodada o script saiu antes da resposta do cadastro e precisou entrar de novo (+3 toques, 2 campos). |
| 3 respostas (nome, profissão por busca, endereço) | 3,8–5,9 s | 4 | 2 | Endereço sugerido sozinho (`barbearia-do-agente-f`); busca "diarista" achou "Faxina e diarista". Sem pergunta de WhatsApp do negócio (F-04). |
| "Do seu jeito" (perfil) | 2,4–2,8 s | 3–4 | 0 | Botões "Pular" de 16 px (F-16); respostas não mudam o Hoje (F-11). Barbearia/AppBarber → `vindo-de-outro-sistema`; "começando agora" → Hoje. |
| **Até o painel** | **15,8 s (faxina) · 23,7 s (barbearia, com re-login)** | **12 · 16** | **6 · 8** | [HIPÓTESE] humano: 2–4 min com o e-mail. Como medir: 5 pessoas reais, cronômetro. |
| Conta vazia: Hoje | 1,3–1,7 s | — | — | "Primeiros passos" claro (3 cartões com ação). Igual para todo perfil (F-11). |
| Conta vazia: Serviços | 1,4–1,6 s | — | — | Catálogo pré-preenchido (6 barbearia, 4 faxina) com preço, duração e ritmo — bom. |
| Conta vazia: Clientes / Agenda / Recuperar | 1,3–2,4 s | — | — | Vazios explicam e convidam; Recuperar avisa custo de material sem cliente (F-26); "suas clientes" (F-15). |
| 1º serviço | 1,9 s tela + 1,7 s | 5 | 3 de 11 no form | Form de 11 campos (preparo, limpeza, sinal, foto…) — 8 podiam ir para "mais opções". |
| 1º profissional | 1,2 s + 1,2 s | 3 | 1 | Ok. |
| 1º cliente | 1,5 s + 1,5 s | 3 | 2 de 7 | Ok; abre a ficha depois de salvar. |
| 1º agendamento (painel) | 1,3 s + 2,0 s | 8 (serviço, profissional, nome, telefone, data/hora ≈ 3 no seletor nativo, confirmar) | 3 | Volta para hoje e não mostra o criado (F-12); "Repetir é do Solo" (F-13); sem sugestão de horário livre. |
| 1º agendamento pela página (cliente final) | 1,9 s (computador) · 8,8–11,9 s (celular) | 6–7 | 2 | F-01, F-02, F-04. |

Duas verticais testadas: **Barbearia** (`barber`, `no_local/fixo/direto/avulso`, perfil "outro sistema → AppBarber, Eu e mais gente, Cliente que some") e **Faxina e diarista** (`vai_ate/diaria/direto/recorrente`, perfil "começando agora, Só eu, quanto sobra"). Vocabulário: catálogo e ritmo mudam por vertical; o Hoje e os textos de "Primeiros passos" são idênticos.

## Migração (barbearia, celular 4×)

| Passo | Tempo | Toques | Resultado |
|---|---|---|---|
| `vindo-de-outro-sistema` | — | — | Mensagem pronta para o suporte antigo, 3 saídas, "O que muda por aqui": feito (`docs/83` P2/P6). |
| Subir `.xlsx` | < 1 s | 2 | Recusa com instrução de 2 caminhos (Excel, Google Planilhas). |
| CSV 300 (Excel BR) → prévia | 0,3 s | 2 | Mapeamento automático certo nas 4 colunas. |
| Importar | 1,8 s | 1 | 294 importados, 4 duplicatas, 7 erros, 3 datas ilegíveis, 266 "passaram da hora" (F-09). |
| Recuperar / Hoje logo depois | 2,2 s | — | Lista cheia no mesmo minuto (o argumento do `docs/83` §7) — mas inflada (F-09d, F-10). |
| "Quem você já atende", colar 10 nomes | 3,5 s | 6 | "10 pessoas já estão atrasadas para voltar" (faxina, "Um mês", ritmo 7 d). |

**Custo de trazer 300 clientes:** 5 toques e ≈ 2 s de máquina quando a planilha já está em CSV; [HIPÓTESE] o custo real está fora da tela: pedir a exportação ao sistema antigo e salvar como CSV.

---

## Páginas públicas

Celular = 390×844, CPU 4×, 1,6 Mb/s/150 ms, 5 cargas; computador = 1280×800, 3 cargas. "Útil" mediana/pior em ms. JS = bytes transferidos (mediana). axe = violações WCAG A/AA.

| Página | Útil celular | Útil comp. | LCP cel. | CLS pior | JS KB | axe | Toques p/ concluir | Fala pelo negócio / canal prometido | SEO |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 546/574 | 736/788 | 1312 | 0 | 148 | 0 | 1 (criar conta) | — | ok (title, description, og:image) |
| `/precos` | 490/528 | 899/922 | 1104 | 0,013 | 148 | link-name | — | "fala com a gente" depende de env (F-25) | sem og:image |
| `/calculadora` | 462/518 | 631/644 | 1000 | 0 | 151 | link-name | 3 números | — | sem og:image |
| `/links` | 472/637 | 545/694 | 1056 | 0,001 | 148 | 0 | 1 | — | sem og:image |
| `/demo-espaco-vitoria` | 580/989 | 684/725 | 1164 | 0,001 | 149 | 0 | 1 (Agendar) | telefone visível | noindex (demo) ok; "na Espaço" (F-15) |
| `/demo-dom-estilo` | 490/585 | 685/722 | 1076 | 0,001 | 149 | 0 | 1 | idem | idem |
| `/[slug]/agendar` | 1089/1230 | 796/1005 | 1104 | 0,001 | 162 | 0 | 7 + 2 campos (≈ 9–12 s robô) | F-04 (sem telefone em conta nova) | "sem esperar resposta" falso (F-14); demo sem noindex |
| `/[slug]/orcamento` | 404 | 404 | — | — | — | — | — | Só existe com serviço "sob orçamento"; nenhum catálogo traz um, nem eletricista/encanador [INFERÊNCIA: `services.pricing_model` só existe em `services`] | — |
| `/confirmar/[token]` | 478 | 496 | — | — | — | 0 | 1 (0,52 s até "Prontinho!") | não diz o quê (F-07); link nunca enviado | descrição padrão, sem noindex |
| `/avaliar/[token]` | 2337 | — | — | — | — | 0 | 2 (0,59 s) | "Ela agenda…", "da Espaço" (F-15) | idem |
| `/orcamento/[token]` | 3350 | — | — | — | — | 0 | 1 (0,36 s) | "já foi avisado" = push só se houver inscrição [INFERÊNCIA `mensageria.ts:202-222`] | idem |
| `/lista-espera/[token]` | 3114 | 787 | — | — | — | 0 | 0 (abre e já reserva) | reabrir = erro (F-08) | idem |
| `/termos` | 647/1161 | 506/665 | 1152 | 0 | 147 | 0 | — | F-25 | ok |
| `/privacidade` | 640/742 | 454/470 | 1208 | 0,003 | 147 | 0 | — | F-25 | ok |
| `/entrar` | 504/593 | 317/352 | 1328 | 0 | 153 | 0 | 3 + 2 campos | — | descrição padrão (F-14) |
| `/cadastro` | 573/648 | 353/399 | 1316 | 0 | 154 | 0 | 5 + 4 campos | — | idem |
| `/recuperar-senha` | 505/609 | 337/358 | 1316 | 0 | 151 | 0 | 2 + 1 campo | e-mail (local: chegou no Mailpit) | idem |
| `/nova-senha` sem sessão | 754/924 | 502/564 | 1508 | 0 | 151 | 0 | — | redireciona com "eles expiram e só funcionam no aparelho em que você pediu" | — |
| slug inexistente (404) | 2625/2835 | 611/619 | 2452 | 0 | 149 | 0 | — | F-24 | title "CICLO", noindex |

Estados de erro medidos: token vencido (4 páginas), escopo trocado, sem conexão (agendar, confirmar), horário ocupado (agendar, painel), orçamento com data vencida, encaixe já usado, `.xlsx`, senha fraca (cadastro e nova senha), senha errada, e-mail inexistente. Tudo em `medidas/F/*.json`.

---

## Comparação com os planos

**`docs/83` (onboarding e migração)**

| Item | Estado | Evidência |
|---|---|---|
| P0 BL-51 (data BR, Windows-1252, aviso de data) | **Feito** | 0 nome quebrado; `dd/mm/aaaa` lido; aviso de datas na prévia e no resultado. Falta: data americana passa errada (F-09c). |
| P1 tela "do seu jeito" + Pergunta 1 + roteamento + eventos | **Feito** | `onboarding/perfil`; `perfil_respondido` com `base_em/sistema/tamanho/dor`. |
| §5.3 "começando agora → Mande seu link" | **Falta** | Vai para o Hoje genérico (F-11). |
| P2 "Vindo de outro sistema" (mensagem pronta, 3 saídas) | **Feito** | Tela medida. "Me manda que eu faço" depende de env (F-25). Benefício "1 mês do Essencial" para quem importa com data: **não encontrado** na tela [NÃO ENCONTRADO — busca: texto da tela e do resultado da importação]. |
| P3 "Baixar todos os meus clientes em planilha" | **Feito** | Botão em `/admin/clientes`. |
| P4 aceitar `.xlsx` | **Parcial** | Recusa com instrução. |
| P5 perguntas 2 e 3 com efeito | **Parcial** | Perguntas existem; efeito no Hoje não visível na conta vazia; "Só eu" → telas de equipe continuam acessíveis por Config [NÃO VERIFICADO no menu]. |
| P6 "O que muda por aqui" | **Feito** | Na tela "vindo de outro sistema". |
| Contact Picker | **Não feito** (esperado) | Há código de "escolher dos contatos" em `ja-atendo` (`formulario.tsx:337`), mas o botão não apareceu na tela medida (Chrome com emulação de celular) — [NÃO VERIFICADO] num Android real. |

**`docs/38` (conversão da home)**

| Peça | Estado | Evidência |
|---|---|---|
| 1 Header sem "Preços" | **Feito** | Só "Entrar" (`capturas/F-landing-celular.png`). |
| 2 Prova de produto na 1ª dobra | **Falta** | 1ª dobra = H1, subtítulo, 2 CTAs, link da calculadora; nenhuma lista/print do produto em toda a home (texto em `medidas/textos/page.json` e captura). |
| 5 "Feito para" com as 17 agrupadas | **Feito** | 4 grupos, 17 itens. |
| 6 Fecho "sem cartão" | **Feito** | "Comece sem cartão". |
| 3, 4, 7, 8 (subtítulo, card 1, FAQ, H1 de `/precos`) | [NÃO VERIFICADO] | Motivo: exige comparar com as variantes do `docs/20` §D, não lido nesta rodada. Quem destrava: Agente D (copy). |

---

## EVIDÊNCIAS

- Medidas brutas: `docs/98-aprimoramento/medidas/F/` — `publicas-celular.json`, `publicas-computador.json`, `agendar-*.json`, `corrida-dia-*.json`, `tokens-celular.json`, `tokens-computador-*.json`, `tokens-celular-parcial-avaliar-lista.json` (1ª rodada), `primeiro-dia-barbearia.json`, `primeiro-dia-faxina.json`, `primeiros-cadastros-barbearia.json`, `migracao-barbearia.json` (transcrito do console: o script parou no passo 6, refeito em `ja-atendo-faxina.json`), `ja-atendo-faxina.json`, `senha-e-entrar.json`.
- Capturas-chave: `F-corrida-resumo-diverge-celular.png` (F-01), `F-agendar-ocupado-celular.png` (F-02), `F-cadastro-senha-fraca-celular.png` (F-03), `F-agendar-sucesso-conta-nova-computador.png` (F-04), `F-recuperar-senha-outro-navegador-celular.png` (F-05), `F-migracao-importar-resultado-barbearia.png` (F-09), `F-perfil-*.png`, `F-painel-*-{barbearia,faxina}.png`, `F-confirmar-*.png`, `F-lista-espera-*.png`, `F-<pagina>-{celular,computador}.png`.
- Banco local (consultas via `docker exec supabase_db_ciclo psql`): agendamentos `Teste Agente F` com dia divergente (F-01); `auth.users` sem `fraca-…` (F-03); `last_visit_at` dos clientes 54/107/160/213/266 (F-09c); `product_events` dos dois tenants novos (F-11).
- Log do Auth local: `422 Password should be at least 10 characters.` às 05:31:47Z (F-03).

**Dados criados (só no banco local):**
- Contas: `dono-barbearia@agente-f.test` (tenant `barbearia-do-agente-f`: 1 serviço "Corte degradê", 1 profissional "Rafa Barbeiro", 295 clientes — 294 da planilha fictícia —, 2 agendamentos) e `dona-faxina@agente-f.test` (tenant `limpeza-brilho-da-lu`: 10 clientes de "já atendo", 1 agendamento público; senha trocada pelo teste de recuperação). Tentativas `fraca-…@agente-f.test` (não criada) e `comum-…@agente-f.test` (recusada).
- `demo-espaco-vitoria`: agendamentos de "Teste Agente F", "Concorrente Agente F" e "Corrida…" (os da corrida foram abortados antes do POST); 1 desmarcado (`5babe83f…`), 2 confirmados; 4 orçamentos com mensagem `[agente-F]` (1 aprovado); 4 entradas de `waitlist` (2 atendidas, viraram agendamento); 2 avaliações.
- Planilha fictícia: `C:\temp\ciclo-medicao\F-clientes-300.csv` (fora do repositório).

## INCERTEZAS

- **Produção não medida.** Latência real (banco na nuvem) deve alargar a janela de F-01 [INFERÊNCIA]; F-03 e F-05 dependem da configuração do Supabase de produção (tamanho mínimo de senha; confirmação de e-mail ligada — `DECISOES` 18/08 e 13/09 indicam que sim).
- **Confirmação de e-mail não percorrida**: local tem `enable_confirmations = false`; o passo foi substituído pelo link de recuperação, que usa a mesma troca PKCE.
- `NEXT_PUBLIC_APP_URL` do build é `:3000` e o app roda em `:3200`: o redirecionamento do link do e-mail foi reescrito para `:3200` no script (cookies não dependem da porta). `sitemap.xml`/`og:image` saem com `:3000` por isso — não é defeito de produção.
- Tempos são de robô; a meta "cliente agenda em < 1 min" (A7) é [HIPÓTESE] plausível (7 toques + 2 campos), não medida com gente.
- Concorrência com outros agentes no mesmo banco/servidor: a base `demo-espaco-vitoria` mudou durante a medição (seed refeito 01:19); limitadores de taxa são por IP e compartilhados (nenhum disparou).
- INP não medido (só tempo toque→resultado nas ações principais); "Só eu" escondendo menu de equipe não verificado.
- `migracao-barbearia.json` é transcrição do console (o JSON não foi gravado pelo script).

## RECOMENDAÇÕES (ordem)

1. **F-01** antes de qualquer divulgação da página do negócio: resposta mais recente vence + resumo e sucesso derivados de `startsAt` + teste com respostas fora de ordem. É o único S0 e fere o salão, não o CICLO.
2. **F-02, F-04** (mesma tela, mesmo momento de ansiedade): aviso de horário tomado que fica, com alternativas; sucesso sem canal inexistente; WhatsApp do negócio no onboarding.
3. **F-03, F-05, F-06** (entrada): piso de senha único e motivo real do 4xx; troca de link que não dependa do navegador.
4. **F-09, F-10, F-11** (primeiro valor): serviço do Motor sem padrão arbitrário, importar sem telefone ruim, data por coluna, um número por pergunta, primeiros passos por resposta do perfil.
5. **F-07, F-08, F-12, F-13** (estados que enganam): dizer o que foi confirmado/garantido/criado e por que algo está travado.
6. **F-14, F-15** em um ticket de copy pública (gênero/artigo, descrições, noindex) — o Agente D pode consolidar.
7. Medir com 3–5 donos reais o cadastro → 1º agendamento (Fase 3) e o "cliente final em < 1 min" (A7), com o e-mail de produção.
