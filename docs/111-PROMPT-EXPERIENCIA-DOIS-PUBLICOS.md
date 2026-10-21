# CICLO · PROMPT-CONTRATO DA AUDITORIA FINAL ANTES DO LANÇAMENTO (20/10/2026)

> **Como usar:** abra uma sessão com acesso ao repositório do CICLO e mande: "execute o `docs/111-PROMPT-EXPERIENCIA-DOIS-PUBLICOS.md`" (pode ser com `/loop`).
> **Fonte de verdade da missão.** Se o contexto for resumido, RELEIA este arquivo e `docs/112-experiencia/_progresso.md` antes de continuar.
> **Esta etapa produz o PLANO. Não implementa nada.** A execução vem depois, ticket por ticket, com outro comando.
> **É a última auditoria grande antes de lançar.** O que ela não pegar vai para a mão da primeira cliente pagante. Trate como tal.

---

# PARTE A · CONTRATO

## A0. Quem sou, o que quero

Sou o **Vitor**, dono do CICLO desde 17/10/2026. Escreva **simples, frase curta, sem jargão**. Termo técnico inevitável se explica na mesma frase. O plano pode ser longo; cada frase dele, não.

O CICLO virou **um app só para dois públicos**, focado em **salão e beleza feminina** (`docs/108-norte`, `docs/109-marca-feminina`, `docs/110-um-app-dois-publicos`):

| Público | Quem é | O que quer do app |
| --- | --- | --- |
| **Autônoma** | lash designer, designer de sobrancelha, manicure, nail designer, cabeleireira; sozinha, em casa, em sala ou em cadeira alugada; celular numa mão, cliente na cadeira | agenda que enche sozinha, saber quem sumiu e quanto vale, chamar pelo WhatsApp dela, saber quanto sobrou |
| **Dona de salão** | de 2 a 6 profissionais, às vezes recepção | ver a agenda de todas, a equipe entrando com o próprio número, o dia de cada uma e a comissão, sem virar contadora |
| **Profissional da equipe** | trabalha no salão de outra pessoa | a própria agenda e as próprias clientes, nada além |
| **Cliente** | quase sempre mulher, só celular, vive no WhatsApp, não quer baixar nada nem criar conta para marcar | marcar em segundos, não esquecer, remarcar sem constrangimento, voltar na hora da manutenção e, se quiser, ver os lugares onde é atendida |

Quero **um plano que deixe o CICLO pronto para lançar**, com a experiência dos dois lados **100 vezes melhor**. São quatro frentes, todas obrigatórias:

| # | Frente | O que significa |
| --- | --- | --- |
| 1 | **O produto inteiro com cara de salão** | Ler o produto de cabo a rabo. Toda tela, demonstração, calculadora, preço, conta de exemplo, catálogo pronto, mensagem e exemplo passa a falar de salão e beleza feminina, não de barbearia nem de "qualquer profissão" (Parte C1) |
| 2 | **Jornadas 10× mais curtas** | As 13 jornadas de A7 medidas hoje e com meta de tempo, toques e dúvida (Parte A7) |
| 3 | **Avisos e notificações personalizáveis dos dois lados** | Push, pop-up, aviso dentro do app e mensagem, configuráveis pela profissional e pela cliente, puxados pelo Motor de Ciclo (Parte C2) |
| 4 | **Leve e rápido** | Cada toque responde na hora, em celular simples e internet ruim, medido (Parte C3) |

"100 vezes" não é slogan. Para cada jornada, reduzir tempo, toques, dúvida e erro **por uma ordem de grandeza**, medido antes e depois. Melhora de 10% em tela que ninguém abre não entra.

## A1. Papéis que você assume (todos ao mesmo tempo)

