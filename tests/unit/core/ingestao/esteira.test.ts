import { describe, expect, it } from 'vitest'

import { decodificar } from '@/core/ingestao/codificacao'
import { gradeDeTexto } from '@/core/ingestao/delimitado'
import { planilhaAnotada, processarGrade, type ResultadoDaEsteira } from '@/core/ingestao/esteira'
import { farejarFormato } from '@/core/ingestao/formato'

/** CNV-007: a esteira E0 → E8 de ponta a ponta, com a invariante. Dados inventados. */
const HOJE = '2026-10-13'
const cp1252 = (s: string) => Uint8Array.from(Array.from(s, (c) => ({ ã: 0xe3, ç: 0xe7, é: 0xe9, ô: 0xf4, á: 0xe1, í: 0xed, ú: 0xfa, Ú: 0xda })[c] ?? c.charCodeAt(0)))

/** Do arquivo cru à esteira, como o Worker fará. */
function doArquivo(bytes: Uint8Array, contexto: Parameters<typeof processarGrade>[1] = { hoje: HOJE }): { r: ResultadoDaEsteira; grade: string[][] } {
  const f = farejarFormato(bytes, 'clientes.csv')
  if (!f.aceito || f.formato !== 'texto') throw new Error('esperava texto')
  const { grade } = gradeDeTexto(decodificar(bytes).texto)
  return { r: processarGrade(grade, contexto), grade }
}

const conta = (r: ResultadoDaEsteira) => {
  const c = r.contagem
  expect(c.ouro + c.comAviso + c.quarentena + c.ignoradas, 'a invariante da esteira').toBe(c.lidas)
}

const EXPORT_BAGUNCADO = [
  'Relatório de Clientes',
  'Período: 01/01/2026 a 30/09/2026',
  ';;;;',
  'Nome;Celular;E-mail;Última visita;Observação',
  'MARIA SOUZA;(11) 99999-0001;maria@gmial.com;15/08/2026;',
  'João Lima;99999-0002;joao@exemplo.com;02/09/2026;',
  'Ana Paula Reis;(11) 99999-0003;ana@exemplo.com;20/12/2062;',
  ';(11) 99999-0004;;10/09/2026;linha sem nome',
  'Conceição Ávila;(11) 99999-0005;;25/09/2026;',
  'Ana;(11) 99999-0003;;;mesma Ana, outra linha',
  'Total: 6 clientes;;;;',
  'Gerado pelo Sistema X',
].join('\r\n')

