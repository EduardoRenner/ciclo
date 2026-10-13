/**
 * E5 da esteira (`docs/97` §5): dar nome a cada coluna, com confiança.
 *
 * Quatro sinais, e o CONTEÚDO pesa mais que o cabeçalho: o perfil da coluna (E4), o cabeçalho contra
 * um dicionário PT/EN/ES com sinônimos e Jaro-Winkler, e a decisão da tabela INTEIRA de uma vez — uma
 * coluna só é nome, uma só é o telefone principal, e uma coluna não vira duas coisas (`docs/97`
 * rev. 98, Sato). Defeito D21 da auditoria: "Nome do profissional" virava o nome de quem é atendido e "Total
 * de atendimentos" virava data, porque o chute antigo era "a primeira coluna cujo nome contém".
 *
 * Duas colunas nunca entram no CICLO, mesmo reconhecidas: documento (CPF/CNPJ: minimização, o Motor não
 * precisa) e saúde (alergia, medicamento, gestante: fica fora e a tela explica onde registrar,
 * `docs/97` §8 — conserta o D14, em que "Alergias" mapeada como etiqueta ia em claro para `tags`).
 */
import { jaroWinkler, normalizarTexto } from '@/core/ingestao/similaridade'

import type { OrdemDeData, PerfilDeColuna } from '@/core/ingestao/perfil'

export type Campo =
  | 'nome'
  | 'sobrenome'
  | 'telefone'
  | 'telefone2'
  | 'email'
  | 'nascimento'
  | 'ultima_visita'
  | 'data_atendimento'
  | 'servico'
  | 'profissional'
  | 'valor'
  | 'observacao'
  | 'etiquetas'
  | 'genero'
  | 'origem'
  | 'documento'
  | 'saude'
  | 'ignorar'

/** Campos que nunca entram, mesmo reconhecidos. */
export const CAMPOS_QUE_NAO_ENTRAM: ReadonlySet<Campo> = new Set(['documento', 'saude', 'ignorar'])

const UNICOS: ReadonlySet<Campo> = new Set(['nome', 'sobrenome', 'telefone', 'telefone2', 'email', 'nascimento', 'ultima_visita', 'data_atendimento', 'servico', 'profissional', 'valor', 'genero', 'origem'])

/** Sinônimos normalizados (sem acento, minúsculo). Inclui Google Contatos novo e antigo e Outlook. */
const DICIONARIO: Record<Exclude<Campo, 'ignorar' | 'telefone2'>, string[]> = {
  nome: ['nome', 'cliente', 'nome do cliente', 'nome completo', 'nome cliente', 'name', 'full name', 'nombre', 'paciente', 'aluno', 'aluna', 'first name', 'given name', 'primeiro nome'],
  sobrenome: ['sobrenome', 'last name', 'family name', 'apellido', 'ultimo nome'],
  telefone: ['telefone', 'tel', 'fone', 'celular', 'cel', 'whatsapp', 'whats', 'zap', 'wpp', 'contato', 'telefone celular', 'numero', 'mobile', 'mobile phone', 'phone', 'phone 1 value', 'telefone 1', 'telefono', 'movil', 'home phone', 'business phone', 'telefone residencial', 'telefone comercial'],
  email: ['email', 'e mail', 'mail', 'correio eletronico', 'email 1 value', 'e mail address', 'email address', 'e mail 1 value', 'correo'],
  nascimento: ['nascimento', 'data de nascimento', 'data nascimento', 'aniversario', 'dt nasc', 'nasc', 'birthday', 'birth date', 'fecha de nacimiento', 'cumpleanos'],
  ultima_visita: ['ultima visita', 'ultimo atendimento', 'ultima compra', 'ultimo servico', 'last visit', 'ultima vez', 'data ultima visita', 'data do ultimo atendimento'],
  data_atendimento: ['data', 'dia', 'data do atendimento', 'data atendimento', 'data agendamento', 'data do servico', 'data da visita', 'date', 'fecha', 'atendido em', 'data e hora'],
  servico: ['servico', 'servicos', 'procedimento', 'procedimentos', 'service', 'servicio', 'tratamento', 'item'],
  profissional: ['profissional', 'colaborador', 'colaboradora', 'barbeiro', 'atendente', 'funcionario', 'cabeleireiro', 'cabeleireira', 'manicure', 'staff', 'grupo', 'responsavel', 'nome do profissional', 'executante'],
  valor: ['valor', 'preco', 'total', 'valor pago', 'valor total', 'price', 'amount', 'precio', 'valor do servico', 'pago'],
  observacao: ['observacao', 'observacoes', 'obs', 'notas', 'nota', 'notes', 'anotacoes', 'comentario', 'comentarios', 'descricao'],
  etiquetas: ['etiquetas', 'etiqueta', 'tags', 'tag', 'labels', 'grupos', 'categoria', 'segmento'],
  genero: ['genero', 'sexo', 'gender'],
  origem: ['origem', 'como conheceu', 'indicacao', 'indicado por', 'canal', 'fonte', 'source'],
  documento: ['cpf', 'cnpj', 'rg', 'documento', 'doc', 'cpf cnpj'],
  saude: ['alergia', 'alergias', 'medicamento', 'medicamentos', 'remedio', 'gestante', 'gravida', 'doenca', 'doencas', 'problema de saude', 'saude', 'anamnese', 'contraindicacao', 'queixa', 'historico clinico', 'obs clinica', 'condicao de saude', 'tipo sanguineo', 'diabetes', 'hipertensao'],
}

