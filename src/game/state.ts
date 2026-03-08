import type { GameState } from './types'

export const NODE_WIDTH = 189
export const WORLD_WIDTH = 4200
export const WORLD_HEIGHT = 4200
export const MIN_ZOOM = 0.45
export const MAX_ZOOM = 2.25
export const WORLD_CENTER_X = WORLD_WIDTH * 0.5
export const WORLD_CENTER_Y = WORLD_HEIGHT * 0.5
export const UI_RENDER_INTERVAL_MS = 120
export const NODE_CLEARANCE_PX = 10
export const GRID_SNAP_X = 252
export const GRID_SNAP_Y = 228
export const GRID_SNAP_OFFSET_X = -21
export const GRID_SNAP_OFFSET_Y = -19

export function createInitialState(): GameState {
  return {
    nodes: [],
    edges: [],
    walletCredits: 2500,
    snapMode: false,
    selectedEdgeId: null,
    pendingConnectionFrom: null,
    warehousePanelOpen: false,
    buildPanelOpen: false,
    researchPanelOpen: false,
    shopPanelOpen: false,
    shopPurchased: {
      municipalDynamoAccess: false,
      publicLibraryAccess: false,
      prospectingPickaxes: false,
      bessemerLicense: false,
    },
    upgradesPurchased: {
      pickaxe_training: false,
      improved_drills: false,
      ore_silos: false,
      conveyor_belts: false,
      smelter_insulation: false,
      auto_supervisor: false,
    },
    panelScrollTop: {
      warehouse: 0,
      build: 0,
      research: 0,
      shop: 0,
    },
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1,
  }
}
