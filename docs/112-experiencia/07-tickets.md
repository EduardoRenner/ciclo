# 112 · 07 · Tickets, por onda

Cada ticket está escrito por inteiro (formato B2 do `docs/111`) no arquivo da frente:
- **J** (jornadas): `medidas/tickets-das-jornadas.md`
- **S** (cara de salão): `04-salao.md`
- **A** (avisos): `05-avisos.md`
- **K** (copy e acessibilidade): `medidas/copy-e-acessibilidade.md`
- **D** (desempenho): `06-desempenho.md` (entregue em 21/10, depois deste índice: EXP-D01 a D10).

"Sem o Vitor" = dá para fazer agora, no código, sem decisão dele e sem credencial de fora.

## Onda 0 · urgente (trava, número errado, vazamento, gente presa, promessa vazia)

| Ticket | O quê | Sem o Vitor? |
| --- | --- | --- |
| EXP-J08 | Entrar pelo número só quando o código sai | **feito** (`0a5e2b8b`) |
| EXP-A06 | Push só para quem precisa saber (hoje vaza nome de cliente para quem tem visão restrita) | sim |
| EXP-J01 | Um número só de "dá para recuperar" (R$ 355,40 x R$ 800,00) | parcial: escolher qual é a verdade pode ser dele |
| EXP-A01 | O dial de Automações passa a valer, ou sai da tela | sim, com padrão |
| EXP-A02 | Quatro textos que prometem canal que não existe | sim (o da política de privacidade é dele) |
| EXP-A03 | Cancelar pelo link avisa a profissional e a lista de espera | sim |
| EXP-A04 | Lista de espera não finge que avisou | sim |
| EXP-K01 | Convite da equipe pelo WhatsApp, sem trava de e-mail | sim (L2 do `docs/110`) |
| EXP-A08 | A cliente consegue sair, e as duas chaves se separam | sim |

## Onda 1 · cara de salão (o que quem chega vê primeiro)

EXP-S01 (demonstração abre num salão), EXP-S02 (semente nova das contas de salão), EXP-S03 (o cadastro acha "lash", "nail", "esmalteria"), EXP-S04 (beleza primeiro na lista de profissões), EXP-S05 (calculadora de salão), EXP-S06 (catálogo revisado), EXP-S14 (sistemas de beleza no "qual sistema você usa?"), EXP-S16 (termos, links e assistente), EXP-S11 e EXP-S12 (exemplos e masculino genérico no painel), EXP-S10 e EXP-K05 (mensagens sem erro de artigo), EXP-A07 (prévia das mensagens com cara de salão). **Do Vitor:** nomes das contas de demonstração, texto dos termos, EXP-S17 (`CLAUDE.md`), mudar a guarda de gênero (recomendação: manter).

## Onda 2 · todo dia (P2, P3, C1, C2)

EXP-J03 (quem volta já vê a manutenção), EXP-J06 (o botão leva até o campo que falta), EXP-S08 e EXP-S09 (o serviço de volta certo; serviço sem retorno fora do Motor), EXP-K03 e EXP-A10 (link de confirmar na mensagem que ela manda), EXP-A05 (o lembrete pede a ação que funciona), EXP-A11 (alarme no "adicionar à minha agenda"), EXP-K04 (avisar a cliente ao marcar, remarcar e cancelar), EXP-K08 (o campo da cliente não autopreenche a profissional).

## Onda 3 · leve e rápido

**Medido em build de produção (`06-desempenho.md`):** LCP no Lighthouse mobile de 2,75 s no salão e 2,87 s no agendar (meta 2,5 s); `/admin/hoje` faz 29 idas ao banco; Recuperar baixa 203 kB br, 44 kB só de polyfill de Temporal; a Fraunces pesa 120 KB e **o eixo SOFT é baixado e não usado** (o título sai com a serifa seca, contra o que o `docs/109` prometeu). Tickets, em ordem: EXP-D01 (tela de erro e 404 fora do JS de toda página pública, −22 kB br), EXP-D02 (Fraunces só com o que é usado, ≤ 55 kB, e o SOFT de verdade ou fora), EXP-D03 (Hoje de 29 para ≤ 18 idas), EXP-D04 (Recuperar sem o polyfill), EXP-D05 (CSS sem bloquear o render), EXP-D06 a D10. **Também FATO desta rodada:** no banco local, `GET /api/cron/recompute-cycles` levou **177 a 312 s** com cerca de 35 mil clientes (inclusive negócios de teste). Isso passa do tempo máximo de uma função na Vercel; medir em produção antes de concluir (HIPÓTESE). Mais EXP-K09 (nenhum toque espera sem avisar).

## Onda 4 · primeiro dia e volta (P1, C4)

EXP-S07 (mais de um ofício no cadastro), EXP-A12 (aviso de volta antes do dia; **acréscimo da revisão:** não avisar quem já tem horário marcado, não avisar depois de falta ou cancelamento, e juntar dois avisos que caiam no mesmo dia, as três regras da Fresha em `medidas/concorrentes.md`), EXP-J02 (marcar quem já é cliente sem redigitar), EXP-K12 e EXP-K13 (primeiro dia acessível), EXP-A09 (agendador de 15 minutos antes de ligar qualquer lembrete).

## Onda 5 · cliente com conta e equipe (C3, C5, C6, P6, P7)

EXP-J05 (remarcar), EXP-J07 (área da cliente, L3 a L5), EXP-A13 (uma tela "Avisos"), EXP-A14 (regras de pop-up), EXP-A15 (volta atribuída ao "Chamar"), EXP-K14 (desativar profissional com volta), EXP-J04 (o dia da autônoma sem comanda; **Do Vitor**).

## Onda 6 · polimento

EXP-K06, EXP-K07 (contraste nos temas automático e escuro, cor do salão e estrelas), EXP-K10, EXP-K11, EXP-K15, EXP-K16, EXP-S13, EXP-S15, EXP-S18.
