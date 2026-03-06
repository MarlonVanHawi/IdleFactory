import type { GameState } from '../game/types'

interface CameraBounds {
  worldWidth: number
  worldHeight: number
}

interface CameraZoomLimits {
  minZoom: number
  maxZoom: number
}

interface CameraCenter {
  worldCenterX: number
  worldCenterY: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function clampCamera(state: GameState, bounds: CameraBounds): void {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return
  }
  const viewportW = wrap.clientWidth
  const viewportH = wrap.clientHeight
  const minX = viewportW - bounds.worldWidth * state.cameraZoom
  const minY = viewportH - bounds.worldHeight * state.cameraZoom
  state.cameraX = clamp(state.cameraX, minX, 0)
  state.cameraY = clamp(state.cameraY, minY, 0)
}

export function getWorldPointFromClient(state: GameState, clientX: number, clientY: number): { x: number; y: number } | null {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return null
  }
  const rect = wrap.getBoundingClientRect()
  return {
    x: (clientX - rect.left - state.cameraX) / state.cameraZoom,
    y: (clientY - rect.top - state.cameraY) / state.cameraZoom,
  }
}

export function setCameraZoom(
  state: GameState,
  limits: CameraZoomLimits,
  bounds: CameraBounds,
  nextZoom: number,
  anchorClientX?: number,
  anchorClientY?: number,
): void {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return
  }
  const rect = wrap.getBoundingClientRect()
  const anchorX = anchorClientX ?? rect.left + rect.width * 0.5
  const anchorY = anchorClientY ?? rect.top + rect.height * 0.5
  const worldXBefore = (anchorX - rect.left - state.cameraX) / state.cameraZoom
  const worldYBefore = (anchorY - rect.top - state.cameraY) / state.cameraZoom

  state.cameraZoom = clamp(nextZoom, limits.minZoom, limits.maxZoom)
  state.cameraX = anchorX - rect.left - worldXBefore * state.cameraZoom
  state.cameraY = anchorY - rect.top - worldYBefore * state.cameraZoom
  clampCamera(state, bounds)
}

export function getViewportWorldCenter(state: GameState): { x: number; y: number } {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return { x: 200, y: 200 }
  }
  return {
    x: (wrap.clientWidth * 0.5 - state.cameraX) / state.cameraZoom,
    y: (wrap.clientHeight * 0.5 - state.cameraY) / state.cameraZoom,
  }
}

export function centerCameraOnWorld(state: GameState, bounds: CameraBounds, center: CameraCenter): void {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return
  }
  state.cameraX = wrap.clientWidth * 0.5 - center.worldCenterX * state.cameraZoom
  state.cameraY = wrap.clientHeight * 0.5 - center.worldCenterY * state.cameraZoom
  clampCamera(state, bounds)
}
