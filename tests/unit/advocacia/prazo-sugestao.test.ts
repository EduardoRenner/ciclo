// Origem: LUBI tests/unit/prazo-sugestao.test.ts @ db8aeac.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRAZO_REGRAS_V1,
  REGRA_PUBLICACAO,
  REGRA_SUSPENSAO_FIM_DE_ANO,
  REGRAS_DO_RITO,
  type Rito,
} from "@/core/advocacia/prazo-calculo";
import {
  diasNaoContaveis,
  sugerirPrazo,
  type FeriadoCadastrado,
} from "@/core/advocacia/prazo-sugestao";

// T11.3: a sugestão = leitura + cálculo + prazo interno. Calendário de outubro/2026: 05 seg, 06 ter, 07 qua, 12 seg (feriado nacional),
// 23 sex, 26 seg, 27 ter, 28 qua. Todas as datas esperadas foram contadas à mão neste arquivo (não saem da própria função).

const CONFIRMA_CIVEL = ["unidade-civel"];
const TEXTO = "Fica a parte intimada para manifestar-se no prazo de 15 (quinze) dias úteis.";
const nac = (day: string, name: string): FeriadoCadastrado => ({
  day,
  scope: "nacional",
  name,
  tribunal: null,
  comarca: null,
});

describe("a sugestão quando tudo é certo e confirmado", () => {
  it("seg 05/10 + 15 dias úteis: publicado ter 06, dia 1 = qua 07, vence ter 27/10; interno = 2 dias úteis antes (sex 23/10)", () => {
    const s = sugerirPrazo({
      texto: TEXTO,
      disponibilizadoEm: "2026-10-05",
      rito: "civel",
      emDobro: false,
      naoContaveis: [],
      confirmadas: CONFIRMA_CIVEL,
    });
    expect(s.sugerida).toBe("2026-10-27");
    if (s.sugerida === null) throw new Error("esperava sugestão");
    expect(s.interno).toBe("2026-10-23");
    expect(s.versao).toBe(PRAZO_REGRAS_V1);
    expect(s.memo).toMatchObject({
      publicado_em: "2026-10-06",
      inicio_em: "2026-10-07",
      vence_em: "2026-10-27",
      dias_lidos: 15,
      dias_contados: 15,
      unidade: "uteis",
      rito: "civel",
      em_dobro: false,
    });
    expect(String(s.memo.texto)).toMatch(/Regras prazo-regras-v1/);
  });

  it("o feriado nacional 12/10 empurra para qua 28/10 (interno seg 26/10); em dobro dobra a contagem", () => {
    const naoContaveis = diasNaoContaveis([nac("2026-10-12", "Nossa Senhora Aparecida")], "TJSC");
    const s = sugerirPrazo({
      texto: TEXTO,
      disponibilizadoEm: "2026-10-05",
      rito: "civel",
      emDobro: false,
      naoContaveis,
      confirmadas: CONFIRMA_CIVEL,
    });
    expect(s.sugerida).toBe("2026-10-28");
    if (s.sugerida === null) throw new Error("esperava sugestão");
    expect(s.interno).toBe("2026-10-26");
    const dobro = sugerirPrazo({
      texto: "no prazo de 5 (cinco) dias úteis",
      disponibilizadoEm: "2026-10-05",
      rito: "civel",
      emDobro: true,
      naoContaveis: [],
      confirmadas: CONFIRMA_CIVEL,
    });
    // início qua 07; 10 dias úteis: 7,8,9,12,13,14,15,16,19,20 → ter 20/10
    expect(dobro.sugerida).toBe("2026-10-20");
  });
});

