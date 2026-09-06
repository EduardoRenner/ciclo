import { BadgeDollarSign, Bell, Bot, Building2, CalendarRange, Clock, CreditCard, FileText, HandCoins, Megaphone, MessageSquareText, Package, Repeat, Repeat2, Scissors, ScrollText, ShieldCheck, Store, ToggleRight, Users, Wallet } from 'lucide-react'
import Link from 'next/link'

import { headers } from 'next/headers'

import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import SectionHeader from '@/components/ui/section-header'
import { NOME_DO_PLANO, type PlanoTier } from '@/core/billing/planos'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarModulos } from '@/server/services/modulos'

import SairDaConta from './sair'

/** Sem `await`, viraria página estática — quebra o nonce do CSP por requisição (ver `docs/DECISOES.md`). */
export const dynamic = 'force-dynamic'

/**
 * Eram nove itens numa lista chapada, do preço do serviço até a trilha de
 * acesso à ficha de saúde — coisas de peso e frequência completamente
 * diferentes, com o mesmo desenho e nenhuma ordem aparente. Agrupados por
 * pergunta que a pessoa está se fazendo quando abre esta tela.
 */
const GRUPOS = [
  {
    titulo: 'Seu negócio',
    itens: [
      { href: '/admin/config/negocio', titulo: 'Negócio', descricao: 'Nome, contato, sobre e link do seu site', icone: Store },
      { href: '/admin/config/servicos', titulo: 'Serviços', descricao: 'Preço, duração e o que aparece no site', icone: Scissors },
      { href: '/admin/config/profissionais', titulo: 'Time', descricao: 'Quem atende, expediente e convites', icone: Users },
      { href: '/admin/config/horarios', titulo: 'Horário de funcionamento', descricao: 'Expediente padrão do negócio', icone: Clock },
    ],
  },
  {
    titulo: 'Falar com a cliente',
    itens: [
      { href: '/admin/config/mensagens', titulo: 'Mensagens prontas', descricao: 'Textos que você manda com um toque', icone: MessageSquareText },
      { href: '/admin/config/automacoes', titulo: 'Automações', descricao: 'O que o CICLO faz sozinho, e quanta rédea você dá', icone: Bot },
      { href: '/admin/campanhas', titulo: 'Campanhas', descricao: 'Mandar em lote e ver quanto voltou em receita', icone: Megaphone, modulo: 'campaigns' },
      { href: '/admin/config/notificacoes', titulo: 'Notificações', descricao: 'Ativar lembretes no aparelho', icone: Bell },
    ],
  },
  {
    titulo: 'Dinheiro',
    itens: [
      { href: '/admin/caixa', titulo: 'Caixa', descricao: 'Fechamento do dia, do mês e a comissão de cada um', icone: Wallet, modulo: 'register' },
      /*
        `docs/53` C-01. Sem `modulo`, de propósito: aparece para todo mundo, inclusive
        `professional` e `reception`, que não têm `register` — o `commission:own` do profissional
        não depende do módulo de caixa estar ligado. A tela de destino decide sozinha quem entra.
      */
      { href: '/admin/comissao', titulo: 'Minha comissão', descricao: 'O que você já ganhou este mês, item a item', icone: HandCoins },
      { href: '/admin/mes', titulo: 'O mês', descricao: 'Os cinco números do mês numa página só, para mostrar a alguém', icone: CalendarRange, modulo: 'register' },
      { href: '/admin/estoque', titulo: 'Estoque', descricao: 'Quanto tem de cada produto e registrar compra', icone: Package, modulo: 'stock' },
      { href: '/admin/config/taxas', titulo: 'Taxa da maquininha', descricao: 'Quanto a máquina fica de cada forma de pagamento', icone: CreditCard, modulo: 'register' },
      { href: '/admin/config/custo-fixo', titulo: 'Aluguel e contas', descricao: 'O que sai todo mês, para o Sobrou virar lucro de verdade', icone: Building2, modulo: 'register' },
    ],
  },
  {
    titulo: 'Receita recorrente',
    itens: [
      { href: '/admin/config/planos', titulo: 'Fidelidade e assinatura', descricao: 'Pontos por atendimento e planos mensais', icone: Repeat, modulo: 'loyalty' },
      { href: '/admin/orcamentos', titulo: 'Orçamentos', descricao: 'Acompanhar quem aprovou, recusou ou ainda não respondeu', icone: FileText, modulo: 'quotes' },
      { href: '/admin/series', titulo: 'Séries de recorrência', descricao: 'Ver quem repete e cancelar quando precisar', icone: Repeat2, modulo: 'recurrence' },
    ],
  },
  {
    /*
      Grupo próprio: "Meu plano" é sobre a conta do PROFISSIONAL no CICLO, e não cabe em nenhum
      dos outros. Colocar junto de "Fidelidade e assinatura" — que é o salão vendendo plano para a
      CLIENTE dele — seria juntar exatamente as duas coisas que a regra 5.6 do plano de
      monetização manda manter separadas.
    */
    titulo: 'Sua conta no CICLO',
    itens: [
      { href: '/admin/config/meu-plano', titulo: 'Meu plano', descricao: 'O que você usa, o que cada plano libera', icone: BadgeDollarSign },
      { href: '/admin/config/modulos', titulo: 'Módulos', descricao: 'Ligue só o que você usa na interface', icone: ToggleRight },
    ],
  },
  {
    titulo: 'Privacidade',
    itens: [
      { href: '/admin/config/cofre', titulo: 'Trilha do cofre', descricao: 'Quem acessou a ficha de saúde de cada cliente', icone: ScrollText, modulo: 'health_records' },
      { href: '/admin/config/seguranca', titulo: 'Segurança', descricao: 'Autenticação em duas etapas da sua conta', icone: ShieldCheck },
    ],
  },
] as const

