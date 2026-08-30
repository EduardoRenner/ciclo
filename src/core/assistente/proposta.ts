/**
 * Reconhece, no resultado de uma ferramenta, uma PROPOSTA que vira cartão com botão no chat.
 *
 * Por que validar em vez de confiar no formato: o que chega aqui é o retorno de `executar()`, e o
 * cartão que sai daqui carrega o corpo que a ROTA DE EXECUÇÃO vai receber quando o dono tocar em
 * confirmar. Um objeto malformado virando cartão é um botão que promete uma ação e falha no
 * clique — ou, pior, executa outra coisa. A porta é estreita de propósito: só passa o que tem
 * `status: 'proposta'`, `acao`, `dados` e `resumo`, todos no formato certo.
 *
 * Vive em `core/` (pura, sem I/O, regra 5 do `CLAUDE.md`) para a guarda exercitar esta função, e
 * não uma cópia da lógica dentro do teste — foi assim que duas guardas cegas nasceram nesta base.
 */
export type Proposta = {
  acao: string
  dados: Record<string, unknown>
  resumo: Record<string, unknown>
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function extrairProposta(resultado: unknown): Proposta | undefined {
  if (!ehObjeto(resultado)) return undefined
  if (resultado.status !== 'proposta') return undefined

  const { acao, dados, resumo } = resultado
  // `acao` vazia viraria um botão sem destino; `dados`/`resumo` fora de objeto viraria cartão
  // sem conteúdo. Qualquer um dos três errado e não há cartão — o texto do assistente continua,
  // e o dono resolve pela tela, que é a degradação segura.
  if (typeof acao !== 'string' || acao === '') return undefined
  if (!ehObjeto(dados) || !ehObjeto(resumo)) return undefined

  return { acao, dados, resumo }
}
