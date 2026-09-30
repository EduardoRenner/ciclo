import { COMO_SALVAR_EM_CSV, decodificarTexto, planilhaBinaria } from '@/core/text/decodificar-texto'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { preVisualizarCsv } from '@/server/services/importacao-clientes'

const TAMANHO_MAXIMO = 5 * 1024 * 1024 // 5 MB — planilha de clientes não chega perto disso

export const POST = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:create')

  const form = await req.formData().catch(() => null)
  const arquivo = form?.get('file')
  if (!(arquivo instanceof File)) throw AppError.validacao({ file: 'Envie um arquivo CSV.' })
  if (arquivo.size > TAMANHO_MAXIMO) throw AppError.validacao({ file: 'Arquivo maior que 5 MB.' })

  // BL-51: mesma decodificação da importação — a prévia tem que mostrar o nome como ele vai entrar.
  const bytes = await arquivo.arrayBuffer()
  // docs/83 P4: planilha do Excel binária vira instrução de como salvar em CSV, não uma prévia de lixo.
  if (planilhaBinaria(bytes)) throw AppError.validacao({ file: COMO_SALVAR_EM_CSV })
  return preVisualizarCsv(decodificarTexto(bytes))
})
