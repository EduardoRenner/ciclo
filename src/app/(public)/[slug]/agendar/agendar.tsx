"use client";

import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Chip from "@/components/ui/chip";
import FilterRow from "@/components/ui/filter-row";
import Input from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import { textoDoCanalDeConfirmacao } from "@/core/messaging/promessa";
import { montarIcs, type EventoIcs } from "@/core/scheduling/ics";
import { dinheiro, duracao } from "@/lib/formato";

type Servico = {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
};
type Profissional = { id: string; displayName: string };
type Slot = { startsAt: string; endsAt: string; professionalId: string };

/**
 * "Hoje" é no fuso do salão, não no do aparelho de quem agenda. A versão
 * anterior montava a lista com `toISOString()`, que é UTC: das 21h à meia-noite
 * em Brasília a coluna de hoje sumia do trilho, e um salão que atende de
 * madrugada perdia o próprio dia.
 */
function hojeNoSalao(timezone: string): string {
  // `en-CA` formata como `AAAA-MM-DD`, que é exatamente o formato que a API espera.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(),
  );
}

/** 14 dias corridos a partir de hoje — cobre o horizonte real de quem agenda pelo site, sem paginação. */
function proximosDias(qtd: number, primeiro: string): string[] {
  const [ano, mes, dia] = primeiro.split("-").map(Number);
  return Array.from({ length: qtd }, (_, i) => {
    const d = new Date(Date.UTC(ano!, mes! - 1, dia!));
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** `AAAA-MM-DD` vira data em UTC de propósito: só serve para dizer o dia da semana e o número. */
function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano!, mes! - 1, dia!));
}

function diaDaSemana(iso: string): number {
  return paraData(iso).getUTCDay();
}

/** Minutos desde a meia-noite, no relógio do salão. */
function agoraEmMinutos(timezone: string): number {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return valor("hour") * 60 + valor("minute");
}

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

function horaLocal(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function periodo(iso: string, timezone: string): "Manhã" | "Tarde" | "Noite" {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(new Date(iso)),
  );
  if (hora < 12) return "Manhã";
  if (hora < 18) return "Tarde";
  return "Noite";
}

/**
 * A montagem do arquivo é pura e mora em `src/core` (regra 5 do CLAUDE.md), com teste próprio;
 * aqui fica só a parte que precisa do navegador. Verificado ao vivo que a CSP do TICKET-057 não
 * bloqueia download por `blob:` — `default-src 'self'` governa busca de recurso, não o download
 * que a própria página dispara.
 */
