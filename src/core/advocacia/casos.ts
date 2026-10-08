/**
 * Estados do caso e a regra do sigilo (docs/101 anexo 01 §2.5). Pura.
 *
 * Origem do desenho: LUBI `0013_casos.sql` (estados, `client_title` obrigatório, criminal/júri nascem
 * sigilosos, rebaixar sigilo só a direção e com motivo). No LUBI a regra mora em gatilho SQL; aqui ela
 * existe em TypeScript para a TELA saber antes (botão que não aparece, motivo pedido no diálogo) e o
 * banco continua sendo a rede embaixo (o gatilho da migration repete a regra).
 */

export const ESTADOS_DO_CASO = ['aberto', 'em_andamento', 'aguardando_cliente', 'aguardando_terceiros', 'concluido', 'arquivado'] as const
export type EstadoDoCaso = (typeof ESTADOS_DO_CASO)[number]

export type Sigilo = 'normal' | 'sigiloso'

/** Áreas que nascem sigilosas e não podem ser rebaixadas por ninguém (LUBI `0013`). */
export const AREAS_SEMPRE_SIGILOSAS = ['criminal', 'tribunal_juri'] as const

const VAI_PARA: Readonly<Record<EstadoDoCaso, readonly EstadoDoCaso[]>> = {
  aberto: ['em_andamento', 'aguardando_cliente', 'aguardando_terceiros', 'concluido'],
  em_andamento: ['aguardando_cliente', 'aguardando_terceiros', 'concluido'],
  aguardando_cliente: ['em_andamento', 'aguardando_terceiros', 'concluido'],
  aguardando_terceiros: ['em_andamento', 'aguardando_cliente', 'concluido'],
  // reabrir é permitido; arquivado é o fim da linha na tela (desarquivar é ação da direção, P2)
  concluido: ['em_andamento', 'arquivado'],
  arquivado: [],
}

export function podeMudarEstado(de: EstadoDoCaso, para: EstadoDoCaso): boolean {
  return VAI_PARA[de].includes(para)
}

/** Sigilo com que o caso NASCE: área criminal e júri forçam sigiloso; o resto é escolha. */
export function sigiloInicial(area: string, escolhido: Sigilo): Sigilo {
  return (AREAS_SEMPRE_SIGILOSAS as readonly string[]).includes(area) ? 'sigiloso' : escolhido
}

export type PapelNoEscritorio = 'owner' | 'manager' | 'professional' | 'reception' | 'finance'

export type DecisaoDeSigilo = { ok: true } | { ok: false; motivo: string }

/**
 * Mudar o sigilo de um caso. Subir para sigiloso: qualquer papel que edita o caso. Descer para
 * normal: só a direção (`owner`), com motivo, e nunca nas áreas que nascem sigilosas.
 */
export function decidirMudancaDeSigilo(
  caso: { area: string; sigilo: Sigilo },
  para: Sigilo,
  papel: PapelNoEscritorio,
  motivo: string | null,
): DecisaoDeSigilo {
  if (caso.sigilo === para) return { ok: true }
  if (para === 'sigiloso') return papel === 'finance' ? { ok: false, motivo: 'Este papel não edita casos.' } : { ok: true }
  if ((AREAS_SEMPRE_SIGILOSAS as readonly string[]).includes(caso.area)) {
    return { ok: false, motivo: 'Casos desta área são sempre sigilosos.' }
  }
  if (papel !== 'owner') return { ok: false, motivo: 'Só a direção tira o sigilo de um caso.' }
  if ((motivo ?? '').trim().length < 5) return { ok: false, motivo: 'Escreva o motivo (pelo menos 5 letras): ele fica no histórico.' }
  return { ok: true }
}

/**
 * Quem enxerga o caso (o mesmo critério de `legal_can_access_case` na migration): direção sempre;
 * caso normal, qualquer membro ativo do escritório; caso sigiloso, só quem é da equipe do caso.
 */
export function enxergaOCaso(caso: { sigilo: Sigilo; equipe: readonly string[] }, pessoa: { id: string; papel: PapelNoEscritorio }): boolean {
  if (pessoa.papel === 'owner' || pessoa.papel === 'manager') return true
  if (caso.sigilo === 'normal') return true
  return caso.equipe.includes(pessoa.id)
}
