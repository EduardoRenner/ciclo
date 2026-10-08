// Origem: LUBI src/lib/domain/prazo-sugestao.ts @ db8aeac (docs/101 §8, cópia versionada com teste próprio).
// A sugestão de prazo de uma intimação (plano mestre 11 §1, camadas 3 a 6): junta a LEITURA do texto, o CÁLCULO e o prazo interno.
// Função pura (sem relógio, sem banco). O servidor lê o que ela precisa (texto, caso, feriados) e grava o que ela devolve na decisão.
//
// Regras que mandam:
//  * leitura incerta, rito não definido, unidade do texto que não bate com o rito ou regra ainda não confirmada: NÃO há data sugerida
//    (a pessoa digita) e isso fica visível, nunca vira chute;
//  * só vira "sugerida" a data de um cálculo com `podePreencher` (todas as regras validadas ou confirmadas pela direção do escritório);
//  * a memória de cálculo vai inteira para o banco junto com a sugestão (prova de como a data nasceu).
import {
  calcularPrazo,
  PRAZO_REGRAS_V1,
  prazoInterno,
  REGRA_SUSPENSAO_FIM_DE_ANO,
  type DiaNaoContavel,
  type ResultadoDoCalculo,
  type Rito,
  REGRAS_DO_RITO,
} from "./prazo-calculo";
import { lerPrazoDoTexto, type LeituraDoPrazo } from "./prazo-leitura";

/** Uma linha de `holidays` como o servidor a lê. */
export interface FeriadoCadastrado {
  day: string;
  scope: "nacional" | "estadual" | "municipal" | "recesso";
  name: string;
  tribunal: string | null;
  comarca: string | null;
}

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();

/** Termos de OUTRO início de contagem (citação, juntada, ciência, trânsito...): a regra de publicação não vale. */
const OUTRO_TERMO_INICIAL =
  /(?<![\p{L}])(juntada|citacao|citad[oa]s?|edital|ciencia|transito|vista dos autos|carga dos autos|mandado)(?![\p{L}])/u;

/**
 * Os dias que não contam para ESTE tribunal e ESTA comarca: o feriado sem tribunal vale para todos; com tribunal, só para ele
 * (e, se tem comarca, só para ela). O recesso é a suspensão de fim de ano (regra que o sócio precisa confirmar).
 */
export function diasNaoContaveis(
  feriados: readonly FeriadoCadastrado[],
  tribunal: string,
  comarca: string | null = null,
): DiaNaoContavel[] {
  const t = tribunal.trim().toUpperCase();
  const c = comarca ? semAcento(comarca) : null;
  return feriados
    .filter((f) => {
      if (f.tribunal !== null && f.tribunal.trim().toUpperCase() !== t) return false;
      if (f.comarca !== null && (c === null || semAcento(f.comarca) !== c)) return false;
      return true;
    })
    .map((f) => ({
      data: f.day,
      motivo:
        f.scope === "recesso"
          ? "suspensão de fim de ano, CPC art. 220"
          : `feriado${f.scope === "nacional" ? " nacional" : ""}: ${f.name}`,
      ...(f.scope === "recesso" ? { regra: REGRA_SUSPENSAO_FIM_DE_ANO.id } : {}),
    }));
}

export interface EntradaDaSugestao {
  texto: string;
  /** Data da disponibilização no DJEN (AAAA-MM-DD). */
  disponibilizadoEm: string;
  /** Rito marcado NO CASO (nunca inferido). `null` = ainda não marcado. */
  rito: Rito | null;
  /** Marcação manual do caso. */
  emDobro: boolean;
  naoContaveis: readonly DiaNaoContavel[];
  /** O tipo da comunicação do DJEN ("Intimação", "Citação", "Edital"...). Só "Intimação" tem a regra de publicação. */
  tipoDaComunicacao?: string | null;
  /** Regras que a direção do escritório confirmou. */
  confirmadas?: readonly string[];
  /** Recuo do prazo interno em dias úteis (padrão 2). */
  recuoInterno?: number;
}