function baixarIcs(evento: Omit<EventoIcs, "agora">): void {
  const blob = new Blob(
    [montarIcs({ ...evento, agora: new Date().toISOString() })],
    {
      type: "text/calendar;charset=utf-8",
    },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${evento.slug}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Numerar os passos foi o que faltava: eram quatro escolhas numa página rolante, sem nenhum sinal de progresso. */
function Passo({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
      <span className="grid size-5 place-items-center rounded-[var(--radius-pill)] bg-surface-3 text-label font-bold text-txt-2">
        {numero}
      </span>
      {titulo}
    </h2>
  );
}

export default function Agendar({
  slug,
  nomeDoSalao,
  enderecoDoSalao,
  timezone,
  hours,
  services,
  professionals,
  ind,
  indicadaPor,
}: {
  slug: string;
  nomeDoSalao: string;
  /** Vira o `LOCATION` do arquivo de calendário — sem ele o evento não diz onde é. */
  enderecoDoSalao: string | null;
  timezone: string;
  hours: { weekday: number; opensAt: string; closesAt: string }[];
  services: Servico[];
  professionals: Profissional[];
  /** Token de `?ind=` (I-1) — repassado cru ao `POST book`, que confere e resolve sozinho. */
  ind: string | null;
  /** I-4: primeiro nome de quem indicou, já resolvido no servidor. `null` = sem convite válido. */
  indicadaPor: string | null;
}) {
  const dias = useMemo(
    () => proximosDias(14, hojeNoSalao(timezone)),
    [timezone],
  );

  const diasFechados = useMemo(() => {
    const abertos = new Set(hours.map((h) => h.weekday));
    // Sem expediente cadastrado não dá para afirmar que algum dia está fechado —
    // nesse caso nenhum dia recebe a marca, e o trilho fica como era.
    return hours.length === 0
      ? new Set<string>()
      : new Set(dias.filter((d) => !abertos.has(diaDaSemana(d))));
  }, [dias, hours]);

  /*
   * Abrir no primeiro dia em que o salão atende, não em "hoje" seco: numa
   * barbearia fechada domingo e segunda, quem entrasse no sábado à noite via
   * "Sem horários livres nesse dia" antes de qualquer outra coisa — que lê como
   * "está lotado" e não como "hoje não abre". O dia fechado continua no trilho e
   * continua clicável (a agenda de um profissional pode fugir do expediente
   * padrão); só deixa de ser a primeira impressão.
   */
  const primeiroDiaUtil = useMemo(() => {
    const hoje = dias[0];
    const blocosDeHoje = hoje
      ? hours.filter((h) => h.weekday === diaDaSemana(hoje))
      : [];
    const jaFechouHoje =
      blocosDeHoje.length > 0 &&
      blocosDeHoje.every(
        (h) => paraMinutos(h.closesAt) <= agoraEmMinutos(timezone),
      );
    const candidatos = jaFechouHoje ? dias.slice(1) : dias;
    return candidatos.find((d) => !diasFechados.has(d)) ?? dias[0] ?? "";
  }, [dias, diasFechados, hours, timezone]);

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [dia, setDia] = useState(primeiroDiaUtil);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotEscolhido, setSlotEscolhido] = useState<Slot | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  // docs/09-PLATAFORMA.md G3+G13 (P2.5): opcional pra qualquer negócio, não só
  // pra quem "vai até o cliente" — sem geocodificação, é só texto.
  const [endereco, setEndereco] = useState("");
  // Honeypot: campo real no DOM, invisível só por CSS/posição — um preenchimento
  // automatizado de formulário não pula isso, um humano nunca o vê.
  const [website, setWebsite] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  const servicoEscolhido = services.find((s) => s.id === serviceId);

  // Carrega os horários do primeiro dia sozinho — a versão anterior exigia
  // um toque em "Ver horários" antes de mostrar qualquer coisa; o Ruivo (o
  // modelo pedido) já carrega automático. Só na montagem, de propósito.
  useEffect(() => {
    if (primeiroDiaUtil && serviceId) buscarDisponibilidade(primeiroDiaUtil);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscarDisponibilidade(novoDia: string, novoServico?: string) {
    setDia(novoDia);
    setSlots(null);
    setSlotEscolhido(null);
    setErro(null);
    iniciarTransicao(async () => {
      /*
        O `try` não é zelo, é o que impede a tela inteira de sumir. Medido no navegador em
        2026-08-25: no React 19 uma Action que rejeita é RE-LANÇADA para o error boundary, então
        um `fetch` que falha aqui não vira mensagem — derruba a página e leva junto o serviço, o
        profissional e o dia que a pessoa já tinha escolhido. Numa rede de subsolo, que é o
        cenário declarado do produto (§10), isso acontece por uma piscada.

        Falha de REDE é diferente de resposta de erro do servidor, e o texto diz qual é qual: uma
        pede para conferir a conexão, a outra repassa o motivo que o servidor deu.
      */
      try {
        const params = new URLSearchParams({
          serviceId: novoServico ?? serviceId,
          date: novoDia,
        });
        if (professionalId) params.set("professionalId", professionalId);
        const r = await fetch(
          `/api/v1/public/${slug}/availability?${params.toString()}`,
        );
        const json = (await r.json()) as {
          data?: { slots: Slot[] };
          error?: { message: string };
        };
        if (!r.ok) {
          setErro(json.error?.message ?? "Não consegui buscar horários.");
          return;
        }
        setSlots(json.data?.slots ?? []);
      } catch {
        /*
          NÃO `setSlots([])` aqui — foi o que a primeira versão deste catch fez, e a verificação no
          navegador pegou: com a lista vazia, a região viva passava a anunciar "Sem horários livres
          nesse dia", que é MENTIRA quando o que houve foi a rede cair. Podem existir dez horários;
          ninguém sabe. Afirmar ao leitor de tela o que não se sabe é o mesmo defeito que esta
          auditoria persegue, cometido dentro do conserto dele.
        */
        setErro(
          "Não consegui falar com o servidor. Confira a conexão e toque no dia de novo.",
        );
      }
    });
  }

  function escolherServico(id: string) {
    setServiceId(id);
    setSlots(null);
    setSlotEscolhido(null);
    buscarDisponibilidade(dia, id);
  }

  function confirmar() {
    if (!slotEscolhido) return;
    setErro(null);
    iniciarTransicao(async () => {
      /*
        Aqui a queda dói mais que na busca: a pessoa já preencheu nome e telefone, e o error
        boundary leva tudo. Ela não sabe se o horário foi marcado ou não — e no público não há
        fila offline para reenviar (o `apiFetch` de `lib/offline` enfileira, mas devolve só
        `{queued}`, sem o corpo da resposta, e este fluxo precisa distinguir SLOT_TAKEN).

        Por isso o texto do catch não diz "tente de novo" e pronto: diz para conferir se o
        horário apareceu, porque a requisição pode ter chegado antes de a resposta se perder.
      */
      try {
        const r = await fetch(`/api/v1/public/${slug}/book`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            serviceId,
            professionalId: slotEscolhido.professionalId,
            startsAt: slotEscolhido.startsAt,
            name: nome,
            phone: telefone,
            address: endereco.trim() || undefined,
            website: website || undefined,
            ind: ind || undefined,
          }),
        });
        const json = (await r.json()) as {
          error?: {
            code: string;
            message: string;
            details?: { alternatives?: string[] };
          };
        };
        if (!r.ok) {
          if (json.error?.code === "SLOT_TAKEN") {
            setErro("Esse horário acabou de ser reservado. Escolha outro.");
            buscarDisponibilidade(dia);
            return;
          }
          setErro(
            json.error?.message ?? "Não consegui confirmar. Tente de novo.",
          );
          return;
        }
        setConfirmado(true);
      } catch {
        setErro(
          "Não consegui falar com o servidor. Confira a conexão e tente de novo — se o horário já tiver sido marcado, ele aparece ao escolher o dia outra vez.",
        );
      }
    });
  }

  if (confirmado) {
    /*
      A tela de sucesso não repetia NADA do que a pessoa acabou de escolher —
      nem dia, nem hora, nem com quem. É o único momento em que ela confere se
      marcou o que queria, e era também o único lugar do funil sem saída: sem
      recibo e sem caminho de volta para o site do salão.
    */
    const profissional = professionals.find(
      (p) => p.id === slotEscolhido?.professionalId,
    )?.displayName;

    return (
      <Card className="flex flex-col items-center py-10 text-center">
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <p className="text-titulo font-bold">Agendamento enviado!</p>

        {slotEscolhido && servicoEscolhido ? (
          <div className="mt-4 w-full max-w-xs rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 p-4 text-left">
            <p className="text-corpo font-semibold text-txt">
              {servicoEscolhido.name}
            </p>
            <p className="mt-1 text-secundario text-txt-2">
              {paraData(dia).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                timeZone: "UTC",
              })}
              {" às "}
              {horaLocal(slotEscolhido.startsAt, timezone)}
            </p>
            {profissional ? (
              <p className="mt-0.5 text-secundario text-txt-2">
                com {profissional}
              </p>
            ) : null}
          </div>
        ) : null}

        {/*
          A frase anterior prometia "você vai receber a confirmação por WhatsApp", e isso era falso
          em três níveis: `criarAgendamentoPublico` não manda nada para o cliente (só um push para
          a equipe); quem mandaria é o cron `reminders`, que está fora do `schedule` de propósito;
          e o WhatsApp não tem credencial — sendo que este formulário nem coleta e-mail, então o
          fallback também não alcança ninguém. Nada chegava, nunca.

          Aqui a mentira custa mais caro que na landing: quem fica mal com um cliente esperando
          confirmação que não vem não é o CICLO, é o salão que confiou nele.

          O que a página diz agora é o que de fato acontece — o pedido chega para a equipe, e uma
          pessoa confirma. Sem prometer canal, e mantendo o caminho de saída (telefone), porque
          tirar a promessa falsa não pode virar silêncio sobre o que fazer.

          Guardado por `tests/unit/design/agendamento-publico-nao-promete-demais.test.ts`, que
          libera a frase de canal sozinho no dia em que `reminders` entrar no `schedule`.
        */}
        <p className="mt-4 max-w-xs text-corpo text-txt-2">
          Seu pedido chegou e já apareceu para a equipe. A confirmação vem de
          quem vai te atender, e pode não ser na hora. Se não tiver retorno em
          algumas horas, é só chamar por telefone.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {slotEscolhido && servicoEscolhido ? (
            <Button
              variante="secondary"
              onClick={() =>
                baixarIcs({
                  inicio: slotEscolhido.startsAt,
                  fim: slotEscolhido.endsAt,
                  titulo: `${servicoEscolhido.name} — ${nomeDoSalao}`,
                  local: enderecoDoSalao,
                  slug,
                })
              }
            >
              <CalendarPlus aria-hidden className="size-4" />
              Adicionar à minha agenda
            </Button>
          ) : null}
          <a
            href={`/${slug}`}
            className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.97]"
          >
            Voltar para {nomeDoSalao}
          </a>
        </div>
      </Card>
    );
  }

  /*
   * Com "Qualquer um", a API devolve o mesmo horário uma vez por profissional que atende — e a
   * tela pintava um chip para cada. Medido no tenant de demonstração: 126 chips para 42
   * horários, com HTML byte a byte idêntico entre os três "09:00". Pior, o estado de selecionado
   * comparava só `startsAt`, então clicar num deles marcava `aria-pressed="true"` nos três: o
   * leitor de tela anunciava três botões pressionados quando um só foi escolhido.
   *
   * Quem escolheu "Qualquer um" escolheu não decidir quem atende — três botões iguais só podem
   * confundir. Fica um por horário, o primeiro disponível, que é exatamente o profissional que o
   * servidor escolheria sozinho se o corpo fosse sem `professionalId` (`public-booking.ts`:
   * "se `professionalId` não vier, agrega a disponibilidade de todos"). Nenhuma regra nova: a
   * mesma pessoa é atribuída, com um chip em vez de três.
   *
   * Com profissional escolhido a API já filtra, então não há duplicata e o `Map` não muda nada.
   */
  const slotsUnicos = slots
    ? [...new Map(slots.map((s) => [s.startsAt, s])).values()]
    : null;

  const slotsPorPeriodo =
    slotsUnicos && slotsUnicos.length > 0
      ? (["Manhã", "Tarde", "Noite"] as const).map((p) => ({
          periodo: p,
          itens: slotsUnicos.filter((s) => periodo(s.startsAt, timezone) === p),
        }))
      : [];

  return (
    <div className="flex flex-col gap-5">
      {/*
        I-4, `docs/30-INDICACAO-PLANO.md` §6.2b — a moldura de chegada. Prova social de par: a
        nova cliente lê o nome de alguém que ela conhece ANTES do primeiro clique, e é isso que a
        pesquisa chama de "encaixe melhor" (§2.4).

        Não promete desconto nem valor nenhum: QUAL é o prêmio e QUANTO continuam em aberto no
        §9, e estampar "R$ 20" aqui seria a mesma classe de promessa vazia que o quadro "Taxa" do
        caixa (achado da rodada 1 da auditoria). O que é verdade em qualquer plano é o convite.
      */}
      {indicadaPor ? (
        <Card className="border-acc/40 bg-acc-soft">
          <p className="text-corpo font-semibold text-txt">
            {indicadaPor} indicou este lugar pra você
          </p>
          <p className="mt-1 text-secundario text-txt-2">
            Marque seu primeiro horário abaixo — {nomeDoSalao} vai saber que foi {indicadaPor} quem
            te trouxe.
          </p>
        </Card>
      ) : null}

      <section>
        <Passo numero={1} titulo="Serviço" />
        <div className="flex flex-col gap-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => escolherServico(s.id)}
              className="block w-full text-left"
            >
              <Card
                className={
                  s.id === serviceId
                    ? "border-acc bg-acc-soft transition"
                    : "transition hover:border-line-2 hover:bg-surface-2"
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-corpo font-semibold">
                      {s.name}
                    </p>
                    <p className="tabular text-secundario text-txt-2">
                      {duracao(s.durationMin)}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-corpo font-semibold text-acc-2">
                    {s.priceCents > 0
                      ? dinheiro.format(s.priceCents / 100)
                      : "Consultar"}
                  </p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </section>

      {professionals.length > 1 ? (
        <section>
          <Passo numero={2} titulo="Profissional" />
          <div className="flex flex-wrap gap-2">
            <Chip
              ligado={professionalId === null}
              onClick={() => {
                setProfessionalId(null);
                buscarDisponibilidade(dia);
              }}
            >
              Qualquer um
            </Chip>
            {professionals.map((p) => (
              <Chip
                key={p.id}
                ligado={professionalId === p.id}
                onClick={() => {
                  setProfessionalId(p.id);
                  buscarDisponibilidade(dia);
                }}
              >
                {p.displayName}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <Passo numero={professionals.length > 1 ? 3 : 2} titulo="Dia" />
        <FilterRow rotulo="Escolher o dia">
          {dias.map((d) => {
            const data = paraData(d);
            const fechado = diasFechados.has(d);
            const nomeDoDia = data.toLocaleDateString("pt-BR", {
              weekday: "long",
              timeZone: "UTC",
            });
            return (
              <button
                key={d}
                type="button"
                onClick={() => buscarDisponibilidade(d)}
                aria-current={d === dia ? "date" : undefined}
                // Todo dia do trilho parecia igualmente disponível; nos fechados a
                // pessoa tocava e batia numa mensagem vazia. O rótulo é o mesmo que
                // o leitor de tela ouve.
                aria-label={`${nomeDoDia}, dia ${data.getUTCDate()}${fechado ? " — fechado" : ""}`}
                className={
                  "flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] text-label font-semibold transition duration-[var(--dur-1)] ease-[var(--ease-ios)] active:scale-[.95] " +
                  (d === dia
                    ? "bg-acc text-on-acc shadow-elevado"
                    : fechado
                      ? "bg-surface-2/50 text-txt-3 hover:bg-surface-3"
                      : "bg-surface-2 text-txt-2 hover:bg-surface-3 hover:text-txt")
                }
              >
                <span className="uppercase">
                  {data
                    .toLocaleDateString("pt-BR", {
                      weekday: "short",
                      timeZone: "UTC",
                    })
                    .replace(".", "")}
                </span>
                <span
                  className={`tabular text-corpo font-bold ${d === dia ? "" : fechado ? "text-txt-3" : "text-txt"}`}
                >
                  {data.getUTCDate()}
                </span>
              </button>
            );
          })}
        </FilterRow>
      </section>

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      {/*
        Medido no navegador em 2026-08-25: escolher um dia carregava DEZ botões de horário, e
        `[aria-live]`, `[role=status]` e `[role=alert]` continuavam em **zero** na página — com o
        foco parado no `body`. Para quem usa leitor de tela, dez opções novas apareciam e nada
        avisava; a pessoa não tinha como saber que a escolha do dia surtiu efeito. É a WCAG 4.1.3
        (Status Messages), nível AA, e cai na página que atende o CLIENTE DO SALÃO.

        A região fica SEMPRE no DOM, mesmo vazia, e é isso que a faz funcionar: leitor de tela
        precisa estar observando o nó ANTES de o texto mudar. Live region que nasce junto com o
        conteúdo costuma não ser anunciada — é o erro clássico, e seria fácil "consertar" assim e
        achar que resolveu.

        `polite` e não `assertive`: a pessoa acabou de tocar num dia e está esperando a resposta;
        interromper a leitura não acrescenta nada. O texto sai do MESMO estado que desenha a tela
        (`slots`), então os dois nunca divergem.
      */}
      <p aria-live="polite" className="sr-only">
        {/*
          `erro` na frente, e VAZIO: havendo erro, quem fala é o `role="alert"` logo abaixo. A
          região de status calar é melhor que repetir — e muito melhor que afirmar um resultado
          que não existe.
        */}
        {erro
          ? ""
          : slots === null
            ? "Buscando horários."
            : diasFechados.has(dia)
              ? "Nesse dia o atendimento não abre."
              : slots.length === 0
                ? "Sem horários livres nesse dia."
                : `${slotsUnicos?.length ?? slots.length} ${(slotsUnicos?.length ?? slots.length) === 1 ? "horário livre" : "horários livres"} em ${paraData(dia).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" })}.`}
      </p>

      {slots ? (
        slots.length === 0 ? (
          <p className="text-secundario text-txt-2">
            {diasFechados.has(dia)
              ? "Nesse dia o atendimento não abre. Escolha outra data no trilho acima."
              : "Sem horários livres nesse dia. Tente outra data."}
          </p>
        ) : (
          <section className="flex flex-col gap-4">
            {slotsPorPeriodo
              .filter((grupo) => grupo.itens.length > 0)
              .map((grupo) => (
                <div key={grupo.periodo}>
                  <h3 className="mb-2 text-label font-semibold text-txt-3">
                    {grupo.periodo}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {grupo.itens.map((s) => (
                      <Chip
                        key={`${s.startsAt}-${s.professionalId}`}
                        ligado={slotEscolhido?.startsAt === s.startsAt}
                        onClick={() => setSlotEscolhido(s)}
                      >
                        {horaLocal(s.startsAt, timezone)}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
          </section>
        )
      ) : pendente ? (
        <p className="text-secundario text-txt-2">Buscando horários…</p>
      ) : null}

      {slotEscolhido && servicoEscolhido ? (
        <Card className="flex flex-col gap-3">
          <div>
            <p className="text-corpo font-semibold text-txt">
              {servicoEscolhido.name}
            </p>
            <p className="mt-0.5 text-secundario text-txt-2">
              {paraData(dia).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                timeZone: "UTC",
              })}{" "}
              às {horaLocal(slotEscolhido.startsAt, timezone)} ·{" "}
              {duracao(servicoEscolhido.durationMin)}
            </p>
            {servicoEscolhido.priceCents > 0 ? (
              <p className="tabular mt-2 text-stat font-bold text-acc-2">
                {dinheiro.format(servicoEscolhido.priceCents / 100)}
              </p>
            ) : null}
          </div>
          {/*
            `autoComplete` faltava nos dois campos: sem ele o celular não
            oferece o nome e o telefone já salvos — atrito puro no único
            formulário do produto que fica entre a cliente e a reserva.
          */}
          <Input
            rotulo="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            required
          />
          <PhoneInput
            rotulo="Seu telefone (WhatsApp)"
            valor={telefone}
            aoMudar={setTelefone}
            ajuda={textoDoCanalDeConfirmacao()}
            required
          />
          {/* Opcional: pedir endereço sempre (não só de quem "vai até o cliente")
              evita ramificar a tela por eixo de profissão só pra isto — o campo
              some sozinho da conversa se ninguém preencher. */}
          <Input
            rotulo="Endereço do atendimento (opcional)"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            ajuda="Só preencha se não for no nosso endereço."
            autoComplete="street-address"
          />

          {/* Honeypot — invisível para gente, visível para script. */}
          <label
            className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
            aria-hidden
            tabIndex={-1}
          >
            Não preencha este campo
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </label>

          {/*
            Mesmo defeito do TICKET-105 em `/avaliar`: travado sem dizer por quê. Quem enxerga
            deduz pelos dois campos vazios logo acima; no leitor de tela saía "Confirmar
            agendamento, indisponível" e ponto — na última tela do funil que traz cliente novo.
          */}
          <Button
            largura="cheia"
            carregando={pendente}
            disabled={!nome || !telefone}
            motivoDesabilitado="Preencha seu nome e seu telefone para confirmar."
            onClick={confirmar}
          >
            Confirmar agendamento
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
