import { cn } from '@/lib/utils'

type Props = React.ComponentPropsWithoutRef<'div'>

/** `--surface`, borda `--line`, raio 16 (§4). */
export default function Card({ className, ...props }: Props) {
  return <div className={cn('rounded-[var(--radius)] border border-line bg-surface p-4', className)} {...props} />
}
