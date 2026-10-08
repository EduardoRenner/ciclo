# Missão · lançamento com cortesia (docs/87) e jurídico (docs/86)

Retomada em 03/10/2026 sobre a `main` (a branch antiga `feat/cortesia-prelancamento-2026-09-30` ficou
numa base que a `main` já substituiu por squash; os commits foram reaplicados em
`feat/cortesia-2026-10-03`). Um ticket por commit, `pnpm verify` completo, guarda vista reprovando.

## Cortesia (docs/87 §3)

- [x] C0 núcleo: datas, leitor, estado da conta, plano vigente = maior entre o pago e a cortesia (4 commits)
- [x] C0b o cadastro concede (D3, 21 dias depois de 12/12) e uma guarda prova que nenhum caminho da cortesia chama o Mercado Pago (E5)
- [x] C1 duas faixas com tudo incluído, Solo e Equipe (D2); Grátis e Avançado saem de venda
- [x] C2 faixa no painel com a data de fim em toda tela (plano e cortesia vêm na consulta do vínculo, sem ida extra)
- [x] C3 "Meu plano" por estado da conta (cortesia, graça, pausada, pago); só oferece o que se vende; faixa que não comporta a equipe mostra o porquê
- [x] C4 copy pública: `/precos`, `/cadastro`, fecho da home, `llms.txt`, termos §5, §6 e §9; oferta dita pela mesma função que concede

### Portões duros (os termos v2 já prometem; o código ainda não cumpre inteiro)

Nenhum destes bloqueia abrir o alpha (26/10). Todos bloqueiam a primeira pausa (18/01/2027) e entram
no Portão 1 (21/12): sem eles os termos descrevem um produto que ainda não existe.

- [x] **C5 A pausa trava TODA criação.** FEITO em `core/billing/pausa.ts` + `contextoAtual`: tabela de 103 pares método/rota (32 bloqueiam, 49 permitem, 22 fora de `contextoAtual`), rota desconhecida é recusada, guarda `pausa-por-rota` enumera os `route.ts`. Verificado ao vivo com conta pausada (cliente, serviço e produto 402; leitura e editar o negócio 200; nada gravado). **Ao fundir com o #144, a rota nova `POST v1/legal/accept` precisa de linha `'permite'` na tabela** (a guarda vai reprovar até lá; o dono pausado precisa conseguir aceitar termos).
- [ ] **C6 Avisos por e-mail.** Termos §5: avisamos 30 e 7 dias antes de a pausa acabar. E docs/87 §3.1: D-14, D-7, D-1 da cortesia. Precisa da fila de jobs (`job-queue`), não do cron do GitHub (atrasa horas).
- [x] **C7 Quem assina e cancela.** FEITO, e achou um defeito maior que o previsto: o cancelamento derrubava o plano NA HORA mesmo com o mês pago, contra a promessa dos Termos §6. Agora, com a assinatura `authorized`, `cancelarAssinatura` lê o `next_payment_date` do MP antes de cancelar e guarda `acesso_ate`; o degrau fica até essa data (webhook respeita; `expirarGracaVencida` derruba na data). Falha na leitura da data aborta o cancelamento. `pending` e `paused` caem na hora. Quem cai para `gratis` com cortesia vencida fica pausada (não no Grátis legado): `situacaoDaConta` já resolvia. Meu plano mostra "continua valendo até <dia>". **Não verificado contra o MP real**: a API de verdade não foi chamada (sem credencial); o formato de `next_payment_date` está coberto por teste de cliente com resposta simulada. Conferir com o primeiro pagamento de teste em sandbox.
- [x] **C8 Página pública do salão em conta pausada** mostra "indisponível". FEITO: `tenantPeloSlug`, `criarPedidoDeOrcamento` e `reconhecerCliente` recusam negócio pausado (`negocioEstaPausado`); o layout público troca o 404 pela mensagem com botão de ligar (48 px). Guarda exige a conferência em todo arquivo que resolve negócio por slug fora do painel (achou `reconhecimento.ts`). Verificado ao vivo a 375 px e em integração (pausado recusa e não grava; assinar reabre na hora).
- [ ] **C9 Eliminação depois da pausa** (90 dias): job com os dois avisos, e só depois do parecer humano sobre retenção (docs/86 §5).

## Jurídico (docs/86)

- [ ] J1 inventário de tratamento + guarda · [ ] J2 mapa de operadores (Eduardo confere o que está LIGADO em produção)
- [ ] J3 correção factual da política (servidores "no Brasil", lista de terceiros, canal) · [ ] J4 termos v2 completos (fornecedor, agregado, reaceite, IA)
- [ ] J5 política v2 · [ ] J6 DPA · [ ] J7 aviso na página pública de agendamento · [ ] J8 aceite explícito e reaceite
- [ ] J9 RIPD, retenção com a limpeza no código, runbook de incidente · [ ] J10 revisão de promessas · [ ] J11 guarda do assistente sem IA externa · [ ] J12 dossiê para revisão

## Achados desta rodada (medidos no navegador)

- "Meu plano" dizia "Você está no Equipe, R$ 99/mês" para a conta pausada e oferecia o Avançado.
- `llms.txt` listava Grátis e Avançado com preço (um assistente de IA repetiria).
- Uma guarda minha olhava só a primeira ocorrência e deixava passar a oferta calculada no topo do módulo.
- O banco local tinha a `0093` aplicada na ordem antiga (antes da `0092`) e `v_recover_revenue` perdeu o filtro de serviço arquivado; reaplicar a `0093` atual conserta. Em produção o lote `docs/runbooks/lote-0092-a-0098.sql` aplica na ordem certa.
