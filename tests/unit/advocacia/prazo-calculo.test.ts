// Origem: LUBI tests/unit/prazo-calculo.test.ts @ db8aeac.
// D6 (plano mestre 11 §1, camadas 4 e 6): o cálculo do prazo da intimação e a memória de cálculo. Cada data foi
// contada À MÃO no calendário (os dias da semana estão nos comentários), não gerada pela função.
import { describe, expect, it } from "vitest";
import {
  calcularPrazo,
  type DiaNaoContavel,
  feriadosNacionaisFixos,
  PRAZO_REGRAS_V1,
  prazoInterno,
  REGRAS_DO_RITO,
  suspensaoDeFimDeAno,
} from "@/core/advocacia/prazo-calculo";
import { addDays, diaDaSemana } from "@/core/advocacia/datas";

const FERIADOS_2026 = feriadosNacionaisFixos(2026);
const CIVEL_TODAS_CONFIRMADAS = [
  "unidade-civel",
  "unidade-trabalhista",
  "unidade-penal",
  "unidade-jec",
];

describe("o exemplo do plano (doc 11 §1 camada 4)", () => {
  it("disponibilizado qui 02/10/2025 → publicado sex 03/10 → início seg 06/10 → 15 dias úteis → sex 24/10", () => {
    const r = calcularPrazo({
      disponibilizadoEm: "2025-10-02",
      dias: 15,
      rito: "civel",
      naoContaveis: feriadosNacionaisFixos(2025),
    });
    expect(r.publicadoEm).toBe("2025-10-03");
    expect(r.inicioEm).toBe("2025-10-06");
    expect(r.venceEm).toBe("2025-10-24");
    // 12/10/2025 é domingo: não é "pulado" (fim de semana não entra na lista)
    expect(r.pulados).toEqual([]);
    expect(r.memo).toBe(
      "Disponibilizado qui 02/10 → publicado sex 03/10 → início seg 06/10 → 15 dias úteis (cível) → sex 24/10. Regras prazo-regras-v1.",
    );
    expect(r.versao).toBe(PRAZO_REGRAS_V1);
  });
});

describe("feriado e fim de semana", () => {
  it("o feriado de segunda 12/10/2026 empurra o vencimento: sex 02/10 → pub seg 05/10 → início ter 06/10 → 15 úteis → ter 27/10", () => {
    // contagem: 6,7,8,9 (4) · 12 feriado · 13,14,15,16 (8) · 19,20,21,22,23 (13) · 26 (14), 27 (15)
    const r = calcularPrazo({
      disponibilizadoEm: "2026-10-02",
      dias: 15,
      rito: "civel",
      naoContaveis: FERIADOS_2026,
    });
    expect(r.publicadoEm).toBe("2026-10-05");
    expect(r.inicioEm).toBe("2026-10-06");
    expect(r.venceEm).toBe("2026-10-27");
    expect(r.pulados.map((p) => p.data)).toEqual(["2026-10-12"]);
    expect(r.memo).toContain("Pulados: 12/10 (feriado nacional: Nossa Senhora Aparecida).");
    // o controle: sem o feriado cadastrado, vence um dia útil antes
    const sem = calcularPrazo({
      disponibilizadoEm: "2026-10-02",
      dias: 15,
      rito: "civel",
      naoContaveis: [],
    });
    expect(sem.venceEm).toBe("2026-10-26");
    expect(sem.pulados).toEqual([]);
  });

  it("disponibilizado no sábado vale como na sexta: publica na segunda (o 1º dia útil depois)", () => {
    const sabado = calcularPrazo({
      disponibilizadoEm: "2026-10-03",
      dias: 5,
      rito: "civel",
      naoContaveis: [],
    });
    const sexta = calcularPrazo({
      disponibilizadoEm: "2026-10-02",
      dias: 5,
      rito: "civel",
      naoContaveis: [],
    });
    expect(sabado.publicadoEm).toBe("2026-10-05");
    expect(sabado.venceEm).toBe(sexta.venceEm);
  });

  it("a publicação e o início pulam o feriado: qui 08/10 → pub sex 09/10 → início ter 13/10 (seg 12 é feriado) → 5 úteis → seg 19/10", () => {
    // 13 (1) · 14 (2) · 15 (3) · 16 (4) · 19 (5)
    const r = calcularPrazo({
      disponibilizadoEm: "2026-10-08",
      dias: 5,
      rito: "civel",
      naoContaveis: FERIADOS_2026,
    });
    expect(r.publicadoEm).toBe("2026-10-09");
    expect(r.inicioEm).toBe("2026-10-13");
    expect(r.venceEm).toBe("2026-10-19");
    expect(r.pulados.map((p) => p.data)).toEqual(["2026-10-12"]);
  });

  it("o prazo em dobro é MARCAÇÃO do caso: 5 → 10 dias úteis, seg 26/10", () => {
    // 13,14,15,16 (4) · 19,20,21,22,23 (9) · 26 (10)
    const r = calcularPrazo({
      disponibilizadoEm: "2026-10-08",
      dias: 5,
      rito: "civel",
      emDobro: true,
      naoContaveis: FERIADOS_2026,
    });
    expect(r.diasContados).toBe(10);
    expect(r.venceEm).toBe("2026-10-26");
    expect(r.memo).toContain("10 dias úteis (cível, em dobro)");
  });
});

