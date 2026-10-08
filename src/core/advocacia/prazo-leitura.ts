// Origem: LUBI src/lib/domain/prazo-leitura.ts @ db8aeac (docs/101 §8, cópia versionada com teste próprio).
// Leitura do prazo no texto de uma intimação (plano mestre 11 §1, camada 3): DETERMINÍSTICA, em PT-BR, com `\p{L}` e
// a flag `u`. Acha "8 (oito) dias", confere o numeral com o extenso e devolve o trecho. Qualquer dúvida (mais de um
// prazo, numeral e extenso que não batem, prazo em horas, nenhum prazo) vira "leitura incerta": a pessoa digita o
// número de dias. A IA NÃO decide prazo; sem chute.

export type LeituraDoPrazo =
  | {
      certa: true;
      dias: number;
      /** O trecho do texto de onde saiu o número (para a tela destacar). */
      trecho: string;
      /** O texto diz "úteis" ou "corridos"? (o rito é quem define a regra; isto só é conferência.) */
      unidadeNoTexto: "uteis" | "corridos" | null;
    }
  | { certa: false; motivo: string; trechos: string[] };

const UNIDADES: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
};
const DEZENAS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();

/** "oito" → 8; "vinte e cinco" → 25; "cem" → 100; `null` se não entendo (nunca chuta). */
export function extensoParaNumero(extenso: string): number | null {
  const t = semAcento(extenso);
  if (t === "cem") return 100;
  if (t in UNIDADES) return UNIDADES[t]!;
  if (t in DEZENAS) return DEZENAS[t]!;
  const m = /^(\p{L}+) e (\p{L}+)$/u.exec(t);
  if (m && m[1]! in DEZENAS && m[2]! in UNIDADES && UNIDADES[m[2]!]! < 10)
    return DEZENAS[m[1]!]! + UNIDADES[m[2]!]!;
  return null;
}

interface Achado {
  dias: number;
  horas: boolean;
  trecho: string;
  divergente: boolean;
  unidade: "uteis" | "corridos" | null;
}

const NUMERAL_COM_EXTENSO =
  /(?<![\p{L}\p{N}])(\d{1,3})\s*\(\s*([\p{L}\s-]{2,40}?)\s*\)\s*(dias|dia|horas|hora)(?:\s+(úteis|uteis|corridos))?(?![\p{L}\p{N}])/giu;
const NUMERAL_SOZINHO =
  /(?<![\p{L}\p{N}])prazo\s+(?:comum\s+|sucessivo\s+)?de\s+(\d{1,3})\s+(dias|dia|horas|hora)(?:\s+(úteis|uteis|corridos))?(?![\p{L}\p{N}])/giu;

function unidade(s: string | undefined): Achado["unidade"] {
  if (!s) return null;
  return semAcento(s) === "corridos" ? "corridos" : "uteis";
}

/** Lê o prazo do texto (já sem HTML). Só devolve `certa: true` com UM prazo e numeral e extenso de acordo. */
export function lerPrazoDoTexto(texto: string): LeituraDoPrazo {
  const achados: Achado[] = [];
  const cobertos: [number, number][] = [];

  for (const m of texto.matchAll(NUMERAL_COM_EXTENSO)) {
    const numero = Number(m[1]);
    const dePorExtenso = extensoParaNumero(m[2]!);
    achados.push({
      dias: numero,
      horas: semAcento(m[3]!).startsWith("hora"),
      trecho: m[0],
      divergente: dePorExtenso === null || dePorExtenso !== numero,
      unidade: unidade(m[4]),
    });
    cobertos.push([m.index, m.index + m[0].length]);
  }
  for (const m of texto.matchAll(NUMERAL_SOZINHO)) {
    // "prazo de 8 (oito) dias" já foi lido acima; este só pega o numeral sem extenso
    if (cobertos.some(([a, b]) => m.index < b && m.index + m[0].length > a)) continue;
    achados.push({
      dias: Number(m[1]),
      horas: semAcento(m[2]!).startsWith("hora"),
      trecho: m[0],
      divergente: false,
      unidade: unidade(m[3]),
    });
  }

  const trechos = achados.map((a) => a.trecho);
  if (achados.length === 0)
    return { certa: false, motivo: "Não encontrei um prazo em dias no texto.", trechos };
  const distintos = new Set(achados.map((a) => `${a.dias}|${a.horas}`));
  if (distintos.size > 1)
    return {
      certa: false,
      motivo: "O texto traz mais de um prazo: digite o número de dias.",
      trechos,
    };
  const a = achados[0]!;
  if (a.horas)
    return { certa: false, motivo: "Prazo em horas não é calculado: digite a data.", trechos };
  if (achados.some((x) => x.divergente))
    return {
      certa: false,
      motivo: "O numeral e o número por extenso não batem: confira o texto.",
      trechos,
    };
  if (a.dias < 1 || a.dias > 365)
    return {
      certa: false,
      motivo: "O prazo lido está fora do esperado: digite o número de dias.",
      trechos,
    };
  return { certa: true, dias: a.dias, trecho: a.trecho, unidadeNoTexto: a.unidade };
}