1. **Designer de produto sênior** de app de serviço para mulheres no Brasil, mobile-first, que conhece Booksy, Fresha, GlossGenius, Trinks, Gendo, Agendiva e os apps que a cliente já usa todo dia (WhatsApp, iFood, Nubank).
2. **Pesquisador(a) de experiência**: separa o que a pessoa **diz** do que ela **faz**, e o que é **medido** do que é **achado**.
3. **Engenheiro(a) de desempenho** de Next.js 15, React 19, Supabase e Vercel: mede antes de opinar.
4. **Engenheiro(a) de notificação**: sabe que aviso demais vira silenciado e aviso de menos vira cliente perdida; respeita opt-out, LGPD e a regra de não prometer canal.
5. **Redator(a) de interface PT-BR**: na voz da casa, sem supor gênero de quem usa o painel nem de quem é atendido (guarda `copy-nao-supoe-genero`), falando em nome do salão na página pública.
6. **Auditor(a) adversarial de lançamento**: desconfia de "já é intuitivo", "já funciona", teste verde que não testa, métrica que melhora quando o produto piora, tela bonita que não grava, funcionalidade que existe no código e não no ar.

## A2. Missão, permissões e proibições

**Missão:** produzir o **PLANO DA AUDITORIA FINAL** em `docs/112-experiencia/`, com diagnóstico medido, propostas, tickets executáveis com aceite medido, revisão adversarial e a lista de **pronto para lançar** (B5).

**Pode e deve:**
- rodar o app no **banco local isolado por worktree** (memória `supabase-local-isolado-por-worktree`), semear contas de demonstração dos dois lados e **usar o produto de verdade** no navegador a 375 px e no desktop, nos temas claro e escuro;
- **abrir cada rota** de `src/app` pelo menos uma vez (Parte C1), não só as das jornadas;
- cronometrar e contar toques de cada jornada (A6);
- abrir os concorrentes no navegador como visitante e medir as mesmas jornadas neles;
- disparar agentes em paralelo (A9).

**Não pode:**
- implementar, commitar código de produto ou mudar banco;
- tocar produção (`seuciclo.com.br`, Supabase `eqzlv…`), criar conta em concorrente, preencher formulário de terceiro ou guardar telefone e e-mail de pessoa real;
- propor **vitrine, diretório, busca de salões ou "perto de você"** para a cliente. Está vetado (`docs/110` §0): a cliente só vê negócio onde já foi atendida, e o negócio não vê onde mais ela vai;
- propor envio automático de WhatsApp para cliente final sem a credencial da Meta e sem o aquecimento do número (`docs/74-AQUECIMENTO-WHATSAPP-PLANO.md`, `.github/workflows/cron.yml`, onde `reminders` e `campaigns` estão fora do agendamento **de propósito**);
- supor gênero na gramática. O feminino entra pelo assunto, pelos exemplos e pela ordem das profissões (`docs/109-marca-feminina/00-pesquisa.md` §5).

**Ambiente:** antes de qualquer consulta, registre banco, host, projeto e se é produção. Se houver dúvida, **pare**. Confira para onde cada `.env.local` aponta.

## A3. Evidência

Toda afirmação leva um rótulo: **FATO** (medido ou lido, com caminho, linha, número ou captura), **INFERÊNCIA** (com a conta junto), **HIPÓTESE** (a medir) ou **NÃO VERIFICADO**.

**Hierarquia de confiança:** execução observada > banco local > migrations > código > testes > config > docs > comentários > memória.

**Proibido:** "fica mais fácil" sem número; "a cliente prefere" sem fonte; contar toque lendo o código (conte no navegador); dar como resolvido o que só foi lido; "rápido" sem medida no aparelho de A6.

## A4. Insumos obrigatórios (ler antes de planejar; citar o que usou)

**Direção do produto**
- `docs/108-norte/` (branch `aprimoramento/plano-2026-10-13-docs`): público, teste de campo, o que está congelado até 15/12.
- `docs/109-marca-feminina/`: marca, cor, fonte e copy.
- `docs/110-um-app-dois-publicos/00-plano.md`: as fases L1 a L6 (a L1, login por número, está feita) e as perguntas abertas.
- `docs/concorrentes/beleza-feminina/` (mesma branch): 14 concorrentes, reputação, voz da profissional e canais.

**Experiência já trabalhada (não refazer; conferir se ficou de pé)**
- `docs/11-INTERFACE-ESTRUTURA-E-FLUXO.md`, `docs/15-AUDITORIA-DESIGN-UX.md`, `docs/61` (experiência de uso), `docs/97` e `docs/98-aprimoramento/`.
- `docs/20-COPY-PLANO.md` e as guardas de copy em `tests/unit/design/`.

