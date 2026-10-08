// Origem: LUBI tests/unit/prioridade-sem-relogio.test.ts @ db8aeac.
// T2.2: a fórmula da fila é função PURA. O "hoje" entra por argumento; nenhum relógio escondido (Date.now(),
// new Date() sem argumento, hojeBrt()/todayISO() chamados lá dentro) pode decidir a ordem — senão o teste de
// às 23:30 e a demonstração (que usa a mesma função) deixam de ser reproduzíveis.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Tira comentários e textos entre aspas/crases: só o que é código executável sobra. */
function soCodigo(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n\r]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

const RELOGIO =
  /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bperformance\.now\s*\(|\b(?:hojeBrt|todayISO)\s*\(/;

describe("a fórmula da fila não lê o relógio", () => {
  it("controle positivo: o detector acusa um relógio plantado e ignora comentário e texto", () => {
    expect(RELOGIO.test(soCodigo("const a = Date.now();"))).toBe(true);
    expect(RELOGIO.test(soCodigo("const a = new Date();"))).toBe(true);
    expect(RELOGIO.test(soCodigo("const a = hojeBrt();"))).toBe(true);
    expect(RELOGIO.test(soCodigo("const a = new Date(x);"))).toBe(false); // com argumento é conversão, não relógio
    expect(RELOGIO.test(soCodigo("// usa Date.now() aqui\nconst a = 1;"))).toBe(false);
    expect(RELOGIO.test(soCodigo('const t = "new Date()";'))).toBe(false);
  });

  it("src/core/advocacia/prioridade.ts só usa o 'hoje' que recebe", () => {
    const fonte = readFileSync("src/core/advocacia/prioridade.ts", "utf8");
    expect(soCodigo(fonte)).not.toMatch(RELOGIO);
    // e continua exportando a versão e a função, para não passar vazio por arquivo errado
    expect(fonte).toContain("export const PRIORIDADE_V1");
    expect(fonte).toContain("export function prioridade(");
  });
});
