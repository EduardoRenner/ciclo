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
import { gradesDeDocx, gradesDeHtml, gradesDeOdf } from '@/core/ingestao/documento'
import { abrirZip, DENTRO_DO_ZIP, nomesDasAbasOdf, xmlDoDocumento } from '@/lib/ingestao/compactado'
import { abasDeXlsx } from '@/lib/ingestao/planilha'
import { gradeDePalavras } from '@/core/ingestao/pdf-tabela'
import { gradeDeConversa, pareceConversaDoWhatsApp } from '@/core/ingestao/whatsapp'

export type Aba = { nome: string; grade: string[][] }

export type Lido =
  | { ok: true; formato: Formato; abas: Aba[]; avisos: string[]; lidoDeImagem?: boolean }
  | { ok: false; mensagem: string }

/** O que dizer para o formato reconhecido que ainda não tem leitor (some à medida que os tickets entram). */
const AINDA_NAO: Partial<Record<Formato, string>> = {
  xls: 'Planilha do Excel antigo (.xls): abra no Excel e salve como .xlsx ou "CSV UTF-8", e envie de novo.',
  numbers: 'Planilha do Numbers: exporte como CSV (Arquivo, Exportar para, CSV) e envie de novo.',
  doc: 'Documento do Word antigo: salve como PDF ou copie a tabela e cole aqui.',
  rtf: 'Documento RTF: salve como .docx ou PDF e envie de novo.',
}

const SEM_TABELA = 'Não achei uma tabela neste documento. Se a lista está em texto corrido, copie e cole aqui.'
const GRANDE_DEMAIS = 'O arquivo compactado é grande demais para abrir com segurança. Envie só a planilha ou o CSV que está dentro.'
const CORROMPIDO = 'O arquivo está corrompido ou incompleto. Abra no seu computador, salve de novo e envie.'
const falhaDoZip = (f: 'grande' | 'corrompido'): Lido => ({ ok: false, mensagem: f === 'grande' ? GRANDE_DEMAIS : CORROMPIDO })

const abasDe = (nome: string, grades: string[][][], nomes: string[] = []): Aba[] => grades.map((grade, i) => ({ nome: nomes[i] || (grades.length > 1 ? `${nome} (tabela ${i + 1})` : nome), grade }))

/** Print, foto e página escaneada: o mesmo OCR, e tudo que sai dele vai para conferir. */
async function lerImagens(nome: string, imagens: Uint8Array[], semTexto: string): Promise<Lido> {
  const { palavrasDasImagens } = await import('@/lib/ingestao/ocr')
  const { palavras, invertida, confiancaMedia } = await palavrasDasImagens(imagens)
  if (palavras.length === 0) return { ok: false, mensagem: semTexto }
  const avisos = ['Lido de imagem: confira cada linha antes de importar, principalmente os telefones.']
  if (invertida) avisos.push('O print estava no modo escuro: inverti as cores para ler.')
  if (confiancaMedia < 0.75) avisos.push('A imagem está difícil de ler (borrada, torta ou pequena). Confira com mais atenção ou envie um print mais nítido.')
  return { ok: true, formato: 'imagem', abas: [{ nome, grade: gradeDePalavras(palavras) }], avisos, lidoDeImagem: true }
}