**Avisos e automação já feitos**
- `docs/39-AUTOMACOES-PERSONALIZADAS-PLANO.md` (por que a recomendação contrariou o pedido literal de "a pessoa cria a própria automação"), `docs/33-AUTOMACAO-AGENTE-PLANO.md`, `docs/74-AQUECIMENTO-WHATSAPP-PLANO.md`.
- Código: `src/server/services/{automacoes,lembretes,campanhas,mensageria,push,mensagens-prontas}.ts`, `src/core/{automacoes,reminders,mensageria,messaging,cycle}`, telas `src/app/admin/config/{automacoes,notificacoes,mensagens}`, `src/server/providers/messaging/{whatsapp,push}.ts`, `.github/workflows/cron.yml`.

**Desempenho já feito**
- `docs/28-LATENCIA-DE-CLIQUE-PLANO.md`, `docs/42-PESO-NO-CELULAR-PLANO.md`, `docs/107-PROMPT-CLIQUES-RAPIDOS.md` e a memória `ciclo-latencia` (cold start é um só, não um por rota) e `vercel-regiao-do-banco`.

**Protocolos da casa (fora do repositório)**
- `C:\Users\Usuario\.claude\code\DESIGN-E-INTERFACE.md` (§1 a §14 ao propor, §15 ao revisar).
- `C:\Users\Usuario\.claude\code\VERIFICACAO-FINAL.md` (os 15 gates: esta é a auditoria em que eles valem para o lançamento).
- `CLAUDE.md` do repositório.

## A5. Lições da casa que o plano TEM de respeitar

- **Medir, não estimar.** Leitura de código não pega toque, overflow nem demora (memória `auditoria-medir-nao-estimar`). Três "achados" já caíram ao serem medidos (`medicao-ingenua-da-falso-positivo`).
- **No celular, `innerWidth` pode ser maior que a tela.** "Sem rolagem lateral" só vale com `innerWidth` igual à largura (`celular-innerwidth-maior-que-a-tela`).
- **Prévia que não grava não serve.** Toda tela que calcula tem que persistir o que mostrou (`previa-que-nao-persiste`).
- **Não prometer canal.** Só diga "vai receber no WhatsApp" se houver rota agendada e credencial (CLAUDE.md). Hoje o WhatsApp oficial ainda não está ligado (`docs/runbooks/login-por-numero.md`).
- **Produção atrás do código.** Migration no repositório não é migration no banco; funcionalidade na branch não é funcionalidade no ar (memória `producao-atras-do-codigo`, `docs/108-norte/03-guia-da-pilha.md`).
- **Guarda tem que ser vista reprovando.** Todo ticket que cria guarda prevê a mutação que ela pega.
- **O conserto pode ser pior que o defeito.** Mudança de alvo de toque já zerou um link (`conserto-pode-ser-pior-que-o-defeito`).
- **A objeção da profissional não é preço, é "mais um lugar para olhar"** (`docs/concorrentes/beleza-feminina/05-relatorio.md`). Proposta que tira ela do WhatsApp perde.
- **A queixa nº 1 do setor é cancelar** (multa, renovação, estorno). Nada no plano pode prender ninguém.
- **Byte cru é a régua errada.** Cortar marcação não economiza rede, porque o brotli já comprime (`byte-cru-e-a-regua-errada`). Meça o que a pessoa sente: tempo até usar e tempo de resposta ao toque.

## A6. Como medir (todos medem igual)

- **Aparelho:** viewport 375×812 com toque emulado, CPU com lentidão 4× e rede "Fast 4G" do DevTools; cache vazio na primeira vez e cheio na segunda. Repita o pior caso com "Slow 4G".
- **Tempo:** do toque até a próxima tela utilizável (não até o "carregou"), média de 3 rodadas.
- **Toques:** cada toque e cada campo digitado conta 1; rolagem não conta.
- **Dúvida:** pontos em que uma pessoa nova pararia sem saber o que fazer (anote a tela e o porquê).
- **Erro:** caminhos que levam a estado errado, tela vazia ou mensagem que não diz o que fazer.
- **Desempenho:** LCP, INP e CLS de cada tela das jornadas; JavaScript enviado por rota (comprimido); tempo de servidor (TTFB) separado do tempo de tela.
- Toda medida vira linha em `docs/112-experiencia/medidas/`, com data, conta, rota e captura.

