# Competitive Gaps — CICLO

> Classificação do que a pesquisa (`competitors/`, `market-intelligence.md`) encontrou, em 5
> categorias. O objetivo não é listar tudo que concorrentes têm — é separar o que exige resposta do
> que é ruído. Ver regra do usuário: nunca copiar feature só porque concorrente tem.

---

## 1 · Paridade (concorrentes têm, CICLO não tem, e falta é um risco real de conversão)

| Item | Evidência | Risco de não ter |
|---|---|---|
| Nenhum item identificado nesta rodada. | — | — |

Não encontrei, na pesquisa feita, nenhuma funcionalidade onde a ausência no CICLO seja um motivo
plausível de alguém escolher um concorrente em vez dele. Os concorrentes pesquisados competem
principalmente em amplitude de nicho (app de barbearia) ou em marketplace de descoberta (Fresha/
Booksy) — nenhum dos dois é o jogo que o CICLO está jogando (SaaS direto para quem já tem base de
clientes). Isso é uma leitura, não uma garantia — revisitar se a pesquisa de concorrentes crescer.

## 2 · Diferenciação (CICLO tem algo que concorrentes não têm, e é defensável)

| Item | Evidência | Por que é defensável |
|---|---|---|
| Motor de Ciclo com cadência pessoal (por cliente × serviço), não janela fixa | `docs/45` — 2 citações públicas do setor admitindo que janela fixa é a resposta errada, e nenhum concorrente pesquisado tem alternativa a isso | Custo de troca: histórico de previsão (`cycle_predictions.computed_at`) só existe para quem já usa há tempo — não copiável retroativamente |
| Prestação de contas do Motor ("Motor acertou X%") | Já em produção (`/admin/recuperar`), decisão registrada em `docs/46` | Mesma razão acima — prova que só existe depois de operar |
| WhatsApp incluso no produto central, sem upsell | Trinks cobra como "recurso adicional" `[EVIDENCE, 20/09]` | Defensável enquanto durar — é decisão de pricing, não de arquitetura; concorrente pode copiar em um ciclo de pricing |
| Preço 100% publicado (nenhum "sob consulta") | Trinks esconde tiers maiores `[EVIDENCE]` | Fraco como moat (fácil de copiar), forte como argumento de confiança imediata |
| Onboarding não pede planilha — digitação assistida por memória (`/admin/clientes/ja-atendo`) | Construído e iterado 2x (09/10, 09/11) para o público real do nicho | Defensável enquanto concorrentes tratarem "importar" como sinônimo de "upload de CSV" |

## 3 · Eficiência (mesma coisa, CICLO faz com menos fricção)

| Item | Evidência |
|---|---|
| Onboarding de 3 perguntas vs. "onboarding personalizado" (assistido, não necessariamente rápido) da Trinks | `[FACT]` vs. `[EVIDENCE, 20/09]` — mas tempo real do CICLO nunca foi medido (`GO-3`), então esta linha é comparação de PROMESSA, não de resultado medido |
| Plano fixo por módulo, sem comissão por cliente | Contraste direto com o modelo Fresha (20% de comissão por cliente novo do marketplace) — já virou argumento em `/precos` |

## 4 · Experiência (qualidade de uso — pesquisa incompleta, marcado honestamente)

`[UNKNOWN]` para os 5 concorrentes — decisão deliberada de não testar fluxos de cadastro de
terceiros a fundo (ver `market-intelligence.md` §7, risco de criar conta real sem necessidade).
Não é lacuna de esforço, é limite de escopo assumido conscientemente.

## 5 · Nicho (segmento que concorrente atende e CICLO não mira)

| Nicho | Quem atende | CICLO mira? |
|---|---|---|
| Clínica de estética com ficha de anamnese | Trinks tem esse segmento nomeado | Parcialmente — grupo "beleza" existe, mas sem módulo de anamnese/prontuário dedicado `[UNKNOWN se demanda existe]` |
| Rede/franquia multi-unidade | Trinks tem tier dedicado ("implementação assistida", "migração assistida") | Não — CICLO é single-tenant por dono, sem conceito de rede/matriz `[FACT]` |
| Fora de beleza (casa/fitness/saúde/educação/pet/profissional) | Nenhum concorrente pesquisado atende — é espaço aberto, não gap a fechar | Ver `segments.md` §5 — deliberadamente não priorizado agora |

---

## Leitura consolidada

A pesquisa não encontrou nenhum item de **paridade urgente** (categoria 1) — o que é, em si, um
resultado importante: não há evidência de que o CICLO esteja perdendo conversão por faltar alguma
funcionalidade que concorrentes têm. Isso desloca a prioridade de "copiar o que falta" para
"comunicar melhor o que já é diferente" (`growth-opportunities.md` GO-2) e "medir onde a perda
realmente acontece" (GO-0) — consistente com o veredito já dado sobre a feature de migração (GO-1).
