/**
 * Transforma os bytes de um arquivo de texto enviado pela pessoa em texto, sem corromper acento.
 *
 * BL-51 (2026-09-28, medido): o "CSV" que o Excel em português salva é Windows-1252, não UTF-8. A
 * rota lia com `File.text()`, que decodifica sempre como UTF-8, e "João Conceição" virava
 * "Jo�o Concei��o" — e era assim que ficava GRAVADO no nome da cliente.
 *
 * Tenta UTF-8 no modo estrito primeiro: um arquivo UTF-8 de verdade nunca falha, e um arquivo
 * Windows-1252 com acento quase sempre falha (os bytes de acento dele não formam sequência UTF-8
 * válida). Só então cai para Windows-1252. A ordem importa: começar pelo Windows-1252 "funcionaria"
 * para qualquer arquivo e estragaria os UTF-8 com acento.
 */
export function decodificarTexto(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/**
 * docs/83 P4 — o arquivo é uma planilha do Excel em formato binário, e não um CSV?
 *
 * Ler `.xlsx` de verdade exige abrir um zip e um XML enviados por qualquer pessoa, e as bibliotecas
 * avaliadas em 29/09 não passaram (DECISOES): `xlsx` no npm tem duas CVEs sem conserto lá, e a
 * alternativa leve depende de um fork de zip sem manutenção. Até decidir, o importador RECONHECE o
 * arquivo pelo começo dele e diz como salvar em CSV — em vez de lê-lo como texto e mostrar lixo.
 *
 * `.xlsx` (e `.ods`) é um zip: começa com `PK\x03\x04`. `.xls` antigo é OLE: `D0 CF 11 E0`.
 */
export function planilhaBinaria(bytes: ArrayBuffer | Uint8Array): 'xlsx' | 'xls' | null {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'xlsx'
  if (b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'xls'
  return null
}

export const COMO_SALVAR_EM_CSV =
  'Esse arquivo é uma planilha do Excel, e o importador lê CSV. No Excel: Arquivo, Salvar como, e escolha "CSV UTF-8". No Google Planilhas: Arquivo, Fazer download, "Valores separados por vírgula". Depois envie o arquivo novo.'
