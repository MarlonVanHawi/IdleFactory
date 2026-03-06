import type { ShopItemDef } from '../types'

export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'municipalDynamoAccess',
    name: 'Municipal Dynamo Contract',
    cost: 1000,
    description: 'Passive +2.5 Energy/s to all warehouses.',
    unlockDescription: 'Available from start',
  },
  {
    id: 'publicLibraryAccess',
    name: 'Access to the Public Library',
    cost: 1500,
    description: 'Unlocks the Research dropdown.',
    unlockDescription: 'Available from start',
  },
  {
    id: 'prospectingPickaxes',
    name: 'Prospecting Pickaxes',
    cost: 3500,
    description: 'Unlocks advanced ore industry planning tier.',
    unlockDescription: 'Available from start',
  },
  {
    id: 'bessemerLicense',
    name: 'Bessemer Converter License',
    cost: 6200,
    description: 'Unlocks steel industry planning tier.',
    unlockDescription: 'Available from start',
  },
]
