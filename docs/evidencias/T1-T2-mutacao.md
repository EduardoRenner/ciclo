# T1/T2 · mutações das defesas novas (2026-10-08)

Commits 768ec22a e d6a8a260 antes de mutar; cada mutação conferida aplicada e desfeita.

| Defesa | Mutação | Resultado |
|---|---|---|
| `rotas-legal-exigem-aal2` | linha `await exigirAal2()` de `POST v1/legal/cases` trocada por comentário | reprovou: `handler sem segundo fator` |
| concorrência por `row_version` em `agirNaPendencia` | conferência da versão trocada por `if (false)` | reprovou: `versão velha é conflito (409), e não sobrescreve` (1 de 8) |
| política `legal_cases_select` (sigilo) | `alter policy` sem a cláusula de sigilo, no banco local | reprovou: `advocacia fora da equipe e secretaria não veem o sigiloso` (1 de 11); política restaurada e conferida em `pg_policies` |
| isolamento das tabelas da 0109 | (achado, não mutação) primeira rodada reprovou 8: sync e sugestão sem política, e as 7 tabelas sem semente | consertado: política de leitura nas duas e semente em todas; 301 de 301 |

Saída literal:

```
     → handler sem segundo fator: expected false to be true // Object.is equality
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: handler sem segundo fator: expected false to be true // Object.is equality
   × agir numa pendência > versão velha é conflito (409), e não sobrescreve 64ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 7 passed (8)
   × caso sigiloso: só a direção e a equipe do caso > advocacia fora da equipe e secretaria não veem o sigiloso, mas veem o normal 59ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 10 passed (11)
```
