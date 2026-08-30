import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { availableSlots } from '@/core/scheduling/available-slots'

/**
 * Achado da auditoria de 2026-08-28 — a promessa que o banco recusa.
 *
 * `services.parallel_capacity` existe desde a 0001 (1 a 20, validado no Zod), `availableSlots` o
 * honra, e o §5.5 explica o caso de uso: secagem de esmalte, um profissional atendendo mais de uma
 * cliente ao mesmo tempo. Só que o banco tem isto, e é da mesma migration:
 *
 * ```sql
 * alter table appointments add constraint appointments_no_overlap
 *   exclude using gist (professional_id with =, period with &&)
 *   where (status in ('pending','confirmed','arrived'));
 * ```
 *
 * A restrição não sabe o que é capacidade: ela proíbe QUALQUER sobreposição do mesmo profissional.
 * Então, com capacidade 2, a disponibilidade oferece o mesmo horário para uma segunda cliente e o
 * `insert` bate na constraint (`23P01`), que o app traduz para `SLOT_TAKEN` — "esse horário acabou
 * de ser reservado", num horário que o salão abriu de propósito.
 *
 * **Por que ninguém viu:** o formulário de serviço não expõe o campo (o comentário em
 * `config/servicos/formulario.tsx` lista "sinal/capacidade paralela/anamnese" como o que ficou de
 * fora). Só quem chama a API direto consegue passar de 1. É armadilha, não incêndio — e a
 * armadilha dispara no dia em que alguém completar o formulário, que é um passo óbvio.
 *
 * Esta guarda é de mão dupla: enquanto o banco não souber contar capacidade, o formulário não pode
 * oferecer o campo; e a restrição de sobreposição não pode sumir — sem ela, a corrida que ela
 * resolve volta, e aí o problema deixa de ser agenda vazia e passa a ser cliente em dobro.
 */

const MIGRATIONS = 'supabase/migrations'
const FORM_SERVICO = 'src/app/admin/config/servicos/formulario.tsx'

const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join(String.fromCharCode(10))

const semComentariosSql = sql
  .split(String.fromCharCode(10))
  .filter((l) => !l.trim().startsWith('--'))
  .join(String.fromCharCode(10))

/** O banco sabe contar capacidade? Hoje não — nada liga `parallel_capacity` a `appointments`. */
const BANCO_SABE_CAPACIDADE =
  /parallel_capacity/.test(semComentariosSql) &&
  /appointments/.test(semComentariosSql) &&
  /(create (or replace )?(trigger|function)[\s\S]{0,600}parallel_capacity)/i.test(semComentariosSql)

describe('a leitura das migrations', () => {
  it('não voltou vazia', () => {
    expect(semComentariosSql.length, 'nenhuma migration lida').toBeGreaterThan(10_000)
    expect(semComentariosSql, 'a coluna parallel_capacity sumiu do schema').toMatch(/parallel_capacity/)
  })
})

describe('capacidade paralela: o app não promete o que o banco recusa', () => {
  it('a restrição de sobreposição continua existindo e sem exceção por capacidade', () => {
    // Se ela sumir, o problema inverte: em vez de agenda vazia, cliente marcada em dobro.
    expect(
      /exclude using gist \(professional_id with =, period with &&\)/i.test(semComentariosSql),
      'appointments_no_overlap sumiu ou mudou de forma — sem ela, a corrida de agendamento volta',
    ).toBe(true)
  })

  it('enquanto o banco não contar capacidade, o formulário de serviço não oferece o campo', () => {
    if (BANCO_SABE_CAPACIDADE) return
    const form = readFileSync(FORM_SERVICO, 'utf8')
      .replace(/[{][/][*][\s\S]*?[*][/][}]/g, ' ')
      .replace(/[/][*][\s\S]*?[*][/]/g, ' ')
      .replace(/^\s*[/][/].*$/gm, ' ')
    expect(
      /parallelCapacity/.test(form),
      'o formulário passou a oferecer capacidade paralela, e `appointments_no_overlap` continua ' +
        'proibindo qualquer sobreposição do mesmo profissional. O salão configuraria capacidade 2, ' +
        'a disponibilidade ofereceria o horário, e o insert responderia SLOT_TAKEN num horário que ' +
        'o próprio salão abriu. Ou o banco aprende a contar, ou o campo não existe.',
    ).toBe(false)
  })

  it('se o banco aprender a contar, a disponibilidade continua honrando a capacidade', () => {
    // O outro lado: no dia em que a restrição souber contar, este comportamento é o que precisa
    // estar de pé — e ele é o que o §5.5 promete.
    const slots = availableSlots({
      date: '2026-08-20',
      timezone: 'America/Sao_Paulo',
      businessHours: [{ opensAt: '09:00', closesAt: '18:00' }],
      timeOff: [],
      appointments: [{ start: '2026-08-20T13:00:00Z', end: '2026-08-20T14:00:00Z' }],
      serviceDurationMin: 60,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      slotGranularityMin: 60,
      minLeadTimeMinutes: 0,
      maxAdvanceDays: 60,
      now: '2026-08-01T12:00:00Z',
      parallelCapacity: 2,
    })
    // O horário TOMADO precisa continuar na lista — `slots.length > 0` passaria só porque o resto
    // do dia está livre, que é o defeito passando verde.
    const dezHorasLocal = slots.filter((s) => s.startsWith('2026-08-20T13:00'))
    expect(
      dezHorasLocal,
      'a disponibilidade deixou de honrar parallelCapacity: o horário com UMA cliente marcada ' +
        'sumiu, mesmo com capacidade 2',
    ).toHaveLength(1)
  })
})
