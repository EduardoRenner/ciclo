import type { Perfil } from '@/core/crm/nota-do-cliente'

/**
 * `docs/95` E4 — a biblioteca de textos da chamada de volta (botão "Chamar" e fila de chamadas).
 *
 * Cada perfil de cliente tem DUAS versões: a de sempre (`padrao`) e uma escrita para aquele perfil.
 * Cada pessoa recebe sempre a mesma versão (sorteio fixo pelo id dela), então dá para comparar as
 * duas sem que a mesma cliente veja textos diferentes a cada chamada. A chave da versão vai junto
 * com a chamada (`messages.variant_key`, 0101) e é o que a medição usa (`docs/95` E5).
 *
 * Regras de texto: na voz do dono, sem supor gênero da cliente (`copy-nao-supoe-genero`), sem
 * travessão (`copy-sem-travessao`), e "horário de {serviço}" em vez de "seu {serviço}" (metade do
 * catálogo é feminino: barba, escova, depilação).
 */

export type ChaveDaVariante = 'padrao' | 'lembrete' | 'saudade' | 'segunda_visita' | 'reagendar'

type Variaveis = { primeiro: string; servico: string }

const TEXTOS: Record<ChaveDaVariante, (v: Variaveis) => string> = {
  padrao: ({ primeiro, servico }) =>
    `${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} Faz um tempinho desde seu último horário de ${servico}. Quer marcar essa semana?`,
  lembrete: ({ primeiro, servico }) =>
    `${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} Já está chegando a hora do seu próximo horário de ${servico}. Quer garantir o seu essa semana?`,
  saudade: ({ primeiro, servico }) =>
    `${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} Faz tempo que você não aparece por aqui, e a gente sente falta. Que tal voltar para um horário de ${servico}?`,
  segunda_visita: ({ primeiro, servico }) =>
    `${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} Foi muito bom te atender. Quer deixar marcado o próximo horário de ${servico}?`,
  reagendar: ({ primeiro, servico }) =>
    `${primeiro ? `Oi, ${primeiro}!` : 'Oi!'} Vamos achar um horário de ${servico} que funcione melhor para você? Tenho vagas essa semana.`,
}

/** A versão escrita para cada perfil; a outra metade dos clientes recebe a `padrao`. */
const DO_PERFIL: Record<Perfil, ChaveDaVariante> = {
  fiel: 'lembrete',
  regular: 'lembrete',
  atrasado: 'lembrete',
  novo: 'segunda_visita',
  sumido: 'saudade',
  faltante: 'reagendar',
}

export const CHAVES_DE_VARIANTE = Object.keys(TEXTOS) as ChaveDaVariante[]

/** Sorteio fixo por pessoa: o mesmo id cai sempre na mesma metade. */
export function metadeDe(id: string): 0 | 1 {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 2) as 0 | 1
}

/** Qual versão esta pessoa recebe. Sem perfil ainda (nota não calculada), sempre a `padrao`. */
export function varianteDe(clientId: string, perfil: Perfil | null | undefined): ChaveDaVariante {
  if (!perfil) return 'padrao'
  return metadeDe(clientId) === 0 ? 'padrao' : DO_PERFIL[perfil]
}

export function textoDaVariante(chave: ChaveDaVariante, primeiro: string, servico: string): string {
  return TEXTOS[chave]({ primeiro, servico })
}
