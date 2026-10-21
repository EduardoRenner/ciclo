# 109 · Marca feminina: pesquisa (20/10/2026)

Pedido do Vitor em 20/10/2026: "mudar a copy e a identidade visual, um pouco mais feminino, mas nem tanto, e colocar o foco no público feminino". Pesquisa antes de implementar.

Rótulos: **FATO** (medido ou com fonte), **INFERÊNCIA** (conclusão minha, com a conta), **NÃO VERIFICADO**.

## 1. O que já estava decidido (não repetir)

- **O público já é feminino desde 16/10** (`docs/108-norte/00-decisao.md`, na branch `aprimoramento/plano-2026-10-13-docs`): cílios, sobrancelha e unhas; barbearia saiu do alvo.
- **O mercado já foi pesquisado** (`docs/concorrentes/beleza-feminina/`, 14 concorrentes, voz e canais). Daqui saem três fatos que mandam na copy:
  - a dor é "a agenda que não enche sozinha" (falta, cliente que some da manutenção, pouco tempo para o Instagram);
  - a objeção real não é preço, é "mais um lugar para olhar"; o CICLO começa e termina no WhatsApp dela;
  - 77% de quem trabalha na beleza são mulheres, 68% atendem em casa, 65% das mulheres só têm internet pelo celular.
- **A identidade de 19/08** (`docs/08` Parte II) foi feita **neutra de propósito**, porque o mesmo produto servia barbearia e manicure. O §3.1 descartou rosa por "estereótipo de gênero; território de Booksy/Avec". **Essa premissa caiu:** a barbearia saiu do alvo. O que continua valendo do `docs/08` é a regra de que a cor não pode brigar com os semânticos (verde, âmbar, laranja, vermelho) e o piso de contraste.

## 2. Como os concorrentes se vestem (FATO, medido no navegador em 20/10/2026)

Cor e fonte lidas do estilo computado da página, não do código nem de print de terceiro.

| Marca | Cor dominante | Fonte do título | Leitura |
| --- | --- | --- | --- |
| **Booksy** (biz.booksy.com/pt-br) | fundo azul-petróleo escuro, botão **turquesa** | Poppins | **O CICLO de hoje (turquesa sobre quase preto) é parecido com o Booksy**, que é o maior app de beleza do Brasil |
| **Fresha** (fresha.com/pt) | preto e branco, detalhe **roxo** `rgb(105,80,243)` | Roobert | software sério, sem gênero |
| **Gendo** (gendo.app) | **roxo** `rgb(126,69,241)` e lilás | Bricolage Grotesque + **uma palavra em serifa itálica** ("*voltam*") | título é **"Agenda cheia. Caixa em dia. Clientes que voltam."**, a mesma promessa do CICLO |
| **Agendiva** (agendiva.com.br) | **rosa-choque** `#FF02A8` em tudo | **Lora** (serifa) com itálico no número | o "feminino demais" do mercado |
| **Simples Agenda** | **azul** `rgb(21,112,239)` e verde | Plus Jakarta Sans | SaaS genérico |
| **GlossGenius** (EUA, referência do nicho) | neutro (branco, preto), detalhe verde-limão | Basel Classic | o feminino vem da **foto de gente**, não da cor |

**INFERÊNCIA, o mapa:** roxo (Gendo, Fresha), rosa-choque (Agendiva), turquesa (Booksy) e azul (Simples Agenda) estão ocupados. Ninguém está no **rosé apagado com ameixa**, o tom de esmalte nude e de estúdio de cílios. É feminino sem ser rosa de menina, e não se confunde com nenhum concorrente.

**INFERÊNCIA, a tipografia:** Gendo e Agendiva já usam serifa no título para parecer feminino. Ser o terceiro com uma palavra em itálico é copiar. O CICLO usa serifa no **título inteiro** das páginas públicas, com uma serifa macia (Fraunces) e não a Lora da Agendiva. O painel continua com a Archivo, que tem os números claros (`11:15`, `17:00`).

