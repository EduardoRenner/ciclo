# Relatório de Verificação Final · CICLO pacote Advocacia (MVP)

**Data:** 2026-10-08  **Commit:** b537251f (branch `feat/advocacia-mvp`)  **Ambiente verificado:** local
(Supabase local + `next dev` e `next build`). Nada foi publicado: sem merge, sem deploy, sem migration em produção.

Protocolo: `C:\Users\Usuario\.claude\code\VERIFICACAO-FINAL.md` (15 gates), no escopo do pacote (docs/101).

## Veredito

**NÃO PRONTO PARA DADO REAL · PRONTO PARA DEMONSTRAÇÃO com o escritório-modelo.**
> O produto funciona de ponta a ponta no ambiente local, com testes e mutações em todas as defesas novas,
> mas faltam itens que só o Eduardo destrava (migrations e TOTP em produção, revisão jurídica, gabarito de
> prazos, exercício de restauração) e o adendo de aceite depende do PR #144. `ADVOCACIA_ABERTA` continua
> desligada.

## Placar por gate (escopo do pacote)

| Gate | ✅ | ⚠️ | ❌ | ⬜ | ➖ |
|---|---|---|---|---|---|
| 0 Repositório | 8 | 1 | 0 | 1 | 3 |
| 1 Build e estática | 6 | 1 | 0 | 2 | 3 |
| 2 Testes | 8 | 1 | 0 | 1 | 0 |
| 3 Configuração | 4 | 0 | 0 | 3 | 5 |
| 4 Banco e RLS | 11 | 0 | 0 | 3 | 2 |
| 5 Segurança | 19 | 1 | 0 | 3 | 8 |
| 6 Fluxos ponta a ponta | 10 | 0 | 0 | 1 | 0 |
| 7 Interface | 5 | 1 | 0 | 1 | 0 |
| 8 Responsividade | 2 | 1 | 0 | 2 | 0 |
| 9 Performance | 1 | 0 | 0 | 2 | 0 |
| 10 SEO | 0 | 0 | 0 | 0 | 4 |
| 11 Observabilidade | 2 | 1 | 0 | 1 | 0 |
| 12 Legal e LGPD | 2 | 0 | 0 | 3 | 0 |
| 13 Deploy | 0 | 0 | 0 | 4 | 0 |
| 14 Entrega | 2 | 0 | 0 | 1 | 0 |

(➖ = não se aplica ao pacote: pagamento, SEO de página pública, prefixo de pedido, reskin.)

## 1. Testes e build (gates 1 e 2)

| Verificação | Resultado |
|---|---|
| `pnpm typecheck` | 0 erro |
| `pnpm lint` | 0 erro, 0 aviso |
| `pnpm test:unit` | **3685 de 3685**, 380 arquivos |
| `pnpm test:rls` | **313 de 313**, 10 arquivos (inclui `legal-sigilo`, `legal-prazos`, `legal-matriz`) |
| integração (`--no-file-parallelism`) | **523 de 523**, 65 arquivos |
| `pnpm build` | compilado; `/admin/casos` 108 kB, `/admin/casos/[id]` 139 kB, `/admin/clientes/[id]/estrutura` 124 kB de First Load |
| testes pulados | nenhum `skip` nas suítes do pacote |

A bateria completa achou uma regressão minha (o teste `legal-prazos` montava o lote no formato antigo da RPC
de captura, que a 0113 corrigiu); consertado em b537251f, 313/313.

## 2. Banco e RLS (gate 4)

- 13 migrations do pacote (0102 a 0114), todas aditivas. Banco local com a 0101 da branch da fila aplicada
  antes (é por isso que o pacote começa na 0102).
- **Toda tabela `legal_*` com RLS habilitada e forçada**, linha de semente no `isolation.test.ts` (o teste
  genérico de "sobrou linha do outro tenant" tem o que sobrar) e nenhuma política de DELETE.
- **Matriz papel × tabela × operação** (`tests/rls/legal-matriz.test.ts`): 7 papéis × 7 tabelas de leitura,
  feriado e prazo fatal na escrita, ninguém apaga, ninguém muda intimação por UPDATE direto. Mutada nas
  políticas e vista reprovando (`docs/evidencias/T1.11-mutacao.md`).
- `supabase db lint --local`: sem achados.
- Concorrência no banco: participações sem sobreposição (GiST), prazo blindado com histórico gravado só por
  gatilho, `row_version` em pendência e documento.
