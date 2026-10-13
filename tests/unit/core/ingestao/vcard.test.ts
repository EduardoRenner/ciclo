import { describe, expect, it } from 'vitest'

import { gradeDeVcard } from '@/core/ingestao/vcard'
import { processarArquivo } from '@/lib/ingestao/processar-arquivo'

/** CNV-014: contatos do celular. Contatos inventados, no formato de cada aparelho. */

// Android: vCard 2.1, nome com acento em quoted-printable (UTF-8) quebrado em duas linhas com "=".
const ANDROID = [
  'BEGIN:VCARD',
  'VERSION:2.1',
  'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Concei=C3=A7=C3=A3o;Maria;;;',
  'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Maria Concei=C3=A7=C3=A3o =',
  '=C3=81vila',
  'TEL;HOME:(11) 3333-0001',
  'TEL;CELL:(11) 99999-0001',
  'PHOTO;ENCODING=BASE64;JPEG:/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgK',
  ' DAoMCwsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ',
  'END:VCARD',
].join('\r\n')

// iPhone (iCloud): vCard 3.0, grupo "item1.", escapes e aniversário.
const IPHONE = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'N:Lima;João;;;',
  'FN:João Lima',
  'item1.TEL;type=CELL;type=VOICE;type=pref:+55 21 98888-7777',
  'EMAIL;type=INTERNET;type=HOME:joao@exemplo.com',
  'BDAY:1985-12-31',
  'NOTE:prefere sexta\\, depois das 18h\\nalergia: não',
  'CATEGORIES:VIP,Barba',
  'END:VCARD',
].join('\n')

// vCard 4.0: TEL como URI, sem FN (só N).
const V4 = ['BEGIN:VCARD', 'VERSION:4.0', 'N:Souza;Ana;Paula;;', 'TEL;VALUE=uri;TYPE=cell:tel:+5541977776666', 'BDAY:--0815', 'END:VCARD'].join('\r\n')

describe('vCard → grade (CNV-014)', () => {
  it('Android 2.1: quoted-printable com acento quebrado em duas linhas, celular antes do fixo, foto ignorada', () => {
    const [, linha] = gradeDeVcard(ANDROID)
    expect(linha).toEqual(['Maria Conceição Ávila', '(11) 99999-0001', '(11) 3333-0001', '', '', '', ''])
  })

  it('iPhone 3.0: grupo item1, escapes, aniversário e etiquetas', () => {
    const [, linha] = gradeDeVcard(IPHONE)
    expect(linha).toEqual(['João Lima', '+55 21 98888-7777', '', 'joao@exemplo.com', '1985-12-31', 'prefere sexta, depois das 18h\nalergia: não', 'VIP,Barba'])
  })

  it('vCard 4.0: nome pelo N, telefone tel:, aniversário sem ano não vira data inventada', () => {
    const [, linha] = gradeDeVcard(V4)
    expect(linha).toEqual(['Ana Paula Souza', '+5541977776666', '', '', '', '', ''])
  })

  it('linha dobrada (continuação começa com espaço) volta a ser uma só', () => {
    const dobrado = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Rita de Cássia Alves Pe', ' reira', 'TEL;TYPE=CELL:+55 11 9', ' 7777-1111', 'END:VCARD'].join('\r\n')
    expect(gradeDeVcard(dobrado)[1]!.slice(0, 2)).toEqual(['Rita de Cássia Alves Pereira', '+55 11 97777-1111'])
  })

  it('vários cartões no mesmo arquivo, e o arquivo inteiro passa pela esteira', async () => {
    const texto = [ANDROID, IPHONE, V4].join('\r\n')
    expect(gradeDeVcard(texto)).toHaveLength(4)
    const r = await processarArquivo({ bytes: new TextEncoder().encode(texto), nome: 'contatos.vcf', contexto: { hoje: '2026-10-13' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.formato).toBe('vcard')
    expect(r.resultado.registros.map((x) => [x.nome, x.telefone])).toEqual([
      ['Maria Conceição Ávila', '+5511999990001'],
      ['João Lima', '+5521988887777'],
      ['Ana Paula Souza', '+5541977776666'],
    ])
    expect(r.resultado.registros[0]!.telefonesExtras).toEqual(['+551133330001'])
    expect(r.resultado.registros[1]!.etiquetas).toEqual(['VIP', 'Barba'])
  })
})
