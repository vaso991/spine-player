import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Application, Assets, Graphics, ImageSource } from 'pixi.js'
import { Physics, Spine, SkinsAndAnimationBoundsProvider } from '@esotericsoftware/spine-pixi-v8'
import {
  Activity,
  ArrowLeft,
  Boxes,
  Clapperboard,
  FileUp,
  Image as ImageIcon,
  Layers3,
  PackageOpen,
  Play,
  Sparkles,
  TimerReset,
  Upload,
} from 'lucide-react'

import { Button } from './components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Slider } from './components/ui/slider'
import { cn } from './lib/utils'

type SelectedFiles = {
  atlas: File | null
  skeleton: File | null
  images: File[]
}

type LoadedScene = {
  app: Application
  animationSummaries: AnimationSummary[]
  atlasInfo: AtlasInfo | null
  debugAnchor: Graphics
  debugBounds: Graphics
  getAnimationLayoutBounds: (animationName: string) => { x: number; y: number; width: number; height: number } | null
  requestedScale: {
    value: number
  }
  syncSceneMetrics: () => void
  spine: Spine
  animations: string[]
  assetKeys: string[]
}

type SpineSize = {
  canvasWidth: number
  canvasHeight: number
  currentScale: number
  displayOffsetX: number
  displayOffsetY: number
  layoutOffsetX: number
  layoutOffsetY: number
  overflowingCanvas: boolean
  layoutOriginX: number
  layoutOriginY: number
  layoutWidth: number
  layoutHeight: number
  originX: number
  originY: number
  realWidth: number
  realHeight: number
  realtimeWidth: number
  realtimeHeight: number
}

type AtlasInfo = {
  pageHeight: number
  pageCount: number
  pageWidth: number
  regionCount: number
  scale: number | null
  textureMemoryBytes: number
  totalPageArea: number
  usedArea: number
}

type PlaybackInfo = {
  currentTime: number
  duration: number
  loopCount: number
  progress: number
}

type RenderedSizeRange = {
  minHeight: number
  minWidth: number
  maxHeight: number
  maxWidth: number
}

type SceneInfo = {
  atlasUtilization: number | null
  attachmentCount: number
  boneCount: number
  constraintCount: number
  dopesheetFps: number | null
  eventCount: number
  skinCount: number
  slotCount: number
  textureMemoryBytes: number | null
}

type AnimationSummary = {
  duration: number
  layoutHeight: number
  layoutOriginX: number
  layoutOriginY: number
  layoutWidth: number
  minHeight: number
  minWidth: number
  maxHeight: number
  maxWidth: number
  name: string
}

const DEFAULT_USER_SCALE = 1

function formatPixels(width?: number | null, height?: number | null) {
  if (width === null || width === undefined || height === null || height === undefined) {
    return 'Unavailable'
  }

  return `${Math.round(width)} x ${Math.round(height)} px`
}

function formatPoint(x?: number | null, y?: number | null) {
  if (x === null || x === undefined || y === null || y === undefined) {
    return 'Unavailable'
  }

  return `${Math.round(x)}, ${Math.round(y)}`
}

function MetricCard({
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
  )
}

function SectionCard({
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
  )
}

function FileInputField({
  id,
  label,
  hint,
  accept,
  multiple = false,
  filesLabel,
  onFilesSelected,
}: {
  id: string
  label: string
  hint?: string
  accept: string
  multiple?: boolean
  filesLabel: string
  onFilesSelected: (files: FileList | File[]) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)

    if (event.dataTransfer.files.length > 0) {
      onFilesSelected(event.dataTransfer.files)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div
        className={cn(
          'rounded-2xl border border-dashed bg-background/60 p-4 transition-all',
          isDragging
            ? 'border-primary/70 bg-primary/10 shadow-lg shadow-primary/10 ring-2 ring-primary/30'
            : 'border-border/60 hover:border-primary/40 hover:bg-background/80',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          type="button"
          className="flex w-full flex-col items-center justify-center rounded-[20px] border border-border/50 bg-card/40 px-5 py-8 text-center transition hover:bg-card/60"
          onClick={() => inputRef.current?.click()}
        >
          <div
            className={cn(
              'mb-4 flex size-12 items-center justify-center rounded-full border transition-colors',
              isDragging
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-border/60 bg-background/80 text-muted-foreground',
            )}
          >
            <FileUp className="size-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            Drag and drop file{multiple ? 's' : ''} here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            or click to browse {multiple ? 'your files' : 'a file'}
          </p>
          <p className="mt-3 text-[0.7rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Accepted: {accept.split(',').join(' ')}
          </p>
        </button>
        <input
          ref={inputRef}
          id={id}
          className="sr-only"
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(event) => {
            if (event.target.files) {
              onFilesSelected(event.target.files)
            }
          }}
        />
        <div className="mt-4 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
          <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Selected
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-foreground/90">{filesLabel}</p>
        </div>
        {hint ? <p className="mt-3 text-xs leading-5 text-muted-foreground/80">{hint}</p> : null}
      </div>
    </div>
  )
}

function createAssetUrl(file: File) {
  return URL.createObjectURL(file)
}

function revokeAssetUrls(urls: string[]) {
  for (const url of urls) {
    URL.revokeObjectURL(url)
  }
}

function createAssetKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

async function loadImageSource(file: File) {
  const objectUrl = createAssetUrl(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error(`Failed to load image "${file.name}".`))
      element.src = objectUrl
    })

    return new ImageSource({ resource: image })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function getAtlasPageNames(atlasText: string) {
  const lines = atlasText.split(/\r\n|\r|\n/)
  const pages: string[] = []
  let expectingPageName = true

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      expectingPageName = true
      continue
    }

    if (expectingPageName && !line.includes(':')) {
      pages.push(line)
      expectingPageName = false
    }
  }

  return pages
}

