import type { RefObject } from 'react'
import {
  Activity,
  ArrowLeft,
  Boxes,
  Clapperboard,
  Image as ImageIcon,
  Layers3,
  Pause,
  Play,
  PackageOpen,
  SkipBack,
  SkipForward,
  TimerReset,
} from 'lucide-react'

import { Button } from '../ui/button'
import { ButtonGroup } from '../ui/button-group'
import { Input } from '../ui/input'
import { Slider } from '../ui/slider'
import { cn } from '../../lib/utils'
import { MetricCard, SectionCard, formatPixels, formatPoint } from './shared'
import type {
  AnimationSummary,
  AtlasInfo,
  PlaybackInfo,
  RenderedSizeRange,
  SceneInfo,
  SpineSize,
  StageBackgroundMode,
} from './types'

export function WorkspacePanel({
  viewportRef,
  canvasHostRef,
  hasScene,
  loop,
  selectedAnimation,
  showDebugGuides,
  isPaused,
  timeScale,
  userScale,
  defaultScale,
  stageBackgroundMode,
  atlasInfo,
  animationSummaries,
  animations,
  fps,
  playbackInfo,
  renderedSizeRange,
  spineSize,
  selectedAnimationSummary,
  minSkeletonScaled,
  maxSkeletonScaled,
  safeContainerSize,
  sceneInfo,
  onBack,
  onLoopChange,
  onDebugGuidesChange,
  onPauseToggle,
  onRestart,
  onStepFrame,
  onSeekFrame,
  onTimeScaleChange,
  onUserScaleChange,
  onStageBackgroundModeChange,
  onAnimationSelect,
}: {
  viewportRef: RefObject<HTMLDivElement | null>
  canvasHostRef: RefObject<HTMLDivElement | null>
  hasScene: boolean
  loop: boolean
  selectedAnimation: string
  showDebugGuides: boolean
  isPaused: boolean
  timeScale: number
  userScale: number
  defaultScale: number
  stageBackgroundMode: StageBackgroundMode
  atlasInfo: AtlasInfo | null
  animationSummaries: AnimationSummary[]
  animations: string[]
  fps: number | null
  playbackInfo: PlaybackInfo | null
  renderedSizeRange: RenderedSizeRange | null
  spineSize: SpineSize | null
  selectedAnimationSummary: AnimationSummary | null
  minSkeletonScaled: { width: number; height: number } | null
  maxSkeletonScaled: { width: number; height: number } | null
  safeContainerSize: { width: number; height: number } | null
  sceneInfo: SceneInfo | null
  onBack: () => void
  onLoopChange: (nextLoop: boolean) => void
  onDebugGuidesChange: (nextValue: boolean) => void
  onPauseToggle: () => void
  onRestart: () => void
  onStepFrame: (direction: -1 | 1) => void
  onSeekFrame: (frame: number) => void
  onTimeScaleChange: (nextValue: number) => void
  onUserScaleChange: (nextValue: number) => void
  onStageBackgroundModeChange: (mode: StageBackgroundMode) => void
  onAnimationSelect: (animationName: string) => void
}) {
  const dopesheetFps = sceneInfo?.dopesheetFps ?? null
  const currentFrame =
    playbackInfo && dopesheetFps && dopesheetFps > 0
      ? Math.max(0, Math.floor(playbackInfo.currentTime * dopesheetFps))
      : null
  const totalFrames =
    playbackInfo && dopesheetFps && dopesheetFps > 0
      ? Math.max(1, Math.round(playbackInfo.duration * dopesheetFps))
      : null
  const stageBackgroundClass =
    stageBackgroundMode === 'checkerboard'
      ? 'bg-[linear-gradient(45deg,rgba(255,255,255,0.06)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.06)_75%,rgba(255,255,255,0.06)),linear-gradient(45deg,rgba(255,255,255,0.06)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.06)_75%,rgba(255,255,255,0.06))] bg-[length:28px_28px] bg-[position:0_0,14px_14px] bg-[#101826]'
      : stageBackgroundMode === 'transparent'
        ? 'bg-transparent'
        : 'bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(6,10,18,0.98))]'

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
      <div className="space-y-6 xl:sticky xl:top-[20px] xl:self-start">
        <SectionCard
          icon={PackageOpen}
          title="Pixi Stage"
          description="Dedicated render surface for the loaded Spine scene."
        >
          <div
            ref={viewportRef}
            className={cn(
              'relative min-h-[560px] overflow-hidden rounded-[28px] border border-border/60',
              stageBackgroundClass,
            )}
          >
            <div ref={canvasHostRef} className="h-full w-full" />
            {!hasScene ? (
              <div className="absolute inset-0 grid place-items-center p-6">
                <div className="max-w-sm rounded-[24px] border border-border/60 bg-background/45 px-6 py-8 text-center backdrop-blur">
                  <PackageOpen className="mx-auto mb-4 size-8 text-muted-foreground" />
                  <p className="text-base font-medium text-foreground">Load local Spine assets to render the player.</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    The render canvas appears here after the asset intake step.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <aside className="space-y-6">
        <Button variant="outline" className="h-11 w-full rounded-2xl" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back to File Selection
        </Button>

        <SectionCard
          icon={Clapperboard}
          title="Playback Controls"
          description="Drive animation selection, looping, speed, and display scale."
        >
          <div className="space-y-5">
            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Transport</p>
                <p className="text-xs text-muted-foreground">Pause playback, restart the clip, or step one frame at a time.</p>
              </div>
              <ButtonGroup className="grid w-full grid-cols-2">
                <Button variant="outline" className="h-11 w-full" onClick={onPauseToggle}>
                  {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button variant="outline" className="h-11 w-full" onClick={onRestart}>
                  <TimerReset className="size-4" />
                  Restart
                </Button>
              </ButtonGroup>
              <ButtonGroup className="grid w-full grid-cols-2">
                <Button variant="outline" className="h-11 w-full" onClick={() => onStepFrame(-1)}>
                  <SkipBack className="size-4" />
                  Frame Back
                </Button>
                <Button variant="outline" className="h-11 w-full" onClick={() => onStepFrame(1)}>
                  <SkipForward className="size-4" />
                  Frame Forward
                </Button>
              </ButtonGroup>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Frame selector</p>
                  <p className="text-xs text-muted-foreground">Jump directly to a frame on the active track.</p>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {currentFrame !== null && totalFrames !== null ? `${currentFrame} / ${totalFrames}` : 'N/A'}
                </div>
              </div>
              <Slider
                min={0}
                max={totalFrames ?? 0}
                step={1}
                disabled={currentFrame === null || totalFrames === null}
                value={[currentFrame ?? 0]}
                onValueChange={([nextValue]) => onSeekFrame(nextValue ?? 0)}
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Stage background</p>
                <p className="text-xs text-muted-foreground">Preview animation on checkerboard, dark, or transparent canvas.</p>
              </div>
              <ButtonGroup className="grid w-full grid-cols-3">
                {(['checkerboard', 'dark', 'transparent'] as StageBackgroundMode[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={stageBackgroundMode === mode ? 'default' : 'outline'}
                    className="h-10 w-full capitalize"
                    onClick={() => onStageBackgroundModeChange(mode)}
                  >
                    {mode}
                  </Button>
                ))}
              </ButtonGroup>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Loop animation</p>
                <p className="text-xs text-muted-foreground">Restart automatically when the track completes.</p>
              </div>
              <input
                className="size-4 accent-primary"
                type="checkbox"
                checked={loop}
                disabled={!selectedAnimation}
                onChange={(event) => onLoopChange(event.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Show debug guides</p>
                <p className="text-xs text-muted-foreground">Toggle debug bounds and anchor overlays.</p>
              </div>
              <input
                className="size-4 accent-primary"
                type="checkbox"
                checked={showDebugGuides}
                onChange={(event) => onDebugGuidesChange(event.target.checked)}
              />
            </label>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Animation speed</p>
                  <p className="text-xs text-muted-foreground">1 is normal, 0.5 is half, 2 is double.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onTimeScaleChange(1)}>
                  <TimerReset className="size-3.5" />
                  Reset
                </Button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                <Slider
                  min={0}
                  max={3}
                  step={0.05}
                  value={[timeScale]}
                  onValueChange={([nextValue]) => onTimeScaleChange(nextValue ?? 0)}
                />
                <Input
                  className="h-10"
                  type="number"
                  min="0"
                  max="3"
                  step="0.05"
                  value={timeScale}
                  onChange={(event) => onTimeScaleChange(Number(event.target.value))}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Animation scale</p>
                  <p className="text-xs text-muted-foreground">
                    Defaults to atlas scale
                    {atlasInfo?.scale !== null && atlasInfo?.scale !== undefined ? ` (${atlasInfo.scale})` : ''}.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onUserScaleChange(defaultScale)}>
                  <TimerReset className="size-3.5" />
                  Reset
                </Button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                <Slider
                  min={0.05}
                  max={3}
                  step={0.01}
                  value={[userScale]}
                  onValueChange={([nextValue]) => onUserScaleChange(nextValue ?? 1)}
                />
                <Input
                  className="h-10"
                  type="number"
                  min="0.05"
                  max="3"
                  step="0.01"
                  value={userScale}
                  onChange={(event) => onUserScaleChange(Number(event.target.value))}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={Boxes}
          title="Animation Summary"
          description="Quick-select animation clips and inspect their max layout footprint."
        >
          {animationSummaries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 px-4 py-6 text-sm text-muted-foreground">
              No animation summary available.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {animationSummaries.map((animation) => (
                <button
                  type="button"
                  key={animation.name}
                  className={cn(
                    'cursor-pointer rounded-2xl border p-4 text-left transition',
                    animation.name === selectedAnimation
                      ? 'border-primary/40 bg-primary/10 shadow-lg shadow-primary/10'
                      : 'border-border/60 bg-card/60 hover:border-border hover:bg-card',
                  )}
                  onClick={() => onAnimationSelect(animation.name)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-foreground">{animation.name}</span>
                    <span className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {animation.duration.toFixed(2)}s
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {formatPixels(animation.maxWidth, animation.maxHeight)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Minimum footprint {formatPixels(animation.minWidth, animation.minHeight)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={Activity}
          title="Runtime Snapshot"
          description="Playback state and render metrics for the active animation."
        >
          <div className="flex flex-col gap-3">
            <MetricCard label="Animations" value={animations.length} note="Detected in the loaded skeleton" />
            <MetricCard label="Active Animation" value={selectedAnimation || 'idle'} note="Current track on state 0" emphasis />
            <MetricCard label="FPS" value={fps === null ? 'Unavailable' : fps} note="Renderer ticker snapshot" />
            <MetricCard
              label="Current Time"
              value={playbackInfo ? `${playbackInfo.currentTime.toFixed(2)}s` : 'Unavailable'}
              note={playbackInfo ? `${Math.round(playbackInfo.progress * 100)}% progress` : 'Progress unavailable'}
            />
            <MetricCard
              label="Duration"
              value={playbackInfo ? `${playbackInfo.duration.toFixed(2)}s` : 'Unavailable'}
              note={playbackInfo ? `Loops ${playbackInfo.loopCount}` : 'Loop count unavailable'}
            />
            <MetricCard
              label="Rendered Size"
              value={spineSize ? formatPixels(spineSize.realtimeWidth, spineSize.realtimeHeight) : 'Unavailable'}
              note={
                renderedSizeRange
                  ? `Low ${formatPixels(renderedSizeRange.minWidth, renderedSizeRange.minHeight)} · Peak ${formatPixels(renderedSizeRange.maxWidth, renderedSizeRange.maxHeight)}`
                  : 'Range unavailable'
              }
            />
            <MetricCard
              label="Current Scale"
              value={spineSize ? spineSize.currentScale.toFixed(3) : 'Unavailable'}
              note={spineSize ? `Anchor ${formatPoint(spineSize.layoutOffsetX, spineSize.layoutOffsetY)}` : 'Anchor unavailable'}
            />
          </div>
        </SectionCard>

        <div className="flex flex-col gap-6">
          <SectionCard
            icon={Layers3}
            title="Geometry"
            description="Bounds, scaling envelope, and web-safe size estimates."
          >
            <div className="flex flex-col gap-3">
              <MetricCard label="Skeleton Bounds" value={spineSize ? formatPixels(spineSize.realWidth, spineSize.realHeight) : 'Unavailable'} />
              <MetricCard
                label="Min Skeleton"
                value={selectedAnimationSummary ? formatPixels(selectedAnimationSummary.minWidth, selectedAnimationSummary.minHeight) : 'Unavailable'}
                note={minSkeletonScaled ? `Scaled ${formatPixels(minSkeletonScaled.width, minSkeletonScaled.height)}` : 'Scaled unavailable'}
              />
              <MetricCard
                label="Max Skeleton"
                value={selectedAnimationSummary ? formatPixels(selectedAnimationSummary.maxWidth, selectedAnimationSummary.maxHeight) : 'Unavailable'}
                note={maxSkeletonScaled ? `Scaled ${formatPixels(maxSkeletonScaled.width, maxSkeletonScaled.height)}` : 'Scaled unavailable'}
              />
              <MetricCard
                label="Layout Bounds"
                value={spineSize ? formatPixels(spineSize.layoutWidth, spineSize.layoutHeight) : 'Unavailable'}
                note={spineSize ? `Origin ${formatPoint(spineSize.layoutOriginX, spineSize.layoutOriginY)}` : 'Origin unavailable'}
              />
              <MetricCard
                label="Bounds Aspect"
                value={spineSize && spineSize.realHeight > 0 ? (spineSize.realWidth / spineSize.realHeight).toFixed(3) : 'Unavailable'}
              />
              <MetricCard
                label="Bounds Origin"
                value={spineSize ? formatPoint(spineSize.originX, spineSize.originY) : 'Unavailable'}
                note={safeContainerSize ? `Safe web size ${formatPixels(safeContainerSize.width, safeContainerSize.height)}` : 'Safe size unavailable'}
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={ImageIcon}
            title="Atlas + Rig"
            description="Packing efficiency and skeleton structure details."
          >
            <div className="flex flex-col gap-3">
              <MetricCard label="Atlas Pages" value={atlasInfo?.pageCount ?? '0'} note="PNG pages mapped from atlas" />
              <MetricCard label="Atlas Page" value={atlasInfo ? formatPixels(atlasInfo.pageWidth, atlasInfo.pageHeight) : 'Unavailable'} />
              <MetricCard
                label="Atlas Scale"
                value={atlasInfo?.scale !== null && atlasInfo?.scale !== undefined ? atlasInfo.scale : 'Unavailable'}
              />
              <MetricCard
                label="Atlas Utilization"
                value={
                  sceneInfo?.atlasUtilization !== null && sceneInfo?.atlasUtilization !== undefined
                    ? `${Math.round(sceneInfo.atlasUtilization * 100)}%`
                    : 'Unavailable'
                }
                note={atlasInfo ? `${atlasInfo.regionCount} regions across ${atlasInfo.pageCount} page(s)` : 'Atlas unavailable'}
              />
              <MetricCard
                label="Texture Memory"
                value={
                  sceneInfo?.textureMemoryBytes !== null && sceneInfo?.textureMemoryBytes !== undefined
                    ? `${(sceneInfo.textureMemoryBytes / (1024 * 1024)).toFixed(2)} MB`
                    : 'Unavailable'
                }
              />
              <MetricCard
                label="Bones / Slots"
                value={sceneInfo ? `${sceneInfo.boneCount} / ${sceneInfo.slotCount}` : 'Unavailable'}
                note={sceneInfo ? `${sceneInfo.skinCount} skins, ${sceneInfo.constraintCount} constraints` : 'Rig unavailable'}
              />
              <MetricCard
                label="Attachments / Events"
                value={sceneInfo ? `${sceneInfo.attachmentCount} / ${sceneInfo.eventCount}` : 'Unavailable'}
                note={sceneInfo?.dopesheetFps ? `Dopesheet ${sceneInfo.dopesheetFps} fps` : 'Dopesheet unavailable'}
              />
            </div>
          </SectionCard>
        </div>
      </aside>
    </section>
  )
}