describe("feriado por tribunal e comarca", () => {
  const f: FeriadoCadastrado[] = [
    nac("2026-10-12", "Nossa Senhora Aparecida"),
    {
      day: "2026-10-14",
      scope: "municipal",
      name: "Aniversário",
      tribunal: "TJSC",
      comarca: "Maravilha",
    },
    {
      day: "2026-10-15",
      scope: "estadual",
      name: "Dia do estado",
      tribunal: "TJPR",
      comarca: null,
    },
  ];
  const datas = (t: string, c: string | null) => diasNaoContaveis(f, t, c).map((d) => d.data);

  it("sem tribunal vale para todos; com tribunal, só para ele; com comarca, só para ela", () => {
    expect(datas("TJSC", "Maravilha")).toEqual(["2026-10-12", "2026-10-14"]);
    expect(datas("tjsc", "maravilha")).toEqual(["2026-10-12", "2026-10-14"]);
    expect(datas("TJSC", "Outra")).toEqual(["2026-10-12"]);
    expect(datas("TJSC", null)).toEqual(["2026-10-12"]);
    expect(datas("TJPR", null)).toEqual(["2026-10-12", "2026-10-15"]);
    expect(datas("TRT12", null)).toEqual(["2026-10-12"]);
  });

  it("o feriado municipal da comarca muda a data; o de outra comarca não", () => {
    const base = {
      texto: "prazo de 6 (seis) dias úteis",
      disponibilizadoEm: "2026-10-05",
      rito: "civel" as const,
      emDobro: false,
      confirmadas: CONFIRMA_CIVEL,
    };
    // início qua 07; sem 12/10 (nacional): 7,8,9,13,14,15 → qui 15/10; com 14/10 também fora: 7,8,9,13,15,16 → sex 16/10
    const comarca = sugerirPrazo({
      ...base,
      naoContaveis: diasNaoContaveis(f, "TJSC", "Maravilha"),
    });
    expect(comarca.sugerida).toBe("2026-10-16");
    const outra = sugerirPrazo({ ...base, naoContaveis: diasNaoContaveis(f, "TJSC", "Outra") });
    expect(outra.sugerida).toBe("2026-10-15");
  });
});

describe("quando NÃO há data sugerida (a pessoa digita, e a tela diz por quê)", () => {
  const ok = {
    texto: TEXTO,
    disponibilizadoEm: "2026-10-05",
    rito: "civel" as Rito | null,
    emDobro: false,
    naoContaveis: [],
    confirmadas: CONFIRMA_CIVEL,
  };

  it("regra do rito ainda não confirmada: sem sugestão, mas o cálculo e a memória existem para a tela", () => {
    const s = sugerirPrazo({ ...ok, confirmadas: [] });
    expect(s.sugerida).toBeNull();
    if (s.sugerida !== null) throw new Error("não devia sugerir");
    expect(s.motivo).toMatch(/Regra ainda não confirmada/);
    expect(s.calculo?.venceEm).toBe("2026-10-27");
  });

  it("rito não marcado no caso: sem sugestão (o rito nunca é inferido)", () => {
    const s = sugerirPrazo({ ...ok, rito: null });
    expect(s.sugerida).toBeNull();
    if (s.sugerida !== null) throw new Error("não devia sugerir");
    expect(s.motivo).toMatch(/rito/);
  });

  it("leitura incerta (nenhum prazo, dois prazos, horas, extenso que não bate): sem sugestão", () => {
    for (const texto of [
      "Intime-se.",
      "prazo de 5 (cinco) dias e de 10 (dez) dias",
      "no prazo de 48 horas",
      "prazo de 8 (nove) dias",
    ]) {
      const s = sugerirPrazo({ ...ok, texto });
      expect(s.sugerida, texto).toBeNull();
      if (s.sugerida !== null) throw new Error("não devia sugerir");
      expect(s.leitura.certa, texto).toBe(false);
    }
  });

  it("o texto diz 'corridos' mas o rito conta em úteis: sem sugestão", () => {
    const s = sugerirPrazo({ ...ok, texto: "no prazo de 15 (quinze) dias corridos" });
    expect(s.sugerida).toBeNull();
    if (s.sugerida !== null) throw new Error("não devia sugerir");
    expect(s.motivo).toMatch(/corridos.*úteis/);
  });

  it("data de disponibilização inválida: sem sugestão, sem lançar", () => {
    const s = sugerirPrazo({ ...ok, disponibilizadoEm: "ontem" });
    expect(s.sugerida).toBeNull();
  });
});