## A7. Régua: jornadas e metas iniciais

As metas são **[HIPÓTESE]**. A Fase 0 confirma ou ajusta, com justificativa.

**Profissional (autônoma e dona)**

| # | Jornada | Meta inicial |
| --- | --- | --- |
| P1 | Do link de cadastro (agora por número, L1) até a primeira cliente marcada na agenda | ≤ 3 min, ≤ 15 toques |
| P2 | Abrir o app de manhã e saber o que fazer hoje | ≤ 5 s, 0 toques |
| P3 | Ver quem passou do dia da manutenção e chamar uma pelo WhatsApp | ≤ 2 toques até o WhatsApp aberto com o texto pronto |
| P4 | Marcar uma cliente que pediu pelo WhatsApp | ≤ 20 s, ≤ 6 toques |
| P5 | Fechar o dia e saber quanto entrou e quanto sobrou | ≤ 10 s |
| P6 | Dona: trazer uma profissional para a equipe | ≤ 1 min, sem e-mail |
| P7 | Dona: ver a agenda de todas e o dia de cada uma | ≤ 2 toques |

**Cliente**

| # | Jornada | Meta inicial |
| --- | --- | --- |
| C1 | Do link na bio até o horário marcado | ≤ 45 s, ≤ 8 toques, sem conta |
| C2 | Receber o lembrete e confirmar | 1 toque |
| C3 | Remarcar sem falar com ninguém | ≤ 3 toques (hoje não existe, `docs/110` §1) |
| C4 | Voltar na hora da manutenção | um aviso no dia certo, que marca em ≤ 3 toques |
| C5 | Criar a conta pelo número e ver "meus lugares" | ≤ 30 s |
| C6 | Sair do CICLO: apagar a conta e baixar os dados | ≤ 1 min, sem pedir para ninguém |

**Frases-objetivo:** "a profissional nunca precisa de ajuda para usar"; "a cliente marca mais rápido do que mandando mensagem"; "ninguém fica preso"; "nenhum toque espera sem avisar".

## A8. Classificação de cada decisão

Cada proposta leva uma classe:
- **Decidido**: já decidido em doc ou pelo Vitor, com citação;
- **Recomendado**: sua recomendação, com evidência e com a alternativa descartada;
- **Do Vitor**: só ele decide (preço, nome, o que congela, canal pago, mexer em veto, o que cada aviso diz em nome do salão). **Nunca escolha sozinho.** Se precisar seguir, declare um **padrão de trabalho provisório** e diga que é padrão, não decisão dele (memória `prompts-contrato-do-eduardo`);
- **Bloqueado**: depende de algo de fora (credencial da Meta, conta na loja), dizendo o quê.

**Pergunta aberta que muda o plano inteiro (Do Vitor):** o congelamento de funcionalidade do `docs/108-norte` até 15/12 cai? O plano tem de funcionar nos dois casos: marque cada ticket como **"serve ao piloto"** (pode entrar já) ou **"depois do piloto"**.

## A9. Agentes em paralelo

Dispare em paralelo, cada um com um entregável próprio em `docs/112-experiencia/`:
1. **Varredura do produto inteiro** (Parte C1): toda rota aberta, todo texto e exemplo lido;
2. **Jornadas da profissional** (P1 a P7) medidas no CICLO, com capturas;
3. **Jornadas da cliente** (C1 a C6) medidas no CICLO, com capturas;
4. **Avisos e notificações** (Parte C2): o que existe, o que dispara de verdade, o que a concorrência faz;
5. **Desempenho** (Parte C3) das telas das jornadas;
6. **Concorrentes**: as mesmas jornadas e os mesmos avisos no Booksy, Fresha, Trinks, Gendo e Agendiva, como visitante, sem criar conta;
7. **Copy e acessibilidade** das telas das jornadas (leitor de tela, contraste, alvo de toque, gênero).

Cada agente devolve FATO com evidência e lista de defeitos com severidade. Você junta, confere o que parecer bom demais e escreve o plano.

---

# PARTE B · O QUE ENTREGAR

## B1. Arquivos

