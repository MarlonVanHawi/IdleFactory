import './style.css'
import { BUILD_COSTS, MACHINE_DEFS } from './game/data'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  NODE_WIDTH,
  UI_RENDER_INTERVAL_MS,
  WORLD_CENTER_X,
  WORLD_CENTER_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  createInitialState,
} from './game/state'
import {
  buyResearchUpgrade,
  buyShopItem,
  createEmptyInventory,
  spendCredits,
  runSimulation,
} from './game/simulation'
import { createNode, nextEdgeId } from './game/factory'
import { renderEdgesFromPorts } from './ui/edges'
import {
  centerCameraOnWorld,
  clampCamera,
  getViewportWorldCenter,
  getWorldPointFromClient,
  setCameraZoom,
} from './ui/camera'
import { setupInteractions, type InteractionRefs } from './ui/interactions'
import { renderApp } from './ui/render'
import type {
  GameState,
  GraphNode,
  MachineKind,
  PanelScrollKey,
  ShopId,
  UpgradeId,
} from './game/types'

const app = document.querySelector<HTMLDivElement>('#app') as HTMLDivElement
const SAVE_KEY = 'idle-factory-node-state-v1'
const SAVE_FILE_FORMAT = 'idle-factory-save'
const SAVE_FILE_VERSION = 1
const cameraBounds = { worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT }
const cameraLimits = { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }
const cameraCenter = { worldCenterX: WORLD_CENTER_X, worldCenterY: WORLD_CENTER_Y }

const state = loadState()

const interactionRefs: InteractionRefs = {
  dragNodeId: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragEdgeId: null,
  dragEdgePointIndex: -1,
  dragEdgeAxis: null,
  connectionPointerClientX: null,
  connectionPointerClientY: null,
  connectionRoutePoints: [],
  connectionDragStarted: false,
  isPanning: false,
  panLastClientX: 0,
  panLastClientY: 0,
  panelInteractionUntilMs: 0,
}
let cameraInitialized = false
let lastTickMs = performance.now()
let lastUiRenderMs = performance.now()

function getNode(nodeId: string): GraphNode | undefined {
  return state.nodes.find((node) => node.id === nodeId)
}

function canNodeOutput(node: GraphNode): boolean {
  return node.kind !== 'warehouse'
}

function canNodeInput(_node: GraphNode): boolean {
  return true
}

function restorePanelScrollPositions(): void {
  ;(['warehouse', 'build', 'research', 'shop'] as PanelScrollKey[]).forEach((key) => {
    const panelBody = app.querySelector(`[data-scroll-key="${key}"]`) as HTMLDivElement | null
    if (!panelBody) {
      return
    }
    panelBody.scrollTop = state.panelScrollTop[key]
  })
}

function render(): void {
  app.innerHTML = renderApp({
    state,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    dragNodeId: interactionRefs.dragNodeId,
  })
  if (!cameraInitialized) {
    cameraInitialized = true
    requestAnimationFrame(() => {
      centerCameraOnWorld(state, cameraBounds, cameraCenter)
      render()
    })
    return
  }
  restorePanelScrollPositions()
  renderEdgesFromPorts({
    state,
    connectionPointerClientX: interactionRefs.connectionPointerClientX,
    connectionPointerClientY: interactionRefs.connectionPointerClientY,
    connectionRoutePoints: interactionRefs.connectionRoutePoints,
  })
  saveState(state)
}

function addMachine(machineKind: MachineKind): void {
  const buildCost = BUILD_COSTS.machines[machineKind]
  if (!spendCredits(state, buildCost)) {
    return
  }
  const def = MACHINE_DEFS[machineKind]
  const center = getViewportWorldCenter(state)
  const node = createNode(
    'machine',
    def.label,
    center.x - NODE_WIDTH * 0.5 + (Math.random() * 60 - 30),
    center.y - 70 + (Math.random() * 50 - 25),
    machineKind,
  )
  state.nodes.push(node)
  render()
}

function addWarehouse(): void {
  const buildCost = BUILD_COSTS.warehouse
  if (!spendCredits(state, buildCost)) {
    return
  }
  const center = getViewportWorldCenter(state)
  const node = createNode(
    'warehouse',
    'Warehouse',
    center.x - NODE_WIDTH * 0.5 + (Math.random() * 40 - 20),
    center.y - 70 + (Math.random() * 40 - 20),
  )
  state.nodes.push(node)
  render()
}

function addConnector(kind: 'splitter' | 'merger'): void {
  const buildCost = BUILD_COSTS.connectors[kind]
  if (!spendCredits(state, buildCost)) {
    return
  }
  const label = kind === 'splitter' ? 'Splitter' : 'Merger'
  const center = getViewportWorldCenter(state)
  state.nodes.push(
    createNode(kind, label, center.x - NODE_WIDTH * 0.5 + (Math.random() * 80 - 40), center.y + (Math.random() * 50 - 25)),
  )
  render()
}

function createEdge(fromId: string, toId: string, routePoints: Array<{ x: number; y: number }> = []): void {
  if (fromId === toId) {
    return
  }
  const from = getNode(fromId)
  const to = getNode(toId)
  if (!from || !to || !canNodeOutput(from) || !canNodeInput(to)) {
    return
  }
  const already = state.edges.some((edge) => edge.from === fromId && edge.to === toId)
  if (already) {
    return
  }
  state.edges.push({
    id: nextEdgeId(),
    from: fromId,
    to: toId,
    capacityPerSecond: 2.5,
    routePoints: routePoints.map((point) => ({ x: point.x, y: point.y })),
    isRouteManual: routePoints.length > 0,
  })
  state.selectedEdgeId = null
}

function unwrapImportedPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload
  }
  const envelope = payload as { format?: unknown; state?: unknown }
  if (envelope.format === SAVE_FILE_FORMAT && envelope.state) {
    return envelope.state
  }
  return payload
}

function parseStatePayload(payload: unknown): GameState {
  const base = createInitialState()
  const parsed = unwrapImportedPayload(payload) as Partial<GameState> & {
    nodes?: Array<Partial<GraphNode>>
    edges?: Array<{
      id?: string
      from?: string
      to?: string
      capacityPerSecond?: number
      routePoints?: Array<{ x?: number; y?: number }>
      isRouteManual?: boolean
    }>
  }
  const hasLegacyProgress =
    (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) ||
    (Array.isArray(parsed.edges) && parsed.edges.length > 0)

  const nodes = Array.isArray(parsed.nodes)
    ? parsed.nodes
        .filter(
          (node) => typeof node?.id === 'string' && typeof node?.kind === 'string' && typeof node?.label === 'string',
        )
        .map((node) => ({
          id: node.id as string,
          kind: node.kind as GraphNode['kind'],
          label: node.label as string,
          x: typeof node.x === 'number' ? node.x : 0,
          y: typeof node.y === 'number' ? node.y : 0,
          machineKind: node.machineKind,
          inventory: { ...createEmptyInventory(), ...(node.inventory ?? {}) },
        }))
    : base.nodes

  const edges = Array.isArray(parsed.edges)
    ? parsed.edges
        .filter((edge) => typeof edge?.id === 'string' && typeof edge?.from === 'string' && typeof edge?.to === 'string')
        .map((edge) => ({
          id: edge.id as string,
          from: edge.from as string,
          to: edge.to as string,
          capacityPerSecond: typeof edge.capacityPerSecond === 'number' ? edge.capacityPerSecond : 2.5,
          routePoints: Array.isArray(edge.routePoints)
            ? edge.routePoints
                .filter((point) => typeof point?.x === 'number' && typeof point?.y === 'number')
                .map((point) => ({ x: point.x as number, y: point.y as number }))
            : [],
          isRouteManual: edge.isRouteManual === true,
        }))
    : base.edges

  return {
    ...base,
    ...parsed,
    walletCredits:
      typeof parsed.walletCredits === 'number' ? parsed.walletCredits : hasLegacyProgress ? 0 : base.walletCredits,
    snapMode: parsed.snapMode === true,
    nodes,
    edges,
    selectedEdgeId:
      typeof parsed.selectedEdgeId === 'string' && edges.some((edge) => edge.id === parsed.selectedEdgeId)
        ? parsed.selectedEdgeId
        : null,
  }
}

function replaceState(nextState: GameState): void {
  Object.assign(state, nextState)
}

function exportSaveFile(): void {
  const snapshot = parseStatePayload(state)
  const payload = {
    format: SAVE_FILE_FORMAT,
    version: SAVE_FILE_VERSION,
    savedAt: new Date().toISOString(),
    state: snapshot,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `idle-factory-save-${stamp}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}

function importSaveFile(file: File): void {
  file
    .text()
    .then((text) => {
      const parsed = JSON.parse(text) as unknown
      const nextState = parseStatePayload(parsed)
      replaceState(nextState)
      interactionRefs.connectionPointerClientX = null
      interactionRefs.connectionPointerClientY = null
      interactionRefs.connectionRoutePoints = []
      interactionRefs.connectionDragStarted = false
      interactionRefs.dragNodeId = null
      interactionRefs.dragEdgeId = null
      interactionRefs.dragEdgePointIndex = -1
      interactionRefs.dragEdgeAxis = null
      interactionRefs.isPanning = false
      render()
    })
    .catch(() => {
      window.alert('Import failed. Please choose a valid Idle Factory save JSON file.')
    })
}

function deleteNode(nodeId: string): void {
  state.nodes = state.nodes.filter((node) => node.id !== nodeId)
  state.edges = state.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)
  if (state.pendingConnectionFrom === nodeId) {
    state.pendingConnectionFrom = null
  }
  if (state.selectedEdgeId && !state.edges.some((edge) => edge.id === state.selectedEdgeId)) {
    state.selectedEdgeId = null
  }
}

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) {
      return createInitialState()
    }
    return parseStatePayload(JSON.parse(raw) as unknown)
  } catch {
    return createInitialState()
  }
}

function saveState(nextState: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(nextState))
  } catch {
    // Ignore save failures (private mode/quota) to keep gameplay uninterrupted.
  }
}

setupInteractions({
  app,
  state,
  refs: interactionRefs,
  nodeWidth: NODE_WIDTH,
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
  addMachine,
  addWarehouse,
  addConnector,
  buyShopItem: (id) => buyShopItem(state, id as ShopId),
  buyUpgrade: (id) => buyResearchUpgrade(state, id as UpgradeId),
  createEdge,
  deleteNode,
  setCameraZoom: (nextZoom, anchorClientX, anchorClientY) =>
    setCameraZoom(state, cameraLimits, cameraBounds, nextZoom, anchorClientX, anchorClientY),
  getNode,
  getNodes: () => state.nodes,
  getWorldPointFromClient: (clientX, clientY) => getWorldPointFromClient(state, clientX, clientY),
  clampCamera: () => clampCamera(state, cameraBounds),
  exportSaveFile,
  importSaveFile,
  render,
})

function frame(nowMs: number): void {
  const elapsed = Math.min(0.2, (nowMs - lastTickMs) / 1000)
  lastTickMs = nowMs
  runSimulation(state, elapsed)
  if (nowMs >= interactionRefs.panelInteractionUntilMs && nowMs - lastUiRenderMs >= UI_RENDER_INTERVAL_MS) {
    render()
    lastUiRenderMs = nowMs
  }
  requestAnimationFrame(frame)
}

render()
requestAnimationFrame(frame)
