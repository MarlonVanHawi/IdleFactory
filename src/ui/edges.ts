import type { GameState } from '../game/types'

interface RenderEdgesOptions {
  state: GameState
  connectionPointerClientX: number | null
  connectionPointerClientY: number | null
}

export function renderEdgesFromPorts({ state, connectionPointerClientX, connectionPointerClientY }: RenderEdgesOptions): void {
  const wrap = document.getElementById('graphWrap')
  const edgesLayer = document.getElementById('edgesLayer')
  if (!wrap || !edgesLayer) {
    return
  }
  const wrapRect = wrap.getBoundingClientRect()
  const persistedPaths = state.edges
    .map((edge) => {
      const outPort = wrap.querySelector(
        `.port-out[data-node-id="${edge.from}"]`,
      ) as HTMLButtonElement | null
      const inPort = wrap.querySelector(
        `.port-in[data-node-id="${edge.to}"]`,
      ) as HTMLButtonElement | null
      if (!outPort || !inPort) {
        return ''
      }
      const outRect = outPort.getBoundingClientRect()
      const inRect = inPort.getBoundingClientRect()
      const fromX =
        (outRect.left - wrapRect.left + outRect.width * 0.5 - state.cameraX) / state.cameraZoom
      const fromY =
        (outRect.top - wrapRect.top + outRect.height * 0.5 - state.cameraY) / state.cameraZoom
      const toX =
        (inRect.left - wrapRect.left + inRect.width * 0.5 - state.cameraX) / state.cameraZoom
      const toY =
        (inRect.top - wrapRect.top + inRect.height * 0.5 - state.cameraY) / state.cameraZoom
      const c = Math.max(40, Math.abs(toX - fromX) * 0.45)
      return `<path class="edge-line" d="M ${fromX} ${fromY} C ${fromX + c} ${fromY}, ${toX - c} ${toY}, ${toX} ${toY}" />`
    })
    .join('')

  let previewPath = ''
  if (
    state.pendingConnectionFrom &&
    connectionPointerClientX !== null &&
    connectionPointerClientY !== null
  ) {
    const outPort = wrap.querySelector(
      `.port-out[data-node-id="${state.pendingConnectionFrom}"]`,
    ) as HTMLButtonElement | null
    if (outPort) {
      const outRect = outPort.getBoundingClientRect()
      const fromX =
        (outRect.left - wrapRect.left + outRect.width * 0.5 - state.cameraX) / state.cameraZoom
      const fromY =
        (outRect.top - wrapRect.top + outRect.height * 0.5 - state.cameraY) / state.cameraZoom

      let toX = (connectionPointerClientX - wrapRect.left - state.cameraX) / state.cameraZoom
      let toY = (connectionPointerClientY - wrapRect.top - state.cameraY) / state.cameraZoom
      const targetAtPointer = document.elementFromPoint(
        connectionPointerClientX,
        connectionPointerClientY,
      )
      const inPort = targetAtPointer?.closest('.port-in[data-node-id]') as HTMLButtonElement | null
      if (inPort) {
        const inRect = inPort.getBoundingClientRect()
        toX = (inRect.left - wrapRect.left + inRect.width * 0.5 - state.cameraX) / state.cameraZoom
        toY = (inRect.top - wrapRect.top + inRect.height * 0.5 - state.cameraY) / state.cameraZoom
      }

      const c = Math.max(40, Math.abs(toX - fromX) * 0.45)
      previewPath = `<path class="edge-line edge-line-preview" d="M ${fromX} ${fromY} C ${fromX + c} ${fromY}, ${toX - c} ${toY}, ${toX} ${toY}" />`
    }
  }

  edgesLayer.innerHTML = `${persistedPaths}${previewPath}`
}
