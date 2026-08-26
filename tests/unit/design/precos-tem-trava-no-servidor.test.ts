import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CARTOES } from '@/lib/planos-cartoes'

import type { ModuloKey } from '@/core/billing/planos'

/**
 * O irmão de `precos-nao-promete-demais.test.ts`, e a razão de ele não ter bastado.
 *
 * Aquele teste confere que o degrau ANUNCIADO no cartão é o mesmo degrau que o `core` libera —
 * consistência de configuração, e ele está certo no que faz. Mas config coerente não é limite:
 * `podeUsarModulo()` só decide alguma coisa se alguém CHAMAR. Um módulo pode estar corretamente
 * marcado como "Essencial" no cartão e no core, e mesmo assim qualquer tenant `gratis` usar à
 * vontade — porque nenhuma rota de escrita pergunta.
 *
 * É o mesmo formato de defeito do cron (`cron-sobrevive-a-atraso.test.ts`): a guarda antiga
 * provava a aritmética, não a entrega.
 *
 * Medido na auditoria de lançamento de 2026-08-26 (`docs/23` §7): de 8 módulos vendidos como
 * pagos, **4 não tinham trava nenhuma** — Comanda e caixa (R$ 49), Equipe e comissão (R$ 99),
 * Fidelidade (R$ 99) e Recorrência (R$ 179). Na prática os três degraus pagos quase não travavam
 * nada, e a página de preço era, em boa parte, ficção.
 *
 * ## Como esta guarda funciona, e por que tem uma lista de dívida
 *
 * Ela guarda nos DOIS sentidos, igual a `rede-nao-derruba-tela.test.ts`:
 *
 *  - módulo pago **novo** sem trava reprova → a dívida para de crescer;
 *  - módulo que **já ganhou** trava e continue na lista também reprova → a lista só encolhe, e
 *    nunca vira decoração.
 *
 * `capacidade` fica de fora de propósito: capacidade não é módulo, e as duas que existem
 * (`envio_em_lote`, `remover_selo`) já são verificadas onde importam.
 */

/** Trava conhecida como ausente. Tirar daqui exige ter posto `exigirModulo` numa rota de escrita. */
const SEM_TRAVA_AINDA: readonly ModuloKey[] = ['register', 'team']

const RAIZ_DAS_ROTAS = 'src/app/api/v1'

function todasAsRotas(dir = RAIZ_DAS_ROTAS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) return todasAsRotas(caminho)
    return entrada.name === 'route.ts' ? [caminho] : []
  })
}

/** Só rota que ESCREVE. `GET` continua livre de propósito: cair de plano limita o que dá para
 *  fazer e nunca esconde o que já existe (`docs/18` regra 5.1). */
function rotasDeEscrita(): { caminho: string; fonte: string }[] {
  return todasAsRotas()
    .map((caminho) => ({ caminho, fonte: readFileSync(caminho, 'utf8') }))
    .filter(({ fonte }) => /export const (POST|PATCH|PUT|DELETE)\b/.test(fonte))
}

/**
 * Casa com a CHAMADA, nunca com o nome do módulo solto: a string `'register'` aparece em rota por
 * outros motivos (nome de tabela, rótulo, comentário), e casar com ela daria uma guarda cega —
 * o defeito nº 1 da tabela do `CLAUDE.md`.
 */
function modulosTravadosNoServidor(): Set<ModuloKey> {
  const achados = new Set<ModuloKey>()
  for (const { fonte } of rotasDeEscrita()) {
    for (const m of fonte.matchAll(/exigirModulo\([^)]*,\s*'([a-z_]+)'\s*\)/g)) {
      achados.add(m[1] as ModuloKey)
    }
  }
  return achados
}

/** Todo módulo vendido num degrau PAGO. O grátis não precisa de trava — ele é o piso. */
function modulosVendidosComoPagos(): ModuloKey[] {
  const chaves = CARTOES.filter((c) => c.tier !== 'gratis')
    .flatMap((c) => c.inclui)
    .map((i) => i.modulo)
    .filter((m): m is ModuloKey => Boolean(m))
  return [...new Set(chaves)]
}

describe('todo módulo vendido como pago tem trava no servidor', () => {
  it('a leitura dos cartões e das rotas não voltou vazia', () => {
    // Guarda contra o próprio detector. Se `CARTOES` mudar de forma, ou o regex de `export const
    // POST` parar de casar, tudo abaixo passaria vazio — verde por acidente, que é o defeito que
    // este arquivo inteiro existe para não cometer.
    expect(modulosVendidosComoPagos().length, 'nenhum módulo pago lido dos cartões').toBeGreaterThan(0)
    expect(rotasDeEscrita().length, 'nenhuma rota de escrita encontrada').toBeGreaterThan(10)
    expect(modulosTravadosNoServidor().size, 'nenhum `exigirModulo` encontrado em rota alguma').toBeGreaterThan(0)
  })

  it('módulo pago sem trava só passa se estiver na lista de dívida conhecida', () => {
    const travados = modulosTravadosNoServidor()
    const semTrava = modulosVendidosComoPagos().filter((m) => !travados.has(m))
    const naoDeclarados = semTrava.filter((m) => !SEM_TRAVA_AINDA.includes(m))

    expect(
      naoDeclarados,
      'estes módulos são anunciados num degrau pago e nenhuma rota de escrita chama `exigirModulo` ' +
        'com eles — qualquer tenant grátis usa à vontade, e quem pagar vai descobrir',
    ).toEqual([])
  })

  it('a lista de dívida só encolhe — módulo já travado não pode continuar nela', () => {
    const travados = modulosTravadosNoServidor()
    const jaResolvidos = SEM_TRAVA_AINDA.filter((m) => travados.has(m))

    expect(
      jaResolvidos,
      'estes módulos já têm `exigirModulo` numa rota de escrita e precisam sair de `SEM_TRAVA_AINDA` — ' +
        'lista de dívida que não encolhe vira decoração e para de significar alguma coisa',
    ).toEqual([])
  })

  it('a lista de dívida não guarda módulo que ninguém vende como pago', () => {
    const pagos = modulosVendidosComoPagos()
    const sobrando = SEM_TRAVA_AINDA.filter((m) => !pagos.includes(m))

    expect(
      sobrando,
      'estes módulos estão na lista de dívida mas não são anunciados em nenhum degrau pago — ' +
        'ou o cartão mudou, ou a lista envelheceu',
    ).toEqual([])
  })
})
