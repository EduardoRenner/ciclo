/**
 * Trazer a clientela para o "Já atendo" de uma vez, em vez de digitar nome por nome.
 *
 * `docs/82` §14, semana 2: "importar do caderno mais rápido". Na visita, o dono tem a clientela em
 * dois lugares — a lista de contatos do celular e alguma lista escrita (bloco de notas, conversa
 * do WhatsApp, caderno fotografado e transcrito). Digitar quinze nomes com o dono olhando é o
 * momento em que a conta morre antes de ver o Motor funcionar.
 *
 * Duas portas, a mesma saída (`PessoaDaLista`), com os mesmos tetos da rota
 * (`quem-ja-atendo.ts`: 200 pessoas, nome até 120) — a tela nunca monta algo que o servidor recusa.
 */
export type PessoaDaLista = { nome: string; telefone: string }

export const MAX_DA_LISTA = 200
const MAX_NOME = 120

/** Marcador de lista no começo da linha: "1.", "2)", "10 -", "-", "•", "*". */
const MARCADOR = /^\s*(?:\d{1,3}\s*[.)-]|[-•*·–])\s*/
/** Candidato a telefone: começa e termina em dígito, com espaço, parêntese, ponto ou traço no meio. */
const CANDIDATO_A_TELEFONE = /\+?\(?\d[\d\s().-]*\d/g
const SEPARADOR_NAS_PONTAS = /^[\s\-–—:,;|/]+|[\s\-–—:,;|/]+$/g

/**
 * Dígitos (e o `+` do DDI, se veio). 10 a 13 dígitos é telefone brasileiro com ou sem DDI e com
 * ou sem o nono dígito; menos que isso é "João 2" ou "rua 15", e continua sendo parte do nome.
 */
function telefoneDe(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, '')
  if (digitos.length < 10 || digitos.length > 13) return null
  return (bruto.trim().startsWith('+') ? '+' : '') + digitos
}

function chave(nome: string): string {
  return nome.toLocaleLowerCase('pt-BR')
}

function limparNome(nome: string): string {
  return nome.replace(SEPARADOR_NAS_PONTAS, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOME)
}

function semRepetidos(pessoas: PessoaDaLista[]): PessoaDaLista[] {
  const vistos = new Set<string>()
  const saida: PessoaDaLista[] = []
  for (const p of pessoas) {
    const k = chave(p.nome)
    if (!p.nome || vistos.has(k)) continue
    vistos.add(k)
    saida.push(p)
    if (saida.length === MAX_DA_LISTA) break
  }
  return saida
}

export function lerListaDeNomes(texto: string): PessoaDaLista[] {
  const pessoas = texto.split(/\r?\n/).map((linha) => {
    const semMarcador = linha.replace(MARCADOR, '')
    let telefone = ''
    let resto = semMarcador
    for (const m of semMarcador.matchAll(CANDIDATO_A_TELEFONE)) {
      const t = telefoneDe(m[0])
      if (t) {
        telefone = t
        resto = semMarcador.slice(0, m.index) + ' ' + semMarcador.slice(m.index + m[0].length)
        break
      }
    }
    return { nome: limparNome(resto), telefone }
  })
  return semRepetidos(pessoas)
}

/** O formato do Contact Picker API (`navigator.contacts.select(['name', 'tel'], { multiple: true })`). */
export type ContatoDoCelular = { name?: readonly string[]; tel?: readonly string[] }

export function pessoasDosContatos(contatos: readonly ContatoDoCelular[]): PessoaDaLista[] {
  return semRepetidos(
    contatos.map((c) => ({
      nome: limparNome(c.name?.[0] ?? ''),
      telefone: c.tel?.map(telefoneDe).find((t): t is string => t !== null) ?? '',
    })),
  )
}