describe("dias corridos (penal)", () => {
  it("qua 07/10 → pub qui 08/10 → início sex 09/10 (dia 1) → 5 corridos → ter 13/10, sem prorrogação", () => {
    const r = calcularPrazo({
      disponibilizadoEm: "2026-10-07",
      dias: 5,
      rito: "penal",
      naoContaveis: FERIADOS_2026,
    });
    expect(r.venceEm).toBe("2026-10-13");
    expect(r.prorrogadoDe).toBeNull();
    expect(r.unidade).toBe("corridos");
  });

  it("vencendo em domingo, prorroga para o 1º dia útil (e pula o feriado de segunda 12/10): 3 corridos → ter 13/10", () => {
    const r = calcularPrazo({
      disponibilizadoEm: "2026-10-07",
      dias: 3,
      rito: "penal",
      naoContaveis: FERIADOS_2026,
    });
    expect(r.prorrogadoDe).toBe("2026-10-11");
    expect(r.venceEm).toBe("2026-10-13");
    expect(r.memo).toContain(
      "O prazo vencia dom 11/10, sem expediente: prorrogado para o dia útil seguinte.",
    );
    expect(r.memo).toContain("3 dias corridos (penal)");
  });
});

describe("suspensão de fim de ano (CPC art. 220)", () => {
  const nao: DiaNaoContavel[] = [...suspensaoDeFimDeAno(2026), ...feriadosNacionaisFixos(2026)];

  it("a suspensão tem 32 dias, de 20/12 a 20/01, e cada um aponta para a regra", () => {
    const s = suspensaoDeFimDeAno(2026);
    expect(s).toHaveLength(32);
    expect(s[0]!.data).toBe("2026-12-20");
    expect(s.at(-1)!.data).toBe("2027-01-20");
    expect(new Set(s.map((d) => d.regra))).toEqual(new Set(["suspensao-fim-de-ano"]));
  });

  it("sex 18/12/2026 → a publicação e o início só acontecem depois da suspensão: pub qui 21/01/2027, início sex 22/01, 5 úteis → qui 28/01", () => {
    // 22 (1) · 25 (2) · 26 (3) · 27 (4) · 28 (5)
    const r = calcularPrazo({
      disponibilizadoEm: "2026-12-18",
      dias: 5,
      rito: "civel",
      naoContaveis: nao,
    });
    expect(r.publicadoEm).toBe("2027-01-21");
    expect(r.inicioEm).toBe("2027-01-22");
    expect(r.venceEm).toBe("2027-01-28");
    // os dias úteis dentro da suspensão (inclusive o Natal) viram UMA faixa: a suspensão é a regra que vale
    expect(r.memo).toContain("Pulados: 21/12 a 20/01 (suspensão de fim de ano, CPC art. 220).");
  });

  it("os dias de suspensão em seguida viram uma faixa 'de a' no texto, não 20 linhas", () => {
    const r = calcularPrazo({
      disponibilizadoEm: "2026-12-18",
      dias: 5,
      rito: "civel",
      naoContaveis: suspensaoDeFimDeAno(2026),
    });
    expect(r.memo).toContain("Pulados: 21/12 a 20/01 (suspensão de fim de ano, CPC art. 220).");
  });
});