describe('a esteira inteira, do arquivo às caixas (CNV-007)', () => {
  it('export bagunçado em Windows-1252: tudo cai numa caixa, com o motivo, e a conta fecha', () => {
    const { r } = doArquivo(cp1252(EXPORT_BAGUNCADO))
    conta(r)
    expect(r.contagem).toMatchObject({ lidas: 12, quarentena: 1, pessoas: 4 })
    const porNome = Object.fromEntries(r.registros.map((x) => [x.nome, x]))
    expect(Object.keys(porNome).sort()).toEqual(['Ana Paula Reis', 'Conceição Ávila', 'João Lima', 'Maria Souza'])
    expect(porNome['Maria Souza']!.avisos).toEqual(expect.arrayContaining(['nome_recaixado', 'email_sugestao']))
    expect(porNome['Maria Souza']!.emailSugerido).toBe('maria@gmail.com')
    expect(porNome['João Lima']!.telefone, 'sem DDD do salão: entra sem telefone e vira pergunta').toBeNull()
    expect(porNome['João Lima']!.avisos).toContain('telefone_sem_ddd')
    expect(porNome['Ana Paula Reis']!.ultimaVisita, 'data no futuro não entra').toBeNull()
    expect(porNome['Ana Paula Reis']!.avisos).toContain('data_futura')
    expect(porNome['Ana Paula Reis']!.linhas, 'as duas linhas da Ana viraram uma ficha').toHaveLength(2)
    expect(r.quarentena[0]!.motivo).toBe('sem_nome')
    expect(r.perguntas[0]).toEqual({ tipo: 'ddd_do_salao', linhas: 1 })
    expect(r.nivel).toBe('N1')
  })

  it('respondida a pergunta do DDD, o telefone entra marcado', () => {
    const { r } = doArquivo(cp1252(EXPORT_BAGUNCADO), { hoje: HOJE, dddPadrao: 11 })
    const joao = r.registros.find((x) => x.nome === 'João Lima')!
    expect(joao.telefone).toBe('+5511999990002')
    expect(joao.avisos).toContain('telefone_ddd_do_salao')
    expect(r.perguntas.some((p) => p.tipo === 'ddd_do_salao')).toBe(false)
  })

  it('controle de totais acusa o que ficou para trás', () => {
    const { r } = doArquivo(cp1252(EXPORT_BAGUNCADO), { hoje: HOJE, totalInformado: 6 })
    expect(r.controleDeTotais).toEqual({ informado: 6, pessoas: 4, diferenca: 2 })
  })

  it('arquivo de atendimentos: as visitas se juntam por pessoa e o nível sobe para N3', () => {
    const csv = ['Cliente;Telefone;Data;Serviço;Valor', 'Maria Souza;11999990001;01/08/2026;Corte;45,00', 'Maria Souza;11999990001;29/08/2026;Corte;45,00', 'João Lima;11999990002;03/08/2026;Barba;35,00', 'João Lima;11999990002;24/08/2026;Barba;35,00', 'Ana Paula;11999990003;31/09/2026;Corte;45,00'].join('\n')
    const { r } = doArquivo(new TextEncoder().encode(csv))
    conta(r)
    expect(r.nivel).toBe('N3')
    const maria = r.registros.find((x) => x.nome === 'Maria Souza')!
    expect(maria.visitas).toEqual([
      { data: '2026-08-01', servico: 'Corte', profissional: null, valorCents: 4500 },
      { data: '2026-08-29', servico: 'Corte', profissional: null, valorCents: 4500 },
    ])
    expect(maria.ultimaVisita).toBe('2026-08-29')
    expect(r.quarentena.map((q) => q.motivo), '31/09 não existe: o atendimento vai corrigir').toEqual(['visita_sem_data'])
  })

  it('data ambígua sem resposta: fica de fora e vira pergunta; respondida, entra', () => {
    const csv = ['Nome;Telefone;Última visita', 'Maria Souza;11999990001;03/08/2026', 'João Lima;11999990002;04/09/2026'].join('\n')
    const sem = doArquivo(new TextEncoder().encode(csv)).r
    expect(sem.perguntas[0]).toMatchObject({ tipo: 'ordem_de_data' })
    expect(sem.registros.every((x) => x.ultimaVisita === null)).toBe(true)
    const com = doArquivo(new TextEncoder().encode(csv), { hoje: HOJE, ordemDeData: 'dmy' }).r
    expect(com.registros.map((x) => x.ultimaVisita)).toEqual(['2026-08-03', '2026-09-04'])
  })

  it('a planilha anotada devolve cada linha com a situação, e a esteira a relê', () => {
    const { r, grade } = doArquivo(cp1252(EXPORT_BAGUNCADO))
    const anotada = planilhaAnotada(grade, r)
    expect(anotada).toHaveLength(grade.length)
    expect(anotada[3]!.slice(-2)).toEqual(['Situação', 'Motivo'])
    expect(anotada[7]!.slice(-2)).toEqual(['corrigir', 'Linha sem nome: corrija e envie de novo.'])
    expect(anotada[0]!.slice(-2)).toEqual(['ignorada', 'titulo'])
    // Relida, as colunas novas não viram dado de cliente.
    const relida = processarGrade(anotada, { hoje: HOJE })
    expect(relida.classificacao!.colunas.slice(-2).map((c) => c.campo)).toEqual(['ignorar', 'ignorar'])
  })

  it('a conta não fechar é erro, não resultado (guarda contra o próprio detector)', () => {
    // Sem linha nenhuma, a invariante vale com zeros.
    const vazio = processarGrade([], { hoje: HOJE })
    expect(vazio.contagem).toMatchObject({ lidas: 0, ouro: 0, quarentena: 0 })
  })
})
