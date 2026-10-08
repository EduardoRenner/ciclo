// Origem: LUBI tests/unit/motor-intimacoes.test.ts @ db8aeac.
import { describe, expect, it } from "vitest";
import {
  alvosDaCaptura,
  cancelamento,
  limpa,
  chaveDoAlvo,
  consolidarDia,
  corpoDaRpc,
  detalheDoDia,
  diasParaCapturar,
  htmlParaTexto,
  normalizarComunicacao,
  normalizarResposta,
  type EquipeParaCaptura,
} from "@/core/advocacia/intimacoes";

// T11.1 (plano mestre 11 §1 camadas 1-2, §5 M9): as regras puras da captura do DJEN, com o formato real da API medido em
// 06/10/2026. Calendário de outubro/2026: 05 seg, 06 ter, 07 qua, 08 qui.

const pessoa = (p: Partial<EquipeParaCaptura> & { id: string }): EquipeParaCaptura => ({
  active: true,
  role: "advogado",
  oabNumber: null,
  oabUf: null,
  ...p,
});

describe("quem a captura consulta", () => {
  it("chave estável: OAB+UF e nome sem espaços repetidos, em maiúsculas", () => {
    expect(chaveDoAlvo({ tipo: "oab", numero: "12345", uf: "SC" })).toBe("oab:12345/SC");
    expect(chaveDoAlvo({ tipo: "nome", nome: "  Maria   E  Exemplo " })).toBe(
      "nome:MARIA E EXEMPLO",
    );
  });

  it("só pessoa ATIVA com OAB e UF; número com máscara vira só dígitos; sem repetir", () => {
    const r = alvosDaCaptura(
      [
        pessoa({ id: "a", oabNumber: "12.345", oabUf: "sc" }),
        pessoa({ id: "b", oabNumber: "12345", oabUf: "SC" }), // a mesma OAB
        pessoa({ id: "c", oabNumber: "23456", oabUf: "SC", active: false }),
        pessoa({ id: "d", oabNumber: "34567", oabUf: "SC", role: "admin" }),
      ],
      [],
    );
    expect(r.alvos).toEqual([
      { tipo: "oab", numero: "12345", uf: "SC" },
      { tipo: "oab", numero: "34567", uf: "SC" },
    ]);
    expect(r.semOab).toEqual([]);
  });

  it("advogado e sócio ativos SEM OAB ou sem UF saem no aviso (nunca silencioso); sócio sem OAB, estagiário e secretaria não são cobrados", () => {
    const r = alvosDaCaptura(
      [
        pessoa({ id: "adv-sem-numero", oabUf: "SC" }),
        pessoa({ id: "adv-sem-uf", oabNumber: "123" }),
        pessoa({ id: "socio-sem", role: "admin" }),
        pessoa({ id: "estagiario", role: "estagiario" }),
        pessoa({ id: "secretaria", role: "assistente" }),
        pessoa({ id: "inativo", active: false }),
      ],
      [],
    );
    expect(r.alvos).toEqual([]);
    expect(r.semOab.sort()).toEqual(["adv-sem-numero", "adv-sem-uf"]);
  });

  it("UF inválida não vira consulta", () => {
    expect(alvosDaCaptura([pessoa({ id: "x", oabNumber: "1", oabUf: "SCC" })], []).alvos).toEqual(
      [],
    );
  });

  it("nomes a monitorar: aparados, sem repetir, curtos demais ignorados", () => {
    const r = alvosDaCaptura([], ["  EXEMPLO ADVOGADOS  ", "exemplo   advogados", "ab", "MARIA EXEMPLO"]);
    expect(r.alvos).toEqual([
      { tipo: "nome", nome: "EXEMPLO ADVOGADOS" },
      { tipo: "nome", nome: "MARIA EXEMPLO" },
    ]);
  });
});