describe("regras ainda não validadas: a data é sugestão, não pré-preenchimento", () => {
  const base = { disponibilizadoEm: "2026-10-08", dias: 5, naoContaveis: FERIADOS_2026 };

  it("a contagem em dias úteis é [VALIDAR]: sem confirmação, não preenche e diz qual regra falta", () => {
    for (const rito of ["civel", "trabalhista", "jec", "penal"] as const) {
      const r = calcularPrazo({ ...base, rito });
      expect(r.podePreencher, rito).toBe(false);
      expect(r.regrasPendentes.map((x) => x.id)).toEqual([REGRAS_DO_RITO[rito].id]);
    }
  });

  it("confirmada a regra do rito, preenche; confirmar a de OUTRO rito não adianta", () => {
    expect(
      calcularPrazo({ ...base, rito: "civel", confirmadas: ["unidade-civel"] }).podePreencher,
    ).toBe(true);
    expect(
      calcularPrazo({ ...base, rito: "civel", confirmadas: ["unidade-trabalhista"] }).podePreencher,
    ).toBe(false);
  });

  it("a suspensão só é cobrada quando ela realmente cai na contagem", () => {
    const fora = calcularPrazo({
      ...base,
      rito: "civel",
      naoContaveis: [...suspensaoDeFimDeAno(2026), ...FERIADOS_2026],
    });
    expect(fora.regrasPendentes.map((x) => x.id)).toEqual(["unidade-civel"]);
    const dentro = calcularPrazo({
      disponibilizadoEm: "2026-12-18",
      dias: 5,
      rito: "civel",
      naoContaveis: suspensaoDeFimDeAno(2026),
    });
    expect(dentro.regrasPendentes.map((x) => x.id).sort()).toEqual([
      "suspensao-fim-de-ano",
      "unidade-civel",
    ]);
    const ok = calcularPrazo({
      disponibilizadoEm: "2026-12-18",
      dias: 5,
      rito: "civel",
      naoContaveis: suspensaoDeFimDeAno(2026),
      confirmadas: ["unidade-civel", "suspensao-fim-de-ano"],
    });
    expect(ok.podePreencher).toBe(true);
  });

  it("a regra de publicação tem fonte legal e está validada; nenhuma regra de rito está", () => {
    expect(
      calcularPrazo({ ...base, rito: "civel" }).regrasPendentes.map((x) => x.id),
    ).not.toContain("publicacao-diario");
    expect(Object.values(REGRAS_DO_RITO).every((r) => r.validada === false)).toBe(true);
  });
});

describe("entrada inválida não vira chute", () => {
  const ok = { disponibilizadoEm: "2026-10-08", dias: 5, rito: "civel" as const, naoContaveis: [] };
  it.each([
    ["data com barra", { disponibilizadoEm: "08/10/2026" }],
    ["data vazia", { disponibilizadoEm: "" }],
    ["zero dias", { dias: 0 }],
    ["dias negativos", { dias: -3 }],
    ["fração de dia", { dias: 2.5 }],
    ["mais de um ano", { dias: 366 }],
    ["não é número", { dias: Number.NaN }],
  ])("%s é recusada", (_nome, troca) => {
    expect(() => calcularPrazo({ ...ok, ...troca })).toThrow(RangeError);
  });
});

