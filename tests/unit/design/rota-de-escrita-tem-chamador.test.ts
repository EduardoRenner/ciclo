import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * APR-214 (docs/98 C-40, C-37, C-38, C-41): rota de escrita que ninguém chama é código morto com
 * superfície de ataque — e, pior, é promessa de produto que a tela não entrega (`/tickets/[id]/cancel`
 * ficou meses assim até a APR-204). Toda rota não pública com POST/PATCH/PUT/DELETE precisa de um
 * chamador em `src/` (fora de `src/app/api`) ou de um motivo escrito aqui.
 *
 * O "chamador" é achado pelo caminho: os trechos estáticos da URL (sem os `[id]`) têm que aparecer
 * num mesmo arquivo de `src/`. É heurística de texto, e por isso o piso: as rotas conhecidas sem
 * chamador em 2026-10-14 estão listadas com o motivo; uma rota nova sem chamador reprova.
 */
const JUSTIFICADAS: Record<string, string> = {
  '/api/v1/auth/codigo/hook':
    'quem chama é o Supabase Auth (hook "Send SMS", docs/110 L1), configurado no painel e no config.toml, não um botão do app',
  '/api/v1/cycle/recover/send':
    'envio em lote da Recuperar por canal automático: sem credencial de WhatsApp em produção, a tela usa o link wa.me um a um; a rota fica para quando o canal existir (docs/42)',
  '/api/v1/subjects/[id]/odometer-readings':
    'leitura de km do check-in (AUT-103, C-039): a rota vem antes da tela; o botão nasce no check-in pela placa (AUT-401) e no plano do carro (AUT-402), com o pacote Oficina ainda fechado (OFICINA_ABERTA)',
  '/api/v1/waitlist':
    'DECISÃO pendente (docs/98 APR-214): a lista de espera só entra hoje pela página pública (`/api/v1/public/waitlist`); ou a tela do painel ganha "pôr na lista" ou esta rota sai',
  '/api/v1/wallet/debit':
    'débito da carteira de crédito entra pela comanda (APR-015/017, decisão sobre pacote pendente); até lá a rota existe sem botão',
}

const ESCRITA = /export const (POST|PATCH|PUT|DELETE)\b/

function arquivos(dir: string, filtro: (nome: string) => boolean): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho, filtro)
    return filtro(nome) ? [caminho] : []
  })
}

function norm(p: string): string {
  return p.split(sep).join('/')
}

/** `src/app/api/v1/tickets/[id]/cancel/route.ts` → `/api/v1/tickets/[id]/cancel` */
function urlDaRota(arquivo: string): string {
  return '/' + norm(arquivo).replace(/^src\/app\//, '').replace(/\/route\.ts$/, '')
}

export function rotasDeEscritaSemChamador(rotas: { url: string; fonte: string }[], fontes: string[]): string[] {
  return rotas
    .filter((r) => ESCRITA.test(r.fonte) && !r.url.startsWith('/api/v1/public/'))
    .map((r) => r.url)
    .filter((url) => {
      const partes = url.split(/\/\[[^\]]+\]/).filter(Boolean)
      const [chave, ...resto] = partes as [string, ...string[]]
      const restos = resto.map((x) => x.replace(/^\//, ''))
      return !fontes.some((s) => s.includes(chave) && restos.every((x) => s.includes(x)))
    })
}

describe('toda rota de escrita não pública tem quem a chame, ou um motivo escrito (APR-214)', () => {
  it('o detector acusa uma rota plantada sem chamador, e aceita a que tem', () => {
    const rotas = [
      { url: '/api/v1/x/[id]/fechar', fonte: "export const POST = rota(async () => ({}))" },
      { url: '/api/v1/y', fonte: "export const DELETE = rota(async () => ({}))" },
      { url: '/api/v1/z', fonte: "export const GET = rota(async () => ({}))" },
    ]
    const fontes = ["fetch(`/api/v1/x/${id}/fechar`, { method: 'POST' })"]
    expect(rotasDeEscritaSemChamador(rotas, fontes)).toEqual(['/api/v1/y'])
  })

  it('nenhuma rota nova de escrita sem chamador fora da lista justificada — e a lista não sobra', () => {
    const rotas = arquivos('src/app/api/v1', (n) => n === 'route.ts').map((a) => ({ url: urlDaRota(a), fonte: readFileSync(a, 'utf8') }))
    expect(rotas.length, 'o varredor não achou rotas').toBeGreaterThan(50)
    const fontes = arquivos('src', (n) => /\.tsx?$/.test(n))
      .filter((a) => !norm(a).startsWith('src/app/api/'))
      .map((a) => readFileSync(a, 'utf8'))
    const sem = rotasDeEscritaSemChamador(rotas, fontes)
    const novas = sem.filter((url) => !(url in JUSTIFICADAS))
    expect(novas, 'rota de escrita sem chamador em src/: ligue um botão a ela ou escreva o motivo em JUSTIFICADAS').toEqual([])
    const sobras = Object.keys(JUSTIFICADAS).filter((url) => !sem.includes(url))
    expect(sobras, 'estas rotas ganharam chamador: tire-as da lista para ela não virar crédito').toEqual([])
  })
})
