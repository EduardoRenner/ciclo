# T5b.4 · kit de demonstração: o que a conferência achou

Commit: `7bbfd055`. O kit (`docs/101-kit-de-demonstracao.md`) foi escrito conferindo cada frase contra o
código e o escritório-modelo. A conferência achou um defeito de produto e dois de texto:

- **Frase falsa na triagem.** O cartão "Sugestão a confirmar" dizia "Regra de contagem ainda não confirmada
  pela direção". O núcleo (`sugerirPrazo`) só devolve data quando `podePreencher` é verdadeiro, isto é, com
  todas as regras confirmadas: a frase era falsa toda vez que aparecia, e o roteiro do anexo 06 mandava lê-la
  em voz alta. Agora: "Confira a conta antes de usar: a data só entra no prazo quando você confirma."
- **Gênero suposto.** O motivo de "sem sugestão" dizia "confirmada pelo sócio"; três textos da Estrutura
  falavam de terceiros no masculino ("Tirar o sócio 1", "o percentual dele", "Nenhum sócio lançado"). Nomes de
  ato societário ("Entrada de sócio", "Acordo de sócios") ficaram: são nomenclatura.
- **Roteiro contra o seed.** O 110% está na Lago Alimentos (família Lago), não na do Antônio; linha do tempo,
  "Quanto tempo isto custa" e reinício por botão não existem e estão como "não mostrar".

Guarda `tests/unit/design/triagem-nao-contradiz-a-sugestao.test.ts`, mutações (`grep -c` = 1, desfeitas, 3/3):

| # | Mutação | Reprova |
|---|---|---|
| M1 | frase falsa de volta no cartão | `o cartão com data sugerida não diz que a regra falta` |
| M2 | "pelo sócio" de volta no núcleo | `o motivo de "sem sugestão" do núcleo não supõe gênero` |
| M3 | rótulo do cartão renomeado (o recorte some) | `o recorte do cartão foi achado` (não passa vazia) |

A gravação do vídeo e a escolha entre login de visitante e vídeo ficam com o Eduardo.
