# C-001 · Dar régua ao Motor: backtest fora da amostra

## Objetivo
Fazer o Motor de Ciclo ter uma medida de acerto que qualquer mudança futura precise vencer.
Número: "erro mediano da data prevista (dias) e % de acerto na semana (±7 dias)" de **não medido**
para **medido** em 5 cenários sintéticos com processo conhecido e no seed local, contra 4 bases
simples; e, se o backtest mostrar um defeito do Motor, uma correção que melhore o número sem piorar
nenhum cenário.

## Por que este, e por que agora
Trilha 3 (o algoritmo) é permanente, e é pré-requisito das trilhas 4 e 5: o relógio múltiplo do
carro e a ação automática do serviço como software só podem ser provados se houver uma régua. Hoje
`prestacaoDeContas` mede o acerto em PRODUÇÃO, depois do fato; não existe um jeito de comparar duas
versões do algoritmo ANTES de pôr no ar. Custo P, dano evitado alto (mudar o Motor às cegas).

## Cápsula de contexto
- Worktree `C:\Users\Usuario\.claude\code\ciclo-onda-u1`, branch `aprimoramento/onda-1`.
- Vai mudar: `src/core/cycle/` (arquivo novo `backtest.ts`, puro), `tests/unit/core/cycle/`.
- Pode mudar: `src/core/cycle/compute.ts` SÓ se o backtest provar defeito; aí sobe `VERSAO_DO_MOTOR`.
- Regras: core sem I/O; nada de float de dinheiro (aqui só dias); teste vê reprovar.
- Armadilhas: "duas cópias da mesma fórmula" (usar `mediana`, `TOLERANCIA_DIAS` exportados, nunca
  copiar); seed parece certo e é absurdo no agregado (o seed é sintético: o resultado no seed mede o
  gerador, não a clientela — dizer isso); medição ingênua dá falso positivo.
- Fora deste ciclo: relógio por quilometragem (C-002 ou depois), mudar a régua de estados.

## Hipóteses
- H1 [HIPÓTESE] o Motor (mediana dos últimos 5 + mistura no começo) ganha da "régua do serviço" em
  quem tem 3+ visitas — derruba se o erro mediano não cair.
- H2 [HIPÓTESE] o descarte de intervalos > 3× o padrão erra quando o padrão do serviço está errado
  (cliente de ritmo real 70 dias num serviço com padrão 21 perde todos os intervalos e volta ao 21)
  — derruba se o cenário "padrão errado" não mostrar erro grande.
- H3 [HIPÓTESE] no começo frio, a mistura 60/40 é melhor que o intervalo puro — derruba se o
  intervalo puro ganhar no cenário de 2 visitas.

## Pesquisa a fazer (F2)
- Interna: `compute.ts`, `calibracao.ts`, `prestacao-de-contas.ts`, quem chama `computeCycle`.
- Externa: como a literatura de recompra mede previsão de próxima visita (intervalo entre compras,
  BG/NBD e parentes), e a métrica que o próprio produto já usa (acerto na semana).

## Pronto quando
- [ ] `backtest.ts` puro, com origem móvel (para cada prefixo do histórico, prever a próxima visita)
- [ ] 5 cenários com processo conhecido, gerados com semente fixa
- [ ] tabela Motor × bases nos 5 cenários e no seed (quando o banco local estiver de pé)
- [ ] guarda: "nenhuma mudança no Motor piora um cenário" vista reprovando
- [ ] suíte inteira verde, typecheck 0, lint 0; diário, `_estado.md`, push

## Proibido (com motivo)
- Ajustar o Motor para os cenários sintéticos sem explicar o mecanismo — overfitting no próprio
  gerador é ganhar do espelho.
- Afirmar acerto em clientela real a partir do seed — o seed é sintético.
- Mudar `computeCycle` sem subir `VERSAO_DO_MOTOR` — a série histórica mistura eras em silêncio.

## Exemplo bom / exemplo ruim
- Bom: "no cenário 'padrão errado' (ritmo real 70, padrão 21) o erro mediano do Motor é 49 dias e
  o da mediana pura é 3; causa: o filtro de 3× descarta todos os intervalos. Correção X leva a 4 sem
  piorar os outros 4 cenários."
- Ruim: "o Motor ficou 12% melhor" (melhor em quê, contra o quê, em qual amostra?).

## Auto-verificação antes de declarar pronto
1. O número existe agora onde antes não existia, e veio do mesmo código que produção usa?
2. Escrevi que o seed é sintético?
3. Se mudei o Motor: subi a versão e todos os cenários ficaram iguais ou melhores?
4. Uma IA sem memória continuaria daqui lendo só `_estado.md`?
