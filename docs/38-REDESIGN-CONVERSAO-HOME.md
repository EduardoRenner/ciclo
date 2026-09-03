# 38 · REDESIGN DE CONVERSÃO DA HOME — PESQUISA E PLANO DE EXECUÇÃO

Pedido do Eduardo em 2026-09-03, nas palavras dele: *"tira esses preço do lado de entrar… que fica
mais idêntica a de outros grandes players, melhora isso, põe coisas que expliquem e faça a pessoa
querer ter o CICLO que nem estratégias de grandes players… melhora todas essa página, ela é a
responsável pela conversão, use técnicas de persuasão pixel, persuasão psicologia que nem grandes
players"*.

---

## 1 · O achado que reorganiza este documento

**O plano de copy da home já existe, é bom, e nunca foi implementado.**

`docs/20-COPY-PLANO.md` Fase D fez o trabalho inteiro em 2026-08-24: três variantes por peça, cada
uma com hipótese diferente (mecanismo / dor / resultado), teste do concorrente, checagem contra o
§5.10, e um painel de seis personas lendo antes de a recomendação fechar. A tabela consolidada
(§D.11) tem dez peças com recomendação.

Comparando com o que está no ar hoje:

| Peça | Recomendado no `docs/20` | Estado |
|---|---|---|
| Título da aba | D.1 var C | ✅ já é |
| H1 | D.2 C-zero | ✅ já é |
| CTA secundário | D.4 var A | ✅ já é |
| **Subtítulo** | D.3 var C, e o tricolon sai | ❌ **não implementado** |
| **Card 1** | D.5 var C (número com a origem) | ❌ **não implementado** |
| **"Feito para"** | D.6, as 17 do catálogo agrupadas | ❌ **não implementado** (tem 8, soltas) |
| **Fecho** | D.7 var C | ❌ **não implementado** |
| **`/precos` H1** | D.8 var A | ❌ **não implementado** |
| **`/precos` subtítulo** | D.8, único | ❌ parcial |
| **FAQ** | D.10, seis mudanças | ❌ **não implementado** |

**Seis das dez peças estão pendentes.** A conclusão prática: a maior parte do que o Eduardo está
pedindo já foi pesquisado, discutido com um painel e decidido por esta casa. Implementar a decisão
existente vale mais, e arrisca menos, que eu inventar uma sétima opinião — e é o que este documento
faz na §4.

O que a pesquisa nova (§2) acrescenta é **uma peça que o `docs/20` não tem**, e é justamente a que
responde "põe coisas que expliquem e faça a pessoa querer": **prova de produto na primeira dobra.**

---

## 2 · A pesquisa, e o único padrão que muda a estrutura da página

Consultado em 2026-09-03 (§2.1 do `docs/17`: pesquisa é com ferramenta, não de memória).

### 2.1 · O padrão mais repetido, e a home não o tem

> Quase toda página de SaaS de alta conversão **mostra o produto (ou o resultado dele) dentro do
> primeiro scroll** — um print real do painel converte melhor que ilustração ou 3D, porque a pessoa
> quer ver o que vai assinar antes de ler lista de recurso.

A home do CICLO **descreve** o Motor de Ciclo em prosa e **nunca o mostra**. É o maior buraco de
conversão da página, e é o buraco de que o Eduardo reclamou sem usar essas palavras.

E aqui está a parte que importa para esta casa: **prova de PRODUTO não é prova SOCIAL.** O
`docs/20` §D.4.1 já cravou a distinção, e ela é o que autoriza esta peça:

> *"Demonstração mostra o que o software faz; prova social afirma que outra pessoa comprou. O CICLO
> pode fazer a primeira hoje e não pode fazer a segunda."*

Mostrar a lista de quem sumiu, com nomes de exemplo declarados como exemplo, é demonstração. Não
toca no §5.10.

### 2.2 · A estrutura que se repete nas páginas que convertem

Hero com proposta de valor em uma frase → **prova de produto acima da dobra** → benefício por
resultado (não por recurso) → fluxo visível de 3 a 5 passos → prova social com contexto → CTA de
alto contraste.

