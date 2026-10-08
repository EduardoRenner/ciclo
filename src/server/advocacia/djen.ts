// Origem: LUBI src/lib/server/djen.server.ts @ db8aeac (docs/101 §8). Só rede: as regras de dado estão em core/advocacia/intimacoes.ts.
// Cliente do DJEN (Comunica PJe, API pública do CNJ, sem login): UMA consulta de um alvo (OAB+UF ou nome) num dia. Só rede; as regras
// de dado estão em src/lib/domain/motores/intimacoes.ts. A URL base é fixa (nada de endereço vindo de configuração ou de dado:
// sem SSRF) e `fetchImpl` é injetável para os testes nunca baterem na API real.
import { chaveDoAlvo, normalizarResposta, type Alvo } from "@/core/advocacia/intimacoes";

export const DJEN_BASE = "https://comunicaapi.pje.jus.br";
const ITENS_POR_PAGINA = 100;

export class DjenErro extends Error {
  constructor(
    readonly tipo: "http" | "rede" | "timeout" | "formato",
    mensagem: string,
    readonly status?: number,
  ) {
    super(mensagem);
    this.name = "DjenErro";
  }
}

export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string>; redirect: "error" },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface OpcoesDjen {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Teto de páginas por consulta (um dia, um alvo): o DJEN repete itens além do teto dele. */
  maxPaginas?: number;
}

export function urlDaConsulta(alvo: Alvo, dia: string, pagina: number): string {
  const q = new URLSearchParams();
  if (alvo.tipo === "oab") {
    q.set("numeroOab", alvo.numero);
    q.set("ufOab", alvo.uf);
  } else {
    q.set("nomeParte", alvo.nome);
  }
  // consulta por UM dia (nunca por período longo: o teto de paginação do DJEN corta o resto sem avisar)
  q.set("dataDisponibilizacaoInicio", dia);
  q.set("dataDisponibilizacaoFim", dia);
  q.set("itensPorPagina", String(ITENS_POR_PAGINA));
  q.set("pagina", String(pagina));
  return `${DJEN_BASE}/api/v1/comunicacao?${q.toString()}`;
}

const idDe = (item: unknown): string | null =>
  typeof item === "object" && item !== null && "id" in item
    ? String((item as { id: unknown }).id)
    : null;

/**
 * Todas as páginas de um alvo num dia. Devolve o `count` que o DJEN informa e os itens crus (a deduplicação e a validação são
 * do domínio). Para quando: veio tudo, a página veio vazia, ou uma página não trouxe NENHUM `id` novo (o DJEN repete itens).
 * Erro de HTTP, de rede, de tempo ou de formato vira `DjenErro` (a captura marca o dia como não conferido).
 */
export async function consultarDia(
  alvo: Alvo,
  dia: string,
  opcoes: OpcoesDjen = {},
): Promise<{ countFonte: number; brutos: unknown[] }> {
  const fetchImpl: FetchLike = opcoes.fetchImpl ?? ((url, init) => fetch(url, init));
  const timeoutMs = opcoes.timeoutMs ?? 15_000;
  const maxPaginas = opcoes.maxPaginas ?? 20;
  const brutos: unknown[] = [];
  const vistos = new Set<string>();
  let countFonte = 0;
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let corpo: unknown;
    try {
      const r = await fetchImpl(urlDaConsulta(alvo, dia, pagina), {
        signal: ctrl.signal,
        headers: { Accept: "application/json", "User-Agent": "LUBI-captura-intimacoes/1" },
        // a URL é fixa e a resposta nunca precisa de redirecionamento: seguir um levaria a captura para outro host
        redirect: "error",
      });
      if (!r.ok) throw new DjenErro("http", `DJEN respondeu HTTP ${r.status}`, r.status);
      corpo = await r.json();
    } catch (e) {
      if (e instanceof DjenErro) throw e;
      if (e instanceof SyntaxError) throw new DjenErro("formato", "a resposta do DJEN não é JSON");
      if (ctrl.signal.aborted) throw new DjenErro("timeout", "DJEN não respondeu a tempo");
      throw new DjenErro("rede", `falha de rede ao consultar ${chaveDoAlvo(alvo)}`);
    } finally {
      clearTimeout(timer);
    }
    const resp = normalizarResposta(corpo);
    if (!resp.ok)
      throw new DjenErro("formato", `resposta fora do formato esperado (${resp.motivo})`);
    countFonte = resp.count;
    let novos = 0;
    for (const item of resp.itens) {
      const id = idDe(item);
      // item sem `id` entra mesmo assim (o domínio o recusa e a contagem acusa); com `id` repetido, não conta como novo
      if (id === null || !vistos.has(id)) novos++;
      if (id !== null) vistos.add(id);
      brutos.push(item);
    }
    if (resp.itens.length === 0 || novos === 0 || vistos.size >= resp.count) break;
  }
  return { countFonte, brutos };
}
