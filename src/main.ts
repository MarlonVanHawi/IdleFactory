import './style.css'

type ResourceId =
  | 'coal'
  | 'energy'
  | 'credits'
  | 'wood'
  | 'lumber'
  | 'paper'
  | 'research'
  | 'ironOre'
  | 'ironPlate'
  | 'copperOre'
  | 'copperIngot'
  | 'copperWire'
  | 'goldOre'
  | 'goldIngot'
  | 'machineParts'
  | 'clay'
  | 'bricks'
  | 'coke'
  | 'steel'
type NodeKind = 'warehouse' | 'machine' | 'splitter' | 'merger'
type MachineKind = 'coalMine' | 'powerPlant' | 'woodcutter' | 'sawmill'

type Inventory = Record<ResourceId, number>

interface MachineDef {
  label: string
  inputs: Partial<Record<ResourceId, number>>
  outputs: Partial<Record<ResourceId, number>>
  opsPerSecond: number
}

interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  x: number
  y: number
  machineKind?: MachineKind
  inventory: Inventory
}

interface GraphEdge {
  id: string
  from: string
  to: string
  capacityPerSecond: number
}

interface GameState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  pendingConnectionFrom: string | null
  warehousePanelOpen: boolean
  buildPanelOpen: boolean
  cameraX: number
  cameraY: number
  cameraZoom: number
}

const MACHINE_DEFS: Record<MachineKind, MachineDef> = {
  coalMine: {
    label: 'Coal Mine',
    inputs: {},
    outputs: { coal: 1 },
    opsPerSecond: 1.2,
  },
  powerPlant: {
    label: 'Power Plant',
    inputs: { coal: 1 },
    outputs: { energy: 4 },
    opsPerSecond: 0.6,
  },
  woodcutter: {
    label: 'Woodcutter',
    inputs: {},
    outputs: { wood: 1 },
    opsPerSecond: 1,
  },
  sawmill: {
    label: 'Sawmill',
    inputs: { wood: 1 },
    outputs: { lumber: 1 },
    opsPerSecond: 0.5,
  },
}

const ALL_RESOURCES: ResourceId[] = [
  'coal',
  'energy',
  'credits',
  'wood',
  'lumber',
  'paper',
  'research',
  'ironOre',
  'ironPlate',
  'copperOre',
  'copperIngot',
  'copperWire',
  'goldOre',
  'goldIngot',
  'machineParts',
  'clay',
  'bricks',
  'coke',
  'steel',
]
const RESOURCE_LABELS: Record<ResourceId, string> = {
  coal: 'Coal',
  energy: 'Energy',
  credits: 'Credits',
  wood: 'Wood',
  lumber: 'Lumber',
  paper: 'Paper',
  research: 'Research',
  ironOre: 'Iron Ore',
  ironPlate: 'Iron Plates',
  copperOre: 'Copper Ore',
  copperIngot: 'Copper Ingots',
  copperWire: 'Copper Wire',
  goldOre: 'Gold Ore',
  goldIngot: 'Gold Ingots',
  machineParts: 'Machine Parts',
  clay: 'Clay',
  bricks: 'Bricks',
  coke: 'Coke',
  steel: 'Steel',
}
const NODE_WIDTH = 210
const WORLD_WIDTH = 4200
const WORLD_HEIGHT = 4200
const MIN_ZOOM = 0.45
const MAX_ZOOM = 2.25
const WORLD_CENTER_X = WORLD_WIDTH * 0.5
const WORLD_CENTER_Y = WORLD_HEIGHT * 0.5

const app = document.querySelector<HTMLDivElement>('#app') as HTMLDivElement

const state: GameState = {
  nodes: [],
  edges: [],
  pendingConnectionFrom: null,
  warehousePanelOpen: false,
  buildPanelOpen: false,
  cameraX: 0,
  cameraY: 0,
  cameraZoom: 1,
}

let idCounter = 0
let dragNodeId: string | null = null
let dragOffsetX = 0
let dragOffsetY = 0
let connectionPointerClientX: number | null = null
let connectionPointerClientY: number | null = null
let isPanning = false
let panLastClientX = 0
let panLastClientY = 0
let cameraInitialized = false
let lastTickMs = performance.now()

