// Origem: LUBI src/lib/domain/motores/intimacoes.ts @ db8aeac (docs/101 §8, cópia versionada com teste próprio).
// Motor M9 · Intimações (plano mestre 11-organizacao-e-motor-de-precisao.md §1 camadas 1 e 2, §5 M9). Funções PURAS, sem I/O e
// sem relógio escondido: o que é de rede (DJEN) está em src/lib/server/djen.server.ts e o que é de banco, na RPC
// `cron_intimacoes_gravar` (migration 0026). Aqui: quem consultar, quais dias, e como transformar a resposta do DJEN em dado
// confiável — texto sem HTML, número do processo só com dígitos, formato inesperado vira falha visível, nunca chute.
//
// Formato da API, medido em 06/10/2026 (resposta pública, sem login): `{status, message, count, items[]}`; cada item traz `id`
// (número), `hash`, `numero_processo` (20 dígitos), `data_disponibilizacao` (AAAA-MM-DD), `siglaTribunal`, `nomeOrgao`,
// `tipoComunicacao`, `nomeClasse`, `texto` (HTML), `link` (pode ser nulo), `destinatarios[{nome, polo}]`,
// `destinatarioadvogados[{advogado:{nome, numero_oab, uf_oab}}]`, `data_cancelamento`, `motivo_cancelamento`.
import { addDays } from "@/core/advocacia/datas";

export const VERSAO_M9 = 1;

export type Alvo = { tipo: "oab"; numero: string; uf: string } | { tipo: "nome"; nome: string };

/** Identificação estável do alvo (vai em `intimation_sync.alvo` e em `intimations.alvo`). */
export function chaveDoAlvo(a: Alvo): string {
  return a.tipo === "oab"
    ? `oab:${a.numero}/${a.uf}`
    : `nome:${a.nome.trim().replace(/\s+/g, " ").toUpperCase()}`;
}

export interface EquipeParaCaptura {
  id: string;
  active: boolean;
  role: string;
  oabNumber: string | null;
  oabUf: string | null;
}

const soDigitos = (s: string) => s.replace(/\D/g, "");

/**
 * Quem a captura consulta: OAB + UF de cada pessoa ATIVA que tem os dois campos (sem duplicar) e os nomes a monitorar
 * (sociedade, leiloeira). Pessoa ativa sem OAB ou sem UF sai em `semOab`: a tela de Configurações avisa
 * "N advogados sem OAB cadastrada: intimações deles não são capturadas" (nunca silencioso).
 */
export function alvosDaCaptura(
  equipe: readonly EquipeParaCaptura[],
  nomes: readonly string[],
): { alvos: Alvo[]; semOab: string[] } {
  const vistos = new Set<string>();
  const alvos: Alvo[] = [];
  const semOab: string[] = [];
  for (const p of equipe) {
    if (!p.active) continue;
    // só o papel "advogado" é cobrado pelo aviso; sócio com OAB preenchida é consultado, mas sócio sem OAB (que pode
    // não advogar) não deixa a vigia vermelha; estagiário e secretaria nunca são cobrados
    const advoga = p.role === "advogado";
    // OAB com letras ("12345-A", suplementar) ou mais de um número ("SC 12345 / PR 51234") é ambígua: não consulta e avisa
    const bruto = p.oabNumber ?? "";
    const ambigua = bruto !== "" && !/^[\d.\-\s]+$/.test(bruto);
    const numero = ambigua || !bruto ? "" : soDigitos(bruto);
    const uf = (p.oabUf ?? "").trim().toUpperCase();
    if (numero && /^[A-Z]{2}$/.test(uf)) {
      const a: Alvo = { tipo: "oab", numero, uf };
      if (!vistos.has(chaveDoAlvo(a))) {
        vistos.add(chaveDoAlvo(a));
        alvos.push(a);
      }
    } else if (advoga) {
      semOab.push(p.id);
    }
  }
  for (const n of nomes) {
    const nome = n.trim().replace(/\s+/g, " ");
    if (nome.length < 3) continue;
    const a: Alvo = { tipo: "nome", nome };
    if (!vistos.has(chaveDoAlvo(a))) {
      vistos.add(chaveDoAlvo(a));
      alvos.push(a);
    }
  }
  return { alvos, semOab };
}

