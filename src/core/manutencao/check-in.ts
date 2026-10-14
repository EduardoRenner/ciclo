import { normalizarPlaca } from './placa'

/**
 * O check-in pela placa (`docs/106-automotivo` AUT-401, parte pura; `docs/105-ciclo/C-036`).
 *
 * O balcão digita a placa e o sistema decide o próximo passo — a meta do plano é a OS aberta em até
 * 6 toques. A placa é a chave (C-028: antiga e Mercosul são a mesma); o veículo é um sujeito do cliente
 * (C-021). O caso que o StarkOS ensinou: a placa existe, mas em nome de OUTRO cliente — o carro foi
 * vendido. O sistema pergunta se transfere, nunca transfere sozinho, e o histórico do carro vai junto.
 */

export type VeiculoConhecido = { subjectId: string; clientId: string; chave: string; descricao: string; ativo: boolean }

export type PassoDoCheckIn =
  | { tipo: 'placa_invalida'; aviso: string }
  | { tipo: 'veiculo_do_cliente'; subjectId: string; descricao: string; pedir: readonly ['km'] }
  | { tipo: 'veiculo_de_outro_cliente'; subjectId: string; descricao: string; donoAtual: string; pergunta: string; pedir: readonly ['confirmar_transferencia', 'km'] }
  | { tipo: 'veiculo_novo'; chave: string; pedir: readonly ['marca', 'modelo', 'ano', 'km'] }

export function passoDoCheckIn(e: { placaDigitada: string; clientId: string; veiculos: readonly VeiculoConhecido[] }): PassoDoCheckIn {
  const placa = normalizarPlaca(e.placaDigitada)
  if (!placa) return { tipo: 'placa_invalida', aviso: 'Essa placa não parece brasileira. Confira as letras e os números (ex.: ABC1D23 ou ABC-1234).' }

  // Só veículo ATIVO responde pela placa: o inativo (vendido, baixado) libera a placa (0132).
  const achado = e.veiculos.find((v) => v.ativo && v.chave === placa.chave)
  if (!achado) return { tipo: 'veiculo_novo', chave: placa.chave, pedir: ['marca', 'modelo', 'ano', 'km'] }
  if (achado.clientId === e.clientId) return { tipo: 'veiculo_do_cliente', subjectId: achado.subjectId, descricao: achado.descricao, pedir: ['km'] }
  return {
    tipo: 'veiculo_de_outro_cliente',
    subjectId: achado.subjectId,
    descricao: achado.descricao,
    donoAtual: achado.clientId,
    pergunta: `${achado.descricao} está cadastrado em nome de outra pessoa. O carro mudou de dono? Se sim, o histórico dele vem junto.`,
    pedir: ['confirmar_transferencia', 'km'],
  }
}

/** Toques até a OS aberta: a placa + um por campo pedido + o botão de abrir. A meta do 106 é ≤ 6. */
export function toquesAteAbrir(passo: PassoDoCheckIn): number {
  if (passo.tipo === 'placa_invalida') return Infinity
  return 1 + passo.pedir.length + 1
}
