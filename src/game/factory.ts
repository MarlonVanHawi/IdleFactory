import { createEmptyInventory } from './simulation'
import type { GraphNode, MachineKind, NodeKind } from './types'

let edgeIdCounter = 0

export function createNode(kind: NodeKind, label: string, x: number, y: number, machineKind?: MachineKind): GraphNode {
  return {
    id: `n-${kind}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    kind,
    label,
    x,
    y,
    machineKind,
    inventory: createEmptyInventory(),
  }
}

export function nextEdgeId(): string {
  edgeIdCounter += 1
  return `e-${edgeIdCounter}`
}