describe("recesso de fim de ano (suspensão: regra a confirmar)", () => {
  const recesso: FeriadoCadastrado[] = [];
  for (
    let d = new Date(Date.UTC(2026, 11, 20));
    d <= new Date(Date.UTC(2027, 0, 20));
    d.setUTCDate(d.getUTCDate() + 1)
  )
    recesso.push({
      day: d.toISOString().slice(0, 10),
      scope: "recesso",
      name: "Recesso forense (CPC, art. 220)",
      tribunal: null,
      comarca: null,
    });
  const base = {
    texto: "prazo de 5 (cinco) dias úteis",
    disponibilizadoEm: "2026-12-18", // sexta
    rito: "civel" as const,
    emDobro: false,
    naoContaveis: diasNaoContaveis(recesso, "TJSC"),
  };

  it("sem a confirmação da suspensão a data não vem preenchida, mesmo com a regra do rito confirmada", () => {
    expect(sugerirPrazo({ ...base, confirmadas: CONFIRMA_CIVEL }).sugerida).toBeNull();
  });

  it("com a suspensão confirmada: 20/12 a 20/01 não contam → publica qui 21/01, dia 1 = sex 22/01, vence qui 28/01", () => {
    const s = sugerirPrazo({
      ...base,
      confirmadas: [...CONFIRMA_CIVEL, REGRA_SUSPENSAO_FIM_DE_ANO.id],
    });
    // 22(1), 25(2), 26(3), 27(4), 28(5)
    expect(s.sugerida).toBe("2027-01-28");
  });
});

describe("o gabarito do advogado revisor e a trava das regras (dois modos, docs/101 §6.5)", () => {
  /*
   * No CICLO o repositório é PÚBLICO: o gabarito (50 intimações reais anonimizadas) nunca entra nele.
   * Ele mora fora, e o caminho vem por `LEGAL_GABARITO_PATH`. Os dois modos afirmam algo e nenhum pula:
   *  - com o arquivo: toda sugestão bate com a data calculada à mão (100%);
   *  - sem o arquivo: nenhuma regra de rito nem a suspensão está "validada", então nenhuma data vem
   *    pré-preenchida sem o sócio confirmar a regra (a trava do LUBI, R16).
   */
  type Caso = {
    id: string;
    texto: string;
    disponibilizadoEm: string;
    tribunal: string;
    comarca: string | null;
    rito: Rito;
    emDobro: boolean;
    feriados: FeriadoCadastrado[];
    confirmadas: string[];
    esperado: string;
  };
  const caminho = process.env.LEGAL_GABARITO_PATH;
  const g = caminho
    ? (JSON.parse(readFileSync(caminho, "utf8")) as { validadoPor: string | null; casos: Caso[] })
    : null;

  it(g ? "com o gabarito: todo caso bate com a sugestão (100%)" : "sem o gabarito: o modo vale e é declarado", () => {
    if (!g) {
      // Este caso não pula: afirma que não existe gabarito no repositório (que é público).
      expect(() => readFileSync("docs/gabarito/prazo-gabarito.json", "utf8")).toThrow();
      return;
    }
    expect(g.casos.length, "o arquivo do gabarito veio vazio").toBeGreaterThan(0);
    const erros = g.casos.filter((c) => {
      const s = sugerirPrazo({
        texto: c.texto,
        disponibilizadoEm: c.disponibilizadoEm,
        rito: c.rito,
        emDobro: c.emDobro,
        naoContaveis: diasNaoContaveis(c.feriados, c.tribunal, c.comarca),
        confirmadas: c.confirmadas,
      });
      return s.sugerida !== c.esperado;
    });
    expect(erros.map((c) => c.id)).toEqual([]);
  });

  it("enquanto não há gabarito completo validado, nenhuma regra de rito nem a suspensão está 'validada'", () => {
    const completo = g !== null && g.validadoPor !== null && g.casos.length >= 50;
    if (completo) return; // com o gabarito completo, o sócio decide quais regras passam a validadas
    for (const [rito, regra] of Object.entries(REGRAS_DO_RITO)) expect(regra.validada, `rito ${rito}`).toBe(false);
    expect(REGRA_SUSPENSAO_FIM_DE_ANO.validada).toBe(false);
    // a única regra validada por lei inequívoca é a da publicação (Lei 11.419 art. 4º)
    expect(REGRA_PUBLICACAO.validada).toBe(true);
  });
});

