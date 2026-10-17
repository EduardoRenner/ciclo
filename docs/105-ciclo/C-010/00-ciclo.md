# C-010 · Expansão pet: protocolo de saúde e "aproveitar o banho"

**F1 · Objetivo:** o catálogo já tem "Banho e tosa" (grupo pet), mas o pet shop só acompanha o banho.
Vacina, vermífugo e antipulgas não têm lembrete nenhum. Número: quanto da saúde do animal pode ser
resolvido no balcão, na visita do banho que o tutor já faz, sem mensagem própria. Docker ainda fora
do ar, então só lógica pura (o sujeito no banco é o EXP-001, junto com o automotivo).

**F2 · Pesquisa:**
- [WSAVA 2024](https://wsava.org/wp-content/uploads/2024/05/2024-Guidelines-for-the-Vaccination-of-Dogs-and-Cats.pdf):
  série do filhote a cada 2–4 semanas, última dose com 16+ semanas; adulto não mais vezes que o necessário.
- Prática no Brasil ([Petz](https://www.petz.com.br/blog/?p=2440621), [Petlove](https://www.petlove.com.br/dicas/vacinas-de-cachorro)):
  reforço anual da V8/V10 e da antirrábica, esta obrigatória por lei em muitos municípios.
- [ESCCAP](https://www.esccap.org/uploads/docs/k37pvjys_0778_ESCCAP_GL1__Worm_Management_Scheme_Fact_Sheet__Dogs_v8.pdf):
  vermífugo ≥ 4×/ano quando o risco não é conhecido; grupos A–D (1–2×/ano a mensal).
- Decisão de produto: o sistema não decide saúde; lembra o protocolo da casa. O padrão é o ponto de
  partida e a clínica substitui qualquer intervalo.

**F3 · Plano:** dois tipos de ciclo. HÁBITO (banho, tosa) fica com o Motor por sujeito. PROTOCOLO fica
com `src/core/pet/protocolo.ts`: série do filhote, reforço anual, vermífugo por idade e grupo de risco,
antipulgas pela duração do produto, "perguntar" quando não há registro nem idade (mesma regra do
automotivo, AUT-305). `aproveitar-o-banho.ts` põe o item no último banho até 7 dias antes de vencer,
nunca depois.

**F4/F5 · Placar (200 cães adultos por ritmo, 2 anos, sintético):**

| Banho a cada | No banho, até 7 d antes | No banho, até 14 d antes |
| --- | --- | --- |
| 7 dias | 98% | 100% |
| 14 dias | 69% | 97% |
| 21 dias | 38% | 89% |
| 30 dias | 22% | 34% |

Hoje: 0 itens de saúde lembrados. Com o protocolo: todos lembrados, e no tutor de banho quinzenal 69%
deles saem no balcão do banho, sem mensagem nem ida extra. Adiantar 14 dias resolve quase tudo no
quinzenal, mas tira até meia proteção de um antipulgas mensal: fica 7 como padrão e 14 como escolha
da casa (decisão registrada, não bloqueia).

**Nota:** cliente 7 · segredo 8 · engenharia 7. **Próximo (C-011):** banco do automotivo se o Docker
voltar; senão o viés da deriva no Motor (34% de lembretes desnecessários no C-009, o pior cenário).