function emptyInventory(): Inventory {
  return {
    coal: 0,
    energy: 0,
    credits: 0,
    wood: 0,
    lumber: 0,
    paper: 0,
    research: 0,
    ironOre: 0,
    ironPlate: 0,
    copperOre: 0,
    copperIngot: 0,
    copperWire: 0,
    goldOre: 0,
    goldIngot: 0,
    machineParts: 0,
    clay: 0,
    bricks: 0,
    coke: 0,
    steel: 0,
  }
}

function makeNode(kind: NodeKind, label: string, x: number, y: number, machineKind?: MachineKind): GraphNode {
  return {
    id: `n-${kind}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    kind,
    label,
    x,
    y,
    machineKind,
    inventory: emptyInventory(),
  }
}

function nextEdgeId(): string {
  idCounter += 1
  return `e-${idCounter}`
}

function getNode(nodeId: string): GraphNode | undefined {
  return state.nodes.find((node) => node.id === nodeId)
}

function outgoingEdges(nodeId: string): GraphEdge[] {
  return state.edges.filter((edge) => edge.from === nodeId)
}

function canNodeOutput(node: GraphNode): boolean {
  return node.kind !== 'warehouse'
}

function canNodeInput(_node: GraphNode): boolean {
  return true
}

function allowedOutputResources(node: GraphNode): ResourceId[] {
  if (node.kind === 'warehouse') {
    return []
  }
  if (node.kind === 'machine') {
    if (!node.machineKind) {
      return []
    }
    return Object.keys(MACHINE_DEFS[node.machineKind].outputs) as ResourceId[]
  }
  return ALL_RESOURCES
}

function addResource(inv: Inventory, resource: ResourceId, amount: number): void {
  if (amount <= 0) {
    return
  }
  inv[resource] += amount
}

function consumeResource(inv: Inventory, resource: ResourceId, amount: number): void {
  if (amount <= 0) {
    return
  }
  inv[resource] = Math.max(0, inv[resource] - amount)
}

function runSimulation(dt: number): void {
  for (const node of state.nodes) {
    if (node.kind !== 'machine' || !node.machineKind) {
      continue
    }
    const def = MACHINE_DEFS[node.machineKind]
    let maxRuns = def.opsPerSecond * dt
    for (const [resource, perOp] of Object.entries(def.inputs)) {
      const key = resource as ResourceId
      if (!perOp || perOp <= 0) {
        continue
      }
      maxRuns = Math.min(maxRuns, node.inventory[key] / perOp)
    }
    if (maxRuns <= 0) {
      continue
    }
    for (const [resource, perOp] of Object.entries(def.inputs)) {
      const key = resource as ResourceId
      consumeResource(node.inventory, key, maxRuns * (perOp ?? 0))
    }
    for (const [resource, perOp] of Object.entries(def.outputs)) {
      const key = resource as ResourceId
      addResource(node.inventory, key, maxRuns * (perOp ?? 0))
    }
  }

  const incoming: Record<string, Inventory> = {}
  for (const node of state.nodes) {
    incoming[node.id] = emptyInventory()
  }
  const edgeCapacityRemaining = new Map<string, number>()
  for (const edge of state.edges) {
    edgeCapacityRemaining.set(edge.id, edge.capacityPerSecond * dt)
  }

  for (const node of state.nodes) {
    const outs = outgoingEdges(node.id)
    if (outs.length === 0) {
      continue
    }
    const allowed = allowedOutputResources(node)
    for (const resource of allowed) {
      const available = node.inventory[resource]
      if (available <= 0) {
        continue
      }
      let totalSent = 0
      const perEdgeTarget = available / outs.length
      for (const edge of outs) {
        const cap = edgeCapacityRemaining.get(edge.id) ?? 0
        if (cap <= 0) {
          continue
        }
        const sent = Math.min(perEdgeTarget, cap)
        if (sent <= 0) {
          continue
        }
        edgeCapacityRemaining.set(edge.id, cap - sent)
        addResource(incoming[edge.to], resource, sent)
        totalSent += sent
      }
      consumeResource(node.inventory, resource, totalSent)
    }
  }

  for (const node of state.nodes) {
    for (const resource of ALL_RESOURCES) {
      addResource(node.inventory, resource, incoming[node.id][resource])
    }
  }
}

function formatNumber(value: number): string {
  if (value >= 1000) {
    return value.toFixed(0)
  }
  if (value >= 100) {
    return value.toFixed(1)
  }
  return value.toFixed(2)
}

function warehouseInventory(): Inventory {
  const warehouse = state.nodes.find((node) => node.kind === 'warehouse')
  return warehouse ? warehouse.inventory : emptyInventory()
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clampCamera(): void {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return
  }
  const viewportW = wrap.clientWidth
  const viewportH = wrap.clientHeight
  const minX = viewportW - WORLD_WIDTH * state.cameraZoom
  const minY = viewportH - WORLD_HEIGHT * state.cameraZoom
  state.cameraX = clamp(state.cameraX, minX, 0)
  state.cameraY = clamp(state.cameraY, minY, 0)
}

function getWorldPointFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
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

function setCameraZoom(nextZoom: number, anchorClientX?: number, anchorClientY?: number): void {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return
  }
  const rect = wrap.getBoundingClientRect()
  const anchorX = anchorClientX ?? rect.left + rect.width * 0.5
  const anchorY = anchorClientY ?? rect.top + rect.height * 0.5
  const worldXBefore = (anchorX - rect.left - state.cameraX) / state.cameraZoom
  const worldYBefore = (anchorY - rect.top - state.cameraY) / state.cameraZoom

  state.cameraZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
  state.cameraX = anchorX - rect.left - worldXBefore * state.cameraZoom
  state.cameraY = anchorY - rect.top - worldYBefore * state.cameraZoom
  clampCamera()
}

function getViewportWorldCenter(): { x: number; y: number } {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return { x: 200, y: 200 }
  }
  return {
    x: (wrap.clientWidth * 0.5 - state.cameraX) / state.cameraZoom,
    y: (wrap.clientHeight * 0.5 - state.cameraY) / state.cameraZoom,
  }
}

function centerCameraOnWorld(): void {
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return
  }
  state.cameraX = wrap.clientWidth * 0.5 - WORLD_CENTER_X * state.cameraZoom
  state.cameraY = wrap.clientHeight * 0.5 - WORLD_CENTER_Y * state.cameraZoom
  clampCamera()
}

function render(): void {
  const warehouse = warehouseInventory()
  const warehouseRows = ALL_RESOURCES.map(
    (resource) =>
      `<div>${RESOURCE_LABELS[resource]}: ${formatNumber(warehouse[resource])}</div>`,
  ).join('')

  const nodesHtml = state.nodes
    .map((node) => {
      const machineDef = node.machineKind ? MACHINE_DEFS[node.machineKind] : null
      const inputEntries = machineDef
        ? Object.entries(machineDef.inputs)
        : node.kind === 'warehouse'
          ? [['storage', 1]]
          : [['any', 1]]
      const outputEntries = machineDef
        ? Object.entries(machineDef.outputs)
        : node.kind === 'warehouse'
          ? [['none', 0]]
          : [['any', 1]]
      const inputLines =
        inputEntries
          .map(([resource, amount]) => `<li>+ ${resource}: ${amount}/cycle</li>`)
          .join('') || '<li>- none</li>'
      const outputLines =
        outputEntries
          .map(([resource, amount]) => `<li>+ ${resource}: ${amount}/cycle</li>`)
          .join('') || '<li>- none</li>'
      const stockLines = ALL_RESOURCES.filter((resource) => node.inventory[resource] > 0.001)
        .map((resource) => `${resource} ${formatNumber(node.inventory[resource])}`)
        .join(' | ')
      const connectHint =
        state.pendingConnectionFrom && state.pendingConnectionFrom === node.id
          ? '<span class="pill pending">connecting...</span>'
          : ''
      return `
        <article
          class="graph-node kind-${node.kind} ${dragNodeId === node.id ? 'is-dragging' : ''}"
          data-node-id="${node.id}"
          style="left:${node.x}px; top:${node.y}px;"
        >
          <div class="node-head" data-drag-handle="${node.id}">
            <div class="node-head-left">
              <button class="danger head-remove" data-action="delete-node" data-node-id="${node.id}">X</button>
            </div>
            <strong class="node-title">${node.label}</strong>
            <div class="node-head-right">
              ${connectHint}
            </div>
          </div>
          <section class="uml-section uml-attributes">
            <div class="uml-divider-label">attributes</div>
            <ul class="uml-list">${inputLines}</ul>
            <button
              class="port-arrow port-in"
              data-node-id="${node.id}"
              ${canNodeInput(node) ? '' : 'disabled'}
              title="Input port"
            >
              ▸
            </button>
          </section>
          <section class="uml-section uml-operations">
            <div class="uml-divider-label">operations</div>
            <ul class="uml-list">${outputLines}</ul>
            <button
              class="port-arrow port-out"
              data-action="start-connect"
              data-node-id="${node.id}"
              ${canNodeOutput(node) ? '' : 'disabled'}
              title="Output port"
            >
              ▸
            </button>
          </section>
          <div class="uml-stock tiny">${stockLines || 'stored: empty'}</div>
        </article>
      `
    })
    .join('')

  app.innerHTML = `
    <main class="graph-page">
      <section class="graph-wrap" id="graphWrap">
        <div
          class="graph-camera"
          style="width:${WORLD_WIDTH}px; height:${WORLD_HEIGHT}px; transform: translate(${state.cameraX}px, ${state.cameraY}px) scale(${state.cameraZoom});"
        >
          <svg class="edges" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}" preserveAspectRatio="none">
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" />
              </marker>
            </defs>
            <g id="edgesLayer"></g>
          </svg>
          <div class="node-layer">${nodesHtml}</div>
        </div>
      </section>

      <aside class="top-dock">
        <div class="top-title">Idle Factory - Node Prototype</div>
        <section class="dropdown-panel zoom-panel">
          <div class="zoom-controls">
            <button data-action="zoom-out">-</button>
            <button data-action="zoom-reset">${Math.round(state.cameraZoom * 100)}%</button>
            <button data-action="zoom-in">+</button>
          </div>
        </section>
        <section class="dropdown-panel">
          <button class="panel-toggle" data-action="toggle-warehouse">
            Warehouse ${state.warehousePanelOpen ? '▾' : '▸'}
          </button>
          ${
            state.warehousePanelOpen
              ? `<div class="dropdown-body warehouse">
                  ${warehouseRows}
                </div>`
              : ''
          }
        </section>
        <section class="dropdown-panel build-panel">
          <button class="panel-toggle" data-action="toggle-build">
            Build & Actions ${state.buildPanelOpen ? '▾' : '▸'}
          </button>
          ${
            state.buildPanelOpen
              ? `<div class="dropdown-body toolbar">
                  <button data-action="add-warehouse">+ Warehouse</button>
                  <button data-action="add-machine" data-machine="coalMine">+ Coal Mine</button>
                  <button data-action="add-machine" data-machine="powerPlant">+ Power Plant</button>
                  <button data-action="add-machine" data-machine="woodcutter">+ Woodcutter</button>
                  <button data-action="add-machine" data-machine="sawmill">+ Sawmill</button>
                  <button data-action="add-connector" data-kind="splitter">+ Splitter</button>
                  <button data-action="add-connector" data-kind="merger">+ Merger</button>
                  <button data-action="clear-connect">Cancel Connect</button>
                  <button data-action="clear-edges">Clear Edges</button>
                </div>`
              : ''
          }
        </section>
        <div class="tiny docs-hint">Docs: <code>/new-game/docs/gameplay-reference.html</code></div>
      </aside>
    </main>
  `
  if (!cameraInitialized) {
    cameraInitialized = true
    requestAnimationFrame(() => {
      centerCameraOnWorld()
      render()
    })
    return
  }
  renderEdgesFromPorts()
}

function addMachine(machineKind: MachineKind): void {
  const def = MACHINE_DEFS[machineKind]
  const center = getViewportWorldCenter()
  const node = makeNode(
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
  const center = getViewportWorldCenter()
  const node = makeNode(
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
  const center = getViewportWorldCenter()
  state.nodes.push(
    makeNode(kind, label, center.x - NODE_WIDTH * 0.5 + (Math.random() * 80 - 40), center.y + (Math.random() * 50 - 25)),
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
    const machine = actionEl.getAttribute('data-machine') as MachineKind | null
    if (machine && MACHINE_DEFS[machine]) {
      addMachine(machine)
    }
    return
  }
  if (action === 'add-warehouse') {
    addWarehouse()
    return
  }
  if (action === 'add-connector') {
    const kind = actionEl.getAttribute('data-kind')
    if (kind === 'splitter' || kind === 'merger') {
      addConnector(kind)
    }
    return
  }
  if (action === 'start-connect') {
    const nodeId = actionEl.getAttribute('data-node-id')
    if (nodeId) {
      state.pendingConnectionFrom = nodeId
      connectionPointerClientX = event.clientX
      connectionPointerClientY = event.clientY
      render()
    }
    return
  }
  if (action === 'clear-connect') {
    state.pendingConnectionFrom = null
    connectionPointerClientX = null
    connectionPointerClientY = null
    render()
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
    render()
  }
})

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
  dragNodeId = nodeId
  const world = getWorldPointFromClient(event.clientX, event.clientY)
  if (!world) {
    return
  }
  dragOffsetX = world.x - node.x
  dragOffsetY = world.y - node.y
  ;(target as HTMLElement).setPointerCapture?.(event.pointerId)
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
  if (target.closest('.graph-node') || target.closest('[data-action]')) {
    return
  }
  event.preventDefault()
  isPanning = true
  panLastClientX = event.clientX
  panLastClientY = event.clientY
})

window.addEventListener('pointermove', (event) => {
  if (state.pendingConnectionFrom && !dragNodeId) {
    connectionPointerClientX = event.clientX
    connectionPointerClientY = event.clientY
    render()
    return
  }
  if (isPanning && !dragNodeId) {
    const dx = event.clientX - panLastClientX
    const dy = event.clientY - panLastClientY
    panLastClientX = event.clientX
    panLastClientY = event.clientY
    state.cameraX += dx
    state.cameraY += dy
    clampCamera()
    render()
    return
  }
  if (!dragNodeId) {
    return
  }
  const node = getNode(dragNodeId)
  if (!node) {
    dragNodeId = null
    return
  }
  const wrap = document.getElementById('graphWrap')
  if (!wrap) {
    return
  }
  const world = getWorldPointFromClient(event.clientX, event.clientY)
  if (!world) {
    return
  }
  event.preventDefault()
  node.x = Math.max(10, Math.min(WORLD_WIDTH - NODE_WIDTH - 10, world.x - dragOffsetX))
  node.y = Math.max(10, Math.min(WORLD_HEIGHT - 145, world.y - dragOffsetY))
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
  if (state.pendingConnectionFrom && connectionPointerClientX !== null && connectionPointerClientY !== null) {
    const targetAtPointer = document.elementFromPoint(
      connectionPointerClientX,
      connectionPointerClientY,
    )
    const inPort = targetAtPointer?.closest('.port-in[data-node-id]')
    const toId = inPort?.getAttribute('data-node-id')
    if (toId) {
      createEdge(state.pendingConnectionFrom, toId)
    }
    state.pendingConnectionFrom = null
    connectionPointerClientX = null
    connectionPointerClientY = null
    render()
  }
  dragNodeId = null
  isPanning = false
})

function frame(nowMs: number): void {
  const elapsed = Math.min(0.2, (nowMs - lastTickMs) / 1000)
  lastTickMs = nowMs
  runSimulation(elapsed)
  render()
  requestAnimationFrame(frame)
}

function renderEdgesFromPorts(): void {
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
      const fromX = outRect.left - wrapRect.left + outRect.width * 0.5
      const fromY = outRect.top - wrapRect.top + outRect.height * 0.5
      const toX = inRect.left - wrapRect.left + inRect.width * 0.5
      const toY = inRect.top - wrapRect.top + inRect.height * 0.5
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
      const fromX = outRect.left - wrapRect.left + outRect.width * 0.5
      const fromY = outRect.top - wrapRect.top + outRect.height * 0.5

      let toX = connectionPointerClientX - wrapRect.left
      let toY = connectionPointerClientY - wrapRect.top
      const targetAtPointer = document.elementFromPoint(
        connectionPointerClientX,
        connectionPointerClientY,
      )
      const inPort = targetAtPointer?.closest('.port-in[data-node-id]') as HTMLButtonElement | null
      if (inPort) {
        const inRect = inPort.getBoundingClientRect()
        toX = inRect.left - wrapRect.left + inRect.width * 0.5
        toY = inRect.top - wrapRect.top + inRect.height * 0.5
      }

      const c = Math.max(40, Math.abs(toX - fromX) * 0.45)
      previewPath = `<path class="edge-line edge-line-preview" d="M ${fromX} ${fromY} C ${fromX + c} ${fromY}, ${toX - c} ${toY}, ${toX} ${toY}" />`
    }
  }

  edgesLayer.innerHTML = `${persistedPaths}${previewPath}`
}

render()
requestAnimationFrame(frame)
