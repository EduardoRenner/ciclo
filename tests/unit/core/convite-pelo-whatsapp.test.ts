import { describe, expect, it } from 'vitest'

import { linkDoConvitePeloWhatsApp } from '@/core/convites/link-pelo-whatsapp'
import { EsquemaConvite } from '@/server/services/convites'

/** docs/112 EXP-K01: convite da equipe pelo WhatsApp, sem trava de e-mail. */
describe('convite pelo WhatsApp', () => {
  it('abre a conversa com o número e o link do convite no texto', () => {
    const link = linkDoConvitePeloWhatsApp('+5511912345678', 'https://seuciclo.com.br/convite/abc')
    expect(link.startsWith('https://wa.me/5511912345678?text=')).toBe(true)
    const texto = decodeURIComponent(link.split('?text=')[1]!)
    expect(texto).toContain('https://seuciclo.com.br/convite/abc')
    expect(texto, 'tem que dizer para entrar com este número').toMatch(/este número/)
  })

  it('o convite aceita só o WhatsApp, só o e-mail, ou os dois; nenhum dos dois, não', () => {
    expect(EsquemaConvite.safeParse({ telefone: '(11) 91234-5678', role: 'professional' }).success).toBe(true)
    expect(EsquemaConvite.safeParse({ email: 'a@ciclo.test', role: 'professional' }).success).toBe(true)
    expect(EsquemaConvite.safeParse({ role: 'professional' }).success).toBe(false)
  })

  it('o telefone do convite sai em E.164, o mesmo formato que o aceite compara', () => {
    const r = EsquemaConvite.safeParse({ telefone: '(11) 91234-5678', role: 'professional' })
    expect(r.success && r.data.telefone).toBe('+5511912345678')
  })
})