describe("propriedades (varrendo um ano inteiro de disponibilizações)", () => {
  const nao = [...feriadosNacionaisFixos(2026), ...feriadosNacionaisFixos(2027)];
  it("sempre: publicação > disponibilização, início > publicação, vencimento ≥ início, e dia útil quando a contagem é em úteis", () => {
    for (let k = 0; k < 365; k++) {
      const disp = addDays("2026-01-01", k);
      for (const dias of [1, 5, 15]) {
        const r = calcularPrazo({
          disponibilizadoEm: disp,
          dias,
          rito: "civel",
          naoContaveis: nao,
        });
        expect(r.publicadoEm > disp, disp).toBe(true);
        expect(r.inicioEm > r.publicadoEm, disp).toBe(true);
        expect(r.venceEm >= r.inicioEm, disp).toBe(true);
        expect([0, 6]).not.toContain(diaDaSemana(r.venceEm));
        expect(nao.some((n) => n.data === r.venceEm)).toBe(false);
      }
    }
  });

  it("mais dias nunca vence antes (monotonia) e o dobro vence depois", () => {
    for (let k = 0; k < 120; k += 3) {
      const disp = addDays("2026-03-01", k);
      let anterior = "";
      for (let dias = 1; dias <= 20; dias++) {
        const r = calcularPrazo({
          disponibilizadoEm: disp,
          dias,
          rito: "civel",
          naoContaveis: nao,
        });
        expect(r.venceEm >= anterior, `${disp} ${dias}`).toBe(true);
        anterior = r.venceEm;
        const dobro = calcularPrazo({
          disponibilizadoEm: disp,
          dias,
          rito: "civel",
          emDobro: true,
          naoContaveis: nao,
        });
        expect(dobro.venceEm > r.venceEm).toBe(true);
      }
    }
  });

  it("o prazo penal em dias corridos nunca vence em dia sem expediente", () => {
    for (let k = 0; k < 200; k++) {
      const disp = addDays("2026-01-01", k);
      const r = calcularPrazo({
        disponibilizadoEm: disp,
        dias: 3,
        rito: "penal",
        naoContaveis: nao,
      });
      expect([0, 6]).not.toContain(diaDaSemana(r.venceEm));
      expect(nao.some((n) => n.data === r.venceEm)).toBe(false);
    }
  });
});

describe("prazo interno (D-2 em dias úteis)", () => {
  it("fatal sex 23/10 → qua 21/10", () => {
    expect(prazoInterno("2026-10-23", FERIADOS_2026)).toBe("2026-10-21");
  });

  it("fatal ter 13/10: pula o fim de semana e o feriado de segunda 12/10 → qui 08/10", () => {
    // 13/10 → anterior útil: 12 (feriado), 11, 10 (fim de semana) → sex 09/10 (1) → qui 08/10 (2)
    expect(prazoInterno("2026-10-13", FERIADOS_2026)).toBe("2026-10-08");
    // sem o feriado cadastrado, só o fim de semana é pulado: seg 12 (1) · sex 09 (2)
    expect(prazoInterno("2026-10-13", [])).toBe("2026-10-09");
  });

  it("nunca é depois do fatal; recuo zero devolve o próprio fatal; recuo inválido é recusado", () => {
    for (let k = 0; k < 100; k++) {
      const fatal = addDays("2026-02-01", k);
      expect(prazoInterno(fatal, FERIADOS_2026) <= fatal).toBe(true);
    }
    expect(prazoInterno("2026-10-23", FERIADOS_2026, 0)).toBe("2026-10-23");
    expect(() => prazoInterno("2026-10-23", [], -1)).toThrow(RangeError);
    expect(() => prazoInterno("amanhã", [])).toThrow(RangeError);
  });
});

describe("controle: a lista de feriados altera o resultado (o cálculo não ignora o cadastro)", () => {
  it("o mesmo caso com e sem o feriado dá datas diferentes", () => {
    const entrada = { disponibilizadoEm: "2026-10-08", dias: 5, rito: "civel" as const };
    expect(calcularPrazo({ ...entrada, naoContaveis: [] }).venceEm).not.toBe(
      calcularPrazo({ ...entrada, naoContaveis: FERIADOS_2026 }).venceEm,
    );
  });
  it("todas as regras confirmadas ainda deixam a memória escrita (a pessoa sempre pode conferir)", () => {
    const r = calcularPrazo({
      disponibilizadoEm: "2026-10-08",
      dias: 5,
      rito: "civel",
      naoContaveis: FERIADOS_2026,
      confirmadas: CIVEL_TODAS_CONFIRMADAS,
    });
    expect(r.podePreencher).toBe(true);
    expect(r.memo.length).toBeGreaterThan(40);
  });
});