O CICLO tem 1, 3 (parcialmente) e 4. Falta o 2. O 5 está **proibido** até haver cliente real
(§5.10), e essa proibição fica.

### 2.3 · Persuasão no nível do pixel

O pedido de "persuasão pixel" tem tradução técnica direta, e ela é medível:

| Mecanismo | Como se aplica aqui |
|---|---|
| Contraste do CTA | o CTA primário é o único elemento com a cor de acento cheia na dobra |
| Direção do olhar | número grande à esquerda, ação à direita: o olho lê o argumento antes do botão |
| Peso tipográfico | o dado ganha `font-bold` e `tabular`; o rótulo fica em `text-txt-3` |
| Ancoragem | o preço aparece depois do valor entregue, nunca antes |
| Redução de atrito percebido | "sem cartão" fica ao lado do CTA, não no rodapé |

### 2.4 · O que a pesquisa recomenda e este documento RECUSA

- **"Logos de clientes reconhecíveis nos dois primeiros scrolls."** Não há clientes. §5.10.
- **"Depoimento nomeado."** Idem.
- **"Motion / demo em vídeo converte mais que print estático."** Verdade medida, e fica registrada
  como alvo — mas vídeo de produto é trabalho de produção que não cabe nesta rodada, e um GIF pesado
  na primeira dobra de um público 100% celular custa mais em latência do que rende em conversão
  (ver `docs/28-LATENCIA-DE-CLIQUE-PLANO.md`). Print estático em HTML/CSS, sem imagem, é o meio
  honesto e barato.
- **"Formulário de um campo só."** O cadastro precisa de quatro (nome, e-mail, telefone, senha) e
  o telefone é o que faz o produto funcionar. Não reduzo campo para melhorar métrica de topo.

---

## 3 · O que muda no header, e por quê

Pedido explícito: tirar "Preços" do lado de "Entrar".

**Concordo, e o motivo é de conversão, não de gosto.** O header da home tinha dois links
competindo com o CTA primário, e um deles ("Preços") aponta para uma página que a própria home já
resume na dobra, com o número na tela. Todo link no header é uma saída — e na única página cujo
trabalho é converter, saída é vazamento.

`/precos` **continua** alcançável na dobra ("Ver os planos"), no fecho e no rodapé. A informação
não sai; o vazamento sai.

**Nas outras telas públicas o header FICA como está.** Em `/termos` e `/privacidade` a pessoa está
lendo contrato, não decidindo compra, e ali o link de preço é serviço (L-7 do `docs/31` colocou os
dois de propósito). Tirar de lá seria aplicar a regra fora do contexto que a justifica.

---

## 4 · O plano de execução, um commit por peça

Cada item verificado no navegador a 375 px, com medição, antes do commit. `pnpm typecheck` +
`npx eslint .` + `pnpm test:unit` limpos em cada um.

| # | Peça | Fonte da decisão |
|---|---|---|
| 1 | Header sem "Preços" na home | §3 deste documento |
| 2 | **Prova de produto na primeira dobra** | §2.1, peça nova |
| 3 | Subtítulo → D.3 var C; tricolon migra para a FAQ | `docs/20` §D.3 |
| 4 | Card 1 → D.5 var C (número com a origem) | `docs/20` §D.5 |
| 5 | "Feito para" → as 17 agrupadas, beleza primeiro | `docs/20` §D.6 |
| 6 | Fecho → D.7 var C ("Comece de graça, e sem cartão") | `docs/20` §D.7 |
| 7 | FAQ → as seis mudanças da D.10 | `docs/20` §D.10 |
| 8 | `/precos` H1 e subtítulo → D.8 var A | `docs/20` §D.8 |

**O que continua bloqueado, e não entra:** a headline com cadência ("Toda semana, a lista de…"),
porque `reminders` continua fora do `schedule` e a guarda `home-nao-promete-demais` reprova — e
está certa. O H1 fica na forma C-zero até o P-0.
