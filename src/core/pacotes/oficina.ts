import type { Pacote } from './tipos'

/**
 * O pacote Oficina (docs/106-automotivo AUT-104). As telas próprias (check-in pela placa, o plano do carro,
 * o orçamento por item) são a fase 4 do 106; até lá a oficina usa as mesmas abas do pacote base, que já
 * servem a agenda, os clientes e a recuperação, com o vocabulário do balcão (quem atende segue
 * "profissional": há mecânicas, e a guarda de gênero recusa o masculino).
 */
export const OFICINA: Pacote = {
  slug: 'oficina',
  nome: 'Oficina',
  abas: [
    { href: '/admin/hoje', rotulo: 'Hoje', icone: 'Home' },
    { href: '/admin/agenda', rotulo: 'Agenda', icone: 'CalendarDays' },
    { href: '/admin/clientes', rotulo: 'Clientes', icone: 'Users' },
    { href: '/admin/agenda/novo', rotulo: 'Marcar', icone: 'Plus' },
  ],
  centro: { href: '/admin/recuperar', rotulo: 'Recuperar receita', icone: 'Anel' },
  vocabularioExtra: { veiculo: 'veículo', placa: 'placa', os: 'ordem de serviço', quilometragem: 'quilometragem' },
  exigeSegundoFator: false,
}
