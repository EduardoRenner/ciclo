# C-003 · Diagnóstico da expansão (carro e pet): quem volta não é sempre o cliente

## Objetivo
Mapear o que a plataforma do CICLO já serve para oficina e pet e o que falta, e provar com número o
maior buraco estrutural. Número: erro mediano do Motor para um tutor com 2 animais (ou uma família
com 2 carros) no mesmo serviço, hoje × agrupando pelo "sujeito" (animal, veículo).

## Por que este, e por que agora
Trilha 4, degrau (a): diagnóstico antes de qualquer pacote. LEITURA prévia: `client_cycles` tem chave
(tenant, cliente, serviço). Na beleza o cliente É quem volta. No pet volta o ANIMAL; na oficina, o
CARRO. Um tutor com 2 cães no banho quinzenal vira uma série só, com intervalos de ~7 dias — e o
catálogo do CICLO JÁ TEM "Banho e tosa" (`profession_services`, grupo pet). Pode ser dano vivo.

## Cápsula de contexto
- CICLO `ciclo-onda-u1`: `src/core/cycle/` (backtest, relógios), `supabase/migrations/0001` (`client_cycles`),
  `0026_catalogo_profundo.sql` (banho_tosa, vocabulário "tutor"), `src/core/pacotes/` (base, advocacia).
- StarkOS (só leitura): placa é a espinha dorsal; histórico no veículo, não no dono; placa repetida
  TRANSFERE o veículo.
- Fora deste ciclo: migration do sujeito (vem com plano próprio e revisão adversarial).

## Hipóteses
- H1 [HIPÓTESE] série única para 2 animais defasados faz o Motor prever ~metade do ritmo real e
  marcar "atrasado" quem está em dia — derruba se o placar não mostrar.
- H2 [HIPÓTESE] o resto da plataforma (agenda, comanda, clientes, mensagens, Motor, prestação de
  contas) serve aos dois sem mudança de núcleo; o que muda é vocabulário, campos e o sujeito.

## Pronto quando
- [ ] `01-pesquisa.md`: mapa serve/falta para oficina e pet, com evidência
- [ ] cenário "dois sujeitos, um cliente" no placar, com e sem agrupamento
- [ ] função pura de agrupamento por sujeito, testada
- [ ] plano dos degraus (b) com a migration aditiva desenhada (não aplicada)
- [ ] suíte inteira, typecheck, lint; `_estado.md`, push

## Proibido (com motivo)
- Criar tabela/migration neste ciclo — o desenho do sujeito toca agenda, comanda, ciclo e RLS; sem
  revisão adversarial vira a próxima "segunda FK quebra o embed".
- Escrever no StarkOS.

## Exemplo bom / ruim
- Bom: "tutor com 2 cães quinzenais defasados 7 dias: Motor hoje erra 7 dias e marca 'atrasado' 40% das
  vezes em dia; por sujeito, erro 1 dia."
- Ruim: "pet precisa de cadastro de animais."

## Auto-verificação
1. Medi o buraco ou só descrevi? 2. O mapa diz o que JÁ serve (para não refazer)? 3. O desenho do
sujeito preserva a beleza sem mudança (sujeito nulo = cliente)?
