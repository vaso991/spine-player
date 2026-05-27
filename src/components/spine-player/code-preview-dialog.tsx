import { BookOpenText, Package } from 'lucide-react';

import { CodeBlock } from '../ui/code-block';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { ColorFilterConfig, StageBackgroundMode } from './types';

const installCommand = 'pnpm add pixi.js @esotericsoftware/spine-pixi-v8';

function getStageClassName(stageBackgroundMode: StageBackgroundMode) {
  if (stageBackgroundMode === 'checkerboard') {
    return 'bg-[linear-gradient(45deg,rgba(255,255,255,0.06)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.06)_75%,rgba(255,255,255,0.06)),linear-gradient(45deg,rgba(255,255,255,0.06)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.06)_75%,rgba(255,255,255,0.06))] bg-[length:28px_28px] bg-[position:0_0,14px_14px] bg-[#101826]';
  }

  if (stageBackgroundMode === 'transparent') {
    return 'bg-transparent';
  }

  return 'bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(6,10,18,0.98))]';
}

function getImplementationExample({
  selectedAnimation,
  loop,
  isPaused,
  timeScale,
  userScale,
  filterConfig,
  stageBackgroundMode,
}: {
  selectedAnimation: string
  loop: boolean
  isPaused: boolean
  timeScale: number
  userScale: number
  filterConfig: ColorFilterConfig
  stageBackgroundMode: StageBackgroundMode
}) {
  const filterConfigJson = JSON.stringify(filterConfig, null, 2);

  return `import { useEffect, useState } from 'react'
import { Application, extend, useApplication, useExtend } from '@pixi/react'
import { Assets, ColorMatrixFilter, Container } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'

const playback = {
  animationName: '${selectedAnimation || 'idle'}',
  loop: ${loop},
  isPaused: ${isPaused},
  timeScale: ${timeScale},
  userScale: ${userScale},
  stageBackgroundMode: '${stageBackgroundMode}',
}

const colorFilters = ${filterConfigJson}

extend({ Spine })

function applyColorFilters(colorMatrix: ColorMatrixFilter, filters: typeof colorFilters) {
  let hasApplied = false
  const apply = (runner: (multiply: boolean) => void) => {
    runner(hasApplied)
    hasApplied = true
  }

  colorMatrix.reset()

  if (filters.brightnessEnabled) apply((multiply) => colorMatrix.brightness(filters.brightness, multiply))
  if (filters.contrastEnabled) apply((multiply) => colorMatrix.contrast(filters.contrast, multiply))
  if (filters.grayscaleEnabled) apply((multiply) => colorMatrix.grayscale(filters.grayscale, multiply))
  if (filters.hueEnabled) apply((multiply) => colorMatrix.hue(filters.hue, multiply))
  if (filters.saturationEnabled) apply((multiply) => colorMatrix.saturate(filters.saturation - 1, multiply))
  if (filters.tintEnabled) apply((multiply) => colorMatrix.tint(filters.tint, multiply))
  if (filters.blackAndWhiteEnabled) apply((multiply) => colorMatrix.blackAndWhite(multiply))
  if (filters.desaturateEnabled) apply((multiply) => colorMatrix.saturate(-1, multiply))
  if (filters.negativeEnabled) apply((multiply) => colorMatrix.negative(multiply))
  if (filters.sepiaEnabled) apply((multiply) => colorMatrix.sepia(multiply))
  if (filters.technicolorEnabled) apply((multiply) => colorMatrix.technicolor(multiply))
  if (filters.polaroidEnabled) apply((multiply) => colorMatrix.polaroid(multiply))
  if (filters.toBGREnabled) apply((multiply) => colorMatrix.toBGR(multiply))
  if (filters.kodachromeEnabled) apply((multiply) => colorMatrix.kodachrome(multiply))
  if (filters.browniEnabled) apply((multiply) => colorMatrix.browni(multiply))
  if (filters.vintageEnabled) apply((multiply) => colorMatrix.vintage(multiply))
  if (filters.colorToneEnabled) {
    apply((multiply) =>
      colorMatrix.colorTone(
        filters.colorToneDesaturation,
        filters.colorToneToned,
        filters.colorToneLightColor,
        filters.colorToneDarkColor,
        multiply,
      ),
    )
  }
  if (filters.nightEnabled) apply((multiply) => colorMatrix.night(filters.nightIntensity, multiply))
  if (filters.predatorEnabled) apply((multiply) => colorMatrix.predator(filters.predatorAmount, multiply))
  if (filters.lsdEnabled) apply((multiply) => colorMatrix.lsd(multiply))

  return hasApplied ? [colorMatrix] : []
}

function SpineScene() {
  useExtend({ Container })
  const { app } = useApplication()
  const [spine, setSpine] = useState<Spine | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      await Assets.load([
        {
          alias: 'heroData',
          src: '/spine/hero.skel',
          parser: 'spineSkeletonLoader',
        },
        {
          alias: 'heroAtlas',
          src: '/spine/hero.atlas',
          parser: 'spineTextureAtlasLoader',
        },
      ])

      if (cancelled) {
        return
      }

      const nextSpine = new Spine({
        skeleton: 'heroData',
        atlas: 'heroAtlas',
        autoUpdate: true,
        ticker: app.ticker,
      })

      nextSpine.state.setAnimation(0, playback.animationName, playback.loop)
      nextSpine.state.timeScale = playback.isPaused ? 0 : playback.timeScale
      nextSpine.position.set(app.screen.width * 0.5, app.screen.height * 0.8)
      nextSpine.scale.set(playback.userScale)

      const colorMatrix = new ColorMatrixFilter()
      nextSpine.filters = applyColorFilters(colorMatrix, colorFilters)

      setSpine(nextSpine)
    }

    void start()

    return () => {
      cancelled = true
      setSpine((current) => {
        current?.destroy()
        return null
      })
    }
  }, [app])

  return <pixiContainer>{spine ? <pixiSpine instance={spine} /> : null}</pixiContainer>
}

  return (
    <div className="h-[480px] w-full rounded-3xl ${getStageClassName(stageBackgroundMode)}">
      <Application resizeTo={window} backgroundAlpha={0}>
        <SpineScene />
      </Application>
    </div>
  )
}`;
}