```
docs/112-experiencia/
  _progresso.md          o que já foi feito, para retomar depois de resumo de contexto
  00-resumo.md           uma página: as 5 mudanças que mais rendem para cada lado, em ordem, e o veredito de lançamento
  01-diagnostico.md      Fase 0: cada jornada medida hoje, contra a meta e contra o melhor concorrente
  02-profissional.md     propostas para autônoma, dona e equipe
  03-cliente.md          propostas para a cliente, incluindo a área da conta (L3 a L5 do docs/110)
  04-salao.md            Parte C1: o produto inteiro com cara de salão
  05-avisos.md           Parte C2: notificações e avisos dos dois lados
  06-desempenho.md       Parte C3: leve e rápido
  07-tickets.md          tickets executáveis
  08-revisao.md          revisão adversarial do próprio plano
  09-pronto-para-lancar.md   a lista de B5, item por item, com o estado de cada um
  medidas/               planilhas e capturas
```

## B2. Formato de cada ticket

```
EXP-NNN · título curto
Frente: salão | jornada | avisos | desempenho
Lado: profissional | cliente | os dois
Jornada: P3, C1...
Classe: Decidido | Recomendado | Do Vitor | Bloqueado
Quando: serve ao piloto | depois do piloto | antes do lançamento
Hoje (FATO): tempo, toques, dúvida ou texto medidos, com captura
Depois (meta): o que a pessoa vê e sente, com número
O que muda: telas e arquivos
Aceite medido: como provar no navegador, com número
Guarda: teste que pega a volta do defeito, e a mutação que ele reprova
Risco: o que pode piorar, e como medir que não piorou
Tamanho: P | M | G
```

## B3. Ordem do plano

1. **Onda 0, urgente:** o que trava, perde dado, cobra errado, mostra número errado, vaza dado, deixa alguém preso ou promete canal que não existe.
2. **Onda 1, cara de salão:** tudo da Parte C1 que uma profissional nova ou uma cliente veem no primeiro contato (home, demonstração, calculadora, preços, cadastro, catálogo pronto, página do salão).
3. **Onda 2, todo dia:** as jornadas P2, P3, C1 e C2, e os avisos que as sustentam.
4. **Onda 3, leve e rápido:** as telas dessas jornadas dentro das metas de C3.
5. **Onda 4:** P1 e C4 (primeiro dia da profissional e volta da cliente na manutenção).
6. **Onda 5:** a área da cliente (C3, C5, C6) e a equipe (P6, P7), seguindo o `docs/110`.
7. **Onda 6:** o resto que a análise achar e que renda.

## B4. Revisão adversarial (obrigatória, em `08-revisao.md`)

Para cada onda, responda:
- Qual proposta **piora** alguma jornada que não é a dela?
- Qual meta melhora **mesmo se o produto piorar** (exemplo: "menos toques" tirando uma confirmação que evitava erro; "mais avisos abertos" mandando mais avisos)?
- O que depende de canal que ainda não existe (WhatsApp oficial)?
- O que uma autônoma de cidade pequena, com celular simples e internet ruim, não conseguiria usar?
- O que deixaria a cliente presa, incomodada com aviso demais, ou a profissional com vergonha na frente da cliente?
- O que ainda tem cara de barbearia e ninguém abriu para ver?

## B5. Pronto para lançar (o veredito)

O plano termina com `09-pronto-para-lancar.md`: cada item com **sim, não ou bloqueado**, a evidência e o ticket que fecha. O veredito final é **lança**, **lança com ressalvas** (listadas) ou **não lança** (com o que falta).

- As 13 jornadas medidas hoje, no CICLO e em pelo menos 3 concorrentes.
- Nenhuma tela, exemplo ou conta de demonstração com cara de barbearia ou de "qualquer profissão" no caminho de quem chega (C1).
- Os avisos dos dois lados desenhados, com o que já pode ligar e o que espera a Meta (C2).
- As telas das jornadas dentro das metas de C3, ou o ticket que leva lá.
- Os 15 gates do `VERIFICACAO-FINAL.md` respondidos.
- O que está na branch e não está no ar listado, com a ordem de publicação (`docs/108-norte/03-guia-da-pilha.md`).
- Cada lado com as suas **5 mudanças que mais rendem**, com o ganho previsto em número.
- Todo ticket com aceite medido e guarda prevista.
- A revisão adversarial feita e mudando alguma coisa (se não mudou nada, ela não foi feita).
- O `00-resumo.md` cabendo numa tela de celular, para o Vitor decidir lendo só ele.

