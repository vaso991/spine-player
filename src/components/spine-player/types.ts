import type { Application, ColorMatrixFilter, Graphics } from 'pixi.js';
import type { Spine } from '@esotericsoftware/spine-pixi-v8';

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
  colorMatrixFilter: ColorMatrixFilter
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
  requestedFilters: {
    value: ColorFilterConfig
  }
  syncSceneMetrics: () => void
  spine: Spine
  animations: string[]
  assetKeys: string[]
}

export type ColorFilterId =
  | 'brightness'
  | 'contrast'
  | 'grayscale'
  | 'hue'
  | 'saturation'
  | 'tint'
  | 'blackAndWhite'
  | 'desaturate'
  | 'negative'
  | 'sepia'
  | 'technicolor'
  | 'polaroid'
  | 'toBGR'
  | 'kodachrome'
  | 'browni'
  | 'vintage'
  | 'colorTone'
  | 'night'
  | 'predator'
  | 'lsd'

export type ColorFilterConfig = {
  blackAndWhiteEnabled: boolean
  brightness: number
  brightnessEnabled: boolean
  browniEnabled: boolean
  colorToneDarkColor: string
  colorToneDesaturation: number
  colorToneEnabled: boolean
  colorToneLightColor: string
  colorToneToned: number
  contrast: number
  contrastEnabled: boolean
  desaturateEnabled: boolean
  grayscale: number
  grayscaleEnabled: boolean
  hue: number
  hueEnabled: boolean
  kodachromeEnabled: boolean
  lsdEnabled: boolean
  negativeEnabled: boolean
  nightEnabled: boolean
  nightIntensity: number
  polaroidEnabled: boolean
  predatorAmount: number
  predatorEnabled: boolean
  saturation: number
  saturationEnabled: boolean
  sepiaEnabled: boolean
  technicolorEnabled: boolean
  tint: string
  tintEnabled: boolean
  toBGREnabled: boolean
  vintageEnabled: boolean
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
