# 116 · Logo do CICLO · estudo e prompt (21/10/2026)

## O que o Vitor quer
- Só o nome **CICLO** (com, no máximo, um sinal pequeno junto).
- Base **azul**, com **um toque de rosa**: quem bate o olho entende "beleza", mas não fica "tão feminino" a ponto de afastar cabeleireiro, barbeiro ou o salão misto.
- Ideia que ronda: algo que **gira** (o ciclo, o "carregando", uma espiral) e talvez um **relógio** (agenda, hora marcada, a volta da cliente).

## Estudo rápido do mercado (impressão geral; conferir nos sites antes de fechar)
- **Fresha e Booksy:** marcas de nome em preto/neutro, letra limpa, sem desenho. Passam "ferramenta séria". O lado beleza vem das fotos, não da logo.
- **Trinks, Avec (Salão VIP), Belasis, Gendo:** puxam para cores mais quentes ou roxo/magenta e fontes arredondadas; parecem "salão", mas se parecem entre si.
- **AppBarber, BarbUp:** escuros, cara de barbearia (justamente o que o CICLO deixa para trás).
- **Lacuna:** quase ninguém usa **azul profundo com um acento rosa**. Azul passa confiança e organização (agenda, dinheiro); o rosa, pequeno, diz "beleza" sem gritar. É um espaço livre.

## Direção recomendada
1. **Palavra "CICLO" em caixa alta ou caixa baixa redonda**, letras grossas e simpáticas (sem serifa, ou a Fraunces do `docs/109` só se o Vitor quiser manter).
2. **O "O" final vira o símbolo:** um anel quase fechado, como um indicador de carregamento girando, com a ponta em **rosa** (a "volta" da cliente). Dentro dele, opcional, **dois ponteiros de relógio** bem finos. O mesmo "O" sozinho é o ícone do app e o favicon.
3. **Cores:** azul-noite `#1E2A5A` (texto) + azul `#3B5BDB` (anel) + rosa `#F06595` (só a ponta do anel ou um ponto). Fundo claro `#F8F9FC`; no escuro, texto `#F8F9FC`.
4. **Animação:** o anel do "O" gira uma vez (0,8 s) na tela de carregamento e no "aguarde" do app: a logo vira o próprio indicador de carregamento.

Alternativas para a página de comparação: (A) anel com ponta rosa; (B) anel + ponteiros; (C) espiral de 1,5 volta saindo do "C" inicial; (D) só a palavra, com o pingo rosa no lugar de um ponto; (E) "C" e "O" como duas meias-luas que se fecham (ciclo); (F) relógio de 4 marcas no lugar do "O".

## Prompt para pedir ao Claude (cole como está)

> Desenhe a logo do CICLO, um app grátis de agenda para profissionais de beleza (unha, cílios, sobrancelha, cabelo, estética) e suas clientes, que lembra e traz a cliente de volta na hora certa.
>
> **Requisitos:** só a palavra "CICLO"; base azul (azul-noite #1E2A5A e azul #3B5BDB) com um toque de rosa (#F06595) só num detalhe; transmitir beleza sem ficar feminina demais (salão misto e cabeleireiro também usam); o "O" final é um anel quase fechado, como um indicador de carregamento, com a ponta rosa, e pode ter dois ponteiros finos de relógio dentro; o "O" sozinho precisa funcionar como ícone de app em 48 px.
>
> **Entregue:** uma página HTML com 6 variações em SVG (anel com ponta rosa; anel com ponteiros; espiral saindo do "C"; só a palavra com pingo rosa; "C" e "O" como meias-luas; relógio de 4 marcas no "O"), cada uma mostrada grande, como ícone de 48 px e 192 px, em fundo claro e escuro, e numa tela de celular de 375 px com o cabeçalho do app. Inclua a animação do anel girando uma vez (0,8 s) na variação A. Use só formas vetoriais (sem imagem), letra de fonte do Google Fonts com o texto convertido em caminho no SVG final.
>
> Depois que eu escolher: refinar a escolhida em até 3 rodadas e exportar `logo.svg`, `logo-escura.svg`, `icone.svg`, `favicon.ico`, ícones PNG 192 e 512 (e maskable), `apple-touch-icon` 180 e a imagem de compartilhamento 1200×630.
