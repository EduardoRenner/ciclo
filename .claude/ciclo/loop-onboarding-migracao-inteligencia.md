# Missão · onboarding/migração (83) → dados/inteligência (84) → Motor de Inteligência (85)

Executar, do mais antigo pro mais novo, os planos gerados em 2026-09-28. Um ticket por vez,
um commit por ticket (regra 12 do CLAUDE.md), `pnpm verify` verde antes de cada commit.
Se um item depende de advogado ou de decisão do Eduardo que não está registrada, **não
implementar às cegas** — anotar em `docs/DECISOES.md` como pendência e seguir pro próximo.

Branch: `melhoria/onboarding-inteligencia-2026-09-28` (a partir de `main`).

## Ordem

### Fase 1 — docs/83 (onboarding + migração) — P0 já feito (BL-51, commit 007bb25d)

- [x] P1 (5815bc5c, outra sessão) — tela "Pra deixar o CICLO do seu jeito" com só a Pergunta 1 ("Onde estão seus
      clientes hoje?") + roteamento (§5.3) + eventos `perfil_respondido`/`perfil_pulado`
- [x] P2 (41f506a0, outra sessão) — tela "Vindo de outro sistema" (AppBarber, Belasis, BarbUp, outro — nomeados,
      decisão de 28/09 já aprova) com mensagem pronta pro suporte antigo + as 3 saídas §5.4
      (traga agora / use junto / me manda que eu faço). O benefício de 1 mês de Essencial
      fica marcado como dependente de decisão de preço — não implementar o desconto sem
      confirmar o mecanismo de concessão.
- [x] P3 (b00193cb; retomado e terminado pela sessão "Ciclo: mudanças e lacunas para venda") — "Baixar todos os meus clientes em planilha" (exportação da base inteira)
- [x] P4 (df14efa3; NENHUMA lib passou — DECISOES; no lugar: reconhece planilha binária e dá o passo a passo do CSV) — aceitar `.xlsx` no importador (avaliar dependência nova antes de instalar; se
      exigir lib pesada ou com histórico de CVE, registrar em DECISOES e pular)
- [x] P5 (937d1cc0; só as 2 dores com cartão, "Só eu" só desliga — DECISOES 29/09) — Perguntas 2 e 3 com efeito real (pré-ajuste de módulo; ordem da Central de Ações)
- [x] P6 (e62d6023; seção na própria tela, cada frase condicionada ao plano) — tela "O que muda por aqui" pra quem respondeu "outro sistema"

Pular: detector de export por concorrente, importação de histórico completo, Contact
Picker (não decidido), "1 mês de Essencial" como desconto real (preço, não decidido).

### Fase 2 — docs/84 (dados e inteligência) — só o que não depende de advogado/Eduardo

- [x] (94bf264e, pela sessão "Ciclo: mudanças e lacunas para venda") Capturar "demanda não atendida" na página pública (evento sem dado pessoal: alguém
      escolheu serviço+dia e não havia horário)
- [x] (commit do serviço canônico, migration 0097 — aplicar em produção ANTES do deploy) Serviço canônico: vínculo de cada serviço do salão com o item do catálogo de origem
- [~] PULADO — depende da cláusula dos termos (advogado), DECISOES 29/09 — Pipeline agregado (schema `insights`, sem tenant_id/client_id, k-anonimato) — grava,
      não mostra nada até o limiar de N negócios (hoje não passa, e tudo bem)
- [x] (ba4abe1d, pela sessão "Ciclo: mudanças e lacunas para venda") Mapa de vazamento de receita v1 (Aposta B) — só depois da Fase 3, pois é a tela que
      junta os cálculos existentes; se a Fase 3 não terminar a tempo, montar com os cálculos
      atuais mesmo sem o Motor de Inteligência

Pular e registrar em DECISOES: cláusula de termos/privacidade (advogado), aceite
versionado ligado a essa cláusula (o BL-50 de versionamento em si pode seguir, mas a
cláusula de dados agregados não entra sem redação jurídica), autopilot sem aprovação.

### Fase 3 — docs/85 (Motor de Inteligência determinístico)

> **2026-09-29 · Fase 3 inteira EM EXECUÇÃO pela outra sessão ("Ciclo: mudanças e lacunas para
> venda"), no mesmo working tree e na mesma branch (`fix/motor-nao-esquece-2026-09-27`).** Não
> duplicar MI-1…MI-7: os arquivos são `src/core/inteligencia/*`, `src/server/providers/ai/*`,
> `src/app/api/v1/assistant/route.ts`. Aquela sessão não toca nos arquivos da Fase 1 (P3 exportação
> estava sem commit em `clientes.ts`/`exportar/`/`csv-seguro.ts` e foi deixada como estava) e só
> faz `git add` de arquivo por nome — nunca `git add -A`. Se for commitar "trabalho solto", confira
> antes se não é arquivo dela.

- [x] MI-1 (4e3b9f7c, dfd1ef4f) — `core/inteligencia/entender.ts` + gabarito em teste (intenção + período pras
      ~9 perguntas das respostas rápidas + as 13 ferramentas existentes)
- [x] MI-2 (c972b001, c3082b7d, e7ad3d8b, 344a000a, 3db106b6) — `MotorDeConversa implements AiProvider` + trocar o provider na rota + tirar a
      dependência de `GEMINI_API_KEY` do `admin/layout.tsx`/`health.ts`
- [x] MI-3 (62959eb6; botões de próximo passo; a VARIAÇÃO de frase ficou de fora de propósito — DECISOES 29/09) — `falar.ts` com variação determinística (por dia+tenant) e botão de próximo passo
- [x] MI-4 (933f7042, 4520339d) — contexto curto ("e no mês passado?", "por quê?", "resolve")
- [x] MI-5 (98f843e8; mesmos dias dos dois meses, decomposição exata, + quem costuma voltar) — `explicar_variacao` (decomposição do faturamento)
- [x] MI-6 (d4239a29; preço em 3 cenários + empate, contratação pelo que sobra, dia extra honesto) — `simular` (contratar, dia extra, preço com premissa do dono)
- [x] MI-7 (ecf055c9; SEM palavra da pergunta, só motivo+tema de lista fechada — regra 9) — contagem do que não foi entendido (`product_events`, sem gravar o texto cru)

### Fase 4 — o resto do docs/84 §8 que não depende de ninguém (aberta em 29/09, pedido "continua o que falta")

- [x] P4 memória do cliente (b6676bb7) — dia da semana no fuso do salão, com quem, faixa de retorno;
      ficha + assistente ("que dia a Maria costuma vir?"), cada fato com piso e contagem
- [x] P2 "resolve" no assistente (49bc97f8) — "resolve"/"faz isso"/"chama ela"/"chama a Maria" preparam a
      chamada de volta pelo WhatsApp DO DONO (mesma lista, texto, rota e permissão da tela Recuperar)
      + 2 consertos achados medindo: "-2 dias sem voltar" (f88c4b65) e "14 passaram da hora" contando
      quem ainda não passou (f09af0f4)
- [x] P3 experimentos v1 (5ccbbe39; migration 0098 ANTES do deploy) — /admin/experimentos, link em "O mês";
      antes congelado na criação, início só hoje ou depois, leitura sem veredito enquanto roda
- **Fase 4 fechada em 29/09.** O que resta do 83/84/85 depende do advogado (pipeline agregado,
  comparativo) ou do Eduardo (1 mês de Essencial, dores 3 e 4 da Pergunta 3, plano dos testes)
- Fica de fora (registrado): resumo do mapa no topo do "Hoje" (DECISOES 29/09 pôs o mapa em "O mês"),
  pipeline agregado e comparativo (advogado), autopilot sem aprovação (F0)

## Critério de parada

Rodar até esgotar a lista ou até o orçamento de tempo/token acabar. Ao final de cada
ticket, registrar em `docs/DECISOES.md` ou num log de progresso o que foi feito, o que foi
pulado e por quê. Nunca pular o `pnpm verify` nem o teste-guarda visto reprovando.
