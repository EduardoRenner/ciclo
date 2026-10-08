# 102 · Plano de melhoria do CICLO base

> Escrito em 2026-10-08 a partir de `.claude/ciclo/prompt-plano-melhoria-ciclo.md`, na branch
> `melhoria/base-2026-10-08` (worktree `ciclo-melhoria`, base `origin/feat/cortesia-2026-10-03`, que contém
> toda a `origin/main` mais 30 commits). Rótulos: **[FATO]** medido ou lido nesta sessão, **[HIPÓTESE]**,
> **[DECISÃO PENDENTE]**. Classificação: Decidido · Recomendado · Do Eduardo · Bloqueado. Onde um item é
> "Do Eduardo", o trabalho segue com um **padrão de trabalho adotado**, escrito como padrão, não como decisão.
>
> Medição: banco local compartilhado, dev server da branch (porta 3019), salão `demo-salao-encanto` (28
> clientes, 134 agendamentos) e conta vazia `barbearia-teste-p5`. Sondagem de toque e de overflow em
> `docs/102-anexos/sonda.js`.

## 1. Resumo executivo

**Objetivo.** Antes do lançamento, tirar do CICLO base o que a pessoa VÊ dar errado e o que deixa risco
aberto, sem funcionalidade nova. O produto passou por várias auditorias de interface (docs/11, 15, 61, 72):
a maior parte do que elas acharam está no código e continua valendo. Esta rodada mediu de novo e achou
pouca coisa, mas concreta, e quase tudo no caminho que decide se o salão fica.

**As 5 melhorias de maior retorno**
1. O primeiro passo do onboarding ("Traga quem você já atende") leva a uma tela cujo link de importar CSV é
   **intocável**: 0 px de área, coberto pelo parágrafo seguinte. [FATO]
2. `/entrar` e `/cadastro` são as rotas mais pesadas do produto (208 e 209 kB de JS no primeiro
   carregamento, o dobro da base de 104 kB) porque o cliente Supabase do navegador entra no pacote para um
   login social que, sem provedor ligado, nem aparece. [FATO para o peso e a importação; HIPÓTESE para o ganho]
3. Defesa em profundidade no banco: nas 59 tabelas do base, `anon` tem todos os privilégios de tabela,
   `authenticated` tem TRUNCATE em 58, e 36 tabelas só não deixam apagar porque falta política de DELETE.
   Nenhum código usa `anon` em tabela (a leitura pública passa por `service_role`). [FATO]
4. Service worker que guarda resposta de outro domínio (URL assinada de mídia) e dependências de produção com
   alerta alto (`sharp`, `source-map-js`). [FATO]
5. Seis defeitos de toque e um de rolagem lateral nas telas do painel, mais o botão travado que nunca mostra o
   motivo para quem enxerga. [FATO]

**Fora:** funcionalidade nova, verticais, pacote Advocacia, app nativo, LATAM, WhatsApp oficial, e tudo que
depende de decisão de negócio (domínio, CNPJ, PSP, credencial do WhatsApp, Sentry).

**5 maiores riscos:** (1) revogar privilégio que algum caminho usa sem a busca ter visto; (2) conflito de
fusão com a branch advocacia nos mesmos arquivos de shell e de banco; (3) numeração de migration colidindo
com 0101 a 0116; (4) consertar toque e criar sobreposição nova (`toque-48` vizinho); (5) a mudança no
`Button` atingir todas as telas de uma vez.

## 2. Auditoria medida, em 6 frentes

### 2.1 Interface e experiência (ver seção 3)

### 2.2 Conversão e ativação
- [FATO] Hoje da conta vazia: os três primeiros passos ficam acima da dobra a 375 × 812 (346, 526 e 650 px).
  O primeiro leva a `/admin/clientes/ja-atendo`, onde "Importe de um arquivo CSV" tem 0 px tocáveis.
