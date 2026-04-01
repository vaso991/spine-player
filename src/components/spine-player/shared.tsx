import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { cn } from '../../lib/utils';

export function formatPixels(width?: number | null, height?: number | null) {
  if (width === null || width === undefined || height === null || height === undefined) {
    return 'Unavailable';
  }

  return `${Math.round(width)} x ${Math.round(height)} px`;
}

export function formatPoint(x?: number | null, y?: number | null) {
  if (x === null || x === undefined || y === null || y === undefined) {
    return 'Unavailable';
  }

  return `${Math.round(x)}, ${Math.round(y)}`;
}

export function MetricCard({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string
  value: string | number
  note?: string
  emphasis?: boolean
}) {
  return (
    <Card
      size="sm"
      className={cn(
        'gap-0 rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-sm',
        emphasis
          ? 'border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-orange-400/10 to-background/80'
          : 'border-border/60 bg-card/70',
      )}
    >
      <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold tracking-tight text-foreground">{value}</p>
      {note ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p> : null}
    </Card>
  );
}

export function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Sparkles
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="rounded-[28px] border border-border/60 bg-card/75 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)]">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl border border-border/70 bg-background/80 p-2 text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
