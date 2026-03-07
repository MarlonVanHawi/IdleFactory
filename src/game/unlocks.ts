import { totalResource } from './simulation'
import type { GameState, MachineKind } from './types'

export function isMachineBuildUnlocked(state: GameState, machineKind: MachineKind): boolean {
  switch (machineKind) {
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
