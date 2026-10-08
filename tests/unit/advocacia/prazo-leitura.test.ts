// Origem: LUBI tests/unit/prazo-leitura.test.ts @ db8aeac.
// D6 (plano mestre 11 §1, camada 3): a leitura do prazo no texto. Certa só com UM prazo e o numeral de acordo com o
// extenso; qualquer dúvida vira "leitura incerta" (a pessoa digita) — nunca chute.
import { describe, expect, it } from "vitest";
import { extensoParaNumero, lerPrazoDoTexto } from "@/core/advocacia/prazo-leitura";

describe("número por extenso", () => {
  it.each([
    ["um", 1],
    ["oito", 8],
    ["dez", 10],
    ["quinze", 15],
    ["dezenove", 19],
    ["vinte", 20],
    ["vinte e cinco", 25],
    ["trinta e um", 31],
    ["quarenta e cinco", 45],
    ["noventa e nove", 99],
    ["cem", 100],
    ["Três", 3],
    ["  QUATORZE ", 14],
    ["catorze", 14],
  ])("%s → %i", (texto, n) => {
    expect(extensoParaNumero(texto)).toBe(n);
  });

  it.each(["", "oitenta e dez", "vinte e", "e cinco", "zero", "quinhentos", "oito dias", "8"])(
    "'%s' não é entendido (nulo, nunca chute)",
    (texto) => {
      expect(extensoParaNumero(texto)).toBeNull();
    },
  );
});

describe("prazos que o texto diz com clareza", () => {
  it.each([
    [
      "Fica a parte intimada para se manifestar, no prazo de 8 (oito) dias, sobre o laudo.",
      8,
      null,
    ],
    [
      "Intime-se para emendar a inicial em 15 (quinze) dias úteis, sob pena de indeferimento.",
      15,
      "uteis",
    ],
    ["Cumpra-se no prazo de 5 (cinco) dias corridos.", 5, "corridos"],
    ["Manifeste-se em 10 (dez) dias.", 10, null],
    ["O réu deverá pagar em 30 (trinta) dias.", 30, null],
    ["prazo de 20 (vinte) dias para contrarrazões", 20, null],
    ["No prazo de 45 (quarenta e cinco) dias, junte o documento.", 45, null],
    ["Prazo de 3 dias para resposta.", 3, null],
    ["prazo comum de 5 dias úteis", 5, "uteis"],
    ["INTIME-SE, NO PRAZO DE 6 (SEIS) DIAS.", 6, null],
  ])("%s", (texto, dias, unidade) => {
    const l = lerPrazoDoTexto(texto);
    expect(l.certa, texto).toBe(true);
    if (l.certa) {
      expect(l.dias).toBe(dias);
      expect(l.unidadeNoTexto).toBe(unidade);
      expect(texto.toLowerCase()).toContain(l.trecho.toLowerCase());
    }
  });

  it("o mesmo prazo repetido (numeral+extenso e depois 'prazo de 8 dias') ainda é UM prazo", () => {
    const l = lerPrazoDoTexto(
      "Intimada para manifestar-se em 8 (oito) dias. Decorrido o prazo de 8 dias, voltem conclusos.",
    );
    expect(l.certa).toBe(true);
    if (l.certa) expect(l.dias).toBe(8);
  });
});

describe("leitura incerta: a pessoa digita (sem chute)", () => {
  const incerta = (texto: string) => {
    const l = lerPrazoDoTexto(texto);
    expect(l.certa, texto).toBe(false);
    return l.certa ? "" : l.motivo;
  };

  it("nenhum prazo no texto", () => {
    expect(incerta("Cite-se a parte ré para audiência.")).toBe(
      "Não encontrei um prazo em dias no texto.",
    );
    expect(incerta("")).toBe("Não encontrei um prazo em dias no texto.");
  });

  it("mais de um prazo diferente", () => {
    expect(incerta("Manifeste-se em 5 (cinco) dias e recorra em 15 (quinze) dias.")).toMatch(
      /mais de um prazo/,
    );
  });

  it("o numeral e o extenso divergem (erro de digitação no ato)", () => {
    expect(incerta("Intime-se no prazo de 8 (dez) dias.")).toMatch(/não batem/);
    expect(incerta("Intime-se no prazo de 15 (quinzee) dias.")).toMatch(/não batem/);
  });

  it("prazo em horas não é calculado", () => {
    expect(incerta("Cumpra-se em 48 (quarenta e oito) horas.")).toMatch(/horas/);
    expect(incerta("prazo de 24 horas")).toMatch(/horas/);
  });

  it("número fora do esperado", () => {
    expect(incerta("prazo de 0 (zero) dias")).toBeTruthy();
    expect(incerta("prazo de 400 dias")).toMatch(/fora do esperado/);
  });

  it("'dias' no meio de outra expressão não é prazo ('há 8 dias' / '30 dias de atraso')", () => {
    expect(incerta("O pagamento está em atraso há 30 dias.")).toBe(
      "Não encontrei um prazo em dias no texto.",
    );
  });
});

describe("controle: a leitura realmente depende do texto", () => {
  it("trocar o prazo no texto muda o resultado", () => {
    const a = lerPrazoDoTexto("Manifeste-se em 8 (oito) dias.");
    const b = lerPrazoDoTexto("Manifeste-se em 10 (dez) dias.");
    expect(a.certa && b.certa && a.dias !== b.dias).toBe(true);
  });
});
