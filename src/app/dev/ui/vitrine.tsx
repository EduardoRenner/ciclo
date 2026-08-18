'use client'

import { useState } from 'react'

import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import Sheet from '@/components/ui/sheet'
import Skeleton from '@/components/ui/skeleton'
import StatTile from '@/components/ui/stat-tile'
import ToastProvider, { useToast } from '@/components/ui/toast'
import TabBar from '@/components/shell/tab-bar'

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">{titulo}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  )
}

function Conteudo({ icones }: { icones: { agenda: React.ReactNode; clientes: React.ReactNode } }) {
  const [sheetAberto, setSheetAberto] = useState(false)
  const [filtro, setFiltro] = useState('hoje')
  const mostrarToast = useToast()

  return (
    <>
      <Secao titulo="Button">
        <Button>Confirmar</Button>
        <Button variante="secondary">Remarcar</Button>
        <Button variante="success">Cobrar</Button>
        <Button variante="danger">Cancelar</Button>
        <Button carregando>Salvando</Button>
        <Button disabled motivoDesabilitado="Escolha um horário antes de confirmar.">
          Confirmar
        </Button>
        <Button largura="cheia">Ação primária, largura cheia</Button>
      </Secao>

      <Secao titulo="Chip">
        {['hoje', 'semana', 'atrasadas'].map((f) => (
          <Chip key={f} ligado={filtro === f} onClick={() => setFiltro(f)}>
            {f}
          </Chip>
        ))}
      </Secao>

      <Secao titulo="Badge — cor sempre com marca">
        <Badge estado="ok">Confirmado</Badge>
        <Badge estado="warn">Aguardando</Badge>
        <Badge estado="risk">Em risco</Badge>
        <Badge estado="bad">Faltou</Badge>
        <Badge estado="info">Sinal pago</Badge>
        <Badge estado="ciclo">Ciclo</Badge>
      </Secao>

      <Secao titulo="StatTile">
        <StatTile className="flex-1" rotulo="Receita do mês" valor="R$ 12.480" progresso={0.72} />
        <StatTile className="flex-1" rotulo="Valor parado" valor="R$ 3.150" />
      </Secao>

      <Secao titulo="Card">
        <Card className="w-full">
          <p className="text-corpo font-semibold">Bruna Almeida</p>
          <p className="mt-0.5 text-secundario text-txt-2">Volume russo · 14:30 · 2h30</p>
        </Card>
      </Secao>

      <Secao titulo="Skeleton">
        <Card className="w-full">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-2 h-3 w-3/4" />
          <Skeleton className="mt-4 h-12 w-full" />
        </Card>
      </Secao>

      <Secao titulo="EmptyState">
        <Card className="w-full p-0">
          <EmptyState
            icone={icones.clientes}
            titulo="Nenhuma cliente ainda"
            descricao="Quando você cadastrar a primeira, ela aparece aqui com o histórico dela."
            acao={<Button>Cadastrar cliente</Button>}
          />
        </Card>
      </Secao>

      <Secao titulo="Sheet">
        <Button variante="secondary" onClick={() => setSheetAberto(true)}>
          Abrir bottom sheet
        </Button>
        <Sheet
          aberto={sheetAberto}
          aoFechar={setSheetAberto}
          titulo="Detalhe do agendamento"
          descricao="Abre por cima da agenda para não perder o contexto."
        >
          <Card>
            <p className="text-corpo font-semibold">Volume russo</p>
            <p className="mt-0.5 text-secundario text-txt-2">Hoje, 14:30 · R$ 220,00</p>
          </Card>
          <div className="mt-4 flex gap-2">
            <Button largura="cheia" onClick={() => setSheetAberto(false)}>
              Confirmar
            </Button>
          </div>
        </Sheet>
      </Secao>

      <Secao titulo="Toast">
        <Button
          variante="secondary"
          onClick={() => mostrarToast({ tom: 'ok', titulo: 'Prontinho', descricao: 'Agendamento confirmado.' })}
        >
          Sucesso
        </Button>
        <Button
          variante="secondary"
          onClick={() =>
            mostrarToast({
              tom: 'erro',
              titulo: 'Esse horário acabou de ser reservado',
              descricao: 'Quer 15h ou 16h30?',
            })
          }
        >
          Erro
        </Button>
      </Secao>

      <Secao titulo="Escala tipográfica">
        <div className="w-full">
          <p className="tabular text-numero font-extrabold">R$ 12.480</p>
          <p className="text-titulo font-extrabold">Título de tela</p>
          <p className="text-stat font-extrabold">Valor de stat</p>
          <p className="text-corpo">Corpo — português direto, sem jargão.</p>
          <p className="text-secundario text-txt-2">Secundário</p>
          <p className="text-label font-semibold text-txt-3">Label / caption</p>
        </div>
      </Secao>

      <Secao titulo="Shell — tab bar (TICKET-014)">
        <p className="mb-2 text-secundario text-txt-2">
          Fixa no rodapé da viewport, como no app de verdade — não uma cópia visual.
        </p>
      </Secao>

      <Secao titulo="Ícone de ação">
        <Button variante="secondary">
          {icones.agenda}
          Novo agendamento
        </Button>
      </Secao>

      <TabBar />
    </>
  )
}

export default function Vitrine(props: { icones: { agenda: React.ReactNode; clientes: React.ReactNode } }) {
  return (
    <ToastProvider>
      <Conteudo {...props} />
    </ToastProvider>
  )
}
