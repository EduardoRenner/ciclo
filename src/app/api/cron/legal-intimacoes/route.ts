import { hojeNoFuso } from '@/core/advocacia/datas'
import { ehDemonstracao } from '@/core/tenants/demonstracao'
import { capturarIntimacoesDoEscritorio, type ResumoDaCaptura } from '@/server/advocacia/captura'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { compararSegredo } from '@/server/http/segredo'
import { registrarHeartbeat } from '@/server/services/health'

/**
 * docs/101 T4.1: captura as intimações do DJEN de todo escritório do pacote Advocacia. Uma vez por dia
 * útil basta (a fonte publica de madrugada); a captura refaz sozinha o dia que falhou ontem.
 *
 * **Escritório de demonstração fica de fora**, e não por economia: a OAB fictícia do escritório-modelo
 * (12345/SC) existe no DJEN e é de alguém de verdade. Capturar para a demo traria intimação real, com
 * nome de parte, para uma tela que se apresenta como fictícia.
 *
 * Um escritório que falha não para os outros: o erro vira contagem no resumo e linha de log.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data, error } = await svc.from('tenants').select('id, slug, timezone, professions!inner(pacote)').eq('professions.pacote', 'advocacia')
    if (error) throw new AppError('INTERNAL', { cause: error })

    const escritorios = (data ?? []).filter((t) => !ehDemonstracao(t.slug))
    const resumos: (ResumoDaCaptura & { tenant: string })[] = []
    let comErro = 0
    for (const t of escritorios) {
      try {
        resumos.push({ tenant: t.id, ...(await capturarIntimacoesDoEscritorio(svc, t.id, hojeNoFuso(t.timezone, new Date()))) })
      } catch (erro) {
        comErro++
        console.error(JSON.stringify({ level: 'error', event: 'captura_intimacoes_falhou', tenant: t.id }), erro)
      }
    }
    await registrarHeartbeat(svc, 'legal_intimacoes')
    return { escritorios: escritorios.length, comErro, novas: resumos.reduce((s, r) => s + r.novas, 0), falhasDeDia: resumos.reduce((s, r) => s + r.falhas, 0) }
  })
})
