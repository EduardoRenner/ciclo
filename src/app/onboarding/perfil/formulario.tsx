'use client'

import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
  BASES_EM,
  DORES,
  ROTA_AO_PULAR_PERFIL,
  rotaAposResponderPerfil,
  SISTEMAS_ANTERIORES,
  TAMANHOS,
  type BaseEm,
  type Dor,
  type SistemaAnterior,
  type Tamanho,
} from '@/core/onboarding/perfil'

const ROTULO_BASE_EM: Record<BaseEm, string> = {
  cabeca_caderno: 'Na minha cabeça ou num caderno',
  whatsapp_contatos: 'No WhatsApp ou nos contatos do celular',
  planilha: 'Numa planilha',
  outro_sistema: 'Em outro sistema',
  comecando_agora: 'Estou começando agora, ainda não tenho',
}

const ROTULO_SISTEMA: Record<SistemaAnterior, string> = {
  appbarber: 'AppBarber',
  trinks: 'Trinks',
  belasis: 'Belasis',
  barbup: 'BarbUp',
  booksy: 'Booksy',
  outro: 'Outro',
}

/*
  P5: sem gênero ("sozinho(a)" erra com metade da base — guarda `copy-nao-supoe-genero`), e cada
  incentivo diz SÓ o efeito que existe: "Só eu" esconde equipe e comissão; "Eu e mais gente" não muda
  nada, então não promete nada. A dor sobe para o topo do painel QUANDO há cartão dela.
*/
const ROTULO_TAMANHO: Record<Tamanho, string> = {
  so_eu: 'Só eu',
  com_equipe: 'Eu e mais gente',
}

const ROTULO_DOR: Record<Dor, string> = {
  cliente_some: 'Cliente que some e eu nem percebo',
  quanto_sobra: 'Não sei quanto sobra no fim do mês',
}

type Respostas = { baseEm?: BaseEm; sistema?: SistemaAnterior; tamanho?: Tamanho; dor?: Dor }
type Corpo = { acao: 'pular' } | ({ acao: 'responder' } & Respostas)

/**
 * `docs/83` §5.1–5.3 (P1). Só a Pergunta 1 nesta fase: "Onde estão seus clientes hoje?", com
 * "outro sistema" abrindo uma sub-seleção antes de rotear (§5.2/§9).
 *
 * Dois botões de pular fazem a MESMA coisa — o do topo ("Pular tudo") e o da própria pergunta
 * ("Pular esta pergunta") — porque com uma pergunta só eles são o mesmo caminho. O segundo existe
 * porque o §5.1 pede os dois por desenho (a tela cresce para mais perguntas em P5), não porque
 * hoje façam algo diferente.
 *
 * Cartões de opção são blocos de largura cheia, um por linha (`flex-col gap-2`) — nunca dividem
 * linha de texto corrida, o que evita a armadilha do `toque-48` documentada no CLAUDE.md (dois
 * alvos na mesma linha se cobrem). A altura mínima de 56px já passa do piso de 48px sem precisar
 * da classe.
 */