---

# PARTE C · AS TRÊS FRENTES NOVAS

## C1. O produto inteiro com cara de salão

**Pedido do Vitor (20/10):** "repensa como produto o que deveria mudar: a página de demonstração, a calculadora, tudo isso tem que mudar também; lê o produto de cabo a rabo; põe os exemplos agora de salão."

**Como fazer:**
1. Abra **cada rota** de `src/app` (painel, públicas, entrada, onboarding) com uma conta de **salão de beleza** semeada: unhas, cílios e sobrancelha numa autônoma; cabelo e unhas num salão com equipe.
2. Para cada tela, anote todo texto de exemplo, placeholder, nome fictício, serviço pronto, valor padrão, ícone e ordem de lista que ainda fala de barbearia, de homem ou de "qualquer profissão".
3. Proponha a troca com a palavra de salão, sem supor gênero na gramática (A2).
4. **Contas de demonstração:** a primeira coisa que alguém vê no "Ver funcionando, sem cadastro" tem que ser um salão de beleza com agenda cheia e realista (serviços, ritmos e preços do `docs/concorrentes/beleza-feminina/05-relatorio.md` §3), não uma barbearia.
5. **Calculadora e preços:** os exemplos, os valores padrão e a unidade ("manutenção", "aplicação", "esmaltação") de salão.
6. **Catálogo pronto** (`vertical_packs`): conferir serviços, durações, preços e ritmos de cada profissão da beleza contra o mercado de 2026.

**O inventário inicial já levantado** está em C1.1 (abaixo). Ele é o ponto de partida, não o teto: a varredura confirma cada item no navegador e acha o que faltou.

### C1.1 Inventário inicial (levantado em 20/10/2026, a confirmar)

Levantado no código da branch `marca/feminina-2026-10-20`. A home, a prévia do link e o `llms.txt` já foram trocados (`docs/109` F3). Tudo abaixo é **FATO lido no código**; falta ver no navegador.

**Os 10 de maior impacto, em ordem (quem chega vê primeiro):**

| # | O quê | Onde | Hoje |
| --- | --- | --- | --- |
| 1 | **A demonstração abre numa barbearia** | `src/core/tenants/demonstracao.ts:103-125` (`SLUGS_DE_VITRINE`, "barbearia primeiro"), `src/app/(public)/[slug]/agendar/painel-do-dono-exemplo.tsx:54` (`SLUG_PADRAO = "demo-dom-estilo"`), capturas `public/exemplo/demo-dom-estilo-*.webp` | o "Ver funcionando, sem cadastro" da home e do `/links` cai na "Barbearia Dom Estilo" |
| 2 | **A calculadora pensa em barbearia** | `src/app/(public)/calculadora/calculadora.tsx:22,30-32,74,85`, `calculadora/page.tsx:26`, `src/core/aquisicao/calculadora.ts:46` | padrão 8 clientes, R$ 35, 30 dias ("barbearia de cidade pequena"); descrição "para salão e barbearia"; "cílios/barba (15)". Manutenção de cílios é cerca de R$ 120 a cada 21 dias |
| 3 | **A escolha de profissão põe Barbearia em 3º e Cabelo em último** | `supabase/migrations/0022` (`professions.posicao`), ordem lida em `src/app/onboarding/page.tsx:35-41` | Cílios, Unhas, **Barbearia**, Sobrancelhas, Depilação, Estética, Tatuagem, **Cabelo** |
| 4 | **A prévia das mensagens usa homem e barba** | `src/app/admin/config/mensagens/editor.tsx:18-19` | "Bruno Almeida", "Corte + barba" |
| 5 | **Uma mensagem que chega à cliente erra o artigo** | `src/server/services/mensagens-prontas.ts:45` | "Essa semana **o** {{servico}}…" vira "o Manutenção", "o Escova" |
| 6 | **O assistente se apresenta para qualquer profissão** | `src/server/services/assistente.ts:42-47`, `src/core/inteligencia/planejar.ts:212` | "quem atende com hora marcada", "de manicure e barbeiro a eletricista…", "e se eu subir o corte para R$ 55?" |
| 7 | **"Qual sistema você usa?" começa por sistema de barbearia** | `src/core/onboarding/perfil.ts:26`, `onboarding/perfil/formulario.tsx:29-35` | AppBarber, Trinks, Belasis, BarbUp, Booksy; nenhum de beleza feminina (Gendo, Simples Agenda, Agendiva…) |
| 8 | **Exemplos de plano e fidelidade são de corte** | `admin/config/planos/editor.tsx:112`, `admin/config/planos/fidelidade-config.tsx:116`, `admin/clientes/[id]/fidelidade.tsx:296` | "Corte ilimitado", "Corte grátis", "Corte de hoje" |
| 9 | **Termos e páginas de divulgação** | `src/app/(public)/termos/page.tsx:101-102`, `src/app/(public)/links/page.tsx:27-32,55`, `docs/marketing/` | "barbearia" primeiro; "para quem tem agenda"; roteiro de lançamento citando "barbeiro, manicure, personal, faxineira" |
| 10 | **Masculino genérico no painel** | `src/core/crm/nota-do-cliente.ts:71-76` ("Novo", "Atrasado", "Sumido"), `src/core/billing/convite-do-ciclo.ts:61,64,75` ("um colega", "nós dois"), "o cliente / um cliente" em várias telas | ver a guarda abaixo antes de mexer |

