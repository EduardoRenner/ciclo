/**
 * O banco de produção está atrás do código? — a pergunta que ninguém fazia.
 *
 * Em 05/09/2026 as migrations `0059`, `0060` e `0061` estavam no `main`, com o código que depende
 * delas no ar, e nenhuma aplicada em produção. Quem pedisse orçamento pela página pública levava
 * erro (`professional_id not null` + CHECK antigo em `quotes.status`), e o `vocab` de 10 profissões
 * seguia só no masculino. Nada ficou vermelho: `typecheck`, `lint`, os 1.750 testes e o CI inteiro
 * rodam contra um Supabase LOCAL, que aplica as migrations do disco em toda execução. O local
 * estava sempre certo — e por isso nenhuma guarda podia ver o defeito.
 *
 * A causa a montante era uma promessa falsa: o `docs/05-FAQ-DEV.md` B24 dizia que uma GitHub Action
 * roda `supabase db push` antes do deploy. Ela nunca existiu. Corrigir o texto era metade; a outra
 * metade é esta, porque texto não reprova ninguém.
 *
 * **Por que a constante mora aqui e não é lida do disco:** o bundle da Vercel não carrega
 * `supabase/`, então em produção não há diretório para contar. É o mesmo motivo, e a mesma
 * armadilha, de `core/cron/agendadas.ts` — cópia sem guarda apodrece. Quem confere a cópia contra
 * o disco é `tests/unit/core/schema-esperado-bate-com-o-disco.test.ts`, nas duas direções.
 */

/** Quantos arquivos existem em `supabase/migrations/`. O teste confere contra o disco. */
export const MIGRATIONS_ESPERADAS = 84

/** O nome (sem `.sql`) do arquivo de maior número. O teste confere contra o disco. */
export const ULTIMA_MIGRATION = '0084_dado_de_saude_e_consentimento_nao_se_apagam'

export type EstadoDoSchema = {
  ok: boolean
  detail?: string
}

/**
 * Compara o que o banco diz ter aplicado com o que este código espera.
 *
 * As duas direções não valem o mesmo, e é por isso que só uma fica vermelha:
 *
 * - **Banco ATRÁS do código** é o caso que já custou caro: o código chama coluna, CHECK ou função
 *   que não existe, e o erro aparece para a cliente final, não para quem publicou. Fica `ok:
 *   false`, o `/api/health` devolve 503 e o job `vigia` do `cron.yml` fica vermelho no e-mail.
 * - **Banco À FRENTE do código** é a ordem normal de uma publicação segura (migration aditiva
 *   primeiro, deploy depois) e é o estado esperado durante a janela entre as duas. Marcar isso como
 *   falha ensinaria a fazer na ordem perigosa, e ainda transformaria toda publicação em alarme —
 *   o que `core/cron/agendadas.ts` proíbe por já ter custado dois dias de silêncio.
 */
/**
 * O livro de migrations guarda o nome em DOIS formatos, e a diferença é quem aplicou.
 *
 * O CLI da Supabase (`supabase db push`, `supabase start`, `db reset`) parte o arquivo em duas
 * colunas: `version` recebe o prefixo numérico e `name` recebe só o resto — `0080_historico_...`
 * vira `name = 'historico_...'`. Quem aplica À MÃO pelo SQL Editor escreve o `insert` inteiro, e
 * ali o costume desta casa foi gravar o nome completo, COM prefixo (`docs/runbooks/aplicar-
 * migrations-pendentes.md`).
 *
 * Produção nasceu do segundo jeito e por isso a comparação funcionava. Medido em 2026-09-10 num
 * Supabase local recém-criado pelo CLI, com as 80 migrations aplicadas: `/api/health` respondia
 * **503 dizendo "banco ATRÁS do código: falta a 0080"**, porque `includes` procurava
 * `0080_historico_...` numa lista que só tinha `historico_...`.
 *
 * O estrago não é local: no primeiro `supabase db push` em produção, a migration nova entra SEM
 * prefixo, `ULTIMA_MIGRATION` deixa de casar, e o `/api/health` vira 503 logo depois de uma
 * publicação CORRETA — com o job `vigia` do `cron.yml` vermelho e o banco em dia.
 *
 * Comparar sem o prefixo aceita os dois formatos e não perde poder: o prefixo é ordenação, o nome
 * é a identidade, e dois arquivos nunca compartilham o nome.
 */
function semPrefixo(nome: string): string {
  return nome.replace(/^\d+_/, '')
}

export function compararSchema(aplicadas: readonly string[]): EstadoDoSchema {
  const total = aplicadas.length
  const alvo = semPrefixo(ULTIMA_MIGRATION)
  const temAUltima = aplicadas.some((a) => semPrefixo(a) === alvo)

  /*
   * Faltando a última E o total abaixo do esperado são checados separados de propósito: aplicar a
   * última pulando uma do meio deixa o total curto com a última presente, e é justamente o caso que
   * um "olha só a mais recente" não veria. Nomes têm prefixo com zero à esquerda, então a
   * comparação de texto ordena igual ao número.
   */
  if (!temAUltima || total < MIGRATIONS_ESPERADAS) {
    const faltando = MIGRATIONS_ESPERADAS - total
    const oQue = temAUltima
      ? `${faltando} migration(s) do meio não foram aplicadas`
      : `falta a ${ULTIMA_MIGRATION}${faltando > 1 ? ` e mais ${faltando - 1}` : ''}`
    return {
      ok: false,
      detail: `banco ATRÁS do código: ${oQue} (${total} aplicadas, ${MIGRATIONS_ESPERADAS} esperadas). O código no ar depende delas. Aplicar com \`supabase db push\` — não existe Action que faça isso sozinha.`,
    }
  }

  if (total > MIGRATIONS_ESPERADAS) {
    return {
      ok: true,
      detail: `banco à frente do código: ${total} aplicadas contra ${MIGRATIONS_ESPERADAS} esperadas. É a ordem segura de publicar (migration antes do deploy); vira problema só se o deploy não vier.`,
    }
  }

  return { ok: true }
}
