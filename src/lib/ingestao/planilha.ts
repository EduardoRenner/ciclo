/**
 * CNV-013 · `.xlsx` → abas. Abre só o que importa do zip (pelo filtro com teto de `compactado.ts`) e
 * entrega ao parser puro (`core/ingestao/xlsx.ts`).
 */
import { abasDoXlsx, estilosDeData, gradeDaAba, textosCompartilhados } from '@/core/ingestao/xlsx'
import { abrirZip } from '@/lib/ingestao/compactado'

import type { Aba } from '@/lib/ingestao/ler'

const QUER = (n: string) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml' || n === 'xl/styles.xml' || /^xl\/worksheets\/[^/]+\.xml$/.test(n)

/** `'grande'`/`'corrompido'` vêm do `abrirZip`; `[]` = sem aba legível. */
export function abasDeXlsx(bytes: Uint8Array): Aba[] | 'grande' | 'corrompido' {
  const entradas = abrirZip(bytes, QUER)
  if (typeof entradas === 'string') return entradas
  const decod = new TextDecoder('utf-8')
  const arquivo = new Map(entradas.map((e) => [e.nome, decod.decode(e.bytes)]))
  const { abas, data1904 } = abasDoXlsx(arquivo.get('xl/workbook.xml') ?? '', arquivo.get('xl/_rels/workbook.xml.rels') ?? '')
  const compartilhados = textosCompartilhados(arquivo.get('xl/sharedStrings.xml') ?? '')
  const datas = estilosDeData(arquivo.get('xl/styles.xml') ?? '')
  return abas
    .map((a) => ({ nome: a.nome, grade: gradeDaAba(arquivo.get(a.caminho) ?? '', compartilhados, datas, data1904) }))
    .filter((a) => a.grade.some((l) => l.some((c) => c.trim() !== '')))
}