export type Sugestao =
  | {
      /** Sem data sugerida: a pessoa digita. `motivo` diz por quê, em português. */
      sugerida: null;
      motivo: string;
      leitura: LeituraDoPrazo;
      /** O cálculo que existiu mas não pode pré-preencher (regra pendente): a tela mostra a memória. */
      calculo: ResultadoDoCalculo | null;
    }
  | {
      sugerida: string;
      interno: string;
      leitura: Extract<LeituraDoPrazo, { certa: true }>;
      calculo: ResultadoDoCalculo;
      /** O que o banco guarda em `calc_memo` (jsonb). */
      memo: Record<string, string | number | boolean | null | string[]>;
      versao: typeof PRAZO_REGRAS_V1;
    };

const sem = (
  motivo: string,
  leitura: LeituraDoPrazo,
  calculo: ResultadoDoCalculo | null = null,
): Sugestao => ({ sugerida: null, motivo, leitura, calculo });

export function sugerirPrazo(e: EntradaDaSugestao): Sugestao {
  const leitura = lerPrazoDoTexto(e.texto);
  if (!leitura.certa) return sem(leitura.motivo, leitura);
  if (e.tipoDaComunicacao != null && !/^intima/u.test(semAcento(e.tipoDaComunicacao)))
    return sem(
      `Esta comunicação é do tipo "${e.tipoDaComunicacao}": o prazo não corre pela regra da intimação. Digite a data.`,
      leitura,
    );
  if (OUTRO_TERMO_INICIAL.test(semAcento(e.texto)))
    return sem(
      "O texto fala em juntada, citação, ciência ou outro termo inicial: a contagem não é a da publicação. Digite a data.",
      leitura,
    );
  if (e.rito === null)
    return sem(
      "O caso ainda não tem o rito marcado (cível, trabalhista, juizado ou penal).",
      leitura,
    );
  const unidade = REGRAS_DO_RITO[e.rito].unidade;
  if (leitura.unidadeNoTexto !== null && leitura.unidadeNoTexto !== unidade)
    return sem(
      `O texto fala em dias ${leitura.unidadeNoTexto === "uteis" ? "úteis" : "corridos"}, mas o rito do caso conta em dias ${unidade === "uteis" ? "úteis" : "corridos"}: confira o rito e digite a data.`,
      leitura,
    );
  if (e.emDobro && (e.rito === "jec" || e.rito === "penal"))
    return sem(
      "Prazo em dobro marcado em caso de juizado ou penal: a regra não está validada. Digite a data.",
      leitura,
    );
  let calculo: ResultadoDoCalculo;
  try {
    calculo = calcularPrazo({
      disponibilizadoEm: e.disponibilizadoEm,
      dias: leitura.dias,
      rito: e.rito,
      emDobro: e.emDobro,
      naoContaveis: e.naoContaveis,
      confirmadas: e.confirmadas ?? [],
    });
  } catch (erro) {
    return sem((erro as Error).message, leitura);
  }
  // o prazo penal corre sem suspensão de fim de ano (CPP art. 798): nunca sugerir uma data empurrada pelo recesso
  if (e.rito === "penal" && calculo.pulados.some((p) => p.regra === REGRA_SUSPENSAO_FIM_DE_ANO.id))
    return sem(
      "O prazo penal atravessa o recesso de fim de ano e a regra da suspensão não vale para ele. Digite a data.",
      leitura,
      calculo,
    );
  if (!calculo.podePreencher)
    return sem(
      `Regra ainda não confirmada pela direção do escritório: ${calculo.regrasPendentes.map((r) => r.rotulo).join("; ")}. A data não vem preenchida.`,
      leitura,
      calculo,
    );
  const interno = prazoInterno(calculo.venceEm, e.naoContaveis, e.recuoInterno ?? 2);
  return {
    sugerida: calculo.venceEm,
    interno,
    leitura,
    calculo,
    versao: PRAZO_REGRAS_V1,
    memo: {
      texto: calculo.memo,
      trecho: leitura.trecho,
      disponibilizado_em: e.disponibilizadoEm,
      publicado_em: calculo.publicadoEm,
      inicio_em: calculo.inicioEm,
      vence_em: calculo.venceEm,
      dias_lidos: leitura.dias,
      dias_contados: calculo.diasContados,
      unidade: calculo.unidade,
      rito: e.rito,
      em_dobro: e.emDobro,
      regras_confirmadas: [...(e.confirmadas ?? [])].sort(),
      prorrogado_de: calculo.prorrogadoDe,
      pulados: calculo.pulados.map((p) => `${p.data} ${p.motivo}`),
    },
  };
}
