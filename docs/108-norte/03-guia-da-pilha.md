# 108 · Guia da pilha: o que está fora do ar e como levar

Levantado em 16/10/2026 contra o GitHub (`git fetch`, `git merge-tree`). **A `main` não muda desde 08/10** (`33058dd0`, PR #148). Tudo abaixo está pronto em branch e fora do ar.

## A pilha é uma cadeia só

```
main (08/10)
 └─ #149 simplifica/interface-2026-10-08 ......... 4 commits, migration 0118   (PR aberto, CI verde, mergeável)
 └─ #150 aprimoramento/onda-u1 .................. 31 commits, sem migration   (PR aberto, CI verde, mergeável)
     └─ aprimoramento/onda-u2 ................... +20, migrations 0121–0127  (sem PR)
         └─ conversor/esteira-universal ......... +43, migrations 0128–0129  (sem PR)
             └─ aprimoramento/onda-1 ............ +143, migrations 0130–0141 (sem PR) = 237 à frente da main
 └─ #151 loja/lacunas-2026-10-15 ................. 24 commits, sem migration   (PR em rascunho, CI verde)
```

**FATO** (`git merge-base --is-ancestor`): `onda-u1` ⊂ `onda-u2` ⊂ `conversor` ⊂ `onda-1`. Mesclar a `onda-1` leva as quatro.

O que tem nos 143 commits finais da `onda-1` (por prefixo do ticket):
- **61 APR:** consertos e melhorias do painel;
- **32 C:** ciclos do Motor e do algoritmo;
- **13 AUT:** oficina e pet. O pacote Oficina entra **fechado até a decisão** (AUT-104), o que cumpre o `00-decisao.md` §3 sem cortar nada.

**Os PRs #142 e #144** estão 121 commits atrás da `main` e conflitam com a `onda-1` (`mensagens.ts`, `versoes.ts`, Recuperar). Pelo norte, ficam para depois de 15/12. Fechar ou rebasear é decisão do Eduardo.

## Conflitos medidos

| Fusão | Arquivos em conflito |
| --- | --- |
| `onda-1` + #149 | 4: `recuperar/fila.tsx`, `recuperar/recuperar.tsx`, `schema/versao.ts`, `recuperar-receita.ts` |
| `onda-1` + #151 | 7: os dois do Recuperar, `seed-demo-dinheiro.mjs`, `excluir-conta/formulario.tsx`, `config/page.tsx`, `auth/signup/route.ts`, `legal-casos-estado.test.ts` |
| `onda-1` + `plano-2026-10-13-docs` | 0 |

**Os conflitos do Recuperar são a mesma ideia feita três vezes:**
1. a `onda-1` (C-037, pedido de 14/10): só "Dá para recuperar", preço cheio, sem lucro;
2. o #149: preço do serviço com consulta extra;
3. a loja: sem a linha de lucro, pedido de 16/10.

## A branch de integração (feita, sem tocar a `main`)

`integracao/norte-2026-10-16`, no worktree `ciclo-norte`: `onda-1` + #149 + #151, conflitos resolvidos assim.

| Arquivo | Resolução |
| --- | --- |
| Recuperar (dado) | `fullValueCents` da `onda-1`, sem a consulta extra do #149 |
| Recuperar (tela) | O enxugamento do #149: "Mais filtros" fechado, ícone do WhatsApp, linha sem a rubrica de estado; com o sujeito (animal ou carro) da `onda-1` |
| Guarda `recuperar-mostra-o-preco-nao-a-estimativa` (#149) | Passa a casar com `fullValueCents` |
| `schema/versao.ts` | A lista da `onda-1` (APR-030) com a 0118 no lugar |
| Cadastro | O LOJA-02 vira o desfecho `envio_indisponivel` do APR-025: mesmo 503 `EMAIL_UNAVAILABLE`, mesmo evento `signup_email_nao_enviado` |
| Excluir conta | A senha do LOJA-27 vai pelo `fetchComTentativa`, porque a guarda APR-007 proíbe chave nova por toque. O aviso da fila offline da `onda-1` fica junto |
| Configurações | O grupo novo da `onda-1`; "Notificações" some no app nativo (LOJA-24) |
| `seed-demo-dinheiro.mjs` | Lista padrão da `onda-1` com a trava "só conta de demonstração" da loja |
| `legal-casos-estado.test.ts` | O `opened_on: HOJE` da `onda-1` |

**Estado da verificação:** ver `_progresso.md`. Nada desta branch foi para a `main`, e o PR fica em rascunho até o Eduardo revisar.

## Como levar para produção (quando o Eduardo aprovar)

1. **Revisar o PR de integração** em vez dos cinco separados. Ele tem a mesma soma de commits, e os conflitos já vêm resolvidos com o motivo de cada um.
2. **As migrations 0118 e 0121 a 0141** seguem o processo que já funcionou (`docs/runbooks/publicar-a-branch-de-trabalho.md`):
   - SQL no painel, uma migration por vez, depois `supabase migration repair`, porque o `supabase db push` não funciona em produção;
   - **aditiva antes do deploy, restritiva depois.** As notas dos ciclos já marcam algumas como "depois do deploy" (0135, a chave antiga do ciclo, e 0139, a da trilha por sujeito, `docs/105-ciclo/_estado.md`).
   - O lote completo, classificado uma por uma, vai em `docs/runbooks/lote-0118-a-0141.md` (próximo passo deste loop).
3. **Depois do deploy:** `/api/health` com `MIGRATIONS_DO_CODIGO` em dia, e o roteiro do navegador do conversor contra produção, só leitura, numa conta de demonstração.
