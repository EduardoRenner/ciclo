/**
 * A esteira inteira, da grade às caixas (E3 → E8, `docs/97` §5). Todo formato de entrada (CSV,
 * planilha, PDF, print, contatos) vira grade e entra AQUI — um caminho só.
 *
 * A promessa (`docs/97` §0): **nunca errado e calado**. Cada linha da grade sai em uma caixa:
 *   · ouro            — entendida, entra como está;
 *   · ouro com aviso  — entra, e a prévia diz o que foi corrigido ou deixado de fora;
 *   · quarentena      — não entra, com o motivo, na planilha anotada para corrigir e devolver;
 *   · ignorada        — título, filtro, total, rodapé, cabeçalho (E3).
 * E a conta fecha: `lidas = ouro + comAviso + quarentena + ignoradas` — se não fechar, a esteira lança
 * erro em vez de devolver um resultado com linha sumida.
 */
import { desfazerNeutralizacao } from '@/core/exportacao/csv'
import { CAMPOS_QUE_NAO_ENTRAM, classificarColunas, type Campo, type Classificacao } from '@/core/ingestao/classificar'
import { juntarRegistros, type Ligacao } from '@/core/ingestao/juntar'
import { gradeDeListaLivre } from '@/core/ingestao/lista-livre'
import { normalizarData, normalizarDinheiro, normalizarEmail, normalizarNome, separarTelefones } from '@/core/ingestao/normalizar'
import { perfilarColunas, type OrdemDeData } from '@/core/ingestao/perfil'
import { acharTabelas, type Tabela, type TabelasAchadas } from '@/core/ingestao/tabela'

export type Aviso =
  | 'sem_contato'
  | 'telefone_invalido'
  | 'telefone_sem_ddd'
  | 'telefone_ddd_do_salao'
  | 'telefone_nono_digito'
  | 'telefone_compartilhado'
  | 'email_invalido'
  | 'email_sugestao'
  | 'nome_recaixado'
  | 'data_futura'
  | 'data_invalida'
  | 'data_ambigua'
  | 'data_do_excel'
  | 'valor_invalido'
  | 'conferir_imagem'
  | 'telefone_conferir_digitos'

export type MotivoDeQuarentena = 'sem_nome' | 'visita_sem_data'

export const TEXTO_DO_AVISO: Record<Aviso | MotivoDeQuarentena, string> = {
  sem_contato: 'Sem telefone nem e-mail: entra, mas não dá para chamar de volta.',
  telefone_invalido: 'Telefone não reconhecido: entrou sem telefone.',
  telefone_sem_ddd: 'Telefone sem DDD: diga o DDD do seu negócio e ele entra.',
  telefone_ddd_do_salao: 'Telefone sem DDD: usei o DDD do seu negócio.',
  telefone_nono_digito: 'Celular antigo sem o 9: acrescentei o 9 (confira se não é fixo).',
  telefone_compartilhado: 'Mesmo telefone de outra pessoa da lista: ficaram separadas.',
  email_invalido: 'E-mail com formato errado: entrou sem e-mail.',
  email_sugestao: 'O e-mail parece ter um erro de digitação: confira a sugestão.',
  nome_recaixado: 'Nome estava todo em maiúsculas ou minúsculas: arrumei.',
  data_futura: 'A data está no futuro: deixei de fora.',
  data_invalida: 'Data que não existe: deixei de fora.',
  data_ambigua: 'Não dá para saber se a data é dia/mês ou mês/dia: responda a pergunta.',
  data_do_excel: 'A data veio como número do Excel: converti.',
  valor_invalido: 'Valor não reconhecido: deixei de fora.',
  conferir_imagem: 'Lido de um print ou foto: confira esta linha com a imagem ao lado.',
  telefone_conferir_digitos: 'Telefone lido de imagem: confira dígito a dígito antes de usar (um número trocado manda mensagem para outra pessoa).',
  sem_nome: 'Linha sem nome: corrija e envie de novo.',
  visita_sem_data: 'Atendimento sem data válida: corrija e envie de novo.',
}

