import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A inviolavel nº 6 do `CLAUDE.md`: **"Escrita sempre por `/api/v1` com `Idempotency-Key`"**.
 *
 * Das doze regras invioláveis, três dá para verificar sem rodar o código, e duas delas já tinham
 * dono: a nº 2 (`service_role` confinado) tem regra de lint própria, a nº 1 (RLS) tem o teste de
 * isolamento. A nº 6 não tinha nada. Medido em 2026-09-09: 52 das 80 rotas mutantes de `/api/v1`
 * chamam `comIdempotencia`, e nada impedia a 81ª de nascer sem — a regra existia só como frase.
 *
 * O que está em jogo não é abstrato. A fila offline do PWA (`lib/offline/api-client.ts`) drena
 * sozinha quando a rede volta, **sem saber se a primeira tentativa chegou ao servidor**. Rota sem
 * idempotência nesse caminho é a comanda fechada duas vezes, o crédito lançado duas vezes, a
 * cliente cadastrada duas vezes. É o desenho do produto que exige a regra, não o gosto de quem
 * escreveu.
 *
 * ## O desenho desta guarda, e as armadilhas que ele evita
 *
 * **Descobre as rotas do disco**, nunca de uma lista fixa: rota nova aparece sozinha. Guarda que
 * itera lista escrita à mão só protege o que alguém lembrou de escrever — foi assim que o conserto
 * de um job deixou o irmão dele sem vigia por cinco dias nesta base.
 *
 * **Casa com a CHAMADA `comIdempotencia(`, não com o nome solto.** O nome aparece na linha de
 * `import` de todo arquivo que o usa; casar com ele daria verde para uma rota que importa e não
 * chama. É a armadilha nº 1 da tabela do `CLAUDE.md`, e ela já custou três guardas cegas num dia.
 *
 * **Corta comentário antes de casar**, pelos dois lados: comentário que cita `comIdempotencia(`
 * para explicar por que a rota NÃO usa daria falso verde, e comentário que cita `export const POST`
 * faria uma rota de leitura ser cobrada como mutante.
 */
const RAIZ = 'src/app/api/v1'

/** Os verbos que escrevem. `GET` e `HEAD` não entram: não há o que repetir. */
const VERBOS = ['POST', 'PUT', 'PATCH', 'DELETE']

function rotas(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...rotas(caminho))
    else if (entrada.name === 'route.ts') achados.push(caminho)
  }
  return achados
}

const TODAS = rotas(RAIZ).map((f) => f.split(String.fromCharCode(92)).join('/'))

function fonte(rota: string): string {
  return semComentarios(readFileSync(rota, 'utf8'))
}

/**
 * As duas grafias contam. Hoje a base inteira usa `export const POST = rota(...)`, mas
 * `export async function POST` é a forma que a documentação do Next mostra primeiro — é o que
 * alguém escreve ao copiar de fora, e seria justamente a rota que nasce sem passar por aqui.
 */
function verbosQueEscrevem(rota: string): string[] {
  const codigo = fonte(rota)
  return VERBOS.filter(
    (v) =>
      codigo.includes(`export const ${v} =`) ||
      codigo.includes(`export async function ${v}`) ||
      codigo.includes(`export function ${v}`),
  )
}

function usaIdempotencia(rota: string): boolean {
  return fonte(rota).includes('comIdempotencia(')
}

const MUTANTES = TODAS.filter((r) => verbosQueEscrevem(r).length > 0)

/**
 * As isentas, **com o motivo escrito uma a uma**. Lista sem motivo vira depósito: o próximo a
 * mexer não sabe se aquele nome está ali por análise ou por pressa, e no escuro só cresce.
 *
 * A régua que separa isenta de buraco não é "escreve no banco?" — é **quem pode repetir a
 * chamada**. `comIdempotencia` existe porque a fila offline do PWA reenvia sem saber se a primeira
 * tentativa chegou. Rota que a fila não carrega tem outro perfil de risco: sobra o toque duplo
 * humano, que a tela trata desabilitando o botão.
 */
