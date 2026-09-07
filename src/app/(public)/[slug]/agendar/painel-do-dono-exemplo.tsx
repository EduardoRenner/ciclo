import StatTile from "@/components/ui/stat-tile";
import AppointmentRow from "@/components/ui/appointment-row";

/**
 * Mesma régua do mockup "Passaram do ponto de voltar" na home (`src/app/page.tsx`): componentes
 * de verdade do painel, dados inventados e avisados como tal na legenda. Não é a rota `/admin`
 * de propósito — expor o admin real sem login para qualquer visitante da página de exemplo
 * abriria uma porta que este produto nunca deveria ter, só para mostrar uma tela.
 *
 * A pergunta que a vitrine responde não é "o que aparece pro cliente" (a `Agendar` já responde
 * isso ao vivo) — é "o que o dono vê quando esse pedido chega", que hoje só existia em prosa.
 */
export default function PainelDoDonoExemplo({ nomeDoSalao }: { nomeDoSalao: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
          Hoje, na {nomeDoSalao}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile rotulo="Ocupação do dia" valor="72%" progresso={0.72} />
        <StatTile rotulo="Previsto" valor="R$ 340" heroi />
      </div>

      <ul className="flex flex-col gap-2">
        <li>
          <AppointmentRow horario="09:00" clienteNome="Marcos T." servicoNome="Corte" status="confirmed" />
        </li>
        <li>
          <AppointmentRow horario="10:00" clienteNome="Pedro L." servicoNome="Corte + barba" status="pending" altoRisco />
        </li>
        <li>
          <AppointmentRow horario="11:30" clienteNome="Ana K." servicoNome="Platinado" status="arrived" />
        </li>
        <li>
          <AppointmentRow horario="14:00" clienteNome="Rafael S." servicoNome="Barba" status="done" />
        </li>
      </ul>

      <p className="text-label text-txt-3">
        Exemplo de como a tela fica. Os nomes e os valores são inventados; é a mesma tela que
        recebe cada pedido feito ao lado, em tempo real, sem precisar atualizar a página.
      </p>
    </div>
  );
}