export type Visita = { data: string; servico: string | null; profissional: string | null; valorCents: number | null }

export type RegistroCanonico = {
  /** Linhas da grade que formaram esta ficha (mais de uma quando a mesma pessoa aparece de novo). */
  linhas: number[]
  nome: string
  telefone: string | null
  telefonesExtras: string[]
  email: string | null
  emailSugerido: string | null
  nascimento: string | null
  ultimaVisita: string | null
  visitas: Visita[]
  observacao: string | null
  etiquetas: string[]
  genero: string | null
  origem: string | null
  avisos: Aviso[]
}

export type Nivel = 'N0' | 'N1' | 'N2' | 'N3'

export type Pergunta =
  | { tipo: 'ddd_do_salao'; linhas: number }
  | { tipo: 'ordem_de_data'; exemplo: string }
  | { tipo: 'mesma_pessoa'; ligacao: Ligacao; nomes: [string, string] }

export type ResultadoDaEsteira = {
  /** A grade que a esteira leu de fato (a lista livre ganha uma linha de cabeçalho): é nela que a planilha anotada se apoia. */
  gradeLida: string[][]
  tabela: Tabela | null
  classificacao: Classificacao | null
  registros: RegistroCanonico[]
  quarentena: { origem: number; celulas: string[]; motivo: MotivoDeQuarentena }[]
  ignoradas: TabelasAchadas['ignoradas']
  perguntas: Pergunta[]
  contagem: { lidas: number; ouro: number; comAviso: number; quarentena: number; ignoradas: number; pessoas: number }
  nivel: Nivel
  /** "Quantos clientes o sistema antigo mostra?" — a diferença acusa o que ficou para trás. */
  controleDeTotais: { informado: number; pessoas: number; diferenca: number } | null
  /** Outras tabelas achadas na mesma grade (o dono escolhe na prévia). */
  outrasTabelas: number
}

export type ContextoDaEsteira = {
  /** AAAA-MM-DD no fuso do negócio: decide "data no futuro". */
  hoje: string
  dddPadrao?: number
  /** Resposta da pessoa à pergunta de ordem de data; sem ela, data ambígua fica de fora com aviso. */
  ordemDeData?: Exclude<OrdemDeData, 'ambigua'>
  totalInformado?: number
  /** Qual tabela da grade usar (padrão: a com mais linhas). */
  tabela?: number
  /**
   * CNV-018: a grade veio de OCR (print, foto, PDF escaneado). Nunca vira "ouro" automático
   * (`docs/97` §6): toda linha leva "conferir", telefone leva "conferir dígito a dígito", valor em
   * reais não é usado e o nível fica no máximo N1.
   */
  lidoDeImagem?: boolean
}

const valorDe = (celulas: string[], indice: number | undefined) => (indice === undefined ? '' : (celulas[indice] ?? '').trim())

