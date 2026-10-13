import { describe, expect, it } from 'vitest'

import { classificarColunas, type Classificacao } from '@/core/ingestao/classificar'
import { gradeDeTexto } from '@/core/ingestao/delimitado'
import { perfilarColunas } from '@/core/ingestao/perfil'
import { jaroWinkler, normalizarTexto } from '@/core/ingestao/similaridade'
import { acharTabelas } from '@/core/ingestao/tabela'

/** CNV-004: E4 + E5. Dados inventados. */
function classificar(csv: string): Classificacao {
  const { grade } = gradeDeTexto(csv)
  const t = acharTabelas(grade).tabelas[0]!
  const linhas = t.linhas.map((l) => l.celulas)
  const perfis = perfilarColunas(linhas, t.cabecalho.length)
  return classificarColunas(perfis, t.cabecalho, (i) => linhas.map((l) => l[i] ?? ''))
}
const campos = (c: Classificacao) => Object.fromEntries(c.colunas.map((x) => [x.cabecalho, x.campo]))

describe('similaridade', () => {
  it('normaliza acento e pontuação; Jaro-Winkler conhecido', () => {
    expect(normalizarTexto('Últ. Visita!')).toBe('ult visita')
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 3)
    expect(jaroWinkler('telefone', 'telefone')).toBe(1)
    expect(jaroWinkler('abc', '')).toBe(0)
  })
})