export default function FormularioPerfil() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<'pergunta' | 'sistema' | 'tamanho' | 'dor'>('pergunta')
  const [respostas, setRespostas] = useState<Respostas>({})
  const [pendente, setPendente] = useState(false)

  async function enviar(corpo: Corpo, destino: string) {
    setPendente(true)
    try {
      await fetch('/api/v1/onboarding/perfil', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(corpo),
      })
    } catch {
      // `registrarEvento` já nunca lança no servidor; uma falha de REDE até lá segue a mesma
      // regra — perder o evento é ruim, travar a pessoa numa tela de qualificação é pior.
    } finally {
      router.push(destino)
    }
  }

  function escolher(baseEm: BaseEm) {
    setRespostas((r) => ({ ...r, baseEm, sistema: undefined }))
    setEtapa(baseEm === 'outro_sistema' ? 'sistema' : 'tamanho')
  }

  function escolherSistema(sistema: SistemaAnterior) {
    setRespostas((r) => ({ ...r, sistema }))
    setEtapa('tamanho')
  }

  /** Fim da tela: manda o que foi respondido e vai para onde a Pergunta 1 manda (painel, se pulou). */
  function concluir(ultimas: Respostas) {
    const r = { ...respostas, ...ultimas }
    const alguma = r.baseEm !== undefined || r.tamanho !== undefined || r.dor !== undefined
    const destino = r.baseEm ? rotaAposResponderPerfil(r.baseEm) : ROTA_AO_PULAR_PERFIL
    void enviar(alguma ? { acao: 'responder', ...r } : { acao: 'pular' }, destino)
  }

  function pular() {
    void enviar({ acao: 'pular' }, ROTA_AO_PULAR_PERFIL)
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <button
        type="button"
        onClick={pular}
        disabled={pendente}
        className="self-center text-label font-semibold text-txt-3 underline underline-offset-2 disabled:opacity-50"
      >
        Pular tudo e ir pro painel
      </button>

      <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 shadow-elevado">
        {etapa === 'pergunta' ? (
          <>
            <div>
              <h2 className="text-corpo font-semibold text-txt">Onde estão seus clientes hoje?</h2>
              <p className="mt-1 text-label text-txt-3">
                A gente já te leva pro jeito mais rápido de trazer todo mundo, e te mostra na hora quem já passou do
                tempo de voltar.
              </p>
            </div>

            <div role="radiogroup" aria-label="Onde estão seus clientes hoje?" className="flex flex-col gap-2">
              {BASES_EM.map((baseEm) => (
                <button
                  key={baseEm}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  disabled={pendente}
                  onClick={() => escolher(baseEm)}
                  className="flex min-h-[56px] items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 py-3 text-left text-corpo font-semibold text-txt transition-colors hover:bg-surface-3 active:scale-[.99] disabled:opacity-50"
                >
                  {ROTULO_BASE_EM[baseEm]}
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-txt-3" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setEtapa('tamanho')}
              disabled={pendente}
              className="self-center text-label text-txt-3 underline underline-offset-2 disabled:opacity-50"
            >
              Pular esta pergunta
            </button>
          </>
        ) : etapa === 'tamanho' ? (
          <>
            <div>
              <h2 className="text-corpo font-semibold text-txt">Quem atende no seu negócio?</h2>
              <p className="mt-1 text-label text-txt-3">
                Se for só você, a gente esconde as telas de equipe e comissão, que você não usa. Dá para ligar de volta em
                Config.
              </p>
            </div>
            <div role="radiogroup" aria-label="Quem atende no seu negócio?" className="flex flex-col gap-2">
              {TAMANHOS.map((tamanho) => (
                <button
                  key={tamanho}
                  type="button"
                  role="radio"
                  aria-checked={respostas.tamanho === tamanho}
                  disabled={pendente}
                  onClick={() => {
                    setRespostas((r) => ({ ...r, tamanho }))
                    setEtapa('dor')
                  }}
                  className="flex min-h-[56px] items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 py-3 text-left text-corpo font-semibold text-txt transition-colors hover:bg-surface-3 active:scale-[.99] disabled:opacity-50"
                >
                  {ROTULO_TAMANHO[tamanho]}
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-txt-3" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEtapa('dor')}
              disabled={pendente}
              className="self-center text-label text-txt-3 underline underline-offset-2 disabled:opacity-50"
            >
              Pular esta pergunta
            </button>
          </>
        ) : etapa === 'dor' ? (
          <>
            <div>
              <h2 className="text-corpo font-semibold text-txt">O que mais te incomoda hoje?</h2>
              <p className="mt-1 text-label text-txt-3">Quando tiver algo disso para resolver, aparece em primeiro no seu painel.</p>
            </div>
            <div role="radiogroup" aria-label="O que mais te incomoda hoje?" className="flex flex-col gap-2">
              {DORES.map((dor) => (
                <button
                  key={dor}
                  type="button"
                  role="radio"
                  aria-checked={respostas.dor === dor}
                  disabled={pendente}
                  onClick={() => concluir({ dor })}
                  className="flex min-h-[56px] items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 py-3 text-left text-corpo font-semibold text-txt transition-colors hover:bg-surface-3 active:scale-[.99] disabled:opacity-50"
                >
                  {ROTULO_DOR[dor]}
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-txt-3" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => concluir({})}
              disabled={pendente}
              className="self-center text-label text-txt-3 underline underline-offset-2 disabled:opacity-50"
            >
              Pular esta pergunta
            </button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-corpo font-semibold text-txt">Qual sistema você usa?</h2>
            </div>

            <div role="radiogroup" aria-label="Qual sistema você usa?" className="flex flex-col gap-2">
              {SISTEMAS_ANTERIORES.map((sistema) => (
                <button
                  key={sistema}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  disabled={pendente}
                  onClick={() => escolherSistema(sistema)}
                  className="flex min-h-[56px] items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 py-3 text-left text-corpo font-semibold text-txt transition-colors hover:bg-surface-3 active:scale-[.99] disabled:opacity-50"
                >
                  {ROTULO_SISTEMA[sistema]}
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-txt-3" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setEtapa('pergunta')}
              disabled={pendente}
              className="self-center text-label text-txt-3 underline underline-offset-2 disabled:opacity-50"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
