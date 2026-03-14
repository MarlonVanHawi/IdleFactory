import type { MachineDef, MachineKind } from '../types'

export const MACHINE_DEFS: Record<MachineKind, MachineDef> = {
  municipalDynamo: {
    label: 'Municipal Dynamo',
    inputs: {},
    outputs: { energy: 2.5 },
    opsPerSecond: 1,
  },
  coalMine: {
    label: 'Coal Mine',
    inputs: { energy: 0.4 },
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
    inputs: { energy: 0.3 },
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