- [FATO] As duas portas de entrada são as rotas mais pesadas (seção 2.5).
- [FATO] O Hoje vazio repete "nada para hoje" três vezes ("Nada mais marcado para hoje", "Nada mais para
  hoje", "Sem mais nada agendado").
- Não medido: funil real (zero cliente pagante, sem instrumentação de funil). `.claude/ciclo/funnel.md`
  continua a referência; instrumentar fica para depois do lançamento.

### 2.3 Confiabilidade e falha silenciosa
- [FATO] `ROTAS_AGENDADAS` = `recompute-cycles` e `segments`; `reminders` e `campaigns` fora do agendador por
  falta de credencial do WhatsApp (bloqueado, do Eduardo). Os vigias existentes cobrem o que roda.
- [FATO] `rede-nao-derruba-tela`: a lista de dívida está **vazia** (zero tela com `await fetch` solto).
- [FATO] As contas de demonstração param no tempo: o último agendamento do `demo-salao-encanto` é de
  30/09, e o Hoje e a Agenda abrem vazios hoje (08/10). O script `seed-demo-agenda-futura.mjs` existe e
  resolve, mas nada o agenda.

### 2.4 Segurança e dados
| Achado | Medida | Classificação |
|---|---|---|
| `anon` com todos os privilégios nas 59 tabelas | `has_table_privilege` no banco local | Recomendado (o app não usa `anon` em tabela: o cliente do navegador só aparece em `login-social.tsx`, para OAuth) |
| `authenticated` com TRUNCATE em 58 | idem | Recomendado |
| 36 tabelas com DELETE de `authenticated` e sem política de DELETE | idem | Recomendado (a negação passa a vir antes da RLS) |
| Políticas escritas `to public` em 54 tabelas | `pg_policies` | Já analisado na auditoria de 2026-09-08; continua com filtro por tenant. Não mexer neste plano |
| Service worker sem checagem de origem | `public/sw.js` sem `origin` | Decidido (conserto pronto na branch advocacia, `9b7d282c`) |
| `pnpm audit --prod`: 2 altos (`sharp`, `source-map-js`), 4 moderados (`fast-uri`, `next` cache de SSG/ISR) | `pnpm audit --prod` | Recomendado; `next` só em patch |
| `pnpm audit` total: 3 críticos, todos de ferramenta de desenvolvimento (`tinypool` via vitest, `proxy-addr` via shadcn) | idem | Recomendado se o salto for menor; não vão para o pacote do app |

### 2.5 Desempenho
- [FATO] `pnpm build`: base compartilhada 104 kB. Maiores primeiros carregamentos: `/cadastro` 209 kB,
  `/entrar` 208 kB, `/admin/clientes/ja-atendo` 182 kB, `/admin/clientes/importar` 180 kB,
  `/admin/clientes/[id]` 161 kB, `/admin/hoje` 154 kB.
- [FATO] `login-social.tsx` importa `criarClienteDoNavegador` no topo do módulo e devolve `null` sem
  provedor: o cliente Supabase vai para o navegador mesmo sem botão. [HIPÓTESE] importação dinâmica dentro
  do clique tira a maior parte da diferença; medir no build.
- Não medido nesta rodada: LCP e latência de clique (docs/28, 42, 70 já têm a régua; repetir depois do
  ticket M4.1).

### 2.6 Qualidade do que se diz
- [FATO] Guarda `copy-sem-travessao` existe; copy pública não foi relida tela a tela nesta rodada (fica no M5.1).
- [FATO] Título de `/[slug]/orcamento` diz "Pedir orçamento · Salão" sobre o corpo "Página não encontrada"
  quando o salão não tem serviço sob orçamento (o `generateMetadata` não sabe do `notFound`).

## 3. Interface e experiência

### 3.1 O que já foi feito (não refazer)
| Achado anterior | Documento | Hoje |
|---|---|---|
| Ficha do cliente em 3 telas (E1) | docs/11 | resolvido: abas Resumo, Histórico, Fidelidade, Ficha |
| Ação destrutiva de 16 px (E2) | docs/11 | resolvido (nenhum alvo destrutivo pequeno na varredura) |
| 19 de 27 telas sem carregamento (E4) | docs/11 | resolvido em 2026-08-19 (26 de 27; não recontado) |
| 61% do monitor vazio (E5) | docs/11 | escopo reduzido de propósito: coluna de 558 px centralizada a 1280 px |
| Títulos de tela iguais (A1) | docs/15 | resolvido: título próprio em todas as telas medidas |
| Seletores de cor de 36 px (A9) | docs/15 | hoje 40 × 40 (abaixo de 48; ver M1.6) |
| Acento sem piso de contraste | docs/72 | resolvido em `src/core/text/cor.ts` (`acentoNoTemaClaro`) |

### 3.2 Princípios (desempate)
Quem usa está no meio de um atendimento, com uma mão: o que fazer agora em 5 segundos; ação primária na zona
do polegar; o botão principal nunca exige rolar para ser achado; painel denso de trabalho (§13 do
protocolo); nas telas públicas, quem lê é a cliente do salão e quem fica mal é o salão.

### 3.3 Varredura (todas as rotas do painel, públicas e de entrada)
**Overflow.** 375 px: 1 tela com rolagem lateral, `/admin/config/profissionais` (452 px: os dois botões de
ação ao lado do filtro "Ativos · Todos" não quebram linha). 768 e 1280 px: zero.

**Toque a 375 px (sondagem por `elementFromPoint`).**
| Tela | Alvo | Efetivo (alt × larg) | Gravidade |
|---|---|---|---|
| `/admin/clientes/ja-atendo` | "Importe de um arquivo CSV" | 0 × 0, coberto pelo `p.mt-6` seguinte | S1 (primeiro passo) |
| `/admin/mes` | "Ver a agenda" | 18 × 96 | S2 |
| `/admin/clientes` | "Baixar todos em planilha" | 15 × 135 | S2 |
| `/admin/recuperar` | "Completar o custo" | 16 × 114 | S2 |
| `/admin/comissao` | "Caixa" | 18 × 42 | S2 |
| `/admin/clientes/[id]` | "Nada anotado ainda. Toque para…" | 39 × 305 | S3 |
| `/admin/config/horarios` e ficha do profissional | "Adicionar intervalo" (7 por tela) | 49 × 32 | S3 |
| ficha de consumo do serviço | "Voltar" | 48 × 33 | S3 |
| `/termos`, `/privacidade` | logotipo "CICLO, início" | 28 × 69 | S3 |
| `/cadastro` | "Já tem conta? Entrar" | 44 × 339 | S3 |
| agenda, clientes, recuperar, configurações | pílulas de filtro de 40 px | 45 × largura | S3 |
| `/admin/config/negocio` | seletores de cor | 41 × 40 | S3 |

Falsos positivos descartados por medição: o segundo `<h1>` de toda tela é a cópia escondida do streaming
(`[hidden]`); caixas de marcar de 20 px têm o `label` inteiro como alvo (339 × 48 e 339 × 61); links de
texto corrido nos termos ficam como estão (WCAG 2.5.8 isenta link dentro de frase).

**Contraste (tokens, CSSOM).** Todos os pares acima de 4,5:1 nos dois temas, exceto `--ok` sobre `--bg` no
claro: **4,40**. O acento escolhido pelo salão já tem piso.

**Movimento.** A regra global de `prefers-reduced-motion` zera animação, transição e `scroll-behavior`
(lida no CSSOM).

**Shell.** A faixa de conexão gruda em `top-0`, por cima do cabeçalho, e cobre o logotipo ao rolar (medido
na branch advocacia, mesmo shell; o código do base é idêntico).

**Botão travado.** `button.tsx` usa `disabled:pointer-events-none`: o `title` com o motivo nunca aparece,
e no celular o motivo só existe para leitor de tela.

### 3.4 Os quatro fluxos
| Fluxo | Medido | Achado |
|---|---|---|
| 1. Cadastro ao primeiro valor | Hoje da conta vazia e `/ja-atendo` | o caminho do CSV está quebrado (0 px); o Hoje vazio repete a mesma frase três vezes |
| 2. Marcar horário | não medido em toques nesta rodada | M1.0 mede antes de qualquer mudança |
| 3. Fechar atendimento | comanda aberta a partir do agendamento (8 alvos, sem defeito) | sem achado |
| 4. Recuperar cliente | `/admin/recuperar` (45 alvos) | "Completar o custo" com 16 px; pílulas de 40 px |

### 3.5 Mudanças de tela propostas
Nenhuma reestruturação: a medição não justificou redesenho. As mudanças são locais (seção 5).

## 4. Itens portados do pacote Advocacia
| Item | Base hoje | Esforço | Conflito na fusão | Ordem |
|---|---|---|---|---|
| Service worker com checagem de origem | falta | P | `public/sw.js` | portar já; a branch advocacia rebaseia |
| Faixa de conexão abaixo do cabeçalho | falta | P | `indicador-de-conexao.tsx` | portar só a posição (`top` e `z`); o texto por pacote fica na advocacia |
| Privilégio mínimo | falta | M | numeração de migration | base usa a **0117** em diante; a advocacia mantém 0102 a 0116 |
| Botão travado com motivo visível | falta | M | `button.tsx` | fazer no base; a advocacia herda |
| Estados de escrita (`escreverJuridico`) | não se aplica como está (o base tem fila offline legítima) | | | |
| Health com reconciliação | não se aplica (captura é jurídica) | | | |
| Atalhos de teclado | candidato para depois (não medido como dor) | | | |

## 5. Backlog

Cada ticket: um commit, `pnpm verify` (o `test:rls` e a integração quando tocar banco), verificação no
navegador quando a pessoa vê, guarda vista reprovando quando houver guarda.

**Fase 0 · o que não espera**
- **M0.1 Service worker não intercepta outro domínio.** Portar `9b7d282c`. Teste: requisição de outra origem
  não passa pelo `respondWith`. Guarda vista reprovando (tirar a checagem).
- **M0.2 Dependências de produção.** `sharp` e `source-map-js` por versão corrigida ou `overrides`; `next`
  só se houver patch na mesma minor. `pnpm audit --prod` sem alto. Ferramentas de desenvolvimento: subir se
  for patch ou minor; registrar o resto.
- **M0.3 Privilégio mínimo (migration 0117).** Revoga de `anon` todos os privilégios de tabela no schema
  `public`; revoga TRUNCATE de `authenticated` em todas; revoga DELETE de `authenticated` nas tabelas sem
  política de DELETE. Teste de RLS: DELETE e TRUNCATE negados com "permission denied"; guarda que exige toda
  tabela nova na regra. Antes: busca de `.delete(` com o cliente do usuário em cada tabela revogada.

**Fase 1 · o que a pessoa vê** (ordem dos fluxos)
- **M1.0 Medir o fluxo 2** (marcar horário a partir do Hoje): toques e telas, antes de mudar algo.
- **M1.1 Link de CSV intocável em `/ja-atendo`.** Achar o que cobre e corrigir sem `toque-48` vizinho.
- **M1.2 Rolagem lateral em `/admin/config/profissionais`.** Os botões quebram linha a 375 px.
- **M1.3 Faixa de conexão abaixo do cabeçalho.**
- **M1.4 Botão travado mostra o motivo.** `aria-disabled` no lugar de esconder o evento: o toque não executa a
  ação e mostra o motivo em texto visível; leitor de tela continua lendo. Guarda que reprova se o motivo
  voltar a ficar invisível.
- **M1.5 Alvos de 15 a 18 px** (mês, clientes, recuperar, comissão): 48 px efetivos medidos depois.
- **M1.6 Alvos de 32 a 45 px** (intervalo, voltar, logotipo, "Já tem conta", nota vazia, pílulas, cores).
- **M1.7 Hoje vazio com uma frase só.**
- **M1.8 `--ok` com 4,5:1 no tema claro.**
- **M1.9 Título coerente no 404 de `/[slug]/orcamento`.**

**Fase 2 · confiabilidade**
- **M2.1 Demonstração que não envelhece.** Do Eduardo agendar em produção. Padrão de trabalho: o script fica
  pronto para rodar por agendador (idempotente, só contas da lista de demonstração) e o runbook diz como.

**Fase 4 · desempenho**
- **M4.1 Login social sem o cliente Supabase no primeiro carregamento.** Importação dinâmica no clique.
  Aceite: `/entrar` e `/cadastro` caem no build; login social continua funcionando quando ligado.

**Fase 5 · copy e kit**
- **M5.1 Copy das telas públicas relida na tela** (landing, preços, calculadora, links, vitrine).

**Fase 6 · verificação final**
- **M6.1** Repetir a varredura completa (`sonda.js`) e os 15 gates; relatório em `docs/102-RELATORIO.md`.

## 6. Testes e verificação
Guardas pela regra "casar com o que muda quando o defeito volta", com positivo conhecido como piso, vistas
reprovando com a mutação confirmada (evidência em `docs/evidencias/M*.md`). RLS depois de toda migration.
Integração sem paralelismo de arquivos. Toda mudança visível medida no navegador com `sonda.js`, a 375, 768
e 1280 px.

## 7. Operação e observabilidade
O `/api/health` cobre banco, fila, mensagens, heartbeats agendados, rastreio de erro, assistente e schema.
Nada novo neste plano. A régua "verde não é prova" vale para o M2.1: o script precisa dizer quantos
agendamentos criou por conta.

## 8. Riscos e pendências
| Risco | Prob. | Impacto | Sinal | Mitigação |
|---|---|---|---|---|
| Revogação quebra um caminho | B | A | 42501 em rota | busca por `.delete(` e `.from(` no cliente do usuário antes; integração inteira depois |
| Conflito com a branch advocacia | M | M | conflito no rebase | portar só a parte genérica; anotar arquivos no commit |
| `Button` muda todas as telas | M | M | varredura acusa | M1.4 sozinho, varredura completa depois |
| Numeração | B | A | duas 0117 | faixa reservada 0117+ no base |

**Do Eduardo:** credencial do WhatsApp, domínio, CNPJ, PSP, Sentry (fora deste plano); agendar o M2.1 em
produção; aplicar a 0117 em produção.

## 9. Autoauditoria
1. [FATO] sem leitura: nenhum; o que não medi está escrito "não medido".
2. "Do Eduardo" como decidido: não (M2.1 e aplicação da 0117).
3. Dependência para trás: não. 4. Ticket que piora se parar: não (todos são locais).
5. Migration: só a 0117, com RLS intacta e teste. 6. Rota nova: nenhuma.
7. Guardas: M0.1, M0.3, M1.4 com mutação prevista. 8. Número inventado: não.
9. Copy: as frases novas passam pela guarda de travessão. 10. Conserto pior: M1.5 e M1.6 sondados depois.
11. Fusão: seção 4. 12. Falso positivo: três descartados (seção 3.3).
13. Telas sem estado avaliado: os 6 estados não foram avaliados tela a tela nesta rodada. **Não corrigido**:
    entra no M6.1.
14. Mudança de tela sem wireframe: não há reestruturação. 15. Decisão desfeita: nenhuma (E5 mantido).

## 10. Primeiros 10 passos
1. M0.1 · 2. M0.2 · 3. M0.3 · 4. M1.0 · 5. M1.1 · 6. M1.2 · 7. M1.3 · 8. M1.4 · 9. M1.5 · 10. M4.1.
