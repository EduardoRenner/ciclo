# 86 · Plano jurídico — o que eu faço sozinho, e o que só uma pessoa habilitada assina

> **Escrito em 2026-09-29.** Pedido do Eduardo: "faz um plano para você mesmo fazer a parte do
> advogado". Este plano cobre `/termos`, `/privacidade`, o contrato de operador (DPA), a cláusula
> de dados agregados do `docs/84` §2.1 e tudo que o lançamento (`docs/87`) exige de texto legal.
>
> **O combinado honesto.** Eu redijo, pesquiso, monto o inventário a partir do código, escrevo os
> testes que impedem o texto de mentir e ligo o aceite versionado. Eu **não** substituo o parecer de
> quem responde por ele. A saída barata é esta: em vez de pedir a um advogado que **redija** do zero
> (dezenas de horas), entrego um dossiê pronto (§6) para ele **revisar** (algumas horas, preço fixo).
> Nada aqui vai ao ar sem o Eduardo aprovar, e o **pipeline agregado continua desligado** até o
> parecer da pergunta 1 (§4). Publicar a cláusula e ligar o pipeline são duas decisões separadas.

---

## 1 · O que os textos de hoje dizem, contra o que o código faz

Lido em 29/09 (`termos` versão 2026-09-21, `privacidade` 2026-09-16) contra `.env.example`,
`vercel.json`, o schema e as telas.

| # | O texto diz / omite | A realidade | Gravidade |
|---|---|---|---|
| F1 | Privacidade §4: "os servidores ficam no Brasil" | Banco em `sa-east-1` e funções em `gru1` (Brasil). Mas Vercel, Resend, hCaptcha, Sentry, PostHog, Upstash e a Meta são empresas/infra que podem processar fora. A frase é verdadeira só para o banco e as funções | **Alta** — afirmação factual que pode ser falsa |
| F2 | Privacidade §3 lista 4 terceiros (Mercado Pago, WhatsApp, Resend, Supabase) | `.env.example` tem também Upstash (limite de uso), hCaptcha, Sentry, PostHog, Vercel (hospedagem). Quais estão **ligados em produção** não dá para ver do repositório | **Alta** — lista incompleta de operadores |
| F3 | Termos não dizem quem é o fornecedor | Sem razão social, CNPJ ou endereço (`DECISOES`, linha ~1873, já registrava). O Decreto 7.962/2013 exige identificação do fornecedor em venda a distância [confirmar] | **Alta** para cobrar |
| F4 | Privacidade §7 promete resposta pelo canal de contato | As duas variáveis `NEXT_PUBLIC_CONTATO_*` faltam na Vercel (auditoria 27/09, B4): o texto cai em "responda o e-mail que você recebeu" | **Alta** — canal do titular é obrigação da LGPD |
| F5 | Termos §13: "continuar usando significa que concorda" | Vale para mudança pequena. Para cláusula nova de dados é fraco. A coluna `terms_acceptances.via = 'reaceite'` existe (0095), mas **nenhum código grava reaceite** | **Alta** para a cláusula agregada |
| F6 | Termos §5 e `/precos`: "grátis para sempre", "cobrança automática não está no ar" | O botão Assinar cobra de verdade pelo Mercado Pago (auditoria B5), e o modelo novo (`docs/87`) troca o grátis eterno por 2 meses de cortesia | **Alta** — o texto contradiz o produto |
| F7 | Retenção: "enquanto sua conta existir" | Sem prazo depois do cancelamento, sem prazo de backup, sem prazo de log. O Marco Civil (art. 15) manda guardar registro de acesso a aplicação por 6 meses [confirmar] | Média |
| F8 | O salão é controlador e o CICLO é operador (Privacidade §1) | Não há contrato de operador (DPA). A LGPD art. 39 diz que o operador segue instruções do controlador; hoje isso é uma frase, não um documento | Média |
| F9 | Página pública de agendamento pede nome e telefone da cliente final | Sem aviso nem link para a política nessa tela (`grep` em `(public)/[slug]` não acha `privacidade`) | Média |
| F10 | Nada sobre menores | Barbearia corta cabelo de criança; o cadastro é feito pelo responsável, mas o dado é de menor (LGPD art. 14) | Média |
| F11 | O assistente não usa IA externa desde o Motor (docs/85) | Verdade hoje, mas `AI_PROVIDER`/`gemini.ts` continuam no repo: nada impede voltar sem ninguém ver | Baixa, e vira **promessa verificável** com guarda |

