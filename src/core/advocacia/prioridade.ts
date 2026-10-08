// Origem: LUBI src/lib/domain/prioridade.ts @ db8aeac (docs/101 §8, cópia versionada com teste próprio).
// Prioridade da fila de trabalho (plano mestre 04 §3 e §4). UMA implementação: o servidor (modo real) e a
// demonstração a usam; não há cópia em SQL (a view `work_queue` entrega os fatos, não a ordem).
// Função pura: o "hoje" entra como argumento (nunca `new Date()` escondido), em AAAA-MM-DD de Brasília.
//
// score = peso do tipo + pontos de tempo + pontos de adiamento + pontos de bloqueio
// A ordem é: grupo (fixo) → score (maior primeiro) → due_on (mais cedo; sem data por último) → created_at → item_key.
import { diffDays, fmtDiaMes } from "./datas";

export const PRIORIDADE_V1 = "prioridade-v1";

export type FonteFila =
  | "deadline"
  | "intimation"
  | "task"
  | "client_action"
  | "document_review"
  | "request"
  | "lead"
  | "installment"
  | "obligation"
  | "message";

/** O que cabe num jsonb (o `raw` da view atravessa o servidor como JSON). */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Uma linha da view `work_queue` (as colunas que a fórmula e a tela usam). */
export interface ItemFila {
  item_key: string;
  source: FonteFila;
  source_id: string;
  account_id: string;
  matter_id: string | null;
  title: string;
  owner_kind: "staff" | "client";
  /** Responsável da origem → caso → cliente; responsável inativo chega como `null` (sem dono). */
  owner_staff_id: string | null;
  due_on: string | null;
  raw: Record<string, Json>;
  sensitivity: string | null;
  link: string | null;
  created_at: string;
}

export const GRUPOS = [
  "Sem responsável",
  "Atrasado",
  "Hoje",
  "Esta semana",
  "Aguardando cliente",
  "Aguardando terceiros",
  "Depois",
  "Sem data",
] as const;
export type Grupo = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PartesDoScore {
  peso: number;
  tempo: number;
  adiamento: number;
  bloqueio: number;
}

export interface Prioridade {
  versao: typeof PRIORIDADE_V1;
  grupo: Grupo;
  grupoNome: (typeof GRUPOS)[number];
  score: number;
  partes: PartesDoScore;
  /** Só as parcelas com pontos > 0, ex.: "Prazo fatal · 2 dias de atraso". */
  motivo: string;
  /** Selos que a tela mostra ao lado do item. */
  selos: string[];
}

export type ItemOrdenado = ItemFila & { prioridade: Prioridade };

// ---------------------------------------------------------------------------------------------------------------
// Leitura tolerante do `raw` (o banco entrega jsonb; um campo ausente nunca vira "média escondida")
// ---------------------------------------------------------------------------------------------------------------
const txt = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const bool = (v: unknown): boolean => v === true;

interface Tipo {
  nome: string;
  peso: number;
}

/** Peso e nome do tipo (a tabela do `04` §4). Pesos iniciais são [HIPÓTESE] a validar com os snapshots. */
function tipoDe(i: ItemFila): Tipo {
  const r = i.raw;
  switch (i.source) {
    case "intimation":
      return { nome: "Intimação nova", peso: 95 };
    case "deadline": {
      const kind = txt(r.kind);
      if (kind === "audiencia") return { nome: "Audiência", peso: 90 };
      if (kind === "fatal") return { nome: "Prazo fatal", peso: 100 };
      if (kind === "contratual") return { nome: "Prazo contratual", peso: 60 };
      return { nome: "Prazo interno", peso: 60 };
    }
    case "client_action": {
      const estado = txt(r.estado);
      if (estado === "rascunho") return { nome: "Pedido para aprovar", peso: 30 };
      if (estado === "enviado" || estado === "em_conferencia")
        return { nome: "Pedido para conferir", peso: 55 };
      if (bool(r.trava_prazo)) return { nome: "Cliente travando prazo", peso: 70 };
      return { nome: "Pedido ao cliente", peso: 30 };
    }
    case "document_review":
      return { nome: "Documento para conferir", peso: 55 };
    case "request":
      return bool(r.cliente_respondeu)
        ? { nome: "Cliente respondeu", peso: 50 }
        : { nome: "Solicitação sem resposta", peso: 50 };
    case "lead":
      return { nome: "Lead novo", peso: 45 + (bool(r.urgente) ? 15 : 0) };
    case "installment":
      return { nome: "Parcela em atraso", peso: 40 };
    case "obligation":
      return { nome: txt(r.rotulo) ?? "Obrigação", peso: 35 };
    case "message":
      return { nome: "Mensagens prontas", peso: 20 };
    case "task":
    default:
      return { nome: "Tarefa", peso: 30 };
  }
}

/** Pontos de tempo: d = `due_on − hoje` em dias corridos de Brasília. */
export function pontosDeTempo(d: number | null): number {
  if (d === null) return 0;
  if (d < 0) return Math.min(40, 20 + 2 * -d);
  if (d === 0) return 20;
  if (d <= 3) return 12;
  if (d <= 7) return 6;
  return 0;
}