describe("quais dias capturar", () => {
  const hoje = "2026-10-07"; // quarta
  it("alvo novo: só os últimos 3 dias, não o histórico do tribunal", () => {
    expect(diasParaCapturar(new Map(), hoje).dias).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ]);
  });
  it("tudo em dia até anteontem: refaz ontem e hoje (a publicação do dia continua chegando)", () => {
    const r = new Map([
      ["2026-10-04", true],
      ["2026-10-05", true],
    ]);
    expect(diasParaCapturar(r, hoje).dias).toEqual(["2026-10-06", "2026-10-07"]);
  });
  it("um dia que falhou antes é refeito, não esquecido; dia que falta também", () => {
    const r = new Map([
      ["2026-10-02", true],
      ["2026-10-03", false], // falhou
      ["2026-10-05", true], // 04 nunca foi registrado
      ["2026-10-06", true],
    ]);
    expect(diasParaCapturar(r, hoje).dias).toEqual([
      "2026-10-03",
      "2026-10-04",
      "2026-10-06",
      "2026-10-07",
    ]);
  });
  it("parado há mais de 31 dias: captura só os últimos 31 e AVISA a lacuna", () => {
    const r = diasParaCapturar(new Map([["2026-08-01", true]]), hoje);
    expect(r.lacuna).toBe(true);
    expect(r.dias).toHaveLength(31);
    expect(r.dias[0]).toBe("2026-09-07");
    expect(r.dias[30]).toBe("2026-10-07");
  });
  it("registro só no futuro (relógio atrás) é ignorado: o alvo é tratado como novo (últimos 3 dias)", () => {
    const r = diasParaCapturar(new Map([["2026-10-20", true]]), hoje);
    expect(r.dias).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
  });
});

describe("HTML do tribunal → texto", () => {
  it("tira marcação, vira quebras de linha e decodifica entidades UMA vez", () => {
    const html =
      "<p>Intime-se&nbsp;a parte&nbsp;para manifestação em <b>15 (quinze)</b> dias.</p><br/><div>Maravilha&#47;SC &amp; regi&#227;o</div>";
    expect(htmlParaTexto(html)).toBe(
      "Intime-se a parte para manifestação em 15 (quinze) dias.\n\nMaravilha/SC & região",
    );
  });
  it("script e style somem COM o conteúdo; entidade nunca vira tag (fica como texto)", () => {
    const html =
      '<style>p{color:red}</style><script type="text/javascript">alert(1)</script>Texto &lt;b&gt;limpo&lt;/b&gt;';
    expect(htmlParaTexto(html)).toBe("Texto <b>limpo</b>");
    expect(htmlParaTexto("&amp;lt;x&amp;gt;")).toBe("&lt;x&gt;"); // &amp;lt; não decodifica de novo
  });
  it("acentos, ºª, entidades numéricas e hexa; código inválido ou substituto vira espaço", () => {
    expect(htmlParaTexto("N&ordm; 12 &aacute;&ccedil;&#xE3;o &#231; &#0; &#xD800;fim")).toBe(
      "Nº 12 áção ç fim",
    );
  });
  it("entidade numérica fora da faixa vira espaço (zero, acima de U+10FFFF, enorme), sem derrubar a leitura", () => {
    expect(htmlParaTexto("a&#0;b")).toBe("a b");
    expect(htmlParaTexto("a&#1114112;b")).toBe("a b");
    expect(htmlParaTexto("a&#99999999999999;b")).toBe("a b");
    expect(htmlParaTexto("a&#x110000;b")).toBe("a b");
    expect(htmlParaTexto("a&#1114111;b").length).toBeGreaterThan(2); // o último código válido passa
  });
  it("controles somem; espaços e linhas em branco se compactam; entidade desconhecida fica como veio", () => {
    expect(htmlParaTexto("a\u0000b\u0007c   d\n\n\n\n\ne &zzz;")).toBe("abc d\n\ne &zzz;");
  });
  it("tamanho limitado a 200 mil caracteres", () => {
    expect(htmlParaTexto("x".repeat(300_000))).toHaveLength(200_000);
  });
});

