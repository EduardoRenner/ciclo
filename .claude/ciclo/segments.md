# Segments — CICLO

> Segmentos, separando o que o PRODUTO suporta (catálogo de profissões, `[FACT]`) do que o
> GO-TO-MARKET de fato mirou até agora (pesquisa competitiva, marketing, demo) — são coisas
> diferentes, e confundir as duas é o erro mais fácil de cometer aqui.

---

## 1 · O que o catálogo suporta hoje `[FACT]`

17 profissões em 8 grupos (`supabase/migrations/0022`, `0026`), mais um fallback genérico
("Outra") para quem não está na lista:

| Grupo | Profissões seedadas |
|---|---|
| **beleza** | Cílios, Unhas, Barbearia, Sobrancelhas, Depilação, Estética facial e corporal, Tatuagem, Cabelo (8) |
| **casa** | Faxina e diarista, Eletricista, Encanador, Jardineiro (4) |
| **fitness** | Personal trainer (1) |
| **saude** | Psicólogo (1) |
| **educacao** | Professor particular (1) |
| **eventos** | Fotógrafo (1) |
| **pet** | Nenhuma seedada ainda **[FACT]** — grupo existe no schema (`check` constraint), sem linha |
| **profissional** | Nenhuma seedada ainda **[FACT]** — idem |

Cada profissão carrega, por desenho (`docs/09-PLATAFORMA.md` §4): onde o atendimento acontece
(local/vai até/remoto/híbrido), como cobra (fixo/hora/visita+hora/diária/orçamento/pacote/
recorrente), como começa (direto/pede autorização/orçamento antes), e o ritmo (avulso/recorrente/
sazonal/sob demanda). Isso não é cosmético — muda vocabulário, módulos padrão e ciclo padrão por
profissão.

## 2 · O que o go-to-market de fato mirou até agora `[EVIDENCE]`

**100% da pesquisa competitiva (`competitors/`), 100% do posicionamento (`docs/43`), e 100% do
cadastro demo (`scripts/seed-demo-6-negocios.mjs`, 3 barbearias + 3 salões) são sobre o grupo
BELEZA.** Nenhum dos cinco concorrentes pesquisados atende "casa" (faxina/eletricista/encanador),
"fitness" (personal trainer) ou os outros grupos. Isso não é um erro — é concentração deliberada
num nicho denso o bastante para ter concorrentes de peso pesquisáveis — mas significa que **o
produto suporta 8 grupos e a estratégia de crescimento só testou 1**.

## 3 · Segmentos dentro de beleza — evidência vs. hipótese

| Segmento | Evidência real | O que se sabe |
|---|---|---|
| **Barbearia** | Forte — é o nicho dos 2 concorrentes mais pesquisados (AppBarber, BestBarbers), ciclo curto (~21 dias, calibra régua do Motor em 2-3 meses) | Segmento onde o Motor de Ciclo prova valor MAIS RÁPIDO por ter ciclo curto — `[INFERENCE]` |
| **Salão de beleza (cabelo/unhas)** | Média — coberta pela pesquisa de Trinks/Booksy/Fresha, que atendem o setor amplo | Ciclo de retorno mais variável por serviço (corte vs. coloração vs. unha) |
| **Estética facial e corporal** | Fraca — mencionada só de passagem (Trinks tem "clínica de estética" como segmento próprio, com fichas de anamnese) | Ciclo mais longo — calibração do Motor demora mais **[INFERENCE]** |
| **Cílios, sobrancelhas, depilação, tatuagem** | **[UNKNOWN]** — nenhuma pesquisa dedicada | Sem evidência de concorrente especializado ou demanda diferenciada |

## 4 · Segmentos fora de beleza — quase inteiramente hipótese

**[HYPOTHESIS], sem evidência de mercado coletada nesta rodada:** os grupos casa/fitness/saúde/
educação compartilham uma característica que poderia favorecer o Motor de Ciclo tanto quanto
beleza — são serviços RECORRENTES com cliente que decide voltar (ou não) por conta própria, sem
contrato fixo. Faxina quinzenal, personal trainer semanal, psicólogo semanal — todos têm "quando é
a hora de voltar a chamar" como pergunta real.

**O que falta para isso deixar de ser hipótese:** nenhum concorrente foi pesquisado nesses
segmentos (os 5 pesquisados são 100% beleza), não há tenant pagante em nenhum grupo (`docs/43`:
zero pagantes no total), e o catálogo de profissões nesses grupos está fino (1 profissão cada,
contra 8 de beleza) — sinal de que a PLATAFORMA foi generalizada em schema antes de o mercado ser
validado em qualquer um desses grupos.

## 5 · O que isso sugere

Não decido aqui se vale expandir a pesquisa para outros grupos — isso é uma escolha de prioridade
de negócio, não uma conclusão de pesquisa. O que registro, para `growth-opportunities.md` decidir
com isso em mãos: **continuar aprofundando em beleza (onde já há concorrência mapeada e a demo
inteira está calibrada) tem retorno mais rápido e verificável do que abrir uma frente nova sem
nenhum concorrente pesquisado para aprender com ele.**
