'use client'

import { useState } from 'react'

import ActionBar from '@/components/ui/action-bar'
import AlertBanner from '@/components/ui/alert-banner'
import AppointmentRow from '@/components/ui/appointment-row'
import Avatar from '@/components/ui/avatar'
import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import FilterRow from '@/components/ui/filter-row'
import Input from '@/components/ui/input'
import MoneyInput from '@/components/ui/money-input'
import PhoneInput from '@/components/ui/phone-input'
import Select from '@/components/ui/select'
import Sheet from '@/components/ui/sheet'
import Skeleton from '@/components/ui/skeleton'
import StatTile from '@/components/ui/stat-tile'
import Textarea from '@/components/ui/textarea'
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
  const [telefone, setTelefone] = useState('')
  const [preco, setPreco] = useState(22000)
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

      <Secao titulo="Campos (Input, PhoneInput, MoneyInput, Select, Textarea)">
        <div className="flex w-full flex-col gap-3">
          <Input rotulo="Nome da cliente" placeholder="Maria Clara" autoComplete="name" />
          <PhoneInput valor={telefone} aoMudar={setTelefone} ajuda="A máscara é aplicada enquanto você digita." />
          <MoneyInput rotulo="Preço do serviço" centavos={preco} aoMudar={setPreco} />
          <Select rotulo="Profissional" defaultValue="">
            <option value="" disabled>
              Escolha uma
            </option>
            <option value="ana">Ana</option>
            <option value="bia">Bia</option>
          </Select>
          <Textarea rotulo="Observações" placeholder="Alergia a acetona" />
          <Input rotulo="E-mail" defaultValue="nao-e-um-email" erro="Confira o endereço — falta o @." />
        </div>
      </Secao>

      <Secao titulo="AlertBanner">
        <div className="flex w-full flex-col gap-2">
          <AlertBanner>O Motor de Ciclo trouxe R$ 1.240 este mês.</AlertBanner>
          <AlertBanner tom="warn" acao={<span className="text-warn">Recuperar</span>}>
            7 clientes estão sumindo
          </AlertBanner>
          <AlertBanner tom="danger">Alergia registrada na ficha desta cliente.</AlertBanner>
        </div>
      </Secao>

      <Secao titulo="Avatar">
        <Avatar nome="Maria Clara Souza" tamanho="lg" />
        <Avatar nome="Bruna Almeida" />
        <Avatar nome="Duda" tamanho="sm" />
      </Secao>

      <Secao titulo="FilterRow — rola, encaixa e esmaece na borda">
        <FilterRow rotulo="Exemplo de filtros" className="w-full">
          {['Todas', 'Na hora de voltar', 'Atrasadas', 'Em risco', 'Perdidas'].map((f) => (
            <Chip key={f} ligado={filtro === f} onClick={() => setFiltro(f)}>
              {f}
            </Chip>
          ))}
        </FilterRow>
      </Secao>

      <Secao titulo="StatTile">
        <StatTile
          className="w-full"
          heroi
          rotulo="Faturado hoje"
          valor="R$ 1.240"
          apoio="Faltam 3 atendimentos hoje"
        />
        <StatTile className="flex-1" rotulo="Receita do mês" valor="R$ 12.480" progresso={0.72} />
        <StatTile className="flex-1" rotulo="Valor parado" valor="R$ 3.150" />
      </Secao>

      <Secao titulo="Card">
        <Card className="w-full">
          <p className="text-corpo font-semibold">Bruna Almeida</p>
          <p className="mt-0.5 text-secundario text-txt-2">Volume russo · 14:30 · 2h30</p>
        </Card>
      </Secao>

      <Secao titulo="AppointmentRow">
        <div className="flex w-full flex-col gap-2">
          <AppointmentRow horario="14:30" clienteNome="Bruna Almeida" servicoNome="Volume russo" status="confirmed" />
          <AppointmentRow
            horario="16:00"
            clienteNome="Carla Souza"
            servicoNome="Volume egípcio · Ana"
            status="pending"
            altoRisco
            alertaSaude
          />
          <AppointmentRow horario="17:15" clienteNome="Duda Reis" servicoNome="Manutenção" status="no_show" />
        </div>
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
            titulo="Sem clientes ainda"
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

      <Secao titulo="ActionBar">
        <p className="text-secundario text-txt-2">
          Ancorada acima da tab bar, no terço inferior da tela (§3.2). Aparece ao selecionar algo.
        </p>
      </Secao>

      <Secao titulo="Escala tipográfica">
        <div className="w-full">
          <p className="tabular text-numero font-bold">R$ 12.480</p>
          <p className="text-titulo font-bold">Título de tela</p>
          <p className="text-stat font-bold">Valor de stat</p>
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

      <ActionBar visivel={filtro !== 'hoje'}>
        <Button largura="cheia">Avisar 3</Button>
      </ActionBar>

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