function parseAtlasInfo(atlasText: string): AtlasInfo | null {
  const lines = atlasText.split(/\r\n|\r|\n/).map((line) => line.trim())
  let mode: 'pageHeader' | 'pageMeta' | 'regionMeta' = 'pageHeader'
  let firstPageWidth = 0
  let firstPageHeight = 0
  let pageCount = 0
  let regionCount = 0
  let scale: number | null = null
  let totalPageArea = 0
  let usedArea = 0

  for (const line of lines) {
    if (!line) {
      mode = 'pageHeader'
      continue
    }

    if (mode === 'pageHeader') {
      pageCount += 1
      mode = 'pageMeta'
      continue
    }

    if (mode === 'pageMeta') {
      if (!line.includes(':')) {
        regionCount += 1
        mode = 'regionMeta'
        continue
      }

      const sizeMatch = line.match(/^size:\s*([0-9.]+)\s*,\s*([0-9.]+)$/i)

      if (sizeMatch) {
        const pageWidth = Number(sizeMatch[1])
        const pageHeight = Number(sizeMatch[2])

        if (firstPageWidth === 0 && firstPageHeight === 0) {
          firstPageWidth = pageWidth
          firstPageHeight = pageHeight
        }

        totalPageArea += pageWidth * pageHeight
        continue
      }

      const scaleMatch = line.match(/^scale:\s*([0-9.]+)$/i)

      if (scaleMatch) {
        const nextScale = Number(scaleMatch[1])

        scale = Number.isFinite(nextScale) ? nextScale : scale
      }

      continue
    }

    if (!line.includes(':')) {
      regionCount += 1
      continue
    }

    const boundsMatch = line.match(/^bounds:\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)$/i)

    if (boundsMatch) {
      usedArea += Number(boundsMatch[1]) * Number(boundsMatch[2])
    }
  }

  if (firstPageWidth <= 0 || firstPageHeight <= 0) {
    return null
  }

  return {
    pageCount,
    pageHeight: firstPageHeight,
    pageWidth: firstPageWidth,
    regionCount,
    scale,
    textureMemoryBytes: totalPageArea > 0 ? totalPageArea * 4 : firstPageWidth * firstPageHeight * 4,
    totalPageArea,
    usedArea,
  }
}

function classifyFiles(fileList: FileList | File[]) {
  let atlas: File | null = null
  let skeleton: File | null = null
  const images: File[] = []

  for (const file of Array.from(fileList)) {
    const lowerName = file.name.toLowerCase()

    if (lowerName.endsWith('.atlas')) {
      atlas = file
      continue
    }

    if (lowerName.endsWith('.skel')) {
      skeleton = file
      continue
    }

    if (lowerName.endsWith('.png')) {
      images.push(file)
    }
  }

  return { atlas, skeleton, images }
}

function getSpineBounds(spine: Spine) {
  spine.skeleton.updateWorldTransform(Physics.update)

  const bounds = spine.skeleton.getBoundsRect()

  return bounds.width === Number.NEGATIVE_INFINITY
    ? { x: 0, y: 0, width: 0, height: 0 }
    : bounds
}

function computePlaybackInfo(spine: Spine): PlaybackInfo {
  const entry = spine.state.getCurrent(0)

  if (!entry || !entry.animation) {
    return {
      currentTime: 0,
      duration: 0,
      loopCount: 0,
      progress: 0,
    }
  }

  const duration = Math.max(entry.animationEnd - entry.animationStart, entry.animation.duration, 0)
  const currentTime = entry.getAnimationTime()
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  const loopCount = entry.loop && duration > 0 ? Math.floor(entry.trackTime / duration) : Number(entry.isComplete())

  return {
    currentTime,
    duration,
    loopCount,
    progress,
  }
}

