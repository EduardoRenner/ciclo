import { RESUMO_DA_VERSAO, VERSOES_LEGAIS, dataLegivel, type DocumentoLegal } from './versoes'

/**
 * O reaceite (docs/86 J8): quando a versão de um documento legal muda, a conta precisa aceitar a
 * nova, e até aceitar continua funcionando com o que valia antes (minuta dos Termos, item 5).
 *
 * "Uso continuado como aceite" é fraco para cláusula nova, e a v2 dos termos tem uma (os números
 * agrupados e sem nome). O comprovante é `terms_acceptances` (append-only, migration 0095); isto é só a
 * regra de quem falta aceitar o quê, sem I/O.
 */

export type LinhaDeAceite = { documento: string; versao: string }

const DOCUMENTOS = Object.keys(VERSOES_LEGAIS) as DocumentoLegal[]

/**
 * Os documentos cuja versão EM VIGOR a conta ainda não aceitou. Vale a maior versão já aceita de cada
 * documento (as datas ISO ordenam como texto): aceitar uma versão mais nova que a em vigor, o que só
 * acontece se alguém voltar a data para trás, não reabre a pendência.
 */
export function pendenciasDeAceite(
  linhas: readonly LinhaDeAceite[],
  atuais: Record<DocumentoLegal, string> = VERSOES_LEGAIS,
): DocumentoLegal[] {
  return DOCUMENTOS.filter((doc) => {
    const aceitas = linhas.filter((l) => l.documento === doc).map((l) => l.versao)
    const maisNova = aceitas.reduce<string | null>((m, v) => (m === null || v > m ? v : m), null)
    return maisNova === null || maisNova < atuais[doc]
  })
}

const NOME_DO_DOCUMENTO: Record<DocumentoLegal, string> = {
  termos: 'os Termos de uso',
  privacidade: 'a Política de privacidade',
}

/** A frase do aviso no Hoje. Sem urgência, sem ameaça: a conta continua funcionando. */
export function textoDoAvisoDeVersao(pendentes: readonly DocumentoLegal[]): string | null {
  if (pendentes.length === 0) return null
  const quais = pendentes.map((d) => NOME_DO_DOCUMENTO[d])
  const lista = quais.length === 1 ? quais[0]! : `${quais[0]} e ${quais[1]}`
  return `Atualizamos ${lista}. Leia e aceite quando puder: sua conta continua funcionando normalmente.`
}

export type LinhaDaTelaDeAceite = {
  documento: DocumentoLegal
  nome: string
  versao: string
  dataDaVersao: string
  /** O que mudou nesta versão, escrito por quem mudou o texto. */
  resumo: string
  pendente: boolean
}

/** O que a página de aceite mostra, uma linha por documento. */
export function linhasDaTelaDeAceite(pendentes: readonly DocumentoLegal[]): LinhaDaTelaDeAceite[] {
  return DOCUMENTOS.map((documento) => {
    const versao = VERSOES_LEGAIS[documento]
    return {
      documento,
      nome: documento === 'termos' ? 'Termos de uso' : 'Política de privacidade',
      versao,
      dataDaVersao: dataLegivel(versao),
      resumo: RESUMO_DA_VERSAO[documento][versao] ?? '',
      pendente: pendentes.includes(documento),
    }
  })
}
