/**
 * docs/98-aprimoramento/11 LOJA-27. Excluir a própria conta exigia o segundo fator (`aal2`) de todo mundo. Quem
 * nunca ligou a verificação em duas etapas, que é quase toda conta nova e a conta do revisor da Apple, era
 * mandado ligá-la antes de poder sair: a regra 5.1.1(v) pede exclusão sem obstáculo que não seja necessário.
 *
 * A trava continua, mas proporcional ao que a conta tem:
 *  - com o segundo fator cadastrado, só ele confirma (quem o ligou escolheu essa proteção);
 *  - sem ele, confirma um login feito há pouco, ou a senha digitada na hora;
 *  - quem entrou só por Google ou Apple não tem senha: entra de novo, e o login recente confirma.
 */
export const JANELA_DE_LOGIN_RECENTE_MS = 10 * 60 * 1000

export type ConfirmacaoDaExclusao = 'pronta' | 'senha' | 'entrar_de_novo' | 'segundo_fator'

export function confirmacaoParaExcluir(e: {
  aal: string
  temSegundoFator: boolean
  temSenha: boolean
  /** Quando a pessoa se autenticou pela última vez (o `amr` mais recente), em ms. */
  autenticadoEmMs: number | null
  agoraMs: number
}): ConfirmacaoDaExclusao {
  if (e.aal === 'aal2') return 'pronta'
  if (e.temSegundoFator) return 'segundo_fator'
  const decorrido = e.autenticadoEmMs === null ? null : e.agoraMs - e.autenticadoEmMs
  // Decorrido negativo é relógio adiantado de alguém: não é prova de nada, cai na senha.
  if (decorrido !== null && decorrido >= 0 && decorrido <= JANELA_DE_LOGIN_RECENTE_MS) return 'pronta'
  return e.temSenha ? 'senha' : 'entrar_de_novo'
}
