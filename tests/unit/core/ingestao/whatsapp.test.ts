import { describe, expect, it } from 'vitest'

import { gradeDeConversa, pareceConversaDoWhatsApp } from '@/core/ingestao/whatsapp'
import { processarArquivo } from '@/lib/ingestao/processar-arquivo'

/** CNV-015: conversa exportada do WhatsApp. Conversas inventadas, no formato de cada aparelho. */
const ANDROID = [
  '15/08/2026 09:12 - As mensagens e as chamadas são protegidas com a criptografia de ponta a ponta.',
  '15/08/2026 09:12 - Você criou o grupo "Clientes Salão"',
  '15/08/2026 09:15 - Maria Souza: Bom dia! Tem horário sábado?',
  'Pode ser de manhã, depois das 9',
  '15/08/2026 09:16 - ‎+55 11 98888-0002: eu também quero',
  '15/08/2026 09:20 - Conceição Ávila: <Mídia oculta>',
  '16/08/2026 10:01 - Maria Souza: obrigada!',
].join('\n')

const IOS = [
  '[15/08/2026, 09:15:03] Maria Souza: Bom dia!',
  '[15/08/2026, 09:16:44] ‎João Lima: ‎imagem ocultada',
  '[15/08/2026, 09:17:10] João Lima: até sábado',
].join('\r\n')

describe('conversa do WhatsApp → participantes (CNV-015)', () => {
  it('reconhece Android e iOS; CSV comum não', () => {
    expect(pareceConversaDoWhatsApp(ANDROID)).toBe(true)
    expect(pareceConversaDoWhatsApp(IOS)).toBe(true)
    expect(pareceConversaDoWhatsApp('Nome;Data\nMaria;15/08/2026\nJoão;16/08/2026')).toBe(false)
  })

  it('Android: cada autor uma vez; número sem nome fica na coluna de telefone; sistema e continuação não viram gente', () => {
    const c = gradeDeConversa(ANDROID)
    expect(c.grade).toEqual([
      ['Nome', 'Telefone'],
      ['Maria Souza', ''],
      ['', '+55 11 98888-0002'],
      ['Conceição Ávila', ''],
    ])
    expect(c.mensagens).toBe(4)
    expect(c.naoReconhecidas).toBe(2)
  })

  it('iOS: marcas invisíveis não sujam o nome', () => {
    expect(gradeDeConversa(IOS).grade.slice(1)).toEqual([
      ['Maria Souza', ''],
      ['João Lima', ''],
    ])
  })

  it('o .txt inteiro passa pela esteira: nomeados entram, o só-número fica para dar nome', async () => {
    const r = await processarArquivo({ bytes: new TextEncoder().encode(ANDROID), nome: 'Conversa do WhatsApp.txt', contexto: { hoje: '2026-10-13' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.resultado.registros.map((x) => x.nome)).toEqual(['Maria Souza', 'Conceição Ávila'])
    expect(r.resultado.quarentena.map((q) => q.motivo)).toEqual(['sem_nome'])
    expect(r.avisos.join(' ')).toMatch(/Conversa do WhatsApp: 4 mensagens, 3 pessoas/)
  })
})
