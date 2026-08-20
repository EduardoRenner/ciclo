import { Bell, Clock, FileText, MessageSquareText, Megaphone, Repeat, Repeat2, ScrollText, Scissors, ShieldCheck, Store, Users } from 'lucide-react'
import Link from 'next/link'

import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import SectionHeader from '@/components/ui/section-header'

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
      { href: '/admin/campanhas', titulo: 'Campanhas', descricao: 'Mandar em lote e ver quanto voltou em receita', icone: Megaphone },
      { href: '/admin/config/notificacoes', titulo: 'Notificações', descricao: 'Ativar lembretes no aparelho', icone: Bell },
    ],
  },
  {
    titulo: 'Receita recorrente',
    itens: [
      { href: '/admin/config/planos', titulo: 'Fidelidade e assinatura', descricao: 'Pontos por atendimento e planos mensais', icone: Repeat },
      { href: '/admin/orcamentos', titulo: 'Orçamentos', descricao: 'Acompanhar quem aprovou, recusou ou ainda não respondeu', icone: FileText },
      { href: '/admin/series', titulo: 'Séries de recorrência', descricao: 'Ver quem repete e cancelar quando precisar', icone: Repeat2 },
    ],
  },
  {
    titulo: 'Privacidade',
    itens: [
      { href: '/admin/config/cofre', titulo: 'Trilha do cofre', descricao: 'Quem acessou a ficha de saúde de cada cliente', icone: ScrollText },
      { href: '/admin/config/seguranca', titulo: 'Segurança', descricao: 'Autenticação em duas etapas da sua conta', icone: ShieldCheck },
    ],
  },
] as const

export default function PaginaConfig() {
  return (
    <>
      <PageHeader titulo="Configurações" />

      <div className="flex flex-col gap-6">
        {GRUPOS.map((grupo) => (
          <section key={grupo.titulo}>
            <SectionHeader>{grupo.titulo}</SectionHeader>
            <div className="flex flex-col gap-2">
              {grupo.itens.map((item) => {
                const Icone = item.icone
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
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