- Types regenerados depois da última migration (0113).

## 3. Segurança (gate 5)

- Segundo fator obrigatório no pacote: porta do painel (`contextoDoPainel`) e `exigirAal2()` em toda rota
  `v1/legal/*` e `v1/tenant/advocacia` (guarda `rotas-legal-exigem-aal2`, com piso e mutação).
- IDOR: caso sigiloso fora do alcance e caso inexistente dão o mesmo 404 em ficha, pendência, intimação,
  documento e lembrete (testes de integração por fluxo).
- Upload: tipo decidido pelos bytes, 50 MB, caminho só de uuids, versão nunca sobrescreve, compensação no
  bucket se a linha falha. Executável renomeado para `.pdf` recusado sem tocar o bucket.
- Bucket `legal-docs` privado: nem a equipe baixa ou lista direto; só pela porta que grava trilha e assina
  URL de 60 s.
- **Achado e corrigido: o service worker cacheava URL assinada de outro host** (documentos e, na `main`
  de hoje, fotos de cliente). Corrigido em 9b7d282c com teste visto reprovando; sugerida tarefa para levar
  só isso à `main`.
- Captura do DJEN: URL base fixa, sem redirecionamento, escritório de demonstração pulado (a OAB fictícia
  existe no DJEN), cron com segredo.
- Redação de dado jurídico na trilha e na telemetria (texto do tribunal, partes, número do processo,
  motivo de sigilo, nota ao cliente), testada nos dois caminhos.
- ⚠️ `pnpm audit`: 2 altas (`sharp` < 0.35.5, `source-map-js` < 1.2.2) **já na `main`**, não deste pacote;
  sugerida tarefa separada.

## 4. Fluxos ponta a ponta, vistos no navegador (gate 6)

Escritório-modelo, sessão `aal2`, banco conferido depois de cada um:

| Fluxo | Conferido no banco |
|---|---|
| Pendências: "Recebi" | estado e `row_version` |
| Pendências: "Liguei" (lembrete de 10 dias) | `call_task_created` |
| Novo caso pelo formulário | caso + 5 pendências do modelo de inventário, datas em dias úteis |
| Triagem: "Usar a sugestão" e "Confirmar prazo" | prazo fatal confirmado, sugestão e divergência gravadas, trilha da abertura |
| Configurações: confirmar regra cível | `settings.advocacia` e `audit_log` |
| Documento: "Abrir" | `legal_access_log` (view) |
| Estrutura: simulador | conta à mão bate (Rogério 68% → 65%) |
| Hoje, Casos, Clientes, Cliente 360 | telas e filtros |

## 5. Checklist "pode entrar dado real" (docs/101 anexo 02 §7)

| Item | Estado |
|---|---|
| `pnpm verify` verde, banco sem paralelismo | ✅ (seção 1) |
| `isolation.test.ts` cobre toda `legal_*` e as listas de exceção batem | ✅ |
| Matriz com conjunto esperado e mutação de política reprovando | ✅ |
| Privilégio por coluna do texto e destinatários (secretaria não lê) | ✅ `legal-prazos` |
| MFA obrigatória ativa e testada | ✅ no código e nos testes · ⬜ TOTP ligado no projeto de produção |
| Redação com as chaves jurídicas, testada | ✅ |
| Bucket privado, leitura só com trilha, GET direto negado, SW não cacheia | ✅ |
| Nenhuma data de prazo pré-preenchida sem regra confirmada | ✅ (e a triagem nasce vazia mesmo com regra) |
| Toda rota `v1/legal/*` com aal2, módulo, permissão, idempotência, trilha, pausa | ✅ (guardas `rotas-legal-exigem-aal2` e `pausa-por-rota`) |
| Health com `legalIntimacoes`, `legalFila`, `legalMfa`; monitor externo | ⬜ heartbeat existe; vigia só liga quando a rota entrar em `ROTAS_AGENDADAS` |
| Migrations aplicadas em produção, `/api/health` sem "schema atrás" | ⬜ Eduardo |
| Adendo, privacidade e publicidade revisados pelo advogado | ⬜ dossiê pronto (`docs/101-dossie-advogado.md`); adendo depende do #144 |
| Modelo de WhatsApp sem dado do caso | ✅ `mensagens.ts` recusa número de processo, valor, CPF e CNPJ |
| Runbook de incidente e restauração; exercício de restauração | ✅ runbook (`docs/runbooks/advocacia-operacao.md`) · ⬜ exercício |
| `ADVOCACIA_ABERTA` desligada até decisão registrada | ✅ |

