import { BUILD_COSTS, MACHINE_DEFS } from '../game/data'
import {
  GRID_SNAP_OFFSET_X,
  GRID_SNAP_OFFSET_Y,
  GRID_SNAP_X,
  GRID_SNAP_Y,
  NODE_CLEARANCE_PX,
} from '../game/state'
import { isMachineBuildUnlocked } from '../game/unlocks'
import { totalResource } from '../game/simulation'
import type { GameState, GraphNode, MachineKind, PanelScrollKey } from '../game/types'

export interface InteractionRefs {
  dragNodeId: string | null
  dragOffsetX: number
  dragOffsetY: number
  dragEdgeId: string | null
  dragEdgePointIndex: number
  dragEdgeAxis: 'x' | 'y' | null
  connectionPointerClientX: number | null
  connectionPointerClientY: number | null
  connectionRoutePoints: Array<{ x: number; y: number }>
  connectionDragStarted: boolean
  isPanning: boolean
  panLastClientX: number
  panLastClientY: number
  panelInteractionUntilMs: number
}

interface SetupInteractionsArgs {
  app: HTMLDivElement
  state: GameState
  refs: InteractionRefs
  nodeWidth: number
  worldWidth: number
  worldHeight: number
  addMachine: (machineKind: MachineKind) => void
  addWarehouse: () => void
  addConnector: (kind: 'splitter' | 'merger') => void
  buyShopItem: (id: string) => void
  buyUpgrade: (id: string) => void
  createEdge: (fromId: string, toId: string, routePoints?: Array<{ x: number; y: number }>) => void
  deleteNode: (nodeId: string) => void
  setCameraZoom: (nextZoom: number, anchorClientX?: number, anchorClientY?: number) => void
  getNode: (nodeId: string) => GraphNode | undefined
  getNodes: () => GraphNode[]
  getWorldPointFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null
  clampCamera: () => void
  exportSaveFile: () => void
  importSaveFile: (file: File) => void
  render: () => void
}

function markPanelInteraction(refs: InteractionRefs, durationMs = 650): void {
  refs.panelInteractionUntilMs = Math.max(refs.panelInteractionUntilMs, performance.now() + durationMs)
}

function getEdgePortAnchors(
  state: GameState,
  edge: { from: string; to: string },
): { fromX: number; fromY: number; toX: number; toY: number } | null {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return null
  }
  const wrapRect = wrap.getBoundingClientRect()
  const outPort = wrap.querySelector(
    `.port-out[data-node-id="${edge.from}"]`,
  ) as HTMLButtonElement | null
  const inPort = wrap.querySelector(
    `.port-in[data-node-id="${edge.to}"]`,
  ) as HTMLButtonElement | null
  if (!outPort || !inPort) {
    return null
  }
  const outRect = outPort.getBoundingClientRect()
  const inRect = inPort.getBoundingClientRect()
  return {
    fromX: (outRect.left - wrapRect.left + outRect.width * 0.5 - state.cameraX) / state.cameraZoom,
    fromY: (outRect.top - wrapRect.top + outRect.height * 0.5 - state.cameraY) / state.cameraZoom,
    toX: (inRect.left - wrapRect.left + inRect.width * 0.5 - state.cameraX) / state.cameraZoom,
    toY: (inRect.top - wrapRect.top + inRect.height * 0.5 - state.cameraY) / state.cameraZoom,
  }
}

function createDefaultEdgeRoutePoints(
  anchors: { fromX: number; fromY: number; toX: number; toY: number },
): Array<{ x: number; y: number }> {
  const midX = anchors.fromX + (anchors.toX - anchors.fromX) * 0.5
  return [
    { x: midX, y: anchors.fromY },
    { x: midX, y: anchors.toY },
  ]
}

