# C-013 · Dano vivo: a metade sem prova da regra do C-011

**F1 · Objetivo:** antes de seguir expandindo, procurar risco real no que já está na branch. Número:
acerto na semana nos cenários que faltavam.

**F2 · Achado:** a regra da v4 (C-011) aceitava dois casos: os 2 intervalos acima de 3× o padrão
(medido: padrão errado 66% → 79%) e os 2 abaixo de metade do padrão. Nenhum dos cinco cenários tinha
intervalo curto, então a segunda metade entrou sem prova. Isso fere o método do plano 98 ("nada entra
no Motor sem prova"). Exemplo do risco: tratamento em sessões semanais antes da manutenção.

**F3 · Plano:** dois cenários de ritmo curto (`CENARIOS_CURTOS`, fora da lista principal porque cada
placar tem pisos por nome): cliente semanal num serviço de 21 dias, e 2 sessões de 5 dias antes do
ritmo de 21. Medir v3, v4 inteira e v4 só acima.

**F4 · Medida (faixa 3+ · geral):**

| Versão | ritmo curto (7, padrão 21) | sessões iniciais (2× 5, depois 21) |
| --- | --- | --- |
| v3 | 1 d · 99% · geral 84% | 4 d · 66% · geral 59% |
| v4 como estava (acima ou abaixo) | 1 · 100% · geral 85% | 4 · **64%** ✗ · geral **57%** ✗ |
| **v4 só acima (corrigida)** | 1 · 99% · geral 84% | 4 · 66% · geral 59% |

Os cinco cenários principais são idênticos nas três versões, exceto o padrão errado (v4 = 79%).

**F5:** a metade de baixo ganhava 1 ponto num cenário e perdia 2 noutro: removida. `VERSAO_DO_MOTOR`
segue 4, porque a v4 nunca saiu desta branch. Pisos novos para os dois cenários curtos; reintroduzir a
metade de baixo reprova (mutação). Registro do C-011 corrigido.

**Lição de método:** cada regra nova do Motor precisa de um cenário que exercite CADA ramo dela.
Cenário que não chega no ramo dá "nenhum cenário mudou", que parece prova e não é.

**Nota:** cliente 5 · segredo 7 · engenharia 9. **Próximo (C-014):** banco do automotivo se o Docker
voltar; senão algoritmo: H3 do plano 98 (o número de visitas como evidência de que a pessoa segue
ativa), medido com o placar de sumiço do C-009.
