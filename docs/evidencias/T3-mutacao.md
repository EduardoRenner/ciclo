# T3.2/T3.3 · mutações da Estrutura da família (2026-10-08)

Commit da entrega antes de mutar; cada mutação conferida por `git diff --stat` e desfeita.

| Mutação em `estrutura-da-familia.ts` | Resultado |
|---|---|
| sem a recusa de mover mais do que a pessoa tem | reprovou "não move mais do que a pessoa tem" |
| `simular` trabalhando sobre a lista recebida (sem cópia) | reprovou 2 (a lista do chamador mudou, e o antes × depois saiu igual) |
| sem o caso especial "empresa sem sócio não é abaixo de 100" | **passou**: o ramo era código morto, porque `validarEstrutura` (portada do LUBI) só soma empresas com aresta. Ramo removido; o teste fica como fixação do comportamento |