**Contas de demonstração** (`scripts/seed-demo-6-negocios.mjs` e vizinhos):
- três das seis são barbearias (Navalha de Ouro, Corte Fino, Dom Estilo), com dono e equipe homens;
- os salões (Studio Bella, Salão Encanto, Espaço Vitória) estão com a profissão trocada: dois marcados como `nails` com equipe de cabelo e cílios;
- metade dos nomes de cliente é de homem (`NOMES_CLIENTES`, :169-176);
- a cor do dono ainda é o turquesa antigo (:253);
- `seed-demo-barbearia.mjs`, `seed-demo-crm-profundo.mjs`, `seed-demo-dom-rocha-carteira.mjs` e `seed-demo-dinheiro.mjs` giram em torno da barbearia `dom-rocha`.

**Catálogo pronto e Motor:**
- `0002_vertical_packs.sql:130` (barbearia) e `0057` (cabelo com "Corte masculino" R$ 45): conferir serviços, preços e ritmos de cada profissão da beleza contra o mercado;
- `src/core/cycle/servico-padrao-da-base.ts:35-40` (`SERVICO_DE_VOLTA`): "Corte" de barbearia primeiro e **nenhuma entrada para depilação, estética e cabelo**. Isso afeta quem o Motor chama de volta e com que serviço.

**Ficha da cliente e vocabulário:**
- `src/lib/preferencias.ts:11-16`: preferências de barbearia (máquina, navalha, cerveja);
- `admin/clientes/nova/page.tsx:21` e `admin/clientes/[id]/page.tsx:89` caem em `'barber'` quando a profissão está vazia;
- "cadeira" como unidade de custo: `admin/config/custo-fixo/editor.tsx:140`, `src/core/comanda/completude-do-lucro.ts:75`, `sobra-explicada.ts:105`, `src/core/inteligencia/falar.ts:146`. "Cadeira" serve para salão também, mas confira se a autônoma que atende em casa entende.

**Prioridade baixa:** o ícone de tesoura em "Serviços" (`topbar.tsx:27` e outros) também lê como cabelo; os sinônimos de "barbeiro" no importador (`ingestao/`) não aparecem para ninguém.

**Guardas que vão travar a troca (bom sinal: leia antes de mexer):**
- `tests/unit/design/copy-nao-supoe-genero.test.ts` (`SUPOE_MULHER`, :395 em diante) reprova "a/as/uma cliente(s)" e afins em qualquer texto de `src/`, inclusive no prompt do assistente e nas mensagens prontas. Trocar o masculino genérico por **construção neutra** ("quem sumiu", "a pessoa", `vocabulario.cliente`) passa na guarda; trocar por feminino exige mudar a guarda, e isso é **Do Vitor** (a guarda protege quem atende homem, e a barbearia continua aceita no cadastro).
- `vitrine-da-home-nao-e-literal.test.ts` e `seed-imagens-cobre-demos.test.ts` conferem a lista da vitrine e as imagens das contas de exemplo.
- O `CLAUDE.md` do repositório ainda diz "qualquer profissional… não só beleza (barbearia…)". Ele orienta toda sessão futura: propor a atualização é parte do plano (**Do Vitor**).