function nodeDimensions(
  node: GraphNode,
  fallbackWidth: number,
  state: GameState,
): { width: number; height: number } {
  const wrap = document.getElementById('graphWrap')
  const nodeEl = wrap?.querySelector(`.graph-node[data-node-id="${node.id}"]`) as HTMLElement | null
  if (nodeEl) {
    const rect = nodeEl.getBoundingClientRect()
    const zoom = Math.max(0.001, state.cameraZoom)
    return {
      width: rect.width / zoom,
      height: rect.height / zoom,
    }
  }
  if (node.kind === 'splitter' || node.kind === 'merger') {
    return { width: 190, height: 74 }
  }
  return { width: fallbackWidth, height: 145 }
}

function clampNodeIntoWorld(
  node: GraphNode,
  worldWidth: number,
  worldHeight: number,
  fallbackWidth: number,
  state: GameState,
): void {
  const { width, height } = nodeDimensions(node, fallbackWidth, state)
  node.x = Math.max(10, Math.min(worldWidth - width - 10, node.x))
  node.y = Math.max(10, Math.min(worldHeight - height - 10, node.y))
}

function resolveDraggedNodeOverlap(
  dragNode: GraphNode,
  nodes: GraphNode[],
  worldWidth: number,
  worldHeight: number,
  fallbackWidth: number,
  state: GameState,
): void {
  const overlapGap = NODE_CLEARANCE_PX
  for (let i = 0; i < 16; i += 1) {
    const aSize = nodeDimensions(dragNode, fallbackWidth, state)
    const ax1 = dragNode.x
    const ay1 = dragNode.y
    const ax2 = ax1 + aSize.width
    const ay2 = ay1 + aSize.height
    let moved = false
    for (const other of nodes) {
      if (other.id === dragNode.id) {
        continue
      }
      const bSize = nodeDimensions(other, fallbackWidth, state)
      const bx1 = other.x
      const by1 = other.y
      const bx2 = bx1 + bSize.width
      const by2 = by1 + bSize.height
      const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1)
      const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1)
      if (overlapX <= 0 || overlapY <= 0) {
        continue
      }
      const aCenterX = ax1 + aSize.width * 0.5
      const aCenterY = ay1 + aSize.height * 0.5
      const bCenterX = bx1 + bSize.width * 0.5
      const bCenterY = by1 + bSize.height * 0.5
      if (overlapX <= overlapY) {
        const push = overlapX + overlapGap
        dragNode.x += aCenterX < bCenterX ? -push : push
      } else {
        const push = overlapY + overlapGap
        dragNode.y += aCenterY < bCenterY ? -push : push
      }
      clampNodeIntoWorld(dragNode, worldWidth, worldHeight, fallbackWidth, state)
      moved = true
      break
    }
    if (!moved) {
      return
    }
  }
}

function snapToGrid(value: number, step: number, offset: number): number {
  return Math.round((value - offset) / step) * step + offset
}

function snapNodePosition(
  node: GraphNode,
  fallbackWidth: number,
  state: GameState,
): { x: number; y: number } {
  const baseX = snapToGrid(node.x, GRID_SNAP_X, GRID_SNAP_OFFSET_X)
  const baseY = snapToGrid(node.y, GRID_SNAP_Y, GRID_SNAP_OFFSET_Y)
  const { width, height } = nodeDimensions(node, fallbackWidth, state)
  const centeredOffsetX = (GRID_SNAP_X - width) * 0.5
  const centeredOffsetY = (GRID_SNAP_Y - height) * 0.5
  return { x: baseX + centeredOffsetX, y: baseY + centeredOffsetY }
}

