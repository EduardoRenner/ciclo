/**
 * As linhas que o cartão de confirmação desenha, a partir do `resumo` que a ferramenta devolveu.
 *
 * Existe por um defeito medido em produção em 2026-08-30: o cartão procurava uma LISTA FIXA de
 * seis chaves minúsculas (`cliente`, `servico`, `quando`, `precoCents`...), escrita quando
 * `preparar_agendamento` era a única ferramenta. As três seguintes devolveram `Cliente`,
 * `Telefone`, `Anotação` — e como JavaScript diferencia maiúscula, TODAS as buscas deram
 * `undefined`, o filtro descartou tudo e o `<dl>` ficou com zero filhos. O dono via um botão
 * "Confirmar" sobre uma caixa vazia.
 *
 * É a pior forma do erro: a proposta estava certa, o JSON estava certo, os testes estavam verdes,
 * e o único pedaço errado era o que a pessoa de verdade tinha que julgar antes de clicar. A
 * pesquisa sobre fadiga de aprovação diz que confirmação que não dá para julgar vira clique
 * automático — uma caixa vazia é o caso extremo disso.
 *
 * Por isso agora a lista é DERIVADA do resumo, não fixa: chave nova aparece sozinha, com o próprio
 * nome de rótulo. Uma ferramenta futura não consegue mais nascer com cartão em branco.
 */
export type TipoDaLinha = 'texto' | 'data' | 'dinheiro'
export type LinhaDoResumo = { rotulo: string; valor: unknown; tipo: TipoDaLinha }

/** Chaves com rótulo e formatação próprios; a ordem aqui é a ordem em que aparecem no cartão. */
const CONHECIDAS: Record<string, { rotulo: string; tipo: TipoDaLinha }> = {
  cliente: { rotulo: 'Cliente', tipo: 'texto' },
  clienteNova: { rotulo: 'Cadastrar nova', tipo: 'texto' },
  servico: { rotulo: 'Serviço', tipo: 'texto' },
  profissional: { rotulo: 'Com', tipo: 'texto' },
  quando: { rotulo: 'Quando', tipo: 'data' },
  precoCents: { rotulo: 'Valor', tipo: 'dinheiro' },
}

function vazio(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

export function linhasDoResumo(resumo: Record<string, unknown>): LinhaDoResumo[] {
  const linhas: LinhaDoResumo[] = []
  const usadas = new Set<string>()

  for (const [chave, { rotulo, tipo }] of Object.entries(CONHECIDAS)) {
    if (!(chave in resumo) || vazio(resumo[chave])) continue
    linhas.push({ rotulo, valor: resumo[chave], tipo })
    usadas.add(chave)
  }

  // Tudo o mais entra com o próprio nome de rótulo, na ordem em que a ferramenta escreveu. Chave
  // terminada em `Cents` é dinheiro venha de onde vier — senão um `totalCents` novo apareceria na
  // tela como "4500".
  for (const [chave, valor] of Object.entries(resumo)) {
    if (usadas.has(chave) || vazio(valor)) continue
    linhas.push({ rotulo: chave, valor, tipo: chave.endsWith('Cents') ? 'dinheiro' : 'texto' })
  }

  return linhas
}
