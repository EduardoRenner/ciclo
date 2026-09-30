import { ArrowRight } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'

import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import SectionHeader from '@/components/ui/section-header'
import { podeUsarModulo } from '@/core/billing/planos'
import { oQueMudaPorAqui } from '@/core/onboarding/perfil'
import { canalDeContato } from '@/lib/contato'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'

export const metadata = { title: 'Vindo de outro sistema' }

/**
 * O texto que sai pronto no WhatsApp de quem toca em "Me manda que eu faço" — mora aqui, não em
 * `lib/contato.ts`, porque só esta tela usa (mesmo raciocínio de `precos/page.tsx`: copy de uma
 * tela só vira constante compartilhada quando um segundo lugar precisa dela).
 */
const CANAL_AJUDA_IMPORTACAO = canalDeContato(
  'Oi! Estou vindo de outro sistema para o CICLO e quero ajuda para importar minha base de clientes.',
)

const classeOpcao =
  'flex min-h-[56px] items-center gap-3 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 py-3 text-left text-corpo font-semibold text-txt transition-colors hover:bg-surface-3 active:scale-[.99]'

/**
 * `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` §5.3/§5.4/§5.5 (P2) — o conteúdo completo da tela que o
 * P1 (`5815bc5c`) só rascunhou. Quem responde "outro sistema" na Pergunta 1 cai aqui.
 *
 * As três saídas do §5.4, nessa ordem — a ordem importa, é a mesma do plano (mais rápido de
 * resolver primeiro, o "não precisa decidir hoje" no meio, o "eu nem mexo" por último):
 *
 *   1. Traga agora — importa (planilha) ou digita de memória, igual ao que `ja-atendo`/`importar`
 *      já fazem sozinhos.
 *   2. Use junto por enquanto — camada de recuperação ao lado do sistema atual; não nomeia o
 *      sistema porque a Pergunta 1 (`onboarding/perfil`) não propaga qual foi escolhido até aqui, e
 *      nomear errado é pior que ficar genérico (registrado em `docs/DECISOES.md`).
 *   3. Me manda que eu faço — `[DECISÃO DO EDUARDO]` aprovada no §5.4 item 3. O botão só existe
 *      quando há canal configurado (`canalDeContato`, `lib/contato.ts`) — sem isso seria um link
 *      morto, o mesmo defeito que aquele arquivo existe para impedir.
 *
 * O benefício "1 mês de Essencial" do §9/P2 fica de fora de propósito: é decisão de preço, não
 * tomada (§5.4, último parágrafo).
 *
 * Cartões de opção nunca dividem linha de texto corrida (um bloco por linha, `flex-col gap-2`) —
 * a mesma armadilha do `toque-48` documentada no CLAUDE.md, evitada aqui do mesmo jeito que em
 * `onboarding/perfil/formulario.tsx`: altura mínima de 56px substitui a classe.
 */
export default async function PaginaVindoDeOutroSistema() {
  const ctx = await contextoDoPainel(new Request('https://interno/clientes/vindo-de-outro-sistema', { headers: await headers() }))
  const plano = await contextoDePlano(await criarClienteDoUsuario(), ctx.tenantId)
  const liberado = (m: Parameters<typeof podeUsarModulo>[1]) => podeUsarModulo(plano, m).estado === 'liberado'
  // P6 (docs/83 §5.5): só vê esta tela quem respondeu "outro sistema", e cada frase depende do plano.
  const frases = oQueMudaPorAqui({ paginaPublica: liberado('public_page'), comanda: liberado('register'), fidelidade: liberado('loyalty') })

  return (
    <>
      <PageHeader
        titulo="Vindo de outro sistema"
        descricao="Sem chamado, sem esperar dias úteis. Você decide como trazer sua base, e o Motor de Ciclo já mostra quem passou do tempo de voltar assim que ela chegar."
      />

      <Card className="text-left">
        <p className="text-secundario font-semibold text-txt-2">Não sabe onde pedir a exportação?</p>
        <p className="mt-2 text-corpo text-txt">
          Copie e mande esta mensagem para o suporte do seu sistema atual:
        </p>
        <p className="mt-3 rounded-[var(--radius-sm)] bg-surface-2 p-3 text-secundario text-txt-2">
          &ldquo;Olá! Quero receber a lista dos meus clientes numa planilha (Excel ou CSV), com nome, telefone e a
          data do último atendimento de cada um. Pode me enviar por e-mail?&rdquo;
        </p>
      </Card>

      <SectionHeader className="mt-6">Como você quer trazer sua base</SectionHeader>

      <div className="flex flex-col gap-3">
        <Card className="text-left">
          <p className="text-corpo font-semibold text-txt">Traga agora</p>
          <p className="mt-1 text-secundario text-txt-2">
            Sem chamado, sem esperar. Assim que terminar, o Motor de Ciclo já mostra quem passou do tempo de voltar
            e quanto isso vale.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/admin/clientes/importar" className={`justify-between ${classeOpcao}`}>
              Já tenho a planilha: importar agora
              <ArrowRight aria-hidden className="size-4 shrink-0 text-txt-3" />
            </Link>
            <Link href="/admin/clientes/ja-atendo" className={`justify-between ${classeOpcao}`}>
              Ainda não tenho planilha: trazer de memória
              <ArrowRight aria-hidden className="size-4 shrink-0 text-txt-3" />
            </Link>
          </div>
        </Card>

        <Card className="text-left">
          <p className="text-corpo font-semibold text-txt">Use o CICLO junto com seu sistema atual, por enquanto</p>
          <p className="mt-1 text-secundario text-txt-2">
            Não precisa trocar hoje. Continue marcando horário do jeito que já faz: o CICLO fica só de olho em
            quem está sumindo, para você chamar de volta pelo seu WhatsApp. Quando alguém voltar, marque
            &ldquo;já é sua cliente&rdquo; para o Motor continuar certo.
          </p>
          <Link href="/admin/clientes/ja-atendo" className={`mt-3 justify-between ${classeOpcao}`}>
            Ver quem já atendo
            <ArrowRight aria-hidden className="size-4 shrink-0 text-txt-3" />
          </Link>
        </Card>

        {CANAL_AJUDA_IMPORTACAO ? (
          <Card className="text-left">
            <p className="text-corpo font-semibold text-txt">Me manda que eu faço</p>
            <p className="mt-1 text-secundario text-txt-2">
              Prefere não mexer em planilha nenhuma? Manda sua lista de clientes pelo WhatsApp que a gente importa
              para você, sem custo.
            </p>
            <a
              href={CANAL_AJUDA_IMPORTACAO.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 justify-center ${classeOpcao}`}
            >
              {CANAL_AJUDA_IMPORTACAO.rotulo}
            </a>
          </Card>
        ) : null}
      </div>

      <SectionHeader className="mt-6">O que muda por aqui</SectionHeader>
      <Card className="text-left">
        <ul className="flex flex-col gap-2 text-secundario text-txt-2">
          {frases.map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ul>
      </Card>
    </>
  )
}