const ISENTAS: { rota: string; porque: string }[] = [
  // ── Sem tenant no momento da chamada. `comIdempotencia` recebe `tenantId` e grava em
  //    `idempotency_keys.tenant_id`, que é NOT NULL: não há onde guardar a chave.
  { rota: 'auth/login', porque: 'não há tenant ainda; a sessão é o que decide qual será' },
  { rota: 'auth/logout', porque: 'derrubar sessão duas vezes deixa o mesmo estado: sem sessão' },
  { rota: 'auth/signup', porque: 'não há tenant ainda; o e-mail único no Supabase Auth é a trava' },
  { rota: 'auth/password/forgot', porque: 'sem tenant, e o balde de e-mail é a trava (o limite é do PROJETO)' },
  { rota: 'auth/password/reset', porque: 'sem tenant; o token de recuperação só serve uma vez' },
  { rota: 'auth/mfa/enroll', porque: 'sem tenant; o fator repetido é descartado pelo Supabase Auth' },
  { rota: 'auth/mfa/verify', porque: 'sem tenant; o código TOTP expira sozinho' },
  { rota: 'auth/mfa/factors/[id]', porque: 'sem tenant, e apagar duas vezes deixa o mesmo estado' },
  { rota: 'onboarding', porque: 'é a chamada que CRIA o tenant — não existe id para prefixar a chave' },
  { rota: 'memberships/accept', porque: 'o convite é consumido por estado; aceitar de novo não acha convite aberto' },

  // ── Não escreve.
  { rota: 'assistant', porque: 'só lê: as ferramentas do modelo são de leitura, e há guarda própria disso' },
  { rota: 'assistant/rapido', porque: 'atalho determinístico sobre serviços de leitura, sem escrita' },
  { rota: 'clients/import/preview', porque: 'lê o CSV e devolve a prévia; não toca no banco' },

  // ── Repetir deixa o MESMO estado, e o corpo é o estado inteiro.
  { rota: 'tenant/automacoes', porque: 'PATCH de configuração: o corpo é o estado final, repetir não soma' },
  { rota: 'tenant/fixed-cost', porque: 'PATCH de configuração: o corpo é o estado final, repetir não soma' },
  { rota: 'tenant/loyalty-config', porque: 'PATCH de configuração: o corpo é o estado final, repetir não soma' },
  { rota: 'tenant/payment-fees', porque: 'PATCH de configuração: o corpo é o estado final, repetir não soma' },
  { rota: 'tickets/[id]/items/[itemId]', porque: 'DELETE de um item: a segunda chamada não acha o que apagar' },
  { rota: 'public/appointments/confirm/[token]', porque: 'transição de estado por token: confirmar o já confirmado não muda nada' },
  { rota: 'public/appointments/cancel/[token]', porque: 'transição de estado por token: cancelar o já cancelado não muda nada' },
  { rota: 'cycles/recompute', porque: 'recálculo é idempotente por definição, e tem freio próprio (guarda separada)' },

  // ── `multipart/form-data`, e isto é o que decide: a fila offline (`lib/offline/api-client.ts`)
  //    só embala JSON — ela fixa `content-type: application/json` e é ela que gera a
  //    `idempotency-key`. Estas rotas são chamadas por `fetch` direto, nunca são reenviadas
  //    sozinhas, e o que sobra é o toque duplo humano.
  { rota: 'clients/import', porque: 'multipart fora da fila offline; e a importação já pula telefone repetido' },
  { rota: 'clients/[id]/media', porque: 'multipart fora da fila offline' },
  { rota: 'tenant/vitrine', porque: 'multipart fora da fila offline' },
  { rota: 'tenant/vitrine/entidade', porque: 'multipart fora da fila offline' },

  // ── Públicas, e a trava é do BANCO, não do header: quem chama é anônimo e pode mandar a chave
  //    que quiser. `appointments_no_overlap` recusa o segundo agendamento no mesmo horário.
  { rota: 'public/[slug]/book', porque: 'anônimo escolhe a própria chave; a trava real é a constraint de sobreposição' },
  { rota: 'public/[slug]/quote-request', porque: 'anônimo escolhe a própria chave; o balde por IP é a trava' },
  { rota: 'public/waitlist/claim/[token]', porque: 'anônimo; o encaixe é fechado por estado e pela constraint de sobreposição' },
  /*
    Estas três chegaram aqui por MEDIÇÃO, e a medição errada foi minha. A varredura de shell que
    levantou o mapa (`grep -q comIdempotencia`) contou as três como protegidas — casando com o
    COMENTÁRIO que explica por que elas não usam. O número que eu tinha era 52 de 80; o real é 49.

    É a armadilha nº 1 da tabela do CLAUDE.md acontecendo no instrumento de medida em vez de no
    teste, uma hora depois de eu ter escrito o docstring que manda casar com a chamada. Vale como
    registro: a guarda nasceu certa e pegou o erro de quem a escreveu na primeira execução.

    O motivo delas já estava escrito no próprio arquivo, e é bom — repito aqui porque a lista tem
    que ser legível sem abrir 31 rotas.
  */
  { rota: 'public/quotes/[token]/approve', porque: 'anônimo; `aprovarOrcamentoPublico` checa o estado e responde igual no segundo clique' },
  { rota: 'public/quotes/[token]/reject', porque: 'anônimo; mesma checagem de estado do approve' },
  { rota: 'public/reviews/[token]', porque: 'anônimo; a constraint única em client_reviews.appointment_id impede a duplicata e o 23505 vira sucesso' },
].map((e) => ({ ...e, rota: `${RAIZ}/${e.rota}/route.ts` }))

