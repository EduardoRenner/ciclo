# 101 · Anexo 05 · Plano de testes

> "Verde não é prova" (`CLAUDE.md`). Toda guarda nova é vista reprovando antes do commit; todo teste
> que afirma "vazio" prova que montou o cenário; caso que pula diz por quê e não conta como prova.

## 1. Pirâmide

| Camada | Onde | O que cobre | Mínimo |
|---|---|---|---|
| Unitário puro | `tests/unit/advocacia/*` sobre `src/core/advocacia/*` | prioridade, participação efetiva, cálculo e leitura de prazo, prazo interno, estados de caso/pendência, geração de checklist por modelo, montagem de mensagem, alvos da captura, normalização do DJEN | caminho feliz + 1 erro por função; tabelas de casos para prioridade e cálculo |
| Guardas de código | `tests/unit/design/*`, `tests/unit/billing/*`, `tests/unit/core/*` | pacote tem registro; rotas na pausa; catálogo de módulos; redação; demo por coluna e lista; schema esperado; tab bar vem do pacote; rotas legal exigem aal2; documento só por RPC; URL do DJEN fixa; WhatsApp sem dado sigiloso | cada uma vista reprovando (§5) |
| Integração (banco local) | `tests/integration/legal-*.test.ts` | rotas `v1/legal/*` (feliz + erro), MFA, jobs, captura com stub, decisão de intimação, lembretes, eliminação LGPD | sem paralelismo de arquivos |
| RLS | `tests/rls/isolation.test.ts` + `legal-matriz`, `legal-sigilo`, `legal-estrutura` | isolamento por introspecção; matriz persona × tabela × operação; sigilo; GiST e RPC INVOKER | conjunto esperado, não "≥ 1 linha" |
| Mutação | `scripts/mutacao-rls-advocacia.mjs` (novo, inspirado em `scripts/mutation-security.ts` do LUBI) | cada política e função de acesso nova | suíte RLS reprova com a defesa quebrada |
| Navegador | varredura manual guiada + Playwright **não existe** no CICLO (`CLAUDE.md`: `pnpm test:e2e` não existe) | telas, estados, toque, teclado, leitor de tela | relatório com prints |

## 2. Unitário: casos obrigatórios

- **Prioridade** (`prioridade.ts`): reproduzir o exemplo do LUBI `04` §4 (NÃO LI; reproduzir a partir dos pesos em `prioridade.ts:89-131`);
  desempate estável (`ordem-de-lista-nao-empata` existe no CICLO); item sem dono → grupo 0; `snooze` 3× → +15.
- **Participação efetiva**: 3 níveis indiretos; usufruto não altera percentual; soma > 100% e ciclo acusados; percentual 0 recusado.
- **Cálculo de prazo**: disponibilização em quinta → publicação sexta → início segunda; feriado no meio; recesso 20/12 a 20/01 (regra
  não validada → `podePreencher = false`); rito penal em dias corridos; prazo em dobro; "leitura incerta" para horas e para dois prazos.
- **Prazo interno**: fatal numa segunda → interno na quinta anterior (2 úteis); feriado na conta.
- **Checklist do modelo**: `offset_business_days` em dias úteis; versão congelada; devolução incrementa rodada e zera lembretes.
- **Mensagem pronta**: nunca contém `numero_processo`, nome de bem, valor; contém `client_title` e o nome do item.
- **Alvos da captura**: membro inativo fora; OAB ambígua ("24850-A") fora com aviso; dedupe por chave.
- **Normalização do DJEN**: HTML → texto; número com máscara → 20 dígitos; item sem `id` recusado e contado.

## 3. Matriz persona × tabela × operação

Personas: `owner`, `manager`, `professional` membro, `professional` não membro, `professional` com `legal_role = 'estagio'`,
`reception`, `finance`, usuário de **outro tenant**, `anon`.

Tabelas: as 17 `legal_*`. Operações: select, insert, update, delete.

Formato: para cada célula, o **conjunto** de ids esperado (não "≥ 1"), como `matriz.test.ts:3` do LUBI. Negado = erro de permissão
**ou** zero linhas, mas o teste de `delete` confere **contagem antes/depois** (regra do LUBI `07` §4 "GRANT DELETE sem política").
Os `UPDATE` usam valor constante, não `set x = x` (`matriz.test.ts:27-29`).

Semente: um tenant com 1 caso normal, 1 caso sigiloso (membro = professional A), documentos nos dois, pendências nos dois, intimação
vinculada ao sigiloso e intimação sem caso, prazos nos dois; um segundo tenant com o mesmo desenho (para o "outro tenant").

