import { useEffect, useRef, useState } from 'react'
import { Application, Assets, ImageSource } from 'pixi.js'
import { SetupPoseBoundsProvider, Spine } from '@esotericsoftware/spine-pixi-v8'
import './App.css'

type SelectedFiles = {
  atlas: File | null
  skeleton: File | null
  images: File[]
}

type LoadedScene = {
  app: Application
  spine: Spine
  animations: string[]
  assetKeys: string[]
}

type SpineSize = {
  canvasWidth: number
  canvasHeight: number
  realWidth: number
  realHeight: number
}

const VIEWPORT_PADDING = 0.82

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

function fitSpineToViewport(spine: Spine, width: number, height: number): SpineSize {
  const bounds = new SetupPoseBoundsProvider(true).calculateBounds(spine)

  if (bounds.width <= 0 || bounds.height <= 0) {
    spine.position.set(width * 0.5, height * 0.72)
    spine.scale.set(1)
    return {
      canvasHeight: height,
      canvasWidth: width,
      realHeight: 0,
      realWidth: 0,
    }
  }

  const scale = Math.min(width / bounds.width, height / bounds.height) * VIEWPORT_PADDING
  const centerX = bounds.x + bounds.width * 0.5
  const centerY = bounds.y + bounds.height * 0.5

  spine.scale.set(scale)
  spine.position.set(width * 0.5 - centerX * scale, height * 0.5 - centerY * scale)

  return {
    canvasHeight: height,
    canvasWidth: width,
    realHeight: bounds.height,
    realWidth: bounds.width,
  }
}

async function loadScene(
  files: SelectedFiles,
  host: HTMLDivElement,
  onSizeChange?: (size: SpineSize) => void,
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

  host.replaceChildren(app.canvas)

  const tempUrls: string[] = []
  const assetKeys: string[] = []

  try {
    const atlasText = await files.atlas.text()
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

    const animations = spine.skeleton.data.animations.map((animation) => animation.name)

    if (animations.length > 0) {
      spine.state.setAnimation(0, animations[0], true)
    }

    app.stage.addChild(spine)
    onSizeChange?.(fitSpineToViewport(spine, app.screen.width, app.screen.height))

    app.renderer.on('resize', () => {
      onSizeChange?.(fitSpineToViewport(spine, app.screen.width, app.screen.height))
    })

    return { app, spine, animations, assetKeys }
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
  const [timeScale, setTimeScale] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Upload Spine files and press Load demo.')
  const [spineSize, setSpineSize] = useState<SpineSize | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<LoadedScene | null>(null)

  useEffect(() => {
    return () => {
      destroyScene(sceneRef.current)
      sceneRef.current = null
    }
  }, [])

  function updateAnimation(animationName: string, shouldLoop: boolean) {
    const scene = sceneRef.current

    if (!scene || !animationName) {
      return
    }

    scene.spine.state.setAnimation(0, animationName, shouldLoop)
    setSpineSize(fitSpineToViewport(scene.spine, scene.app.screen.width, scene.app.screen.height))
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
    if (!viewportRef.current) {
      return
    }

    setLoading(true)
    setError('')
    setStatus('Loading Spine skeleton...')

    const previousScene = sceneRef.current

    if (previousScene) {
      destroyScene(previousScene)
      sceneRef.current = null
    }

    try {
      const scene = await loadScene(files, viewportRef.current, setSpineSize)
      const firstAnimation = scene.animations[0] ?? ''

      scene.spine.state.timeScale = timeScale
      sceneRef.current = scene
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
      setSpineSize(null)
      setError(message)
      setStatus('Load failed.')
    } finally {
      setLoading(false)
    }
  }

  const canLoad = Boolean(files.atlas && files.skeleton && files.images.length > 0) && !loading

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
            <span>{selectedAnimation || 'idle'}</span>
            <span className="viewer-size">
              {spineSize
                ? `Real size ${Math.round(spineSize.realWidth)} x ${Math.round(spineSize.realHeight)} px`
                : 'Real size unavailable'}
            </span>
            <span className="viewer-size">
              {spineSize
                ? `Canvas size ${Math.round(spineSize.canvasWidth)} x ${Math.round(spineSize.canvasHeight)} px`
                : 'Canvas size unavailable'}
            </span>
          </div>
          <div ref={viewportRef} className="viewer-stage">
            <div className="viewer-placeholder">
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