export function processarGrade(gradeRecebida: string[][], contexto: ContextoDaEsteira): ResultadoDaEsteira {
  // Lista livre (uma pessoa por linha, sem colunas) vira tabela de Nome, Telefone e E-mail antes da E3.
  const grade = gradeDeListaLivre(gradeRecebida) ?? gradeRecebida
  const achadas = acharTabelas(grade)
  const indiceDaTabela = contexto.tabela ?? achadas.tabelas.reduce((melhor, t, i, todas) => (t.linhas.length > (todas[melhor]?.linhas.length ?? -1) ? i : melhor), 0)
  const tabela = achadas.tabelas[indiceDaTabela] ?? null
  // Linhas de OUTRAS tabelas da grade contam como ignoradas nesta passada (a prévia oferece trocar).
  const ignoradas = [...achadas.ignoradas, ...achadas.tabelas.flatMap((t, i) => (i === indiceDaTabela ? [] : t.linhas.map((l) => ({ origem: l.origem, motivo: 'outra_tabela' as const }))))]
  if (!tabela) {
    return fechar({ gradeLida: grade, tabela: null, classificacao: null, registros: [], quarentena: [], ignoradas, perguntas: [], nivel: 'N0', outrasTabelas: 0, controleDeTotais: null }, grade.length, contexto)
  }

  // A célula que a exportação neutralizou contra fórmula ("\t-Ana", ou o "'-Ana" antigo) volta ao
  // valor original: a ida e volta não pode mudar o nome de ninguém (defeito D17).
  for (const l of tabela.linhas) l.celulas = l.celulas.map(desfazerNeutralizacao)
  const linhas = tabela.linhas.map((l) => l.celulas)
  const perfis = perfilarColunas(linhas, tabela.cabecalho.length)
  const classificacao = classificarColunas(perfis, tabela.cabecalho, (i) => linhas.map((l) => l[i] ?? ''))
  const col = (campo: Campo) => classificacao.colunas.find((c) => c.campo === campo && !CAMPOS_QUE_NAO_ENTRAM.has(c.campo))?.indice
  const ordem: OrdemDeData | null = contexto.ordemDeData ?? classificacao.ordemDeData
  const perguntas: Pergunta[] = []
  let semDdd = 0

  type Linha = { origem: number; reg: RegistroCanonico }
  const boas: Linha[] = []
  const quarentena: ResultadoDaEsteira['quarentena'] = []

  for (const l of tabela.linhas) {
    const c = l.celulas
    const avisos: Aviso[] = []
    const nomeBruto = [valorDe(c, col('nome')), valorDe(c, col('sobrenome'))].filter(Boolean).join(' ')
    if (nomeBruto.trim() === '') {
      quarentena.push({ origem: l.origem, celulas: c, motivo: 'sem_nome' })
      continue
    }
    const nome = normalizarNome(nomeBruto)
    if (nome.recaixado) avisos.push('nome_recaixado')

    const telefones: string[] = []
    for (const campo of ['telefone', 'telefone2'] as const) {
      const bruto = valorDe(c, col(campo))
      if (!bruto) continue
      for (const t of separarTelefones(bruto, contexto.dddPadrao)) {
        if (t.ok) {
          telefones.push(t.e164)
          if (t.correcoes.includes('ddd_do_salao')) avisos.push('telefone_ddd_do_salao')
          if (t.correcoes.includes('nono_digito')) avisos.push('telefone_nono_digito')
        } else if (t.motivo === 'sem_ddd') {
          avisos.push('telefone_sem_ddd')
          semDdd++
        } else if (t.motivo !== 'vazio') avisos.push('telefone_invalido')
      }
    }

    let email: string | null = null
    let emailSugerido: string | null = null
    const emailBruto = valorDe(c, col('email'))
    if (emailBruto) {
      const e = normalizarEmail(emailBruto)
      if (e.ok) {
        email = e.valor
        if (e.sugestao) {
          emailSugerido = e.sugestao
          avisos.push('email_sugestao')
        }
      } else avisos.push('email_invalido')
    }
    if (telefones.length === 0 && !email) avisos.push('sem_contato')

    const data = (campo: Campo) => {
      const bruto = valorDe(c, col(campo))
      if (!bruto) return null
      const d = normalizarData(bruto, ordem, contexto.hoje)
      if (d.ok) {
        if (d.doExcel) avisos.push('data_do_excel')
        return d.iso
      }
      avisos.push(d.motivo === 'futuro' ? 'data_futura' : d.motivo === 'ambigua' ? 'data_ambigua' : 'data_invalida')
      return null
    }
    const nascimento = data('nascimento')
    const ultimaVisita = data('ultima_visita')

    const visitas: Visita[] = []
    if (classificacao.grao === 'atendimento') {
      const dia = data('data_atendimento')
      if (!dia) {
        quarentena.push({ origem: l.origem, celulas: c, motivo: 'visita_sem_data' })
        continue
      }
      const valorBruto = valorDe(c, col('valor'))
      const valorCents = valorBruto ? normalizarDinheiro(valorBruto) : null
      if (valorBruto && valorCents === null) avisos.push('valor_invalido')
      visitas.push({ data: dia, servico: valorDe(c, col('servico')) || null, profissional: valorDe(c, col('profissional')) || null, valorCents })
    }

    const etiquetas = valorDe(c, col('etiquetas'))
      .split(/[,;|]/)
      .map((e) => e.trim())
      .filter(Boolean)
    boas.push({
      origem: l.origem,
      reg: {
        linhas: [l.origem],
        nome: nome.valor,
        telefone: telefones[0] ?? null,
        telefonesExtras: telefones.slice(1),
        email,
        emailSugerido,
        nascimento,
        ultimaVisita,
        visitas,
        observacao: valorDe(c, col('observacao')) || null,
        etiquetas,
        genero: valorDe(c, col('genero')) || null,
        origem: valorDe(c, col('origem')) || null,
        avisos: [...new Set(avisos)],
      },
    })
  }

  // E7: a mesma pessoa vira uma ficha.
  const juntado = juntarRegistros(boas.map((b, i) => ({ linha: i, nome: b.reg.nome, telefones: b.reg.telefone ? [b.reg.telefone, ...b.reg.telefonesExtras] : [], email: b.reg.email, nascimento: b.reg.nascimento })))
  for (const comp of juntado.compartilhados) {
    for (const i of [comp.a, comp.b]) if (!boas[i]!.reg.avisos.includes('telefone_compartilhado')) boas[i]!.reg.avisos.push('telefone_compartilhado')
  }
  const registros = juntado.grupos.map((grupo) => fundir(grupo.map((i) => boas[i]!.reg)))
  for (const p of juntado.perguntas) perguntas.push({ tipo: 'mesma_pessoa', ligacao: p, nomes: [boas[p.a]!.reg.nome, boas[p.b]!.reg.nome] })
  if (semDdd > 0) perguntas.unshift({ tipo: 'ddd_do_salao', linhas: semDdd })
  if (!contexto.ordemDeData && classificacao.ordemDeData === 'ambigua') {
    const exemplo = linhas.map((l) => [col('ultima_visita'), col('data_atendimento'), col('nascimento')].map((i) => valorDe(l, i)).find(Boolean)).find(Boolean) ?? ''
    perguntas.unshift({ tipo: 'ordem_de_data', exemplo })
  }

  if (contexto.lidoDeImagem) {
    for (const r of registros) {
      if (!r.avisos.includes('conferir_imagem')) r.avisos.push('conferir_imagem')
      if (r.telefone && !r.avisos.includes('telefone_conferir_digitos')) r.avisos.push('telefone_conferir_digitos')
      for (const v of r.visitas) v.valorCents = null
    }
  }

  const temVisita = registros.some((r) => r.ultimaVisita || r.visitas.length > 0)
  const historico = registros.some((r) => r.visitas.length >= 2)
  const comValor = registros.some((r) => r.visitas.some((v) => v.servico && v.valorCents !== null))
  const nivelLido: Nivel = historico && comValor ? 'N3' : historico ? 'N2' : temVisita ? 'N1' : 'N0'
  const nivel: Nivel = contexto.lidoDeImagem && (nivelLido === 'N2' || nivelLido === 'N3') ? 'N1' : nivelLido

  return fechar(
    { gradeLida: grade, tabela, classificacao, registros, quarentena, ignoradas, perguntas, nivel, outrasTabelas: achadas.tabelas.length - 1, controleDeTotais: null },
    grade.length,
    contexto,
  )
}

