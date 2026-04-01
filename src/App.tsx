import { useEffect, useRef, useState } from 'react';
import { Assets, Graphics, ImageSource, type Application } from 'pixi.js';
import { Physics, Spine, SkinsAndAnimationBoundsProvider } from '@esotericsoftware/spine-pixi-v8';
import { IntakePanel } from './components/spine-player/intake-panel';
import { WorkspacePanel } from './components/spine-player/workspace-panel';
import type {
  AnimationSummary,
  AtlasInfo,
  LoadedScene,
  PlaybackInfo,
  RenderedSizeRange,
  SceneInfo,
  SelectedFiles,
  SpineSize,
  StageBackgroundMode,
} from './components/spine-player/types';

const DEFAULT_USER_SCALE = 1;

function createAssetUrl(file: File) {
  return URL.createObjectURL(file);
}

function revokeAssetUrls(urls: string[]) {
  for (const url of urls) {
    URL.revokeObjectURL(url);
  }
}

function createAssetKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function loadImageSource(file: File) {
  const objectUrl = createAssetUrl(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Failed to load image "${file.name}".`));
      element.src = objectUrl;
    });

    return new ImageSource({ resource: image });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getAtlasPageNames(atlasText: string) {
  const lines = atlasText.split(/\r\n|\r|\n/);
  const pages: string[] = [];
  let expectingPageName = true;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      expectingPageName = true;
      continue;
    }

    if (expectingPageName && !line.includes(':')) {
      pages.push(line);
      expectingPageName = false;
    }
  }

  return pages;
}

function parseAtlasInfo(atlasText: string): AtlasInfo | null {
  const lines = atlasText.split(/\r\n|\r|\n/).map((line) => line.trim());
  let mode: 'pageHeader' | 'pageMeta' | 'regionMeta' = 'pageHeader';
  let firstPageWidth = 0;
  let firstPageHeight = 0;
  let pageCount = 0;
  let regionCount = 0;
  let scale: number | null = null;
  let totalPageArea = 0;
  let usedArea = 0;

  for (const line of lines) {
    if (!line) {
      mode = 'pageHeader';
      continue;
    }

    if (mode === 'pageHeader') {
      pageCount += 1;
      mode = 'pageMeta';
      continue;
    }

    if (mode === 'pageMeta') {
      if (!line.includes(':')) {
        regionCount += 1;
        mode = 'regionMeta';
        continue;
      }

      const sizeMatch = line.match(/^size:\s*([0-9.]+)\s*,\s*([0-9.]+)$/i);

      if (sizeMatch) {
        const pageWidth = Number(sizeMatch[1]);
        const pageHeight = Number(sizeMatch[2]);

        if (firstPageWidth === 0 && firstPageHeight === 0) {
          firstPageWidth = pageWidth;
          firstPageHeight = pageHeight;
        }

        totalPageArea += pageWidth * pageHeight;
        continue;
      }

      const scaleMatch = line.match(/^scale:\s*([0-9.]+)$/i);

      if (scaleMatch) {
        const nextScale = Number(scaleMatch[1]);

        scale = Number.isFinite(nextScale) ? nextScale : scale;
      }

      continue;
    }

    if (!line.includes(':')) {
      regionCount += 1;
      continue;
    }

    const boundsMatch = line.match(/^bounds:\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)$/i);

    if (boundsMatch) {
      usedArea += Number(boundsMatch[1]) * Number(boundsMatch[2]);
    }
  }

  if (firstPageWidth <= 0 || firstPageHeight <= 0) {
    return null;
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
  };
}

function classifyFiles(fileList: FileList | File[]) {
  let atlas: File | null = null;
  let skeleton: File | null = null;
  const images: File[] = [];

  for (const file of Array.from(fileList)) {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.atlas')) {
      atlas = file;
      continue;
    }

    if (lowerName.endsWith('.skel')) {
      skeleton = file;
      continue;
    }

    if (lowerName.endsWith('.png')) {
      images.push(file);
    }
  }

  return { atlas, skeleton, images };
}

function getSpineBounds(spine: Spine) {
  spine.skeleton.updateWorldTransform(Physics.update);

  const bounds = spine.skeleton.getBoundsRect();

  return bounds.width === Number.NEGATIVE_INFINITY
    ? { x: 0, y: 0, width: 0, height: 0 }
    : bounds;
}

function computePlaybackInfo(spine: Spine): PlaybackInfo {
  const entry = spine.state.getCurrent(0);

  if (!entry || !entry.animation) {
    return {
      currentTime: 0,
      duration: 0,
      loopCount: 0,
      progress: 0,
    };
  }

  const duration = Math.max(entry.animationEnd - entry.animationStart, entry.animation.duration, 0);
  const currentTime = entry.getAnimationTime();
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const loopCount = entry.loop && duration > 0 ? Math.floor(entry.trackTime / duration) : Number(entry.isComplete());

  return {
    currentTime,
    duration,
    loopCount,
    progress,
  };
}

function computeAnimationSummaries(spine: Spine): AnimationSummary[] {
  return spine.skeleton.data.animations.map((animation) => {
    const maxBounds = new SkinsAndAnimationBoundsProvider(animation.name, [], 0.1, false).calculateBounds(spine);
    const duration = animation.duration;
    const sampleCount = duration > 0 ? Math.max(2, Math.min(90, Math.ceil(duration * 30))) : 1;
    let minWidth = Number.POSITIVE_INFINITY;
    let minHeight = Number.POSITIVE_INFINITY;

    for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
      const sampleTime = duration > 0 ? (duration * sampleIndex) / sampleCount : 0;

      spine.state.clearTracks();
      spine.skeleton.setToSetupPose();
      spine.state.setAnimation(0, animation.name, false);

      const entry = spine.state.getCurrent(0);

      if (!entry) {
        continue;
      }

      entry.trackTime = sampleTime;
      spine.state.apply(spine.skeleton);

      const bounds = getSpineBounds(spine);

      minWidth = Math.min(minWidth, bounds.width);
      minHeight = Math.min(minHeight, bounds.height);
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
    };
  });
}

function getDisplayedScale(
  boundsWidth: number,
  boundsHeight: number,
  requestedScale = 1,
) {
  const normalizedRequestedScale = requestedScale > 0 ? requestedScale : 1;

  if (boundsWidth <= 0 || boundsHeight <= 0) {
    return normalizedRequestedScale;
  }

  return normalizedRequestedScale;
}

function drawAnimationBoundsBorder(
  debugBounds: Graphics | null,
  bounds: { x: number; y: number; width: number; height: number },
  position: { x: number; y: number },
  scale: number,
) {
  if (!debugBounds) {
    return;
  }

  debugBounds.clear();

  if (bounds.width <= 0 || bounds.height <= 0) {
    return;
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
    });
}

function drawAnchorDot(
  debugAnchor: Graphics | null,
  anchorPosition: { x: number; y: number },
  scale: number,
) {
  if (!debugAnchor) {
    return;
  }

  debugAnchor.clear();

  const radius = Math.max(3, Math.min(6, 4 / Math.max(scale, 0.001)));
  const crosshair = radius * 2.2;

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
    });
}

function updateSpineLayout(
  spine: Spine,
  width: number,
  height: number,
  requestedScale = 1,
  debugBounds: Graphics | null = null,
  debugAnchor: Graphics | null = null,
  debugEnabled = true,
  layoutBounds?: { x: number; y: number; width: number; height: number } | null,
): SpineSize {
  const bounds = getSpineBounds(spine);
  const anchorBounds = layoutBounds && layoutBounds.width > 0 && layoutBounds.height > 0 ? layoutBounds : bounds;
  const normalizedRequestedScale = requestedScale > 0 ? requestedScale : 1;

  if (debugBounds) {
    debugBounds.visible = debugEnabled;
  }

  if (debugAnchor) {
    debugAnchor.visible = debugEnabled;
  }

  if (anchorBounds.width <= 0 || anchorBounds.height <= 0) {
    spine.position.set(width * 0.5, height * 0.72);
    spine.scale.set(normalizedRequestedScale);
    if (debugEnabled) {
      drawAnimationBoundsBorder(debugBounds, bounds, spine.position, normalizedRequestedScale);
      drawAnchorDot(debugAnchor, spine.position, normalizedRequestedScale);
    } else {
      debugBounds?.clear();
      debugAnchor?.clear();
    }
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
    };
  }

  const centerX = anchorBounds.x + anchorBounds.width * 0.5;
  const centerY = anchorBounds.y + anchorBounds.height * 0.5;
  const scale = getDisplayedScale(anchorBounds.width, anchorBounds.height, normalizedRequestedScale);

  spine.scale.set(scale);
  spine.position.set(width * 0.5 - centerX * scale, height * 0.5 - centerY * scale);
  if (debugEnabled) {
    drawAnimationBoundsBorder(debugBounds, bounds, spine.position, scale);
    drawAnchorDot(debugAnchor, spine.position, scale);
  } else {
    debugBounds?.clear();
    debugAnchor?.clear();
  }

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
  };
}

async function loadScene(
  files: SelectedFiles,
  app: Application,
  requestedScale = DEFAULT_USER_SCALE,
  onSizeChange?: (size: SpineSize) => void,
  onFpsChange?: (fps: number) => void,
  onPlaybackChange?: (playback: PlaybackInfo) => void,
): Promise<LoadedScene> {
  if (!files.atlas || !files.skeleton || files.images.length === 0) {
    throw new Error('Select an .atlas, a .skel skeleton, and at least one .png image.');
  }

  const tempUrls: string[] = [];
  const assetKeys: string[] = [];

  try {
    const atlasText = await files.atlas.text();
    const atlasInfo = parseAtlasInfo(atlasText);
    const atlasPageNames = getAtlasPageNames(atlasText);
    const skeletonUrl = createAssetUrl(files.skeleton);
    const atlasUrl = createAssetUrl(files.atlas);
    const skeletonAssetKey = createAssetKey('spine-skeleton');
    const atlasAssetKey = createAssetKey('spine-atlas');
    const pageTextures: Record<string, ImageSource> = {};

    tempUrls.push(skeletonUrl, atlasUrl);
    assetKeys.push(skeletonAssetKey, atlasAssetKey);

    for (const image of files.images) {
      pageTextures[image.name] = await loadImageSource(image);
    }

    if (files.images.length === 1) {
      const firstTexture = pageTextures[files.images[0].name];

      for (const pageName of atlasPageNames) {
        if (!pageTextures[pageName]) {
          pageTextures[pageName] = firstTexture;
        }
      }
    } else {
      for (const pageName of atlasPageNames) {
        if (!pageTextures[pageName]) {
          throw new Error(
            `Missing PNG for atlas page "${pageName}". Upload the exact image referenced by the atlas.`,
          );
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
    ]);

    const spine = Spine.from({
      atlas: atlasAssetKey,
      autoUpdate: true,
      skeleton: skeletonAssetKey,
      ticker: app.ticker,
    });
    const debugAnchor = new Graphics();
    const debugBounds = new Graphics();
    const animationSummaries = computeAnimationSummaries(spine);
    const getAnimationLayoutBounds = (animationName: string) => {
      const summary = animationSummaries.find((item) => item.name === animationName);

      if (!summary) {
        return null;
      }

      return {
        height: summary.layoutHeight,
        width: summary.layoutWidth,
        x: summary.layoutOriginX,
        y: summary.layoutOriginY,
      };
    };
    const requestedScaleState = { value: requestedScale };
    const debugEnabledState = { value: true };
    let lastFpsUpdate = 0;

    const syncSceneMetrics = () => {
      const activeAnimation = spine.state.getCurrent(0)?.animation?.name ?? '';

      onSizeChange?.(
        updateSpineLayout(
          spine,
          app.screen.width,
          app.screen.height,
          requestedScaleState.value,
          debugBounds,
          debugAnchor,
          debugEnabledState.value,
          getAnimationLayoutBounds(activeAnimation),
        ),
      );
      onPlaybackChange?.(computePlaybackInfo(spine));

      const now = performance.now();

      if (now - lastFpsUpdate >= 250) {
        onFpsChange?.(Math.round(app.ticker.FPS));
        lastFpsUpdate = now;
      }
    };

    const animations = spine.skeleton.data.animations.map((animation) => animation.name);

    if (animations.length > 0) {
      spine.state.setAnimation(0, animations[0], true);
    }

    onSizeChange?.(
      updateSpineLayout(
        spine,
        app.screen.width,
        app.screen.height,
        requestedScaleState.value,
        debugBounds,
        debugAnchor,
        debugEnabledState.value,
        getAnimationLayoutBounds(animations[0] ?? ''),
      ),
    );
    onFpsChange?.(Math.round(app.ticker.FPS));
    onPlaybackChange?.(computePlaybackInfo(spine));
    app.ticker.add(syncSceneMetrics);

    const handleResize = () => {
      onSizeChange?.(
        updateSpineLayout(
          spine,
          app.screen.width,
          app.screen.height,
          requestedScaleState.value,
          debugBounds,
          debugAnchor,
          debugEnabledState.value,
          getAnimationLayoutBounds(spine.state.getCurrent(0)?.animation?.name ?? ''),
        ),
      );
    };

    app.renderer.on('resize', handleResize);

    return {
      app,
      animationSummaries,
      atlasInfo,
      assetKeys,
      debugEnabled: debugEnabledState,
      debugAnchor,
      debugBounds,
      handleResize,
      getAnimationLayoutBounds,
      requestedScale: requestedScaleState,
      syncSceneMetrics,
      spine,
      animations,
    };
  } catch (error) {
    for (const assetKey of assetKeys) {
      void Assets.unload(assetKey);
    }

    throw error;
  } finally {
    revokeAssetUrls(tempUrls);
  }
}

function destroyScene(scene: LoadedScene | null) {
  if (!scene) {
    return;
  }

  scene.spine.autoUpdate = false;
  scene.app.ticker.remove(scene.syncSceneMetrics);
  scene.app.renderer.off('resize', scene.handleResize);
  scene.debugAnchor.parent?.removeChild(scene.debugAnchor);
  scene.debugAnchor.destroy();
  scene.debugBounds.parent?.removeChild(scene.debugBounds);
  scene.debugBounds.destroy();
  scene.spine.parent?.removeChild(scene.spine);
  scene.spine.destroy();

  for (const assetKey of scene.assetKeys) {
    void Assets.unload(assetKey);
  }
}

function App() {
  const assetBaseUrl = import.meta.env.BASE_URL;
  const [files, setFiles] = useState<SelectedFiles>({
    atlas: null,
    skeleton: null,
    images: [],
  });
  const [animations, setAnimations] = useState<string[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState('');
  const [loop, setLoop] = useState(true);
  const [showDebugGuides, setShowDebugGuides] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [userScale, setUserScale] = useState(DEFAULT_USER_SCALE);
  const [timeScale, setTimeScale] = useState(1);
  const [stageBackgroundMode, setStageBackgroundMode] = useState<StageBackgroundMode>('checkerboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Upload Spine files and press Load demo.');
  const [fps, setFps] = useState<number | null>(null);
  const [hasScene, setHasScene] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [spineSize, setSpineSize] = useState<SpineSize | null>(null);
  const [animationSummaries, setAnimationSummaries] = useState<AnimationSummary[]>([]);
  const [atlasInfo, setAtlasInfo] = useState<AtlasInfo | null>(null);
  const [playbackInfo, setPlaybackInfo] = useState<PlaybackInfo | null>(null);
  const [renderedSizeRange, setRenderedSizeRange] = useState<RenderedSizeRange | null>(null);
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const sceneRef = useRef<LoadedScene | null>(null);

  useEffect(() => {
    return () => {
      destroyScene(sceneRef.current);
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!spineSize || spineSize.realtimeWidth <= 0 || spineSize.realtimeHeight <= 0) {
      return;
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
    );
  }, [spineSize]);

  async function waitForPixiApp(maxFrames = 12) {
    for (let frame = 0; frame < maxFrames; frame += 1) {
      if (pixiAppRef.current) {
        return pixiAppRef.current;
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }

    return null;
  }

  function updateAnimation(animationName: string, shouldLoop: boolean) {
    const scene = sceneRef.current;

    if (!scene || !animationName) {
      return;
    }

    scene.spine.state.setAnimation(0, animationName, shouldLoop);
    scene.spine.state.timeScale = isPaused ? 0 : timeScale;
    setPlaybackInfo(null);
    setRenderedSizeRange(null);
    const nextSpineSize = updateSpineLayout(
      scene.spine,
      scene.app.screen.width,
      scene.app.screen.height,
      userScale,
      scene.debugBounds,
      scene.debugAnchor,
      scene.debugEnabled.value,
      scene.getAnimationLayoutBounds(animationName),
    );

    setSpineSize(nextSpineSize);
    setPlaybackInfo(computePlaybackInfo(scene.spine));
    setSelectedAnimation(animationName);
  }

  function updateTimeScale(nextTimeScale: number) {
    const scene = sceneRef.current;

    setTimeScale(nextTimeScale);

    if (!scene) {
      return;
    }

    scene.spine.state.timeScale = isPaused ? 0 : nextTimeScale;
  }

  function togglePause() {
    const scene = sceneRef.current;
    const nextPaused = !isPaused;

    setIsPaused(nextPaused);

    if (!scene) {
      return;
    }

    scene.spine.state.timeScale = nextPaused ? 0 : timeScale;
    scene.syncSceneMetrics();
  }

  function restartAnimation() {
    const scene = sceneRef.current;

    if (!scene || !selectedAnimation) {
      return;
    }

    scene.spine.state.setAnimation(0, selectedAnimation, loop);
    scene.spine.state.timeScale = isPaused ? 0 : timeScale;
    setRenderedSizeRange(null);
    scene.syncSceneMetrics();
    setPlaybackInfo(computePlaybackInfo(scene.spine));
  }

  function stepFrame(direction: -1 | 1) {
    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    const entry = scene.spine.state.getCurrent(0);

    if (!entry || !entry.animation) {
      return;
    }

    const fpsStep = sceneInfo?.dopesheetFps && sceneInfo.dopesheetFps > 0 ? sceneInfo.dopesheetFps : 60;
    const frameDelta = 1 / fpsStep;
    const duration = Math.max(entry.animationEnd - entry.animationStart, entry.animation.duration, 0);
    let nextTrackTime = entry.trackTime + direction * frameDelta;

    if (duration > 0) {
      if (entry.loop) {
        nextTrackTime = ((nextTrackTime % duration) + duration) % duration;
      } else {
        nextTrackTime = Math.min(duration, Math.max(0, nextTrackTime));
      }
    } else {
      nextTrackTime = Math.max(0, nextTrackTime);
    }

    setIsPaused(true);
    scene.spine.state.timeScale = 0;
    entry.trackTime = nextTrackTime;
    scene.spine.state.apply(scene.spine.skeleton);
    scene.spine.skeleton.updateWorldTransform(Physics.update);
    scene.syncSceneMetrics();
    setPlaybackInfo(computePlaybackInfo(scene.spine));
  }

  function seekFrame(frame: number) {
    const scene = sceneRef.current;

    if (!scene) {
      return;
    }

    const entry = scene.spine.state.getCurrent(0);

    if (!entry || !entry.animation) {
      return;
    }

    const fpsStep = sceneInfo?.dopesheetFps && sceneInfo.dopesheetFps > 0 ? sceneInfo.dopesheetFps : 60;
    const duration = Math.max(entry.animationEnd - entry.animationStart, entry.animation.duration, 0);
    const maxFrame = duration > 0 ? Math.max(0, Math.round(duration * fpsStep)) : 0;
    const nextFrame = Math.min(maxFrame, Math.max(0, Math.round(frame)));
    const nextTrackTime = fpsStep > 0 ? nextFrame / fpsStep : 0;

    setIsPaused(true);
    scene.spine.state.timeScale = 0;
    entry.trackTime = duration > 0 ? Math.min(duration, Math.max(0, nextTrackTime)) : 0;
    scene.spine.state.apply(scene.spine.skeleton);
    scene.spine.skeleton.updateWorldTransform(Physics.update);
    scene.syncSceneMetrics();
    setPlaybackInfo(computePlaybackInfo(scene.spine));
  }

  function updateUserScale(nextScale: number) {
    const scene = sceneRef.current;
    const normalizedScale = Number.isFinite(nextScale) && nextScale > 0 ? nextScale : DEFAULT_USER_SCALE;

    setUserScale(normalizedScale);

    if (!scene) {
      return;
    }

    scene.requestedScale.value = normalizedScale;

    setSpineSize(
      updateSpineLayout(
        scene.spine,
        scene.app.screen.width,
        scene.app.screen.height,
        normalizedScale,
        scene.debugBounds,
        scene.debugAnchor,
        scene.debugEnabled.value,
        scene.getAnimationLayoutBounds(selectedAnimation),
      ),
    );
  }

  function updateDebugGuides(nextValue: boolean) {
    const scene = sceneRef.current;

    setShowDebugGuides(nextValue);

    if (!scene) {
      return;
    }

    scene.debugEnabled.value = nextValue;

    setSpineSize(
      updateSpineLayout(
        scene.spine,
        scene.app.screen.width,
        scene.app.screen.height,
        scene.requestedScale.value,
        scene.debugBounds,
        scene.debugAnchor,
        nextValue,
        scene.getAnimationLayoutBounds(selectedAnimation),
      ),
    );
  }

  function handleBackToIntake() {
    const scene = sceneRef.current;

    if (scene) {
      destroyScene(scene);
      sceneRef.current = null;
    }

    setAnimations([]);
    setAnimationSummaries([]);
    setAtlasInfo(null);
    setFps(null);
    setHasScene(false);
    setPlaybackInfo(null);
    setRenderedSizeRange(null);
    setSceneInfo(null);
    setSelectedAnimation('');
    setShowWorkspace(false);
    setSpineSize(null);
    setStatus('Upload Spine files and press Load demo.');
    setShowDebugGuides(true);
    setIsPaused(false);
    setUserScale(DEFAULT_USER_SCALE);
  }

  function applyCombinedFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const nextFiles = classifyFiles(fileList);

    setFiles((current) => ({
      atlas: nextFiles.atlas ?? current.atlas,
      skeleton: nextFiles.skeleton ?? current.skeleton,
      images: nextFiles.images.length > 0 ? nextFiles.images : current.images,
    }));
  }

  async function handleLoad() {
    if (!showWorkspace) {
      setShowWorkspace(true);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const app = await waitForPixiApp();

    if (!viewportRef.current || !app) {
      setError('Unable to prepare the Pixi stage.');
      setStatus('Load failed.');
      setShowWorkspace(false);
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Loading Spine skeleton...');

    const previousScene = sceneRef.current;

    if (previousScene) {
      destroyScene(previousScene);
      sceneRef.current = null;
      setAnimationSummaries([]);
      setAtlasInfo(null);
      setHasScene(false);
      setFps(null);
      setPlaybackInfo(null);
      setRenderedSizeRange(null);
      setSceneInfo(null);
      setShowDebugGuides(true);
      setIsPaused(false);
      setUserScale(DEFAULT_USER_SCALE);
    }

    try {
      const scene = await loadScene(
        files,
        app,
        files.atlas ? parseAtlasInfo(await files.atlas.text())?.scale ?? DEFAULT_USER_SCALE : DEFAULT_USER_SCALE,
        setSpineSize,
        setFps,
        setPlaybackInfo,
      );
      const firstAnimation = scene.animations[0] ?? '';
      const nextUserScale = scene.atlasInfo?.scale ?? DEFAULT_USER_SCALE;

      scene.spine.state.timeScale = timeScale;
      sceneRef.current = scene;
      setAnimationSummaries(scene.animationSummaries);
      setAtlasInfo(scene.atlasInfo);
      setHasScene(true);
      setRenderedSizeRange(null);
      setAnimations(scene.animations);
      setSelectedAnimation(firstAnimation);
      setUserScale(nextUserScale);
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
      });
      setLoop(true);
      setIsPaused(false);
      setShowDebugGuides(true);
      setStatus(
        scene.animations.length > 0
          ? `Loaded ${scene.animations.length} animation${scene.animations.length === 1 ? '' : 's'}.`
          : 'Skeleton loaded with no animations in the file.',
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Failed to load Spine assets.';

      setAnimations([]);
      setAnimationSummaries([]);
      setSelectedAnimation('');
      setAtlasInfo(null);
      setFps(null);
      setHasScene(false);
      setPlaybackInfo(null);
      setRenderedSizeRange(null);
      setSceneInfo(null);
      setShowDebugGuides(true);
      setIsPaused(false);
      setSpineSize(null);
      setUserScale(DEFAULT_USER_SCALE);
      setError(message);
      setStatus('Load failed.');
      setShowWorkspace(false);
      console.error(caughtError);
    } finally {
      setLoading(false);
    }
  }

  const canLoad = Boolean(files.atlas && files.skeleton && files.images.length > 0) && !loading;
  const selectedAnimationSummary =
    animationSummaries.find((summary) => summary.name === selectedAnimation) ?? null;
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
      : null;
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
      : null;
  const safeContainerSize =
    animationSummaries.length > 0
      ? {
          height: Math.max(...animationSummaries.map((summary) => summary.maxHeight * userScale)),
          width: Math.max(...animationSummaries.map((summary) => summary.maxWidth * userScale)),
        }
      : null;
  const defaultScale = atlasInfo?.scale ?? DEFAULT_USER_SCALE;

  return (
    <main className="relative min-h-svh px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(34,197,94,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_26%)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {!showWorkspace ? (
          <IntakePanel
            files={files}
            status={status}
            error={error}
            canLoad={canLoad}
            loading={loading}
            onApplyCombinedFiles={applyCombinedFiles}
            onAtlasSelected={(selectedFiles) =>
              setFiles((current) => ({
                ...current,
                atlas: Array.from(selectedFiles)[0] ?? null,
              }))
            }
            onSkeletonSelected={(selectedFiles) =>
              setFiles((current) => ({
                ...current,
                skeleton: Array.from(selectedFiles)[0] ?? null,
              }))
            }
            onImagesSelected={(selectedFiles) =>
              setFiles((current) => ({
                ...current,
                images: Array.from(selectedFiles),
              }))
            }
            onLoad={() => {
              void handleLoad();
            }}
          />
        ) : (
          <WorkspacePanel
            viewportRef={viewportRef}
            scene={sceneRef.current}
            onPixiAppInit={(app) => {
              pixiAppRef.current = app;
            }}
            hasScene={hasScene}
            loop={loop}
            selectedAnimation={selectedAnimation}
            showDebugGuides={showDebugGuides}
            isPaused={isPaused}
            timeScale={timeScale}
            userScale={userScale}
            defaultScale={defaultScale}
            stageBackgroundMode={stageBackgroundMode}
            atlasInfo={atlasInfo}
            animationSummaries={animationSummaries}
            animations={animations}
            fps={fps}
            playbackInfo={playbackInfo}
            renderedSizeRange={renderedSizeRange}
            spineSize={spineSize}
            selectedAnimationSummary={selectedAnimationSummary}
            minSkeletonScaled={minSkeletonScaled}
            maxSkeletonScaled={maxSkeletonScaled}
            safeContainerSize={safeContainerSize}
            sceneInfo={sceneInfo}
            onBack={handleBackToIntake}
            onLoopChange={(nextLoop) => {
              setLoop(nextLoop);
              updateAnimation(selectedAnimation, nextLoop);
            }}
            onDebugGuidesChange={updateDebugGuides}
            onPauseToggle={togglePause}
            onRestart={restartAnimation}
            onStepFrame={stepFrame}
            onSeekFrame={seekFrame}
            onTimeScaleChange={updateTimeScale}
            onUserScaleChange={updateUserScale}
            onStageBackgroundModeChange={setStageBackgroundMode}
            onAnimationSelect={(animationName) => updateAnimation(animationName, loop)}
          />
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
  );
}

export default App;