## 4. Mutação das defesas

Em banco **local descartável** (trava por URL como `mutation-security.ts:12-16`), para cada defesa:
1. quebra (dropa a política; ou troca `legal_can_access_case` por `returns true`; ou concede `select (texto_sanitizado)`; ou tira o
   gatilho de blindagem);
2. roda `tests/rls/legal-*.test.ts` e **exige falha**;
3. restaura e confirma verde.

Lista de defesas a mutar: políticas de cada tabela `legal_*` (17), `legal_can_access_case`, privilégio por coluna de `legal_intimations`,
gatilhos `negar_delete` das append-only, gatilho de blindagem de `legal_deadlines` (adiar fatal, mudar sem motivo, cumprir sem prova),
`ownerships_sem_sobreposicao`, RPC `legal_apply_corporate_change` não executável por `anon`, trigger "só estado muda" de intimações.
Resultado em `docs/evidencias/advocacia-mutacao-<data>.md`; defesa sem teste que a pegue **bloqueia a fase**.

Armadilhas já pagas: tabela auxiliar da mutação fora de `public`; `supabase db reset` derruba conexões (rodar num clone
`postgres_mut`); depois do reset, reiniciar o gateway; GUC nulo com `coalesce` (memória `lubi-armadilhas-de-execucao`).

## 5. Guardas novas e a mutação que as faz reprovar

| Guarda | O que casa | Mutação |
|---|---|---|
| `pacote-tem-registro` | valores do `check` da `0101` = `Object.keys(PACOTES)` | remover `advocacia` do registro |
| `vereditos-de-beleza-nao-mudam` | snapshot de `podeUsarModulo` para tenant base, todos os módulos | inverter pacote/plano |
| `tab-bar-vem-do-pacote` | AST: `tab-bar.tsx` sem import de `ABAS` | reimportar |
| `rotas-legal-exigem-aal2` | AST: toda `route.ts` sob `api/v1/legal` tem `await exigirAal2(` **como chamada** (não o nome em import, regra do `CLAUDE.md`) | remover numa rota |
| `rotas-legal-exigem-modulo` | idem para `exigirModulo(` | remover |
| `documento-so-por-rpc` | nenhum `getPublicUrl` sobre `legal-docs`; nenhum `select('storage_path')` fora de `src/server/advocacia/documentos.ts` | usar `getPublicUrl` |
| `djen-url-fixa` | `DJEN_BASE` é literal; nenhuma leitura de `process.env` em `djen.ts` | ler de env |
| `whatsapp-sem-dado-sigiloso` | seed de `message_templates` `advocacia_*` e `mensagens.ts` sem `{processo}`, `{bem}`, `{valor}`, `{assunto}`, `{cnj}` | inserir `{processo}` |
| `redacao-cobre-chaves-juridicas` | comportamento: objeto com cada chave → `[redigido]`; chave inofensiva não redigida (controle positivo) | tirar uma chave |
| `demo-por-coluna-e-por-lista-concordam` | todo slug da lista tem `is_demo = true` no seed e vice-versa | tirar um slug |
| `conta-advocacia-so-com-chave` | onboarding recusa `advocacia` com `ADVOCACIA_ABERTA = false` fora da lista de demo | remover o `if` |
| `prazo-gabarito` (modo sem arquivo) | nenhuma regra de rito `validada: true` | marcar uma |
| `adendo-precisa-revisao` | o texto do adendo contém o marcador até a versão revisada | tirar o marcador sem subir a versão |
| `intimacao-texto-fora-do-grant` | `grant select (...)` de `legal_intimations` na migration não lista `texto_sanitizado` nem `destinatarios` | acrescentar |
| `assistente-nao-le-legal` | nenhum `from('legal_` em `src/server/assistente/**` | acrescentar |

Procedimento do `CLAUDE.md`: commitar antes de mutar; aplicar a mutação; **confirmar que foi aplicada** (ler o arquivo mutado); rodar;
registrar a saída reprovando em `docs/evidencias/<ticket>.md`; reverter. Guarda que casa com nome em `import`, rótulo ou comentário é
cega: remover comentários antes de casar (`tests/helpers/fonte.ts`, cuidado com CRLF, memória `guarda-crlf-nao-corta-comentario`).

## 6. Integração: cenários mínimos por fase

- **Fase 0**: onboarding com `advocacia` cria tenant com `profession_id` e eixos; `contextoAtual` devolve `pacote`; `aal1` em tenant
  advocacia redireciona; `exigirModulo('legal_cases')` em tenant base → `FORBIDDEN`.