/**
 * Dias a capturar para um alvo, a partir do que já foi registrado em `intimation_sync` (`registrados`: dia → ok).
 *  - nada registrado (alvo novo): só os últimos `primeiraJanela` dias (não importa o histórico inteiro do tribunal);
 *  - senão: TODO dia da janela, desde o primeiro registrado, que falta ou não fechou ok (uma falha de ontem é refeita hoje,
 *    nunca esquecida), e sempre ONTEM e HOJE (a publicação do dia continua chegando);
 *  - `reconferir`: dias dos últimos 7 que não foram conferidos há horas (o DJEN pode acrescentar ou cancelar comunicações de um
 *    dia já conferido; a recontagem diária de D-2 a D-7 pega o que a janela de ontem e hoje não pega);
 *  - mais de `maxDias` de atraso: captura só os últimos `maxDias` e avisa a lacuna (o resto precisa de conferência manual).
 */
export function diasParaCapturar(
  registrados: ReadonlyMap<string, boolean>,
  hoje: string,
  opcoes: { maxDias?: number; primeiraJanela?: number; reconferir?: ReadonlySet<string> } = {},
): { dias: string[]; lacuna: boolean } {
  const maxDias = opcoes.maxDias ?? 31;
  const primeiraJanela = opcoes.primeiraJanela ?? 3;
  const dias: string[] = [];
  // registro "no futuro" (relógio atrás do banco) não conta: sem nenhum registro até hoje o alvo é tratado como novo
  const registrado = [...registrados.keys()].filter((d) => d <= hoje).sort();
  if (registrado.length === 0) {
    for (let d = addDays(hoje, -(primeiraJanela - 1)); d <= hoje; d = addDays(d, 1)) dias.push(d);
    return { dias, lacuna: false };
  }
  const maisAntigoPermitido = addDays(hoje, -(maxDias - 1));
  const ultimo = registrado[registrado.length - 1];
  // parado há mais de `maxDias`: só dá para refazer a janela; o intervalo anterior é lacuna
  const lacuna = ultimo === undefined || ultimo < maisAntigoPermitido;
  const inicio = lacuna
    ? maisAntigoPermitido
    : (registrado.find((d) => d >= maisAntigoPermitido) ?? hoje);
  const ontem = addDays(hoje, -1);
  for (let d = inicio; d <= hoje; d = addDays(d, 1)) {
    if (registrados.get(d) !== true || d >= ontem || opcoes.reconferir?.has(d)) dias.push(d);
  }
  return { dias, lacuna };
}

const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ordm: "º",
  ordf: "ª",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  agrave: "à",
  acirc: "â",
  ecirc: "ê",
  ocirc: "ô",
  atilde: "ã",
  otilde: "õ",
  ccedil: "ç",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ccedil: "Ç",
};

/**
 * HTML do tribunal → texto puro, para guardar e mostrar. Nunca devolve marcação: o texto é renderizado como TEXTO (o React
 * escapa), então "&lt;script&gt;" continua sendo só letras. Ordem importa: tira `script`/`style` com conteúdo, troca quebras por
 * "\n", tira as tags e SÓ ENTÃO decodifica as entidades (uma vez), para uma entidade não virar tag.
 */
export function htmlParaTexto(html: string): string {
  // o corte vem ANTES de qualquer expressão regular: entrada gigante não pode travar o processo (custo linear, não quadrático)
  const comQuebras = tiraTags(semBlocos(html.slice(0, 400_000)));
  const decodificado = comQuebras.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,
    (m, e: string) => {
      if (e[0] === "#") {
        const cod =
          e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(cod) &&
          cod > 0 &&
          cod <= 0x10ffff &&
          !(cod >= 0xd800 && cod <= 0xdfff)
          ? String.fromCodePoint(cod)
          : " ";
      }
      return ENTIDADES[e] ?? m;
    },
  );
  return limpa(
    decodificado
      .replace(/[\u00a0\u2007\u202f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, " ")
      .split("\n")
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n"),
    200_000,
  );
}