function computeAnimationSummaries(spine: Spine): AnimationSummary[] {
  return spine.skeleton.data.animations.map((animation) => {
    const maxBounds = new SkinsAndAnimationBoundsProvider(animation.name, [], 0.1, false).calculateBounds(spine)
    const duration = animation.duration
    const sampleCount = duration > 0 ? Math.max(2, Math.min(90, Math.ceil(duration * 30))) : 1
    let minWidth = Number.POSITIVE_INFINITY
    let minHeight = Number.POSITIVE_INFINITY

    for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
      const sampleTime = duration > 0 ? (duration * sampleIndex) / sampleCount : 0

      spine.state.clearTracks()
      spine.skeleton.setToSetupPose()
      spine.state.setAnimation(0, animation.name, false)

      const entry = spine.state.getCurrent(0)

      if (!entry) {
        continue
      }

      entry.trackTime = sampleTime
      spine.state.apply(spine.skeleton)

      const bounds = getSpineBounds(spine)

      minWidth = Math.min(minWidth, bounds.width)
      minHeight = Math.min(minHeight, bounds.height)
    }

    return {
      duration,
      layoutHeight: maxBounds.height,
      layoutOriginX: maxBounds.x,
      layoutOriginY: maxBounds.y,
      layoutWidth: maxBounds.width,
      maxHeight: maxBounds.height,
      maxWidth: maxBounds.width,
      minHeight: Number.isFinite(minHeight) ? minHeight : maxBounds.height,
      minWidth: Number.isFinite(minWidth) ? minWidth : maxBounds.width,
      name: animation.name,
    }
  })
}

function getDisplayedScale(
  boundsWidth: number,
  boundsHeight: number,
  requestedScale = 1,
) {
  const normalizedRequestedScale = requestedScale > 0 ? requestedScale : 1

  if (boundsWidth <= 0 || boundsHeight <= 0) {
    return normalizedRequestedScale
  }

  return normalizedRequestedScale
}

function drawAnimationBoundsBorder(
  debugBounds: Graphics | null,
  bounds: { x: number; y: number; width: number; height: number },
  position: { x: number; y: number },
  scale: number,
) {
  if (!debugBounds) {
    return
  }

  debugBounds.clear()

  if (bounds.width <= 0 || bounds.height <= 0) {
    return
  }

  debugBounds
    .rect(
      position.x + bounds.x * scale,
      position.y + bounds.y * scale,
      bounds.width * scale,
      bounds.height * scale,
    )
    .stroke({
      alpha: 0.95,
      color: 0xffc857,
      pixelLine: true,
      width: 1.5,
    })
}

function drawAnchorDot(
  debugAnchor: Graphics | null,
  anchorPosition: { x: number; y: number },
  scale: number,
) {
  if (!debugAnchor) {
    return
  }

  debugAnchor.clear()

  const radius = Math.max(3, Math.min(6, 4 / Math.max(scale, 0.001)))
  const crosshair = radius * 2.2

  debugAnchor
    .circle(anchorPosition.x, anchorPosition.y, radius)
    .fill({
      alpha: 0.95,
      color: 0xff5d73,
    })
    .stroke({
      alpha: 1,
      color: 0xffffff,
      pixelLine: true,
      width: 1.25,
    })
    .moveTo(anchorPosition.x - crosshair, anchorPosition.y)
    .lineTo(anchorPosition.x + crosshair, anchorPosition.y)
    .moveTo(anchorPosition.x, anchorPosition.y - crosshair)
    .lineTo(anchorPosition.x, anchorPosition.y + crosshair)
    .stroke({
      alpha: 0.9,
      color: 0xff5d73,
      pixelLine: true,
      width: 1,
    })
}

