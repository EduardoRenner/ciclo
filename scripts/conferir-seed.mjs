/**
 * Confere se o seed de demonstração é PLAUSÍVEL no agregado (APR-037).
 *
 *   node scripts/conferir-seed.mjs        # sai com 1 e lista o que está fora da faixa
 *
 * Cada linha de um seed pode estar certa e o conjunto ser impossível — e nenhuma tela reclama.
 * Medido em 13/10 nos seis negócios de demonstração: 100% de comparecimento, 51–58% dos horários
 * num só dia da semana, até 91% numa só hora, Motor nunca rodado e só login de dono. Com isso,
 * Caixa, Mês, Comissão, Recuperar e as telas por papel não tinham como ser vistas de verdade.
 *
 * As faixas são de um negócio de agenda comum, não de um ideal:
 *   - comparecimento entre 80% e 95% (falta existe; 100% esconde a tela de falta);
 *   - nenhum dia da semana com mais de 30% dos horários, nenhuma hora com mais de 25%;
 *   - comandas fechadas, com forma de pagamento, em pelo menos 3 dias dos últimos 14;
 *   - Motor rodado (ciclos calculados) e ao menos um negócio com 10+ pessoas para recuperar;
 *   - ao menos um negócio com login de profissional (ligado a um profissional) e de recepção.
 *
 * Só leitura, e só banco local.
 */
import { readFileSync } from 'node:fs'

export const FAIXAS = {
  comparecimentoMin: 80,
  comparecimentoMax: 95,
  maxDiaPct: 30,
  maxHoraPct: 25,
  diasComEntradaMin: 3,
  recuperarMin: 10,
}

export const NEGOCIOS_DE_DEMONSTRACAO = [
  'demo-navalha-de-ouro',
  'demo-corte-fino',
  'demo-dom-estilo',
  'demo-studio-bella',
  'demo-salao-encanto',
  'demo-espaco-vitoria',
]

/**
 * @param {{ slug: string, feitos: number, faltas: number, porDia: number[], porHora: number[],
 *   diasComEntrada: number, comandasSemForma: number, ciclos: number, recuperar: number,
 *   loginProfissional: boolean, loginRecepcao: boolean }[]} negocios
 * @returns {string[]} o que está fora da faixa; vazio quando o seed é plausível
 */
export function avaliarSeed(negocios) {
  const falhas = []
  if (negocios.length === 0) return ['nenhum negócio de demonstração encontrado — rode os seeds antes de conferir']

  for (const n of negocios) {
    const atendidos = n.feitos + n.faltas
    if (atendidos === 0) {
      falhas.push(`${n.slug}: nenhum atendimento passado`)
      continue
    }
    const comparecimento = Math.round((100 * n.feitos) / atendidos)
    if (comparecimento < FAIXAS.comparecimentoMin || comparecimento > FAIXAS.comparecimentoMax) {
      falhas.push(`${n.slug}: comparecimento ${comparecimento}% (faixa ${FAIXAS.comparecimentoMin}–${FAIXAS.comparecimentoMax}%)`)
    }
    const totalDia = n.porDia.reduce((a, b) => a + b, 0)
    const maxDia = totalDia ? Math.round((100 * Math.max(...n.porDia)) / totalDia) : 0
    if (maxDia > FAIXAS.maxDiaPct) falhas.push(`${n.slug}: ${maxDia}% dos horários num só dia da semana (máx. ${FAIXAS.maxDiaPct}%)`)
    const totalHora = n.porHora.reduce((a, b) => a + b, 0)
    const maxHora = totalHora ? Math.round((100 * Math.max(...n.porHora)) / totalHora) : 0
    if (maxHora > FAIXAS.maxHoraPct) falhas.push(`${n.slug}: ${maxHora}% dos horários numa só hora (máx. ${FAIXAS.maxHoraPct}%)`)
    if (n.diasComEntrada < FAIXAS.diasComEntradaMin) {
      falhas.push(`${n.slug}: comandas fechadas em ${n.diasComEntrada} dos últimos 14 dias (mín. ${FAIXAS.diasComEntradaMin})`)
    }
    if (n.comandasSemForma > 0) falhas.push(`${n.slug}: ${n.comandasSemForma} comandas fechadas sem forma de pagamento`)
    if (n.ciclos === 0) falhas.push(`${n.slug}: Motor de Ciclo não rodou (0 ciclos)`)
  }

  if (!negocios.some((n) => n.recuperar >= FAIXAS.recuperarMin)) {
    falhas.push(`nenhum negócio com ${FAIXAS.recuperarMin}+ pessoas para recuperar (maior: ${Math.max(...negocios.map((n) => n.recuperar))})`)
  }
  if (!negocios.some((n) => n.loginProfissional)) falhas.push('nenhum negócio com login de profissional ligado a um profissional')
  if (!negocios.some((n) => n.loginRecepcao)) falhas.push('nenhum negócio com login de recepção')
  return falhas
}