## 3. Tendência de cor (fraca, só direção)

Fontes de varejo e decoração dizem que o rosé com fundo cinza ("dusty rose", malva) virou **neutro adulto** em 2025–2026, e que o par com ameixa e pedra quente tira o ar doce ([Olive et Oriel](https://oliveetoriel.com/blogs/on-the-wall/dusty-rose-colour-palette-trend), [Composite Paint](https://compositepaint.com/palettes/rose-stone/), [AOL/designers](https://www.aol.com/articles/nostalgic-color-2026-most-surprising-163000419.html)). **FATO de que dizem; NÃO VERIFICADO como tendência medida.** Não decide nada sozinho, só confirma a direção do §2.

## 4. A cor, medida contra as réguas do CICLO (FATO, conta WCAG 2.1)

As guardas de `tests/unit/design/contraste.test.ts` valem para a cor nova também:

- `--acc-2` (link, aba ativa, foco) precisa de **Δ luminância ≥ 0,15** contra `--ok`, `--warn`, `--risk` e `--bad` no escuro. Os quatro ocupam L de 0,266 a 0,622, então só sobra **L ≤ 0,116** (escuro demais para texto em fundo preto) ou **L ≥ 0,772** (bem claro). Foi assim que o turquesa resolveu (`#99f6e4`), e é assim que o rosé resolve: o `--acc-2` é um **blush quase branco**.
- `--on-acc` precisa de 4,5:1 sobre `--acc` e `--acc-2`, nos dois temas.

| Token | Escuro | Medida | Claro | Medida |
| --- | --- | --- | --- | --- |
| `--acc` (botão, marca) | `#d4949f` rosé antigo | 7,94:1 sobre o fundo; texto `#0d0c0c` em cima 7,94:1 | `#8c4766` ameixa | texto branco em cima 6,55:1 |
| `--acc-2` (link, foco, aba) | `#f9dfe3` blush | 15,53:1; Δ ok 0,162, warn 0,314, risk 0,364, bad 0,518 | `#7f3f5e` ameixa funda | 7,14:1 sobre `#faf8f5`; branco em cima 7,57:1 |

Rosé mais forte (`#d98fa0`) e mais seco (`#c98a95`) também foram medidos. O primeiro puxa para o rosa de menina, o segundo fica a Δ0,061 do `--bad` e pode ser lido como erro.

## 5. Copy: o que muda e o que não muda

- **A pessoa que usa o CICLO continua tratada sem gênero** ("você", "que bom te ver"). A guarda `copy-nao-supoe-genero` fica como está: há homem fazendo unha e sobrancelha, e o produto segue aberto a quem chegar.
- **O feminino entra pelo assunto, não pela gramática:** os exemplos, as profissões na ordem certa (unhas, cílios, sobrancelha primeiro) e a palavra **manutenção** (que é como ela fala do retorno). **Corrigido na implementação:** a primeira versão punha "as clientes" na home, e a guarda `copy-nao-supoe-genero` reprovou (ela também proíbe supor que quem é ATENDIDO é mulher). A guarda ficou: a home diz "quanta gente sumiu da manutenção".
- **Não brigar com o Gendo na mesma frase.** "Clientes que voltam" já é o título deles. O CICLO fala do que só ele faz: **quem passou do dia da manutenção, quanto isso vale, e chamar pelo seu WhatsApp** (`docs/108-norte/00-decisao.md` §1).

## Fontes

- Medição própria no navegador, 20/10/2026: [Booksy Biz](https://biz.booksy.com/pt-br), [Fresha](https://www.fresha.com/pt/for-business), [Gendo](https://www.gendo.app), [Agendiva](https://agendiva.com.br), [Simples Agenda](https://www.simplesagenda.com.br), [GlossGenius](https://glossgenius.com), [CICLO em produção](https://seuciclo.com.br).
- GlossGenius sobre cor de destaque escolhida pelas clientes: [glossgenius.com/glow](https://glossgenius.com/glow).
- Tendência de cor: links no §3.
