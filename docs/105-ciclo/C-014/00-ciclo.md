# C-014 · Algoritmo: quem está atrasado ainda volta? (H1 + H3 do plano 98)

**F1 · Objetivo:** a chance de volta é uma tabela fixa por estado (0,85 / 0,65 / 0,35 / 0,12). Todo
"atrasado" vale 0,65, seja relógio de 12 visitas, seja cliente de 3 visitas quaisquer. Número: AUC na
fila de atrasados (chance de quem volta ficar acima de quem sumiu) e Brier.

**F2:** plano 98 §3 (O1/O3, H1/H3; BG/NBD de Fader, Hardie e Lee 2005, sem a premissa de Poisson que o
ciclo regular desmente; sugestão de sobrevivência empírica sobre "silêncio ÷ ritmo").

**F3 · Plano:** `probabilidadeDeAtivo` (`src/core/cycle/ativo.ts`): P(ativo) = (1−h)·S / ((1−h)·S + h),
com S = chance de um cliente ativo ficar esse tempo sem vir, tirada do ritmo e da folga DELE (mais uma
parcela de "pulou uma vez"); h = chance a priori de ter saído (palpite declarado, 0,1). Placar: foto em
dia sorteado, 1.500 clientes por cenário, 25% somem de vez, só os atrasados no dia da foto.

**F4/F5 · Medida (h 0,1, q 0,15):**

| Cenário | atrasados | voltaram | AUC tabela | AUC P(ativo) | Brier tabela | Brier P(ativo) |
| --- | --- | --- | --- | --- | --- | --- |
| regular | 122 | 22% | 0,91 | **0,97** | 0,14 | 0,15 |
| deriva | 219 | 57% | 0,90 | **0,95** | 0,13 | 0,13 |
| pulo | 227 | 58% | 0,74 | **0,79** | 0,21 | 0,18 |
| errático | 231 | 58% | 0,86 | 0,86 | 0,16 | 0,15 |
| padrão errado | 148 | 34% | 0,92 | **0,95** | 0,12 | 0,15 |

- **Ordem:** P(ativo) empata ou ganha em todo cenário. É o que a fila de recuperar precisa.
- **Calibração:** mista. O Brier depende de h, e nenhum h ganha em todos (varredura h 0,05–0,3, q 0–0,3).
  Conclusão: usar para ORDENAR; a probabilidade anunciada segue a tabela calibrada por salão.
- **H3 não confirmada aqui:** o ganho é parecido com ≤ 4 visitas e com ≥ 6. Ele vem da H1 (silêncio
  medido contra o ritmo e a folga do próprio cliente). O arnês faz todo mundo sumir no mesmo ritmo por
  construção, então NÃO consegue testar a H3; ela precisa de dado real (histórico N2 do plano 97).
- **Mutação que sobreviveu:** curva do termo principal 10× mais larga manteve a AUC (pulo até subiu para
  0,80) e piorou o Brier (regular 0,15 → 0,31). A ordem vem quase toda de "silêncio ÷ ritmo"; a
  largura controla a calibração. Guarda ganhou tetos de Brier por cenário.
- Correção de arnês no caminho: a foto de quem sumiu usava o padrão do serviço, e no "padrão errado"
  ninguém que sumiu aparecia atrasado (AUC indefinida). Passou a usar o ritmo do cliente.

**Decisão para o Eduardo (registrada, não bloqueia):** a fila de recuperar ordenar por
lucro × P(ativo) em vez de lucro × tabela. Muda o que o dono vê primeiro; precisa de rota no servidor.

**Nota:** cliente 7 · segredo 9 · engenharia 8. **Próximo (C-015):** banco do automotivo se o Docker
voltar; senão serviço como software: explicação por chamada no cartão da fila ("vem a cada 21 dias,
já faz 50"), item 6 do roteiro do plano 98, pura.
