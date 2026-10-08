// Origem: LUBI tests/unit/prioridade.test.ts @ db8aeac.
// T2.2 (plano mestre 04 §3 e §4): a fórmula PRIORIDADE_V1. O exemplo numérico e os exemplos por área do documento
// viram teste: se o texto e o código divergirem, um dos dois está errado e o teste acusa.
import { describe, expect, it } from "vitest";
import { hojeNoFuso } from "@/core/advocacia/datas";
import {
  type FonteFila,
  GRUPOS,
  type ItemFila,
  ordenarFila,
  pontosDeAdiamento,
  pontosDeTempo,
  PRIORIDADE_V1,
  prioridade,
} from "@/core/advocacia/prioridade";

const DONO = "00000000-0000-4000-8000-0000000000a2";
let n = 0;
function item(
  source: FonteFila,
  due_on: string | null,
  extra: Partial<ItemFila> & { raw?: Record<string, unknown> } = {},
): ItemFila {
  n += 1;
  return {
    item_key: `${source}:${n}`,
    source,
    source_id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    account_id: "00000000-0000-4000-8000-00000000aaa1",
    matter_id: null,
    title: `Item ${n}`,
    owner_kind: "staff",
    owner_staff_id: DONO,
    due_on,
    raw: {},
    sensitivity: null,
    link: null,
    created_at: `2026-10-01T10:${String(n % 60).padStart(2, "0")}:00Z`,
    ...extra,
  };
}

describe("PRIORIDADE_V1 · peças", () => {
  it("pontos de tempo: atrasado 20 + 2 por dia (teto 40), hoje 20, 1–3 dias 12, 4–7 dias 6, depois e sem data 0", () => {
    expect(pontosDeTempo(-1)).toBe(22);
    expect(pontosDeTempo(-2)).toBe(24);
    expect(pontosDeTempo(-10)).toBe(40);
    expect(pontosDeTempo(-90)).toBe(40); // teto
    expect(pontosDeTempo(0)).toBe(20);
    expect(pontosDeTempo(1)).toBe(12);
    expect(pontosDeTempo(3)).toBe(12);
    expect(pontosDeTempo(4)).toBe(6);
    expect(pontosDeTempo(7)).toBe(6);
    expect(pontosDeTempo(8)).toBe(0);
    expect(pontosDeTempo(null)).toBe(0); // "sem data" nunca vira média escondida
  });

  it("adiamento: +5 por vez, teto 15", () => {
    expect([0, 1, 2, 3, 4, 9].map(pontosDeAdiamento)).toEqual([0, 5, 10, 15, 15, 15]);
    expect(pontosDeAdiamento(-2)).toBe(0);
  });

  it("os 8 grupos existem, na ordem fixa", () => {
    expect([...GRUPOS]).toEqual([
      "Sem responsável",
      "Atrasado",
      "Hoje",
      "Esta semana",
      "Aguardando cliente",
      "Aguardando terceiros",
      "Depois",
      "Sem data",
    ]);
  });
});