export async function lerParaGrades(bytes: Uint8Array, nome: string, profundidade = 0): Promise<Lido> {
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
    case 'xlsx': {
      const abas = abasDeXlsx(bytes)
      if (typeof abas === 'string') return falhaDoZip(abas)
      return abas.length ? { ok: true, formato: 'xlsx', abas, avisos: [] } : { ok: false, mensagem: 'A planilha está vazia.' }
    }
    case 'pdf': {
      const { palavrasDoPdf, paginasComoImagem, LIMITE_DE_PAGINAS, LIMITE_DE_PAGINAS_ESCANEADAS } = await import('@/lib/ingestao/pdf')
      const { palavras, paginas, lidas } = await palavrasDoPdf(bytes)
      if (palavras.length > 0) {
        const avisos = paginas > lidas ? [`O PDF tem ${paginas} páginas; li as primeiras ${LIMITE_DE_PAGINAS}. Separe em partes para o resto.`] : []
        return { ok: true, formato: 'pdf', abas: [{ nome, grade: gradeDePalavras(palavras) }], avisos }
      }
      // Sem texto: é escaneado. Cada página vira imagem e passa pelo mesmo OCR do print (CNV-018b).
      const { imagens } = await paginasComoImagem(bytes)
      const lido = await lerImagens(nome, imagens, 'Este PDF é uma imagem escaneada e não consegui ler o texto. Envie a planilha original, ou cole a lista.')
      if (lido.ok && paginas > LIMITE_DE_PAGINAS_ESCANEADAS) lido.avisos.push(`O PDF escaneado tem ${paginas} páginas; li as primeiras ${LIMITE_DE_PAGINAS_ESCANEADAS}. Separe em partes para o resto.`)
      return lido.ok ? { ...lido, formato: 'pdf' } : lido
    }
    case 'imagem': {
      if (f.detalhe === 'heic' || f.detalhe === 'avif') {
        // O leitor de texto não abre HEIC (foto do iPhone): o próprio aparelho converte ao compartilhar.
        return { ok: false, mensagem: 'Foto no formato do iPhone (HEIC). Tire um print da foto ou compartilhe como JPEG e envie de novo.' }
      }
      return lerImagens(nome, [bytes], 'Não consegui ler texto nesta imagem. Tente um print mais nítido, sem cortar, ou cole a lista.')
    }
    case 'html': {
      const grades = gradesDeHtml(decodificar(bytes).texto)
      return grades.length ? { ok: true, formato: 'html', abas: abasDe(nome, grades), avisos: [] } : { ok: false, mensagem: SEM_TABELA }
    }
    case 'docx': {
      const doc = xmlDoDocumento(bytes, 'word/document.xml')
      if (typeof doc === 'string') return falhaDoZip(doc)
      const grades = gradesDeDocx(doc.xml).filter((g) => g.length > 0)
      return grades.length ? { ok: true, formato: 'docx', abas: abasDe(nome, grades), avisos: [] } : { ok: false, mensagem: SEM_TABELA }
    }
    case 'odt':
    case 'ods': {
      const doc = xmlDoDocumento(bytes, 'content.xml')
      if (typeof doc === 'string') return falhaDoZip(doc)
      const grades = gradesDeOdf(doc.xml)
      const nomes = f.formato === 'ods' ? nomesDasAbasOdf(doc.xml) : []
      const abas = abasDe(nome, grades, nomes).filter((a) => a.grade.length > 0)
      return abas.length ? { ok: true, formato: f.formato, abas, avisos: [] } : { ok: false, mensagem: SEM_TABELA }
    }
    case 'zip': {
      // Um nível só: zip dentro de zip não é aberto (bomba em camadas).
      if (profundidade > 0) return { ok: false, mensagem: 'Há um arquivo compactado dentro de outro. Abra e envie a planilha que está dentro.' }
      const entradas = abrirZip(bytes, (n) => DENTRO_DO_ZIP.test(n) && !n.startsWith('__MACOSX/'))
      if (typeof entradas === 'string') return falhaDoZip(entradas)
      const abas: Aba[] = []
      const avisos: string[] = []
      for (const e of entradas) {
        const lido = await lerParaGrades(e.bytes, e.nome, profundidade + 1)
        if (lido.ok) {
          abas.push(...lido.abas.map((a) => ({ ...a, nome: e.nome })))
          avisos.push(...lido.avisos)
        }
      }
      return abas.length ? { ok: true, formato: 'zip', abas, avisos } : { ok: false, mensagem: 'Não achei planilha, CSV, contatos ou conversa dentro do arquivo compactado.' }
    }
    default:
      return { ok: false, mensagem: AINDA_NAO[f.formato] ?? 'Ainda não lemos este tipo de arquivo.' }
  }
}
