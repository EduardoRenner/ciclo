/**
 * Bytes de QUALQUER arquivo → grades (uma por aba ou por tabela), o ponto onde cada formato entra na
 * esteira (`docs/103-conversor/01-plano-e-tickets.md`, Onda C). Roda no Web Worker do navegador; é
 * também o que o servidor e os testes chamam, então a saída é a mesma nos dois lados (paridade).
 *
 * Os leitores que dependem de biblioteca (planilha, documento, PDF, OCR) carregam sob demanda, com
 * `import()`: quem só manda CSV não baixa nada a mais. Formato reconhecido e ainda sem leitor responde
 * com o motivo e o que fazer — nunca lixo na prévia.
 */
import { decodificar } from '@/core/ingestao/codificacao'
import { gradeDeTexto } from '@/core/ingestao/delimitado'
import { farejarFormato, type Formato } from '@/core/ingestao/formato'
import { gradeDeJson } from '@/core/ingestao/json'
import { gradeDeVcard } from '@/core/ingestao/vcard'
import { gradeDeConversa, pareceConversaDoWhatsApp } from '@/core/ingestao/whatsapp'

export type Aba = { nome: string; grade: string[][] }

export type Lido =
  | { ok: true; formato: Formato; abas: Aba[]; avisos: string[] }
  | { ok: false; mensagem: string }

/** O que dizer para o formato reconhecido que ainda não tem leitor (some à medida que os tickets entram). */
const AINDA_NAO: Partial<Record<Formato, string>> = {
  xlsx: 'Planilha do Excel: salve como CSV (Arquivo, Salvar como, "CSV UTF-8") e envie de novo.',
  xls: 'Planilha do Excel antigo: salve como CSV (Arquivo, Salvar como, "CSV UTF-8") e envie de novo.',
  ods: 'Planilha do LibreOffice: salve como CSV e envie de novo.',
  numbers: 'Planilha do Numbers: exporte como CSV (Arquivo, Exportar para, CSV) e envie de novo.',
  docx: 'Documento do Word: salve como PDF ou copie a tabela e cole aqui.',
  doc: 'Documento do Word antigo: salve como PDF ou copie a tabela e cole aqui.',
  odt: 'Documento do LibreOffice: salve como PDF ou copie a tabela e cole aqui.',
  rtf: 'Documento RTF: salve como .docx ou PDF e envie de novo.',
  pdf: 'PDF: copie a tabela e cole aqui, ou envie a planilha original.',
  imagem: 'Print ou foto: digite ou cole a lista aqui enquanto a leitura de imagem não chega.',
  html: 'Página da internet: copie a tabela e cole aqui.',
  zip: 'Arquivo compactado: abra e envie a planilha ou o CSV que está dentro.',
}

export async function lerParaGrades(bytes: Uint8Array, nome: string): Promise<Lido> {
  const f = farejarFormato(bytes, nome)
  if (!f.aceito) return { ok: false, mensagem: f.mensagem }

  switch (f.formato) {
    case 'texto': {
      const d = decodificar(bytes)
      const avisos = d.corrigidoDuploUtf8 ? ['Acentos estavam trocados ("JoÃ£o"): consertei.'] : []
      if (pareceConversaDoWhatsApp(d.texto)) {
        const c = gradeDeConversa(d.texto)
        avisos.push(`Conversa do WhatsApp: ${c.mensagens} mensagens, ${c.grade.length - 1} pessoas. Quem aparece só pelo número fica para você dar o nome.`)
        return { ok: true, formato: 'texto', abas: [{ nome, grade: c.grade }], avisos }
      }
      return { ok: true, formato: 'texto', abas: [{ nome, grade: gradeDeTexto(d.texto).grade }], avisos }
    }
    case 'json': {
      const j = gradeDeJson(decodificar(bytes).texto)
      if (!j.ok) return { ok: false, mensagem: j.motivo === 'json_invalido' ? 'O arquivo parece JSON, mas está quebrado. Exporte de novo.' : 'O JSON não tem uma lista de pessoas.' }
      return { ok: true, formato: 'json', abas: [{ nome, grade: j.grade }], avisos: [] }
    }
    case 'vcard': {
      const grade = gradeDeVcard(decodificar(bytes).texto)
      if (grade.length <= 1) return { ok: false, mensagem: 'O arquivo de contatos está vazio.' }
      return { ok: true, formato: 'vcard', abas: [{ nome, grade }], avisos: [] }
    }
    default:
      return { ok: false, mensagem: AINDA_NAO[f.formato] ?? 'Ainda não lemos este tipo de arquivo.' }
  }
}
