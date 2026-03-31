import { useEffect, useRef, useState } from 'react'
import { Application, Assets, Graphics, ImageSource } from 'pixi.js'
import { Physics, Spine, SkinsAndAnimationBoundsProvider } from '@esotericsoftware/spine-pixi-v8'
import './App.css'

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

  function applyCombinedFiles(fileList: FileList | null) {
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
    if (!viewportRef.current || !canvasHostRef.current) {
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
    <main className="app-shell">
      <section className="workspace">
        <aside className="controls">
          <label className="field">
            <span>All Spine files</span>
            <input
              type="file"
              accept=".atlas,.skel,.png,text/plain,application/octet-stream,image/png"
              multiple
              onChange={(event) => applyCombinedFiles(event.target.files)}
            />
            <small>Select the full set at once. The picker will detect `.atlas`, `.skel`, and `.png` files automatically.</small>
          </label>

          <label className="field">
            <span>Atlas file</span>
            <input
              type="file"
              accept=".atlas,text/plain"
              onChange={(event) =>
                setFiles((current) => ({
                  ...current,
                  atlas: event.target.files?.[0] ?? null,
                }))
              }
            />
            <small>{files.atlas?.name ?? 'No atlas selected'}</small>
          </label>

          <label className="field">
            <span>Skeleton binary</span>
            <input
              type="file"
              accept=".skel,application/octet-stream"
              onChange={(event) =>
                setFiles((current) => ({
                  ...current,
                  skeleton: event.target.files?.[0] ?? null,
                }))
              }
            />
            <small>{files.skeleton?.name ?? 'No .skel selected'}</small>
          </label>

          <label className="field">
            <span>Atlas PNG pages</span>
            <input
              type="file"
              accept=".png,image/png"
              multiple
              onChange={(event) =>
                setFiles((current) => ({
                  ...current,
                  images: Array.from(event.target.files ?? []),
                }))
              }
            />
            <small>
              {files.images.length > 0
                ? files.images.map((file) => file.name).join(', ')
                : 'No PNG selected'}
            </small>
          </label>

          <div className="messages">
            <p className="status">{status}</p>
            {error ? <p className="error">{error}</p> : null}
          </div>

          <button className="primary-action" disabled={!canLoad} onClick={handleLoad}>
            {loading ? 'Loading…' : 'Load demo'}
          </button>

          <label className="field">
            <span>Animation</span>
            <select
              disabled={animations.length === 0}
              value={selectedAnimation}
              onChange={(event) => updateAnimation(event.target.value, loop)}
            >
              {animations.length === 0 ? (
                <option value="">No animations loaded</option>
              ) : (
                animations.map((animation) => (
                  <option key={animation} value={animation}>
                    {animation}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={loop}
              disabled={!selectedAnimation}
              onChange={(event) => {
                const nextLoop = event.target.checked

                setLoop(nextLoop)
                updateAnimation(selectedAnimation, nextLoop)
              }}
            />
            <span>Loop animation</span>
          </label>

          <label className="field">
            <div className="field-header">
              <span>Animation speed</span>
              <button
                type="button"
                className="field-reset"
                onClick={() => updateTimeScale(1)}
              >
                Reset
              </button>
            </div>
            <div className="timescale-row">
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={timeScale}
                onChange={(event) => updateTimeScale(Number(event.target.value))}
              />
              <input
                type="number"
                min="0"
                max="3"
                step="0.05"
                value={timeScale}
                onChange={(event) => updateTimeScale(Number(event.target.value))}
              />
            </div>
            <small>`1` is normal speed, `0.5` is half speed, `2` is double speed.</small>
          </label>

          <label className="field">
            <div className="field-header">
              <span>Animation scale</span>
              <button
                type="button"
                className="field-reset"
                onClick={() => updateUserScale(defaultScale)}
              >
                Reset
              </button>
            </div>
            <div className="timescale-row">
              <input
                type="range"
                min="0.05"
                max="3"
                step="0.01"
                value={userScale}
                onChange={(event) => updateUserScale(Number(event.target.value))}
              />
              <input
                type="number"
                min="0.05"
                max="3"
                step="0.01"
                value={userScale}
                onChange={(event) => updateUserScale(Number(event.target.value))}
              />
            </div>
            <small>
              Defaults to atlas scale
              {atlasInfo?.scale !== null && atlasInfo?.scale !== undefined ? ` (${atlasInfo.scale})` : ''}.
            </small>
          </label>
        </aside>

        <div className="viewer-panel">
          <div className="viewer-chrome">
            <div className="viewer-metric-group">
              <span className="viewer-section-label">Realtime</span>
              <div className="viewer-metrics">
                <div className="viewer-stat viewer-stat-primary">
                  <span className="viewer-stat-label">Active Animation</span>
                  <strong className="viewer-stat-value">{selectedAnimation || 'idle'}</strong>
                </div>
                <div className="viewer-stat viewer-stat-fps">
                  <span className="viewer-stat-label">FPS</span>
                  <strong className="viewer-stat-value">{fps === null ? 'Unavailable' : fps}</strong>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Current Time</span>
                  <strong className="viewer-stat-value">
                    {playbackInfo ? `${playbackInfo.currentTime.toFixed(2)}s` : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {playbackInfo ? `${Math.round(playbackInfo.progress * 100)}% progress` : 'Progress unavailable'}
                  </span>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Animation Duration</span>
                  <strong className="viewer-stat-value">
                    {playbackInfo ? `${playbackInfo.duration.toFixed(2)}s` : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {playbackInfo ? `Loops ${playbackInfo.loopCount}` : 'Loop count unavailable'}
                  </span>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Rendered Size</span>
                  <strong className="viewer-stat-value">
                    {spineSize
                      ? `${Math.round(spineSize.realtimeWidth)} x ${Math.round(spineSize.realtimeHeight)} px`
                      : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {renderedSizeRange
                      ? `Low ${Math.round(renderedSizeRange.minWidth)} x ${Math.round(renderedSizeRange.minHeight)} px · Peak ${Math.round(renderedSizeRange.maxWidth)} x ${Math.round(renderedSizeRange.maxHeight)} px`
                      : 'Range unavailable'}
                  </span>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Current Scale</span>
                  <strong className="viewer-stat-value">
                    {spineSize ? spineSize.currentScale.toFixed(3) : 'Unavailable'}
                  </strong>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Display Offset</span>
                  <strong className="viewer-stat-value">
                    {spineSize
                      ? `${Math.round(spineSize.displayOffsetX)}, ${Math.round(spineSize.displayOffsetY)}`
                      : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {spineSize
                      ? `Stable anchor ${Math.round(spineSize.layoutOffsetX)}, ${Math.round(spineSize.layoutOffsetY)}`
                      : 'Anchor unavailable'}
                  </span>
                </div>
              </div>
            </div>
            <div className="viewer-metric-group">
              <span className="viewer-section-label">Skeleton</span>
              <div className="viewer-metrics">
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Skeleton Bounds</span>
                  <strong className="viewer-stat-value">
                    {spineSize
                      ? `${Math.round(spineSize.realWidth)} x ${Math.round(spineSize.realHeight)} px`
                      : 'Unavailable'}
                  </strong>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Min Skeleton</span>
                  <strong className="viewer-stat-value">
                    {selectedAnimationSummary
                      ? `${Math.round(selectedAnimationSummary.minWidth)} x ${Math.round(selectedAnimationSummary.minHeight)} px`
                      : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {minSkeletonScaled
                      ? `Scaled ${Math.round(minSkeletonScaled.width)} x ${Math.round(minSkeletonScaled.height)} px`
                      : 'Scaled unavailable'}
                  </span>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Max Skeleton</span>
                  <strong className="viewer-stat-value">
                    {selectedAnimationSummary
                      ? `${Math.round(selectedAnimationSummary.maxWidth)} x ${Math.round(selectedAnimationSummary.maxHeight)} px`
                      : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {maxSkeletonScaled
                      ? `Scaled ${Math.round(maxSkeletonScaled.width)} x ${Math.round(maxSkeletonScaled.height)} px`
                      : 'Scaled unavailable'}
                  </span>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Layout Bounds</span>
                  <strong className="viewer-stat-value">
                    {spineSize
                      ? `${Math.round(spineSize.layoutWidth)} x ${Math.round(spineSize.layoutHeight)} px`
                      : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {spineSize
                      ? `Origin ${Math.round(spineSize.layoutOriginX)}, ${Math.round(spineSize.layoutOriginY)}`
                      : 'Origin unavailable'}
                  </span>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Bounds Aspect</span>
                  <strong className="viewer-stat-value">
                    {spineSize && spineSize.realHeight > 0
                      ? (spineSize.realWidth / spineSize.realHeight).toFixed(3)
                      : 'Unavailable'}
                  </strong>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Bounds Origin</span>
                  <strong className="viewer-stat-value">
                    {spineSize
                      ? `${Math.round(spineSize.originX)}, ${Math.round(spineSize.originY)}`
                      : 'Unavailable'}
                  </strong>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Safe Web Size</span>
                  <strong className="viewer-stat-value">
                    {safeContainerSize
                      ? `${Math.round(safeContainerSize.width)} x ${Math.round(safeContainerSize.height)} px`
                      : 'Unavailable'}
                  </strong>
                </div>
              </div>
            </div>
            <div className="viewer-metric-group">
              <span className="viewer-section-label">Atlas</span>
              <div className="viewer-metrics">
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Atlas Page</span>
                  <strong className="viewer-stat-value">
                    {atlasInfo
                      ? `${Math.round(atlasInfo.pageWidth)} x ${Math.round(atlasInfo.pageHeight)} px`
                      : 'Unavailable'}
                  </strong>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Atlas Scale</span>
                  <strong className="viewer-stat-value">
                    {atlasInfo?.scale !== null && atlasInfo?.scale !== undefined
                      ? atlasInfo.scale
                      : 'Unavailable'}
                  </strong>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Atlas Utilization</span>
                  <strong className="viewer-stat-value">
                    {sceneInfo?.atlasUtilization !== null && sceneInfo?.atlasUtilization !== undefined
                      ? `${Math.round(sceneInfo.atlasUtilization * 100)}%`
                      : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {atlasInfo ? `${atlasInfo.regionCount} regions across ${atlasInfo.pageCount} page(s)` : 'Atlas unavailable'}
                  </span>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Texture Memory</span>
                  <strong className="viewer-stat-value">
                    {sceneInfo?.textureMemoryBytes !== null && sceneInfo?.textureMemoryBytes !== undefined
                      ? `${(sceneInfo.textureMemoryBytes / (1024 * 1024)).toFixed(2)} MB`
                      : 'Unavailable'}
                  </strong>
                </div>
              </div>
            </div>
            <div className="viewer-metric-group">
              <span className="viewer-section-label">Rig</span>
              <div className="viewer-metrics">
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Bones / Slots</span>
                  <strong className="viewer-stat-value">
                    {sceneInfo ? `${sceneInfo.boneCount} / ${sceneInfo.slotCount}` : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {sceneInfo ? `${sceneInfo.skinCount} skins, ${sceneInfo.constraintCount} constraints` : 'Rig unavailable'}
                  </span>
                </div>
                <div className="viewer-stat">
                  <span className="viewer-stat-label">Attachments / Events</span>
                  <strong className="viewer-stat-value">
                    {sceneInfo ? `${sceneInfo.attachmentCount} / ${sceneInfo.eventCount}` : 'Unavailable'}
                  </strong>
                  <span className="viewer-stat-note">
                    {sceneInfo?.dopesheetFps ? `Dopesheet ${sceneInfo.dopesheetFps} fps` : 'Dopesheet unavailable'}
                  </span>
                </div>
              </div>
            </div>
            <div className="viewer-animation-summary">
              <span className="viewer-section-label">Animation Summary</span>
              <div className="viewer-summary-list">
                {animationSummaries.length === 0 ? (
                  <div className="viewer-summary-row viewer-summary-empty">No animation summary available.</div>
                ) : (
                  animationSummaries.map((animation) => (
                    <button
                      type="button"
                      key={animation.name}
                      className={`viewer-summary-row${animation.name === selectedAnimation ? ' viewer-summary-row-active' : ''}`}
                      onClick={() => updateAnimation(animation.name, loop)}
                    >
                      <span className="viewer-summary-name">{animation.name}</span>
                      <span className="viewer-summary-meta">
                        {animation.duration.toFixed(2)}s
                        {' · '}
                        {Math.round(animation.maxWidth)} x {Math.round(animation.maxHeight)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
          <div ref={viewportRef} className="viewer-stage">
            <div ref={canvasHostRef} className="viewer-canvas-host" />
            <div className={`viewer-placeholder${hasScene ? ' viewer-placeholder-hidden' : ''}`}>
              <p>Load local Spine assets to render the player.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="app-footer">With love from BEON</footer>
    </main>
  )
}

export default App