export function CodePreviewDialog({
  open,
  onClose,
  selectedAnimation,
  loop,
  isPaused,
  timeScale,
  userScale,
  filterConfig,
  stageBackgroundMode,
}: {
  open: boolean
  onClose: () => void
  selectedAnimation: string
  loop: boolean
  isPaused: boolean
  timeScale: number
  userScale: number
  filterConfig: ColorFilterConfig
  stageBackgroundMode: StageBackgroundMode
}) {
  const implementationExample = getImplementationExample({
    selectedAnimation,
    loop,
    isPaused,
    timeScale,
    userScale,
    filterConfig,
    stageBackgroundMode,
  });
  const activeFilters = [
    filterConfig.blackAndWhiteEnabled ? 'Black & White' : null,
    filterConfig.brightnessEnabled ? 'Brightness' : null,
    filterConfig.browniEnabled ? 'Browni' : null,
    filterConfig.colorToneEnabled ? 'Color Tone' : null,
    filterConfig.contrastEnabled ? 'Contrast' : null,
    filterConfig.desaturateEnabled ? 'Desaturate' : null,
    filterConfig.grayscaleEnabled ? 'Grayscale' : null,
    filterConfig.hueEnabled ? 'Hue' : null,
    filterConfig.kodachromeEnabled ? 'Kodachrome' : null,
    filterConfig.lsdEnabled ? 'LSD' : null,
    filterConfig.negativeEnabled ? 'Negative' : null,
    filterConfig.nightEnabled ? 'Night' : null,
    filterConfig.polaroidEnabled ? 'Polaroid' : null,
    filterConfig.predatorEnabled ? 'Predator' : null,
    filterConfig.saturationEnabled ? 'Saturation' : null,
    filterConfig.sepiaEnabled ? 'Sepia' : null,
    filterConfig.technicolorEnabled ? 'Technicolor' : null,
    filterConfig.tintEnabled ? 'Tint' : null,
    filterConfig.toBGREnabled ? 'To BGR' : null,
    filterConfig.vintageEnabled ? 'Vintage' : null,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="max-h-[min(92svh,960px)] max-w-4xl overflow-hidden rounded-[32px] border border-border/60 bg-[linear-gradient(180deg,rgba(14,23,38,0.98),rgba(7,11,18,0.98))] p-0 text-foreground shadow-[0_30px_120px_-40px_rgba(0,0,0,0.9)] sm:max-w-4xl"
      >
        <DialogHeader className="gap-0 border-b border-border/60 px-6 py-5 text-left sm:px-8">
          <div className="min-w-0 pr-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.18em] text-cyan-100 uppercase">
              <BookOpenText className="size-3.5" />
              Integration Preview
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
              How to implement Pixi + Spine
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Install the runtime, load the atlas and skeleton through Pixi assets, then create a
              `Spine` instance and attach it to the stage.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-border/60 bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Package className="size-4 text-cyan-200" />
                Install dependencies
              </div>
              <CodeBlock className="border-border/60 bg-black/30 p-3">{installCommand}</CodeBlock>
            </div>

            <div className="rounded-[24px] border border-border/60 bg-background/40 p-4 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">Asset structure</p>
              <p className="mt-2">Keep the exported `.atlas`, `.skel`, and referenced `.png`/`.webp` pages together.</p>
              <p className="mt-2">The atlas tells Pixi which texture pages the Spine runtime should bind.</p>
              <p className="mt-2">After loading, use `state.setAnimation()` to start an animation track.</p>
            </div>

            <div className="rounded-[24px] border border-border/60 bg-background/40 p-4 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">Playback properties</p>
              <p className="mt-2">Animation: {selectedAnimation || 'idle'}</p>
              <p>Loop: {loop ? 'true' : 'false'}</p>
              <p>Paused: {isPaused ? 'true' : 'false'}</p>
              <p>Time scale: {timeScale}</p>
              <p>User scale: {userScale}</p>
              <p>Active filters: {activeFilters.length > 0 ? activeFilters.join(', ') : 'None'}</p>
              <p>Stage mode: {stageBackgroundMode}</p>
            </div>
          </div>

          <div className="min-w-0 rounded-[24px] border border-border/60 bg-black/30 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">React + TypeScript example</p>
              <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">tsx</p>
            </div>
            <CodeBlock className="max-h-[60vh]">{implementationExample}</CodeBlock>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