Os 4 primeiros são os que eu corrigiria mesmo que o resto esperasse: são afirmação falsa ou canal
que não existe, e não dependem de nenhuma tese jurídica.

---

## 2 · Como eu trabalho (três camadas)

- **A · Verdade factual (baixo risco, alto valor).** Corrigir o que o texto afirma e o produto não
  faz: F1, F2, F4, F6. Não é interpretação de lei; é conferir.
- **B · Minuta v2 completa.** Termos, Privacidade, DPA, aviso na página pública, cláusula agregada.
  Eu escrevo; o Eduardo aprova antes de subir; a data em `core/legal/versoes.ts` muda no mesmo commit.
- **C · O que exige parecer humano.** Cinco pontos, com a minha posição por escrito (§4 e §6).

---

## 3 · Entregáveis, em ordem

| Id | Entrega | Onde fica | Pronto quando |
|---|---|---|---|
| **J1** | **Inventário de tratamento** (LGPD art. 37): cada tabela/campo com dado pessoal → finalidade → base legal (art. 7 ou 11) → retenção → quem mais toca. Sai do schema e do código, não da memória | `docs/legal/inventario-de-tratamento.md` | toda tabela com `client_id`, `phone`, `email`, saúde ou `user_id` aparece; guarda confere que **tabela nova com dado pessoal sem linha no inventário reprova** |
| **J2** | **Mapa de operadores** com país e o que cada um recebe: Supabase, Vercel, Mercado Pago, Meta/WhatsApp, Resend, Upstash, hCaptcha, Sentry, PostHog, Google (só se `AI_PROVIDER` ligar). Marcar o que está **ligado em produção** (Eduardo confere no painel de cada um) | `docs/legal/operadores.md` | cada linha tem: dado enviado, país, base da transferência (art. 33; cláusulas-padrão da ANPD, Res. 19/2024, prazo de adoção já vencido em ago/2025), DPA do fornecedor aceito ou pendente |
| **J3** | **Correção de fato (camada A)**: Privacidade §3/§4/§5 refeitas a partir do J2; F4 (canal); F6 (grátis/cobrança) | `privacidade/page.tsx`, `termos/page.tsx` | texto = J2; **guarda**: a lista de operadores na página é derivada da mesma constante que o J2 e confere com as variáveis de ambiente do `.env.example` (lista que envelhece sozinha é a guarda cega de sempre) |
| **J4** | **Termos v2** | `termos/page.tsx` | tem: fornecedor identificado (F3); programa de pré-lançamento (`docs/87`); plano único, renovação, cancelamento, arrependimento de 7 dias (CDC art. 49 [confirmar se o cliente é consumidor: MEI costuma ser tratado como vulnerável]), nota fiscal, graça de 7 dias (é o que o código faz); mudança de termos com aviso e **reaceite**; cláusula agregada (§4); assistente sem IA externa |
| **J5** | **Política v2** | `privacidade/page.tsx` | tem: base legal por finalidade; encarregado e canal; controlador × operador claros; transferência internacional; retenção concreta (§5); menores; dado de saúde; incidente (o controlador tem 3 dias úteis para comunicar ANPD e titular, Res. CD/ANPD 15/2024, e o DPA obriga o CICLO a avisar o salão **antes** disso); cookies |
| **J6** | **DPA** (contrato de operador) como anexo dos termos | `/termos/tratamento-de-dados` | objeto e instruções; confidencialidade; medidas de segurança **listadas a partir do código** (RLS forçada, cifra do cofre com chave separada, trilha de acesso, telefone com hash); operadores e aviso de troca; ajuda com direitos do titular (exportar e apagar já existem); aviso de incidente em até 24 h; devolução e eliminação no fim |
| **J7** | **Aviso na página pública de agendamento** | `(public)/[slug]/agendar` | texto curto: "seus dados vão para {salão}, que decide o uso; o CICLO só processa" + link; guarda de que o link está na tela |
| **J8** | **Aceite explícito no cadastro** (caixa não marcada, obrigatória, com link) e **fluxo de reaceite** | `cadastro`, `core/legal`, `terms_acceptances` | grava versão; conta com versão antiga vê aviso e aceita a nova (`via = 'reaceite'`); **o pipeline agregado só lê contas com aceite ≥ a versão da cláusula** (consulta escrita agora, mesmo com o pipeline desligado) |
| **J9** | **Registros internos**: RIPD do dado de saúde (art. 38), política de retenção **com a limpeza no código**, runbook de incidente estendido (o de hoje não fala de ANPD) | `docs/legal/`, `docs/runbooks/incidente.md` | os três existem; cada prazo de retenção tem job ou está marcado "manual" |
| **J10** | **Revisão de promessas de marketing** (CDC art. 37): landing, `/precos`, roteiros do `docs/marketing` contra o produto | tabela no `docs/legal/promessas.md` | cada frase de venda tem a tela ou o teste que a sustenta; a guarda `home-nao-promete-demais` cobre também `/precos` |
| **J11** | **Guarda do assistente**: enquanto `/termos` disser "não enviamos seus dados a serviço de IA de terceiros", `AI_PROVIDER` padrão tem que ser o Motor e `gemini.ts` não pode estar no caminho | `tests/unit/` | vista reprovando ao trocar o padrão |
| **J12** | **Dossiê para a pessoa que revisa** (§6) | `docs/legal/dossie-para-revisao.md` | 5 perguntas, minha posição, risco de cada, o que eu não sei |

