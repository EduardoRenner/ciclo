import { Check, Lock, Minus } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'

import { verificarLimite, type PlanoTier } from '@/core/billing/planos'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import SectionHeader from '@/components/ui/section-header'
import StatTile from '@/components/ui/stat-tile'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'

/** Sem `await`, viraria página estática — quebra o nonce do CSP por requisição. */
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Meu plano' }

/**
 * docs/18-MONETIZACAO-PLANO.md Fase M — a tela "Meu plano".
 *
 * Mora em `/admin/config/meu-plano` e **não** em `/admin/config/planos`, que já existe e significa
 * "Fidelidade e assinatura": o salão vendendo plano mensal para a CLIENTE dele. É a mesma colisão
 * que a regra 5.6 do prompt de monetização manda evitar em nome de tabela, e ela vale igual para
 * o espaço de URL — duas telas chamadas "planos" com significados opostos é armadilha para quem
 * chegar depois.
 *
 * O que esta tela NÃO tem, e é deliberado (regra 5.4: não fingir que integração de pagamento está
 * pronta):
 *   - nenhum botão "assinar", porque não existe assinatura automática;
 *   - nenhum botão "cancelar", porque não há o que cancelar — e um botão de cancelar que abre um
 *     formulário morto é pior que a ausência dele. A Fase K exige que cancelar custe os mesmos
 *     toques que assinar; hoje os dois custam a mesma coisa (uma conversa), o que satisfaz a
 *     regra pelo caminho mais honesto disponível.
 *   - nenhuma data de "próxima cobrança", porque não há cobrança.
 *
 * Quando a cobrança existir, é aqui que ela entra.
 */

const NOME: Record<PlanoTier, string> = {
  gratis: 'Grátis',
  essencial: 'Essencial',
  equipe: 'Equipe',
  avancado: 'Avançado',
}

const PRECO: Record<PlanoTier, string> = {
  gratis: 'R$ 0',
  essencial: 'R$ 49/mês',
  equipe: 'R$ 99/mês',
  avancado: 'R$ 179/mês',
}

const ORDEM: readonly PlanoTier[] = ['gratis', 'essencial', 'equipe', 'avancado']

/** O que muda ao subir para cada degrau, na voz de quem usa — não em nome de módulo. */
const O_QUE_MUDA: Record<PlanoTier, string[]> = {
  gratis: [],
  essencial: [
    'Chamar de volta a base inteira de uma vez',
    'Clientes sem limite',
    'Comanda, caixa e orçamento',
    'Sua página fica sem o selo do CICLO',
  ],
  equipe: ['Até 5 profissionais, cada um com sua agenda', 'Comissão e extrato de cada um', 'Fidelidade e pontos'],
  avancado: ['Profissionais sem limite', 'Controle de estoque', 'Ficha de saúde em cofre cifrado'],
}

function textoDeTeto(limite: number | null, usado: number): string {
  if (limite === null) return `${usado} · sem limite`
  return `${usado} de ${limite}`
}

export default async function PaginaMeuPlano() {
  const ctx = await contextoAtual(new Request('https://interno/meu-plano', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [plano, profissionais, clientes] = await Promise.all([
    contextoDePlano(db, ctx.tenantId),
    db
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId)
      .eq('active', true)
      .is('deleted_at', null),
    db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenantId).is('deleted_at', null),
  ])

  const usoProf = profissionais.count ?? 0
  const usoCli = clientes.count ?? 0

  // `aAdicionar: 0` — a pergunta aqui é "como está hoje", não "cabe mais um".
  const limProf = verificarLimite(plano, 'profissionais', usoProf, 0)
  const limCli = verificarLimite(plano, 'clientes', usoCli, 0)

  const atual = plano.plano
  const indiceAtual = ORDEM.indexOf(atual)
  const acima = ORDEM.slice(indiceAtual + 1)

  return (
    <>
      <PageHeader titulo="Meu plano" descricao={`Você está no ${NOME[atual]}.`} />

      <Card className="mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-corpo font-semibold text-txt">{NOME[atual]}</p>
          <p className="tabular text-stat font-bold text-txt">{PRECO[atual]}</p>
        </div>
        {/*
          A frase mais importante da tela, e a que responde a pergunta que a pessoa realmente tem
          quando abre "Meu plano" num produto que ainda não cobra. Dizer isso em texto simples é
          mais honesto — e menos assustador — que um botão de cobrança que não funciona.
        */}
        <p className="mt-2 text-secundario text-txt-2">
          {atual === 'gratis'
            ? 'O Grátis não expira e não vira cobrança sem você pedir. Para mudar de plano, é só falar com a gente — a cobrança automática ainda não está no ar.'
            : 'Para mudar ou encerrar o plano, é só falar com a gente. A cobrança automática ainda não está no ar, então nada é debitado sozinho.'}
        </p>
      </Card>

      <SectionHeader>O que você está usando</SectionHeader>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatTile
          rotulo="Profissionais"
          valor={textoDeTeto(limProf.limite, usoProf)}
          {...(limProf.limite !== null ? { progresso: usoProf / limProf.limite } : {})}
          apoio={
            limProf.limite !== null && usoProf > limProf.limite ? (
              <span className="text-warn">Acima do teto — nada foi removido</span>
            ) : null
          }
        />
        <StatTile
          rotulo="Clientes"
          valor={textoDeTeto(limCli.limite, usoCli)}
          {...(limCli.limite !== null ? { progresso: usoCli / limCli.limite } : {})}
          apoio={
            limCli.limite !== null && usoCli > limCli.limite ? (
              <span className="text-warn">Acima do teto — cadastrar continua liberado</span>
            ) : null
          }
        />
      </div>

      {/*
        A promessa que mais importa e que nunca tem exceção (regra 5.1 do plano, decidida no
        09-PLATAFORMA §13). Fica na tela do plano de propósito: é aqui que a dúvida "se eu parar de
        pagar, perco tudo?" aparece.
      */}
      <Card className="mb-6 flex gap-3">
        <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-acc-2" />
        <p className="text-secundario text-txt-2">
          <span className="font-semibold text-txt">Seu dado nunca fica preso.</span> Cair de plano limita o que dá para
          fazer — nunca esconde nem apaga cliente, histórico ou agendamento. Se você passar de um teto, o que existe
          continua à vista; o que trava é criar mais.
        </p>
      </Card>

      {acima.length > 0 ? (
        <>
          <SectionHeader>Se precisar de mais</SectionHeader>
          <div className="flex flex-col gap-3">
            {acima.map((tier) => (
              <Card key={tier}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-corpo font-semibold text-txt">{NOME[tier]}</p>
                  <p className="tabular text-corpo font-bold text-txt">{PRECO[tier]}</p>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {O_QUE_MUDA[tier].map((item) => (
                    <li key={item} className="flex gap-2 text-secundario text-txt-2">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="flex gap-3">
          <Minus aria-hidden className="mt-0.5 size-4 shrink-0 text-txt-3" />
          <p className="text-secundario text-txt-2">
            Você já está no plano mais completo. Não há mais nada para liberar.
          </p>
        </Card>
      )}

      <p className="py-8 text-center text-label text-txt-3">
        <Link href="/precos" className="toque-48 font-semibold text-acc-2 underline underline-offset-2">
          Ver a tabela de preços completa
        </Link>
      </p>
    </>
  )
}
