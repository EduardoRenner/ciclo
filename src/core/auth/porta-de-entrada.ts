export type PortaDeEntrada = 'escolher' | 'profissional' | 'cliente'

/**
 * docs/114 L-02: qual porta a tela `/entrar` mostra. A escolha fica na URL (`?porta=`), então funciona
 * sem JavaScript e o "voltar" do celular volta para a pergunta. Quem chega com `?proximo=` (link do
 * painel, sessão vencida) ou `?erro=` (link de e-mail) já é profissional: perguntar seria um passo a
 * mais para quem só queria entrar.
 */
export function portaDeEntrada({
  porta,
  erro,
  proximo,
}: {
  porta?: string | null
  erro?: string | null
  proximo?: string | null
}): PortaDeEntrada {
  if (porta === 'cliente' || porta === 'profissional') return porta
  if (erro || proximo) return 'profissional'
  return 'escolher'
}