const DIA_DA_SEMANA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

async function medir() {
  const { createClient } = await import('@supabase/supabase-js')
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      }),
  )
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(url)) {
    console.error(`[conferir-seed] RECUSADO — ${url} não é o Supabase local.`)
    process.exit(1)
  }
  const svc = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const ok = (r, onde) => {
    if (r.error) {
      console.error(`[conferir-seed] falhou em ${onde}:`, r.error.message)
      process.exit(1)
    }
    return r.data
  }

  const tenants = ok(await svc.from('tenants').select('id, slug, timezone').in('slug', NEGOCIOS_DE_DEMONSTRACAO), 'tenants')
  const agora = new Date()
  const ha14 = new Date(agora.getTime() - 14 * 86_400_000).toISOString()
  const negocios = []
  for (const t of tenants) {
    const ags = ok(
      await svc.from('appointments').select('starts_at, status').eq('tenant_id', t.id).lt('starts_at', agora.toISOString()),
      `agendamentos de ${t.slug}`,
    )
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: t.timezone, weekday: 'short', hour: '2-digit', hour12: false })
    const porDia = Array(7).fill(0)
    const porHora = Array(24).fill(0)
    for (const a of ags) {
      const partes = Object.fromEntries(fmt.formatToParts(new Date(a.starts_at)).map((p) => [p.type, p.value]))
      porDia[DIA_DA_SEMANA[partes.weekday]]++
      porHora[Number(partes.hour) % 24]++
    }
    const comandas = ok(
      await svc.from('tickets').select('closed_at, payment_method').eq('tenant_id', t.id).eq('status', 'closed').gte('closed_at', ha14),
      `comandas de ${t.slug}`,
    )
    const diaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: t.timezone })
    const semForma = await svc.from('tickets').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id).eq('status', 'closed').is('payment_method', null)
    const ciclos = await svc.from('client_cycles').select('client_id', { count: 'exact', head: true }).eq('tenant_id', t.id)
    const recuperar = await svc.from('v_recover_revenue').select('client_id', { count: 'exact', head: true }).eq('tenant_id', t.id)
    const membros = ok(await svc.from('memberships').select('user_id, role').eq('tenant_id', t.id).eq('active', true), 'membros')
    const profsComLogin = ok(await svc.from('professionals').select('user_id').eq('tenant_id', t.id).not('user_id', 'is', null), 'profissionais')
    const ligados = new Set(profsComLogin.map((p) => p.user_id))

    negocios.push({
      slug: t.slug,
      feitos: ags.filter((a) => a.status === 'done').length,
      faltas: ags.filter((a) => a.status === 'no_show').length,
      porDia,
      porHora,
      diasComEntrada: new Set(comandas.map((c) => diaLocal.format(new Date(c.closed_at)))).size,
      comandasSemForma: semForma.count ?? 0,
      ciclos: ciclos.count ?? 0,
      recuperar: recuperar.count ?? 0,
      loginProfissional: membros.some((m) => m.role === 'professional' && ligados.has(m.user_id)),
      loginRecepcao: membros.some((m) => m.role === 'reception'),
    })
  }
  return negocios
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/conferir-seed.mjs')) {
  const negocios = await medir()
  for (const n of negocios) {
    const atendidos = n.feitos + n.faltas
    console.log(
      `${n.slug}: ${atendidos} passados, comparecimento ${atendidos ? Math.round((100 * n.feitos) / atendidos) : 0}%, ` +
        `${n.diasComEntrada} dias com comanda, ${n.ciclos} ciclos, ${n.recuperar} para recuperar`,
    )
  }
  const falhas = avaliarSeed(negocios)
  if (falhas.length) {
    console.error(`\n✗ seed fora da faixa (${falhas.length}):\n  - ${falhas.join('\n  - ')}`)
    process.exit(1)
  }
  console.log('\n✓ seed plausível')
}