/**
 * Afirmadas por nome: onde repetir custa DINHEIRO. O resto da suíte prova a regra geral; estas
 * quatro provam que a regra continua valendo justamente onde ela foi escrita para valer. Sem isto,
 * tirar `comIdempotencia` de `wallet/credit` passaria despercebido se alguém, no mesmo commit,
 * pusesse a rota na lista de isentas.
 */
const ONDE_REPETIR_CUSTA_DINHEIRO = [
  'wallet/credit',
  'wallet/debit',
  'tickets/[id]/close',
  'tickets/[id]/items',
].map((r) => `${RAIZ}/${r}/route.ts`)

describe('o leitor deste teste', () => {
  it('achou as rotas — não passa por ter varrido pasta vazia', () => {
    // O piso é o positivo conhecido, não a contagem: `wallet/credit` tem que estar entre as
    // mutantes achadas. Uma varredura que devolvesse zero rotas passaria em tudo abaixo.
    expect(TODAS.length).toBeGreaterThan(80)
    expect(MUTANTES).toContain(`${RAIZ}/wallet/credit/route.ts`)
    expect(MUTANTES.length).toBeGreaterThan(60)
  })

  it('não conta rota de leitura como mutante', () => {
    // `GET` puro não pode entrar na conta, senão a lista de isentas teria que crescer para
    // acomodar rotas que nunca escreveram nada — e uma lista assim para de significar algo.
    const soLeitura = TODAS.filter((r) => verbosQueEscrevem(r).length === 0)
    expect(soLeitura.length).toBeGreaterThan(0)
  })

  it('cada isenta existe, escreve de verdade, e diz por quê', () => {
    for (const { rota, porque } of ISENTAS) {
      // Nome que não existe mais deixaria a isenção passando vazia — e escondendo a rota nova que
      // herdasse o caminho.
      expect(existsSync(rota), `${rota} está na lista de isentas e não existe mais`).toBe(true)
      expect(
        verbosQueEscrevem(rota).length,
        `${rota} está isenta de uma regra sobre ESCRITA e não escreve — a isenção é ruído`,
      ).toBeGreaterThan(0)
      expect(porque.length, `${rota} está isenta sem motivo escrito`).toBeGreaterThan(20)
    }
  })
})

describe('toda escrita em /api/v1 passa por Idempotency-Key', () => {
  it('nenhuma rota mutante fica sem idempotência e sem motivo', () => {
    const isentas = new Set(ISENTAS.map((e) => e.rota))
    const desprotegidas = MUTANTES.filter((r) => !usaIdempotencia(r) && !isentas.has(r))
    expect(
      desprotegidas,
      'rota que escreve sem `comIdempotencia`. A fila offline do PWA reenvia sem saber se a ' +
        'primeira tentativa chegou: sem a chave, o reenvio duplica a escrita. Use ' +
        '`comIdempotencia(req, { tenantId, endpoint }, ...)` ou entre na lista ISENTAS COM o motivo.',
    ).toEqual([])
  })

  it('a lista de isentas não guarda nome que já se protegeu', () => {
    // Direção oposta, e ela importa: rota que passou a usar `comIdempotencia` e ficou na lista
    // deixa a próxima pessoa achar que ali não há proteção — e a lista para de valer como mapa.
    const jaProtegidas = ISENTAS.filter((e) => existsSync(e.rota) && usaIdempotencia(e.rota)).map((e) => e.rota)
    expect(jaProtegidas, 'estas já usam idempotência — tire-as da lista de isentas').toEqual([])
  })

  it('onde repetir custa dinheiro, a idempotência está lá', () => {
    for (const rota of ONDE_REPETIR_CUSTA_DINHEIRO) {
      expect(existsSync(rota), `${rota} sumiu — a afirmação abaixo passaria vazia`).toBe(true)
      expect(usaIdempotencia(rota), `${rota} move dinheiro e perdeu a idempotência`).toBe(true)
      expect(ISENTAS.map((e) => e.rota), `${rota} move dinheiro: não pode ser isenta`).not.toContain(rota)
    }
  })
})
