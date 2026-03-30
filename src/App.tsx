import { useEffect, useRef, useState } from 'react'
import { Application, Assets, Graphics, ImageSource } from 'pixi.js'
import { Physics, Spine } from '@esotericsoftware/spine-pixi-v8'
import './App.css'

type SelectedFiles = {
  atlas: File | null
  skeleton: File | null
  images: File[]
}

type LoadedScene = {
  app: Application
  atlasInfo: AtlasInfo | null
  boundsOverlay: Graphics
  syncSceneMetrics: () => void
  spine: Spine
  animations: string[]
  assetKeys: string[]
}

type SpineSize = {
  canvasWidth: number
  canvasHeight: number
  realWidth: number
  realHeight: number
  realtimeWidth: number
  realtimeHeight: number
}

type AnimationSizeRange = {
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
}

type AtlasInfo = {
  pageHeight: number
  pageWidth: number
  scale: number | null
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
  const sizeLine = lines.find((line) => line.toLowerCase().startsWith('size:'))

  if (!sizeLine) {
    return null
  }

  const sizeMatch = sizeLine.match(/^size:\s*([0-9.]+)\s*,\s*([0-9.]+)$/i)

  if (!sizeMatch) {
    return null
  }

  const scaleLine = lines.find((line) => line.toLowerCase().startsWith('scale:'))
  const pageWidth = Number(sizeMatch[1])
  const pageHeight = Number(sizeMatch[2])
  const scale = scaleLine ? Number(scaleLine.replace(/^scale:\s*/i, '')) : null

  return {
    pageHeight,
    pageWidth,
    scale: Number.isFinite(scale) ? scale : null,
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

function drawBoundsOverlay(spine: Spine, boundsOverlay: Graphics | undefined, bounds = getSpineBounds(spine)) {
  boundsOverlay?.clear()

  if (!boundsOverlay || bounds.width <= 0 || bounds.height <= 0) {
    return bounds
  }

  const scaleX = spine.scale.x
  const scaleY = spine.scale.y

  boundsOverlay
    .rect(
      spine.position.x + bounds.x * scaleX,
      spine.position.y + bounds.y * scaleY,
      bounds.width * scaleX,
      bounds.height * scaleY,
    )
    .stroke({ alpha: 0.95, color: 0xffd166, width: 2 })

  return bounds
}

function updateSpineLayout(spine: Spine, width: number, height: number, boundsOverlay?: Graphics): SpineSize {
  const bounds = getSpineBounds(spine)

  if (bounds.width <= 0 || bounds.height <= 0) {
    spine.position.set(width * 0.5, height * 0.72)
    spine.scale.set(1)
    boundsOverlay?.clear()
    return {
      canvasHeight: height,
      canvasWidth: width,
      realHeight: 0,
      realWidth: 0,
      realtimeHeight: 0,
      realtimeWidth: 0,
    }
  }

  const centerX = bounds.x + bounds.width * 0.5
  const centerY = bounds.y + bounds.height * 0.5
  const scale = Math.min(1, width / bounds.width, height / bounds.height)

  spine.scale.set(scale)
  spine.position.set(width * 0.5 - centerX * scale, height * 0.5 - centerY * scale)
  drawBoundsOverlay(spine, boundsOverlay, bounds)

  return {
    canvasHeight: height,
    canvasWidth: width,
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
  onSizeChange?: (size: SpineSize) => void,
  onFpsChange?: (fps: number) => void,
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
    const boundsOverlay = new Graphics()
    let lastFpsUpdate = 0
    const syncSceneMetrics = () => {
      onSizeChange?.(updateSpineLayout(spine, app.screen.width, app.screen.height, boundsOverlay))

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
    app.stage.addChild(boundsOverlay)
    onSizeChange?.(updateSpineLayout(spine, app.screen.width, app.screen.height, boundsOverlay))
    onFpsChange?.(Math.round(app.ticker.FPS))
    app.ticker.add(syncSceneMetrics)

    app.renderer.on('resize', () => {
      onSizeChange?.(updateSpineLayout(spine, app.screen.width, app.screen.height, boundsOverlay))
    })

    return { app, atlasInfo, boundsOverlay, syncSceneMetrics, spine, animations, assetKeys }
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
  scene.app.stage.removeChild(scene.boundsOverlay)
  scene.app.stage.removeChild(scene.spine)
  scene.boundsOverlay.destroy()
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
  const [timeScale, setTimeScale] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Upload Spine files and press Load demo.')
  const [fps, setFps] = useState<number | null>(null)
  const [hasScene, setHasScene] = useState(false)
  const [spineSize, setSpineSize] = useState<SpineSize | null>(null)
  const [animationSizeRange, setAnimationSizeRange] = useState<AnimationSizeRange | null>(null)
  const [atlasInfo, setAtlasInfo] = useState<AtlasInfo | null>(null)
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
    if (!spineSize || spineSize.realWidth <= 0 || spineSize.realHeight <= 0) {
      return
    }

    setAnimationSizeRange((current) =>
      current
        ? {
            maxHeight: Math.max(current.maxHeight, spineSize.realHeight),
            maxWidth: Math.max(current.maxWidth, spineSize.realWidth),
            minHeight: Math.min(current.minHeight, spineSize.realHeight),
            minWidth: Math.min(current.minWidth, spineSize.realWidth),
          }
        : {
            maxHeight: spineSize.realHeight,
            maxWidth: spineSize.realWidth,
            minHeight: spineSize.realHeight,
            minWidth: spineSize.realWidth,
          },
    )
  }, [spineSize])

  function updateAnimation(animationName: string, shouldLoop: boolean) {
    const scene = sceneRef.current

    if (!scene || !animationName) {
      return
    }

    scene.spine.state.setAnimation(0, animationName, shouldLoop)
    setAnimationSizeRange(null)
    setSpineSize(
      updateSpineLayout(scene.spine, scene.app.screen.width, scene.app.screen.height, scene.boundsOverlay),
    )
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
      setAtlasInfo(null)
      setAnimationSizeRange(null)
      setHasScene(false)
      setFps(null)
    }

    try {
      const scene = await loadScene(
        files,
        viewportRef.current,
        canvasHostRef.current,
        setSpineSize,
        setFps,
      )
      const firstAnimation = scene.animations[0] ?? ''

      scene.spine.state.timeScale = timeScale
      sceneRef.current = scene
      setAtlasInfo(scene.atlasInfo)
      setAnimationSizeRange(null)
      setHasScene(true)
      setAnimations(scene.animations)
      setSelectedAnimation(firstAnimation)
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
      setSelectedAnimation('')
      setAtlasInfo(null)
      setFps(null)
      setHasScene(false)
      setAnimationSizeRange(null)
      setSpineSize(null)
      setError(message)
      setStatus('Load failed.')
    } finally {
      setLoading(false)
    }
  }

  const canLoad = Boolean(files.atlas && files.skeleton && files.images.length > 0) && !loading
  const atlasAdjustedWidth =
    spineSize && atlasInfo?.scale ? spineSize.realWidth * atlasInfo.scale : null
  const atlasAdjustedHeight =
    spineSize && atlasInfo?.scale ? spineSize.realHeight * atlasInfo.scale : null

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
            <span>Animation speed</span>
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
        </aside>

        <div className="viewer-panel">
          <div className="viewer-chrome">
            <div className="viewer-heading">
              <span className="viewer-kicker">Active Animation</span>
              <strong>{selectedAnimation || 'idle'}</strong>
            </div>
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
                <span className="viewer-stat-label">Rendered Size</span>
                <strong className="viewer-stat-value">
                  {spineSize
                    ? `${Math.round(spineSize.realtimeWidth)} x ${Math.round(spineSize.realtimeHeight)} px`
                    : 'Unavailable'}
                </strong>
              </div>
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
                <span className="viewer-stat-label">Atlas-Adjusted</span>
                <strong className="viewer-stat-value">
                  {atlasAdjustedWidth !== null && atlasAdjustedHeight !== null
                    ? `${Math.round(atlasAdjustedWidth)} x ${Math.round(atlasAdjustedHeight)} px`
                    : 'Unavailable'}
                </strong>
              </div>
              <div className="viewer-stat">
                <span className="viewer-stat-label">Canvas Size</span>
                <strong className="viewer-stat-value">
                  {spineSize
                    ? `${Math.round(spineSize.canvasWidth)} x ${Math.round(spineSize.canvasHeight)} px`
                    : 'Unavailable'}
                </strong>
              </div>
              <div className="viewer-stat">
                <span className="viewer-stat-label">Min Skeleton</span>
                <strong className="viewer-stat-value">
                  {animationSizeRange
                    ? `${Math.round(animationSizeRange.minWidth)} x ${Math.round(animationSizeRange.minHeight)} px`
                    : 'Unavailable'}
                </strong>
              </div>
              <div className="viewer-stat">
                <span className="viewer-stat-label">Max Skeleton</span>
                <strong className="viewer-stat-value">
                  {animationSizeRange
                    ? `${Math.round(animationSizeRange.maxWidth)} x ${Math.round(animationSizeRange.maxHeight)} px`
                    : 'Unavailable'}
                </strong>
              </div>
              <div className="viewer-stat viewer-stat-fps">
                <span className="viewer-stat-label">FPS</span>
                <strong className="viewer-stat-value">{fps === null ? 'Unavailable' : fps}</strong>
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
