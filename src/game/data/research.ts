import type { ResearchUpgradeDef } from '../types'

export const RESEARCH_UPGRADES: ResearchUpgradeDef[] = [
  {
    id: 'pickaxe_training',
    name: 'Pickaxe Training Program',
    creditsCost: 350,
    researchCost: 0,
    description: 'Coal Mine output +20%.',
    requirements: {
      minMachineCount: { coalMine: 1 },
    },
  },
  {
    id: 'improved_drills',
    name: 'Improved Drill Heads',
    creditsCost: 700,
    researchCost: 0,
    description: 'Coal Mine speed +20%.',
    requirements: {
      minMachineCount: { coalMine: 2 },
      minGathered: { coal: 120 },
    },
  },
  {
    id: 'ore_silos',
    name: 'Ore Silo Expansion',
    creditsCost: 1100,
    researchCost: 0,
    description: 'Warehouse planning upgrade (future storage cap bonus).',
    requirements: {
      minNodeCount: { warehouse: 2 },
      minGathered: { wood: 80 },
    },
  },
  {
    id: 'conveyor_belts',
    name: 'Belt Conveyor Retrofit',
    creditsCost: 1700,
    researchCost: 0,
    description: 'Sawmill speed +20%.',
    requirements: {
      minMachineCount: { sawmill: 1 },
      minGathered: { lumber: 60 },
    },
  },
  {
    id: 'smelter_insulation',
    name: 'Smelter Insulation',
    creditsCost: 2400,
    researchCost: 0,
    description: 'Power Plant output +15%.',
    requirements: {
      minMachineCount: { powerPlant: 1 },
      minGathered: { energy: 300 },
    },
  },
  {
    id: 'auto_supervisor',
    name: 'Automatic Shift Supervisor',
    creditsCost: 3200,
    researchCost: 30,
    description: 'Automation unlock placeholder.',
    requirements: {
      minMachineCount: { coalMine: 2, woodcutter: 2, sawmill: 1 },
      minGathered: { coal: 250, wood: 200, lumber: 120, energy: 500 },
    },
  },
]