/** Um item no formato real da API (campos medidos em 06/10/2026). */
const real = (extra: Record<string, unknown> = {}) => ({
  id: 123456789,
  data_disponibilizacao: "2026-10-06",
  siglaTribunal: "TJSC",
  tipoComunicacao: "Intimação",
  nomeOrgao: "Vara de Maravilha",
  idOrgao: 55,
  texto: "<p>Intime-se para manifestação em 15 dias.</p>",
  numero_processo: "00012345620268240001",
  meio: "D",
  link: null,
  tipoDocumento: "Despacho",
  nomeClasse: "Procedimento Comum Cível",
  codigoClasse: "7",
  numeroComunicacao: 1,
  ativo: true,
  hash: "abc123",
  status: "P",
  motivo_cancelamento: null,
  data_cancelamento: null,
  datadisponibilizacao: "06/10/2026",
  meiocompleto: "Diário",
  numeroprocessocommascara: "0001234-56.2026.8.24.0001",
  destinatarios: [{ nome: "FULANO DE TAL", polo: "A" }],
  destinatarioadvogados: [
    { advogado: { nome: "ADVOGADA EXEMPLO DE TAL", numero_oab: "12345", uf_oab: "SC" } },
  ],
  ...extra,
});

describe("uma comunicação do DJEN", () => {
  it("formato real → forma confiável (texto sem HTML, só dígitos no processo, partes e advogados)", () => {
    const n = normalizarComunicacao(real());
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.comunicacao).toMatchObject({
      djenId: 123456789,
      numeroProcesso: "00012345620268240001",
      dataDisponibilizacao: "2026-10-06",
      tribunal: "TJSC",
      orgao: "Vara de Maravilha",
      tipo: "Intimação",
      classe: "Procedimento Comum Cível",
      texto: "Intime-se para manifestação em 15 dias.",
      link: null,
      canceladaEm: null,
    });
    expect(n.comunicacao.destinatarios).toEqual([
      { tipo: "parte", nome: "FULANO DE TAL", polo: "A" },
      { tipo: "advogado", nome: "ADVOGADA EXEMPLO DE TAL", oab: "12345", uf: "SC" },
    ]);
  });
  it("número do processo com máscara vira 20 dígitos; id numérico em texto é aceito", () => {
    const n = normalizarComunicacao(
      real({ id: "999", numero_processo: "0001234-56.2026.8.24.0001" }),
    );
    expect(n.ok && n.comunicacao.numeroProcesso).toBe("00012345620268240001");
    expect(n.ok && n.comunicacao.djenId).toBe(999);
  });
  it("campo obrigatório ausente ou fora do formato é RECUSADO com o motivo (nunca chute)", () => {
    const casos: [string, Record<string, unknown>][] = [
      ["id", { id: null }],
      ["id", { id: 0 }],
      ["id", { id: "abc" }],
      ["numero_processo", { numero_processo: "123" }],
      ["numero_processo", { numero_processo: undefined }],
      ["data_disponibilizacao", { data_disponibilizacao: "06/10/2026" }],
      ["data_disponibilizacao", { data_disponibilizacao: "2026-02-30" }],
      ["siglaTribunal", { siglaTribunal: "" }],
      ["texto", { texto: null }],
      ["data_cancelamento", { data_cancelamento: "ontem" }],
    ];
    for (const [motivo, extra] of casos) {
      const n = normalizarComunicacao(real(extra));
      expect(n.ok, `${motivo} ${JSON.stringify(extra)}`).toBe(false);
      if (!n.ok) expect(n.motivo).toBe(motivo);
    }
    for (const naoObjeto of [null, undefined, 7, "x", []])
      expect(normalizarComunicacao(naoObjeto).ok).toBe(false);
  });
  it("cancelamento vira data ISO; link só https; datas com hora são cortadas no dia", () => {
    const n = normalizarComunicacao(
      real({
        data_cancelamento: "2026-10-06T15:30:00",
        motivo_cancelamento: "Publicada por engano",
        link: "https://pje.tjsc.jus.br/x",
        data_disponibilizacao: "2026-10-06T00:00:00",
      }),
    );
    expect(n.ok && n.comunicacao.canceladaEm).toMatch(/^2026-10-06T\d\d:30:00\.000Z$/);
    expect(n.ok && n.comunicacao.motivoCancelamento).toBe("Publicada por engano");
    expect(n.ok && n.comunicacao.link).toBe("https://pje.tjsc.jus.br/x");
    expect(n.ok && n.comunicacao.dataDisponibilizacao).toBe("2026-10-06");
    const http = normalizarComunicacao(real({ link: "http://inseguro.test" }));
    expect(http.ok && http.comunicacao.link).toBeNull();
  });
  it("destinatário sem nome é ignorado, não derruba a comunicação", () => {
    const n = normalizarComunicacao(
      real({
        destinatarios: [{ polo: "A" }, null, { nome: "  " }, { nome: "OK" }],
        destinatarioadvogados: [{}, { advogado: null }],
      }),
    );
    expect(n.ok && n.comunicacao.destinatarios).toEqual([{ tipo: "parte", nome: "OK" }]);
  });
});