/** Palavras que, no cabeçalho, dizem que a coluna NÃO é da cliente ("Nome do profissional"). */
const QUALIFICA_OUTRA_COISA = /\b(profissional|colaborador|barbeiro|atendente|funcionario|responsavel|servico|procedimento|empresa|mae|pai|indicado por|unidade)\b/

function pontoDeCabecalho(cabecalho: string, campo: Exclude<Campo, 'ignorar' | 'telefone2'>): number {
  const h = normalizarTexto(cabecalho)
  if (h === '') return 0
  let melhor = 0
  for (const s of DICIONARIO[campo]) {
    if (h === s) return 1
    // Palavra inteira dentro do cabeçalho ("telefone celular", "data do atendimento").
    if (new RegExp(`(^| )${s}( |$)`).test(h)) melhor = Math.max(melhor, 0.8)
    else melhor = Math.max(melhor, jaroWinkler(h, s) >= 0.92 ? 0.7 : 0)
  }
  // Veto, não só zero: "Nome do profissional" com nomes de pessoa no conteúdo continua não sendo a cliente.
  if (campo === 'nome' && QUALIFICA_OUTRA_COISA.test(h)) return -1
  if (campo === 'valor' && /\b(atendimentos|visitas|quantidade|qtd|vezes|sessoes|pontos)\b/.test(h)) return -1
  return melhor
}

/** O quanto o CONTEÚDO combina com o campo (0 a 1). */
function pontoDeConteudo(p: PerfilDeColuna, campo: Campo): number {
  const f = p.fracao
  const datas = f.data
  switch (campo) {
    case 'nome':
      return f.nomeDePessoa * (p.distintos >= Math.min(p.preenchidas, 3) ? 1 : 0.5)
    case 'sobrenome':
      return f.nomeDePessoa * 0.6
    case 'telefone':
    case 'telefone2':
      return f.telefone
    case 'email':
      return f.email
    case 'nascimento':
      return datas * (0.4 + 0.6 * f.dataAntiga)
    case 'ultima_visita':
    case 'data_atendimento':
      return datas * (0.4 + 0.6 * (1 - f.dataAntiga))
    case 'valor':
      // Inteiro pequeno sem centavos é contagem ("Total de atendimentos": 3, 7, 12), não dinheiro.
      return Math.max(f.dinheiro, f.decimal * 0.8)
    case 'servico':
    case 'profissional':
      return p.categorica && f.telefone + f.email + datas + f.dinheiro < 0.1 ? 0.7 : 0.2
    case 'observacao':
      return f.textoLongo > 0.3 ? 0.8 : 0.3
    case 'etiquetas':
      return p.categorica ? 0.5 : 0.3
    case 'genero':
      return f.genero
    case 'origem':
      return p.categorica ? 0.4 : 0.2
    case 'documento':
      return f.documento
    case 'saude':
      // Conteúdo não denuncia saúde de forma confiável; o cabeçalho decide (e decide para FORA).
      return 0.5
    case 'ignorar':
      return 0
  }
}

export type ColunaClassificada = {
  indice: number
  cabecalho: string
  campo: Campo
  confianca: number
  /** Por que a esteira escolheu (vai para a prévia). */
  motivo: string
}

export type Grao = 'cliente' | 'atendimento'

export type Classificacao = {
  colunas: ColunaClassificada[]
  grao: Grao
  ordemDeData: OrdemDeData | null
  avisos: ('saude_fora' | 'documento_descartado' | 'data_ambigua' | 'sem_nome' | 'sem_contato')[]
}

/** "Situação" e "Motivo": as colunas que `planilhaAnotada` acrescenta. Relidas, são ignoradas. */
export const COLUNAS_DA_ANOTACAO: ReadonlySet<string> = new Set(['situacao', 'motivo'])

const CANDIDATOS: Campo[] = ['nome', 'sobrenome', 'telefone', 'email', 'nascimento', 'ultima_visita', 'data_atendimento', 'servico', 'profissional', 'valor', 'observacao', 'etiquetas', 'genero', 'origem', 'documento', 'saude']

function pontuar(p: PerfilDeColuna, cabecalho: string, campo: Campo): number {
  if (campo === 'ignorar' || campo === 'telefone2') return 0
  const cab = pontoDeCabecalho(cabecalho, campo)
  const con = pontoDeConteudo(p, campo)
  if (cab < 0) return 0
  if (campo === 'saude' || campo === 'documento') {
    // Fora por cabeçalho OU por conteúdo inequívoco (CPF formatado).
    return campo === 'documento' ? Math.max(cab, con) : cab
  }
  if (p.preenchidas === 0) return cab * 0.3
  // Conteúdo pesa mais. Sem cabeçalho útil, o conteúdo sozinho pode chegar a 0,6.
  return con * 0.6 + cab * 0.4
}