/** Várias linhas da mesma pessoa → uma ficha. Nunca troca preenchido por vazio; visitas se somam. */
function fundir(regs: RegistroCanonico[]): RegistroCanonico {
  if (regs.length === 1) return regs[0]!
  const primeiro = <K extends keyof RegistroCanonico>(k: K) => regs.map((r) => r[k]).find((v) => v !== null && v !== '') ?? null
  const nomeMaisLongo = regs.map((r) => r.nome).sort((a, b) => b.length - a.length)[0]!
  const visitas = regs.flatMap((r) => r.visitas).sort((a, b) => a.data.localeCompare(b.data))
  const telefones = [...new Set(regs.flatMap((r) => (r.telefone ? [r.telefone, ...r.telefonesExtras] : r.telefonesExtras)))]
  const ultimas = [...regs.map((r) => r.ultimaVisita), visitas.at(-1)?.data ?? null].filter((v): v is string => v !== null).sort()
  return {
    linhas: regs.flatMap((r) => r.linhas).sort((a, b) => a - b),
    nome: nomeMaisLongo,
    telefone: telefones[0] ?? null,
    telefonesExtras: telefones.slice(1),
    email: primeiro('email') as string | null,
    emailSugerido: primeiro('emailSugerido') as string | null,
    nascimento: primeiro('nascimento') as string | null,
    ultimaVisita: ultimas.at(-1) ?? null,
    visitas,
    observacao: regs.map((r) => r.observacao).filter(Boolean).join(' · ') || null,
    etiquetas: [...new Set(regs.flatMap((r) => r.etiquetas))],
    genero: primeiro('genero') as string | null,
    origem: primeiro('origem') as string | null,
    avisos: [...new Set(regs.flatMap((r) => r.avisos))],
  }
}

