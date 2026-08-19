import { Bell, Clock, ScrollText, Scissors, Store, Users } from 'lucide-react'
import Link from 'next/link'

import Card from '@/components/ui/card'

/** Sem `await`, viraria página estática — quebra o nonce do CSP por requisição (ver `docs/DECISOES.md`). */
export const dynamic = 'force-dynamic'

const ITENS = [
  { href: '/admin/config/negocio', titulo: 'Negócio', descricao: 'Nome, contato, sobre e link do seu site', icone: Store },
  { href: '/admin/config/servicos', titulo: 'Serviços', descricao: 'Preço, duração e o que aparece no site', icone: Scissors },
  { href: '/admin/config/profissionais', titulo: 'Profissionais', descricao: 'Equipe e convites', icone: Users },
  { href: '/admin/config/horarios', titulo: 'Horário de funcionamento', descricao: 'Expediente padrão do negócio', icone: Clock },
  { href: '/admin/config/notificacoes', titulo: 'Notificações', descricao: 'Ativar lembretes no aparelho', icone: Bell },
  { href: '/admin/config/cofre', titulo: 'Trilha do cofre', descricao: 'Quem acessou a ficha de saúde de cada cliente', icone: ScrollText },
] as const

export default function PaginaConfig() {
  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Configurações</h1>
      </header>

      <div className="flex flex-col gap-2">
        {ITENS.map((item) => {
          const Icone = item.icone
          return (
            <Link key={item.href} href={item.href} className="block">
              <Card className="flex items-center gap-3 transition hover:border-line-2 hover:bg-surface-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-acc-soft text-acc-2">
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
    </>
  )
}