describe("achados da revisão do T11.3: onde a sugestão tem de se calar", () => {
  const base = {
    texto: TEXTO,
    disponibilizadoEm: "2026-10-05",
    rito: "civel" as Rito | null,
    emDobro: false,
    naoContaveis: [] as ReturnType<typeof diasNaoContaveis>,
    confirmadas: CONFIRMA_CIVEL,
  };

  it("comunicação que não é 'Intimação' (citação, edital) não segue a regra da publicação", () => {
    expect(sugerirPrazo({ ...base, tipoDaComunicacao: "Intimação" }).sugerida).toBe("2026-10-27");
    for (const tipo of ["Citação", "Edital", "Mandado"])
      expect(sugerirPrazo({ ...base, tipoDaComunicacao: tipo }).sugerida, tipo).toBeNull();
    expect(sugerirPrazo({ ...base, tipoDaComunicacao: null }).sugerida).toBe("2026-10-27");
  });

  it("texto com outro termo inicial (juntada, citação, ciência, trânsito) não é sugerido", () => {
    for (const texto of [
      "prazo de 15 (quinze) dias úteis, contados da juntada do mandado",
      "Citação: prazo de 15 (quinze) dias úteis para contestar",
      "prazo de 15 (quinze) dias úteis após a ciência da parte",
      "prazo de 15 (quinze) dias úteis do trânsito em julgado",
    ]) {
      const s = sugerirPrazo({ ...base, texto });
      expect(s.sugerida, texto).toBeNull();
      if (s.sugerida !== null) throw new Error("não devia sugerir");
      expect(s.motivo, texto).toMatch(/outro termo inicial/);
    }
    // palavra que só CONTÉM o termo não dispara (ex.: "mandadol" não existe, mas "edital" dentro de outra palavra)
    expect(
      sugerirPrazo({ ...base, texto: "prazo de 15 (quinze) dias úteis. Pauta editalícia" })
        .sugerida,
    ).toBe("2026-10-27");
  });

  it("prazo penal que atravessa o recesso NÃO é sugerido (corre sem suspensão), mesmo com tudo confirmado", () => {
    const f: FeriadoCadastrado[] = [];
    for (
      let d = new Date(Date.UTC(2026, 11, 20));
      d <= new Date(Date.UTC(2027, 0, 20));
      d.setUTCDate(d.getUTCDate() + 1)
    )
      f.push({
        day: d.toISOString().slice(0, 10),
        scope: "recesso",
        name: "Recesso",
        tribunal: null,
        comarca: null,
      });
    const s = sugerirPrazo({
      texto: "prazo de 3 (três) dias corridos",
      disponibilizadoEm: "2026-12-17",
      rito: "penal",
      emDobro: false,
      naoContaveis: diasNaoContaveis(f, "TJSC"),
      confirmadas: ["unidade-penal", "suspensao-fim-de-ano"],
    });
    expect(s.sugerida).toBeNull();
    if (s.sugerida !== null) throw new Error("não devia sugerir");
    expect(s.motivo).toMatch(/penal atravessa o recesso/);
  });

  it("prazo em dobro em juizado ou penal não é sugerido; no cível, sim", () => {
    for (const rito of ["jec", "penal"] as const) {
      const s = sugerirPrazo({
        ...base,
        rito,
        emDobro: true,
        texto: rito === "penal" ? "prazo de 5 (cinco) dias corridos" : TEXTO,
        confirmadas: [`unidade-${rito}`],
      });
      expect(s.sugerida, rito).toBeNull();
    }
    expect(sugerirPrazo({ ...base, emDobro: true }).sugerida).not.toBeNull();
  });

  it("a comarca casa sem acento nem caixa; o feriado de comarca não vale para quem não a informou", () => {
    const f: FeriadoCadastrado[] = [
      {
        day: "2026-10-14",
        scope: "municipal",
        name: "Aniversário",
        tribunal: "TJSP",
        comarca: "São Paulo",
      },
    ];
    expect(diasNaoContaveis(f, "TJSP", "Sao paulo").map((d) => d.data)).toEqual(["2026-10-14"]);
    expect(diasNaoContaveis(f, "tjsp", "SÃO PAULO").map((d) => d.data)).toEqual(["2026-10-14"]);
    expect(diasNaoContaveis(f, "TJSP", null)).toEqual([]);
  });

  it("a memória guarda quais regras estavam confirmadas na hora (prova de por que a data veio preenchida)", () => {
    const s = sugerirPrazo({ ...base, confirmadas: ["unidade-civel", "publicacao-diario"] });
    if (s.sugerida === null) throw new Error("esperava sugestão");
    expect(s.memo.regras_confirmadas).toEqual(["publicacao-diario", "unidade-civel"]);
  });
});
