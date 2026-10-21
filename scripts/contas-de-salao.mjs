/**
 * As contas de demonstração de salão (docs/112 EXP-S02, `04-salao.md` §5): dado puro, sem banco.
 *
 * Separado de `seed-demo-salao.mjs` para a guarda `seed-de-vitrine-e-coerente` ler o MESMO plano que
 * o seed grava, sem rodar o seed. O seed anterior (`seed-demo-6-negocios.mjs`) tinha a lash fazendo
 * escova e a cabeleireira fazendo extensão de cílios, 13 de 28 nomes de homem e 5 visitas por
 * cliente qualquer que fosse o ritmo. Aqui o volume SAI do ritmo (`seed-volume-sai-do-historico`):
 * cada cliente volta no ritmo do serviço dela, e a ocupação de cada profissional é conta, não chute.
 *
 * Nomes de negócio e de pessoa são fictícios e provisórios: escolher os de verdade é do Vitor.
 */
import { createHash } from 'node:crypto'

/** PRNG determinístico (md5 → [0,1)), o mesmo dos outros seeds: rodar de novo dá o mesmo plano. */
export function rnd(...partes) {
  const h = createHash('md5').update(partes.join('|')).digest('hex').slice(0, 12)
  return parseInt(h, 16) / 0xffffffffffff
}

/** Expediente das contas: terça a sábado, 9h às 19h. */
export const MINUTOS_ABERTOS_POR_SEMANA = 5 * 10 * 60

export const FAIXA_DE_OCUPACAO = { min: 40, max: 85 }
export const FAIXA_DE_ATRASADAS = { min: 15, max: 20 }

/**
 * `ritmo: null` é serviço sem retorno (remoção). A coluna `services.cycle_days` só aceita 1 a 365
 * (0001), então o seed grava 365 e ninguém tem remoção como serviço de costume; tirar o serviço sem
 * retorno do Motor de vez é o EXP-S09.
 */
const UNHAS = [
  { nome: 'Pé e mão', oficio: 'unhas', preco: 7500, min: 90, ritmo: 14, peso: 40 },
  { nome: 'Mão', oficio: 'unhas', preco: 4000, min: 45, ritmo: 14, peso: 20 },
  { nome: 'Pé', oficio: 'unhas', preco: 4500, min: 45, ritmo: 14, peso: 8 },
  { nome: 'Esmaltação em gel', oficio: 'unhas', preco: 9500, min: 60, ritmo: 18, peso: 20 },
  { nome: 'Blindagem', oficio: 'unhas', preco: 8000, min: 60, ritmo: 20, peso: 12 },
  { nome: 'Remoção', oficio: 'unhas', preco: 3000, min: 30, ritmo: null, peso: 0 },
]
const ALONGAMENTO = [
  { nome: 'Alongamento em gel', oficio: 'alongamento', preco: 17000, min: 150, ritmo: 21, peso: 25 },
  { nome: 'Manutenção do alongamento', oficio: 'alongamento', preco: 12000, min: 120, ritmo: 21, peso: 75 },
]