**Ordem e prazo (dias corridos, sem esperar ninguém):**
J1 e J2 (dias 1 a 2) → J3, J4, J5, J6, J7 (dias 2 a 5) → J8, J10, J11 (dias 5 a 7) → J9 e J12 (dia 7).
**Tudo pronto e aprovado antes de abrir a janela grátis do `docs/87`:** conta criada com termos velhos
nasce "fora do agregado" até reaceitar, e reaceite de gente que ainda nem começou a usar é atrito à toa.

**Regra de código para tudo isso:** mudou `/termos` ou `/privacidade`, muda `VERSOES_LEGAIS` no mesmo
commit. Guarda que só passa com `git add -N` nos arquivos novos, como já aprendemos.

---

## 4 · As quatro perguntas do `docs/84` §2.1, com a minha posição

Cada uma vai no dossiê (J12) como **tese a ser confirmada**, não como fato.

**P1. O operador pode anonimizar para finalidade própria, com autorização contratual do controlador?**
- *Posição:* dado de fato anonimizado sai do alcance da LGPD (art. 12), mas **o ato de anonimizar é
  tratamento** e precisa de fundamento. O caminho mais defensável é: autorização **expressa e
  específica** do salão no DPA (J6), escopo **só agregados**, sem identificador, contas por célula
  acima do limiar, e cálculo **dentro do banco** sem exportar linha de ninguém.
- *Risco que continua:* o operador que usa dado para finalidade própria pode ser lido como
  controlador (art. 39, e a discussão de controladoria conjunta). Por isso o pipeline fica desligado.
- *Alternativa mais conservadora:* tratar só os **números do próprio negócio** (que o salão autoriza)
  e nunca dado de cliente final, nem em agregado. O comparativo perde poder; o risco cai muito.

**P2. Negócio MEI é pessoa física: os números do negócio dele são dado pessoal dele?**
- *Posição:* podem ser. Se a agregação for anonimização real, a resposta é irrelevante; se não for
  (célula pequena, valor que identifica), é dado pessoal. A cláusula vale igual para MEI e pessoa
  jurídica, e a proteção real é o limiar (P3), não o tipo de empresa.

**P3. Qual limiar é defensável?**
- *Posição técnica (não jurídica):* célula só existe com **10 negócios ou mais**, e **nenhum negócio
  pesa mais de 30%** do total da célula, região no mínimo por UF. Números arredondados na saída.
  É regra de k-anonimato com teto de dominância; o número exato é escolha a validar.

