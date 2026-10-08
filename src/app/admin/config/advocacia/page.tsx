import { AlertTriangle } from 'lucide-react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import SectionHeader from '@/components/ui/section-header'
import { REGRAS_CONFIRMAVEIS, regrasConfirmadas } from '@/core/advocacia/configuracao'
import { fmtDiaMes } from '@/core/advocacia/datas'
import { alvosDaCaptura } from '@/core/advocacia/intimacoes'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'

import { EquipeDoEscritorio, RegrasDeContagem } from './formularios'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Escritório' }

/**
 * docs/101 T4.6 e anexo 04 §4.8: o que o pacote precisa saber do escritório para trabalhar sozinho. A
 * OAB de cada pessoa (sem ela, a captura não consulta), as regras de contagem que a direção confirma
 * (sem elas, a data do prazo não vem preenchida) e a saúde da captura dos últimos dias.
 */
export default async function PaginaConfigAdvocacia() {
  const ctx = await contextoDoPainel(new Request('https://interno/config/advocacia', { headers: await headers() }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()
  const db = await criarClienteDoUsuario()
  const direcao = ctx.papel === 'owner'

  const [equipe, tenant, captura] = await Promise.all([
    db.from('professionals').select('id, display_name, active, legal_role, oab_number, oab_uf').eq('tenant_id', ctx.tenantId).eq('active', true).order('display_name'),
    db.from('tenants').select('settings').eq('id', ctx.tenantId).single(),
    db.from('legal_intimation_sync').select('alvo, dia, ok, count_fonte, count_gravado, detalhe').eq('tenant_id', ctx.tenantId).order('dia', { ascending: false }).limit(20),
  ])
  if (equipe.error || tenant.error) throw new AppError('INTERNAL', { cause: equipe.error ?? tenant.error })

  const pessoas = (equipe.data ?? []).map((p) => ({ id: p.id, nome: p.display_name, papel: p.legal_role, oab: p.oab_number, uf: p.oab_uf }))
  const { semOab } = alvosDaCaptura(
    (equipe.data ?? []).map((p) => ({ id: p.id, active: p.active, role: p.legal_role === 'advogado' ? 'advogado' : 'outro', oabNumber: p.oab_number, oabUf: p.oab_uf })),
    [],
  )

  return (
    <>
      <PageHeader titulo="Escritório" descricao="OAB da equipe, regras de contagem de prazo e a captura de intimações." />

      <section aria-labelledby="sec-equipe" className="mb-6">
        <SectionHeader>
          <span id="sec-equipe">Equipe e OAB</span>
        </SectionHeader>
        {semOab.length > 0 ? (
          <p role="status" className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-warn/40 bg-warn/10 p-3 text-secundario">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
            {semOab.length === 1
              ? '1 pessoa da advocacia sem OAB válida: as intimações dela não são capturadas.'
              : `${semOab.length} pessoas da advocacia sem OAB válida: as intimações delas não são capturadas.`}
          </p>
        ) : null}
        <EquipeDoEscritorio pessoas={pessoas} podeEditar={direcao} semOab={semOab} />
      </section>

      <section aria-labelledby="sec-regras" className="mb-6">
        <SectionHeader>
          <span id="sec-regras">Regras de contagem de prazo</span>
        </SectionHeader>
        <RegrasDeContagem
          regras={REGRAS_CONFIRMAVEIS.map((r) => ({ id: r.id, rotulo: r.rotulo, fonte: r.fonte, jaValidada: r.jaValidada }))}
          confirmadas={regrasConfirmadas(tenant.data.settings)}
          podeEditar={direcao}
        />
      </section>

      <section aria-labelledby="sec-captura" className="mb-10">
        <SectionHeader>
          <span id="sec-captura">Captura de intimações</span>
        </SectionHeader>
        {captura.error || (captura.data ?? []).length === 0 ? (
          <p className="text-secundario text-txt-2">
            {captura.error ? 'Só a direção vê a saúde da captura.' : 'A captura ainda não rodou para este escritório.'}
          </p>
        ) : (
          <Card className="p-3">
            <ul className="flex flex-col divide-y divide-line">
              {(captura.data ?? []).map((s) => (
                <li key={`${s.alvo}${s.dia}`} className="flex items-start justify-between gap-3 py-2 text-secundario">
                  <span>
                    {fmtDiaMes(s.dia)} · {s.alvo.replace(/^oab:/, 'OAB ')}
                    {s.detalhe ? <span className="block text-label text-txt-3">{s.detalhe}</span> : null}
                  </span>
                  <span className={`shrink-0 font-semibold ${s.ok ? 'text-ok' : 'text-bad'}`}>
                    {s.ok ? `${s.count_gravado} de ${s.count_fonte}` : 'Conferir'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  )
}
