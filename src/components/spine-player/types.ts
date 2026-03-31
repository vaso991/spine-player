import type { Application, Graphics } from 'pixi.js'
import type { Spine } from '@esotericsoftware/spine-pixi-v8'

export type SelectedFiles = {
  atlas: File | null
  skeleton: File | null
  images: File[]
}

export type AnimationSummary = {
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

export type LoadedScene = {
  app: Application
  animationSummaries: AnimationSummary[]
  atlasInfo: AtlasInfo | null
  debugEnabled: {
    value: boolean
  }
  debugAnchor: Graphics
  debugBounds: Graphics
  handleResize: () => void
  getAnimationLayoutBounds: (
    animationName: string,
  ) => { x: number; y: number; width: number; height: number } | null
  requestedScale: {
    value: number
  }
  syncSceneMetrics: () => void
  spine: Spine
  animations: string[]
  assetKeys: string[]
}

export type SpineSize = {
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

export type AtlasInfo = {
  pageHeight: number
  pageCount: number
  pageWidth: number
  regionCount: number
  scale: number | null
  textureMemoryBytes: number
  totalPageArea: number
  usedArea: number
}

export type PlaybackInfo = {
  currentTime: number
  duration: number
  loopCount: number
  progress: number
}

export type RenderedSizeRange = {
  minHeight: number
  minWidth: number
  maxHeight: number
  maxWidth: number
}

export type SceneInfo = {
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

export type StageBackgroundMode = 'checkerboard' | 'dark' | 'transparent'
