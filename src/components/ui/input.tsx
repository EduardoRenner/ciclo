'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useId, useState } from 'react'

import { cn } from '@/lib/utils'

type Props = Omit<React.ComponentPropsWithoutRef<'input'>, 'id'> & {
  rotulo: string
  /** Texto de apoio permanente — some quando há erro, para não competir com ele. */
  ajuda?: string
  /** Mensagem de erro. Presente, marca o campo como inválido para o leitor de tela. */
  erro?: string
  /** Prefixo fixo dentro do campo (ex.: `R$`). Não entra no valor. */
  prefixo?: string
  className?: string
  classNameCampo?: string
}

/**
 * O campo de formulário que faltava. Antes disto, os 89 `input` do projeto
 * repetiam a mesma string de classe à mão, sem estado de erro, sem texto de
 * ajuda e sem `aria-invalid` — e com fonte de 15px, que faz o Safari do iPhone
 * dar zoom no foco (a regra de base em `globals.css` blinda os que ainda não
 * migraram).
 *
 * Rótulo é `<label>` de verdade, nunca placeholder: §7 do design system, e
 * placeholder some quando a pessoa começa a digitar — justo quando ela mais
 * precisa saber o que aquele campo era.
 */
export default function Input({ rotulo, ajuda, erro, prefixo, className, classNameCampo, type, ...props }: Props) {
  const id = useId()
  const idAjuda = `${id}-ajuda`

  /*
   * Campo de senha nasce escondido e ganha um olho para revelar. Digitar 10 caracteres às cegas
   * (o mínimo do cadastro) no teclado do celular é a causa mais comum de "minha senha não
   * funciona" — a pessoa erra, não vê que errou, e culpa o login. O olho é o conserto padrão.
   *
   * O tipo vira `text` ao revelar; o gerenciador de senhas do navegador continua entendendo o
   * campo porque quem o identifica é o `autoComplete` (`current-password`/`new-password`), que
   * segue intacto.
   */
  const ehSenha = type === 'password'
  const [revelada, setRevelada] = useState(false)
  const tipoEfetivo = ehSenha && revelada ? 'text' : type

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label font-semibold text-txt-2">
        {rotulo}
      </label>

      <div className="relative flex items-center">
        {prefixo ? (
          <span aria-hidden className="pointer-events-none absolute left-3.5 text-corpo text-txt-3">
            {prefixo}
          </span>
        ) : null}
        <input
          id={id}
          type={tipoEfetivo}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro || ajuda ? idAjuda : undefined}
          className={cn(
            'h-12 w-full rounded-[var(--radius-sm)] border bg-surface-2 px-3.5 text-corpo text-txt',
            // O anel de foco global (`:focus-visible`) continua valendo para o
            // teclado; a borda de acento é o sinal de "estou aqui" no toque.
            'transition-colors duration-[var(--dur-1)] placeholder:text-txt-3 focus:border-acc',
            erro ? 'border-bad' : 'border-line-2',
            prefixo && 'pl-10',
            // Espaço para o olho não cobrir o fim do que se digita.
            ehSenha && 'pr-12',
            classNameCampo,
          )}
          {...props}
        />
        {ehSenha ? (
          <button
            // `type="button"` (e não o `submit` implícito) é o que impede o Enter no campo de
            // senha de revelar a senha em vez de enviar o formulário. O botão continua alcançável
            // por Tab de propósito: quem digita a senha no teclado é quem mais precisa conferir.
            type="button"
            onClick={() => setRevelada((v) => !v)}
            aria-label={revelada ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={revelada}
            className="absolute right-0 grid h-12 w-12 place-items-center text-txt-3 transition-colors hover:text-txt-2"
          >
            {revelada ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </button>
        ) : null}
      </div>

      {erro ? (
        <p id={idAjuda} role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : ajuda ? (
        <p id={idAjuda} className="text-secundario text-txt-3">
          {ajuda}
        </p>
      ) : null}
    </div>
  )
}
