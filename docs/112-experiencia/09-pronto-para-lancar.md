# 112 · 09 · Pronto para lançar?

## Veredito: **lança com ressalvas, depois da Onda 0 e da Onda 1**

Hoje (21/10/2026, branch `marca/feminina-2026-10-20`) **não lança**. Há um vazamento de nome de cliente entre profissionais no push (A06), um número de dinheiro que discorda entre duas telas (J01), uma tela que grava e não tem efeito (A01), e a primeira coisa que uma visitante vê é uma barbearia (S01). Fechadas as Ondas 0 e 1, lança com as ressalvas abaixo.

## Item por item

| Item (B5 do docs/111) | Estado | Evidência | Fecha com |
| --- | --- | --- | --- |
| 13 jornadas medidas no CICLO e em 3+ concorrentes | **parcial**: 10 medidas ou verificadas, P7 não medida, tempos sem valor (servidor de desenvolvimento) | `01-diagnostico.md`, `medidas/concorrentes.md` | refazer tempos em build de produção (Onda 3) |
| Nada com cara de barbearia no caminho de quem chega | **não** | demonstração na barbearia, contas de exemplo trocadas, catálogo e cadastro (`04-salao.md`) | Onda 1 |
| Avisos dos dois lados desenhados, o que liga hoje e o que espera a Meta | **sim** | `05-avisos.md` | — |
| Telas das jornadas dentro das metas de velocidade | **não**: salão 2,75 s e agendar 2,87 s de LCP (meta 2,5 s); INP não medido | `06-desempenho.md`; recálculo do Motor de 177 a 312 s no local | Onda 3 (EXP-D01 a D05) |
| 15 gates do `VERIFICACAO-FINAL.md` | **não respondidos nesta rodada** | — | rodar no fim da Onda 1 |
| O que está na branch e não no ar | **sim, conhecido** | pilha #149 → #150 → … → #154 → #155 (`docs/108-norte/03-guia-da-pilha.md`); migration 0142 sobe antes do código | publicar pela ordem do guia (Do Vitor) |
| 5 mudanças que mais rendem por lado | **sim** | `02-profissional.md`, `03-cliente.md` | — |
| Todo ticket com aceite medido e guarda | **sim** nos tickets J, S, A, K | arquivos das frentes | — |
| Revisão adversarial que mudou algo | **sim**: 4 mudanças | `08-revisao.md` | — |
| Resumo que cabe numa tela | **sim** | `00-resumo.md` | — |

## Ressalvas que valem mesmo depois das Ondas 0 e 1
- **Sem a Meta**, todo aviso sai pelo WhatsApp da profissional, com um toque dela. É honesto e funciona, mas não é automático.
- **Velocidade** sem número de produção até a Onda 3.
- **A área da cliente** (C3, C5, C6) é depois do piloto (`docs/110`).
