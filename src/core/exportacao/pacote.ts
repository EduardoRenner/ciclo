/**
 * CNV-009 · O pacote da exportação: os arquivos que vão dentro do `.zip`, prontos (o zip em si é do
 * servidor, que tem a biblioteca). Formato aberto e documentado (`docs/103-conversor/00-pesquisa.md`
 * P13): Frictionless **Data Package v2** — `datapackage.json` descreve cada tabela e coluna para
 * qualquer ferramenta ler — mais a pasta `excel/` para a pessoa abrir com dois cliques, e um
 * `LEIA-ME.txt` em português.
 */
import { paraCsv, type TipoDeCampo } from '@/core/exportacao/csv'
import { linhaDoRecurso, RECURSOS, type Recurso } from '@/core/exportacao/recursos'

export type ArquivoDoPacote = { caminho: string; conteudo: string }

/** Tipo de coluna do CICLO → tipo do Table Schema. */
const TIPO_DO_SCHEMA: Record<TipoDeCampo, string> = {
  string: 'string',
  integer: 'integer',
  number: 'number',
  date: 'date',
  datetime: 'datetime',
  boolean: 'boolean',
  telefone: 'string',
  centavos: 'integer',
}

export function descritor(recursos: readonly Recurso[], criadoEm: string, negocio: string) {
  return {
    $schema: 'https://datapackage.org/profiles/2.0/datapackage.json',
    name: 'ciclo-exportacao',
    title: `Dados de ${negocio} no CICLO`,
    created: criadoEm,
    version: '1.0.0',
    resources: recursos.map((r) => ({
      name: r.nome,
      path: `${r.nome}.csv`,
      type: 'table',
      title: r.titulo,
      description: r.descricao,
      format: 'csv',
      mediatype: 'text/csv',
      encoding: 'utf-8',
      dialect: { delimiter: ',', header: true },
      schema: {
        fields: r.colunas.map((col) => ({
          name: col.nome,
          type: TIPO_DO_SCHEMA[col.tipo],
          title: col.titulo,
          ...(col.tipo === 'centavos' ? { description: 'em centavos: 4500 = R$ 45,00' } : col.descricao ? { description: col.descricao } : {}),
        })),
        primaryKey: ['id'],
      },
    })),
  }
}

export function leiaMe(negocio: string, criadoEm: string, contagens: Record<string, number>): string {
  const linhas = RECURSOS.map((r) => `  - ${r.nome}.csv (${r.titulo}): ${contagens[r.nome] ?? 0} linha(s). ${r.descricao}`)
  return [
    `Dados de ${negocio} no CICLO`,
    `Exportado em ${criadoEm} (horário UTC).`,
    '',
    'Estes dados são seus. Você pode abrir, guardar e levar para outro sistema.',
    '',
    'O QUE TEM AQUI',
    ...linhas,
    '',
    'DUAS FORMAS DO MESMO DADO',
    '  - Pasta "excel": abra com dois cliques no Excel ou no Google Planilhas. Separado por ponto e',
    '    vírgula, valores em reais com vírgula, datas dd/mm/aaaa, telefone (11) 99999-0001.',
    '  - Arquivos da raiz + datapackage.json: o formato aberto, para outro sistema ou um técnico.',
    '    Separado por vírgula, UTF-8, datas e horas no padrão ISO (UTC), dinheiro em centavos',
    '    (4500 = R$ 45,00), telefone no formato internacional (+5511999990001). O arquivo',
    '    datapackage.json descreve cada coluna (padrão Frictionless Data Package v2).',
    '',
    'O QUE NÃO ESTÁ AQUI, DE PROPÓSITO',
    '  - Fichas de saúde e anamnese (e as preferências, que podem conter alergia): saem só na',
    '    exportação de cada cliente, na ficha dela, com verificação em duas etapas.',
    '  - Fotos e arquivos: ficam no CICLO; baixe pela ficha de cada cliente.',
    '',
    'Para voltar a importar no CICLO, use os arquivos da pasta "excel" ou o clientes.csv da raiz.',
  ].join('\r\n')
}

/**
 * Todas as linhas já lidas do banco (por tabela) → os arquivos do pacote. `negocio` e `criadoEm` vêm
 * de quem chama (o core não lê relógio nem banco).
 */
export function montarPacote(linhasPorTabela: Record<string, Record<string, unknown>[]>, negocio: string, criadoEm: string): ArquivoDoPacote[] {
  const arquivos: ArquivoDoPacote[] = []
  const contagens: Record<string, number> = {}
  for (const r of RECURSOS) {
    const linhas = (linhasPorTabela[r.tabela] ?? []).map((l) => linhaDoRecurso(r, l))
    contagens[r.nome] = linhas.length
    arquivos.push({ caminho: `${r.nome}.csv`, conteudo: paraCsv(r.colunas, linhas, 'aberto') })
    arquivos.push({ caminho: `excel/${r.titulo}.csv`, conteudo: paraCsv(r.colunas, linhas, 'excel') })
  }
  arquivos.push({ caminho: 'datapackage.json', conteudo: JSON.stringify(descritor(RECURSOS, criadoEm, negocio), null, 2) })
  arquivos.push({ caminho: 'LEIA-ME.txt', conteudo: leiaMe(negocio, criadoEm, contagens) })
  return arquivos
}