describe("a resposta da API", () => {
  it("{status, message, count, items[]} é o formato; qualquer outro é 'formato mudou'", () => {
    expect(
      normalizarResposta({ status: "success", message: "Sucesso", count: 2, items: [{}, {}] }),
    ).toEqual({ ok: true, count: 2, itens: [{}, {}] });
    for (const ruim of [
      null,
      [],
      "x",
      {},
      { count: 1 },
      { items: [] },
      { count: -1, items: [] },
      { count: 1.5, items: [] },
      { count: "2", items: [] },
      { count: 1, items: {} },
    ])
      expect(normalizarResposta(ruim).ok, JSON.stringify(ruim)).toBe(false);
  });
});

describe("o dia consolidado e a reconciliação", () => {
  it("deduplica por id (o DJEN repete itens além do teto), separa os malformados e conta cada coisa", () => {
    const d = consolidarDia(5, [
      real({ id: 1 }),
      real({ id: 2 }),
      real({ id: 1 }),
      real({ id: 3, numero_processo: "x" }),
      real({ id: 4, texto: null }),
    ]);
    expect(d.comunicacoes.map((c) => c.djenId)).toEqual([1, 2]);
    expect(d.repetidos).toBe(1);
    expect(d.invalidos).toEqual({ numero_processo: 1, texto: 1 });
    expect(detalheDoDia(d)).toBe(
      "DJEN informa 5, recebidas 2; formato inesperado: numero_processo (1), texto (1); 1 repetidas pela API (teto de paginação)",
    );
  });
  it("dia redondo: contagem bate, nada repetido, nada malformado → sem detalhe e ok", () => {
    const d = consolidarDia(2, [real({ id: 1 }), real({ id: 2 })]);
    expect(detalheDoDia(d)).toBeNull();
    expect(corpoDaRpc({ tipo: "oab", numero: "12345", uf: "SC" }, "2026-10-06", d)).toMatchObject({
      alvo: "oab:12345/SC",
      dia: "2026-10-06",
      count_fonte: 2,
      ok: true,
      detalhe: null,
    });
  });
  it("com item malformado o corpo da RPC sai com ok=false, e o detalhe nunca leva texto do processo", () => {
    const d = consolidarDia(1, [
      real({ id: 1, numero_processo: "x", texto: "SEGREDO DE JUSTIÇA" }),
    ]);
    const c = corpoDaRpc({ tipo: "nome", nome: "EXEMPLO ADVOGADOS" }, "2026-10-06", d);
    expect(c.ok).toBe(false);
    expect(c.alvo).toBe("nome:EXEMPLO ADVOGADOS");
    expect(JSON.stringify(c)).not.toContain("SEGREDO");
    expect(c.detalhe!.length).toBeLessThanOrEqual(300);
  });
  it("o corpo da RPC leva os campos que a migration espera", () => {
    const d = consolidarDia(1, [real({ id: 7 })]);
    const item = corpoDaRpc({ tipo: "oab", numero: "1", uf: "SC" }, "2026-10-06", d).itens[0]!;
    expect(Object.keys(item).sort()).toEqual(
      [
        "cancel_reason",
        "cancelled_at",
        "classe",
        "data_disponibilizacao",
        "destinatarios",
        "djen_id",
        "hash",
        "link",
        "numero_processo",
        "orgao",
        "texto_sanitizado",
        "tipo",
        "tribunal",
      ].sort(),
    );
  });
});

