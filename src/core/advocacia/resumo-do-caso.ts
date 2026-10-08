import type { EstadoDoCaso } from './casos'

export type { EstadoDoCaso }

/**
 * O "Próximo passo" de um caso (docs/101 anexo 04 §4.3/§4.4): a uma linha que responde "o que vem
 * agora, de quem, até quando". Pura. A lista de Casos e a ficha mostram a MESMA frase porque saem
 * daqui.
 *
 * Ordem: prazo antes de pendência no mesmo dia (prazo perdido não tem volta; documento atrasado tem),
 * e o dia que conta do prazo é o INTERNO quando existe ("fazer até"), porque é nele que a equipe age.
 */

export const ROTULO_DO_ESTADO_DO_CASO: Readonly<Record<EstadoDoCaso, string>> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando_cliente: 'Aguardando cliente',
  aguardando_terceiros: 'Aguardando terceiros',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
}

/**
 * O tom do selo de cada estado. O tom `info` fica de fora de propósito: o ícone dele é um cadeado
 * (`components/ui/badge.tsx`), e cadeado nesta tela quer dizer SIGILO. Visto na lista de casos.
 */
export function seloDoEstado(e: EstadoDoCaso): 'ok' | 'warn' | 'ciclo' {
  if (e === 'aguardando_cliente' || e === 'aguardando_terceiros') return 'warn'
  if (e === 'concluido') return 'ok'
  return 'ciclo'
}

export const CASO_ENCERRADO: readonly EstadoDoCaso[] = ['concluido', 'arquivado']

export type PrazoDoResumo = {
  titulo: string
  tipo: 'fatal' | 'interno' | 'audiencia' | 'contratual'
  venceEm: string
  internoEm: string | null
  aberto: boolean
}

export type PendenciaDoResumo = {
  titulo: string
  quemDeve: 'cliente' | 'equipe'
  venceEm: string | null
  esperando: boolean
}

export type ProximoPasso = {
  texto: string
  de: 'cliente' | 'escritorio'
  /** O dia em que a ação precisa acontecer (o interno, no prazo que tem). */
  ate: string | null
  atrasado: boolean
  fatal: boolean
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function proximoPasso(prazos: readonly PrazoDoResumo[], pendencias: readonly PendenciaDoResumo[], hoje: string): ProximoPasso | null {
  type Candidato = ProximoPasso & { chave: string; peso: number }
  const candidatos: Candidato[] = []

  for (const p of prazos) {
    if (!p.aberto) continue
    const dia = p.internoEm ?? p.venceEm
    const fatal = p.tipo === 'fatal'
    candidatos.push({
      texto: fatal && p.internoEm ? `${p.titulo}: fazer até ${dataCurta(p.internoEm)} · fatal ${dataCurta(p.venceEm)}` : `${p.titulo} até ${dataCurta(dia)}`,
      de: 'escritorio',
      ate: dia,
      atrasado: dia < hoje,
      fatal,
      chave: dia,
      peso: 0,
    })
  }
  for (const i of pendencias) {
    if (!i.esperando) continue
    candidatos.push({
      texto: i.venceEm ? `${i.titulo} até ${dataCurta(i.venceEm)}` : i.titulo,
      de: i.quemDeve === 'cliente' ? 'cliente' : 'escritorio',
      ate: i.venceEm,
      atrasado: i.venceEm !== null && i.venceEm < hoje,
      fatal: false,
      // pendência sem data vai para o fim: ela não aperta antes de nada que tem dia
      chave: i.venceEm ?? '9999-12-31',
      peso: 1,
    })
  }

  candidatos.sort((a, b) => a.chave.localeCompare(b.chave) || a.peso - b.peso)
  const escolhido = candidatos[0]
  if (!escolhido) return null
  return { texto: escolhido.texto, de: escolhido.de, ate: escolhido.ate, atrasado: escolhido.atrasado, fatal: escolhido.fatal }
}
