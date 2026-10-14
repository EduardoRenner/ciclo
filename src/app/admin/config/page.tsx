import { BadgeDollarSign, Bell, Bot, Building2, CalendarRange, Clock, CreditCard, FileText, HandCoins, Megaphone, MessageSquareText, Package, Repeat, Repeat2, Scale, Scissors, ScrollText, ShieldCheck, Store, ToggleRight, Trash2, Users, Wallet } from 'lucide-react'
import Link from 'next/link'

import { headers } from 'next/headers'

import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import SectionHeader from '@/components/ui/section-header'
import { NOME_DO_PLANO, type PlanoTier } from '@/core/billing/planos'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarModulos, moduloVisivel } from '@/server/services/modulos'
import type { ModuloKey } from '@/core/billing/planos'

import { rotuloDoPapel } from '@/core/auth/rotulo-do-papel'
import SeletorDeTema from '@/components/shell/seletor-de-tema'
import SairDaConta from './sair'

/** Sem `await`, viraria página estática — quebra o nonce do CSP por requisição (ver `docs/DECISOES.md`). */
export const dynamic = 'force-dynamic'

/**
 * Eram nove itens numa lista chapada; viraram grupos por pergunta. APR-120 (docs/98 I-17, A-08)
 * reordena pela FREQUÊNCIA: o que se mexe no primeiro dia (Negócio, Serviços, Time, Horário) abre
 * sem rolar — medido antes em y=674 —, dinheiro e mensagens depois, e "Sua conta" (plano, tema,
 * sair, excluir) no fim, porque é o que se abre uma vez por mês. Descrição em UMA linha a 360 px:
 * a que cortava com "…" não dizia nada.
 */
const GRUPOS = [
  {
    titulo: 'Seu negócio',
    itens: [
      { href: '/admin/config/negocio', titulo: 'Negócio', descricao: 'Nome, contato e link do site', icone: Store },
      { href: '/admin/config/servicos', titulo: 'Serviços', descricao: 'Preço, duração e o que aparece', icone: Scissors },
      { href: '/admin/config/profissionais', titulo: 'Time', descricao: 'Quem atende, expediente e convites', icone: Users },
      { href: '/admin/config/horarios', titulo: 'Horário de funcionamento', descricao: 'Expediente padrão do negócio', icone: Clock },
      // docs/101 (Advocacia): só aparece com o módulo ligado, como qualquer item de módulo.
      { href: '/admin/config/advocacia', titulo: 'Escritório', descricao: 'OAB, prazos e intimações', icone: Scale, modulo: 'legal_deadlines' },
    ],
  },
  {
    titulo: 'Dinheiro',
    itens: [
      { href: '/admin/caixa', titulo: 'Caixa', descricao: 'Fechamento do dia e comissões', icone: Wallet, modulo: 'register' },
      { href: '/admin/comissao', titulo: 'Minha comissão', descricao: 'O que você já ganhou este mês', icone: HandCoins },
      { href: '/admin/mes', titulo: 'O mês', descricao: 'Os números do mês numa página', icone: CalendarRange, modulo: 'register' },
      { href: '/admin/estoque', titulo: 'Estoque', descricao: 'Quanto tem e registrar compra', icone: Package, modulo: 'stock' },
      { href: '/admin/config/taxas', titulo: 'Taxa da maquininha', descricao: 'O que a máquina fica por forma', icone: CreditCard, modulo: 'register' },
      { href: '/admin/config/custo-fixo', titulo: 'Aluguel e contas', descricao: 'O que sai todo mês', icone: Building2, modulo: 'register' },
      /*
        "Fidelidade e assinatura" é o salão vendendo plano para a CLIENTE dele; "Meu plano" (em Sua
        conta) é o profissional pagando o CICLO. A regra 5.6 do plano de monetização manda manter
        as duas separadas — por isso uma fica em Dinheiro e a outra em Sua conta.
      */
      { href: '/admin/config/planos', titulo: 'Fidelidade e assinatura', descricao: 'Pontos e planos mensais', icone: Repeat, modulo: 'loyalty' },
      { href: '/admin/orcamentos', titulo: 'Orçamentos', descricao: 'Quem aprovou ou não respondeu', icone: FileText, modulo: 'quotes' },
    ],
  },
  {
    titulo: 'Clientes e mensagens',
    itens: [
      { href: '/admin/config/mensagens', titulo: 'Mensagens prontas', descricao: 'Textos que você manda num toque', icone: MessageSquareText },
      { href: '/admin/config/automacoes', titulo: 'Automações', descricao: 'O que o CICLO faz sozinho', icone: Bot },
      { href: '/admin/campanhas', titulo: 'Campanhas', descricao: 'Mandar em lote e ver o retorno', icone: Megaphone, modulo: 'campaigns' },
      { href: '/admin/config/notificacoes', titulo: 'Notificações', descricao: 'Lembretes no aparelho', icone: Bell },
      { href: '/admin/series', titulo: 'Séries de recorrência', descricao: 'Quem repete, e cancelar', icone: Repeat2, modulo: 'recurrence' },
    ],
  },
  {
    titulo: 'Avançado',
    itens: [
      { href: '/admin/config/modulos', titulo: 'Módulos', descricao: 'Ligue só o que você usa', icone: ToggleRight },
      { href: '/admin/config/cofre', titulo: 'Trilha do cofre', descricao: 'Quem acessou a ficha de saúde', icone: ScrollText, modulo: 'health_records' },
      { href: '/admin/config/seguranca', titulo: 'Segurança', descricao: 'Duas etapas na sua conta', icone: ShieldCheck },
    ],
  },
] as const