describe('classificar as colunas pelo conteúdo e pelo nome (CNV-004)', () => {
  it('sinônimos do dia a dia: Cel, Whats, E-mail, Aniversário, Obs', () => {
    const c = classificar(
      [
        'Nome;Cel;E-mail;Aniversário;Obs',
        'Maria Souza;(11) 99999-0001;maria@exemplo.com;15/08/1990;gosta de franja curta e não gosta de esperar',
        'João Lima;(11) 99999-0002;joao@exemplo.com;02/09/1985;',
        'Ana Paula Reis;(11) 99999-0003;ana@exemplo.com;20/12/1992;sempre às sextas, depois do trabalho, com a filha',
      ].join('\n'),
    )
    expect(campos(c)).toEqual({ Nome: 'nome', Cel: 'telefone', 'E-mail': 'email', Aniversário: 'nascimento', Obs: 'observacao' })
    expect(c.grao).toBe('cliente')
    expect(c.ordemDeData).toBe('dmy')
  })

  it('D21: "Nome do profissional" não vira o nome da cliente; "Total de atendimentos" não vira valor nem data', () => {
    const c = classificar(
      [
        'Nome do profissional;Cliente;Telefone;Total de atendimentos',
        'Bia;Maria Souza;11999990001;3',
        'Bia;João Lima;11999990002;7',
        'Carla;Ana Paula;11999990003;12',
        'Carla;Rita Alves;11999990004;1',
      ].join('\n'),
    )
    const m = campos(c)
    expect(m.Cliente).toBe('nome')
    expect(m['Nome do profissional']).toBe('profissional')
    expect(m.Telefone).toBe('telefone')
    expect(['ignorar']).toContain(m['Total de atendimentos'])
  })

  it('arquivo só com "Nome do profissional" (sem coluna de cliente): profissional não vira cliente, e a esteira avisa que falta o nome', () => {
    const c = classificar(
      ['Nome do profissional;Telefone;Data', 'Beatriz Alves;11999990001;01/08/2026', 'Carla Nunes;11999990002;02/08/2026', 'Diana Rocha;11999990003;03/08/2026', 'Elisa Prado;11999990004;04/08/2026'].join('\n'),
    )
    expect(campos(c)['Nome do profissional']).not.toBe('nome')
    expect(c.avisos).toContain('sem_nome')
  })

  it('saúde e documento ficam FORA, com aviso (D14)', () => {
    const c = classificar(['Nome;Telefone;CPF;Alergias', 'Maria Souza;11999990001;123.456.789-00;acetona', 'João Lima;11999990002;987.654.321-00;nenhuma'].join('\n'))
    expect(campos(c)).toMatchObject({ CPF: 'documento', Alergias: 'saude' })
    expect(c.avisos).toEqual(expect.arrayContaining(['saude_fora', 'documento_descartado']))
    expect(c.colunas.find((x) => x.cabecalho === 'Alergias')!.motivo).toMatch(/não entra/)
  })

  it('sem cabeçalho: o conteúdo sozinho decide', () => {
    const c = classificar(['Maria Souza;11999990001;15/08/2026', 'João Lima;11999990002;16/08/2026', 'Ana Paula;11999990003;17/09/2026'].join('\n'))
    expect(c.colunas.map((x) => x.campo)).toEqual(['nome', 'telefone', 'ultima_visita'])
  })

  it('CSV do Google Contatos', () => {
    const c = classificar(
      ['First Name;Last Name;Phone 1 - Value;E-mail 1 - Value;Birthday', 'Maria;Souza;+55 11 99999-0001;maria@exemplo.com;1990-08-15', 'João;Lima;+55 11 99999-0002;joao@exemplo.com;1985-09-02'].join('\n'),
    )
    expect(campos(c)).toMatchObject({ 'First Name': 'nome', 'Last Name': 'sobrenome', 'Phone 1 - Value': 'telefone', 'E-mail 1 - Value': 'email', Birthday: 'nascimento' })
    expect(c.ordemDeData).toBe('ymd')
  })

  it('cabeçalho que mente: "Contato" com nomes é nome, e a coluna de números é o telefone', () => {
    const c = classificar(['Contato;Número', 'Maria Souza;(11) 99999-0001', 'João Lima;(11) 99999-0002', 'Ana Paula;(11) 99999-0003'].join('\n'))
    expect(campos(c)).toEqual({ Contato: 'nome', Número: 'telefone' })
  })

  it('o mesmo telefone em várias linhas = arquivo de atendimentos; "Data" vira data do atendimento', () => {
    const c = classificar(
      ['Cliente;Telefone;Data;Serviço;Valor', 'Maria Souza;11999990001;01/08/2026;Corte;45,00', 'Maria Souza;11999990001;29/08/2026;Corte;45,00', 'João Lima;11999990002;03/08/2026;Barba;35,00', 'João Lima;11999990002;24/08/2026;Barba;35,00', 'Ana Paula;11999990003;10/08/2026;Corte;45,00'].join(
        '\n',
      ),
    )
    expect(c.grao).toBe('atendimento')
    expect(campos(c)).toMatchObject({ Cliente: 'nome', Telefone: 'telefone', Data: 'data_atendimento', Serviço: 'servico', Valor: 'valor' })
  })

  it('dois telefones: o segundo vira telefone2, não some', () => {
    const c = classificar(['Nome;Celular;Telefone residencial', 'Maria Souza;(11) 99999-0001;(11) 3333-0001', 'João Lima;(11) 99999-0002;(11) 3333-0002'].join('\n'))
    expect(c.colunas.map((x) => x.campo)).toEqual(['nome', 'telefone', 'telefone2'])
  })

  it('datas que só servem como dia/mês ou como mês/dia; ambígua avisa', () => {
    expect(classificar(['Nome;Última visita', 'Maria Souza;25/08/2026', 'João Lima;03/09/2026'].join('\n')).ordemDeData).toBe('dmy')
    expect(classificar(['Nome;Última visita', 'Maria Souza;08/25/2026', 'João Lima;09/03/2026'].join('\n')).ordemDeData).toBe('mdy')
    const amb = classificar(['Nome;Última visita', 'Maria Souza;03/08/2026', 'João Lima;04/09/2026'].join('\n'))
    expect(amb.ordemDeData).toBe('ambigua')
    expect(amb.avisos).toContain('data_ambigua')
  })
})
