import type { MachineDef, MachineKind } from '../types'

export const MACHINE_DEFS: Record<MachineKind, MachineDef> = {
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
