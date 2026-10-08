# Health do pacote (docs/101 §15): mutações

Commit: `ae2fac2b`. Integração `tests/integration/health-advocacia.test.ts`. Cada mutação confirmada aplicada
(`grep -c` = 1, ou `prosrc` conferido no banco) antes de ler o teste, e desfeita depois (7 passam, 1 pula).

| # | Mutação | Reprova |
|---|---|---|
| M1 | reconciliação olha só `ok`, não `count_gravado < count_fonte` | `dia incompleto acusa com a data e sem a OAB` |
| M2 | texto público ganha os alvos no fim (OAB vazando) | o mesmo caso: `not to contain '521445/SC'` |
| M3 | `legalMfa` passa a vermelho | `é amarelo: ok continua true` |
| M4 | função da 0116 sem o filtro de 7 dias (no banco) | `conta só quem está há mais de 7 dias` |

A primeira versão do M2 trocava o começo da frase e reprovava pelo começo, não pelo vazamento: mutação
inválida, refeita.

## O que pula e por quê

`quem tem fator verificado não conta` enrola e verifica TOTP de verdade (código calculado por RFC 6238 no
teste). O contêiner local subiu antes de o `config.toml` ligar o TOTP e não pode ser reiniciado (banco
compartilhado com outra sessão), então aqui ele pula dizendo por quê; com `CI` definido, pular é erro.

A cláusula do fator foi conferida à mão no banco local, numa transação com `rollback`: o escritório-modelo
tinha 5 sem fator; um fator `verified` inserido para um membro → 4; o mesmo fator como `unverified` → 5.

## Lacuna conhecida

A exclusão do escritório de demonstração na reconciliação e no `legalMfa` não tem teste de integração: os
slugs de demonstração são uma lista fixa e já existem no banco local (o gerador os usa). Está no código
(`ehDemonstracao`, a mesma fonte do cron), sem prova automatizada.