export const CONTAS = [
  {
    slug: 'demo-carol-cilios',
    nome: 'Carol Menezes Cílios e Sobrancelha',
    vertical: 'lashes',
    plano: 'essencial',
    revenda: 'Sérum de cílios',
    servicos: [
      { nome: 'Manutenção de cílios', oficio: 'cilios', preco: 12000, min: 90, ritmo: 21, peso: 70 },
      { nome: 'Aplicação fio a fio', oficio: 'cilios', preco: 16000, min: 120, ritmo: 21, peso: 10 },
      { nome: 'Volume brasileiro', oficio: 'cilios', preco: 18000, min: 150, ritmo: 21, peso: 10 },
      { nome: 'Lash lifting', oficio: 'cilios', preco: 14000, min: 60, ritmo: 45, peso: 10 },
      { nome: 'Design com henna', oficio: 'sobrancelha', preco: 6500, min: 45, ritmo: 21, peso: 50 },
      { nome: 'Design simples', oficio: 'sobrancelha', preco: 4500, min: 30, ritmo: 21, peso: 35 },
      { nome: 'Brow lamination', oficio: 'sobrancelha', preco: 11000, min: 60, ritmo: 45, peso: 15 },
      { nome: 'Remoção', oficio: 'cilios', preco: 5000, min: 30, ritmo: null, peso: 0 },
    ],
    equipe: [
      {
        nome: 'Carol Menezes',
        dona: true,
        cor: '#8c4766',
        carteira: [
          { oficio: 'cilios', clientes: 50 },
          { oficio: 'sobrancelha', clientes: 28 },
        ],
        // Relatório de concorrentes §3: a lash quase sempre faz a sobrancelha junto.
        noMesmoDia: { de: 'cilios', servico: 'Design com henna', fracao: 0.4 },
      },
    ],
  },
  {
    slug: 'demo-salao-encanto',
    nome: 'Salão Encanto',
    vertical: 'hair',
    plano: 'avancado',
    agendaSoDoProfissional: true,
    revenda: 'Óleo de cutícula',
    servicos: [
      { nome: 'Corte feminino', oficio: 'cabelo', preco: 11000, min: 60, ritmo: 60, peso: 25 },
      { nome: 'Escova', oficio: 'cabelo', preco: 7000, min: 45, ritmo: 15, peso: 35 },
      { nome: 'Hidratação', oficio: 'cabelo', preco: 11000, min: 60, ritmo: 30, peso: 20 },
      { nome: 'Progressiva', oficio: 'cabelo', preco: 26000, min: 180, ritmo: 120, peso: 10 },
      { nome: 'Coloração / raiz', oficio: 'cor', preco: 19000, min: 120, ritmo: 40, peso: 65 },
      { nome: 'Mechas', oficio: 'cor', preco: 42000, min: 240, ritmo: 90, peso: 35 },
      ...UNHAS,
      { nome: 'Design com henna', oficio: 'sobrancelha', preco: 6500, min: 45, ritmo: 21, peso: 60 },
      { nome: 'Design simples', oficio: 'sobrancelha', preco: 4500, min: 30, ritmo: 21, peso: 40 },
      { nome: 'Buço', oficio: 'depilacao', preco: 2000, min: 15, ritmo: 30, peso: 30 },
      { nome: 'Virilha', oficio: 'depilacao', preco: 6000, min: 40, ritmo: 30, peso: 40 },
      { nome: 'Meia perna', oficio: 'depilacao', preco: 5000, min: 40, ritmo: 30, peso: 30 },
      // `docs/112` §4 C4: corte masculino fica, no fim da lista.
      { nome: 'Corte masculino', oficio: 'cabelo', preco: 5500, min: 30, ritmo: 30, peso: 10 },
    ],
    equipe: [
      { nome: 'Vanessa Prado', dona: true, cor: '#8c4766', carteira: [{ oficio: 'cor', clientes: 110 }], tambem: ['cabelo'] },
      { nome: 'Thiago Reis', papel: 'Cabelo', cor: '#b45309', carteira: [{ oficio: 'cabelo', clientes: 140 }] },
      { nome: 'Juliana Castro', papel: 'Unhas', cor: '#d4949f', carteira: [{ oficio: 'unhas', clientes: 62 }] },
      { nome: 'Bruna Siqueira', papel: 'Unhas', cor: '#be185d', carteira: [{ oficio: 'unhas', clientes: 55 }] },
      {
        nome: 'Tatiane Moreira',
        papel: 'Sobrancelha e depilação',
        cor: '#7c3aed',
        carteira: [
          { oficio: 'sobrancelha', clientes: 90 },
          { oficio: 'depilacao', clientes: 120 },
        ],
      },
    ],
  },
  {
    slug: 'demo-esmalteria-rosa-cha',
    nome: 'Esmalteria Rosa Chá',
    vertical: 'nails',
    plano: 'equipe',
    revenda: 'Óleo de cutícula',
    servicos: [...UNHAS, ...ALONGAMENTO],
    equipe: [
      { nome: 'Patrícia Lima', dona: true, cor: '#8c4766', carteira: [{ oficio: 'alongamento', clientes: 48 }], tambem: ['unhas'] },
      { nome: 'Daiane Souza', papel: 'Manicure', cor: '#d4949f', carteira: [{ oficio: 'unhas', clientes: 62 }] },
      { nome: 'Kelly Ramos', papel: 'Manicure', cor: '#be185d', carteira: [{ oficio: 'unhas', clientes: 58 }] },
    ],
  },
  {
    slug: 'demo-ana-paula-unhas',
    nome: 'Ana Paula Unhas',
    vertical: 'nails',
    plano: 'gratis',
    revenda: 'Óleo de cutícula',
    // Atende na casa da cliente: o deslocamento está no preço (sem campo novo, `04-salao.md` §5.2).
    servicos: [
      { nome: 'Pé e mão', oficio: 'unhas', preco: 6500, min: 90, ritmo: 14, peso: 55 },
      { nome: 'Mão', oficio: 'unhas', preco: 3500, min: 45, ritmo: 14, peso: 25 },
      { nome: 'Esmaltação em gel', oficio: 'unhas', preco: 8000, min: 60, ritmo: 18, peso: 20 },
    ],
    // `gratis`: teto de 1 profissional e 50 clientes (`src/core/billing/planos.ts`).
    equipe: [{ nome: 'Ana Paula Ribeiro', dona: true, cor: '#8c4766', carteira: [{ oficio: 'unhas', clientes: 50 }] }],
  },
]

