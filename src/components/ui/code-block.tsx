import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

export function CodeBlock({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <pre
      className={cn(
        'overflow-auto rounded-2xl border border-white/10 bg-[#07111c] p-4 text-xs leading-6 text-cyan-100',
        className,
      )}
    >
      <code>{children}</code>
    </pre>
  )
}
