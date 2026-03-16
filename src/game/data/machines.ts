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
    outputs: { energy: 5 },
    opsPerSecond: 0.75,
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
  ironMine: {
    label: 'Iron Mine',
    inputs: { energy: 0.55 },
    outputs: { ironOre: 1 },
    opsPerSecond: 0.95,
  },
  ironSmelter: {
    label: 'Iron Smelter',
    inputs: { ironOre: 1, coal: 0.35 },
    outputs: { ironPlate: 1 },
    opsPerSecond: 0.72,
  },
  copperMine: {
    label: 'Copper Mine',
    inputs: { energy: 0.6 },
    outputs: { copperOre: 1 },
    opsPerSecond: 0.9,
  },
  copperSmelter: {
    label: 'Copper Smelter',
    inputs: { copperOre: 1, coal: 0.3 },
    outputs: { copperIngot: 1 },
    opsPerSecond: 0.75,
  },
  wireMill: {
    label: 'Wire Mill',
    inputs: { copperIngot: 1, energy: 0.25 },
    outputs: { copperWire: 1.35 },
    opsPerSecond: 0.9,
  },
  steelworks: {
    label: 'Steelworks',
    inputs: { ironPlate: 1.4, coal: 0.6, energy: 0.5 },
    outputs: { steel: 1 },
    opsPerSecond: 0.55,
  },
  machineShop: {
    label: 'Machine Shop',
    inputs: { steel: 1, copperWire: 1, energy: 0.5 },
    outputs: { machineParts: 1.2 },
    opsPerSecond: 0.55,
  },
}
