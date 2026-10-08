// Origem: LUBI src/lib/domain/prazo-calculo.ts @ db8aeac (docs/101 §8, cópia versionada com teste próprio).
// Cálculo do prazo de uma intimação (plano mestre 11 §1, camadas 4 e 6): função PURA e determinística. Sugere a
// data e devolve a MEMÓRIA DE CÁLCULO em português; quem decide é a pessoa (camada 5). O cálculo nunca lê o
// relógio: tudo entra por argumento (a data da disponibilização e os dias não contáveis do tribunal).
//
// Regras (PRAZO_REGRAS_V1, doc 11 §1 camada 4):
//   publicação = 1º dia útil APÓS a disponibilização (Lei 11.419/2006 art. 4º §3º; CPC art. 224)
//   início     = 1º dia útil APÓS a publicação, e é o DIA 1 da contagem (Lei 11.419 art. 4º §4º; CPC art. 224)
//   unidade    = dias úteis (cível, trabalhista, juizado) ou corridos (penal), conforme o rito
// As regras marcadas `validada: false` ainda não foram confirmadas pela advocacia revisora: enquanto isso o resultado
// traz `podePreencher = false` (a tela mostra a memória e exige a data digitada) — "regra [VALIDAR] desligada".
import { addDays, diaDaSemana, fmtDiaMes, fmtDiaSemana } from "./datas";

export const PRAZO_REGRAS_V1 = "prazo-regras-v1";

export type Rito = "civel" | "trabalhista" | "jec" | "penal";
export type Unidade = "uteis" | "corridos";

export interface Regra {
  id: string;
  /** Texto curto para a tela ("contagem em dias úteis no rito cível"). */
  rotulo: string;
  fonte: string;
  /** Confirmada pela advocacia revisora (ou por fonte legal inequívoca)? Só então a data vem pré-preenchida. */
  validada: boolean;
}

export const REGRA_PUBLICACAO: Regra = {
  id: "publicacao-diario",
  rotulo:
    "publicação no 1º dia útil após a disponibilização; contagem a partir do 1º dia útil seguinte",
  fonte: "Lei 11.419/2006 art. 4º §3º e §4º; CPC art. 224",
  validada: true,
};

export const REGRA_SUSPENSAO_FIM_DE_ANO: Regra = {
  id: "suspensao-fim-de-ano",
  rotulo: "suspensão dos prazos de 20/12 a 20/01",
  fonte: "CPC art. 220",
  validada: false,
};

export const REGRAS_DO_RITO: Record<Rito, Regra & { unidade: Unidade; nome: string }> = {
  civel: {
    id: "unidade-civel",
    nome: "cível",
    unidade: "uteis",
    rotulo: "contagem em dias úteis no rito cível",
    fonte: "CPC art. 219",
    validada: false,
  },
  trabalhista: {
    id: "unidade-trabalhista",
    nome: "trabalhista",
    unidade: "uteis",
    rotulo: "contagem em dias úteis no rito trabalhista",
    fonte: "CLT art. 775",
    validada: false,
  },
  jec: {
    id: "unidade-jec",
    nome: "Juizado Especial Cível",
    unidade: "uteis",
    rotulo: "contagem em dias úteis no Juizado Especial Cível",
    fonte: "Lei 13.728/2018",
    validada: false,
  },
  penal: {
    id: "unidade-penal",
    nome: "penal",
    unidade: "corridos",
    rotulo: "contagem em dias corridos no rito penal",
    fonte: "CPP art. 798",
    validada: false,
  },
};

/** Um dia que não conta (feriado do tribunal, suspensão…). Fim de semana não precisa estar na lista. */
export interface DiaNaoContavel {
  data: string;
  motivo: string;
  /** A regra que o torna não contável (só as que dependem de validação, como a suspensão de fim de ano). */
  regra?: string;
}

export interface EntradaDoCalculo {
  /** Data da disponibilização no DJEN (AAAA-MM-DD). */
  disponibilizadoEm: string;
  /** Prazo em dias, como está no texto da intimação (1 a 365). */
  dias: number;
  rito: Rito;
  /** Marcação MANUAL do caso ("parte com prazo em dobro"); nunca é inferida (PM-D-022). */
  emDobro?: boolean;
  /** Feriados do tribunal/comarca e suspensões, como dias avulsos. */
  naoContaveis: readonly DiaNaoContavel[];
  /** Regras que uma pessoa com autoridade (o sócio) já confirmou. */
  confirmadas?: readonly string[];
}