**P4. Quem já tem conta precisa aceitar a versão nova, e até lá fica fora?**
- *Posição:* sim. Reaceite com aviso claro (J8); até aceitar, a conta **não entra** em nenhum agregado.
  As contas do pré-lançamento já nascem aceitando a v2, e por isso J4 a J8 vêm antes da janela.

**P5 (nova). A limitação de responsabilidade do §9 vale para MEI que é consumidor?**
- *Posição:* o texto já tem a ressalva "só para o que a lei permite". Cláusula que limita a zero para
  o plano gratuito pode ser tida por abusiva (CDC art. 51). Com a mudança de modelo, o plano gratuito
  deixa de existir e o teto passa a ser "o que você pagou nos últimos 12 meses". Confirmar com quem revisa.

---

## 5 · Retenção proposta (a validar, e cada prazo precisa de escritor no código)

| Dado | Prazo proposto | Por quê | Como |
|---|---|---|---|
| Conta e dados do negócio, ativa | enquanto ativa | contrato | — |
| Conta cancelada ou pausada | 90 dias legíveis e exportáveis; depois eliminação com aviso por e-mail | dá tempo de voltar e de exportar | job de eliminação (D1 do `docs/87`: 7 dias de graça, 90 dias de pausa, avisos aos 30 e 7 dias antes do fim) |
| Cliente apagado pelo salão | imediato, inclusive na auditoria | já é o comportamento (Privacidade §6) | já existe |
| Registro de acesso à aplicação | 6 meses | Marco Civil art. 15 [confirmar] | conferir a retenção dos logs (Vercel Hobby guarda 1 hora; Pro, 1 dia; ver `docs/87` P0-5) |
| Trilha de auditoria e de acesso ao cofre | enquanto a conta existir | prova de LGPD | já existe |
| Dado fiscal do CICLO com o assinante (cobrança, nota) | 5 anos | obrigação tributária [confirmar com o contador] | — |
| Backup do banco | até 7 dias além da exclusão | Supabase Pro guarda 7 dias de backup diário (confirmado na documentação); o Free **não tem backup** | dizer isso na política |

---

## 6 · O que só uma pessoa habilitada faz (e o dossiê que eu entrego)

**Parecer humano (peça uma revisão de preço fixo, com o dossiê J12 na mão):**
1. P1 e P5 acima (a tese do operador e a limitação de responsabilidade).
2. Se o CICLO precisa de **encarregado** formal ou se a dispensa para agente de pequeno porte
   (Res. CD/ANPD 2/2022 [confirmar]) se aplica, mantendo sempre um canal do titular.
3. O RIPD do dado de saúde.
4. Se MEI é "consumidor" para o CDC (arrependimento de 7 dias, foro do domicílio).
5. **Registro da marca CICLO no INPI** (busca de anterioridade nas classes 9, 35 e 42 antes de
   gastar mais em marca). Não é texto legal, mas é o risco jurídico mais caro do lançamento.

**O que o Eduardo faz (eu não posso e não devo):**
- Aceitar o DPA online de cada operador ligado em produção (Supabase, Vercel, Resend, Sentry,
  PostHog, hCaptcha, Upstash, Meta, Mercado Pago). Cada um tem o seu; é clique com a conta dele.
- Abrir o CNPJ e passar a razão social, o endereço e o e-mail do encarregado, para eu preencher.
- Aprovar a minuta antes de subir (a versão só muda com o commit dele).

**Fontes conferidas hoje (29/09/2026):**
[Res. CD/ANPD 15/2024, incidente de segurança](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca) ·
[Res. CD/ANPD 19/2024, transferência internacional](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024) ·
[backups da Supabase por plano](https://supabase.com/docs/guides/platform/backups) ·
[regra do plano Hobby da Vercel](https://vercel.com/docs/plans/hobby).
Tudo marcado **[confirmar]** vem da minha memória de lei e não foi conferido em fonte: entra no dossiê
como pergunta, não como afirmação.

---

## 7 · Pendências que continuam do Eduardo

Registradas em `docs/DECISOES.md` (29/09): a mesma pergunta 1 do advogado; quem assina como
fornecedor (decidido em D6 do `docs/87`: você, pessoa física, só no alpha de até 10 contas; CNPJ antes de 09/11); e as duas variáveis de contato na Vercel.
