import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/86 J7. A página pública de agendamento é onde quem NÃO contratou o CICLO entrega nome e
 * telefone. Sem aviso de para onde o dado vai e sem caminho até a política, o cadastro de cliente
 * final acontece sem nenhuma informação ao titular (LGPD art. 9).
 *
 * Casa com a FRASE e com o LINK dentro do JSX do formulário (sem comentários, que explicam o porquê
 * e casariam com ela), e exige o `target="_blank"`: sem ele o link tira a pessoa da tela e leva
 * embora o que ela já digitou.
 */
const FONTE = semComentarios(readFileSync('src/app/(public)/[slug]/agendar/agendar.tsx', 'utf8'))

describe('a página pública de agendamento avisa para onde vai o dado', () => {
  it('diz que o dado vai para o negócio, que decide, e que o CICLO só guarda', () => {
    expect(FONTE).toMatch(/Seus dados vão para \{nomeDoSalao\}, que decide o que fazer com eles\. O CICLO só guarda para ele\./)
  })

  it('leva à política de privacidade, em outra aba, para não perder o que foi digitado', () => {
    const link = /<a\s+href="\/privacidade"[^>]*>/.exec(FONTE)
    expect(link, 'o link para /privacidade sumiu do formulário público').not.toBeNull()
    expect(link![0]).toMatch(/target="_blank"/)
    expect(link![0]).toMatch(/rel="noopener noreferrer"/)
  })

  it('o aviso mora DENTRO do mesmo cartão que pede nome e telefone, não em outra parte da página', () => {
    const pedeTelefone = FONTE.indexOf('rotulo="Seu telefone (WhatsApp)"')
    const aviso = FONTE.indexOf('Seus dados vão para')
    const fimDoCartao = FONTE.indexOf('</Card>', aviso)
    expect(pedeTelefone).toBeGreaterThan(-1)
    expect(aviso, 'o aviso vem antes do campo que pede o dado').toBeGreaterThan(pedeTelefone)
    expect(fimDoCartao, 'o aviso não está fechado no cartão do formulário').toBeGreaterThan(aviso)
  })

  it('sem travessão e sem gênero', () => {
    const frase = /Seus dados vão para[^<]*/.exec(FONTE)?.[0] ?? ''
    expect(frase.length).toBeGreaterThan(40)
    expect(frase).not.toMatch(/[—–]/)
  })
})