export interface ResultadoDoCalculo {
  versao: typeof PRAZO_REGRAS_V1;
  publicadoEm: string;
  inicioEm: string;
  venceEm: string;
  unidade: Unidade;
  /** Dias efetivamente contados (já com o dobro). */
  diasContados: number;
  /** Os feriados e suspensões que caíram entre a disponibilização e o vencimento (fim de semana não entra). */
  pulados: DiaNaoContavel[];
  /** Prazo em dias corridos que vencia em dia sem expediente: o dia original, que foi prorrogado. */
  prorrogadoDe: string | null;
  /** Regras que o cálculo usou e que ainda não foram validadas nem confirmadas. */
  regrasPendentes: Regra[];
  /** `false` enquanto houver regra pendente: a data é mostrada como sugestão e a pessoa digita a sua. */
  podePreencher: boolean;
  /** A memória de cálculo, em uma frase legível. */
  memo: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_DE_BUSCA = 800;

/** Suspensão de fim de ano (CPC art. 220): de 20/12 de `ano` a 20/01 do ano seguinte, dia a dia. */
export function suspensaoDeFimDeAno(ano: number): DiaNaoContavel[] {
  const out: DiaNaoContavel[] = [];
  const motivo = "suspensão de fim de ano, CPC art. 220";
  for (let d = `${ano}-12-20`; d <= `${ano + 1}-01-20`; d = addDays(d, 1))
    out.push({ data: d, motivo, regra: REGRA_SUSPENSAO_FIM_DE_ANO.id });
  return out;
}

/** Feriados nacionais de data fixa (o resto — Sexta-feira Santa, feriados do tribunal e da comarca — é cadastro). */
export function feriadosNacionaisFixos(ano: number): DiaNaoContavel[] {
  const f: [string, string][] = [
    ["01-01", "Confraternização Universal"],
    ["04-21", "Tiradentes"],
    ["05-01", "Dia do Trabalho"],
    ["09-07", "Independência"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-02", "Finados"],
    ["11-15", "Proclamação da República"],
    ["11-20", "Consciência Negra"],
    ["12-25", "Natal"],
  ];
  return f.map(([md, nome]) => ({ data: `${ano}-${md}`, motivo: `feriado nacional: ${nome}` }));
}

const fimDeSemana = (iso: string) => {
  const w = diaDaSemana(iso);
  return w === 0 || w === 6;
};

function indexar(lista: readonly DiaNaoContavel[]): Map<string, DiaNaoContavel> {
  const m = new Map<string, DiaNaoContavel>();
  for (const d of lista) if (!m.has(d.data)) m.set(d.data, d);
  return m;
}

const ehUtil = (iso: string, nao: Map<string, DiaNaoContavel>) =>
  !fimDeSemana(iso) && !nao.has(iso);

function seguinteUtil(iso: string, nao: Map<string, DiaNaoContavel>): string {
  let d = iso;
  for (let i = 0; i < LIMITE_DE_BUSCA; i++) {
    d = addDays(d, 1);
    if (ehUtil(d, nao)) return d;
  }
  throw new RangeError("Não há dia útil à vista: confira o cadastro de feriados.");
}

function anteriorUtil(iso: string, nao: Map<string, DiaNaoContavel>): string {
  let d = iso;
  for (let i = 0; i < LIMITE_DE_BUSCA; i++) {
    d = addDays(d, -1);
    if (ehUtil(d, nao)) return d;
  }
  throw new RangeError("Não há dia útil à vista: confira o cadastro de feriados.");
}

/** Entre `a` e `b` (exclusive) só há fim de semana? Então os dois são "dias seguidos" para o texto. */
function seguidos(a: string, b: string): boolean {
  for (let d = addDays(a, 1); d < b; d = addDays(d, 1)) if (!fimDeSemana(d)) return false;
  return true;
}

/** "21/12 a 20/01 (suspensão…)" para dias seguidos com o mesmo motivo; "12/10 (feriado…)" para um dia só. */
function textoDosPulados(pulados: readonly DiaNaoContavel[]): string {
  const grupos: { de: string; ate: string; motivo: string }[] = [];
  for (const p of pulados) {
    const g = grupos.at(-1);
    if (g && g.motivo === p.motivo && seguidos(g.ate, p.data)) g.ate = p.data;
    else grupos.push({ de: p.data, ate: p.data, motivo: p.motivo });
  }
  return grupos
    .map((g) =>
      g.de === g.ate
        ? `${fmtDiaMes(g.de)} (${g.motivo})`
        : `${fmtDiaMes(g.de)} a ${fmtDiaMes(g.ate)} (${g.motivo})`,
    )
    .join("; ");
}

/**
 * Calcula a data SUGERIDA do prazo e a memória de cálculo. Lança `RangeError` para entrada inválida (a tela valida
 * antes; a função não "conserta" a entrada nem chuta).
 */
export function calcularPrazo(e: EntradaDoCalculo): ResultadoDoCalculo {
  if (!ISO.test(e.disponibilizadoEm)) throw new RangeError("Data da disponibilização inválida.");
  if (!Number.isInteger(e.dias) || e.dias < 1 || e.dias > 365)
    throw new RangeError("O prazo deve ser de 1 a 365 dias.");
  const regra = REGRAS_DO_RITO[e.rito];
  const nao = indexar(e.naoContaveis);

  const publicadoEm = seguinteUtil(e.disponibilizadoEm, nao);
  const inicioEm = seguinteUtil(publicadoEm, nao);
  const diasContados = e.dias * (e.emDobro ? 2 : 1);

  let venceEm: string;
  let prorrogadoDe: string | null = null;
  if (regra.unidade === "uteis") {
    venceEm = inicioEm;
    for (let n = 1; n < diasContados; n++) venceEm = seguinteUtil(venceEm, nao);
  } else {
    venceEm = addDays(inicioEm, diasContados - 1);
    if (!ehUtil(venceEm, nao)) {
      prorrogadoDe = venceEm;
      venceEm = seguinteUtil(venceEm, nao);
    }
  }

  // o que foi pulado: feriados e suspensões em dia de semana, entre a disponibilização e o vencimento
  const pulados: DiaNaoContavel[] = [];
  for (let d = addDays(e.disponibilizadoEm, 1); d <= venceEm; d = addDays(d, 1)) {
    const n = nao.get(d);
    if (n && !fimDeSemana(d)) pulados.push(n);
  }

  const usadas: Regra[] = [REGRA_PUBLICACAO, regra];
  if (pulados.some((p) => p.regra === REGRA_SUSPENSAO_FIM_DE_ANO.id))
    usadas.push(REGRA_SUSPENSAO_FIM_DE_ANO);
  const confirmadas = new Set(e.confirmadas ?? []);
  const regrasPendentes = usadas.filter((r) => !r.validada && !confirmadas.has(r.id));

  const quanto =
    regra.unidade === "uteis"
      ? `${diasContados} dias úteis (${regra.nome}${e.emDobro ? ", em dobro" : ""})`
      : `${diasContados} dias corridos (${regra.nome}${e.emDobro ? ", em dobro" : ""})`;
  const partes = [
    `Disponibilizado ${fmtDiaSemana(e.disponibilizadoEm)} → publicado ${fmtDiaSemana(publicadoEm)} → início ${fmtDiaSemana(inicioEm)} → ${quanto} → ${fmtDiaSemana(venceEm)}.`,
  ];
  if (prorrogadoDe)
    partes.push(
      `O prazo vencia ${fmtDiaSemana(prorrogadoDe)}, sem expediente: prorrogado para o dia útil seguinte.`,
    );
  if (pulados.length > 0) partes.push(`Pulados: ${textoDosPulados(pulados)}.`);
  partes.push(`Regras ${PRAZO_REGRAS_V1}.`);

  return {
    versao: PRAZO_REGRAS_V1,
    publicadoEm,
    inicioEm,
    venceEm,
    unidade: regra.unidade,
    diasContados,
    pulados,
    prorrogadoDe,
    regrasPendentes,
    podePreencher: regrasPendentes.length === 0,
    memo: partes.join(" "),
  };
}

/**
 * Prazo interno (doc 11 §1 camada 6): o fatal menos `n` dias ÚTEIS (padrão 2). É a data que entra na fila como
 * "fazer até"; o fatal fica como linha de segurança. Nunca devolve data posterior ao fatal.
 */
export function prazoInterno(
  fatalEm: string,
  naoContaveis: readonly DiaNaoContavel[],
  n = 2,
): string {
  if (!ISO.test(fatalEm)) throw new RangeError("Data do prazo inválida.");
  if (!Number.isInteger(n) || n < 0 || n > 30)
    throw new RangeError("O recuo deve ser de 0 a 30 dias úteis.");
  const nao = indexar(naoContaveis);
  let d = fatalEm;
  for (let i = 0; i < n; i++) d = anteriorUtil(d, nao);
  return d;
}
