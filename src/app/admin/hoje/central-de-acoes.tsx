'use client'

import { ChevronRight, DollarSign, FileText, Gift, Scissors, Star, TrendingUp, UserPlus, UserX } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import Card from '@/components/ui/card'
import IconeAnel from '@/components/ui/icone-anel'
import SectionHeader from '@/components/ui/section-header'
import { APP_HOST } from '@/lib/app-url'

import type { CentralDeAcoes as Dados } from '@/server/services/crm'

const TOM: Record<Dados['acoes'][number]['tom'], string> = {
  warn: 'border-warn/30 bg-warn/5',
  info: '',
  ok: 'border-ok/30 bg-ok/5',
}

/**
 * docs/62 Fase E2: só a borda (`TOM`) mal dava pra notar no tema claro — medido, quase
 * invisível. Um ícone por categoria ajuda a escanear a lista sem ler as quatro frases.
 * Fallback (`FileText`) cobre qualquer `chave` nova que nasça antes deste mapa saber dela —
 * nunca quebra por chave desconhecida, só fica genérico.
 */
const ICONE: Record<string, typeof DollarSign> = {
  recuperar: UserX,
  aniversariantes: Gift,
  pontos: Star,
  orcamentos: FileText,
  'plano-perto-do-teto': TrendingUp,
  'completude-taxa': DollarSign,
  'completude-custo-fixo': DollarSign,
  'completude-material': Scissors,
  'inicio-servicos': Scissors,
  'inicio-clientes': UserPlus,
  'inicio-agenda': UserPlus,
}

/** docs/62 Fase E1: piso de cards visíveis antes do "ver mais" — medido, 4 cards de sugestão
 * empurravam qualquer coisa acionável pra debaixo da dobra num dia vazio. */
const VISIVEIS_DE_INICIO = 3

/**
 * "Próximo passo sugerido" — nunca aparece vazio: some da tela quando não há nada a sugerir.
 * O título vem do servidor porque muda de sentido numa conta que ainda não começou ("Primeiros
 * passos"), onde antes a seção inteira simplesmente não existia.
 */
export default function CentralDeAcoes({ dados, nativo }: { dados: Dados; nativo: boolean }) {
  const { titulo, acoes } = dados
  const [expandido, setExpandido] = useState(false)
  if (acoes.length === 0) return null

  // `centralDeAcoes` (crm.ts) já ordena por prioridade (recuperar → aniversariantes → pontos →
  // orçamentos → completude); cortar aqui preserva essa ordem, não reordena por conta própria.
  const visiveis = expandido ? acoes : acoes.slice(0, VISIVEIS_DE_INICIO)
  const escondidos = acoes.length - visiveis.length

  return (
    <section className="mb-6">
      <SectionHeader icone={<IconeAnel className="size-3.5" />}>{titulo}</SectionHeader>
      <div className="grid gap-2">
        {visiveis.map((acao) => {
          const Icone = ICONE[acao.chave] ?? FileText
          // T1.5 (docs/64 §0.2): "plano-perto-do-teto" é a única ação que aponta pra `/precos` —
          // nenhum link de cobrança pode ficar ativo dentro do app nativo, mesma regra do
          // `BloqueioPlano`. O card continua aparecendo (a informação em si não é cobrança), só
          // deixa de ser clicável.
          const ehCobranca = nativo && acao.href === '/precos'
          const conteudo = (
            <Card pressionavel={!ehCobranca} className={`flex items-center gap-3 ${TOM[acao.tom]}`}>
              <Icone aria-hidden className="size-5 shrink-0 text-txt-3" />
              <div className="min-w-0 flex-1">
                <p className="text-corpo font-semibold">{acao.titulo}</p>
                <p className="mt-0.5 text-secundario text-txt-2">
                  {acao.descricao}
                  {ehCobranca ? ` Gerencie seu plano em ${APP_HOST}.` : ''}
                </p>
              </div>
              {ehCobranca ? null : <ChevronRight aria-hidden className="size-5 shrink-0 text-txt-3" />}
            </Card>
          )
          return ehCobranca ? (
            <div key={acao.chave}>{conteudo}</div>
          ) : (
            <Link key={acao.chave} href={acao.href} className="block">
              {conteudo}
            </Link>
          )
        })}
      </div>
      {!expandido && escondidos > 0 ? (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="toque-48 mt-2 flex h-10 w-full items-center justify-center text-label font-semibold text-acc-2"
        >
          {`Ver mais ${escondidos}`}
        </button>
      ) : null}
    </section>
  )
}
