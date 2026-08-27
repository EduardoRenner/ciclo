import { rodaSozinha } from '@/core/cron/agendadas'

/**
 * A frase que diz ao cliente do tenant PARA QUE serve o telefone dele — e a razão de ela ser
 * função em vez de prosa na tela.
 *
 * O `CLAUDE.md` tem uma linha na tabela de armadilhas: *"Prometer canal ('vai receber por
 * WhatsApp') — só se houver rota agendada e credencial existente. A promessa mais cara é a da
 * página do cliente do tenant: quem fica mal é o salão, não o CICLO."*
 *
 * Essa promessa já foi tirada uma vez, da TELA DE SUCESSO de `[slug]/agendar` — com comentário
 * longo explicando por que era falsa em três níveis. E sobreviveu, intacta, no rótulo de ajuda do
 * campo de telefone **um componente acima** ("É por aqui que a confirmação chega"), onde ficou no
 * ar até 2026-08-27.
 *
 * A guarda que existia (`agendamento-publico-nao-promete-demais.test.ts`) passava verde: ela
 * proibia QUATRO redações conhecidas, e esta era uma quinta. Lista fechada de sinônimos não fecha
 * um conceito aberto — sempre há um sexto jeito de dizer a mesma coisa.
 *
 * Por isso a copy deixa de ser prosa e vira retorno de função, no mesmo padrão que `NOME_DO_PLANO`
 * usou para preço e `ROTAS_AGENDADAS` para a lista de cron: **um lugar só**. Não há onde uma sexta
 * frase nascer, e no dia em que `reminders` entrar no `schedule` a frase verdadeira volta em todas
 * as telas de uma vez, sem ninguém caçar string.
 *
 * O parâmetro existe para o teste poder exercitar os dois lados sem mexer no `cron.yml` — mesmo
 * padrão do `segredo` opcional de `gerarTokenAssinado`.
 */
export function textoDoCanalDeConfirmacao(remindersAgendada: boolean = rodaSozinha('reminders')): string {
  return remindersAgendada
    ? 'É por aqui que a confirmação chega.'
    : // Verdade hoje: `criarAgendamentoPublico` manda push para a EQUIPE, e é uma pessoa que
      // retorna. A tela de sucesso já diz isso ("A confirmação vem de quem vai te atender"); esta
      // frase é a mesma promessa, no tempo certo — sem afirmar chegada automática.
      'É por aqui que quem vai te atender fala com você.'
}
