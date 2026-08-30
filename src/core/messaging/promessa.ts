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

/**
 * O estado do interruptor "Lembretes e campanhas automáticos" (`config/mensagens`), pelo mesmo
 * motivo da função acima: **um lugar só** decide se o produto pode dizer que algo sai sozinho.
 *
 * Achado em 2026-08-30, medindo a tela em produção: o rótulo de "ligado" era prosa escrita à mão
 * dentro de `pausar-envios.tsx` e afirmava *"lembrete de agendamento e campanha de recuperação
 * saem sozinhos, no horário certo"*. Isso é falso desde sempre — `reminders` e `campaigns` estão
 * fora de `ROTAS_AGENDADAS` (o job agendado do `cron.yml` roda só `recompute-cycles` e
 * `segments`, com comentário explícito de que nenhum deles fala com o mundo externo).
 *
 * É a MESMA armadilha do `CLAUDE.md` que esta função existe para fechar — "prometer canal só se
 * houver rota agendada" — só que virada para dentro: quem foi enganado aqui não é a cliente do
 * salão, é o **dono do salão**, que confia que o produto está trabalhando por ele enquanto nada
 * sai. A guarda `promessa-de-canal.test.ts` passava verde porque exercita esta função, e esta
 * tela nunca a consultava: guarda não alcança quem não a chama.
 *
 * `pausado` vence `agendada`: pausa é escolha explícita do dono e vale nos dois mundos.
 */
export function textoDoEnvioAutomatico(
  pausado: boolean,
  remindersAgendada: boolean = rodaSozinha('reminders'),
): string {
  // As duas frases honestas evitam de propósito a construção "sai sozinho", MESMO NEGANDO. A
  // guarda proíbe o conceito e não sabe ler negação — "nada sai sozinho ainda" reprovava junto
  // com a mentira que ela existe para pegar. Dá para ensinar a regex a entender "nada"/"não",
  // mas negação em português tem forma demais para uma lista fechada (é a lição registrada logo
  // acima). Mais barato e mais firme: a copy verdadeira não encosta na construção proibida.
  if (pausado) return 'Pausado — nenhuma mensagem para cliente parte do CICLO enquanto estiver assim.'
  return remindersAgendada
    ? 'Ligado — lembrete de agendamento e campanha de recuperação saem sozinhos, no horário certo.'
    : // Sem afirmar disparo automático, e sem virar silêncio: o dono precisa saber que a mensagem
      // depende dele hoje, ou vai esperar por um envio que não vem. O caminho real é tocar em
      // "Avisar" (tela Recuperar) ou "Mensagem" (ficha da cliente), que abrem o WhatsApp.
      'Liberado — mas o disparo é seu: a mensagem vai quando você toca em "Avisar", pelo WhatsApp.'
}