describe("PRIORIDADE_V1 · o exemplo do 04 §4 (hoje = 05/10/2026)", () => {
  const hoje = "2026-10-05";
  const contestacao = item("deadline", "2026-10-03", {
    title: "Contestação Ventura × Transp. Sul",
    raw: { kind: "fatal" },
  });
  const parcela = item("installment", "2026-10-01", { title: "Parcela 3/10 Moretti" });
  const minuta = item("task", "2026-10-03", {
    title: "Revisar minuta",
    raw: { status: "a_fazer", snooze_count: 3 },
  });
  const lead = item("lead", "2026-10-05", { title: "Lead urgente", raw: { urgente: true } });
  const rg = item("document_review", "2026-10-05", { title: "Conferir RG enviado pela cliente" });
  const audiencia = item("deadline", "2026-10-07", {
    title: "Audiência de conciliação",
    raw: { kind: "audiencia" },
  });
  const cartoes = item("client_action", "2026-10-07", {
    title: "Enviar cartões de ponto",
    owner_kind: "client",
    raw: { estado: "pendente", trava_prazo: true, prazos_travados: 1 },
  });

  const esperado: [ItemFila, number, number, string][] = [
    [contestacao, 1, 124, "Prazo fatal · 2 dias de atraso"],
    [parcela, 1, 68, "Parcela em atraso · 4 dias"],
    [minuta, 1, 69, "Tarefa · 2 dias de atraso · adiada 3 vezes"],
    [lead, 2, 80, "Lead novo · urgente · vence hoje"],
    [rg, 2, 75, "Documento para conferir · vence hoje"],
    [audiencia, 3, 102, "Audiência · em 2 dias"],
    [cartoes, 3, 92, "Cliente travando prazo · em 2 dias · trava 1 prazo"],
  ];

  it.each(esperado)("%#: grupo, score e motivo da tabela", (it_, grupo, score, motivo) => {
    const p = prioridade(it_, hoje);
    expect(p.grupo).toBe(grupo);
    expect(p.score).toBe(score);
    expect(p.motivo).toBe(motivo);
    expect(p.versao).toBe(PRIORIDADE_V1);
  });

  it("a ordem é Atrasado [124, 69, 68] → Hoje [80, 75] → Esta semana [102, 92]", () => {
    const ordem = ordenarFila([cartoes, rg, parcela, audiencia, minuta, lead, contestacao], hoje);
    expect(ordem.map((x) => x.prioridade.score)).toEqual([124, 69, 68, 80, 75, 102, 92]);
    expect(ordem.map((x) => x.prioridade.grupoNome)).toEqual([
      "Atrasado",
      "Atrasado",
      "Atrasado",
      "Hoje",
      "Hoje",
      "Esta semana",
      "Esta semana",
    ]);
    // "Por que a contestação é a primeira?" → grupo Atrasado + o motivo (Gate 4)
    expect(ordem[0]!.title).toBe("Contestação Ventura × Transp. Sul");
    expect(ordem[0]!.prioridade.motivo).toBe("Prazo fatal · 2 dias de atraso");
  });

  it("as pontas do motivo e os selos: atrasado, fatal, adiado e travando prazo", () => {
    expect(prioridade(contestacao, hoje).selos).toEqual(["atrasado", "fatal"]);
    expect(prioridade(cartoes, hoje).selos).toEqual(["travando prazo", "com o cliente"]);
    const adiada = item("task", "2026-10-03", {
      raw: { snooze_count: 1, snoozed_until: "2026-10-08" },
    });
    const p = prioridade(adiada, hoje);
    expect(p.selos).toContain("adiado"); // adiar não esconde atraso: continua no grupo Atrasado
    expect(p.grupo).toBe(1);
    expect(p.motivo).toBe("Tarefa · 2 dias de atraso · adiada 1 vez");
    // adiamento já vencido não carrega o selo
    expect(
      prioridade(item("task", "2026-10-03", { raw: { snoozed_until: "2026-10-04" } }), hoje).selos,
    ).not.toContain("adiado");
  });
});

