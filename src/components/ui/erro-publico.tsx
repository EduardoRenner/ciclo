import { XCircle } from 'lucide-react'

import Button from '@/components/ui/button'

/**
 * A tela de erro das quatro páginas que a CLIENTE DO SALÃO abre pelo link do WhatsApp:
 * confirmação de agendamento, avaliação, encaixe da lista de espera e orçamento.
 *
 * As quatro tinham o mesmo desenho e o mesmo defeito, medido no navegador em 2026-09-03: ícone,
 * título, a mensagem da rota, e **nada mais**. Duas consequências diferentes, e as duas caem no
 * salão e não no CICLO:
 *
 *   - **link recusado** (4xx): a pessoa lê "esse link não é mais válido", não tem ideia do que
 *     fazer, e some. O horário fica sem confirmação, a avaliação não é deixada, o orçamento não é
 *     respondido — e o salão conclui que ela ignorou a mensagem;
 *   - **rede caída**: uma piscada de 4G no meio do toque levava ao MESMO beco, sem botão nenhum,
 *     num caso em que tentar de novo resolveria. A única saída era ela saber recarregar a página.
 *
 * A regra do `CLAUDE.md` é que erro explique **o que fazer**; a mensagem sozinha explica só o que
 * houve. Este componente existe para que a resposta a essa regra seja UMA, e não quatro que
 * divergem — foi consertar uma tela por vez que produziu o problema.
 *
 * `podeTentarDeNovo` é decidido por quem chama, pelo STATUS da resposta: 5xx e falha de rede são
 * transitórios; 4xx é recusa, e oferecer "tentar de novo" ali é um botão que só repete o não.
 */
export default function ErroPublico({
  titulo,
  mensagem,
  aoTentarDeNovo,
}: {
  titulo: string
  /** A mensagem da rota. Diz o que houve. */
  mensagem: string
  /**
   * Só quando a falha é transitória. Ausente = recusa definitiva, e a tela mostra a orientação
   * em texto no lugar do botão: o produto não sabe o slug do salão neste estado (o token foi
   * recusado, não há de onde tirar), e um link para lugar nenhum é pior que uma frase útil.
   */
  aoTentarDeNovo?: () => void
}) {
  return (
    <>
      <XCircle aria-hidden className="mb-4 size-14 text-bad" />
      <p className="text-titulo font-bold">{titulo}</p>
      <p className="mt-2 text-corpo text-txt-2">{mensagem}</p>
      {aoTentarDeNovo ? (
        <Button largura="cheia" className="mt-6" onClick={aoTentarDeNovo}>
          Tentar de novo
        </Button>
      ) : (
        <p className="mt-4 text-secundario text-txt-3">
          Chame quem vai te atender pelo WhatsApp: por lá dá para resolver na hora.
        </p>
      )}
    </>
  )
}
