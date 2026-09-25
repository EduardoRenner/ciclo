import { linkComOrigem } from '@/core/aquisicao/origem'

/**
 * A bio do Instagram e a página `/links` que ela aponta (`docs/82` rodada 35).
 *
 * O desenho é um funil de três degraus, e cada um existe por um motivo medido no plano:
 *
 * 1. **Bio**: uma frase que diz o que o produto faz e um gancho para o link ("veja quanto você
 *    perde"). Quem chega pelo Instagram não sabe o que é o CICLO.
 * 2. **`/links`**: a "linktree" no domínio do produto, em vez de um serviço de terceiros. Assim a
 *    origem `instagram` é gravada pelo middleware (primeiro toque) e a página carrega a marca.
 * 3. **Calculadora primeiro**: é a ferramenta grátis que vale sozinha e termina na pergunta que só o
 *    produto responde (`docs/82` §8). Cadastro vem logo depois para quem já está convencido.
 *
 * Regras de voz: `public/marca/BRIEF-carrossel-diferencial.md` e
 * `docs/marketing/roteiro-lancamento-instagram.md` (sem travessão, nunca "para sempre", sem palavra de
 * vitrine de software, sem nome de concorrente, sem número sem origem). Guardadas por
 * `tests/unit/core/links-da-bio.test.ts`.
 */

/** Campo "Nome" do perfil no Instagram (limite de 30 caracteres): é o que a busca indexa. */
export const NOME_DO_PERFIL = 'CICLO | Retenção de clientes'

/**
 * O único link da bio. Absoluto porque o Instagram só aceita link absoluto, e com `?origem=instagram`
 * porque o middleware grava o primeiro toque a partir daqui. O domínio entra por parâmetro (`APP_URL`,
 * `lib/app-url.ts`): o produto tem um lugar só para escrever o próprio endereço.
 */
export function linkDaBio(appUrl: string): string {
  return linkComOrigem(`${appUrl.replace(/\/$/, '')}/links`, 'instagram')
}

/**
 * Três variantes de bio (limite de 150 caracteres do Instagram), da mais direta à mais curta. Todas
 * terminam apontando para o link, porque a bio existe para levar até ele.
 */
export const BIOS_DO_INSTAGRAM = [
  'Seu sistema de retenção de clientes. Mostra quem sumiu, pelo nome, e o texto pronto pra chamar de volta. Veja quanto você perde 👇',
  'Sistema de retenção de clientes pra quem vive de cliente que volta. Descubra quanto seu negócio deixou de faturar com quem sumiu 👇',
  'Retenção de clientes pra quem tem agenda. Faça a conta do que você deixou de faturar com quem parou de voltar 👇',
] as const

export type LinkDaBio = {
  chave: 'calculadora' | 'cadastro' | 'exemplo' | 'como-funciona' | 'precos'
  titulo: string
  descricao: string
  href: string
  /** O cartão grande do topo. Só um: o gancho. */
  destaque?: boolean
  /** Etiqueta curta sobre o título. Só no destaque: em mais de um cartão ela deixa de dizer por onde começar. */
  selo?: string
  /** O botão cheio: o objetivo da página (criar conta). Só um, senão nada se destaca. */
  principal?: boolean
}

/**
 * Os cartões da página. `slugDeDemonstracao` vem do banco (`slugDeDemonstracaoNoAr`): sem nenhuma
 * demonstração no ar o cartão de exemplo SOME, em vez de virar um link para 404 (mesma regra da home).
 */
export function linksDaBio({ slugDeDemonstracao }: { slugDeDemonstracao: string | null }): LinkDaBio[] {
  const links: LinkDaBio[] = [
    {
      chave: 'calculadora',
      titulo: 'Quanto você deixou de faturar?',
      descricao: 'Três números que você sabe de cabeça e a conta aparece. Sem cadastro.',
      href: linkComOrigem('/calculadora', 'instagram'),
      destaque: true,
      selo: 'Comece por aqui',
    },
    {
      chave: 'cadastro',
      titulo: 'Criar minha conta',
      descricao: 'É grátis pra começar, sem cartão. Traga quem você já atende e veja quem sumiu.',
      href: linkComOrigem('/cadastro', 'instagram'),
      principal: true,
    },
  ]

  if (slugDeDemonstracao) {
    links.push({
      chave: 'exemplo',
      titulo: 'Ver funcionando, sem cadastro',
      descricao: 'Abre um negócio de exemplo, do lado de quem atende.',
      href: linkComOrigem(`/${slugDeDemonstracao}/agendar?ver=dono`, 'instagram'),
    })
  }

  links.push(
    {
      chave: 'como-funciona',
      titulo: 'Como funciona',
      descricao: 'O que o CICLO calcula e como você começa.',
      href: linkComOrigem('/', 'instagram'),
    },
    {
      chave: 'precos',
      titulo: 'Quanto custa',
      descricao: 'Os planos, com o que cada um inclui.',
      href: linkComOrigem('/precos', 'instagram'),
    },
  )

  return links
}
