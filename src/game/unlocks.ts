import { totalResource } from './simulation'
import type { GameState, MachineKind, NodeKind, ResearchRequirements, ShopId } from './types'

export function isMachineBuildUnlocked(state: GameState, machineKind: MachineKind): boolean {
  switch (machineKind) {
    case 'municipalDynamo':
      return state.shopPurchased.municipalDynamoAccess
    case 'coalMine':
      return true
    case 'woodcutter':
      return true
    case 'sawmill':
      return totalResource(state, 'wood') >= 30
    case 'ironMine':
      return state.shopPurchased.prospectingPickaxes
    case 'ironSmelter':
      return state.shopPurchased.prospectingPickaxes && totalResource(state, 'ironOre') >= 24
    case 'copperMine':
      return state.shopPurchased.prospectingPickaxes && totalResource(state, 'ironPlate') >= 14
    case 'copperSmelter':
      return state.shopPurchased.prospectingPickaxes && totalResource(state, 'copperOre') >= 22
    case 'wireMill':
      return state.shopPurchased.prospectingPickaxes && totalResource(state, 'copperIngot') >= 18
    case 'steelworks':
      return state.shopPurchased.prospectingPickaxes && totalResource(state, 'ironPlate') >= 42
    case 'machineShop':
      return (
        state.shopPurchased.prospectingPickaxes &&
        totalResource(state, 'steel') >= 22 &&
        totalResource(state, 'copperWire') >= 40
      )
    case 'powerPlant':
      // Power comes from Public Dynamo early-game; plant is a later manual power path.
      return state.shopPurchased.municipalDynamoAccess && totalResource(state, 'coal') >= 45
    default:
      return false
  }
}

export function isShopItemUnlocked(state: GameState, shopId: ShopId): boolean {
  switch (shopId) {
    case 'municipalDynamoAccess':
      return true
    case 'publicLibraryAccess':
      return true
    case 'prospectingPickaxes':
      return state.shopPurchased.publicLibraryAccess
    case 'bessemerLicense':
      return state.shopPurchased.prospectingPickaxes
    default:
      return false
  }
}

export function countMachineNodes(state: GameState, machineKind: MachineKind): number {
  let count = 0
  for (const node of state.nodes) {
    if (node.kind === 'machine' && node.machineKind === machineKind) {
      count += 1
    }
  }
  return count
}

export function countNodesByKind(state: GameState, nodeKind: NodeKind): number {
  return state.nodes.reduce((sum, node) => (node.kind === nodeKind ? sum + 1 : sum), 0)
}

export function areResearchRequirementsMet(
  state: GameState,
  requirements?: ResearchRequirements,
): boolean {
  if (!requirements) {
    return true
  }

  const machineReqs = requirements.minMachineCount ?? {}
  for (const [machineKind, required] of Object.entries(machineReqs)) {
    const needed = required ?? 0
    if (needed <= 0) {
      continue
    }
    if (countMachineNodes(state, machineKind as MachineKind) < needed) {
      return false
    }
  }

  const nodeReqs = requirements.minNodeCount ?? {}
  for (const [nodeKind, required] of Object.entries(nodeReqs)) {
    const needed = required ?? 0
    if (needed <= 0) {
      continue
    }
    if (countNodesByKind(state, nodeKind as NodeKind) < needed) {
      return false
    }
  }

  const gatheredReqs = requirements.minGathered ?? {}
  for (const [resource, required] of Object.entries(gatheredReqs)) {
    const needed = required ?? 0
    if (needed <= 0) {
      continue
    }
    const gathered = state.lifetimeGathered[resource as keyof GameState['lifetimeGathered']] ?? 0
    if (gathered < needed) {
      return false
    }
  }

  return true
}