function fechar(parcial: Omit<ResultadoDaEsteira, 'contagem'>, lidas: number, contexto: ContextoDaEsteira): ResultadoDaEsteira {
  const linhasDeDados = parcial.registros.reduce((s, r) => s + r.linhas.length, 0)
  const comAviso = parcial.registros.filter((r) => r.avisos.length > 0).reduce((s, r) => s + r.linhas.length, 0)
  const contagem = {
    lidas,
    ouro: linhasDeDados - comAviso,
    comAviso,
    quarentena: parcial.quarentena.length,
    ignoradas: parcial.ignoradas.length,
    pessoas: parcial.registros.length,
  }
  if (contagem.ouro + contagem.comAviso + contagem.quarentena + contagem.ignoradas !== lidas) {
    throw new Error(`esteira: a conta não fecha (lidas ${lidas} ≠ ${contagem.ouro} + ${contagem.comAviso} + ${contagem.quarentena} + ${contagem.ignoradas})`)
  }
  const controleDeTotais = contexto.totalInformado === undefined ? null : { informado: contexto.totalInformado, pessoas: contagem.pessoas, diferenca: contexto.totalInformado - contagem.pessoas }
  return { ...parcial, contagem, controleDeTotais }
}

/**
 * A planilha anotada (copiado do OneSchema, `docs/97` §2): a grade original com "Situação" e "Motivo"
 * em cada linha, no formato que a esteira relê. A pessoa corrige as da quarentena e devolve.
 */
export function planilhaAnotada(grade: string[][], r: ResultadoDaEsteira): string[][] {
  const largura = Math.max(0, ...grade.map((l) => l.length))
  const situacao = new Map<number, [string, string]>()
  for (const i of r.ignoradas) situacao.set(i.origem, ['ignorada', i.motivo])
  for (const q of r.quarentena) situacao.set(q.origem, ['corrigir', TEXTO_DO_AVISO[q.motivo]])
  for (const reg of r.registros) for (const o of reg.linhas) situacao.set(o, reg.avisos.length ? ['entrou com aviso', reg.avisos.map((a) => TEXTO_DO_AVISO[a]).join(' ')] : ['entrou', ''])
  const cabecalhoDaTabela = r.ignoradas.find((i) => i.motivo === 'cabecalho')?.origem
  return grade.map((l, i) => {
    const base = [...l, ...new Array<string>(Math.max(0, largura - l.length)).fill('')]
    if (i === cabecalhoDaTabela) return [...base, 'Situação', 'Motivo']
    const [s, m] = situacao.get(i) ?? ['', '']
    return [...base, s, m]
  })
}
