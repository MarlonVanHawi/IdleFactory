import type { ResearchUpgradeDef } from '../types'

export const RESEARCH_UPGRADES: ResearchUpgradeDef[] = [
  {
    id: 'pickaxe_training',
    name: 'Pickaxe Training Program',
    creditsCost: 350,
    researchCost: 0,
    description: 'Coal Mine output +20%.',
  },
  {
    id: 'improved_drills',
    name: 'Improved Drill Heads',
    creditsCost: 700,
    researchCost: 0,
    description: 'Coal Mine speed +20%.',
  },
  {
    id: 'ore_silos',
    name: 'Ore Silo Expansion',
    creditsCost: 1100,
    researchCost: 0,
    description: 'Warehouse planning upgrade (future storage cap bonus).',
  },
  {
    id: 'conveyor_belts',
    name: 'Belt Conveyor Retrofit',
    creditsCost: 1700,
    researchCost: 0,
    description: 'Sawmill speed +20%.',
  },
  {
    id: 'smelter_insulation',
    name: 'Smelter Insulation',
    creditsCost: 2400,
    researchCost: 0,
    description: 'Power Plant output +15%.',
  },
  {
    id: 'auto_supervisor',
    name: 'Automatic Shift Supervisor',
    creditsCost: 3200,
    researchCost: 30,
    description: 'Automation unlock placeholder.',
  },
]
