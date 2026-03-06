import { MACHINE_DEFS } from '../game/data'
import type { GameState, GraphNode, MachineKind, PanelScrollKey } from '../game/types'

export interface InteractionRefs {
  dragNodeId: string | null
  dragOffsetX: number
  dragOffsetY: number
  connectionPointerClientX: number | null
  connectionPointerClientY: number | null
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
  createEdge: (fromId: string, toId: string) => void
  deleteNode: (nodeId: string) => void
  setCameraZoom: (nextZoom: number, anchorClientX?: number, anchorClientY?: number) => void
  getNode: (nodeId: string) => GraphNode | undefined
  getWorldPointFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null
  clampCamera: () => void
  render: () => void
}

function markPanelInteraction(refs: InteractionRefs, durationMs = 650): void {
  refs.panelInteractionUntilMs = Math.max(refs.panelInteractionUntilMs, performance.now() + durationMs)
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
  getWorldPointFromClient,
  clampCamera,
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
      if (machine && machine in MACHINE_DEFS) {
        addMachine(machine as MachineKind)
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
        refs.connectionPointerClientX = event.clientX
        refs.connectionPointerClientY = event.clientY
        refs.connectionDragStarted = false
        render()
      }
      return
    }
    if (action === 'end-connect') {
      const toId = actionEl.getAttribute('data-node-id')
      if (toId && state.pendingConnectionFrom) {
        createEdge(state.pendingConnectionFrom, toId)
        state.pendingConnectionFrom = null
        refs.connectionPointerClientX = null
        refs.connectionPointerClientY = null
        refs.connectionDragStarted = false
        render()
      }
      return
    }
    if (action === 'clear-connect') {
      state.pendingConnectionFrom = null
      refs.connectionPointerClientX = null
      refs.connectionPointerClientY = null
      refs.connectionDragStarted = false
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
      render()
    }
  })

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
    const wrap = target.closest('#graphWrap')
    if (!wrap) {
      return
    }
    if (target.closest('.graph-node') || target.closest('[data-action]')) {
      return
    }
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
    node.x = Math.max(10, Math.min(worldWidth - nodeWidth - 10, world.x - refs.dragOffsetX))
    node.y = Math.max(10, Math.min(worldHeight - 145, world.y - refs.dragOffsetY))
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
    if (
      state.pendingConnectionFrom &&
      refs.connectionDragStarted &&
      refs.connectionPointerClientX !== null &&
      refs.connectionPointerClientY !== null
    ) {
      const targetAtPointer = document.elementFromPoint(
        refs.connectionPointerClientX,
        refs.connectionPointerClientY,
      )
      const inPort = targetAtPointer?.closest('.port-in[data-node-id]')
      const toId = inPort?.getAttribute('data-node-id')
      if (toId) {
        createEdge(state.pendingConnectionFrom, toId)
      }
      state.pendingConnectionFrom = null
      refs.connectionPointerClientX = null
      refs.connectionPointerClientY = null
      refs.connectionDragStarted = false
      render()
    }
    refs.dragNodeId = null
    refs.isPanning = false
  })
}
