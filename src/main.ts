import './style.css'
import { MACHINE_DEFS } from './game/data'
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
  GraphNode,
  MachineKind,
  PanelScrollKey,
  ShopId,
  UpgradeId,
} from './game/types'

const app = document.querySelector<HTMLDivElement>('#app') as HTMLDivElement
const cameraBounds = { worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT }
const cameraLimits = { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }
const cameraCenter = { worldCenterX: WORLD_CENTER_X, worldCenterY: WORLD_CENTER_Y }

const state = createInitialState()

const interactionRefs: InteractionRefs = {
  dragNodeId: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  connectionPointerClientX: null,
  connectionPointerClientY: null,
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
  })
}

function addMachine(machineKind: MachineKind): void {
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
  const label = kind === 'splitter' ? 'Splitter' : 'Merger'
  const center = getViewportWorldCenter(state)
  state.nodes.push(
    createNode(kind, label, center.x - NODE_WIDTH * 0.5 + (Math.random() * 80 - 40), center.y + (Math.random() * 50 - 25)),
  )
  render()
}

function createEdge(fromId: string, toId: string): void {
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
  })
}

function deleteNode(nodeId: string): void {
  state.nodes = state.nodes.filter((node) => node.id !== nodeId)
  state.edges = state.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)
  if (state.pendingConnectionFrom === nodeId) {
    state.pendingConnectionFrom = null
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
  getWorldPointFromClient: (clientX, clientY) => getWorldPointFromClient(state, clientX, clientY),
  clampCamera: () => clampCamera(state, cameraBounds),
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