describe("PRIORIDADE_V1 · os exemplos por área do 04 §8", () => {
  it("trabalhista, em 14/10: audiência 96 > pedido que trava a contestação 86 > minuta 36", () => {
    const hoje = "2026-10-14";
    const audiencia = item("deadline", "2026-10-20", { raw: { kind: "audiencia" } });
    const pedido = item("client_action", "2026-10-21", {
      owner_kind: "client",
      raw: { estado: "pendente", trava_prazo: true, prazos_travados: 1 },
    });
    const minuta = item("task", "2026-10-20", { raw: { status: "em_andamento" } });
    const ordem = ordenarFila([minuta, pedido, audiencia], hoje);
    expect(ordem.map((x) => x.prioridade.score)).toEqual([96, 86, 36]);
    expect(ordem.every((x) => x.prioridade.grupoNome === "Esta semana")).toBe(true);
  });

  it("previdenciário, a 5 dias: prazo fatal 106 > pedido que o trava 86", () => {
    const hoje = "2026-10-31";
    const prazo = item("deadline", "2026-11-05", { raw: { kind: "fatal" } });
    const pedido = item("client_action", "2026-11-05", {
      owner_kind: "client",
      raw: { estado: "pendente", trava_prazo: true, prazos_travados: 1 },
    });
    expect(ordenarFila([pedido, prazo], hoje).map((x) => x.prioridade.score)).toEqual([106, 86]);
  });

  it("família: o pedido que NÃO trava prazo fica em 'Aguardando cliente' e a tarefa de cartório em 'Aguardando terceiros'", () => {
    const hoje = "2026-10-14";
    const pedido = item("client_action", "2026-11-10", {
      owner_kind: "client",
      raw: { estado: "pendente", trava_prazo: false },
    });
    const cartorio = item("task", "2026-10-15", {
      raw: { status: "aguardando_terceiro", waiting_on: "cartório" },
    });
    expect(prioridade(pedido, hoje).grupoNome).toBe("Aguardando cliente");
    expect(prioridade(cartorio, hoje).grupoNome).toBe("Aguardando terceiros");
    // e uma tarefa em andamento do mesmo dia continua em "Esta semana"
    expect(
      prioridade(item("task", "2026-10-15", { raw: { status: "em_andamento" } }), hoje).grupoNome,
    ).toBe("Esta semana");
  });

  it("holding: a obrigação derivada (35) só sobe quando entra na janela de 7 dias", () => {
    const hoje = "2026-10-05";
    const longe = item("obligation", "2026-10-25", { raw: { rotulo: "Procuração vence" } });
    const perto = item("obligation", "2026-10-11", { raw: { rotulo: "Procuração vence" } });
    expect(prioridade(longe, hoje)).toMatchObject({ grupoNome: "Depois", score: 35 });
    expect(prioridade(perto, hoje)).toMatchObject({ grupoNome: "Esta semana", score: 41 });
  });
});