export function setupInteractions({
  app,
  state,
  refs,
  nodeWidth,
  worldWidth,
  worldHeight,
  addMachine,
  addWarehouse,
  addConnector,
  buyShopItem,
  buyUpgrade,
  createEdge,
  deleteNode,
  setCameraZoom,
  getNode,
  getNodes,
  getWorldPointFromClient,
  clampCamera,
  exportSaveFile,
  importSaveFile,
  render,
}: SetupInteractionsArgs): void {
  app.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const actionEl = target.closest('[data-action]')
    if (!actionEl) {
      return
    }
    event.preventDefault()
    const action = actionEl.getAttribute('data-action')
    if (!action) {
      return
    }

    if (action === 'add-machine') {
      const machine = actionEl.getAttribute('data-machine')
      if (
        machine &&
        machine in MACHINE_DEFS &&
        isMachineBuildUnlocked(state, machine as MachineKind) &&
        totalResource(state, 'credits') >= BUILD_COSTS.machines[machine as MachineKind]
      ) {
        addMachine(machine as MachineKind)
      }
      return
    }
    if (action === 'add-warehouse') {
      if (totalResource(state, 'credits') >= BUILD_COSTS.warehouse) {
        addWarehouse()
      }
      return
    }
    if (action === 'add-connector') {
      const kind = actionEl.getAttribute('data-kind')
      if (
        (kind === 'splitter' || kind === 'merger') &&
        totalResource(state, 'credits') >= BUILD_COSTS.connectors[kind]
      ) {
        addConnector(kind)
      }
      return
    }
    if (action === 'start-connect') {
      const nodeId = actionEl.getAttribute('data-node-id')
      if (nodeId) {
        state.pendingConnectionFrom = nodeId
        refs.connectionPointerClientX = event.clientX
        refs.connectionPointerClientY = event.clientY
        refs.connectionRoutePoints = []
        refs.connectionDragStarted = false
        render()
      }
      return
    }
    if (action === 'end-connect') {
      const toId = actionEl.getAttribute('data-node-id')
      if (toId && state.pendingConnectionFrom) {
        createEdge(state.pendingConnectionFrom, toId, refs.connectionRoutePoints)
        state.pendingConnectionFrom = null
        refs.connectionPointerClientX = null
        refs.connectionPointerClientY = null
        refs.connectionRoutePoints = []
        refs.connectionDragStarted = false
        state.selectedEdgeId = null
        render()
      }
      return
    }
    if (action === 'clear-connect') {
      state.pendingConnectionFrom = null
      refs.connectionPointerClientX = null
      refs.connectionPointerClientY = null
      refs.connectionRoutePoints = []
      refs.connectionDragStarted = false
      render()
      return
    }
    if (action === 'select-edge') {
      const edgeId = actionEl.getAttribute('data-edge-id')
      if (edgeId) {
        state.selectedEdgeId = edgeId
        render()
      }
      return
    }
    if (action === 'delete-edge') {
      const edgeId = actionEl.getAttribute('data-edge-id')
      if (edgeId) {
        state.edges = state.edges.filter((edge) => edge.id !== edgeId)
        if (state.selectedEdgeId === edgeId) {
          state.selectedEdgeId = null
        }
        render()
      }
      return
    }
    if (action === 'toggle-warehouse') {
      state.warehousePanelOpen = !state.warehousePanelOpen
      render()
      return
    }
    if (action === 'toggle-build') {
      state.buildPanelOpen = !state.buildPanelOpen
      render()
      return
    }
    if (action === 'toggle-research') {
      state.researchPanelOpen = !state.researchPanelOpen
      render()
      return
    }
    if (action === 'toggle-shop') {
      state.shopPanelOpen = !state.shopPanelOpen
      render()
      return
    }
    if (action === 'toggle-snap-mode') {
      state.snapMode = !state.snapMode
      render()
      return
    }
    if (action === 'export-save') {
      exportSaveFile()
      return
    }
    if (action === 'import-save') {
      const input = app.querySelector('input[data-action="import-save-file"]') as HTMLInputElement | null
      if (input) {
        input.value = ''
        input.click()
      }
      return
    }
    if (action === 'buy-shop-item') {
      const id = actionEl.getAttribute('data-shop-id')
      if (id) {
        buyShopItem(id)
        render()
      }
      return
    }
    if (action === 'buy-upgrade') {
      const id = actionEl.getAttribute('data-upgrade-id')
      if (id) {
        buyUpgrade(id)
        render()
      }
      return
    }
    if (action === 'zoom-in') {
      setCameraZoom(state.cameraZoom * 1.15)
      render()
      return
    }
    if (action === 'zoom-out') {
      setCameraZoom(state.cameraZoom / 1.15)
      render()
      return
    }
    if (action === 'zoom-reset') {
      setCameraZoom(1)
      render()
      return
    }
    if (action === 'delete-node') {
      const nodeId = actionEl.getAttribute('data-node-id')
      if (nodeId) {
        deleteNode(nodeId)
        render()
      }
      return
    }
    if (action === 'clear-edges') {
      state.edges = []
      state.selectedEdgeId = null
      render()
    }
  })

  app.addEventListener(
    'change',
    (event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement)) {
        return
      }
      if (target.getAttribute('data-action') !== 'import-save-file') {
        return
      }
      const file = target.files?.[0]
      if (!file) {
        return
      }
      importSaveFile(file)
    },
    true,
  )

  app.addEventListener(
    'scroll',
    (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) {
        return
      }
      const key = target.getAttribute('data-scroll-key') as PanelScrollKey | null
      if (!key) {
        return
      }
      state.panelScrollTop[key] = target.scrollTop
      markPanelInteraction(refs)
    },
    true,
  )

  app.addEventListener(
    'wheel',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      if (target.closest('.dropdown-body')) {
        markPanelInteraction(refs)
      }
    },
    true,
  )

  app.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      if (target.closest('.dropdown-body')) {
        markPanelInteraction(refs)
      }
    },
    true,
  )

  app.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    if (target.closest('[data-action]')) {
      return
    }
    const handle = target.closest('.node-head[data-drag-handle]')
    if (!handle) {
      return
    }
    const nodeId = handle.getAttribute('data-drag-handle')
    if (!nodeId) {
      return
    }
    const node = getNode(nodeId)
    if (!node) {
      return
    }
    const wrap = document.getElementById('graphWrap')
    if (!wrap) {
      return
    }
    event.preventDefault()
    refs.dragNodeId = nodeId
    const world = getWorldPointFromClient(event.clientX, event.clientY)
    if (!world) {
      return
    }
    refs.dragOffsetX = world.x - node.x
    refs.dragOffsetY = world.y - node.y
    ;(target as HTMLElement).setPointerCapture?.(event.pointerId)
  })

  app.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const handle = target.closest('.edge-handle') as SVGElement | null
    if (!handle) {
      return
    }
    const edgeId = handle.getAttribute('data-edge-id')
    const indexRaw = handle.getAttribute('data-point-index')
    const pointIndex = Number(indexRaw)
    if (!edgeId || !Number.isFinite(pointIndex)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    state.selectedEdgeId = edgeId
    const edge = state.edges.find((item) => item.id === edgeId)
    if (edge && !edge.isRouteManual) {
      const anchors = getEdgePortAnchors(state, edge)
      if (anchors) {
        edge.routePoints = createDefaultEdgeRoutePoints(anchors)
        edge.isRouteManual = true
      }
    }
    if (edge && edge.routePoints.length === 2) {
      const [a, b] = edge.routePoints
      refs.dragEdgeAxis = Math.abs(a.x - b.x) <= Math.abs(a.y - b.y) ? 'x' : 'y'
    } else {
      refs.dragEdgeAxis = null
    }
    refs.dragEdgeId = edgeId
    refs.dragEdgePointIndex = pointIndex
  })

  app.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const wrap = target.closest('#graphWrap')
    if (!wrap) {
      return
    }
    if (state.pendingConnectionFrom && !target.closest('[data-action]') && !target.closest('.graph-node')) {
      const world = getWorldPointFromClient(event.clientX, event.clientY)
      if (world) {
        refs.connectionRoutePoints.push({
          x: Math.max(0, Math.min(worldWidth, world.x)),
          y: Math.max(0, Math.min(worldHeight, world.y)),
        })
        refs.connectionPointerClientX = event.clientX
        refs.connectionPointerClientY = event.clientY
        refs.connectionDragStarted = true
        event.preventDefault()
        render()
      }
      return
    }
    if (target.closest('.graph-node') || target.closest('[data-action]') || target.closest('.edge-handle')) {
      return
    }
    state.selectedEdgeId = null
    event.preventDefault()
    refs.isPanning = true
    refs.panLastClientX = event.clientX
    refs.panLastClientY = event.clientY
  })

  window.addEventListener('pointermove', (event) => {
    if (state.pendingConnectionFrom && !refs.dragNodeId) {
      refs.connectionPointerClientX = event.clientX
      refs.connectionPointerClientY = event.clientY
      if (event.buttons !== 0) {
        refs.connectionDragStarted = true
      }
      render()
      return
    }
    if (refs.dragEdgeId) {
      const edge = state.edges.find((item) => item.id === refs.dragEdgeId)
      if (!edge || !edge.routePoints[refs.dragEdgePointIndex]) {
        refs.dragEdgeId = null
        refs.dragEdgePointIndex = -1
        refs.dragEdgeAxis = null
        return
      }
      const world = getWorldPointFromClient(event.clientX, event.clientY)
      if (!world) {
        return
      }
      const clampedX = Math.max(0, Math.min(worldWidth, world.x))
      const clampedY = Math.max(0, Math.min(worldHeight, world.y))
      if (edge.routePoints.length === 2) {
        if (refs.dragEdgeAxis === 'x') {
          edge.routePoints[0].x = clampedX
          edge.routePoints[1].x = clampedX
        } else {
          edge.routePoints[0].y = clampedY
          edge.routePoints[1].y = clampedY
        }
      } else {
        edge.routePoints[refs.dragEdgePointIndex] = {
          x: clampedX,
          y: clampedY,
        }
      }
      render()
      return
    }
    if (refs.isPanning && !refs.dragNodeId) {
      const dx = event.clientX - refs.panLastClientX
      const dy = event.clientY - refs.panLastClientY
      refs.panLastClientX = event.clientX
      refs.panLastClientY = event.clientY
      state.cameraX += dx
      state.cameraY += dy
      clampCamera()
      render()
      return
    }
    if (!refs.dragNodeId) {
      return
    }
    const node = getNode(refs.dragNodeId)
    if (!node) {
      refs.dragNodeId = null
      return
    }
    const world = getWorldPointFromClient(event.clientX, event.clientY)
    if (!world) {
      return
    }
    event.preventDefault()
    node.x = world.x - refs.dragOffsetX
    node.y = world.y - refs.dragOffsetY
    clampNodeIntoWorld(node, worldWidth, worldHeight, nodeWidth, state)
    resolveDraggedNodeOverlap(node, getNodes(), worldWidth, worldHeight, nodeWidth, state)
    render()
  })

  window.addEventListener(
    'wheel',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      if (!target.closest('#graphWrap')) {
        return
      }
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08
      setCameraZoom(state.cameraZoom * factor, event.clientX, event.clientY)
      render()
    },
    { passive: false },
  )

  window.addEventListener('pointerup', () => {
    if (refs.dragNodeId) {
      const node = getNode(refs.dragNodeId)
      if (node && state.snapMode) {
        const snapped = snapNodePosition(node, nodeWidth, state)
        node.x = snapped.x
        node.y = snapped.y
        clampNodeIntoWorld(node, worldWidth, worldHeight, nodeWidth, state)
        resolveDraggedNodeOverlap(node, getNodes(), worldWidth, worldHeight, nodeWidth, state)
        render()
      }
    }
    // Keep connect mode active after mouse release so users can place multiple anchor points by clicking.
    if (state.pendingConnectionFrom) {
      refs.connectionDragStarted = false
    }
    refs.dragNodeId = null
    refs.dragEdgeId = null
    refs.dragEdgePointIndex = -1
    refs.dragEdgeAxis = null
    refs.isPanning = false
  })
}