function updateSpineLayout(
  spine: Spine,
  width: number,
  height: number,
  requestedScale = 1,
  debugBounds: Graphics | null = null,
  debugAnchor: Graphics | null = null,
  layoutBounds?: { x: number; y: number; width: number; height: number } | null,
): SpineSize {
  const bounds = getSpineBounds(spine)
  const anchorBounds = layoutBounds && layoutBounds.width > 0 && layoutBounds.height > 0 ? layoutBounds : bounds
  const normalizedRequestedScale = requestedScale > 0 ? requestedScale : 1

  if (anchorBounds.width <= 0 || anchorBounds.height <= 0) {
    spine.position.set(width * 0.5, height * 0.72)
    spine.scale.set(normalizedRequestedScale)
    drawAnimationBoundsBorder(debugBounds, bounds, spine.position, normalizedRequestedScale)
    drawAnchorDot(debugAnchor, spine.position, normalizedRequestedScale)
    return {
      canvasHeight: height,
      canvasWidth: width,
      currentScale: normalizedRequestedScale,
      displayOffsetX: width * 0.5,
      displayOffsetY: height * 0.72,
      layoutHeight: 0,
      layoutOffsetX: width * 0.5,
      layoutOffsetY: height * 0.72,
      layoutOriginX: 0,
      layoutOriginY: 0,
      layoutWidth: 0,
      overflowingCanvas: false,
      originX: 0,
      originY: 0,
      realHeight: 0,
      realWidth: 0,
      realtimeHeight: 0,
      realtimeWidth: 0,
    }
  }

  const centerX = anchorBounds.x + anchorBounds.width * 0.5
  const centerY = anchorBounds.y + anchorBounds.height * 0.5
  const scale = getDisplayedScale(anchorBounds.width, anchorBounds.height, normalizedRequestedScale)

  spine.scale.set(scale)
  spine.position.set(width * 0.5 - centerX * scale, height * 0.5 - centerY * scale)
  drawAnimationBoundsBorder(debugBounds, bounds, spine.position, scale)
  drawAnchorDot(debugAnchor, spine.position, scale)

  return {
    canvasHeight: height,
    canvasWidth: width,
    currentScale: scale,
    displayOffsetX: spine.position.x + bounds.x * scale,
    displayOffsetY: spine.position.y + bounds.y * scale,
    layoutHeight: anchorBounds.height,
    layoutOffsetX: spine.position.x + anchorBounds.x * scale,
    layoutOffsetY: spine.position.y + anchorBounds.y * scale,
    layoutOriginX: anchorBounds.x,
    layoutOriginY: anchorBounds.y,
    layoutWidth: anchorBounds.width,
    overflowingCanvas: bounds.width * scale > width || bounds.height * scale > height,
    originX: bounds.x,
    originY: bounds.y,
    realHeight: bounds.height,
    realWidth: bounds.width,
    realtimeHeight: bounds.height * scale,
    realtimeWidth: bounds.width * scale,
  }
}

async function loadScene(
  files: SelectedFiles,
  host: HTMLDivElement,
  canvasHost: HTMLDivElement,
  requestedScale = DEFAULT_USER_SCALE,
  onSizeChange?: (size: SpineSize) => void,
  onFpsChange?: (fps: number) => void,
  onPlaybackChange?: (playback: PlaybackInfo) => void,
): Promise<LoadedScene> {
  if (!files.atlas || !files.skeleton || files.images.length === 0) {
    throw new Error('Select an .atlas, a .skel skeleton, and at least one .png image.')
  }

  const app = new Application()

  await app.init({
    antialias: true,
    background: '#09111f',
    resizeTo: host,
  })

  canvasHost.replaceChildren(app.canvas)

  const tempUrls: string[] = []
  const assetKeys: string[] = []

  try {
    const atlasText = await files.atlas.text()
    const atlasInfo = parseAtlasInfo(atlasText)
    const atlasPageNames = getAtlasPageNames(atlasText)
    const skeletonUrl = createAssetUrl(files.skeleton)
    const atlasUrl = createAssetUrl(files.atlas)
    const skeletonAssetKey = createAssetKey('spine-skeleton')
    const atlasAssetKey = createAssetKey('spine-atlas')
    const pageTextures: Record<string, ImageSource> = {}

    tempUrls.push(skeletonUrl, atlasUrl)
    assetKeys.push(skeletonAssetKey, atlasAssetKey)

    for (const image of files.images) {
      pageTextures[image.name] = await loadImageSource(image)
    }

    if (files.images.length === 1) {
      const firstTexture = pageTextures[files.images[0].name]

      for (const pageName of atlasPageNames) {
        if (!pageTextures[pageName]) {
          pageTextures[pageName] = firstTexture
        }
      }
    } else {
      for (const pageName of atlasPageNames) {
        if (!pageTextures[pageName]) {
          throw new Error(
            `Missing PNG for atlas page "${pageName}". Upload the exact image referenced by the atlas.`,
          )
        }
      }
    }

    await Assets.load([
      {
        alias: skeletonAssetKey,
        parser: 'spineSkeletonLoader',
        src: skeletonUrl,
      },
      {
        alias: atlasAssetKey,
        parser: 'spineTextureAtlasLoader',
        src: atlasUrl,
        data: {
          images: pageTextures,
        },
      },
    ])

    const spine = Spine.from({
      atlas: atlasAssetKey,
      autoUpdate: true,
      skeleton: skeletonAssetKey,
      ticker: app.ticker,
    })
    const debugAnchor = new Graphics()
    const debugBounds = new Graphics()
    const animationSummaries = computeAnimationSummaries(spine)
    const getAnimationLayoutBounds = (animationName: string) => {
      const summary = animationSummaries.find((item) => item.name === animationName)

      if (!summary) {
        return null
      }

      return {
        height: summary.layoutHeight,
        width: summary.layoutWidth,
        x: summary.layoutOriginX,
        y: summary.layoutOriginY,
      }
    }
    const requestedScaleState = { value: requestedScale }
    let lastFpsUpdate = 0

    const syncSceneMetrics = () => {
      const activeAnimation = spine.state.getCurrent(0)?.animation?.name ?? ''

      onSizeChange?.(
        updateSpineLayout(
          spine,
          app.screen.width,
          app.screen.height,
          requestedScaleState.value,
          debugBounds,
          debugAnchor,
          getAnimationLayoutBounds(activeAnimation),
        ),
      )
      onPlaybackChange?.(computePlaybackInfo(spine))

      const now = performance.now()

      if (now - lastFpsUpdate >= 250) {
        onFpsChange?.(Math.round(app.ticker.FPS))
        lastFpsUpdate = now
      }
    }

    const animations = spine.skeleton.data.animations.map((animation) => animation.name)

    if (animations.length > 0) {
      spine.state.setAnimation(0, animations[0], true)
    }

    app.stage.addChild(spine)
    app.stage.addChild(debugBounds)
    app.stage.addChild(debugAnchor)
    onSizeChange?.(
      updateSpineLayout(
        spine,
        app.screen.width,
        app.screen.height,
        requestedScaleState.value,
        debugBounds,
        debugAnchor,
        getAnimationLayoutBounds(animations[0] ?? ''),
      ),
    )
    onFpsChange?.(Math.round(app.ticker.FPS))
    onPlaybackChange?.(computePlaybackInfo(spine))
    app.ticker.add(syncSceneMetrics)

    app.renderer.on('resize', () => {
      onSizeChange?.(
        updateSpineLayout(
          spine,
          app.screen.width,
          app.screen.height,
          requestedScaleState.value,
          debugBounds,
          debugAnchor,
          getAnimationLayoutBounds(spine.state.getCurrent(0)?.animation?.name ?? ''),
        ),
      )
    })

    return {
      app,
      animationSummaries,
      atlasInfo,
      assetKeys,
      debugAnchor,
      debugBounds,
      getAnimationLayoutBounds,
      requestedScale: requestedScaleState,
      syncSceneMetrics,
      spine,
      animations,
    }
  } catch (error) {
    app.destroy(true, { children: true })
    throw error
  } finally {
    revokeAssetUrls(tempUrls)
  }
}