/** Remove `<script>` e `<style>` COM o conteúdo, em uma passada (sem expressão regular com retrocesso). Sem fechamento: corta o resto. */
function semBlocos(html: string): string {
  const baixo = html.toLowerCase();
  let out = "";
  let i = 0;
  while (i < html.length) {
    const prox = [baixo.indexOf("<script", i), baixo.indexOf("<style", i)].filter((x) => x >= 0);
    if (prox.length === 0) {
      out += html.slice(i);
      break;
    }
    const ini = Math.min(...prox);
    out += html.slice(i, ini) + " ";
    const nome = baixo.startsWith("<script", ini) ? "script" : "style";
    const fim = baixo.indexOf(`</${nome}`, ini);
    if (fim < 0) break; // bloco aberto e nunca fechado: o resto é descartado
    const gt = baixo.indexOf(">", fim);
    i = gt < 0 ? html.length : gt + 1;
  }
  return out;
}

const INLINE = /^(b|i|u|em|strong|sup|sub|span|font|a|small|mark|abbr|cite|code)$/i;
const BLOCO = /^(p|div|li|tr|td|th|h[1-6]|table|ul|ol|br|blockquote|pre|section|article|hr)$/i;

/** Tags saem: as de TEXTO CORRIDO (negrito, sobrescrito...) viram "" (1<b>5</b> dias = "15 dias"); as de bloco viram quebra de linha. */
function tiraTags(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*|!)[^<>]*>/.exec(html.slice(lt, lt + 2000));
    if (!m) {
      out += "<"; // "<" solto (por exemplo "a < b") é texto: não apaga nada até o próximo ">"
      i = lt + 1;
      continue;
    }
    const nome = m[2] ?? "";
    out += INLINE.test(nome) ? "" : BLOCO.test(nome) ? "\n" : " ";
    i = lt + m[0].length;
  }
  return out;
}

export interface ComunicacaoNormalizada {
  djenId: number;
  hash: string | null;
  numeroProcesso: string;
  dataDisponibilizacao: string;
  tribunal: string;
  orgao: string | null;
  tipo: string | null;
  classe: string | null;
  texto: string;
  link: string | null;
  destinatarios: {
    tipo: "parte" | "advogado";
    nome: string;
    polo?: string;
    oab?: string;
    uf?: string;
  }[];
  canceladaEm: string | null;
  motivoCancelamento: string | null;
}

/**
 * Data de cancelamento do DJEN → ISO em UTC. Aceita só AAAA-MM-DD (com hora, segundos e fuso opcionais). Sem fuso, é horário de
 * Brasília (-03:00), nunca o do servidor. Qualquer outra forma, ou valor que não é texto nem nulo, é "invalida" (nunca vira data
 * aleatória: um cancelamento marcado por engano não se desfaz).
 */