describe("correções do revisor do M9", () => {
  it("cancelamento estrito: só AAAA-MM-DD[ hora]; sem fuso é Brasília; lixo é inválido", () => {
    expect(cancelamento(null)).toBeNull();
    expect(cancelamento("2026-10-06T14:00:00")).toBe("2026-10-06T17:00:00.000Z");
    expect(cancelamento("2026-10-06")).toBe("2026-10-06T03:00:00.000Z");
    expect(cancelamento("2026-10-06T14:00:00Z")).toBe("2026-10-06T14:00:00.000Z");
    for (const ruim of ["ontem", "06/10/2026", "2026-13-40", 20261006, {}, "2026-10-06T25:00:00"])
      expect(cancelamento(ruim)).toBe("invalida");
  });

  it("limpa: tira nulo e controle, troca par substituto solto, nunca racha um par", () => {
    expect(limpa("a\u0000b\u0001c", 10)).toBe("abc");
    expect(limpa("x\uD800y", 10)).toBe("x�y");
    expect(limpa("ab😀", 3)).toBe("ab�");
  });

  it("resposta sem status 'success' é formato mudado", () => {
    expect(normalizarResposta({ status: "error", count: 0, items: [] }).ok).toBe(false);
    expect(normalizarResposta({ status: "success", count: 0, items: [] }).ok).toBe(true);
  });

  it("OAB ambígua (letras ou vários números) não vira alvo", () => {
    const r = alvosDaCaptura(
      [
        pessoa({ id: "a", oabNumber: "12 e 34", oabUf: "SC" }),
        pessoa({ id: "b", oabNumber: "12A", oabUf: "SC" }),
      ],
      [],
    );
    expect(r.alvos).toEqual([]);
    expect(r.semOab.sort()).toEqual(["a", "b"]);
  });
});

describe("mutantes sobreviventes do M9", () => {
  const alvoOab = { tipo: "oab", numero: "12345", uf: "SC" } as const;
  const bruto = (id: number, extra: Record<string, unknown> = {}) => ({
    id,
    data_disponibilizacao: "2026-10-06",
    siglaTribunal: "TJSC",
    numero_processo: "00012345620268240001",
    texto: "<p>Intime-se</p>",
    destinatarioadvogados: [{ advogado: { nome: "A", numero_oab: "12345", uf_oab: "SC" } }],
    ...extra,
  });

  it("reconferência: dia já conferido volta à fila só se estiver no conjunto `reconferir`", () => {
    const reg = new Map([
      ["2026-10-02", true],
      ["2026-10-03", true],
      ["2026-10-04", true],
      ["2026-10-05", true],
      ["2026-10-06", true],
    ]);
    expect(diasParaCapturar(reg, "2026-10-07").dias).toEqual(["2026-10-06", "2026-10-07"]);
    expect(
      diasParaCapturar(reg, "2026-10-07", { reconferir: new Set(["2026-10-04"]) }).dias,
    ).toEqual(["2026-10-04", "2026-10-06", "2026-10-07"]);
  });

  it("HTML gigante é cortado antes dos regex (400 mil caracteres)", () => {
    const t = htmlParaTexto("a".repeat(500_000));
    expect(t.length).toBeLessThanOrEqual(400_000);
  });

  it("data fora de 2000–2100 é recusada (o banco recusaria e derrubaria o dia)", () => {
    for (const d of ["1999-12-31", "2101-01-01"])
      expect(normalizarComunicacao(bruto(1, { data_disponibilizacao: d })).ok).toBe(false);
    expect(normalizarComunicacao(bruto(1)).ok).toBe(true);
  });

  it("dono do item: OAB só vale com a UF certa; item de outro alvo é separado e não gravado", () => {
    const d = consolidarDia(
      3,
      [
        bruto(1),
        bruto(2, {
          destinatarioadvogados: [{ advogado: { nome: "B", numero_oab: "12345", uf_oab: "PR" } }],
        }),
        bruto(3, {
          destinatarioadvogados: [{ advogado: { nome: "C", numero_oab: "999", uf_oab: "SC" } }],
        }),
      ],
      alvoOab,
    );
    expect(d.comunicacoes.map((c) => c.djenId)).toEqual([1]);
    expect(d.invalidos.de_outro_alvo).toBe(2);
    expect(corpoDaRpc(alvoOab, "2026-10-06", d).ok).toBe(false);
  });

  it("volume acima do teto (300 por alvo e dia): não grava nada e o dia fica vermelho", () => {
    const d = consolidarDia(301, [bruto(1)], alvoOab);
    expect(d.comunicacoes).toEqual([]);
    expect(d.invalidos.volume_acima_do_esperado).toBe(301);
    expect(consolidarDia(300, [bruto(1)], alvoOab).comunicacoes.length).toBe(1);
  });
});
