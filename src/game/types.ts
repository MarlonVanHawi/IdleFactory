export type ResourceId =
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

export type NodeKind = 'warehouse' | 'machine' | 'splitter' | 'merger'
export type MachineKind = 'coalMine' | 'powerPlant' | 'woodcutter' | 'sawmill'
export type PanelScrollKey = 'warehouse' | 'build' | 'research' | 'shop'

export type ShopId =
  | 'municipalDynamoAccess'
  | 'publicLibraryAccess'
  | 'prospectingPickaxes'
  | 'bessemerLicense'

export type UpgradeId =
  | 'pickaxe_training'
  | 'improved_drills'
  | 'ore_silos'
  | 'conveyor_belts'
  | 'smelter_insulation'
  | 'auto_supervisor'

export type Inventory = Record<ResourceId, number>

export interface MachineDef {
  label: string
  inputs: Partial<Record<ResourceId, number>>
  outputs: Partial<Record<ResourceId, number>>
  opsPerSecond: number
}

export interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  x: number
  y: number
  machineKind?: MachineKind
  inventory: Inventory
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  capacityPerSecond: number
  routePoints: Array<{ x: number; y: number }>
  isRouteManual: boolean
}

export interface ShopItemDef {
  id: ShopId
  name: string
  cost: number
  description: string
  unlockDescription: string
}

export interface ResearchUpgradeDef {
  id: UpgradeId
  name: string
  creditsCost: number
  researchCost: number
  description: string
}

export interface GameState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  walletCredits: number
  snapMode: boolean
  selectedEdgeId: string | null
  pendingConnectionFrom: string | null
  warehousePanelOpen: boolean
  buildPanelOpen: boolean
  researchPanelOpen: boolean
  shopPanelOpen: boolean
  shopPurchased: Record<ShopId, boolean>
  upgradesPurchased: Record<UpgradeId, boolean>
  panelScrollTop: Record<PanelScrollKey, number>
  cameraX: number
  cameraY: number
  cameraZoom: number
}