describe("PRIORIDADE_V1 · regras de grupo e de desempate", () => {
  const hoje = "2026-10-05";

  it("sem dono (ou dono inativo, que chega como null) vai para o grupo 0, mesmo atrasado", () => {
    const sem = item("deadline", "2026-09-01", { owner_staff_id: null, raw: { kind: "fatal" } });
    expect(prioridade(sem, hoje).grupo).toBe(0);
    const doCliente = item("client_action", "2026-10-20", {
      owner_kind: "client",
      owner_staff_id: null,
      raw: { estado: "pendente" },
    });
    expect(prioridade(doCliente, hoje).grupo).toBe(0);
  });

  it("sem data: grupo 7 e nenhum ponto de tempo", () => {
    const p = prioridade(item("task", null, { raw: { status: "a_fazer" } }), hoje);
    expect(p).toMatchObject({ grupo: 7, score: 30 });
    expect(p.partes.tempo).toBe(0);
    expect(p.motivo).toBe("Tarefa"); // sem "data" escondida
  });

  it("depois de 7 dias é 'Depois' e não ganha ponto de tempo", () => {
    expect(prioridade(item("task", "2026-10-13"), hoje)).toMatchObject({
      grupoNome: "Depois",
      score: 30,
    });
    expect(prioridade(item("task", "2026-10-12"), hoje)).toMatchObject({
      grupoNome: "Esta semana",
      score: 36,
    });
  });

  it("o pedido que o cliente já enviou volta para a equipe conferir (grupo pela data)", () => {
    const p = prioridade(
      item("client_action", "2026-10-06", { raw: { estado: "enviado", trava_prazo: false } }),
      hoje,
    );
    expect(p).toMatchObject({ grupoNome: "Esta semana", score: 67 });
    expect(p.motivo).toBe("Pedido para conferir · em 1 dia");
  });

  it("desempate estável: score → data mais cedo (sem data por último) → criação → chave", () => {
    const mesmo = (key: string, due: string | null, criado: string) =>
      item("task", due, { item_key: key, created_at: criado, raw: { status: "a_fazer" } });
    const a = mesmo("task:b", "2026-10-06", "2026-10-01T10:00:00Z");
    const b = mesmo("task:a", "2026-10-06", "2026-10-01T10:00:00Z"); // só a chave desempata
    const c = mesmo("task:z", "2026-10-06", "2026-09-30T10:00:00Z"); // criada antes
    expect(ordenarFila([a, b, c], hoje).map((x) => x.item_key)).toEqual([
      "task:z",
      "task:a",
      "task:b",
    ]);
    // a ordem não depende da ordem de entrada
    expect(ordenarFila([c, b, a], hoje).map((x) => x.item_key)).toEqual([
      "task:z",
      "task:a",
      "task:b",
    ]);
    // mesma pontuação e datas diferentes: a mais cedo primeiro
    const cedo = mesmo("task:cedo", "2026-10-07", "2026-10-02T10:00:00Z");
    const tarde = mesmo("task:tarde", "2026-10-09", "2026-10-01T10:00:00Z");
    expect(ordenarFila([tarde, cedo], hoje).map((x) => x.item_key)).toEqual([
      "task:cedo",
      "task:tarde",
    ]);
  });

  it("não altera a lista recebida", () => {
    const lista = [item("task", "2026-10-09"), item("task", "2026-10-06")];
    const copia = JSON.parse(JSON.stringify(lista));
    ordenarFila(lista, hoje);
    expect(lista).toEqual(copia);
  });

  it("campo ausente no raw não vira média: o peso vem do tipo e os extras valem zero", () => {
    const p = prioridade(
      item("client_action", "2026-10-06", { owner_kind: "client", raw: {} }),
      hoje,
    );
    expect(p.partes).toEqual({ peso: 30, tempo: 12, adiamento: 0, bloqueio: 0 });
  });
});

describe("hojeNoFuso(): o dia do tenant, não o do servidor", () => {
  it("às 23:30 de Brasília ainda é o mesmo dia (em UTC já é amanhã)", () => {
    expect(hojeNoFuso("America/Sao_Paulo", new Date("2026-10-06T02:30:00Z"))).toBe("2026-10-05"); // 23:30 BRT de 05/10
    expect(hojeNoFuso("America/Sao_Paulo", new Date("2026-10-06T03:00:00Z"))).toBe("2026-10-06"); // 00:00 BRT de 06/10
    expect(hojeNoFuso("America/Sao_Paulo", new Date("2026-10-05T14:00:00Z"))).toBe("2026-10-05");
  });
});

describe("o motivo do fatal com prazo interno (T11.4): o atraso do interno não passa por atraso do fatal", () => {
  it("mostra 'fazer até' e o fatal; passou do interno = 'passou do fazer até', não '1 dia de atraso'", () => {
    const hoje = "2026-10-06";
    const noPrazo = prioridade(
      item("deadline", "2026-10-07", {
        raw: { kind: "fatal", confirmado: true, fatal_due_on: "2026-10-09" },
      }),
      hoje,
    );
    expect(noPrazo.motivo).toBe("Prazo fatal · fazer até 07/10 · fatal 09/10");
    const passou = prioridade(
      item("deadline", "2026-10-05", {
        raw: { kind: "fatal", confirmado: true, fatal_due_on: "2026-10-08" },
      }),
      hoje,
    );
    expect(passou.motivo).toBe("Prazo fatal · passou do fazer até 05/10 · fatal 08/10");
    expect(passou.motivo).not.toMatch(/atraso/);
    // sem interno (fatal = data do item): o texto de sempre
    expect(
      prioridade(
        item("deadline", "2026-10-05", { raw: { kind: "fatal", fatal_due_on: "2026-10-05" } }),
        hoje,
      ).motivo,
    ).toBe("Prazo fatal · 1 dia de atraso");
  });
});
