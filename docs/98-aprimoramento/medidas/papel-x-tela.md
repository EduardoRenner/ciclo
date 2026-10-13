# Papel × tela (APR-039)

Medido em 13/10/2026 no banco **local**, app da porta 3200 (build da `main`), negócio `demo-dom-estilo`
do seed da APR-037 (`restrict_professional_view = true`), celular 390×844. Roteiro fora do repo:
`C:\temp\ciclo-medicao\papel-x-tela.mjs`. Dados brutos: `papel-x-tela.json` (75 linhas: 15 telas × 5
papéis, o dono como referência).

**Aceite:** 75 linhas preenchidas · **0 tela com 500** · toda tela que o papel não pode abrir dá 403
(em nenhuma o papel recebe erro). O que reprova é o **menu**: ele oferece telas que dão 403 (A-21).

Legenda: **vê** = abriu com conteúdo · **403** = tela de "sem permissão" · **menu** = o link aparece na
barra ou no menu do topo · R$ = quantos valores em reais aparecem no `main`.

| Tela | Dono | Profissional | Recepção | Gerente | Financeiro |
| --- | --- | --- | --- | --- | --- |
| Hoje | vê · menu | vê (só os horários dele) · menu | vê · menu | vê · menu | vê · menu |
| Agenda | vê · menu | vê · menu | vê · menu | vê · menu | vê · menu |
| Agenda/novo | vê · menu | vê · menu | vê · menu | vê · menu | **vê, mas o envio dá 403** (`finance` não tem `appointment:*`) |
| Comanda (fechada) | vê, 10 R$ | vê, 4 R$ | vê, 4 R$ | vê, 10 R$ | vê, 10 R$ |
| Caixa | vê · menu | **403 · no menu** | **403 · no menu** | vê (2 R$) · menu | vê · menu |
| Clientes | vê, 23 R$ | **vê a carteira inteira com ticket médio, 23 R$** | vê, 23 R$ | vê | vê |
| Ficha | vê | vê | vê | vê | vê |
| Recuperar | vê, 25 R$ | **vê o negócio inteiro, 25 R$** | vê | vê | vê |
| Campanhas | vê · menu | **vê · menu, e a API deixa criar** | vê (API recusa, pelo código) | vê | vê |
| Mês | vê | 403 | 403 | vê¹ | vê |
| Configurações | vê | vê (26 interativos) | vê | vê | vê |
| Orçamentos | vê | vê | vê | vê | vê |
| Comissão | vê (vazia²) | vê a própria | 403 | 403 | vê |
| Estoque | vê · menu | **403 · no menu** | **403 · no menu** | vê · menu | **403 · no menu** |
| Equipe ("Time") | vê · menu | **vê "Cadastrar", "Convidar", "Desativar"** (API recusa, pelo código) | idem | vê | idem |

¹ O roteiro marcou 403 para o gerente no Mês por casar uma frase do texto; o trecho salvo mostra a
tela do Mês com 8 valores. Corrigido à mão aqui (falso positivo de medição, conferido no JSON).
² O dono atende (Anderson) e a Comissão dele abre vazia — é a APR-212.

## Diferenças com o `rbac.ts`, e para onde cada uma vai

| # | O que a tela faz | O que o `rbac.ts` diz | Ticket |
| --- | --- | --- | --- |
| P-01 | Menu oferece Caixa e Estoque a quem recebe 403 (profissional, recepção, financeiro no Estoque) | `report:read`/`inventory:*` faltam a esses papéis | **APR-103** (já existe: menu obedece papel) |
| P-02 | "Time" mostra Cadastrar/Convidar/Desativar a profissional, recepção e financeiro; a API recusa no toque (lido no código das rotas, não tocado) | `professional:create/update/delete` só dono | **novo APR-041** (esconder ação que o papel não tem) |
| P-03 | Financeiro abre Agenda/novo e só descobre o 403 no fim do formulário | `finance` não tem `appointment:*` | **APR-041** |
| P-04 | Profissional vê a carteira inteira com dinheiro (Clientes, Recuperar) | `client:own` | **novo APR-040** (alcance `own`) |
| P-05 | Profissional cria campanha para a base toda: `campaigns` exige `client:update`, e `own` passa como se fosse `all` | `client:own` | **APR-040** |
| P-06 | **Cofre de saúde:** `GET /clients/[id]/vault` exige `vault:own` e abre com o cliente de serviço sem conferir se o profissional atende aquela pessoa. Qualquer profissional com AAL2 lê a anamnese de qualquer cliente do negócio (fica na trilha, mas abre) | `vault:own` | **APR-040, S1** (LGPD, dado de saúde) |
| P-07 | Recepção não vê o Caixa: quem confere a gaveta? | `reception` sem `report:read` | decisão do Eduardo (`09` §5 item 3) / APR-305 |

**Causa comum de P-04 a P-06:** das **123** chamadas a `exigirPermissao` em `src/app/api/v1`, só **2**
usam o alcance que ela devolve (`tickets/[id]/close`, desde a APR-038, e `commissions/extract`). Onde o
papel recebe `own`, as outras 121 tratam como `all`. A RLS segura agenda e comanda quando o negócio liga
`restrict_professional_view`; cliente, campanha e cofre não têm essa rede.