export function cancelamento(v: unknown): string | null | "invalida" {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") return "invalida";
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(
      v.trim(),
    );
  if (!m) return "invalida";
  const [, y, mo, d, h = "00", mi = "00", se = "00", tz] = m;
  if (!dataValida(`${y}-${mo}-${d}`) || Number(h) > 23 || Number(mi) > 59 || Number(se) > 59)
    return "invalida";
  const fuso =
    tz === undefined
      ? "-03:00"
      : tz === "Z"
        ? "Z"
        : tz.length === 5
          ? `${tz.slice(0, 3)}:${tz.slice(3)}`
          : tz;
  const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${se}${fuso}`);
  return Number.isNaN(t) ? "invalida" : new Date(t).toISOString();
}

export type Normalizacao =
  { ok: true; comunicacao: ComunicacaoNormalizada } | { ok: false; motivo: string };

/** Caractere nulo e controles saem, par substituto solto vira U+FFFD (o banco recusa os dois) e o corte nunca racha um par. */
export function limpa(s: string, max: number): string {
  // Classe de controles escrita com escapes `\u`, nunca com o byte cru (guarda `sem-byte-de-controle-no-codigo`).
  const semControle = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  const cortada = semControle.slice(0, max);
  return cortada
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD")
    .trim();
}

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = limpa(v, max);
  return t ? t : null;
};

const dataValida = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  if (s < "2000-01-01" || s > "2100-01-01") return false; // a mesma faixa do banco
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Uma comunicação do DJEN → forma confiável. Campo obrigatório ausente ou fora do formato = recusa com o motivo (sem chute). */
export function normalizarComunicacao(raw: unknown): Normalizacao {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { ok: false, motivo: "item não é objeto" };
  const o = raw as Record<string, unknown>;
  const idBruto =
    typeof o.id === "number"
      ? o.id
      : typeof o.id === "string" && /^\d+$/.test(o.id)
        ? Number(o.id)
        : NaN;
  if (!Number.isSafeInteger(idBruto) || idBruto <= 0) return { ok: false, motivo: "id" };
  const numeroProcesso = typeof o.numero_processo === "string" ? soDigitos(o.numero_processo) : "";
  if (!/^\d{20}$/.test(numeroProcesso)) return { ok: false, motivo: "numero_processo" };
  const data =
    typeof o.data_disponibilizacao === "string" ? o.data_disponibilizacao.slice(0, 10) : "";
  if (!dataValida(data)) return { ok: false, motivo: "data_disponibilizacao" };
  const tribunal =
    typeof o.siglaTribunal === "string" ? limpa(o.siglaTribunal, 40).toUpperCase() : "";
  if (tribunal.length < 2 || tribunal.length > 20) return { ok: false, motivo: "siglaTribunal" };
  if (typeof o.texto !== "string") return { ok: false, motivo: "texto" };

  const destinatarios: ComunicacaoNormalizada["destinatarios"] = [];
  if (Array.isArray(o.destinatarios))
    for (const d of o.destinatarios) {
      const nome =
        d && typeof d === "object" ? texto((d as Record<string, unknown>).nome, 200) : null;
      if (nome) {
        const polo = texto((d as Record<string, unknown>).polo, 20);
        destinatarios.push({ tipo: "parte", nome, ...(polo ? { polo } : {}) });
      }
    }
  if (Array.isArray(o.destinatarioadvogados))
    for (const d of o.destinatarioadvogados) {
      const adv =
        d && typeof d === "object"
          ? ((d as Record<string, unknown>).advogado as Record<string, unknown> | undefined)
          : undefined;
      const nome = adv ? texto(adv.nome, 200) : null;
      if (nome) {
        const oab =
          typeof adv?.numero_oab === "string" || typeof adv?.numero_oab === "number"
            ? soDigitos(String(adv.numero_oab))
            : "";
        const uf = texto(adv?.uf_oab, 2);
        destinatarios.push({
          tipo: "advogado",
          nome,
          ...(oab ? { oab } : {}),
          ...(uf ? { uf: uf.toUpperCase() } : {}),
        });
      }
    }

  const link =
    typeof o.link === "string" && /^https:\/\//.test(o.link.trim())
      ? o.link.trim().slice(0, 500)
      : null;
  const cancel = cancelamento(o.data_cancelamento);
  if (cancel === "invalida") return { ok: false, motivo: "data_cancelamento" };
  const canceladaEm = cancel;

  return {
    ok: true,
    comunicacao: {
      djenId: idBruto,
      hash: texto(o.hash, 200),
      numeroProcesso,
      dataDisponibilizacao: data,
      tribunal,
      orgao: texto(o.nomeOrgao, 300),
      tipo: texto(o.tipoComunicacao, 120),
      classe: texto(o.nomeClasse, 200),
      texto: htmlParaTexto(o.texto),
      link,
      destinatarios,
      canceladaEm,
      motivoCancelamento: texto(o.motivo_cancelamento, 300),
    },
  };
}

export type RespostaNormalizada =
  { ok: true; count: number; itens: unknown[] } | { ok: false; motivo: string };

/** O corpo da resposta: `{status, count, items[]}`. Qualquer outra forma = "formato mudou" (a captura fica vermelha). */
export function normalizarResposta(corpo: unknown): RespostaNormalizada {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo))
    return { ok: false, motivo: "resposta não é objeto" };
  const o = corpo as Record<string, unknown>;
  // medido em 06/10/2026: {status: "success", ...}; um corpo de erro com HTTP 200 NÃO pode virar "dia vazio conferido"
  if (o.status !== "success") return { ok: false, motivo: "status" };
  if (typeof o.count !== "number" || !Number.isInteger(o.count) || o.count < 0)
    return { ok: false, motivo: "count" };
  if (!Array.isArray(o.items)) return { ok: false, motivo: "items" };
  return { ok: true, count: o.count, itens: o.items };
}

export interface DiaCapturado {
  /** Total que o DJEN informa para o alvo naquele dia. */
  countFonte: number;
  /** Comunicações distintas recebidas e bem formadas. */
  comunicacoes: ComunicacaoNormalizada[];
  /** Itens recusados por formato (motivo → quantidade). */
  invalidos: Record<string, number>;
  /** Quantas vezes o mesmo `id` veio repetido (o DJEN repete itens além do teto de paginação). */
  repetidos: number;
}

/** Um alvo num dia nunca passa de dezenas de comunicações (pico medido: 15). Acima disto, a consulta provavelmente não filtrou. */
export const TETO_POR_ALVO_E_DIA = 300;

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** O item é mesmo do alvo? OAB: o advogado com aquele número E aquela UF consta nos destinatários; nome: o nome consta. */
export function pertenceAoAlvo(c: ComunicacaoNormalizada, alvo: Alvo): boolean {
  if (alvo.tipo === "oab")
    return c.destinatarios.some(
      (d) => d.tipo === "advogado" && d.oab === alvo.numero && d.uf === alvo.uf,
    );
  const procurado = semAcento(alvo.nome);
  return c.destinatarios.some((d) => semAcento(d.nome).includes(procurado));
}

/**
 * Junta as páginas de um dia: deduplica por `id`, separa os malformados, confere que o item é do alvo (se o DJEN ignorar um filtro,
 * o que não é nosso NÃO entra: nada se apaga depois) e conta os repetidos. Volume acima do teto: não grava, o dia fica vermelho.
 */
export function consolidarDia(
  countFonte: number,
  brutos: readonly unknown[],
  alvo?: Alvo,
): DiaCapturado {
  const porId = new Map<number, ComunicacaoNormalizada>();
  const invalidos: Record<string, number> = {};
  let repetidos = 0;
  if (alvo && countFonte > TETO_POR_ALVO_E_DIA)
    return {
      countFonte,
      comunicacoes: [],
      invalidos: { volume_acima_do_esperado: countFonte },
      repetidos: 0,
    };
  for (const b of brutos) {
    const n = normalizarComunicacao(b);
    if (!n.ok) {
      invalidos[n.motivo] = (invalidos[n.motivo] ?? 0) + 1;
      continue;
    }
    if (alvo && !pertenceAoAlvo(n.comunicacao, alvo)) {
      invalidos.de_outro_alvo = (invalidos.de_outro_alvo ?? 0) + 1;
      continue;
    }
    if (porId.has(n.comunicacao.djenId)) repetidos++;
    else porId.set(n.comunicacao.djenId, n.comunicacao);
  }
  return { countFonte, comunicacoes: [...porId.values()], invalidos, repetidos };
}

/** Texto curto (≤ 300) da reconciliação do dia, para `intimation_sync.detalhe`: o que deu errado, sem dado do processo. */
export function detalheDoDia(d: DiaCapturado): string | null {
  const partes: string[] = [];
  if (d.comunicacoes.length !== d.countFonte)
    partes.push(`DJEN informa ${d.countFonte}, recebidas ${d.comunicacoes.length}`);
  const inv = Object.entries(d.invalidos);
  if (inv.length > 0)
    partes.push(`formato inesperado: ${inv.map(([k, n]) => `${k} (${n})`).join(", ")}`);
  if (d.repetidos > 0) partes.push(`${d.repetidos} repetidas pela API (teto de paginação)`);
  return partes.length > 0 ? partes.join("; ").slice(0, 300) : null;
}

/** O corpo da RPC `cron_intimacoes_gravar` para um alvo e um dia. `ok` = nenhum item recusado aqui; o banco ainda confere a contagem e as rejeições. */
export function corpoDaRpc(alvo: Alvo, dia: string, d: DiaCapturado) {
  return {
    alvo: chaveDoAlvo(alvo),
    dia,
    count_fonte: d.countFonte,
    ok: Object.keys(d.invalidos).length === 0,
    detalhe: detalheDoDia(d),
    itens: d.comunicacoes.map((c) => ({
      djen_id: c.djenId,
      hash: c.hash,
      numero_processo: c.numeroProcesso,
      data_disponibilizacao: c.dataDisponibilizacao,
      tribunal: c.tribunal,
      orgao: c.orgao,
      tipo: c.tipo,
      classe: c.classe,
      texto_sanitizado: c.texto,
      link: c.link,
      destinatarios: c.destinatarios,
      cancelled_at: c.canceladaEm,
      cancel_reason: c.motivoCancelamento,
    })),
  };
}

/** `00000000000000000000` → `0000000-00.0000.0.00.0000`, a máscara do CNJ que todo mundo lê. Fora disso, devolve igual. */
export function mascaraCnj(n: string): string {
  return /^\d{20}$/.test(n) ? `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14, 16)}.${n.slice(16)}` : n
}
