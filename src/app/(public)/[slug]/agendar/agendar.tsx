"use client";

import { CalendarPlus, CheckCircle2, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { comMaiuscula, type Vocabulario } from "@/core/text/vocabulario";
import { formatarPreco, type ModeloDePreco } from "@/core/pricing/formatar";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Chip from "@/components/ui/chip";
import FilterRow from "@/components/ui/filter-row";
import Input from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import { textoDoCanalDeConfirmacao } from "@/core/messaging/promessa";
import { montarIcs, type EventoIcs } from "@/core/scheduling/ics";
import { dinheiro, duracao } from "@/lib/formato";
import {
  lerReconhecimentoLocal,
  salvarReconhecimentoLocal,
} from "@/lib/reconhecimento-local";

type Servico = {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  /*
   * Os três campos que decidem COMO o preço se lê. Eles já viajavam de `public-booking.ts` até
   * aqui; o que faltava era esta declaração, e sem ela a tela caiu na própria formatação: mostrava
   * `dinheiro.format(priceCents)` cru, ou seja, "R$ 50" para um serviço que a vitrine do mesmo
   * salão anuncia como "R$ 50/hora". Duas fontes da mesma verdade, e a errada era justamente a do
   * último passo antes de confirmar.
   */
  pricingModel: ModeloDePreco;
  hourlyRateCents: number | null;
  halfDayPriceCents: number | null;
  /** Quanto a cliente adianta para segurar o horário. `null` = este serviço não pede sinal. */
  depositCents: number | null;
};
type Profissional = { id: string; displayName: string; photoUrl: string | null };
type Slot = { startsAt: string; endsAt: string; professionalId: string };
type Reconhecimento = {
  primeiroNome: string;
  diasDesdeUltima: number | null;
  sugestao: { serviceId: string; serviceName: string; professionalId: string | null } | null;
};

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

/** Sentinela de "a pessoa fechou a faixa que estava aberta" — distinto de `null`, que é "ainda não mexeu". */
const NENHUM_PERIODO = "";

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
  vocabulario,
  nomeDoSalao,
  enderecoDoSalao,
  timezone,
  hours,
  services,
  professionals,
  servicoInicial,
  profissionalInicial,
  ind,
  indicadaPor,
}: {
  slug: string;
  /** As palavras da profissão, já resolvidas no servidor. Ver docs/DECISOES.md 2026-09-04. */
  vocabulario: Vocabulario;
  nomeDoSalao: string;
  /** Vira o `LOCATION` do arquivo de calendário — sem ele o evento não diz onde é. */
  enderecoDoSalao: string | null;
  timezone: string;
  hours: { weekday: number; opensAt: string; closesAt: string }[];
  services: Servico[];
  professionals: Profissional[];
  /** Serviço tocado na página do salão (`?servico=`), já conferido contra o catálogo pelo servidor. */
  servicoInicial: string | null;
  profissionalInicial: string | null;
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

  /*
   * Quem tocou num serviço na página do salão já escolheu — abrir no primeiro do catálogo
   * desfaria a escolha em silêncio. O servidor já conferiu que o id pertence a este perfil.
   */
  const [serviceId, setServiceId] = useState(
    servicoInicial ?? services[0]?.id ?? "",
  );
  // Mesmo motivo do `servicoInicial` acima: quem tocou num rosto na página do salão já
  // escolheu, e abrir em "Tanto faz" desfaria a escolha em silêncio. O servidor já conferiu
  // que o id pertence à equipe deste perfil.
  const [professionalId, setProfessionalId] = useState<string | null>(profissionalInicial);
  const [dia, setDia] = useState(primeiroDiaUtil);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotEscolhido, setSlotEscolhido] = useState<Slot | null>(null);
  /*
    Qual faixa de horário aparece aberta. Medido em 31/08: uma terça na Dom Rocha listava 42
    horários de uma vez, de 15 em 15 minutos, todos com o mesmo peso visual — escolher entre eles
    é a decisão mais cara da tela, e a última antes da reserva.
  */
  const [periodoAberto, setPeriodoAberto] = useState<string | null>(null);
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

  /*
    Confirmar troca a página INTEIRA sem trocar de rota — o formulário some e entra a tela de
    "Agendamento enviado!". Medido no navegador antes deste conserto: o foco ficava no `body`, a
    região viva do formulário ia embora junto com ele, e a única `role="status"` que sobrava na
    página era o aviso de demonstração, que não mudou. Ou seja, quem usa leitor de tela tocava em
    "Confirmar agendamento" e não ouvia NADA — sem saber se marcou, se falhou, ou se ainda está
    carregando, no momento mais importante do fluxo.

    É a mesma WCAG 4.1.3 que `agendamento-anuncia-mudanca.test.ts` já guardava para a troca de dia;
    a guarda simplesmente nunca cobriu o último passo.

    **Foco, e não `role="status"`, e o motivo está escrito naquele mesmo teste:** a região que
    NASCE junto com o conteúdo costuma não ser anunciada — o leitor precisa estar observando o nó
    antes de o texto mudar. Aqui a tela inteira é montada de uma vez, então não há nó preexistente
    para observar. Mover o foco para o título novo anuncia o texto E deixa a pessoa no começo do
    conteúdo novo, que é o que ela precisa para ler o resumo do que marcou.
  */
  const tituloDoSucesso = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (confirmado) tituloDoSucesso.current?.focus();
  }, [confirmado]);

  /*
    docs/34-PAGINA-PUBLICA-PLANO.md, Fase 2 — "reconhecer quem já é cliente". `reconhecimento`
    só existe quando o navegador guarda um token de um agendamento anterior NESTE tenant
    (`reconhecimento-local.ts`); nunca vem de telefone digitado agora, então não há como um
    visitante pedir a ficha de outra pessoa. `null` = navegador novo ou token vencido — o caso
    comum, sem banner nenhum.
  */
  const [reconhecimento, setReconhecimento] = useState<Reconhecimento | null>(null);
  const [reconhecimentoDispensado, setReconhecimentoDispensado] = useState(false);

  useEffect(() => {
    const salvo = lerReconhecimentoLocal(slug);
    if (!salvo) return;
    // Só preenche quem ainda não digitou nada — reaproveita o nome/telefone da vez anterior,
    // sem sobrescrever o que a pessoa já está escrevendo se voltar à tela no meio do preenchimento.
    setNome((atual) => atual || salvo.name);
    setTelefone((atual) => atual || salvo.phone);

    let cancelado = false;
    fetch(`/api/v1/public/${slug}/reconhecer?token=${encodeURIComponent(salvo.token)}`)
      .then((r) => r.json())
      .then((json: { data?: { conhecida: boolean } & Partial<Reconhecimento> }) => {
        if (cancelado || !json.data?.conhecida) return;
        setReconhecimento({
          primeiroNome: json.data.primeiroNome ?? "",
          diasDesdeUltima: json.data.diasDesdeUltima ?? null,
          sugestao: json.data.sugestao ?? null,
        });
      })
      .catch(() => {
        // Silencioso de propósito: sem o banner de reconhecimento a tela continua funcionando
        // normalmente, é a mesma experiência de quem nunca agendou aqui.
      });
    return () => {
      cancelado = true;
    };
  }, [slug]);

  function aplicarSugestao() {
    if (!reconhecimento?.sugestao) return;
    setReconhecimentoDispensado(true);
    const { serviceId: sugerido, professionalId: profissionalSugerido } = reconhecimento.sugestao;
    setServiceId(sugerido);
    if (profissionalSugerido && professionals.some((p) => p.id === profissionalSugerido)) {
      setProfessionalId(profissionalSugerido);
    }
    buscarDisponibilidade(dia, sugerido);
  }

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
          data?: { reconhecimentoToken?: string | null };
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
        // Fase 2 de docs/34-PAGINA-PUBLICA-PLANO.md: guarda o token pra próxima visita reconhecer
        // sozinha. Sem token (honeypot) não há o que guardar — silencioso, não é o caminho normal.
        if (json.data?.reconhecimentoToken) {
          salvarReconhecimentoLocal(slug, { name: nome, phone: telefone, token: json.data.reconhecimentoToken });
        }
        setConfirmado(true);
      } catch {
        setErro(
          "Não consegui falar com o servidor. Confira a conexão e tente de novo. Se o horário já tiver sido marcado, ele aparece ao escolher o dia outra vez.",
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
        {/*
          `h2` e não `p`: além de ser o alvo do foco, é o que faz a tela de sucesso existir para
          quem navega por títulos. Antes, o único título da página era o `h1` "Agendar em
          {salão}", que continua o mesmo depois de confirmar — pular de título em título não
          revelava nenhuma mudança.

          `tabIndex={-1}` deixa o elemento focável por código sem entrar na ordem do Tab: quem
          navega por teclado não ganha uma parada extra, e o foco programático funciona.
        */}
        <h2 ref={tituloDoSucesso} tabIndex={-1} className="text-titulo font-bold">
          Agendamento enviado!
        </h2>

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
                  titulo: `${servicoEscolhido.name} · ${nomeDoSalao}`,
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

  const periodosComVaga = slotsPorPeriodo.filter((g) => g.itens.length > 0);

  /*
   * Qual período aparece aberto. `null` = ainda não escolheram, e vale o primeiro com vaga —
   * medido em 31/08: uma terça na Dom Rocha listava 42 horários de uma vez, de 15 em 15 minutos,
   * todos com o mesmo peso visual. Escolher entre 42 chips iguais é a decisão mais cara da tela,
   * e é a última antes da reserva.
   *
   * Um período JÁ vem aberto de propósito: colapsar tudo trocaria uma tela cheia por uma tela
   * vazia, e custaria um toque a mais no caso comum, que é aceitar o próximo horário livre.
   */
  /* `null` = ninguém mexeu ainda (vale o primeiro com vaga); `NENHUM_PERIODO` = a pessoa fechou a
     que estava aberta, e aí nenhuma faixa casa — os dois casos precisam ser distinguíveis. */
  const periodoVisivel = periodoAberto ?? periodosComVaga[0]?.periodo ?? null;

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
            Marque seu primeiro horário abaixo, e {nomeDoSalao} vai saber que foi {indicadaPor} quem
            te trouxe.
          </p>
        </Card>
      ) : null}

      {/*
        docs/34-PAGINA-PUBLICA-PLANO.md, Fase 2 — "a página sabe quando ela deveria voltar". Só
        aparece pra quem já tem o token guardado deste tenant (ver o efeito de montagem acima) e
        ainda não dispensou o banner nesta visita. Nunca oferece o botão de aplicar sem sugestão
        de serviço — sem ela não há o que pré-marcar.
      */}
      {reconhecimento && !reconhecimentoDispensado ? (
        <Card className="border-acc/40 bg-acc-soft">
          <p className="text-corpo font-semibold text-txt">
            Oi, {reconhecimento.primeiroNome}!
          </p>
          <p className="mt-1 text-secundario text-txt-2">
            {reconhecimento.sugestao
              ? `Da última vez foi ${reconhecimento.sugestao.serviceName}${
                  reconhecimento.diasDesdeUltima !== null
                    ? `, faz ${reconhecimento.diasDesdeUltima} ${reconhecimento.diasDesdeUltima === 1 ? "dia" : "dias"}`
                    : ""
                }. Quer marcar de novo?`
              : "Que bom te ver de novo por aqui."}
          </p>
          {reconhecimento.sugestao ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={aplicarSugestao}>Marcar de novo</Button>
              <Button
                variante="secondary"
                onClick={() => setReconhecimentoDispensado(true)}
              >
                Agora não
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <section>
        <Passo numero={1} titulo={comMaiuscula(vocabulario.servico)} />
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
                    {formatarPreco({
                      pricingModel: s.pricingModel,
                      priceCents: s.priceCents,
                      hourlyRateCents: s.hourlyRateCents,
                      halfDayPriceCents: s.halfDayPriceCents,
                    })}
                  </p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </section>

      {professionals.length > 1 ? (
        <section>
          <Passo numero={2} titulo={comMaiuscula(vocabulario.profissional)} />
          <div className="flex flex-wrap gap-2">
            <Chip
              ligado={professionalId === null}
              onClick={() => {
                setProfessionalId(null);
                buscarDisponibilidade(dia);
              }}
            >
              {/*
                Era "Qualquer um". Num salão de unhas ou cílios, a equipe inteira costuma ser de
                mulheres, e o produto oferecia à cliente uma opção no masculino para escolher entre
                elas. "Tanto faz" resolve sem precisar de gênero nenhum e é como a pessoa fala.
              */}
              Tanto faz
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
                {/*
                  Rosto antes do nome: a cliente marca com ALGUÉM, não com uma string. Dentro do
                  Chip para não mudar o alvo de toque nem a linha — quem não tem foto continua
                  aparecendo só com o nome, sem moldura vazia denunciando a ausência.
                */}
                {p.photoUrl ? (
                  /* Já é WebP dimensionado no upload. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.photoUrl}
                    alt=""
                    width={512}
                    height={512}
                    loading="lazy"
                    className="-ml-1 mr-1.5 inline-block size-6 rounded-full object-cover align-text-bottom"
                  />
                ) : null}
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
                aria-label={`${nomeDoDia}, dia ${data.getUTCDate()}${fechado ? ", fechado" : ""}`}
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
        {/*
          A ORDEM dos ramos importa tanto quanto o conteúdo, e é onde isto estava errado: o teste
          de `diasFechados` vinha ANTES do de `slots.length`, enquanto o texto visível (logo
          abaixo) só consulta `diasFechados` DENTRO do caso "zero horários".

          `diasFechados` é o expediente padrão do SALÃO, e a agenda de um profissional pode fugir
          dele — o comentário de `primeiroDiaUtil` diz isso com todas as letras, e é por isso que
          o dia fechado continua clicável no trilho. Ou seja, "dia fechado no padrão E com
          horários na tela" não é estado corrompido: é o caso que o produto foi desenhado para
          permitir.

          Medido no navegador a 375px, antes deste conserto: segunda-feira com **12 horários
          visíveis** e a região viva anunciando "Nesse dia o atendimento não abre". Quem usa leitor
          de tela ouvia que o salão está fechado, com a agenda cheia na tela, e ia embora.

          O comentário acima desta região afirmava que "o texto sai do MESMO estado que desenha a
          tela (`slots`), então os dois nunca divergem". Divergiam — porque este ramo lia outra
          coisa além de `slots`. Agora a estrutura espelha a do texto visível, e a afirmação passa
          a ser verdade.
        */}
        {erro
          ? ""
          : slots === null
            ? "Buscando horários."
            : slots.length === 0
              ? diasFechados.has(dia)
                ? "Nesse dia o atendimento não abre."
                : "Sem horários livres nesse dia."
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
          /*
            Uma faixa por período, e só a aberta lista os horários. O período fechado continua
            dizendo o que a pessoa precisa para escolher — quantos horários tem e a partir de que
            hora —, então fechar não esconde informação, só adia a lista.
          */
          <section className="flex flex-col gap-2">
            {periodosComVaga.map((grupo) => {
              const aberto = grupo.periodo === periodoVisivel;
              const primeiro = horaLocal(grupo.itens[0]!.startsAt, timezone);
              const temEscolhido = grupo.itens.some((s) => s.startsAt === slotEscolhido?.startsAt);
              return (
                <div key={grupo.periodo} className="overflow-hidden rounded-[var(--radius-sm)] border border-line-2">
                  <button
                    type="button"
                    onClick={() => setPeriodoAberto(aberto ? NENHUM_PERIODO : grupo.periodo)}
                    aria-expanded={aberto}
                    className="flex min-h-12 w-full items-center gap-3 bg-surface-2 px-4 py-2 text-left transition hover:bg-surface-3"
                  >
                    <span className="flex-1 text-corpo font-semibold text-txt">{grupo.periodo}</span>
                    {/*
                      O ponto marca o período que contém o horário já escolhido — sem ele, fechar
                      a faixa faria a escolha sumir de vista sem deixar rastro.
                    */}
                    {temEscolhido && !aberto ? <span aria-hidden className="size-2 rounded-full bg-acc" /> : null}
                    <span className="text-secundario text-txt-3">
                      {grupo.itens.length} {grupo.itens.length === 1 ? "horário" : "horários"} · a partir de {primeiro}
                    </span>
                    <ChevronDown
                      aria-hidden
                      className={`size-4 shrink-0 text-txt-3 transition-transform duration-[var(--dur-1)] ${aberto ? "rotate-180" : ""}`}
                    />
                  </button>
                  {aberto ? (
                    <div className="flex flex-wrap gap-2 p-3">
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
                  ) : null}
                </div>
              );
            })}
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
            {/*
              O preço NÃO se repete aqui. Ele já está na linha do serviço escolhido, uma rolagem
              acima e visivelmente marcada — repetir em corpo grande fazia o mesmo número aparecer
              duas vezes na mesma tela e transformava o último passo numa vitrine de preço, quando
              o que falta ali é só nome, telefone e confirmar. Fresha e Booksy repetem o valor
              porque o resumo deles é OUTRA tela; aqui é a mesma rolagem contínua.
            */}
            {/*
              O sinal aparece no RESUMO, não na lista de serviços: aqui é o último instante antes
              de confirmar, e é onde a expectativa precisa estar posta para valer alguma coisa.
              Na lista ele viraria um segundo número competindo com o preço em cada linha.

              O texto é deliberadamente sobre combinar, nunca sobre pagar: não existe cobrança no
              CICLO, e prometer um pagamento que a tela não processa seria a mesma classe de
              promessa vazia que a regra do canal de mensagem proíbe.
            */}
            {servicoEscolhido.depositCents !== null ? (
              <p className="mt-2 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-secundario text-txt-2">
                Este horário pede um sinal de{" "}
                <strong className="tabular font-semibold text-txt">
                  {dinheiro.format(servicoEscolhido.depositCents / 100)}
                </strong>
                . Quem te atende combina o pagamento com você depois de confirmar.
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
          {/*
            "Endereço do atendimento" virou "Onde vai ser" porque a versão antiga **não sobrevive
            ao vocabulário da profissão**: o artigo concorda com a palavra, e "do atendimento" vira
            "da sessão" no psicólogo e "da aula" no professor. Injetar a palavra aqui exigiria
            guardar o gênero de cada uma, e um `do/da` errado é pior que a palavra genérica.

            Reescrever para não depender de gênero é a saída que o `docs/20` §403 já indica ao vetar
            barra e parênteses. E o rótulo ficou melhor: mais curto e mais direto que o anterior.
          */}
          <Input
            rotulo="Onde vai ser (opcional)"
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
