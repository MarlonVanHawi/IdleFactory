import { totalResource } from './simulation'
import type { GameState, MachineKind, ShopId } from './types'

export function isMachineBuildUnlocked(state: GameState, machineKind: MachineKind): boolean {
  switch (machineKind) {
    case 'municipalDynamo':
      return state.shopPurchased.municipalDynamoAccess
    case 'coalMine':
      return true
    case 'woodcutter':
      return true
    case 'sawmill':
      return totalResource(state, 'wood') >= 40
    case 'powerPlant':
      // Power comes from Public Dynamo early-game; plant is a later manual power path.
      return state.shopPurchased.municipalDynamoAccess && totalResource(state, 'coal') >= 60
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
