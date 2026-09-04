import { headers } from 'next/headers'

import PageHeader from '@/components/ui/page-header'
import { AUTOMACOES } from '@/core/automacoes/catalogo'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { configDeAutomacoes } from '@/server/services/automacoes'

import Automacoes from './automacoes'

/** Sem `await`, viraria página estática — quebra o nonce do CSP por requisição. */
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Automações' }

/**
 * `docs/33-AUTOMACAO-AGENTE-PLANO.md §3.2`: tela própria, e não escondida dentro do painel do
 * assistente. Três razões, todas do plano: configuração mora em Configurações nesta casa; o dono
 * precisa ver **tudo que está ligado numa lista só** — automação espalhada é automação
 * esquecida; e é aqui que o estado real de cada uma cabe sem poluir o painel.
 *
 * O que esta tela faz de diferente do que a casa já tinha: separa **"você escolheu"** de **"o
 * produto consegue"**. Uma automação pode estar no nível que o dono quis e mesmo assim não
 * acontecer, porque a rota não está agendada ou falta credencial. Foi exatamente essa confusão
 * que fez a tela de mensagens afirmar que lembrete saía sozinho enquanto `reminders` estava fora
 * do `schedule` (ver `docs/DECISOES.md`, 30/08). Aqui as duas coisas aparecem lado a lado.
 */
export default async function PaginaAutomacoes() {
  const ctx = await contextoAtual(new Request('https://interno/automacoes', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const config = await configDeAutomacoes(db, ctx.tenantId)

  return (
    <>
      <PageHeader
        titulo="Automações"
        /*
          Era "O que o CICLO faz sozinho por você, e o quanto de rédea você dá para cada coisa."
          Dois problemas, e o segundo é maior que o primeiro (`docs/39` §5).

          "Rédea" é metáfora, e metáfora é a primeira coisa que trava a leitura de quem lê rápido,
          no celular, entre dois atendimentos.

          E o título prometia mais do que a tela entrega: das seis automações, QUATRO têm teto no
          nível 1 ou 2 — ou seja, não fazem nada sozinhas, por desenho. A tela é, na maior parte,
          sobre o que o CICLO NÃO faz sozinho e por quê, que é justamente o argumento de confiança
          mais forte do produto. A copy passou a dizer isso em vez de vender o contrário.
        */
        descricao="Você decide o quanto cada uma pode fazer sem passar por você. Quase todas param antes de agir, e a tela diz por quê."
      />
      <Automacoes automacoes={[...AUTOMACOES]} config={config} />
    </>
  )
}
