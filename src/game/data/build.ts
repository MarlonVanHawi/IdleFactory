import type { MachineKind } from '../types'

export const BUILD_COSTS: {
  warehouse: number
  connectors: Record<'splitter' | 'merger', number>
  machines: Record<MachineKind, number>
} = {
  warehouse: 180,
  connectors: {
    splitter: 90,
    merger: 90,
  },
  machines: {
    coalMine: 240,
    woodcutter: 220,
    sawmill: 420,
    powerPlant: 680,
  },
}
