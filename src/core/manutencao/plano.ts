import { ITENS, type Cambio, type ChaveDoItem } from './itens'
import { PERFIS, type Intervalo, type Perfil, type Plano } from './perfis'

/**
 * Resolve o plano de manutenção de UM veículo pela herança de camadas (`docs/106-automotivo` §3.4,
 * AUT-204/205): oficina → modelo/ano → família de motor → genérico do perfil. Para cada item vale a
 * camada mais específica que tiver o item; o item inteiro vem dela (não misturamos km de uma camada
 * com meses de outra — uma regra é uma frase do manual, e frase pela metade não é de ninguém).
 *
 * A origem volta junto, para a tela dizer a verdade: "pelo manual do Onix 2021" × "plano genérico".
 */

export type Origem = 'oficina' | 'modelo' | 'familia' | 'generico'

export type CamadaComFonte = { plano: Plano; fonte: string }

export type ItemDoPlano = { item: ChaveDoItem; intervalo: Intervalo; origem: Origem; fonte: string }

export type EntradaDoPlano = {
  perfil: Perfil
  cambio: Cambio
  familia?: CamadaComFonte
  modelo?: CamadaComFonte
  oficina?: CamadaComFonte
}

export function resolverPlano(e: EntradaDoPlano): ItemDoPlano[] {
  const camadas: [Origem, CamadaComFonte | undefined][] = [
    ['oficina', e.oficina],
    ['modelo', e.modelo],
    ['familia', e.familia],
    ['generico', { plano: PERFIS[e.perfil], fonte: 'plano genérico do perfil' }],
  ]
  const chaves = new Set<ChaveDoItem>()
  for (const [, c] of camadas) for (const k of Object.keys(c?.plano ?? {}) as ChaveDoItem[]) chaves.add(k)

  const resultado: ItemDoPlano[] = []
  for (const item of chaves) {
    const def = ITENS[item]
    if ('soCambio' in def && def.soCambio && def.soCambio !== e.cambio) continue
    for (const [origem, c] of camadas) {
      const intervalo = c?.plano[item]
      if (intervalo && (intervalo.km || intervalo.meses)) {
        resultado.push({ item, intervalo, origem, fonte: c!.fonte })
        break
      }
    }
  }
  return resultado.sort((a, b) => a.item.localeCompare(b.item))
}
