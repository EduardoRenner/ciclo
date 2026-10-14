# C-002 · Relógio múltiplo: o Motor prevê pelo que vencer primeiro (tempo ou quilometragem)

## Objetivo
Dar ao Motor um segundo relógio — quilometragem — e prever "o que vencer primeiro" com o ritmo de
uso de CADA veículo. Número: erro mediano (dias) da data em que a manutenção de fato vence, para 5
perfis de motorista, de "só meses" (como o StarkOS faz hoje) para "o que vencer primeiro com o ritmo
do carro"; e o atraso do lembrete (dias depois do vencimento) em 0 para a mediana dos perfis.

## Por que este, e por que agora
Trilha 3 (algoritmo, relógio múltiplo) e trilha 4 (expansão automotiva) no mesmo ciclo. É a prova
de que o Motor serve a qualquer negócio com cliente que volta. E há dano: o StarkOS calcula
`previsto_em` só pelos meses (`regras_manutencao.intervalo_meses`); o `previsto_km` é calculado mas
nunca vira data, porque não existe o ritmo de km por dia do carro.

## Cápsula de contexto
- CICLO: worktree `ciclo-onda-u1`, branch `aprimoramento/onda-1`. Novo: `src/core/cycle/relogios.ts`
  (puro) e o placar em `tests/unit/core/cycle/`. Nada de banco nem tela neste ciclo.
- StarkOS (`C:\Users\Usuario\.claude\code\starkos`, sem remote): fonte de domínio, SÓ leitura.
  `veiculos.km_atual`, `ordens.km_entrada/km_saida`, `regras_manutencao` (10.000 km ou 12 meses;
  20.000/12; 10.000/12), `lembretes_manutencao.previsto_em/previsto_km`.
- Invariante: para quem só tem o relógio de tempo (beleza), o resultado tem de ser IDÊNTICO ao
  `computeCycle` (v2). O relógio novo soma, não muda o que já funciona.
- Armadilhas: leitura de km digitada errado (km menor que a anterior, salto absurdo); carro parado
  meses (ritmo 0); só uma leitura (sem ritmo — usar o ritmo de referência e dizer).

## Hipóteses
- H1 [HIPÓTESE] para o motorista médio brasileiro (~13 mil km/ano), 10.000 km vencem antes de 12
  meses (~9 meses), logo "só meses" lembra ~3 meses tarde — derruba se o placar não mostrar atraso.
- H2 [HIPÓTESE] para motorista de aplicativo (~50 mil km/ano) o atraso de "só meses" passa de 9
  meses — e é o cliente que MAIS vale para a oficina.
- H3 [HIPÓTESE] a mediana dos ritmos entre leituras (km/dia) é robusta a uma leitura errada.

## Pesquisa (F2)
- Interna: o modelo do StarkOS (acima).
- Externa: km médio por ano no Brasil; regra de troca de óleo e uso severo.

## Pronto quando
- [ ] `relogios.ts`: ritmo de uso robusto, previsão por relógio, "o que vencer primeiro", qual
      relógio decidiu (para a mensagem dizer "pela quilometragem" ou "pelo tempo")
- [ ] invariante: relógio só de tempo = `computeCycle` (teste)
- [ ] placar em 5 perfis de motorista com semente fixa; guarda vista reprovando
- [ ] suíte inteira, typecheck, lint; `_estado.md`, push

## Proibido (com motivo)
- Mudar o StarkOS neste ciclo — é outro repositório e outro ciclo (PARTE 5 do 105).
- Prever data por km sem ritmo medido e sem dizer que usou o ritmo de referência — seria prometer
  precisão que não temos.

## Exemplo bom / ruim
- Bom: "app (50 mil km/ano): só meses lembra 290 dias depois do vencimento; o que vencer primeiro
  com o ritmo do carro erra 3 dias."
- Ruim: "a previsão automotiva ficou mais precisa."

## Auto-verificação
1. Beleza ficou idêntica? 2. O atraso do lembrete caiu nos 5 perfis? 3. Uma leitura errada derruba
a previsão? 4. Escrevi que os perfis são sintéticos?