export const metadata = { title: "Configurações" }

/**
 * A tela de módulos promete, com estas palavras, que "desligar esconde da interface". Este filtro
 * é o que torna a promessa verdadeira: item de hub cujo módulo está desligado (pelo dono) ou fora
 * do eixo do negócio não aparece aqui.
 *
 * Bloqueado pelo PLANO continua aparecendo, e isso é de propósito — a regra 5.2 manda mostrar o
 * motivo e o caminho, e sumir com o item seria esconder o que dá para comprar. Quem some é só o
 * que não faz sentido (eixo) ou o que a pessoa escolheu não ver (dono).
 *
 * **O selo do degrau, acrescentado em 2026-09-03, é o que faltava para essa intenção se cumprir.**
 * O item ficava aqui para ser comprado e era desenhado IGUAL a um item liberado: mesmo cartão,
 * mesma cor, nenhuma marca. Quem está no Grátis tocava em "Campanhas", montava a campanha inteira
 * e só descobria que é paga quando a rota recusou o envio — o mesmo defeito que
 * `recurso-pago-avisa-antes` pegou no estoque, replicado em cinco itens deste hub.
 *
 * O selo vive AQUI, e não em cada tela de destino, porque nasce do `veredito` que `listarModulos`
 * já devolve: item de módulo novo ganha o selo sozinho, sem ninguém lembrar. É a diferença entre
 * consertar os cinco casos e consertar a pergunta.
 */
export default async function PaginaConfig() {
  const ctx = await contextoAtual(new Request('https://interno/config', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const modulos = await listarModulos(db, ctx.tenantId)

  const visivel = (chave?: string) => {
    if (!chave) return true
    const m = modulos.find((x) => x.key === chave)
    // Ausente da lista = fora do eixo (listarModulos já filtrou). Não faz sentido, então some.
    if (!m) return false
    return m.veredito.estado !== 'desligado_pelo_dono'
  }

  /** O degrau que libera este item, quando o plano de hoje não libera. */
  const degrauQueFalta = (chave?: string): PlanoTier | null => {
    if (!chave) return null
    const v = modulos.find((x) => x.key === chave)?.veredito
    return v?.estado === 'bloqueado_pelo_plano' ? v.precisaDo : null
  }

  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => visivel('modulo' in i ? i.modulo : undefined)) }))
    .filter((g) => g.itens.length > 0)

  return (
    <>
      <PageHeader titulo="Configurações" />

      <div className="flex flex-col gap-6">
        {grupos.map((grupo) => (
          <section key={grupo.titulo}>
            <SectionHeader>{grupo.titulo}</SectionHeader>
            <div className="flex flex-col gap-2">
              {grupo.itens.map((item) => {
                const Icone = item.icone
                const falta = degrauQueFalta('modulo' in item ? item.modulo : undefined)
                return (
                  <Link key={item.href} href={item.href} className="block">
                    <Card pressionavel className="flex items-center gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-acc-soft text-acc-2">
                        <Icone aria-hidden className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-corpo font-semibold">{item.titulo}</p>
                        <p className="truncate text-secundario text-txt-2">{item.descricao}</p>
                      </div>
                      {/*
                        Selo, não cadeado sozinho: o nome do degrau responde "quanto custa isso?"
                        num toque a menos. Cor de destaque em vez de cinza porque isto é uma oferta,
                        e o §5.10 proíbe punir quem não pagou — o item continua abrindo.

                        O texto do leitor de tela diz a frase inteira; o selo visual mostra só o
                        nome do plano, que é o que cabe em 390 px sem espremer o título do item.
                      */}
                      {falta ? (
                        <span className="shrink-0 rounded-[var(--radius-pill)] bg-acc-soft px-2.5 py-1 text-label font-semibold text-acc-2">
                          <span className="sr-only">Recurso do plano </span>
                          {NOME_DO_PLANO[falta]}
                        </span>
                      ) : null}
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}

        {/* Auditoria de segurança, achado S9: até 2026-08-23 não havia como sair da conta. */}
        <section>
          <SectionHeader>Sua conta</SectionHeader>
          <SairDaConta />
        </section>
      </div>
    </>
  )
}