## Achados por severidade

### S0 · Bloqueadores para dado real
Nenhum defeito aberto. Os bloqueadores são os ⬜ abaixo (decisão e operação, não código).

### S1 · corrigidos nesta verificação
| # | Achado | Correção |
|---|---|---|
| 1 | SW cacheava URL assinada do storage (documentos; fotos de cliente na `main`) | 9b7d282c |
| 2 | RPC de captura lia campos que o núcleo não manda: toda intimação real falharia no `not null` | 0113 (3a30b83d) |
| 3 | Nome e OAB de pessoa real no código portado, num repositório público | 7fa932ca · o histórico ainda tem o dado (ver ⬜) |

### S2 · corrigidos durante a construção (vistos na tela ou pela mutação)
Estágio podia aprovar o próprio rascunho (0110); marco de lembrete voltava depois do maior; OAB só de zeros
era consultada; selo "Atrasada" em item já recebido; cadeado do selo `info` confundido com sigilo; aresta do
grafo escondendo percentual; ramo morto na Estrutura. Cada um com teste e evidência em `docs/evidencias/`.

## Não verificado (⬜) · o que destrava cada um

| Item | Por que não deu | O que falta | Quem destrava |
|---|---|---|---|
| Migrations 0102 a 0115 em produção | regra: sem `db push` | aplicar pelo runbook: 0102 a 0113 antes do deploy, 0114 e 0115 depois | Eduardo |
| TOTP no projeto Supabase de produção | configuração do painel | ligar enroll e verify | Eduardo |
| Revisão jurídica | precisa de advogado | dossiê pronto para revisão | advogado revisor |
| Gabarito de 50 intimações | dado real, fora do repositório | pedir ao escritório parceiro | Eduardo |
| Adendo de aceite (T0.5) | depende do PR #144 | merge do #144 | Eduardo |
| Exercício de restauração | precisa do projeto de produção | restaurar uma vez e anotar | Eduardo |
| Cron da captura agendado | só com o pacote aberto | cron-job.org + `ROTAS_AGENDADAS` | Eduardo |
| Histórico do git com nome/OAB real | reescrever exige force push | decidir se reescreve a branch | Eduardo |
| Varredura em 768 e 1280 px, toque por `elementFromPoint`, movimento reduzido | 375 px feito nas 10 telas (`docs/evidencias/T5.2-varredura.md`) | completar a varredura | próxima rodada |
| Lighthouse/peso real em produção | sem deploy | medir no preview | próxima rodada |

## Depois deste relatório (mesmo dia)

Entraram, cada um com integração e mutação em `docs/evidencias/`: ações de prazo na ficha (criar, cumprir,
corrigir com motivo, confirmar) e a 0114 (estágio não confirma prazo, também no banco); mudar estado do caso
com a frase ao cliente; cadastro de pessoas, empresas e atos societários na Estrutura; a 0115 (privilégio
mínimo: `anon` sem nada nas tabelas jurídicas, `authenticated` sem DELETE/TRUNCATE em nenhuma e sem
INSERT/UPDATE nas cinco que só o servidor grava), com guarda que exige toda tabela `legal_*` nova na lista
(`docs/evidencias/T1.10-mutacao.md`).

## Dívidas aceitas conscientemente

| Dívida | Motivo | Revisitar quando |
|---|---|---|
| Linha do tempo do Cliente 360 não existe | `audit_log` cru seria ação sem contexto | trilha com leitura por cliente |
| Lembretes calculados na leitura, sem job | sem canal de envio, "preparar" não seria visto | se o pacote ganhar envio |
| `is_demo` não é coluna; vale a lista de demonstração | uma fonte só (sitemap, robots, mensageria já leem a lista) | nunca, salvo motivo novo |
| Guarda `consulta-filtra-tenant` não lê arquivo ainda não adicionado ao git | lê `git ls-files`; na CI tudo está rastreado | se virar problema local |

## Evidências

`docs/evidencias/T0.*`, `T1-*`, `T1.11-mutacao.md`, `T2-*`, `T2.3-mutacao.md`, `T2.8-mutacao.md`,
`T3-mutacao.md`, `T4-mutacao.md`, `T4.1-mutacao.md`, `T4.6-mutacao.md`: cada defesa nova foi mutada e vista
reprovando, com a saída anotada. Decisões em `docs/DECISOES.md` (2026-10-08).
