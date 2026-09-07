"use client";

import { useState } from "react";

import Avatar from "@/components/ui/avatar";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Chip from "@/components/ui/chip";
import FilterRow from "@/components/ui/filter-row";
import Sheet from "@/components/ui/sheet";
import StatTile from "@/components/ui/stat-tile";
import AppointmentRow from "@/components/ui/appointment-row";

/**
 * Mesma régua do mockup "Passaram do ponto de voltar" na home (`src/app/page.tsx`): componentes
 * de verdade do painel, dados inventados e avisados como tal na legenda. Não é a rota `/admin`
 * de propósito — expor o admin real sem login para qualquer visitante da página de exemplo
 * abriria uma porta que este produto nunca deveria ter, só para mostrar uma tela.
 *
 * A pergunta que a vitrine responde não é "o que aparece pro cliente" (a `Agendar` já responde
 * isso ao vivo) — é "o que o dono vê quando esse pedido chega", que antes deste ticket era um
 * cartão só. Virou um mini-shell de três abas porque um cartão único não dá "gosto" de produto —
 * é uma foto. Progressive disclosure medido em produtos reais eleva conclusão de fluxo de 53%
 * para 75% quando a pessoa descobre por partes em vez de tudo de uma vez (Chameleon/UXPin); aqui
 * o equivalente é deixar cada aba ser uma decisão pequena de "quero ver mais", não uma parede.
 *
 * As três abas compartilham o mesmo elenco: Ana K., Marcos T., Rafael S. e Pedro L. aparecem
 * hoje na agenda E na lista de clientes — é o MESMO negócio, não três telas soltas. Fernanda,
 * Juliana e Camila (quem sumiu) são as MESMAS três pessoas que a home já mostra na seção
 * "Passaram do ponto de voltar" — quem clicou até aqui vindo de lá reconhece o número.
 *
 * TICKET-UX09: as linhas ganharam um toque que abre mais detalhe, no `Sheet` que o admin de
 * verdade usa — sem isso, cada linha era uma FOTO da informação, e o resto do produto (agenda,
 * recuperar) é feito de linhas que a pessoa abre. "Mexer" é o que separa demo de print.
 */

type AbaInterna = "hoje" | "recuperar" | "clientes";

const ABAS_INTERNAS: { chave: AbaInterna; rotulo: string }[] = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "recuperar", rotulo: "Recuperar" },
  { chave: "clientes", rotulo: "Clientes" },
];

type EstadoDoCiclo = "due" | "late" | "at_risk";

const FILTROS_DE_ESTADO: { valor: EstadoDoCiclo | "all"; rotulo: string }[] = [
  { valor: "all", rotulo: "Todas" },
  { valor: "due", rotulo: "Na hora de voltar" },
  { valor: "late", rotulo: "Atrasadas" },
  { valor: "at_risk", rotulo: "Em risco" },
];

type Atendimento = {
  horario: string;
  clienteNome: string;
  servicoNome: string;
  status: "confirmed" | "pending" | "arrived" | "done";
  altoRisco?: boolean;
  nota: string;
};

const HOJE: Atendimento[] = [
  {
    horario: "09:00",
    clienteNome: "Marcos T.",
    servicoNome: "Corte",
    status: "confirmed",
    nota: "Confirmou pelo WhatsApp assim que o horário abriu. Cliente desde março, 9 visitas.",
  },
  {
    horario: "10:00",
    clienteNome: "Pedro L.",
    servicoNome: "Corte + barba",
    status: "pending",
    altoRisco: true,
    nota: "Ainda não confirmou. Faltou uma vez nas últimas duas marcações, por isso o alerta.",
  },
  {
    horario: "11:30",
    clienteNome: "Ana K.",
    servicoNome: "Platinado",
    status: "arrived",
    nota: "Já chegou e está na cadeira. Cliente fiel, 18 visitas no total.",
  },
  {
    horario: "14:00",
    clienteNome: "Rafael S.",
    servicoNome: "Barba",
    status: "done",
    nota: "Atendimento concluído. Pagou na hora, sem pendência.",
  },
];

