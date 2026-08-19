export type CampoPreferencia = { chave: string; rotulo: string; dica: string }

/**
 * O que cada nicho precisa lembrar do cliente. É isto que transforma "sistema de agenda" em
 * "meu caderninho": numa barbearia ninguém quer saber o CEP, quer saber o número da máquina.
 *
 * Fica em `lib/` porque a ficha e o cadastro de cliente novo usam a mesma lista — duplicar
 * levaria a um formulário perguntando coisa que o outro não mostra.
 */
const POR_VERTICAL: Record<string, CampoPreferencia[]> = {
  barber: [
    { chave: 'maquina', rotulo: 'Máquina', dica: '0, 1, 2...' },
    { chave: 'barba', rotulo: 'Barba', dica: 'navalha, máquina, não faz' },
    { chave: 'bebida', rotulo: 'Bebida de sempre', dica: 'cerveja, café...' },
    { chave: 'obs', rotulo: 'Detalhe importante', dica: 'redemoinho, alergia...' },
  ],
  nails: [
    { chave: 'formato', rotulo: 'Formato', dica: 'quadrada, bailarina...' },
    { chave: 'cor', rotulo: 'Cor favorita', dica: 'nude, vermelho...' },
    { chave: 'alergia', rotulo: 'Alergia', dica: 'acetona, resina...' },
    { chave: 'obs', rotulo: 'Detalhe importante', dica: 'unha fraca, cutícula sensível...' },
  ],
  hair: [
    { chave: 'quimica', rotulo: 'Química', dica: 'progressiva, coloração...' },
    { chave: 'cor', rotulo: 'Cor/tom', dica: '7.1, acaju...' },
    { chave: 'alergia', rotulo: 'Alergia', dica: 'amônia, PPD...' },
    { chave: 'obs', rotulo: 'Detalhe importante', dica: '' },
  ],
  lashes: [
    { chave: 'curvatura', rotulo: 'Curvatura', dica: 'C, D, L...' },
    { chave: 'espessura', rotulo: 'Espessura', dica: '0.07, 0.10...' },
    { chave: 'alergia', rotulo: 'Alergia', dica: 'cola, cianoacrilato...' },
    { chave: 'obs', rotulo: 'Detalhe importante', dica: 'olho sensível, lacrimeja...' },
  ],
  brows: [
    { chave: 'formato', rotulo: 'Formato', dica: 'reta, arqueada...' },
    { chave: 'henna', rotulo: 'Cor da henna', dica: 'castanho médio...' },
    { chave: 'alergia', rotulo: 'Alergia', dica: '' },
    { chave: 'obs', rotulo: 'Detalhe importante', dica: 'falha na cauda, cicatriz...' },
  ],
  waxing: [
    { chave: 'cera', rotulo: 'Cera', dica: 'quente, fria, egípcia...' },
    { chave: 'sensibilidade', rotulo: 'Sensibilidade', dica: 'pele muito sensível?' },
    { chave: 'alergia', rotulo: 'Alergia', dica: '' },
    { chave: 'obs', rotulo: 'Detalhe importante', dica: '' },
  ],
  aesthetics: [
    { chave: 'pele', rotulo: 'Tipo de pele', dica: 'oleosa, seca, mista...' },
    { chave: 'ativos', rotulo: 'Ativos em uso', dica: 'ácido, retinol...' },
    { chave: 'alergia', rotulo: 'Alergia', dica: '' },
    { chave: 'obs', rotulo: 'Detalhe importante', dica: '' },
  ],
}

const PADRAO: CampoPreferencia[] = [
  { chave: 'preferencia', rotulo: 'Preferência', dica: '' },
  { chave: 'alergia', rotulo: 'Alergia / restrição', dica: '' },
  { chave: 'obs', rotulo: 'Detalhe importante', dica: '' },
]

export function camposDePreferencia(vertical: string): CampoPreferencia[] {
  return POR_VERTICAL[vertical] ?? PADRAO
}
