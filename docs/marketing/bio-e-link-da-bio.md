# Bio do Instagram e link da bio

Perfil, bio, página de links e ganchos de post que levam até ela. Tudo aqui segue as regras de voz do
`public/marca/BRIEF-carrossel-diferencial.md` e do `roteiro-lancamento-instagram.md`: sem travessão,
nunca "para sempre", sem palavra de vitrine de software, sem nome de concorrente, sem número sem origem.
A bio, o nome do perfil e os textos da página estão guardados por teste
(`tests/unit/core/links-da-bio.test.ts`): se alguém mexer e quebrar uma regra, o build reprova.

> **Só funciona depois que o PR #126 for mergeado e estiver em produção.** A página `/links`, a
> calculadora e a gravação da origem `instagram` moram nessa branch. Hoje `seuciclo.com.br/links` e
> `seuciclo.com.br/calculadora` dão 404.

## O funil

```
Instagram (bio + posts + stories)
   └─ 1 link só: seuciclo.com.br/links?origem=instagram
        ├─ Quanto você deixou de faturar?   → /calculadora   (o gancho, sem cadastro)
        ├─ Criar minha conta                → /cadastro
        ├─ Ver funcionando, sem cadastro    → página de exemplo (só aparece se há uma no ar)
        ├─ Como funciona                    → home
        └─ Quanto custa                     → /precos
```

O gancho é a calculadora, porque é a única coisa que responde uma pergunta do dono antes de pedir
qualquer coisa dele. O cadastro vem logo abaixo para quem já chegou convencido.

## Perfil

| Campo | Valor |
|---|---|
| Nome (30 caracteres, é o que a busca indexa) | `CICLO | Retenção de clientes` |
| Usuário | `@seuciclo` (se estiver livre) |
| Categoria | Software / Serviços para negócios |
| Foto | `public/marca/ciclo-C-fundo-preto.png` (o "C" que faz a volta) |
| Link | `https://seuciclo.com.br/links?origem=instagram` (colar exatamente assim) |

## Bio (150 caracteres no máximo)

Recomendada, a primeira: diz o que faz e já entrega o gancho.

1. `Seu sistema de retenção de clientes. Mostra quem sumiu, pelo nome, e o texto pronto pra chamar de volta. Veja quanto você perde 👇`
2. `Sistema de retenção de clientes pra quem vive de cliente que volta. Descubra quanto seu negócio deixou de faturar com quem sumiu 👇`
3. `Retenção de clientes pra quem tem agenda. Faça a conta do que você deixou de faturar com quem parou de voltar 👇`

Regra para escolher: rode uma por duas semanas e compare o placar (abaixo). Trocar toda hora impede de
saber qual funcionou.

## Ganchos de post e story que levam ao link

Cada um termina apontando para a bio. Nenhum tem número inventado: a conta é dele, na calculadora.

- **"Quanto você deixou de faturar com cliente que parou de voltar? A conta está no link da bio."**
- **"Você sabe quantos clientes seus sumiram este mês? Faça a conta em um minuto. Link na bio."**
- **"Três números que você sabe de cabeça. É tudo que a calculadora pede. Link na bio."**
- **"Cliente que some não avisa. O CICLO mostra quem foi, pelo nome. Link na bio."**
- **"Marketing enche o balde. O CICLO tampa o furo. Link na bio."** (fecho dos carrosséis do brief)

**Story:** figurinha de link com o mesmo endereço da bio e o texto "Faz a conta". Vale mais que "link
na bio" porque tira um toque do caminho.

## Como medir se o Instagram traz conta que usa

O link carrega `?origem=instagram`. O middleware grava o primeiro toque num cookie de 60 dias, e a
origem chega ao evento de conta criada. Para ver o resultado:

```bash
node scripts/placar-distribuicao.mjs
```

O placar mostra, por canal, quantas contas foram criadas, quantas trouxeram a base e quantas viram o
Motor funcionar (`docs/runbooks/placar-de-distribuicao.md`). A pergunta que ele responde é a única que
importa: **o Instagram traz conta que usa, ou só visita?**

Se a calculadora tem visita e o cadastro não, o problema é o degrau entre elas. Se o cadastro tem conta
mas ninguém traz a base, o problema é o onboarding, não o Instagram.

## O que este documento não resolve

- **Foto e destaques:** o arquivo do "C" existe; os destaques (Como funciona, Conta, Dúvidas) dependem
  de você decidir o que mostrar neles.
- **Prova social:** não há depoimento de cliente real ainda, e a regra é não encenar. A bio não usa.
- **Quem atende as mensagens diretas:** o produto não tem canal de contato configurado em produção
  (`src/lib/contato.ts`). Se a bio gerar conversa, ela cai no Instagram, não no produto.