const SUMIRAM = [
  { nome: "Fernanda M.", dias: 24, valor: 90, lucro: 63, estado: "late" as const, servico: "Corte + barba" },
  { nome: "Juliana R.", dias: 18, valor: 45, lucro: 31, estado: "due" as const, servico: "Corte" },
  { nome: "Camila S.", dias: 15, valor: 70, lucro: 49, estado: "at_risk" as const, servico: "Platinado" },
];

const CLIENTES = [
  { nome: "Ana K.", ltv: 1240, visitas: 18 },
  { nome: "Marcos T.", ltv: 680, visitas: 9 },
  { nome: "Rafael S.", ltv: 410, visitas: 6 },
  { nome: "Pedro L.", ltv: 150, visitas: 2 },
];

/*
 * Só formatação de exibição para dado inventado desta vitrine — não é o `dinheiro` de
 * `lib/formato.ts` (aquele espera centavos, regra 3 do CLAUDE.md) de propósito: os números aqui
 * nascem em reais inteiros, direto no array acima, e nunca tocam banco nem cálculo de verdade.
 */
const formatarReais = (reais: number) =>
  reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function PainelDoDonoExemplo({ nomeDoSalao }: { nomeDoSalao: string }) {
  const [aba, setAba] = useState<AbaInterna>("hoje");
  const [filtro, setFiltro] = useState<EstadoDoCiclo | "all">("all");
  const [atendimentoAberto, setAtendimentoAberto] = useState<Atendimento | null>(null);
  const [sumiuAberto, setSumiuAberto] = useState<(typeof SUMIRAM)[number] | null>(null);
  /*
   * "Avisar" não manda nada de verdade — não existe credencial de WhatsApp para um estabelecimento
   * que não existe. O botão muda de rótulo por 2 segundos como QUALQUER confirmação de toque
   * (mesmo padrão de `Button carregando`), nunca dizendo "enviado": é o toque que é real, o envio
   * continua sendo o que o produto de verdade faz.
   */
  const [avisado, setAvisado] = useState(false);

  const sumiramFiltrados = filtro === "all" ? SUMIRAM : SUMIRAM.filter((p) => p.estado === filtro);

  return (
    <div className="flex flex-col gap-4">
      <FilterRow rotulo="Trocar de tela">
        {ABAS_INTERNAS.map((opcao) => (
          <Chip key={opcao.chave} ligado={aba === opcao.chave} onClick={() => setAba(opcao.chave)}>
            {opcao.rotulo}
          </Chip>
        ))}
      </FilterRow>

      {aba === "hoje" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
              Hoje, na {nomeDoSalao}
            </p>
            {/*
              O ponto pulsante reforça a frase da legenda ("em tempo real, sem precisar atualizar
              a página") no lugar onde a pessoa está olhando, não só no rodapé em letra miúda.
              `aria-hidden`: é reforço visual, o texto ao lado já diz a mesma coisa por extenso.
            */}
            <span className="flex items-center gap-1.5 text-label text-txt-3">
              <span aria-hidden className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-ok" />
              </span>
              ao vivo
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile rotulo="Ocupação do dia" valor="72%" progresso={0.72} />
            <StatTile rotulo="Previsto" valor="R$ 340" heroi />
          </div>

          <ul className="flex flex-col gap-2">
            {HOJE.map((a) => (
              <li key={a.horario}>
                <button
                  type="button"
                  onClick={() => {
                    setSumiuAberto(null);
                    setAtendimentoAberto(a);
                  }}
                  className="block w-full text-left"
                >
                  <AppointmentRow
                    horario={a.horario}
                    clienteNome={a.clienteNome}
                    servicoNome={a.servicoNome}
                    status={a.status}
                    altoRisco={a.altoRisco}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {aba === "recuperar" ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile rotulo="Dá para recuperar" valor="R$ 1.840" apoio="23 clientes" />
            <StatTile rotulo="Clientes" valor="23" />
          </div>

          <FilterRow rotulo="Filtrar por estado do ciclo">
            {FILTROS_DE_ESTADO.map((f) => (
              <Chip key={f.valor} ligado={filtro === f.valor} onClick={() => setFiltro(f.valor)}>
                {f.rotulo}
              </Chip>
            ))}
          </FilterRow>

          {sumiramFiltrados.length === 0 ? (
            <p className="py-6 text-center text-secundario text-txt-2">Ninguém nesse filtro agora.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sumiramFiltrados.map((p) => (
                <li key={p.nome}>
                  <button
                    type="button"
                    onClick={() => {
                      setAtendimentoAberto(null);
                      setAvisado(false);
                      setSumiuAberto(p);
                    }}
                    className="block w-full text-left"
                  >
                    <Card pressionavel className="flex items-center gap-3">
                      <Avatar nome={p.nome} tamanho="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-corpo font-semibold">{p.nome}</p>
                        <p className="text-label text-txt-3">{p.dias} dias sem voltar</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-corpo font-bold text-acc-2">{formatarReais(p.valor)}</p>
                        <p className="tabular text-label text-txt-3">{formatarReais(p.lucro)} de lucro</p>
                      </div>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {aba === "clientes" ? (
        <ul className="flex flex-col gap-2">
          {CLIENTES.map((c) => (
            <li key={c.nome}>
              <Card className="flex items-center gap-3">
                <Avatar nome={c.nome} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-corpo font-semibold">{c.nome}</p>
                  <p className="text-label text-txt-3">
                    {c.visitas} {c.visitas === 1 ? "visita" : "visitas"}
                  </p>
                </div>
                <p className="tabular shrink-0 text-corpo font-semibold">{formatarReais(c.ltv)}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-label text-txt-3">
        Exemplo de como as telas ficam. Os nomes e os valores são inventados; é o mesmo painel que
        recebe cada pedido feito ao lado, em tempo real, sem precisar atualizar a página.
      </p>

      <Sheet
        aberto={!!atendimentoAberto}
        aoFechar={(aberto) => !aberto && setAtendimentoAberto(null)}
        titulo={atendimentoAberto?.clienteNome ?? ""}
        descricao={atendimentoAberto ? `${atendimentoAberto.servicoNome} · ${atendimentoAberto.horario}` : undefined}
      >
        {atendimentoAberto ? <p className="text-corpo text-txt-2">{atendimentoAberto.nota}</p> : null}
      </Sheet>

      <Sheet
        aberto={!!sumiuAberto}
        aoFechar={(aberto) => !aberto && setSumiuAberto(null)}
        titulo={sumiuAberto?.nome ?? ""}
        descricao={sumiuAberto ? `Última vez: ${sumiuAberto.servico}, há ${sumiuAberto.dias} dias` : undefined}
      >
        {sumiuAberto ? (
          <div className="flex flex-col gap-4">
            <p className="text-corpo text-txt-2">
              Preço do serviço multiplicado pela chance de ela voltar. Quanto mais tempo sem
              aparecer, menor a chance: é por isso que o valor cai com os dias.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-2 p-3">
              <div>
                <p className="tabular text-titulo font-bold text-acc-2">{formatarReais(sumiuAberto.valor)}</p>
                <p className="text-label text-txt-3">{formatarReais(sumiuAberto.lucro)} de lucro estimado</p>
              </div>
              <Button onClick={() => setAvisado(true)}>Avisar</Button>
            </div>
            {/*
              O toque É real (o estado muda); o que NÃO acontece é o envio — não existe credencial
              de WhatsApp para um estabelecimento que não existe. Dizer isso aqui, em vez de trocar
              o rótulo do botão para algo como "Enviado", é o que separa reforçar a funcionalidade
              de fingir o resultado dela.
            */}
            {avisado ? (
              <p role="status" className="text-secundario text-txt-2">
                Numa conta de verdade, é isto que manda a mensagem agora. Aqui é só demonstração.
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
