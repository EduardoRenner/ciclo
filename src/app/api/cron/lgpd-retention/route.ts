import { eliminarCliente } from '@/server/services/lgpd'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'

/**
 * O job `lgpd_retention` que o FAQ prometia e que não existia (TICKET-071).
 *
 * `POST /clients/[id]/erase` já faz a eliminação inteira e bem: cofre e mídia apagados de verdade,
 * dado pessoal anonimizado coluna a coluna, trilha de auditoria redigida. O que faltava era o
 * segundo estágio — passar sozinho de `deleted_at` para eliminação depois da carência.
 *
 * ⚠️ **Esta rota fica DE PROPÓSITO fora do `on.schedule`** de `.github/workflows/cron.yml`, como
 * `reminders` e `campaigns`. Ligar destruição irreversível de dado pessoal é decisão do dono do
 * produto, não efeito colateral de um deploy. Enquanto não estiver agendada, `heartbeatVigiado`
 * não a cobra e `/api/health` não fica vermelho por ela — a mesma mecânica já registrada em
 * `core/cron/agendadas.ts`.
 *
 * Por que carência de 30 dias e não outra: é o prazo que o FAQ (G92) e o backlog já usavam, e
 * coincide com a expiração de backup (G93) — eliminar antes disso deixaria o dado voltar numa
 * restauração, o que é o pior dos dois mundos.
 */
const DIAS_DE_CARENCIA = 30

/*
 * Lote pequeno de propósito, e o número saiu de contar o trabalho — não de arredondar.
 *
 * Cada `eliminarCliente` faz várias consultas (cliente, mídia, consentimentos), apaga arquivos no
 * storage, atualiza colunas e redige a trilha de auditoria. A primeira versão desta rota pegava
 * 500 por execução: sequencialmente, isso passa de qualquer `maxDuration` de função serverless, e
 * o job morreria no meio.
 *
 * Morrer no meio aqui é SEGURO — `eliminarCliente` recusa quem já tem `anonymized_at`, então a
 * execução seguinte continua de onde parou em vez de repetir. Mas job que sempre estoura é job que
 * ninguém confia, e o log fica cheio de timeout que não significa nada.
 *
 * Com 100, a fila normal (ninguém apaga cliente todo dia) esvazia numa execução, e uma fila grande
 * esvazia em alguns dias — o que é aceitável, porque a carência de 30 dias já disse que isto não
 * é urgente. Quem pede eliminação imediata usa o botão da ficha, que é síncrono.
 */
const POR_EXECUCAO = 100

/**
 * 60s, como `/api/v1/assistant`. É o teto que o plano dá, e a conta acima foi feita para caber
 * dentro dele com folga.
 */
export const maxDuration = 60

export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  /*
   * `?simular=1` NÃO apaga: conta e devolve quem entraria. Existe porque o primeiro disparo de um
   * job destrutivo não pode ser também a primeira vez que alguém descobre quantas linhas ele
   * alcança. É a leitura que se faz ANTES de agendar.
   */
  const simular = new URL(req.url).searchParams.get('simular') === '1'

  const limite = new Date(Date.now() - DIAS_DE_CARENCIA * 86_400_000).toISOString()

  return withNovoTenant(async (svc) => {
    const { data: vencidos, error } = await svc
      .from('clients')
      .select('id, tenant_id, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', limite)
      .is('anonymized_at', null)
      .order('deleted_at')
      .limit(POR_EXECUCAO)
    if (error) throw new AppError('INTERNAL', { cause: error })

    const fila = vencidos ?? []
    if (simular) {
      return { simulacao: true, diasDeCarencia: DIAS_DE_CARENCIA, porExecucao: POR_EXECUCAO, nesteLote: fila.length, limite }
    }

    let eliminados = 0
    const falhas: string[] = []
    for (const cliente of fila) {
      try {
        await eliminarCliente(svc, cliente.tenant_id, cliente.id)
        eliminados++
      } catch (erro) {
        /*
         * Uma falha não pode derrubar a fila inteira: as outras pessoas têm o mesmo direito de
         * serem eliminadas no prazo. O erro é contado e registrado — nunca engolido, que é a
         * armadilha do `catch` que descarta, do CLAUDE.md.
         */
        falhas.push(cliente.id)
        console.error(JSON.stringify({ level: 'error', event: 'lgpd_retention_falhou', clientId: cliente.id }), erro)
      }
    }

    return { simulacao: false, diasDeCarencia: DIAS_DE_CARENCIA, porExecucao: POR_EXECUCAO, nesteLote: fila.length, eliminados, falhas: falhas.length }
  })
})
