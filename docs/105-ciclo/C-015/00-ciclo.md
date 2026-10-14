# C-015 · Dano vivo + serviço como software: o porquê da chamada na fila

**F1 · Objetivo:** o cartão da fila de recuperar diz "Corte · 12d de atraso". O plano 98 (item 6 do
roteiro) pede o porquê: "Vem a cada 18 dias, veio faz 31". Número: cartões da fila com o ritmo dito.

**F2 · Achado (dano vivo):** isso já foi feito em 27/09 (commit 87bccca9, branch local
`melhoria/orcamento-e-motor-2026-09-27`, sem PR). A migration 0092 dele chegou à main por outro caminho;
o código, não. Resultado na main: `client_cycles.sample_size` existe SEM ESCRITOR (sempre 0), o Motor
não tem o campo `amostra`, e a fila nunca mostrou o ritmo. É o padrão "coluna sem escritor".

**F3 · Plano:** cherry-pick tentado e abortado (8 arquivos em conflito com código de 3 semanas atrás,
incluindo arquivo já apagado). Reimplementação mínima sobre o código atual:
- `computeCycle` devolve `amostra` (intervalos que formaram o ciclo pessoal; 0 = só o padrão);
- as 3 portas que gravam `client_cycles` gravam `sample_size`;
- `ItemRecuperar.ritmo` leva o dado cru da view (0121 já expõe as colunas);
- o cartão monta a frase com `ritmoDoCliente`/`fraseDoRitmo` (já existentes) no fuso do salão. Sem
  mudar a assinatura de `listarParaRecuperar` (os 6 chamadores ficam como estão).

**F4:** 6 casos de amostra no Motor; guarda `ciclo-grava-amostra` (toda escrita de
`personal_cycle_days` em `client_cycles` grava `sample_size`; piso: as 3 portas conhecidas).

**F5 · Medida:** cartões da fila com o porquê: 0 → todo cliente com intervalo medido (amostra 0 continua
sem cadência, só "veio faz N dias", como a ficha já fazia).
**NÃO verificado no navegador:** sem Docker não há banco local nem dado na fila. Fica para quando o
Docker voltar (prova a 390 px no build de produção).
**Dependência de deploy:** a 0092 precisa estar aplicada em produção ANTES deste código subir (senão o
upsert de `client_cycles` falha por coluna inexistente). Não deu para conferir: o projeto de produção
não aparece na conta do Supabase ligada a esta sessão.
**Branch antiga:** `melhoria/orcamento-e-motor-2026-09-27` tem outros commits fora da main; vale o
Eduardo olhar o que mais ficou para trás nela (registrado, não bloqueia).

**Nota:** cliente 8 · segredo 7 · engenharia 8. **Próximo (C-016):** banco do automotivo se o Docker
voltar; senão varrer `melhoria/orcamento-e-motor-2026-09-27` e outras branches locais atrás de mais
trabalho pronto que não chegou na main (mesma classe de dano deste ciclo).
