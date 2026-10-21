# 112 · Copy e acessibilidade das telas das 13 jornadas

> Auditoria final (docs/111, frente 7 de A9). Data: 21/10/2026.
> Worktree `ciclo-marca`, branch `marca/feminina-2026-10-20`, commit `1caeaacb`.
> **Só leitura de código.** Nada foi alterado, nada commitado, produção não foi tocada.
> A sessão do navegador confirma o que está marcado **NÃO VERIFICADO**.

## Como ler

- **FATO**: lido no código, com `caminho:linha` e o texto. Contraste com a conta feita (fórmula WCAG 2.1, a mesma de `tests/unit/design/contraste.test.ts`).
- **INFERÊNCIA**: dedução a partir do código, com a conta junto.
- **NÃO VERIFICADO**: só o navegador prova (toque, foco, tempo, leitor de tela, autopreenchimento).
- Severidade do protocolo da casa (`VERIFICACAO-FINAL.md` §0.2): **S0** bloqueia (perda/vazamento de dado), **S1** fluxo principal quebrado para parte das pessoas, **S2** funciona degradado, **S3** polimento.
- Cada achado tem um código `K-nn`. Os tickets `EXP-K01`… estão no fim.

## Resumo

| Severidade | Quantos | Quais |
| --- | --- | --- |
| S0 | 0 | nenhum dado perdido ou vazado nestas telas |
| S1 | 2 | K-01 convite da equipe trava em e-mail; K-02 entrada pelo número promete código que não sai sem a Meta |
| S2 | 19 | K-03 a K-21 |
| S3 | 17 | K-22 a K-38 |
| **Total** | **38** | alguns achados juntam vários lugares do mesmo defeito |

**O que já está certo (FATO, para não mexer):** todo `Input` tem `<label htmlFor>` de verdade e `aria-describedby` (`src/components/ui/input.tsx:50-64`); o código de 6 dígitos tem `inputMode="numeric"` e `autoComplete="one-time-code"` (`(auth)/entrar/formulario-numero.tsx:157-160`); `Button` com `motivoDesabilitado` explica no toque (`src/core/ui/botao-travado.ts`); regiões `aria-live` que vivem sempre no DOM em Agenda (`admin/agenda/agenda.tsx:155`), Novo agendamento (`novo/formulario.tsx:490`), Recuperar (`recuperar.tsx:271`) e Agendar público (`agendar.tsx:994`); foco vai para o título no sucesso do agendamento público (`agendar.tsx:282-284`) e nos estados de `/confirmar`, `/avaliar`, `/lista-espera` (`components/ui/titulo-de-estado.tsx`); "Chamar" tem `aria-label` com o nome e 48 px (`recuperar.tsx:375-377`); anel de foco global de 2 px (`globals.css:463-466`). A paleta do produto passa: `--acc` e `--acc-2` dão de 5,08:1 a 15,5:1 como texto nas quatro superfícies, nos dois temas (conta abaixo).

---

## Achados transversais (aparecem em várias telas)

### K-03 · S2 · Tema "Automático" e "Escuro" com cores de estado antigas
- **FATO**: o comentário de `src/app/globals.css:133-135` diz que os blocos do tema "TÊM que ser idênticos". Não são.
  - `[data-theme="sistema"]` (claro do aparelho), `globals.css:159-162`: `--ok: #2a8148`, `--bad: #78120b`. O bloco `[data-theme="light"]`, `globals.css:192-195`, já tem `--ok: #277742` e `--bad: #6e110a` (APR-124).
  - `[data-theme="dark"]`, `globals.css:231-232`: `--risk: #e79955`, `--bad: #e05d52`. A raiz, `globals.css:95-96`, já tem `#e89d5c` e `#e2675c`.
- **Conta**: `--ok` #2a8148 sobre a própria tinta a 15% no branco = **3,98:1** (sobre o `--bg` claro, 3,77:1). `--bad` #e05d52 sobre a tinta no `--surface` escuro = **4,27:1**. Piso: 4,5:1.
- **Quem sente**: quem escolhe "Automático" com o celular no claro, ou "Escuro". O padrão é claro (`admin/layout.tsx:107`), então é a minoria.
- **Guarda cega**: `contraste.test.ts` lê só o primeiro `--x:` (raiz) e o bloco `[data-theme="light"] {`. Os outros dois blocos nunca são medidos.

### K-04 · S2 · Cor do salão na página pública fica abaixo de 4,5:1 no cartão escolhido
- **FATO**: `acentoNoTemaClaro` calibra `--acc-2` para 4,5:1 **só contra `#faf8f5`** (`src/core/text/cor.ts:95-98`, `FUNDO_CLARO`). O mesmo `--acc-2` é usado como texto sobre o cartão escolhido (`bg-acc-soft`, 16% do acento) e sobre `--surface-2`.
  - Preço do serviço escolhido: `(public)/[slug]/agendar/agendar.tsx:850-875` (`border-acc bg-acc-soft` + `text-acc-2`).
  - "Trocar" no resumo do passo: `agendar.tsx:112`.
- **Conta** (as seis cores prontas de `PALETA_PRESET` e o rosé): `--acc-2` sobre o cartão escolhido dá **4,08** (Coral), 4,09 (Menta), 4,20 (rosé), 4,22 (Dourado), 4,27 (Rosa), 4,31 (Lavanda). Sobre `--surface-2`: 4,15 a 4,36. O texto é 16 px semibold, não conta como "texto grande".
- **NÃO VERIFICADO**: medir com axe na página do salão de demonstração com cor escolhida.

### K-06 · S2 · Campo da cliente no painel oferece o nome e o telefone da própria profissional
- **FATO**: `PhoneInput` crava `autoComplete="tel"` **depois** do `{...props}` (`src/components/ui/phone-input.tsx:29-33`), então nenhuma tela consegue desligar. No Novo agendamento, o nome da cliente tem `autoComplete="name"` (`admin/agenda/novo/formulario.tsx:386`) e o telefone usa `PhoneInput` (`:411`).
- **INFERÊNCIA**: no Android e no iPhone, o teclado sugere o nome e o número **da dona do aparelho**. Um toque na sugestão grava a cliente com o telefone da profissional, e o "Chamar" do Recuperar passa a abrir conversa com ela mesma.
- **NÃO VERIFICADO**: confirmar a sugestão no Chrome do Android e no Safari.
- Na página pública (`agendar.tsx:1127, 1130`) o autopreenchimento é o certo: ali quem digita é a própria cliente.

### K-07 · S2 · Botão destrava antes de a tela seguinte abrir
- **FATO**: `router.push(...)` não espera a navegação, e o `finally` devolve o botão logo depois.
  - Entrar pelo código: `(auth)/entrar/formulario-numero.tsx:125` e `:130`.
  - Onboarding: `onboarding/formulario.tsx:97` e `:102`.
  - Cadastro: `(auth)/cadastro/formulario.tsx:58-59` (`window.location.assign`) e o `finally` logo abaixo.
- **INFERÊNCIA**: em 4G lento, "Entrar" e "Colocar minha página no ar" voltam a ser tocáveis enquanto o painel carrega. Segundo toque reenvia o código já usado (vira erro na tela) ou tenta criar o negócio de novo.
- **NÃO VERIFICADO**: medir a janela com CPU 4× e "Slow 4G".