/**
 * `linhasDeTelefone` são os valores da coluna escolhida como telefone, para decidir o grão: telefone
 * repetido em muitas linhas = arquivo de atendimentos, não de clientes.
 */
export function classificarColunas(perfis: readonly PerfilDeColuna[], cabecalho: readonly string[], valores: (indice: number) => readonly string[]): Classificacao {
  const pares: { indice: number; campo: Campo; pontos: number }[] = []
  for (const p of perfis) {
    // As colunas que a própria esteira escreve na planilha anotada nunca viram dado da ficha.
    if (COLUNAS_DA_ANOTACAO.has(normalizarTexto(cabecalho[p.indice] ?? ''))) continue
    for (const campo of CANDIDATOS) pares.push({ indice: p.indice, campo, pontos: pontuar(p, cabecalho[p.indice] ?? '', campo) })
  }
  pares.sort((a, b) => b.pontos - a.pontos)

  const escolhido = new Map<number, { campo: Campo; pontos: number }>()
  const usados = new Set<Campo>()
  for (const par of pares) {
    if (par.pontos < 0.35) break
    if (escolhido.has(par.indice)) continue
    let campo = par.campo
    if (UNICOS.has(campo) && usados.has(campo)) {
      if (campo === 'telefone' && !usados.has('telefone2')) campo = 'telefone2'
      else continue
    }
    escolhido.set(par.indice, { campo, pontos: par.pontos })
    usados.add(campo)
  }

  // Grão: o mesmo telefone em muitas linhas denuncia histórico (uma linha por atendimento).
  const colTelefone = [...escolhido].find(([, e]) => e.campo === 'telefone')?.[0]
  let grao: Grao = 'cliente'
  if (colTelefone !== undefined) {
    const tels = valores(colTelefone)
      .map((v) => v.replace(/\D/g, ''))
      .filter((v) => v.length >= 8)
    if (tels.length >= 4 && new Set(tels).size / tels.length < 0.8) grao = 'atendimento'
  }
  // Data genérica ("Data") decide pelo grão: arquivo de atendimentos → data do atendimento;
  // arquivo de clientes → última visita.
  for (const [indice, e] of escolhido) {
    if (e.campo === 'data_atendimento' && grao === 'cliente' && !usados.has('ultima_visita')) {
      escolhido.set(indice, { campo: 'ultima_visita', pontos: e.pontos })
      usados.delete('data_atendimento')
      usados.add('ultima_visita')
    }
  }

  const colunas: ColunaClassificada[] = cabecalho.map((cab, indice) => {
    const e = escolhido.get(indice)
    if (!e) return { indice, cabecalho: cab, campo: 'ignorar', confianca: 1, motivo: 'não reconheci o conteúdo' }
    return { indice, cabecalho: cab, campo: e.campo, confianca: Math.min(1, Number(e.pontos.toFixed(2))), motivo: motivoDe(e.campo, perfis[indice]!) }
  })

  const ordens = colunas.filter((c) => ['nascimento', 'ultima_visita', 'data_atendimento'].includes(c.campo)).map((c) => perfis[c.indice]!.ordemDeData)
  const ordemDeData = ordens.includes('dmy') ? 'dmy' : ordens.includes('mdy') ? 'mdy' : ordens.includes('ymd') ? 'ymd' : ordens.includes('ambigua') ? 'ambigua' : null

  const avisos: Classificacao['avisos'] = []
  if (colunas.some((c) => c.campo === 'saude')) avisos.push('saude_fora')
  if (colunas.some((c) => c.campo === 'documento')) avisos.push('documento_descartado')
  if (ordemDeData === 'ambigua') avisos.push('data_ambigua')
  if (!colunas.some((c) => c.campo === 'nome')) avisos.push('sem_nome')
  if (!colunas.some((c) => c.campo === 'telefone' || c.campo === 'email')) avisos.push('sem_contato')
  return { colunas, grao, ordemDeData, avisos }
}

function motivoDe(campo: Campo, p: PerfilDeColuna): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`
  switch (campo) {
    case 'telefone':
    case 'telefone2':
      return `${pct(p.fracao.telefone)} parecem telefone`
    case 'email':
      return `${pct(p.fracao.email)} parecem e-mail`
    case 'nome':
      return `${pct(p.fracao.nomeDePessoa)} parecem nome de pessoa`
    case 'nascimento':
    case 'ultima_visita':
    case 'data_atendimento':
      return `${pct(p.fracao.data)} parecem data`
    case 'valor':
      return `${pct(Math.max(p.fracao.dinheiro, p.fracao.numero))} parecem valor`
    case 'documento':
      return 'parece CPF ou CNPJ: não entra (o CICLO não precisa)'
    case 'saude':
      return 'parece dado de saúde: não entra; registre na ficha, onde fica protegido'
    default:
      return 'pelo nome da coluna e pelo conteúdo'
  }
}