## C2. Avisos e notificações personalizáveis dos dois lados

**Pedido do Vitor (20/10):** "construção de notificações, pop-outs etc. personalizáveis dos dois lados, profissional e cliente, do negócio da recorrência, aproveitando o Motor."

**O que existe hoje (FATO a confirmar):** automações configuráveis (`docs/39`, `admin/config/automacoes`), push para a profissional (`admin/config/notificacoes`, `push.ts`), mensagens prontas que a profissional manda pelo próprio WhatsApp (`wa.me`), lembretes e campanhas automáticos **desligados de propósito** no agendador por falta da credencial da Meta (`.github/workflows/cron.yml`).

**O que o plano tem de desenhar:**

1. **Catálogo de eventos**, cada um com quem recebe, quando, por qual canal e o que o Motor de Ciclo põe nele:

| Lado | Evento (exemplos, a completar) | Motor de Ciclo |
| --- | --- | --- |
| Profissional | cliente passou do dia da manutenção | o dia vem do ritmo daquela cliente, não de prazo fixo |
| Profissional | horário vago amanhã que dá para preencher com quem está perto do dia | quem chamar e quanto vale |
| Profissional | cliente confirmou, cancelou, remarcou | — |
| Profissional | resumo do dia e da semana | quanto voltou por causa de um "Chamar" |
| Cliente | lembrete do horário, com confirmar em 1 toque | — |
| Cliente | "está chegando a hora da sua manutenção" | no dia certo do ritmo dela, com os horários livres da profissional dela |
| Cliente | horário remarcado, horário liberado na lista de espera | — |

2. **Canais, em ordem de custo e de risco:** aviso dentro do app (banner, cartão, pop-up), push do app e do navegador, e-mail, WhatsApp oficial. Para cada evento, diga **qual canal já pode ligar hoje** e qual espera a Meta (Bloqueado).
3. **Personalização da profissional:** ligar e desligar por evento, antecedência, texto com variáveis (nome, serviço, dia) com prévia **que grava** (A5), horário de silêncio, limite por semana para cada cliente, e o que vai em nome do salão. Releia o `docs/39` antes: ele explica por que "a pessoa cria a própria automação do zero" foi descartado.
4. **Personalização da cliente** (na área dela, L4 e L5 do `docs/110`): que avisos quer, por qual canal, com que antecedência, e sair de tudo em 1 toque (opt-out com efeito real, LGPD).
5. **Pop-ups dentro do app:** quando aparecem, quando somem, quantos por sessão, e como não atrapalham a profissional com a cliente na cadeira. Nada de pop-up que cobre o botão que ela ia tocar (memória `aviso-de-cookies-cobre-o-clique`).
6. **Medida de sucesso que não engana:** volta de cliente atribuída ao aviso, não "avisos enviados" nem "taxa de abertura" (memória `metrica-que-melhora-com-o-fracasso`).

## C3. Leve e rápido

**Pedido do Vitor (20/10):** "otimizar tudo, deixar leve e rápido."

**Metas iniciais [HIPÓTESE], no aparelho de A6:**

| Medida | Meta |
| --- | --- |
| Toque com resposta visível (INP) nas telas das jornadas | ≤ 200 ms |
| Tela utilizável depois de navegar dentro do app | ≤ 1 s com cache, ≤ 2,5 s sem |
| LCP da página do salão e do agendamento da cliente (4G, primeira visita) | ≤ 2,5 s |
| JavaScript da página do salão (comprimido) | o menor possível, com número de hoje e meta |
| Tela em branco ou "carregando" sem aviso | nenhuma |

**Como:** parta do que o `docs/28`, o `docs/42` e o `docs/107` já mediram e consertaram; meça de novo, porque a pilha de branches mudou muito desde então. Para cada tela fora da meta, ache **onde vai o tempo** (servidor, banco, rede, JavaScript, imagem, fonte) com evidência antes de propor o conserto. A fonte nova dos títulos (Fraunces, `docs/109` F2) entra na medida.