- **Fase 1**: isolamento (automático); matriz; sigilo; GiST; RPC; privilégio por coluna; gabarito modo sem arquivo; `is_demo`.
- **Fase 2**: criar caso do modelo → N itens; cobrar → `wa.me` com texto sem dado do caso; receber versão válida → `recebido`;
  conferir → `aceito`; devolver → rodada 2; `.exe` → recusado; abrir documento → trilha; eliminação anonimiza.
- **Fase 3**: ato de cessão fecha e abre participações; participação efetiva por SQL = por TS (paridade); sobreposição recusada.
- **Fase 4**: cron enfileira 1 job por (tenant, OAB, dia); handler com stub grava e reconcilia; segunda execução = 0 novas; intimação
  com `cnj_number` vincula; decisão cria prazo com `source = 'djen'` e prova; sugestão de 20 min atrás não vale; health vermelho com
  `ok = false`; `tenantsProcessados: 0` com alvo pendente não é ok.
- **Fase 5**: offline em escrita jurídica → 503 amigável sem enfileirar; `row_version` divergente → 409.

Suíte de banco sempre com `--no-file-parallelism` (memória `suite-de-banco-intermitente-por-rate-limit`).

## 7. Calendário e fuso

- Dias 29, 30 e 31 em meses curtos (memória `teste-calendario-e-sessoes-na-mesma-arvore`).
- Mudança de horário: o CICLO já testa dia de 23/25 h na agenda; o prazo é `date`, imune, mas `due_at` de audiência não.
- Rodar a suíte de prazo com `TZ=UTC` e `TZ=America/Sao_Paulo` (prática do LUBI; memória `teste-de-fuso-em-maquina-de-brasilia`):
  o servidor da Vercel roda em UTC, e "hoje" para a fila é o dia no fuso do tenant.
- Feriado por comarca: intimação de Maravilha com 27/07 marcado → data muda; sem calendário da comarca → selo "sem feriados municipais
  desta comarca, confira" e sem pré-preenchimento.

## 8. Seed do escritório-modelo: teste de sanidade do agregado

Depois de gerar (anexo 06 §2), o teste lê o banco e exige faixas plausíveis **[HIPÓTESE, ajustar com o primeiro escritório]**:
intimações por dia útil entre 2 e 8 (pico ≤ 15); % com "prazo de N" no texto entre 20% e 35%; % de pendências concluídas entre 40% e
70%; atraso mediano de documento do cliente entre 5 e 20 dias; nenhum caso com 0 pendências nem com > 25; prazos fatais abertos com
`internal_due_on < due_on`; soma de participações por empresa = 100% exceto a inconsistência plantada; nenhum nome, CPF, CNPJ ou
número de processo com formato válido de verdade (CNPJ com dígito verificador **inválido** de propósito; processo com sequencial
`0000000`). Lições: seed que parece certo e é absurdo no agregado; volume sai do histórico; seed não preenche coluna de busca
(`phone_hash`, guarda `seed-que-grava-telefone-grava-hash` existe).

## 9. Gabarito de prazo: dois modos

- Com `LEGAL_GABARITO_PATH` apontando para o JSON privado (fora do repo): para cada caso, `calcularPrazo` = `esperado`; 100% por rito;
  qualquer divergência reprova e lista o caso.
- Sem o arquivo: afirma que **toda** regra de rito tem `validada: false` e que `REGRA_SUSPENSAO_FIM_DE_ANO.validada === false`.
- Nenhum `skip`. Os dois modos escrevem no relatório qual rodou.

## 10. Navegador

Sem Playwright no CICLO, a verificação é guiada e documentada (anexo 04 §9). Se o Eduardo autorizar instalar Playwright
(`DECISOES 31/08` registra que não existe), o LUBI tem 380+ E2E como referência de forma (`_progresso.md:258`), mas o código não
é portável (rotas e componentes diferentes).

## 11. Métricas do próprio MVP (para o §10.6 do principal)

`product_events` (sem conteúdo): `legal.hoje_aberto` (por usuário e dia), `legal.intimacao_triada` (com `dias_ate_triagem`),
`legal.pendencia_criada`, `legal.pendencia_recebida` (com `dias`), `legal.prazo_confirmado`, `legal.prazo_corrigido`,
`legal.documento_aceito`. Relatório semanal por script (`scripts/metricas-advocacia.mjs`, padrão `metricas-ativacao.mjs`).
Métricas que **não** podem melhorar com o fracasso: divergência sobre **todas** as intimações com prazo (não só confirmadas);
mediana de recebimento sobre **todos** os pedidos (abertos contam como infinito).