### K-08 · S2 · Rotas da cliente e da entrada sem tela de carregando
- **FATO**: não existe `loading.tsx` em `(public)/[slug]`, `[slug]/agendar`, `confirmar`, `avaliar`, `convite`, `lista-espera`, `onboarding`, `entrar`, `cadastro` (busca por arquivo, zero resultados). A guarda `telas-do-admin-tem-loading` só cobre `/admin`.
- **INFERÊNCIA**: tocar "Agendar horário" na página do salão deixa a tela parada até o servidor responder. Fere a frase-objetivo "nenhum toque espera sem avisar".
- **NÃO VERIFICADO**: tempo entre o toque e a próxima tela (agente de desempenho).

### K-09 · S2 · Artigo errado com o nome do serviço em texto que a cliente lê
- **FATO**:
  - `(public)/avaliar/[token]/avaliar.tsx:168`: "Como foi seu {servicoNome}?" vira "Como foi seu Manutenção?", "seu Escova", "seu Design de sobrancelha com henna" (este último passa; os femininos não).
  - `src/server/services/mensagens-prontas.ts:45`: "Essa semana o {{servico}} está saindo por {{valor}}" vira "o Manutenção", "o Escova" (já no inventário C1.1 #5).
- `src/lib/mensagens.ts:133-136` já resolveu o mesmo defeito com "seu último horário de {serviço}". As duas telas acima não seguiram a regra.

### K-12 · S2 · Página de erro da cliente manda para a propaganda do CICLO
- **FATO**: a saída de erro é "Ir para o início", que abre a home do CICLO (`/`):
  - `(public)/confirmar/[token]/page.tsx:30`
  - `(public)/avaliar/[token]/page.tsx:27`
  - `(public)/lista-espera/[token]/reivindicar.tsx:43` (quando o token não traz o salão)
- As mensagens dizem "Fale com quem vai te atender" sem dar o WhatsApp de ninguém.
- **Por que dói**: a página pública fala em nome do salão (A1.5). A cliente que abriu um link do salão cai numa página que vende software para profissional.

---

## Tela por tela

### Profissional · `/entrar` (login por número)

Arquivos: `src/app/(auth)/entrar/page.tsx`, `jeitos-de-entrar.tsx`, `formulario-numero.tsx`, `formulario.tsx`.

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-02 | A porta padrão é o número, e a ajuda promete "Vamos mandar um código por lá" mesmo sem a credencial da Meta. Sem ela, todo primeiro toque em "Mandar código" volta com "Não consegui mandar o código agora. Tente de novo em instantes ou entre com e-mail". "Tente de novo em instantes" é falso: sem credencial, nunca vai sair. | FATO `jeitos-de-entrar.tsx:16` (abre em `'numero'`), `formulario-numero.tsx:227`, `src/server/http/errors.ts:40`. O runbook confirma que em produção o número fica "escondido atrás de um erro honesto" até a Meta (`docs/runbooks/login-por-numero.md`). **S1 se a branch for ao ar antes da Meta**; S3 depois. | S1 |
| K-21 | Duas portas que se contradizem. `/entrar` diz "Primeira vez? É o mesmo caminho: o código cria a sua conta", e o link "Não tem conta? Cadastre-se" leva a `/cadastro`, que pede nome, e-mail, telefone e senha. Quem chega pela home cai no formulário de 4 campos. | FATO `jeitos-de-entrar.tsx:41`, `formulario.tsx:123`, `(auth)/cadastro/formulario.tsx:146-158` | S2 |
| K-07 | Botão "Entrar" destrava antes do painel abrir (ver transversal). | INFERÊNCIA | S2 |
| K-39 (dentro de K-02) | Para entrar, pede "Seu nome" toda vez em aparelho novo. Login não precisa de nome. | FATO `formulario-numero.tsx:216` (`required minLength={2}`) | S3 |
| ok | Código: `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`, `autoFocus` ao trocar de etapa; erro em `role="alert"`; reenvio com contagem e motivo. Título "Que bom te ver de novo" não supõe gênero. | FATO `formulario-numero.tsx:155-170, 186-191` | - |

### Profissional · `/cadastro`

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-21 | Ainda é cadastro por e-mail e senha, fora do caminho L1. | FATO `(auth)/cadastro/formulario.tsx:146-158` | S2 |
| K-31 | Erro genérico sem o que fazer: "Não consegui criar sua conta." | FATO `cadastro/formulario.tsx:52` | S3 |
| ok | Termos e Privacidade numa linha própria com `flex gap` (a armadilha dos dois links inline foi resolvida); confirmação recebe o foco. | FATO `cadastro/formulario.tsx:192-201, 30-32` | - |

### Profissional · `/onboarding` (três respostas)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-17 | Busca de profissão troca a lista inteira sem `aria-live`: quem usa leitor de tela não sabe quantas sobraram nem que "Não achamos" apareceu. Ao tocar numa profissão, a lista some junto com o botão tocado e o foco cai no `body`. | FATO `onboarding/formulario.tsx:121-176` (sem região viva), `:160` (botão que desmonta). NÃO VERIFICADO: o que o leitor de tela anuncia. | S2 |
| K-07 | "Colocar minha página no ar" destrava antes de `/onboarding/perfil` abrir. | INFERÊNCIA `:97, :102` | S2 |
| K-31 | Ajuda do endereço: "É o link que você manda para agendar." Quem agenda é a cliente; lê como se fosse a profissional. | FATO `onboarding/formulario.tsx:194` | S3 |
| cruzado | Barbearia em 3º e Cabelo em último na lista. É da frente C1 (inventário #3), não contado aqui. | `docs/111` C1.1 | - |

### Profissional · `/onboarding/perfil`

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-15 | Quatro perguntas em sequência trocam o cartão inteiro por `setEtapa`, sem mover o foco nem anunciar. O botão tocado some e o foco vai para o `body`; o leitor de tela fica mudo. | FATO `onboarding/perfil/formulario.tsx:94, 99, 156` e cada `onClick` das opções | S2 |
| K-16 | "Pular esta pergunta" (3 vezes) e "Voltar" são texto de 13 px sublinhado, sem `min-h-12` nem `toque-48`: alvo de uns 18 px. O "Pular tudo" de cima já foi consertado (APR-125), estes não. | FATO `perfil/formulario.tsx:154-161, 191-198, 222-229, 254-261` (classe `self-center text-label ... underline`). NÃO VERIFICADO: altura medida. | S2 |
| K-34 | Opções com `role="radio"` e `aria-checked={false}` fixo: o leitor diz "botão de opção, não marcado" e espera setas, que não funcionam. São botões que avançam. | FATO `perfil/formulario.tsx:143, 243` | S3 |
| K-23 | "Onde estão seus clientes hoje?" (masculino genérico, para uma base que é quase toda de cliente mulher). | FATO `perfil/formulario.tsx:130` | S3 |
| K-31 | "Dá para ligar de volta em Config." (abreviação de menu). | FATO `perfil/formulario.tsx:168-169` | S3 |
| cruzado | "Qual sistema você usa?" começa por AppBarber e BarbUp (C1.1 #7). | - | - |

### Profissional · `/admin/hoje` (P2)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-22 | "Suas clientes trouxeram N pessoas novas" supõe que quem é atendido é mulher. A guarda não pega o possessivo ("suas", "minhas"). | FATO `admin/hoje/hoje.tsx:480` | S3 |
| K-31 | Botão "Mensagem" (substantivo, sem verbo; não diz para quem). | FATO `hoje.tsx:279` | S3 |
| K-25 | "Mandar o CICLO" é link dentro do parágrafo, sem área de 48 px. | FATO `hoje.tsx:463` | S3 |
| ok | Vazio com ação ("Marcar horário" e "Compartilhar meu link"); bloco que falha avisa em vez de mostrar R$ 0,00; `loading.tsx` existe; texto do WhatsApp do próximo horário é neutro ("Oi {nome}! Tudo certo pro seu horário hoje às {hora}?"). | FATO `hoje.tsx:328-350, 354-355, 56-62`, `bloco-falhou.tsx` | - |

### Profissional · `/admin/agenda` e Novo agendamento (P4, P7)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-06 | Nome e telefone da cliente com autopreenchimento do aparelho (ver transversal). | FATO `novo/formulario.tsx:386, 411` | S2 |
| K-19 | Sucesso diz só "Agendamento criado". Não diz se a cliente sabe, nem oferece mandar a confirmação no WhatsApp. Na P4 a cliente pediu pelo WhatsApp e espera um "marcado". | FATO `novo/formulario.tsx:273` | S2 |
| K-22 | "O horário vai para o cadastro **dela**." supõe mulher. A guarda não pega pronome. | FATO `novo/formulario.tsx:434` | S3 |
| K-26 | O aviso "Esse telefone já é de …" nasce junto com o conteúdo (`role="status"` condicional): costuma não ser anunciado. As sugestões "Já é cliente?" aparecem sem anúncio. | FATO `novo/formulario.tsx:431-432, 389-391` | S3 |
| K-25 | "Usar o nome do cadastro" é texto de 13 px sem área de toque. | FATO `novo/formulario.tsx:436-446` | S3 |
| K-23 | "Cadastre pelo menos um profissional" e o filtro "Todos" da Agenda. | FATO `novo/formulario.tsx:634`, `agenda.tsx:128` | S3 |
| K-32 | O ponto de "hoje" na faixa da semana usa a data em UTC: das 21h às 24h em Brasília marca amanhã como hoje. | FATO `agenda.tsx:96` (`paraISO(new Date())`) | S3 |
| ok | Faixa e trilho de dias com `aria-current="date"` e `aria-label` por extenso; região viva da troca de dia; botão travado com motivo; vazio com ação. | FATO `agenda.tsx:110-157`, `trilho-de-dias.tsx:35-36` | - |

### Profissional · Remarcar e cancelar (detalhe do agendamento)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-19 | Depois de remarcar ou cancelar, só aparece o toast "Agendamento remarcado/cancelado". Nada avisa a cliente e nada oferece o texto pronto "Preciso remarcar" (que existe, `mensagens-prontas.ts:44`). A linha do cancelar diz "Ele sai da agenda e o horário fica livre" e não diz que a cliente **não** é avisada. Risco: cliente aparece num horário que não existe mais. | FATO `admin/agenda/detalhe.tsx:207, 178, 350` | S2 |
| K-31 | Rótulos de estado sem objeto: "Chegou" (não é verbo de ação), "Confirmar". | FATO `detalhe.tsx:28-29` | S3 |
| ok | Remarcar pela grade com região viva; alternativas do 409 viram chips; cancelar em dois passos com destrutivo separado. | FATO `detalhe.tsx:356-411, 414-430` | - |

### Profissional · `/admin/recuperar` (fila e "Chamar", P3)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-14 | Trocar o filtro tem `try/finally` **sem `catch`**: rede caída rejeita a promessa em silêncio, a lista antiga fica na tela como se fosse do filtro novo, e a região viva anuncia a contagem velha. É a armadilha "catch que descarta" do CLAUDE.md, ao contrário. | FATO `admin/recuperar/recuperar.tsx:90-107` | S2 |
| K-22 | Filtros no feminino ("Todas", "Atrasadas", "Perdidas") **na mesma tela** dos chips de perfil no masculino ("Novo", "Atrasado", "Sumido"). Vazio diz "Cadastre suas clientes" e, na frase seguinte da mesma função, "de cada um". | FATO `recuperar.tsx:38-42`, `core/crm/nota-do-cliente.ts:70-77`, `core/ciclo/vazio-de-recuperar.ts:49, 67` | S3 |
| K-30 | "12d de atraso" (o leitor lê "12 d"); "Chamar" na lista é só o ícone do WhatsApp para quem enxerga; na fila, o destrutivo diz só "Confirmar"; "Pediu para não ser chamado" no masculino. | FATO `recuperar.tsx:341`, `:368-380`, `fila.tsx:168, 177` | S3 |
| K-25 | "Mais filtros" (`summary` com `py-2`, uns 36 px). | FATO `recuperar.tsx:225` | S3 |
| ok | Texto que chega à cliente ("Oi, {nome}! Faz um tempinho desde seu último horário de {serviço}…") é neutro e sem artigo errado; "Chamar pelo WhatsApp" de 56 px na fila; opt-out com confirmação e volta; região viva. | FATO `src/lib/mensagens.ts:119-140`, `fila.tsx:120-135, 152-179` | - |

### Profissional · `/admin/clientes/ja-atendo`

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-18 | O `<select>` de "quando veio" de quem já tem ficha **não tem rótulo** (nem `<label>`, nem `aria-label`). A busca "Alguém que você já atende voltou?" troca resultados sem `aria-live`. A guarda `todo-campo-tem-rotulo` só procura `<input`, por isso passa. | FATO `ja-atendo/formulario.tsx:280-290`, `:448-504`; `tests/unit/design/todo-campo-tem-rotulo.test.ts:96` | S2 |
| K-29 | Concordância: "1 pessoa já está atrasad**as** para voltar" no cartão da recompensa. Telefone dos resultados aparece cru ("991110001"). Exemplo da lista colada com dois nomes de homem primeiro ("Marcos", "Rafael"). | FATO `ja-atendo/formulario.tsx:173, 500, 317` | S3 |
| K-25 | Sem serviço com ritmo, a única saída é um link dentro da frase ("serviços e preços"). | FATO `ja-atendo/page.tsx:76-80` | S3 |
| ok | Campos da linha com rótulo; botão diz o número ("Pôr 3 pessoas no Motor"); telefone da linha com `inputMode="tel"` e sem autopreencher o da profissional. | FATO `formulario.tsx:361, 397-403, 429` | - |

### Profissional · `/admin/caixa` (fechar o dia, P5)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-37 | Dia com atendimento e sem comanda fechada: a frase explica certo, mas a ação é "Ver a agenda", não "Fechar as comandas de hoje". Para P5 (≤ 10 s) é um desvio. | FATO `admin/caixa/caixa.tsx:124-129` | S3 |
| K-23 | "menos a gorjeta do profissional". | FATO `caixa.tsx:147` | S3 |
| K-31 | Ação "Informar" (sem objeto) na faixa da maquininha. | FATO `caixa.tsx:191-193` | S3 |
| ok | Setas de 48 px com `aria-label`; seta futura escondida em vez de link morto; campo de data com rótulo. | FATO `caixa.tsx:96-117`, `seletor-de-dia.tsx` | - |

### Profissional · `/admin/config/profissionais` e `/convite/[token]` (P6)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-01 | **O convite só aceita quem entra com o mesmo e-mail.** Quem entra pelo número tem e-mail vazio na sessão (`session.ts:52`, `email ?? ''`), então cai em "Este convite é para outro e-mail … Você entrou como ." (com o e-mail em branco). A saída "Sair e entrar com o e-mail do convite" volta para `/entrar`, que abre no número: volta ao mesmo lugar. O formulário de convite exige e-mail. A meta de P6 é "sem e-mail". | FATO `(public)/convite/[token]/page.tsx:44-51`, `aceitar.tsx:41-48`, `admin/config/profissionais/lista.tsx:593` (`name="email"` + `required`), `src/server/auth/session.ts:52`. Decidido no `docs/110` (L2: convite por WhatsApp). | S1 |
| K-20 | "Desativar" é um toque, sem confirmação, e não existe "Reativar" na tela: a profissional some da página do salão e só volta pelo banco. Protocolo §4.1: destrutivo sempre com confirmação. | FATO `lista.tsx:419`; busca por "Reativar/ativar" sem resultado na pasta | S2 |
| K-01 | Depois de criar o convite, só "Link copiado. É só colar e mandar." Não há "Mandar no WhatsApp". | FATO `lista.tsx:259` | (em K-01) |
| K-23 | "Novo profissional", "Profissional cadastrado/atualizado", "Digite o nome do profissional", chips "Ativos/Todos", selo "Inativo". | FATO `config/profissionais/formulario.tsx:105, 117, 218`; `lista.tsx:303, 309, 397` | S3 |
| K-31 | Campo "Nome (se for profissional)" confunde (todo convidado é alguém). | FATO `lista.tsx:643` | S3 |
| K-25 | Bolas de cor de 36 px de largura (o `toque-48` só estende na vertical); "Ir para o início" do convite é link dentro da frase. | FATO `formulario.tsx:166`; `convite/[token]/page.tsx:62` | S3 |
| K-35 | Cor escolhida usa `outline` inline, que vence o anel de foco global: no teclado, "escolhida" e "com foco" ficam iguais. | FATO `formulario.tsx:167-171` | S3 |

### Cliente · `/[slug]` (página do salão)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-04 | `--acc-2` do salão abaixo de 4,5:1 sobre `--surface-2` (ver transversal). | INFERÊNCIA (conta) | S2 |
| K-24 | Artigo antes do nome do salão no texto pronto do WhatsApp e na descrição da prévia: "Vim pelo site **da** {nome}", "Agende seu horário **na** {nome}". Erra com "Espaço Vitória", "Studio Bella", "Salão Encanto". | FATO `secoes.tsx:53`, `[slug]/page.tsx:17`, `agendar/page.tsx:26`, `admin/hoje/compartilhar.tsx:36` | S3 |
| K-36 | Conta pausada: "Fale direto com o negócio" e só "Ligar para o negócio" (cliente vive no WhatsApp; "negócio" não é palavra de salão). | FATO `[slug]/layout.tsx:61, 67` | S3 |
| K-08 | Sem `loading.tsx` ao tocar "Agendar horário". | FATO | S2 |
| ok | `h1` com o nome; capa `alt=""` decorativa; logo com `alt`; contatos com `min-h-12` (decisão medida contra `toque-48`); "Quem atende" sem gênero. | FATO `secoes.tsx:102, 138, 145, 304-307, 496-514` | - |

### Cliente · `/[slug]/agendar` (C1)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-13 | No erro de rede, a frase manda "Toque em **Confirmar** de novo: não vai duplicar." O botão se chama "**Pedir este horário**" desde o APR-118. No momento de mais ansiedade, a tela aponta um botão que não existe. | FATO `agendar.tsx:595` contra `:163` | S2 |
| K-04 | Preço do serviço escolhido e "Trocar" em `--acc-2` sobre `--acc-soft`: 4,08 a 4,31:1 conforme a cor do salão. | INFERÊNCIA (conta) `agendar.tsx:850-875, 112` | S2 |
| K-24 | "pelo site **da** {salão}" no texto do WhatsApp do sucesso; "procure **a** {salão}". | FATO `agendar.tsx:621, 685`; também `orcamento/pedido.tsx:32` | S3 |
| K-33 | Dois campos a mais no caminho de C1 sem uso real: "E-mail (opcional)" (nenhum e-mail sai, `RESEND_API_KEY` vazio segundo `docs/110` §2) e "Onde vai ser (opcional)" em todo salão. "Seu pedido chegou e já apareceu para **a equipe**" para quem trabalha sozinha. | FATO `agendar.tsx:1143, 1163, 676` | S3 |
| ok | Rótulos de verdade, `autoComplete` de nome e telefone, ajuda do telefone que não promete canal ("É por aqui que quem vai te atender fala com você."), região viva dos horários, barra fixa com motivo, foco no título do sucesso, "Tanto faz" no lugar de "Qualquer um". | FATO `agendar.tsx:1123-1136`, `core/messaging/promessa.ts:28-35`, `:994-1029`, `:130-168`, `:636`, `:910` | - |

### Cliente · `/confirmar/[token]` (C2)

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-10 | **A tela existe e ninguém chega nela hoje.** O único lugar que monta o link é o lembrete automático (`src/server/services/lembretes.ts:143`), que está fora do agendador por falta da Meta. Nenhuma mensagem pronta carrega o link: as variáveis são nome, serviço, data, hora, valor, negócio e **link de indicação** (`src/lib/mensagens.ts:19-27`). A meta de C2 é "1 toque". | FATO | S2 |
| K-12 | Erro de link vencido manda para a home do CICLO. | FATO `confirmar/[token]/page.tsx:30` | S2 |
| K-27 | "Vou sim" → "Desmarcar esse horário?" troca o conteúdo com `h1` comum, sem foco: o botão tocado some e o leitor fica mudo. Depois de a cliente desmarcar, "Sentimos falta!" soa estranho. | FATO `confirmar.tsx:148-180` (h1 sem foco), `:222` | S3 |
| ok | Horário aparece antes do toque; desmarcar em dois passos e 10 s para desfazer; região viva única para a contagem. | FATO `confirmar.tsx:135-146, 182-198` | - |

### Cliente · `/lista-espera/[token]`

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-28 | O sucesso diz só "Seu horário: {dia}, às {hora}. Até lá!", sem o salão nem o serviço. A cliente que vai a dois lugares não sabe qual. A reserva acontece ao **abrir** o link, sem toque. O link só sai por WhatsApp ou e-mail automáticos (`lista-espera.ts:243-270`), os dois desligados hoje. | FATO `reivindicar.tsx:79-81`, `:30` | S3 |
| K-12 | Sem salão no token, saída é a home do CICLO. | FATO `reivindicar.tsx:43` | S2 |

### Cliente · `/avaliar/[token]`

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-09 | "Como foi seu {serviço}?" com artigo masculino fixo. | FATO `avaliar.tsx:168` | S2 |
| K-05 | Estrelas não marcadas em `text-line-2` (cinza a 16%): **1,4:1** contra o fundo. É o único desenho do controle; WCAG 1.4.11 pede 3:1. | FATO `avaliar.tsx:192`; conta: rgba(24,18,12,.16) sobre #faf8f5 = #d6d3d0, 1,40:1 | S2 |
| K-22 | "Indique alguém. **Ela** agenda o primeiro horário…" supõe mulher. É a mesma frase que a guarda diz ter consertado ("ELA agenda"), só que noutra tela. | FATO `avaliar.tsx:146` | S3 |
| K-24 | "Super recomendo **a** {salão}", "A equipe **da** {salão} agradece" (autônoma não tem equipe). | FATO `avaliar.tsx:128, 136` | S3 |
| K-25 | "Mandar no WhatsApp" sem altura própria: o desenho tem uns 24 px (a área tocável vem do `toque-48`). | FATO `avaliar.tsx:152-159` | S3 |
| K-12 | Erro manda para a home do CICLO. | FATO `avaliar/[token]/page.tsx:27` | S2 |

### Cliente · Mensagens prontas (`src/server/services/mensagens-prontas.ts`)

São as frases que a profissional manda do próprio WhatsApp. Quem passa vergonha com erro aqui é o salão.

| # | Achado | Rótulo e evidência | Sev |
| --- | --- | --- | --- |
| K-09 | "Essa semana **o** {{servico}} está saindo por {{valor}}." | FATO `:45` | S2 |
| K-11 | "Pedir indicação": "**Dê um desconto** pra quem você indicar: a pessoa agenda…". (1) O imperativo manda a **cliente** dar desconto. (2) O produto não dá desconto nenhum na indicação: a própria tela diz "Não promete desconto nem valor nenhum" (`agendar.tsx:780`). Promessa vazia em nome do salão. | FATO `:46` | S2 |
| K-10 | "Lembrete de amanhã" e "Confirmar horário" não têm como levar o link de confirmar (variável não existe). | FATO `:39-40`, `src/lib/mensagens.ts:19-27` | S2 |
| K-38 | "Confirmando: … Posso confirmar?" repete a palavra e não diz o que a cliente faz. "Feliz aniversário" promete "um mimo te esperando" por padrão, mesmo para quem não tem mimo. "Preciso remarcar" diz "Tenho outros horários livres" sem link para escolher. | FATO `:39, :42, :44` | S3 |
| ok | Nenhum modelo diz "obrigado" na voz da profissional; nenhum afirma onde é o atendimento. | FATO `:23-49` e guarda `copy-nao-supoe-genero` | - |

---

## Guardas cegas achadas nesta leitura

| Guarda | O que ela não vê | Prova |
| --- | --- | --- |
| `copy-nao-supoe-genero` (`SUPOE_MULHER`) | possessivo ("suas clientes"), pronome ("ela", "dela"), adjetivo elíptico ("Todas", "Atrasadas", "Perdidas") | `hoje.tsx:480`, `vazio-de-recuperar.ts:49`, `novo/formulario.tsx:434`, `avaliar.tsx:146`, `recuperar.tsx:38-42` passam verdes hoje |
| `todo-campo-tem-rotulo` | `<select>` e `<textarea>` (só varre `<input`) | `ja-atendo/formulario.tsx:280` |
| `contraste` | blocos `[data-theme="sistema"]` e `[data-theme="dark"]` | `globals.css:159-162, 231-232` |
| `telas-do-admin-tem-loading` | rotas públicas e de entrada | nenhum `loading.tsx` fora de `/admin` |
| `acento-da-vitrine-clara` | contraste do `--acc-2` sobre `--acc-soft` e `--surface-2` | `cor.ts:95-98` mede só contra `#faf8f5` |

## O que só o navegador confirma (para a sessão principal)

1. K-04, K-05, K-03: rodar axe na página do salão de exemplo com cor escolhida, no `/avaliar`, e no painel com tema "Automático" (aparelho claro) e "Escuro".
2. K-16, K-25: sondar alvos com `elementFromPoint` (receita da `alvo-de-toque-tem-48`) a 375 px em `/onboarding/perfil`, Novo agendamento, Recuperar, `/avaliar`, Profissionais.
3. K-15, K-17, K-27: leitor de tela (TalkBack ou VoiceOver) nas trocas de etapa: o que é anunciado e onde fica o foco.
4. K-06: autopreenchimento do nome e do telefone no Novo agendamento, no Chrome do Android.
5. K-07, K-08: tempo do toque até a próxima tela e janela em que o botão volta a aceitar toque (CPU 4×, Slow 4G).
6. K-01: entrar pelo número no banco local e abrir um `/convite/{token}`: confirmar "Você entrou como ." e o laço.
7. K-14: desligar a rede no DevTools e trocar o filtro do Recuperar.
8. K-02: em produção, o modo inicial do `/entrar` com a Meta desligada (não tocado nesta auditoria).

---

## Tickets

### EXP-K01 · Convite da equipe pelo WhatsApp, sem trava de e-mail
- **Frente:** jornada
- **Lado:** profissional
- **Jornada:** P6 (e P7, que depende da equipe estar dentro)
- **Classe:** Decidido (`docs/110` §3 e L2: "O convite da equipe passa a ir por WhatsApp")
- **Quando:** antes do lançamento (serve ao piloto)
- **Hoje (FATO):** convite exige e-mail (`lista.tsx:593`); quem entra pelo número vê "Este convite é para outro e-mail … Você entrou como ." e a saída volta ao mesmo `/entrar` (`convite/[token]/page.tsx:44-51`). Depois de criar, só "Link copiado".
- **Depois (meta):** a dona digita o nome (e, se quiser, o número) e toca "Mandar convite no WhatsApp"; a profissional abre o link, entra pelo número e aceita. ≤ 1 min, 0 e-mail, ≤ 6 toques da dona.
- **O que muda:** `admin/config/profissionais/lista.tsx` (formulário sem e-mail obrigatório, botão `wa.me` com o link), `server/services/convites.ts` (convite preso ao token, não ao e-mail; se tiver número, conferir o número), `(public)/convite/[token]/page.tsx` (sem o ramo de e-mail para quem entrou pelo número; nunca mostrar e-mail vazio).
- **Aceite medido:** no banco local, conta nova entrando só pelo número aceita um convite em ≤ 3 toques depois do link; cronômetro do "Convidar" até a profissional na Agenda da dona ≤ 60 s; nenhuma tela mostra "Você entrou como ." (texto vazio).
- **Guarda:** teste de serviço "aceita convite com sessão sem e-mail"; mutação: voltar a comparar `sessao.email` com `previa.email` deve reprovar. Teste de fonte: `convite/[token]/page.tsx` não interpola `sessao.email` sem conferir que existe; mutação: reintroduzir a linha 49 reprova.
- **Risco:** convite repassado a outra pessoa. Medir: token de uso único e 7 dias continua valendo (teste existente de convites).
- **Tamanho:** M

### EXP-K02 · Entrar pelo número só como porta principal quando o código sai de verdade
- **Frente:** jornada
- **Lado:** profissional
- **Jornada:** P1
- **Classe:** Bloqueado (credencial da Meta) + Do Vitor (ordem de publicação)
- **Quando:** antes do lançamento
- **Hoje (FATO):** `/entrar` abre no número (`jeitos-de-entrar.tsx:16`) e promete "Vamos mandar um código por lá" (`formulario-numero.tsx:227`); sem a Meta, a resposta é "Tente de novo em instantes" (`errors.ts:40`), que nunca vai funcionar. `/cadastro` continua e-mail e senha com "Cadastre-se" apontando para ele (K-21).
- **Depois (meta):** sem a Meta, `/entrar` abre no e-mail e o número nem aparece; com a Meta, abre no número e `/cadastro` vira o mesmo formulário de número. Zero tentativas que falham por falta de canal.
- **O que muda:** uma função única no servidor (padrão de `rodaSozinha` em `core/messaging/promessa.ts`) dizendo se o código por WhatsApp está ligado; `entrar/page.tsx` passa o modo inicial; `cadastro/page.tsx` redireciona para o número quando ligado; mensagem de `CODE_UNAVAILABLE` sem "em instantes" quando a causa é falta de credencial.
- **Aceite medido:** no banco local sem `WHATSAPP_*`, abrir `/entrar` a 375 px mostra e-mail e senha na primeira dobra, 0 campos de número; com as variáveis, mostra o número. Do link "Criar conta" da home até o painel: contar campos digitados (meta ≤ 3 com número).
- **Guarda:** teste da função "código ligado" nos dois estados; teste de fonte que `jeitos-de-entrar` não crava `'numero'` como padrão. Mutação: voltar o `useState` para `'numero'` fixo reprova.
- **Risco:** quem já tem conta por número e a Meta cai depois. Medir: o link "Entrar com o número" continua acessível como segunda opção quando houver conta por número.
- **Tamanho:** M

### EXP-K03 · Link de confirmar dentro das mensagens que a profissional manda
- **Frente:** jornada
- **Lado:** os dois
- **Jornada:** C2 (e P2, porque o "Confirmar" da Hoje passa a vir da cliente)
- **Classe:** Recomendado (alternativa descartada: esperar a Meta para o lembrete automático, que deixa C2 sem caminho até lá)
- **Quando:** serve ao piloto
- **Hoje (FATO):** `/confirmar/[token]` só é montado em `lembretes.ts:143`, que não roda; as variáveis das mensagens não têm o link (`mensagens.ts:19-27`); o "Mensagem" da Hoje manda "Tudo certo pro seu horário hoje às {hora}?" sem link (`hoje.tsx:57`).
- **Depois (meta):** a profissional toca "Mandar lembrete" (Hoje ou ficha), o WhatsApp dela abre com o texto e o link; a cliente confirma em 1 toque ("Vou sim") e a Agenda mostra "Confirmado".
- **O que muda:** `src/lib/mensagens.ts` (variável `{{confirmar}}`), quem monta a prévia e o envio da ficha e da Hoje (gerar `gerarTokenConfirmacao` no servidor), `mensagens-prontas.ts:39-40` passam a usar a variável.
- **Aceite medido:** no banco local, do toque em "Mandar lembrete" ao status "Confirmado" na Agenda: 1 toque da cliente depois de abrir o link; o texto aberto no `wa.me` contém `/confirmar/`.
- **Guarda:** teste de unidade que `aplicarVariaveis` troca `{{confirmar}}`; teste de fonte que o modelo "lembrete" contém `{{confirmar}}`. Mutação: tirar a variável do modelo reprova.
- **Risco:** link vencido (3 dias) quando o lembrete vai antes. Medir: token gerado no clique, não no cadastro do horário.
- **Tamanho:** M

### EXP-K04 · Avisar a cliente pelo WhatsApp da profissional ao marcar, remarcar e cancelar
- **Frente:** jornada
- **Lado:** os dois
- **Jornada:** P4, C3
- **Classe:** Recomendado (mesmo padrão do "Chamar", que é o WhatsApp da própria profissional e não promete canal)
- **Quando:** serve ao piloto
- **Hoje (FATO):** depois de criar: "Agendamento criado" (`novo/formulario.tsx:273`); depois de remarcar ou cancelar: só o toast (`detalhe.tsx:207, 178`); a linha do cancelar não diz que a cliente não fica sabendo (`detalhe.tsx:350`).
- **Depois (meta):** o toast de sucesso traz "Avisar {primeiro nome} no WhatsApp", que abre o texto pronto certo ("Marcado: …", "Remarquei para …", "Precisei desmarcar …"). Sem telefone, não aparece. A frase do cancelar diz "Ela não é avisada sozinha" na forma neutra ("Quem marcou não recebe aviso sozinho").
- **O que muda:** `admin/agenda/detalhe.tsx`, `admin/agenda/novo/formulario.tsx`, `src/lib/mensagens.ts` (três textos), toast com ação.
- **Aceite medido:** criar, remarcar e cancelar no banco local: cada um termina com o botão de aviso visível em ≤ 1 s, e o `wa.me` abre com data e hora no fuso do salão. P4 cronometrada: ≤ 20 s e ≤ 7 toques incluindo o aviso.
- **Guarda:** teste dos três textos (sem gênero, sem "o {serviço}"); teste de fonte que `confirmarRemarcacao` e `confirmarCancelamento` oferecem o aviso. Mutação: remover o botão do remarcar reprova.
- **Risco:** um toque a mais na P4. Medir: o aviso é opcional e não bloqueia a volta para a Agenda.
- **Tamanho:** M

### EXP-K05 · Texto que chega à cliente sem artigo errado e sem promessa vazia
- **Frente:** jornada
- **Lado:** cliente
- **Jornada:** C1, C4, avaliação
- **Classe:** Recomendado
- **Quando:** serve ao piloto
- **Hoje (FATO):** "Como foi seu {serviço}?" (`avaliar.tsx:168`); "o {{servico}}" (`mensagens-prontas.ts:45`); "Dê um desconto pra quem você indicar" (`:46`); "da/na/a {salão}" em 8 lugares (K-24); "um mimo te esperando" (`:42`).
- **Depois (meta):** zero artigo grudado em nome de serviço ou de salão no que a cliente lê. Ex.: "Como foi seu horário de {serviço}?", "Vim pelo site de {salão}" ou "Vim pela página {salão}", "Que tal indicar alguém? Pelo link, a pessoa marca o primeiro horário sem esperar resposta".
- **O que muda:** `avaliar.tsx`, `mensagens-prontas.ts` (piso de novas contas; as já semeadas não mudam sozinhas, então avisar na tela de mensagens que há texto novo), `secoes.tsx:53`, `[slug]/page.tsx:17`, `agendar/page.tsx:26`, `agendar.tsx:621, 685`, `orcamento/pedido.tsx:32`, `hoje/compartilhar.tsx:36`, `avaliar.tsx:128, 136`.
- **Aceite medido:** abrir `/avaliar` com serviço "Manutenção" e "Escova" e a página de 3 salões de nome masculino, feminino e neutro: 0 concordâncias erradas lidas na tela e no texto do `wa.me`.
- **Guarda:** teste de fonte que reprova `(o|a|seu|sua|da|na|do|no) \{\{servico\}\}` nos modelos e `(da|na|a|do|no) \$\{(nomeDoSalao|perfil\.name|dados\.negocioNome|nome)` em `(public)/` e `hoje/compartilhar.tsx`. Mutação: reintroduzir "Como foi seu {dados?.servicoNome" reprova; controle positivo: a guarda acha o padrão num texto de exemplo.
- **Risco:** frase mais longa. Medir: nenhuma linha nova quebra a 320 px.
- **Tamanho:** P

### EXP-K06 · Tema Automático e Escuro com as cores de estado já consertadas
- **Frente:** jornada
- **Lado:** profissional
- **Jornada:** P2, P5
- **Classe:** Recomendado
- **Quando:** serve ao piloto
- **Hoje (FATO):** `--ok` 3,98:1 e `--bad` 4,27:1 sobre a própria tinta nos blocos `sistema` e `dark` (`globals.css:159-162, 231-232`).
- **Depois (meta):** os quatro blocos com os mesmos valores do APR-124; todo selo ≥ 4,5:1.
- **O que muda:** `src/app/globals.css`, `tests/unit/design/contraste.test.ts`.
- **Aceite medido:** axe sem "color-contrast" na Hoje e na Agenda com o tema "Automático" (aparelho claro) e "Escuro".
- **Guarda:** o teste passa a ler os quatro blocos e compara `sistema` com `light` e `dark` com a raiz, token a token. Mutação: voltar `--ok` do bloco `sistema` para `#2a8148` reprova.
- **Risco:** nenhum visual perceptível. Medir: captura antes e depois.
- **Tamanho:** P

### EXP-K07 · Cor do salão legível onde ela vira texto pequeno, e estrelas visíveis
- **Frente:** jornada
- **Lado:** cliente
- **Jornada:** C1, avaliação
- **Classe:** Recomendado
- **Quando:** serve ao piloto
- **Hoje (FATO):** `--acc-2` calibrado só contra `#faf8f5` (`cor.ts:95-98`): 4,08 a 4,36:1 sobre o cartão escolhido e `--surface-2`. Estrela vazia 1,40:1 (`avaliar.tsx:192`).
- **Depois (meta):** `--acc-2` ≥ 4,5:1 sobre `--acc-soft` e `--surface-2` para qualquer cor escolhida; contorno da estrela ≥ 3:1.
- **O que muda:** `src/core/text/cor.ts` (medir contra a superfície mais escura em que o texto aparece), `avaliar.tsx` (estrela vazia em `text-txt-3`).
- **Aceite medido:** axe na página de agendar de salão com as 6 cores prontas e uma cor livre clara (#ffd6e8): 0 falhas de contraste no serviço escolhido; `/avaliar` sem falha 1.4.11.
- **Guarda:** teste de unidade que, para as 6 cores prontas, `contrasteWcag(acc2, mistura(acc, superfície, 0,16)) >= 4,5`. Mutação: voltar a medir só contra `FUNDO_CLARO` reprova.
- **Risco:** a cor do salão escurece um pouco mais. Medir: captura lado a lado com a cor original.
- **Tamanho:** P

### EXP-K08 · Campo da cliente no painel sem autopreencher a profissional
- **Frente:** jornada
- **Lado:** profissional
- **Jornada:** P4
- **Classe:** Recomendado
- **Quando:** serve ao piloto
- **Hoje (FATO):** `PhoneInput` força `autoComplete="tel"` (`phone-input.tsx:33`); nome da cliente com `autoComplete="name"` (`novo/formulario.tsx:386`).
- **Depois (meta):** no painel, campos de terceiros com `autoComplete="off"`; na página pública, como hoje.
- **O que muda:** `phone-input.tsx` (aceitar `autoComplete` de fora, padrão `tel`), `novo/formulario.tsx`, e as outras telas de cadastro de cliente do painel.
- **Aceite medido:** Chrome do Android, Novo agendamento: tocar no nome e no telefone não sugere os dados da dona do aparelho (0 sugestões).
- **Guarda:** teste de fonte: todo `PhoneInput` dentro de `src/app/admin/` passa `autoComplete="off"`. Mutação: remover num arquivo reprova; controle positivo: a guarda acha os usos (contagem > 0).
- **Risco:** perder a sugestão útil para quem marca a si mesma. Medir: não existe esse caso no painel.
- **Tamanho:** P

### EXP-K09 · Nenhum toque espera sem avisar na entrada e nas telas da cliente
- **Frente:** jornada
- **Lado:** os dois
- **Jornada:** P1, C1, C2
- **Classe:** Recomendado
- **Quando:** antes do lançamento
- **Hoje (FATO):** sem `loading.tsx` em 9 rotas (K-08); botão destrava antes da navegação em entrar, onboarding e cadastro (K-07).
- **Depois (meta):** resposta visível ao toque em ≤ 100 ms em toda navegação dessas rotas; botão fica em "carregando" até a tela nova montar.
- **O que muda:** `loading.tsx` com esqueleto em `(public)/[slug]`, `agendar`, `confirmar`, `avaliar`, `convite`, `onboarding`; `formulario-numero.tsx`, `onboarding/formulario.tsx`, `cadastro/formulario.tsx` sem `setPendente(false)` no caminho de sucesso.
- **Aceite medido:** CPU 4× e Slow 4G: do toque em "Agendar horário" até algo mudar na tela ≤ 100 ms; tocar "Entrar" duas vezes seguidas gera 1 POST (aba Network).
- **Guarda:** estender `telas-do-admin-tem-loading` para essas rotas públicas; teste de fonte que o `finally` dos três formulários não reabre o botão depois de `router.push`. Mutação: apagar um `loading.tsx` reprova.
- **Risco:** esqueleto que pisca em rede boa. Medir: CLS ≤ 0,1.
- **Tamanho:** M

### EXP-K10 · Saída de erro da cliente fala em nome do salão
- **Frente:** jornada
- **Lado:** cliente
- **Jornada:** C1, C2
- **Classe:** Recomendado
- **Quando:** serve ao piloto
- **Hoje (FATO):** "Ir para o início" leva à home do CICLO (`confirmar/[token]/page.tsx:30`, `avaliar/[token]/page.tsx:27`, `reivindicar.tsx:43`); erro de rede do agendar cita "Confirmar" (`agendar.tsx:595`); conta pausada só oferece "Ligar para o negócio" (`[slug]/layout.tsx:67`).
- **Depois (meta):** quando o token diz o salão, a saída é "Falar com {salão} no WhatsApp" ou a página dele; quando não diz, nenhuma saída leva ao site do CICLO. O erro do agendar cita "Pedir este horário".
- **O que muda:** os três arquivos acima, `erro-publico.tsx` (saída opcional), `agendar.tsx:595`, `[slug]/layout.tsx` (WhatsApp antes do telefone).
- **Aceite medido:** abrir `/confirmar` e `/avaliar` com token vencido de um salão local: 0 links para `/`; 1 botão que abre o WhatsApp do salão.
- **Guarda:** teste de fonte que reprova `href: '/'` em `src/app/(public)/{confirmar,avaliar,lista-espera}`; teste que o texto de erro de `confirmar()` em `agendar.tsx` cita o mesmo rótulo de `BarraFixaDeConfirmacao`. Mutação: renomear o botão sem mudar a frase reprova.
- **Risco:** token sem salão (forjado). Medir: a tela continua com título e texto, sem botão.
- **Tamanho:** P

### EXP-K11 · Recuperar: filtro que falha avisa, e a fila diz tudo em palavras
- **Frente:** jornada
- **Lado:** profissional
- **Jornada:** P3
- **Classe:** Recomendado
- **Quando:** serve ao piloto
- **Hoje (FATO):** `trocarFiltro` sem `catch` (`recuperar.tsx:90-107`); "12d de atraso" (`:341`); "Confirmar" sozinho no destrutivo (`fila.tsx:168`); "Chamar" só ícone na lista (`:368-380`).
- **Depois (meta):** sem rede, toast "Sem conexão: a lista continua a de antes" e o chip volta ao filtro anterior; "12 dias de atraso"; "Não chamar mais"; "Chamar" com texto visível ao lado do ícone.
- **O que muda:** `admin/recuperar/recuperar.tsx`, `admin/recuperar/fila.tsx`.
- **Aceite medido:** DevTools offline, trocar o filtro: o chip ativo continua o anterior e a região viva não anuncia contagem nova; P3 continua ≤ 2 toques até o WhatsApp aberto.
- **Guarda:** `rede-nao-derruba-tela` passa a exigir `catch` em `trocarFiltro` (linha de base só encolhe). Mutação: tirar o `catch` reprova.
- **Risco:** texto do "Chamar" alarga a linha a 320 px. Medir: `scrollWidth === innerWidth` a 320 px.
- **Tamanho:** P

### EXP-K12 · Primeiro dia acessível: onboarding e perfil com foco, anúncio e 48 px
- **Frente:** jornada
- **Lado:** profissional
- **Jornada:** P1
- **Classe:** Recomendado
- **Quando:** antes do lançamento
- **Hoje (FATO):** busca sem `aria-live` e foco perdido ao escolher profissão (`onboarding/formulario.tsx:121-176`); etapas trocam sem foco (`perfil/formulario.tsx:94, 99`); "Pular esta pergunta" e "Voltar" de uns 18 px (`:154-261`); `role="radio"` falso (`:143, 243`).
- **Depois (meta):** foco vai para o título de cada etapa nova; busca anuncia "N profissões"; todo alvo ≥ 48 px; opções como botões simples.
- **O que muda:** `onboarding/formulario.tsx`, `onboarding/perfil/formulario.tsx`.
- **Aceite medido:** sondagem `elementFromPoint` a 375 px: 4 links de pular com ≥ 48 px de área real; TalkBack anuncia o título de cada etapa (gravação).
- **Guarda:** `alvo-de-toque-tem-48` passa a cobrir `onboarding/`; `agendamento-anuncia-mudanca` ganha caso para a busca de profissão. Mutação: tirar `min-h-12` de um "Pular" reprova.
- **Risco:** foco que pula a tela no celular sem leitor. Medir: `scrollY` não muda ao trocar de etapa.
- **Tamanho:** M

### EXP-K13 · "Quem você já atende" com rótulo em todo campo, e guarda que vê `select`
- **Frente:** jornada
- **Lado:** profissional
- **Jornada:** P1, C4
- **Classe:** Recomendado
- **Quando:** serve ao piloto
- **Hoje (FATO):** `<select>` sem rótulo (`ja-atendo/formulario.tsx:280`); busca sem região viva (`:448-504`); "1 pessoa já está atrasadas" (`:173`); telefone cru (`:500`).
- **Depois (meta):** `aria-label="Quando {nome} veio"`; região viva com "N encontradas"; concordância certa; telefone formatado.
- **O que muda:** `admin/clientes/ja-atendo/formulario.tsx`, `tests/unit/design/todo-campo-tem-rotulo.test.ts`.
- **Aceite medido:** axe na tela com uma pessoa de retorno adicionada: 0 "select-name".
- **Guarda:** `todo-campo-tem-rotulo` varre `<select` e `<textarea`. Mutação: tirar o `aria-label` novo reprova; controle positivo: a guarda conta mais de 0 `select`.
- **Risco:** a guarda acusar `select` já rotulado por `<label>` envolvente. Medir: rodar antes e ver a lista inteira.
- **Tamanho:** P

### EXP-K14 · Desativar profissional com confirmação e caminho de volta
- **Frente:** jornada
- **Lado:** profissional
- **Jornada:** P6, P7
- **Classe:** Recomendado
- **Quando:** serve ao piloto
- **Hoje (FATO):** um toque desativa (`lista.tsx:419`); não há "Reativar" na tela.
- **Depois (meta):** "Desativar {nome}?" com a consequência ("some da página de agendamento; os horários marcados continuam") e "Reativar" na lista de inativas.
- **O que muda:** `admin/config/profissionais/lista.tsx`, rota PATCH que já aceita `active`.
- **Aceite medido:** desativar e reativar no banco local em ≤ 4 toques; a profissional volta a aparecer em `/[slug]` depois de reativar.
- **Guarda:** teste de fonte que `desativar(` só é chamado dentro do passo de confirmação. Mutação: chamar direto no `onClick` reprova.
- **Risco:** um toque a mais. Medir: é ação rara.
- **Tamanho:** P

### EXP-K15 · Gênero: decidir a régua e fechar os buracos da guarda
- **Frente:** jornada
- **Lado:** os dois
- **Jornada:** P2, P3, P4, P6, avaliação
- **Classe:** Do Vitor (feminino ou neutro; `docs/111` C1.1 diz que trocar a guarda é dele). **Padrão de trabalho provisório (não é decisão dele):** neutro, como manda A2.
- **Quando:** antes do lançamento
- **Hoje (FATO):** supõe mulher em 5 lugares que a guarda não vê (K-22); masculino genérico em 10 rótulos do painel (K-23); a mesma tela mistura os dois (`recuperar.tsx:38-42` contra `nota-do-cliente.ts:70-77`).
- **Depois (meta):** nenhuma frase supõe gênero de quem usa nem de quem é atendido. Ex.: "Quem você atende trouxe 3 pessoas novas", "O horário vai para esse cadastro", "Pela indicação, a pessoa agenda…", filtros "Todo mundo / Atrasou / Sumiu", "Nova pessoa na equipe", "Toda a equipe".
- **O que muda:** `hoje.tsx:480`, `vazio-de-recuperar.ts:49, 67`, `recuperar.tsx:38-42`, `nota-do-cliente.ts:70-77`, `novo/formulario.tsx:434, 634`, `avaliar.tsx:146`, `fila.tsx:177`, `perfil/formulario.tsx:130`, `config/profissionais/formulario.tsx`, `lista.tsx:303-309, 397`, `caixa.tsx:147`, `agenda.tsx:128`, e a guarda.
- **Aceite medido:** leitura das 13 telas a 375 px: 0 frases com "suas clientes", "dela/ela" sobre cliente, "Todas/Atrasadas" e "Novo/Sumido" sobre pessoa.
- **Guarda:** `SUPOE_MULHER` ganha possessivo (`\b(suas?|minhas?|nossas?)\s+clientes?\b`), pronome perto de cliente/indicação e os rótulos elípticos conhecidos. Mutação: reintroduzir "Suas clientes trouxeram" reprova; controle positivo no autoteste.
- **Risco:** frase neutra que soa fria. Medir: ler com 3 profissionais do piloto.
- **Tamanho:** M

### EXP-K16 · Polimento de copy e alvos das jornadas
- **Frente:** jornada
- **Lado:** os dois
- **Jornada:** P2, P4, P5, C1, C2
- **Classe:** Recomendado
- **Quando:** depois do piloto
- **Hoje (FATO):** K-25 (alvos pequenos em 7 lugares), K-26 (avisos que nascem com conteúdo), K-27 (`/confirmar` sem foco e "Sentimos falta!"), K-28 (lista de espera sem salão e serviço), K-31 (botões sem objeto: "Mensagem", "Chegou", "Informar", "Config."), K-32 (hoje em UTC), K-33 (e-mail e "Onde vai ser" no agendar; "a equipe" para autônoma), K-35 (cor apaga o foco), K-37 (caixa leva à agenda), K-38 (modelos "Posso confirmar?", "mimo", remarcar sem link).
- **Depois (meta):** todo alvo ≥ 48 px medido; todo botão com verbo e objeto; C1 com 2 campos a menos por padrão.
- **O que muda:** os arquivos citados em cada K.
- **Aceite medido:** sondagem `elementFromPoint` sem alvo < 48 px nas 13 telas; C1 contada no navegador com 2 campos a menos.
- **Guarda:** `alvo-de-toque-tem-48` cobre as telas novas; teste de fonte que `agenda.tsx` não usa `new Date()` cru para "hoje". Mutação: voltar `paraISO(new Date())` reprova.
- **Risco:** esconder o e-mail de quem queria deixar. Medir: deixar atrás de "Adicionar e-mail".
- **Tamanho:** M

### Os 5 que mais rendem

1. **EXP-K01**: destrava a equipe inteira (P6, P7). Hoje é beco para quem entra pelo número.
2. **EXP-K02**: evita que a primeira tela de toda profissional nova falhe se a branch subir antes da Meta.
3. **EXP-K04**: a cliente fica sabendo quando a profissional marca, remarca ou cancela. Corta o "apareci e não tinha horário".
4. **EXP-K03**: põe C2 de pé hoje, sem esperar a Meta: 1 toque para confirmar.
5. **EXP-K05**: tira os erros de português e a promessa de desconto do texto que sai em nome do salão.