function destroyScene(scene: LoadedScene | null) {
  if (!scene) {
    return
  }

  scene.spine.autoUpdate = false
  scene.app.ticker.remove(scene.syncSceneMetrics)
  scene.app.stage.removeChild(scene.debugAnchor)
  scene.debugAnchor.destroy()
  scene.app.stage.removeChild(scene.debugBounds)
  scene.debugBounds.destroy()
  scene.app.stage.removeChild(scene.spine)
  scene.spine.destroy()
  scene.app.destroy(undefined, { children: false })

  for (const assetKey of scene.assetKeys) {
    void Assets.unload(assetKey)
  }
}

function App() {
  const assetBaseUrl = import.meta.env.BASE_URL
  const [files, setFiles] = useState<SelectedFiles>({
    atlas: null,
    skeleton: null,
    images: [],
  })
  const [animations, setAnimations] = useState<string[]>([])
  const [selectedAnimation, setSelectedAnimation] = useState('')
  const [loop, setLoop] = useState(true)
  const [userScale, setUserScale] = useState(DEFAULT_USER_SCALE)
  const [timeScale, setTimeScale] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Upload Spine files and press Load demo.')
  const [fps, setFps] = useState<number | null>(null)
  const [hasScene, setHasScene] = useState(false)
  const [showWorkspace, setShowWorkspace] = useState(false)
  const [spineSize, setSpineSize] = useState<SpineSize | null>(null)
  const [animationSummaries, setAnimationSummaries] = useState<AnimationSummary[]>([])
  const [atlasInfo, setAtlasInfo] = useState<AtlasInfo | null>(null)
  const [playbackInfo, setPlaybackInfo] = useState<PlaybackInfo | null>(null)
  const [renderedSizeRange, setRenderedSizeRange] = useState<RenderedSizeRange | null>(null)
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<LoadedScene | null>(null)

  useEffect(() => {
    return () => {
      destroyScene(sceneRef.current)
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!spineSize || spineSize.realtimeWidth <= 0 || spineSize.realtimeHeight <= 0) {
      return
    }

    setRenderedSizeRange((current) =>
      current
        ? {
            maxHeight: Math.max(current.maxHeight, spineSize.realtimeHeight),
            maxWidth: Math.max(current.maxWidth, spineSize.realtimeWidth),
            minHeight: Math.min(current.minHeight, spineSize.realtimeHeight),
            minWidth: Math.min(current.minWidth, spineSize.realtimeWidth),
          }
        : {
            maxHeight: spineSize.realtimeHeight,
            maxWidth: spineSize.realtimeWidth,
            minHeight: spineSize.realtimeHeight,
            minWidth: spineSize.realtimeWidth,
          },
    )
  }, [spineSize])

  function updateAnimation(animationName: string, shouldLoop: boolean) {
    const scene = sceneRef.current

    if (!scene || !animationName) {
      return
    }

    scene.spine.state.setAnimation(0, animationName, shouldLoop)
    setPlaybackInfo(null)
    setRenderedSizeRange(null)
    const nextSpineSize = updateSpineLayout(
      scene.spine,
      scene.app.screen.width,
      scene.app.screen.height,
      userScale,
      scene.debugBounds,
      scene.debugAnchor,
      scene.getAnimationLayoutBounds(animationName),
    )

    setSpineSize(nextSpineSize)
    setPlaybackInfo(computePlaybackInfo(scene.spine))
    setSelectedAnimation(animationName)
  }

  function updateTimeScale(nextTimeScale: number) {
    const scene = sceneRef.current

    setTimeScale(nextTimeScale)

    if (!scene) {
      return
    }

    scene.spine.state.timeScale = nextTimeScale
  }

  function updateUserScale(nextScale: number) {
    const scene = sceneRef.current
    const normalizedScale = Number.isFinite(nextScale) && nextScale > 0 ? nextScale : DEFAULT_USER_SCALE

    setUserScale(normalizedScale)

    if (!scene) {
      return
    }

    scene.requestedScale.value = normalizedScale

    setSpineSize(
      updateSpineLayout(
        scene.spine,
        scene.app.screen.width,
        scene.app.screen.height,
        normalizedScale,
        scene.debugBounds,
        scene.debugAnchor,
        scene.getAnimationLayoutBounds(selectedAnimation),
      ),
    )
  }

  function handleBackToIntake() {
    const scene = sceneRef.current

    if (scene) {
      destroyScene(scene)
      sceneRef.current = null
    }

    setAnimations([])
    setAnimationSummaries([])
    setAtlasInfo(null)
    setFps(null)
    setHasScene(false)
    setPlaybackInfo(null)
    setRenderedSizeRange(null)
    setSceneInfo(null)
    setSelectedAnimation('')
    setShowWorkspace(false)
    setSpineSize(null)
    setStatus('Upload Spine files and press Load demo.')
    setUserScale(DEFAULT_USER_SCALE)
  }

  function applyCombinedFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) {
      return
    }

    const nextFiles = classifyFiles(fileList)

    setFiles((current) => ({
      atlas: nextFiles.atlas ?? current.atlas,
      skeleton: nextFiles.skeleton ?? current.skeleton,
      images: nextFiles.images.length > 0 ? nextFiles.images : current.images,
    }))
  }

  async function handleLoad() {
    if (!showWorkspace) {
      setShowWorkspace(true)
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }

    if (!viewportRef.current || !canvasHostRef.current) {
      setError('Unable to prepare the Pixi stage.')
      setStatus('Load failed.')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Loading Spine skeleton...')

    const previousScene = sceneRef.current

    if (previousScene) {
      destroyScene(previousScene)
      sceneRef.current = null
      setAnimationSummaries([])
      setAtlasInfo(null)
      setHasScene(false)
      setFps(null)
      setPlaybackInfo(null)
      setRenderedSizeRange(null)
      setSceneInfo(null)
      setUserScale(DEFAULT_USER_SCALE)
    }

    try {
      const scene = await loadScene(
        files,
        viewportRef.current,
        canvasHostRef.current,
        files.atlas ? parseAtlasInfo(await files.atlas.text())?.scale ?? DEFAULT_USER_SCALE : DEFAULT_USER_SCALE,
        setSpineSize,
        setFps,
        setPlaybackInfo,
      )
      const firstAnimation = scene.animations[0] ?? ''
      const nextUserScale = scene.atlasInfo?.scale ?? DEFAULT_USER_SCALE

      scene.spine.state.timeScale = timeScale
      sceneRef.current = scene
      setAnimationSummaries(scene.animationSummaries)
      setAtlasInfo(scene.atlasInfo)
      setHasScene(true)
      setRenderedSizeRange(null)
      setAnimations(scene.animations)
      setSelectedAnimation(firstAnimation)
      setUserScale(nextUserScale)
      setSceneInfo({
        atlasUtilization:
          scene.atlasInfo && scene.atlasInfo.totalPageArea > 0
            ? scene.atlasInfo.usedArea / scene.atlasInfo.totalPageArea
            : null,
        attachmentCount: scene.spine.skeleton.data.skins.reduce(
          (total, skin) => total + skin.getAttachments().length,
          0,
        ),
        boneCount: scene.spine.skeleton.data.bones.length,
        constraintCount:
          scene.spine.skeleton.data.ikConstraints.length +
          scene.spine.skeleton.data.transformConstraints.length +
          scene.spine.skeleton.data.pathConstraints.length +
          scene.spine.skeleton.data.physicsConstraints.length,
        dopesheetFps: scene.spine.skeleton.data.fps > 0 ? scene.spine.skeleton.data.fps : null,
        eventCount: scene.spine.skeleton.data.events.length,
        skinCount: scene.spine.skeleton.data.skins.length,
        slotCount: scene.spine.skeleton.data.slots.length,
        textureMemoryBytes: scene.atlasInfo?.textureMemoryBytes ?? null,
      })
      setLoop(true)
      setStatus(
        scene.animations.length > 0
          ? `Loaded ${scene.animations.length} animation${scene.animations.length === 1 ? '' : 's'}.`
          : 'Skeleton loaded with no animations in the file.',
      )
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Failed to load Spine assets.'

      setAnimations([])
      setAnimationSummaries([])
      setSelectedAnimation('')
      setAtlasInfo(null)
      setFps(null)
      setHasScene(false)
      setPlaybackInfo(null)
      setRenderedSizeRange(null)
      setSceneInfo(null)
      setSpineSize(null)
      setUserScale(DEFAULT_USER_SCALE)
      setError(message)
      setStatus('Load failed.')
    } finally {
      setLoading(false)
    }
  }

  const canLoad = Boolean(files.atlas && files.skeleton && files.images.length > 0) && !loading
  const selectedAnimationSummary =
    animationSummaries.find((summary) => summary.name === selectedAnimation) ?? null
  const minSkeletonScaled =
    selectedAnimationSummary
      ? {
          height:
            selectedAnimationSummary.minHeight *
            getDisplayedScale(
              selectedAnimationSummary.minWidth,
              selectedAnimationSummary.minHeight,
              userScale,
            ),
          width:
            selectedAnimationSummary.minWidth *
            getDisplayedScale(
              selectedAnimationSummary.minWidth,
              selectedAnimationSummary.minHeight,
              userScale,
            ),
        }
      : null
  const maxSkeletonScaled =
    selectedAnimationSummary
      ? {
          height:
            selectedAnimationSummary.maxHeight *
            getDisplayedScale(
              selectedAnimationSummary.maxWidth,
              selectedAnimationSummary.maxHeight,
              userScale,
            ),
          width:
            selectedAnimationSummary.maxWidth *
            getDisplayedScale(
              selectedAnimationSummary.maxWidth,
              selectedAnimationSummary.maxHeight,
              userScale,
            ),
        }
      : null
  const safeContainerSize =
    animationSummaries.length > 0
      ? {
          height: Math.max(...animationSummaries.map((summary) => summary.maxHeight * userScale)),
          width: Math.max(...animationSummaries.map((summary) => summary.maxWidth * userScale)),
        }
      : null
  const defaultScale = atlasInfo?.scale ?? DEFAULT_USER_SCALE

  return (
    <main className="relative min-h-svh px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(34,197,94,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_26%)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {!showWorkspace ? (
          <section className="mx-auto w-full max-w-2xl">
            <SectionCard
              icon={Upload}
              title="Asset Intake"
              description="Load your atlas, skeleton binary, and page textures."
            >
              <div className="space-y-4">
                <FileInputField
                  id="all-spine-files"
                  label="All Spine files"
                  accept=".atlas,.skel,.png,text/plain,application/octet-stream,image/png"
                  multiple
                  filesLabel={[
                    files.atlas?.name,
                    files.skeleton?.name,
                    ...files.images.map((file) => file.name),
                  ]
                    .filter(Boolean)
                    .join(', ') || 'No files selected'}
                  hint="Select the full export in one pass. The player auto-detects `.atlas`, `.skel`, and `.png`."
                  onFilesSelected={(selectedFiles) => applyCombinedFiles(selectedFiles)}
                />

                <div className="grid gap-4">
                  <FileInputField
                    id="atlas-file"
                    label="Atlas file"
                    accept=".atlas,text/plain"
                    filesLabel={files.atlas?.name ?? 'No atlas selected'}
                    onFilesSelected={(selectedFiles) =>
                      setFiles((current) => ({
                        ...current,
                        atlas: Array.from(selectedFiles)[0] ?? null,
                      }))
                    }
                  />

                  <FileInputField
                    id="skeleton-file"
                    label="Skeleton binary"
                    accept=".skel,application/octet-stream"
                    filesLabel={files.skeleton?.name ?? 'No .skel selected'}
                    onFilesSelected={(selectedFiles) =>
                      setFiles((current) => ({
                        ...current,
                        skeleton: Array.from(selectedFiles)[0] ?? null,
                      }))
                    }
                  />

                  <FileInputField
                    id="atlas-images"
                    label="Atlas PNG pages"
                    accept=".png,image/png"
                    multiple
                    filesLabel={
                      files.images.length > 0
                        ? files.images.map((file) => file.name).join(', ')
                        : 'No PNG selected'
                    }
                    onFilesSelected={(selectedFiles) =>
                      setFiles((current) => ({
                        ...current,
                        images: Array.from(selectedFiles),
                      }))
                    }
                  />
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-sm font-medium text-foreground">{status}</p>
                  {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
                </div>

                <Button
                  className="h-11 w-full rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  disabled={!canLoad}
                  onClick={handleLoad}
                >
                  <Play className="size-4" />
                  {loading ? 'Loading…' : 'Load demo'}
                </Button>
              </div>
            </SectionCard>
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
            <div className="space-y-6 xl:sticky xl:top-[20px] xl:self-start">
              <SectionCard
                icon={PackageOpen}
                title="Pixi Stage"
                description="Dedicated render surface for the loaded Spine scene."
              >
                <div
                  ref={viewportRef}
                  className="relative min-h-[560px] overflow-hidden rounded-[28px] border border-border/60 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(6,10,18,0.98))]"
                >
                  <div ref={canvasHostRef} className="h-full w-full" />
                  {!hasScene ? (
                    <div className="absolute inset-0 grid place-items-center p-6">
                      <div className="max-w-sm rounded-[24px] border border-dashed border-border/70 bg-background/50 px-6 py-8 text-center backdrop-blur">
                        <PackageOpen className="mx-auto mb-4 size-8 text-muted-foreground" />
                        <p className="text-base font-medium text-foreground">Load local Spine assets to render the player.</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          The Pixi canvas lives here now, separated from the analytics cards for a cleaner layout.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-6">
              <Button
                variant="outline"
                className="h-11 w-full rounded-2xl"
                onClick={handleBackToIntake}
              >
                <ArrowLeft className="size-4" />
                Back to File Selection
              </Button>

              <SectionCard
                icon={Clapperboard}
                title="Playback Controls"
                description="Drive animation selection, looping, speed, and display scale."
              >
                <div className="space-y-5">
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
                      onChange={(event) => {
                        const nextLoop = event.target.checked

                        setLoop(nextLoop)
                        updateAnimation(selectedAnimation, nextLoop)
                      }}
                    />
                  </label>

                  <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Animation speed</p>
                        <p className="text-xs text-muted-foreground">1 is normal, 0.5 is half, 2 is double.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => updateTimeScale(1)}>
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
                        onValueChange={([nextValue]) => updateTimeScale(nextValue ?? 0)}
                      />
                      <Input
                        className="h-10"
                        type="number"
                        min="0"
                        max="3"
                        step="0.05"
                        value={timeScale}
                        onChange={(event) => updateTimeScale(Number(event.target.value))}
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
                      <Button size="sm" variant="outline" onClick={() => updateUserScale(defaultScale)}>
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
                        onValueChange={([nextValue]) => updateUserScale(nextValue ?? DEFAULT_USER_SCALE)}
                      />
                      <Input
                        className="h-10"
                        type="number"
                        min="0.05"
                        max="3"
                        step="0.01"
                        value={userScale}
                        onChange={(event) => updateUserScale(Number(event.target.value))}
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
                          'rounded-2xl border p-4 text-left transition',
                          animation.name === selectedAnimation
                            ? 'border-primary/40 bg-primary/10 shadow-lg shadow-primary/10'
                            : 'border-border/60 bg-card/60 hover:border-border hover:bg-card',
                        )}
                        onClick={() => updateAnimation(animation.name, loop)}
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
                    note={
                      spineSize
                        ? `Anchor ${formatPoint(spineSize.layoutOffsetX, spineSize.layoutOffsetY)}`
                        : 'Anchor unavailable'
                    }
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
        )}

        <footer className="pb-2 text-center text-xs tracking-[0.24em] text-muted-foreground">
          {!showWorkspace ? (
            <img
              src={`${assetBaseUrl}powered-by.png`}
              alt="Powered by"
              className="mx-auto mb-4 h-auto w-auto max-w-[220px]"
            />
          ) : null}
        </footer>
      </div>
    </main>
  )
}

export default App
