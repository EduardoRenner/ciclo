# 109 · Marca feminina: plano (20/10/2026)

Base: `00-pesquisa.md`. Branch `marca/feminina-2026-10-20`, em cima do `produto/foco-beleza-2026-10-16` (PR #154), que é a ponta da pilha. Nada vai para a `main` sem o Vitor revisar.

**A régua: um pouco mais feminino, não rosa de menina.** O feminino vem do tom (rosé apagado e ameixa), de uma serifa macia nos títulos públicos e do assunto da copy. O painel continua ferramenta: mesma fonte de números, mesma regra de "cor é exceção" (`docs/08` §3.5), mesmos semânticos.

## O que fica igual (de propósito)

- Fundo preto quente e superfícies (`docs/08` §3.4).
- Semânticos `--ok`, `--warn`, `--risk`, `--bad`, `--info` e as réguas de daltonismo.
- A Archivo no painel e nos números.
- O formato do símbolo (o anel com a seta). Muda a cor, não o desenho.
- A cor da página pública de cada negócio, que é escolha da dona (`tenants.settings.site.accent`).
- A pessoa que usa o CICLO tratada sem gênero (`copy-nao-supoe-genero`).

## Fases

### F1 · Cor (tokens e marca)

| Onde | De | Para |
| --- | --- | --- |
| `--acc` escuro | `#14b8a6` turquesa | `#d4949f` rosé antigo |
| `--acc-2` escuro | `#99f6e4` | `#f9dfe3` blush |
| `--acc-soft` escuro | turquesa a 14% | rosé a 14% |
| `--acc` claro | `#0b7d6f` | `#8c4766` ameixa |
| `--acc-2` claro | `#0a6a5e` | `#7f3f5e` |
| `--acc-soft` claro | turquesa a 12% | ameixa a 12% |
| Símbolo cravado (`icon.svg`, `IconeAnel`, imagem de compartilhamento, `global-error`) | turquesa | rosé |

**Pronto quando:** `contraste.test.ts` passa sem baixar nenhum piso, a guarda da imagem de compartilhamento casa com a cor nova e não sobra `#14b8a6` fora de histórico.

### F2 · Tipografia dos títulos públicos

- Entra **Fraunces** (`next/font/google`, auto-hospedada, CSP igual) como `--font-display`, só em `h1`/`h2` das páginas públicas: home, preços, calculadora, cadastro e entrar.
- O painel (`/admin`) **não** muda de fonte.

**Pronto quando:** o título da home renderiza em Fraunces (medido no navegador) e o painel continua em Archivo.

### F3 · Copy pública com o foco feminino

- **Home:** título e subtítulo falam de **manutenção** e de **quem passou do dia**, com R$ e WhatsApp; "Feito para" começa por unhas, cílios e sobrancelha; barbearia e os ofícios de casa saem da vitrine (o produto continua aceitando todas as profissões no cadastro).
- **Título e descrição da página** (`metadata`, `llms.txt`, imagem de compartilhamento): o mesmo foco.
- **Cadastro e primeiros passos:** a lista de profissões abre por unhas, cílios e sobrancelha.
- Não usar "clientes que voltam" como título (é o do Gendo).

**Pronto quando:** as guardas de copy passam (`home-nao-promete-demais`, `copy-sem-travessao`, `copy-publica-sem-gratis-eterno`, `copy-nao-supoe-genero`, `motor-de-ciclo-nao-e-ia`), e a home lida a 375 px não tem overflow.

### F4 · Ícones do app e arquivos de marca

- Regerar `public/icons/*.png` e `public/marca/*.png` a partir do SVG em rosé (com `sharp`, que já é dependência), e trocar o `theme_color` do manifest se ele for turquesa.
- Ícones de Android e iOS: só se estiverem no repositório. Se a loja já recebeu um ícone, trocar lá é passo do Vitor.

**Pronto quando:** nenhum arquivo de marca turquesa sobra em `public/`.

### F5 · Lado da cliente (só plano, sem código agora)

O `docs/108-norte` congelou funcionalidade nova até 15/12, e o relatório da beleza (§6) disse **sim à vitrine, não ao segundo app agora**. Proposta para depois do piloto: a página de cada profissional vira o "cartão da cliente", com a próxima manutenção e a remarcação num toque, no navegador e sem conta. É o "app da cliente que vem junto com cada profissional", sem pedir download. Fica registrada aqui e não entra nesta branch.

## Verificação (antes de cada commit)

1. `pnpm typecheck`, `npx eslint .` e `pnpm test:unit` inteiros, verdes.
2. Guarda nova ou alterada vista **reprovando** com a cor ou a frase antiga (CLAUDE.md, "teste-guarda").
3. No navegador, home e painel a 375 px e no desktop, temas claro e escuro, com captura em `docs/109-marca-feminina/capturas/`.
4. `test:rls` e `test:integration` não se aplicam (nenhuma mudança de banco ou rota).

## Fora do escopo

Mudar nome (CICLO fica), mudar preço, mudar o painel além da cor, foto de banco de imagem (a GlossGenius usa foto de gente; o CICLO não tem fotos próprias, e foto de banco de imagem é marca de IA, `docs/08` §II.1).