/** Os ofícios que a profissional faz: os da carteira e os de `tambem`. */
export function oficiosDe(profissional) {
  return [...new Set([...profissional.carteira.map((c) => c.oficio), ...(profissional.tambem ?? [])])]
}

/** Os serviços que entram em `professional_services` para ela: só os do ofício dela. */
export function servicosDe(conta, profissional) {
  const oficios = oficiosDe(profissional)
  return conta.servicos.filter((s) => oficios.includes(s.oficio))
}

const MULHERES = [
  'Ana', 'Beatriz', 'Camila', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Jéssica',
  'Larissa', 'Luana', 'Mariana', 'Natália', 'Rafaela', 'Sabrina', 'Tatiana', 'Yasmin', 'Aline', 'Bruna',
  'Carolina', 'Débora', 'Elisa', 'Flávia', 'Giovana', 'Ingrid', 'Juliana', 'Kátia', 'Letícia', 'Michele',
  'Nicole', 'Paula', 'Renata', 'Sara', 'Thaís', 'Valéria', 'Viviane', 'Amanda', 'Bianca', 'Cíntia',
  'Denise', 'Érica', 'Fabiana', 'Gisele', 'Joana', 'Lívia', 'Melissa', 'Priscila', 'Rosana', 'Simone',
]
export const HOMENS = ['Lucas', 'Rafael', 'Gustavo', 'Felipe', 'André', 'Mateus']
const SOBRENOMES = [
  'Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento',
  'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Ribeiro', 'Barbosa', 'Rocha', 'Dias', 'Moreira', 'Cardoso',
  'Teixeira', 'Correia', 'Mendes', 'Freitas', 'Pinto', 'Cavalcanti', 'Batista', 'Monteiro', 'Vieira', 'Campos',
]

/** Um em cada dez nomes é de homem: ele existe em unha e sobrancelha (`04-salao.md` §5.3). */
export function nomesDaConta(slug, quantos) {
  const embaralhar = (lista) => [...lista].sort((a, b) => rnd(slug, a) - rnd(slug, b))
  const delas = embaralhar(MULHERES.flatMap((n) => SOBRENOMES.map((s) => `${n} ${s}`)))
  const deles = embaralhar(HOMENS.flatMap((n) => SOBRENOMES.map((s) => `${n} ${s}`)))
  return Array.from({ length: quantos }, (_, i) => (i % 10 === 7 ? deles[Math.floor(i / 10)] : delas[i - Math.floor((i + 2) / 10)]))
}

