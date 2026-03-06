import { ALL_RESOURCES, MACHINE_DEFS, RESEARCH_UPGRADES, SHOP_ITEMS } from './data'
import type { GameState, GraphEdge, GraphNode, Inventory, MachineDef, MachineKind, ResourceId, ShopId, UpgradeId } from './types'

export function createEmptyInventory(): Inventory {
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

function getOutgoingEdges(state: GameState, nodeId: string): GraphEdge[] {
  return state.edges.filter((edge) => edge.from === nodeId)
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

function getRuntimeMachineDef(state: GameState, machineKind: MachineKind): MachineDef {
  const base = MACHINE_DEFS[machineKind]
  let opsPerSecond = base.opsPerSecond
  const outputs = { ...base.outputs }

  if (machineKind === 'coalMine' && state.upgradesPurchased.pickaxe_training) {
    outputs.coal = (outputs.coal ?? 0) * 1.2
  }
  if (machineKind === 'coalMine' && state.upgradesPurchased.improved_drills) {
    opsPerSecond *= 1.2
  }
  if (machineKind === 'sawmill' && state.upgradesPurchased.conveyor_belts) {
    opsPerSecond *= 1.2
  }
  if (machineKind === 'powerPlant' && state.upgradesPurchased.smelter_insulation) {
    outputs.energy = (outputs.energy ?? 0) * 1.15
  }

  return {
    ...base,
    opsPerSecond,
    outputs,
  }
}

function addPassiveToWarehouses(state: GameState, resource: ResourceId, amount: number): void {
  if (amount <= 0) {
    return
  }
  const warehouses = state.nodes.filter((node) => node.kind === 'warehouse')
  if (warehouses.length === 0) {
    return
  }
  const perWarehouse = amount / warehouses.length
  for (const warehouse of warehouses) {
    addResource(warehouse.inventory, resource, perWarehouse)
  }
}

export function runSimulation(state: GameState, dt: number): void {
  if (state.shopPurchased.municipalDynamoAccess) {
    addPassiveToWarehouses(state, 'energy', 2.5 * dt)
  }
  for (const node of state.nodes) {
    if (node.kind !== 'machine' || !node.machineKind) {
      continue
    }
    const def = getRuntimeMachineDef(state, node.machineKind)
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
    incoming[node.id] = createEmptyInventory()
  }
  const edgeCapacityRemaining = new Map<string, number>()
  for (const edge of state.edges) {
    edgeCapacityRemaining.set(edge.id, edge.capacityPerSecond * dt)
  }

  for (const node of state.nodes) {
    const outs = getOutgoingEdges(state, node.id)
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

function nodesByResourceAvailability(state: GameState, resource: ResourceId): GraphNode[] {
  return [...state.nodes]
    .filter((node) => node.inventory[resource] > 0)
    .sort((a, b) => b.inventory[resource] - a.inventory[resource])
}

export function totalResource(state: GameState, resource: ResourceId): number {
  return state.nodes.reduce((sum, node) => sum + node.inventory[resource], 0)
}

export function canAffordCosts(state: GameState, creditsCost: number, researchCost: number): boolean {
  return totalResource(state, 'credits') >= creditsCost && totalResource(state, 'research') >= researchCost
}

function spendResourceFromNodes(state: GameState, resource: ResourceId, amount: number): boolean {
  if (amount <= 0) {
    return true
  }
  if (totalResource(state, resource) + 1e-9 < amount) {
    return false
  }
  let remaining = amount
  const contributors = nodesByResourceAvailability(state, resource)
  for (const node of contributors) {
    if (remaining <= 0) {
      break
    }
    const take = Math.min(node.inventory[resource], remaining)
    node.inventory[resource] -= take
    remaining -= take
  }
  return remaining <= 1e-6
}

function spendCosts(state: GameState, creditsCost: number, researchCost: number): boolean {
  if (!canAffordCosts(state, creditsCost, researchCost)) {
    return false
  }
  if (!spendResourceFromNodes(state, 'credits', creditsCost)) {
    return false
  }
  if (!spendResourceFromNodes(state, 'research', researchCost)) {
    return false
  }
  return true
}

export function buyShopItem(state: GameState, id: ShopId): boolean {
  if (state.shopPurchased[id]) {
    return false
  }
  const item = SHOP_ITEMS.find((entry) => entry.id === id)
  if (!item) {
    return false
  }
  if (!spendCosts(state, item.cost, 0)) {
    return false
  }
  state.shopPurchased[id] = true
  return true
}

export function buyResearchUpgrade(state: GameState, id: UpgradeId): boolean {
  if (!state.shopPurchased.publicLibraryAccess || state.upgradesPurchased[id]) {
    return false
  }
  const upgrade = RESEARCH_UPGRADES.find((entry) => entry.id === id)
  if (!upgrade) {
    return false
  }
  if (!spendCosts(state, upgrade.creditsCost, upgrade.researchCost)) {
    return false
  }
  state.upgradesPurchased[id] = true
  return true
}

export function warehouseInventory(state: GameState): Inventory {
  const warehouse = state.nodes.find((node) => node.kind === 'warehouse')
  return warehouse ? warehouse.inventory : createEmptyInventory()
}
