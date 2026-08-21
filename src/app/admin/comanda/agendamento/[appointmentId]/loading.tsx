import { EsqueletoCabecalho } from '@/components/ui/esqueleto-tela'

/** Rota de passagem: resolve a comanda do agendamento e redireciona. Só o cabeçalho. */
export default function CarregandoComandaDoAgendamento() {
  return <EsqueletoCabecalho comDescricao={false} />
}