function sortearPorPeso(servicos, semente) {
  const total = servicos.reduce((s, x) => s + x.peso, 0)
  let alvo = rnd(semente) * total
  for (const s of servicos) {
    alvo -= s.peso
    if (alvo < 0) return s
  }
  return servicos[servicos.length - 1]
}

/** Fração EXATA de clientes que passaram do dia: sorteio cliente a cliente deu de 9% a 29% (medido). */
const FRACAO_ATRASADA = 0.18

/**
 * Quantos dias depois do ritmo cada cliente está, por índice: 18% passaram do dia (perdida, em
 * risco, atrasada, na proporção 5:6:7), o resto está em dia. Quem passou é escolhido por semente.
 */
function atrasosDaConta(slug, total) {
  const ordem = Array.from({ length: total }, (_, i) => i).sort((a, b) => rnd(slug, a, 'estado') - rnd(slug, b, 'estado'))
  const quantas = Math.round(total * FRACAO_ATRASADA)
  const atrasos = new Map()
  ordem.slice(0, quantas).forEach((i, k) => atrasos.set(i, k < (quantas * 5) / 18 ? 45 : k < (quantas * 11) / 18 ? 20 : 6))
  return atrasos
}

/**
 * O plano de clientes da conta: quem atende cada uma, o serviço de costume, o do mesmo dia (se
 * houver) e há quantos dias foi a última visita. É daqui que saem o histórico e a ocupação.
 */
export function planoDeClientes(conta) {
  const total = conta.equipe.reduce((s, p) => s + p.carteira.reduce((t, c) => t + c.clientes, 0), 0)
  const nomes = nomesDaConta(conta.slug, total)
  const atrasos = atrasosDaConta(conta.slug, total)
  const clientes = []
  for (const [profIdx, prof] of conta.equipe.entries()) {
    for (const fatia of prof.carteira) {
      const doOficio = conta.servicos.filter((s) => s.oficio === fatia.oficio && s.ritmo !== null)
      for (let k = 0; k < fatia.clientes; k++) {
        const i = clientes.length
        const semente = `${conta.slug}|${i}`
        const servico = sortearPorPeso(doOficio, semente)
        const combo = prof.noMesmoDia
        const extra =
          combo && combo.de === fatia.oficio && rnd(semente, 'mesmo-dia') < combo.fracao
            ? conta.servicos.find((s) => s.nome === combo.servico)
            : null
        const atraso = atrasos.get(i) ?? null
        const ultimaHa = atraso === null ? 1 + Math.floor(rnd(semente, 'ultima') * servico.ritmo * 0.85) : servico.ritmo + atraso
        clientes.push({ nome: nomes[i], profIdx, servico, extra, atraso, ultimaHa })
      }
    }
  }
  return clientes
}

/**
 * Ocupação semanal de cada profissional, em %: Σ (duração da visita × 7 ÷ ritmo) ÷ horas abertas,
 * só de quem está em dia. Quem passou do dia não está vindo: contá-la dava 10 pontos acima do que o
 * seed mede no banco (medido em 21/10: 64% no plano, 54% gravado, na conta da Carol).
 */
export function ocupacaoPorProfissional(conta, clientes = planoDeClientes(conta)) {
  return conta.equipe.map((prof, profIdx) => {
    const minutos = clientes
      .filter((c) => c.profIdx === profIdx && c.atraso === null)
      .reduce((s, c) => s + ((c.servico.min + (c.extra?.min ?? 0)) * 7) / c.servico.ritmo, 0)
    return { nome: prof.nome, pct: Math.round((100 * minutos) / MINUTOS_ABERTOS_POR_SEMANA) }
  })
}

/** % de clientes que passaram do dia de voltar. */
export function pctAtrasadas(clientes) {
  return Math.round((100 * clientes.filter((c) => c.atraso !== null).length) / clientes.length)
}
