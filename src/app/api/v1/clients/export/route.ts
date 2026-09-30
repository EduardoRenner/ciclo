import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { limitador } from '@/server/services/rate-limit'
import { clientesParaCsv, listarTodosClientesParaExportar } from '@/server/services/clientes'

/** 30 dias corridos — o mesmo período que a FAQ C35 chama de "1×/mês". */
const JANELA_DO_LIMITE_SEGUNDOS = 30 * 24 * 3600

/**
 * `GET /api/v1/clients/export 🔐` — P3 de `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` §7.4/§9: o
 * botão "Baixar todos os meus clientes em planilha", condição para a promessa "grátis para
 * sempre" sobreviver à pergunta do Diego (§7.4): *"grátis? vai sumir em seis meses e eu perco
 * tudo"*. Sem isto o CICLO não tinha resposta.
 *
 * Reusa `client:export` (`rbac.ts`), a mesma permissão de `[id]/data-export` — mas esta rota É o
 * caso que a FAQ C35 pergunta de verdade: "quem pode exportar A BASE de clientes" (a carteira
 * inteira). C35 responde: só dono, com MFA na hora, no máximo 1×/mês, com auditoria. Implementado
 * abaixo. **Dois pedaços de C35 ficaram de fora desta rodada, por decisão, não esquecimento:**
 *
 * - push + e-mail avisando o dono da exportação — não existe nenhuma infraestrutura de
 *   notificação de segurança nesta base ainda (nenhuma rota manda push/e-mail de "algo sensível
 *   aconteceu"); construir isso é escopo maior que este ticket.
 * - a linha-marca-d'água DENTRO do CSV — quebraria a simetria do §7.4 ("trouxe na hora, levo na
 *   hora"): o arquivo existe para poder voltar a entrar pelo importador do próprio CICLO ou de
 *   outro sistema, e uma linha de metadado na frente ou atrás vira uma "cliente" fantasma na
 *   primeira reimportação. Quem exportou já fica na trilha de auditoria abaixo.
 *
 * `tenantId` vem só de `contextoAtual` (sessão + membership revalidado no banco), nunca do corpo
 * ou de query string — a armadilha que o `CLAUDE.md` cataloga ("confiar no tenant_id da
 * requisição"). A consulta em si usa o cliente de SESSÃO (`criarClienteDoUsuario`), não
 * `service_role`: os quatro campos exportados (nome, telefone, e-mail, última visita) não tocam o
 * cofre, então a RLS comum já é a rede certa, em cima da permissão já checada.
 */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:export')
  const sessao = await exigirAal2()

  const { permitido } = await limitador(`client-export:tenant:${ctx.tenantId}`, { limite: 1, janelaSegundos: JANELA_DO_LIMITE_SEGUNDOS })
  if (!permitido) {
    // Não usa `AppError.limiteDeTaxa`: `textoDeEspera` (`core/http/espera.ts`) não tem frase para
    // uma janela de 30 dias — a partir de 20h ela devolve "atingiu o limite de HOJE", que aqui
    // seria mentira (o limite é do MÊS, não do dia).
    throw new AppError('RATE_LIMITED', {
      message: 'Você já baixou a base este mês. O limite existe para proteger os dados dos seus clientes. Tente de novo daqui a alguns dias.',
      headers: { 'Retry-After': String(JANELA_DO_LIMITE_SEGUNDOS) },
      details: { retryAfterSeconds: JANELA_DO_LIMITE_SEGUNDOS },
    })
  }

  const db = await criarClienteDoUsuario()
  // O dia da última visita sai no fuso do SALÃO (ver `LinhaClienteParaExportar.lastVisit`).
  const { data: tenant, error: erroTenant } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  if (erroTenant) throw new AppError('INTERNAL', { cause: erroTenant })
  const linhas = await listarTodosClientesParaExportar(db, ctx.tenantId, tenant?.timezone ?? 'America/Sao_Paulo')
  const csv = clientesParaCsv(linhas)

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: sessao.userId,
      actorRole: ctx.papel,
      action: 'client.export',
      entity: 'clients',
      after: { total: linhas.length },
      requestId,
    },
    req,
  )

  const BOM = '﻿'
  // `rota()` deixa uma `Response` própria passar direto, sem o envelope JSON — é o caminho para
  // resposta binária/arquivo (comentário em `server/http/handler.ts`).
  return new Response(BOM + csv, {
    status: 200,
    headers: {
      // BOM na frente: sem ele, o Excel em português abre acento como lixo — a mesma classe de
      // defeito que BL-51 corrigiu na ENTRADA (CSV que o Excel salva); aqui é a SAÍDA. Decodificar
      // de volta ignora o BOM sozinho (`decodificarTexto`, `TextDecoder` com `ignoreBOM: false`
      // por padrão), então reimportar este mesmo arquivo não gera um cabeçalho `﻿nome`.
      'content-type': 'text/csv; charset=utf-8',
      // Sem data no nome: um nome fixo evita decidir aqui "hoje" em qual fuso (guarda
      // `dia-no-fuso-do-salao`) por um detalhe cosmético que não muda o que a dona faz com o
      // arquivo.
      'content-disposition': 'attachment; filename="clientes.csv"',
    },
  })
})