/** Itens de "Sua conta" que são links; "Sair" e "Tema" têm componente próprio e entram no meio deles. */
const CONTA = {
  meuPlano: { href: '/admin/config/meu-plano', titulo: 'Meu plano', descricao: 'O que você usa e o que libera', icone: BadgeDollarSign },
  // T-DEL (docs/64 §0.3): guideline 5.1.1(v) — quem criou conta precisa conseguir excluí-la de
  // dentro do app. Sem `modulo`: é sobre a CONTA da pessoa, aparece para qualquer papel.
  excluir: { href: '/admin/config/excluir-conta', titulo: 'Excluir minha conta', descricao: 'Apaga seu login para sempre', icone: Trash2 },
} as const

type ItemDeConfigProps = { href: string; titulo: string; descricao: string; icone: typeof Store }

function ItemDeConfig({ item, falta }: { item: ItemDeConfigProps; falta: PlanoTier | null }) {
  const Icone = item.icone
  return (
    <Link href={item.href} className="block">
      <Card pressionavel className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-acc-soft text-acc-2">
          <Icone aria-hidden className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-corpo font-semibold">{item.titulo}</p>
          <p className="truncate text-secundario text-txt-2">{item.descricao}</p>
        </div>
        {/*
          Selo, não cadeado sozinho: o nome do degrau responde "quanto custa isso?" num toque a
          menos. Cor de destaque em vez de cinza porque isto é uma oferta, e o §5.10 proíbe punir
          quem não pagou — o item continua abrindo. O leitor de tela ouve a frase inteira.
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
}

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
  const ctx = await contextoDoPainel(new Request('https://interno/config', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const modulos = await listarModulos(db, ctx.tenantId)

  // A mesma regra do menu do topo (APR-103): `moduloVisivel`, em `server/services/modulos.ts`.
  const visivel = (chave?: string) => !chave || moduloVisivel(modulos, chave as ModuloKey)

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
              {grupo.itens.map((item) => (
                <ItemDeConfig key={item.href} item={item} falta={degrauQueFalta('modulo' in item ? item.modulo : undefined)} />
              ))}
            </div>
          </section>
        ))}

        {/*
          "Sua conta" por último, e "Sair" como uma linha comum entre os outros itens.

          A história desta seção: em 2026-09-10 "Sair da conta" estava em y=2184 numa página de
          2427 px, atrás de um ícone sem rótulo, e a conta foi para o TOPO. Funcionou para sair e
          empurrou o que se mexe no primeiro dia para y=674 (APR-120). A saída continua fora da
          Topbar (um alvo de 48 px que encerra a sessão o dia inteiro é acidente no tablet do
          balcão), mas aqui dentro ela é uma linha como as outras, numa seção com nome — e a
          seção diz de quem é a conta: quem entra como Recepção num salão que não é o seu precisa
          ver isso escrito.
        */}
        <section>
          <SectionHeader>Sua conta</SectionHeader>
          <div className="flex flex-col gap-2">
            <Card className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-pill)] bg-acc-soft text-corpo font-semibold text-acc-2">
                {ctx.sessao.email.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-corpo font-semibold">{ctx.sessao.email}</p>
                <p className="truncate text-secundario text-txt-2">
                  {rotuloDoPapel(ctx.papel)} em {ctx.tenant.name}
                </p>
              </div>
            </Card>
            <ItemDeConfig item={CONTA.meuPlano} falta={null} />
            <Card>
              <SeletorDeTema />
            </Card>
            <SairDaConta />
            <ItemDeConfig item={CONTA.excluir} falta={null} />
          </div>
        </section>
      </div>
    </>
  )
}