/** Adiamento: +5 por adiamento, teto 15. */
export function pontosDeAdiamento(vezes: number): number {
  return Math.min(15, 5 * Math.max(0, Math.trunc(vezes)));
}

/** Bloqueio: +10 para o pedido ao cliente que trava prazo aberto em até 15 dias. */
export function pontosDeBloqueio(i: ItemFila): number {
  return i.source === "client_action" && bool(i.raw.trava_prazo) ? 10 : 0;
}

function grupoDe(i: ItemFila, d: number | null): Grupo {
  if (i.owner_staff_id === null) return 0;
  // espera de outra pessoa: o item não é "de hoje" de quem o acompanha
  if (i.source === "task" && txt(i.raw.status) === "aguardando_terceiro") return 5;
  if (i.source === "client_action" && i.owner_kind === "client" && !bool(i.raw.trava_prazo))
    return 4;
  if (d === null) return 7;
  if (d < 0) return 1;
  if (d === 0) return 2;
  if (d <= 7) return 3;
  return 6;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function textoDoTempo(d: number): string {
  if (d < 0) return `${plural(-d, "dia", "dias")} de atraso`;
  if (d === 0) return "vence hoje";
  return `em ${plural(d, "dia", "dias")}`;
}

/** Calcula grupo, score, motivo e selos de UM item. `hoje` = AAAA-MM-DD (Brasília). */
export function prioridade(i: ItemFila, hoje: string): Prioridade {
  const d = i.due_on ? diffDays(hoje, i.due_on) : null;
  const tipo = tipoDe(i);
  const snooze = Math.max(0, Math.trunc(num(i.raw.snooze_count)));
  const partes: PartesDoScore = {
    peso: tipo.peso,
    tempo: pontosDeTempo(d),
    adiamento: pontosDeAdiamento(snooze),
    bloqueio: pontosDeBloqueio(i),
  };
  const score = partes.peso + partes.tempo + partes.adiamento + partes.bloqueio;
  const grupo = grupoDe(i, d);

  const motivo: string[] = [tipo.nome];
  if (i.source === "lead" && bool(i.raw.urgente)) motivo.push("urgente");
  const fatalEm = i.source === "deadline" ? txt(i.raw.fatal_due_on) : null;
  if (fatalEm !== null && i.due_on !== null && fatalEm !== i.due_on) {
    // a data do item é o "fazer até" (prazo interno); o fatal aparece à parte, para o atraso do interno não passar por atraso do fatal
    motivo.push(
      d !== null && d < 0
        ? `passou do fazer até ${fmtDiaMes(i.due_on)}`
        : `fazer até ${fmtDiaMes(i.due_on)}`,
    );
    motivo.push(`fatal ${fmtDiaMes(fatalEm)}`);
  } else if (partes.tempo > 0 && d !== null) {
    // o tipo "Parcela em atraso" já diz que está atrasada: só a contagem
    motivo.push(i.source === "installment" && d < 0 ? plural(-d, "dia", "dias") : textoDoTempo(d));
  }
  if (partes.adiamento > 0) motivo.push(`adiada ${plural(snooze, "vez", "vezes")}`);
  if (partes.bloqueio > 0) {
    const n = Math.max(1, Math.trunc(num(i.raw.prazos_travados)));
    motivo.push(`trava ${plural(n, "prazo", "prazos")}`);
  }

  const selos: string[] = [];
  if (d !== null && d < 0) selos.push("atrasado");
  const ate = txt(i.raw.snoozed_until);
  if (ate && diffDays(hoje, ate) >= 0) selos.push("adiado");
  if (i.source === "deadline" && txt(i.raw.kind) === "fatal") selos.push("fatal");
  if (i.source === "client_action" && bool(i.raw.trava_prazo)) selos.push("travando prazo");
  if (i.owner_kind === "client") selos.push("com o cliente");

  return {
    versao: PRIORIDADE_V1,
    grupo,
    grupoNome: GRUPOS[grupo],
    score,
    partes,
    motivo: motivo.join(" · "),
    selos,
  };
}

/** Compara dois itens já calculados: grupo → score desc → due_on asc (sem data por último) → created_at → item_key. */
export function compararFila(a: ItemOrdenado, b: ItemOrdenado): number {
  if (a.prioridade.grupo !== b.prioridade.grupo) return a.prioridade.grupo - b.prioridade.grupo;
  if (a.prioridade.score !== b.prioridade.score) return b.prioridade.score - a.prioridade.score;
  if (a.due_on !== b.due_on) {
    if (a.due_on === null) return 1;
    if (b.due_on === null) return -1;
    return a.due_on < b.due_on ? -1 : 1;
  }
  const ca = Date.parse(a.created_at);
  const cb = Date.parse(b.created_at);
  if (ca !== cb && !Number.isNaN(ca) && !Number.isNaN(cb)) return ca - cb;
  return a.item_key < b.item_key ? -1 : a.item_key > b.item_key ? 1 : 0;
}

/** A fila inteira, na ordem da tela. Não altera a lista recebida. */
export function ordenarFila(itens: readonly ItemFila[], hoje: string): ItemOrdenado[] {
  return itens.map((i) => ({ ...i, prioridade: prioridade(i, hoje) })).sort(compararFila);
}
