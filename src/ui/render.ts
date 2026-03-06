import { ALL_RESOURCES, MACHINE_DEFS, RESEARCH_UPGRADES, RESOURCE_LABELS, SHOP_ITEMS } from '../game/data'
import { canAffordCosts, totalResource, warehouseInventory } from '../game/simulation'
import type { GameState, GraphNode } from '../game/types'

interface RenderAppOptions {
  state: GameState
  worldWidth: number
  worldHeight: number
  dragNodeId: string | null
}

function formatNumber(value: number): string {
  if (value >= 1000) {
    return value.toFixed(0)
  }
  if (value >= 100) {
    return value.toFixed(1)
  }
  return value.toFixed(2)
}

function canNodeOutput(node: GraphNode): boolean {
  return node.kind !== 'warehouse'
}

function canNodeInput(_node: GraphNode): boolean {
  return true
}

export function renderApp({ state, worldWidth, worldHeight, dragNodeId }: RenderAppOptions): string {
  const warehouse = warehouseInventory(state)
  const totalCredits = totalResource(state, 'credits')
  const totalResearch = totalResource(state, 'research')
  const warehouseRows = ALL_RESOURCES.map(
    (resource) => `<div>${RESOURCE_LABELS[resource]}: ${formatNumber(warehouse[resource])}</div>`,
  ).join('')
  const shopRows = SHOP_ITEMS.map((item) => {
    const bought = state.shopPurchased[item.id]
    const affordable = totalCredits >= item.cost
    return `
      <article class="meta-row">
        <div class="meta-title">${item.name}</div>
        <div class="tiny">${item.description}</div>
        <div class="tiny">Unlock: ${item.unlockDescription}</div>
        <button
          data-action="buy-shop-item"
          data-shop-id="${item.id}"
          ${bought || !affordable ? 'disabled' : ''}
        >
          ${bought ? 'Owned' : `Buy (${formatNumber(item.cost)} credits)`}
        </button>
      </article>
    `
  }).join('')

  const researchUnlocked = state.shopPurchased.publicLibraryAccess
  const researchRows = RESEARCH_UPGRADES.map((upgrade) => {
    const bought = state.upgradesPurchased[upgrade.id]
    const affordable = canAffordCosts(state, upgrade.creditsCost, upgrade.researchCost)
    const costText =
      upgrade.researchCost > 0
        ? `${formatNumber(upgrade.creditsCost)} credits + ${formatNumber(upgrade.researchCost)} research`
        : `${formatNumber(upgrade.creditsCost)} credits`
    return `
      <article class="meta-row">
        <div class="meta-title">${upgrade.name}</div>
        <div class="tiny">${upgrade.description}</div>
        <button
          data-action="buy-upgrade"
          data-upgrade-id="${upgrade.id}"
          ${!researchUnlocked || bought || !affordable ? 'disabled' : ''}
        >
          ${bought ? 'Researched' : `Research (${costText})`}
        </button>
      </article>
    `
  }).join('')

  const nodesHtml = state.nodes
    .map((node) => {
      const machineDef = node.machineKind ? MACHINE_DEFS[node.machineKind] : null
      const inputEntries = machineDef
        ? Object.entries(machineDef.inputs)
        : node.kind === 'warehouse'
          ? [['storage', 1]]
          : [['any', 1]]
      const outputEntries = machineDef
        ? Object.entries(machineDef.outputs)
        : node.kind === 'warehouse'
          ? [['none', 0]]
          : [['any', 1]]
      const inputLines =
        inputEntries
          .map(([resource, amount]) => `<li>+ ${resource}: ${amount}/cycle</li>`)
          .join('') || '<li>- none</li>'
      const outputLines =
        outputEntries
          .map(([resource, amount]) => `<li>+ ${resource}: ${amount}/cycle</li>`)
          .join('') || '<li>- none</li>'
      const stockLines = ALL_RESOURCES.filter((resource) => node.inventory[resource] > 0.001)
        .map((resource) => `${resource} ${formatNumber(node.inventory[resource])}`)
        .join(' | ')
      const connectHint =
        state.pendingConnectionFrom && state.pendingConnectionFrom === node.id
          ? '<span class="pill pending">connecting...</span>'
          : ''
      return `
        <article
          class="graph-node kind-${node.kind} ${dragNodeId === node.id ? 'is-dragging' : ''}"
          data-node-id="${node.id}"
          style="left:${node.x}px; top:${node.y}px;"
        >
          <div class="node-head" data-drag-handle="${node.id}">
            <div class="node-head-left">
              <button class="danger head-remove" data-action="delete-node" data-node-id="${node.id}">X</button>
            </div>
            <strong class="node-title">${node.label}</strong>
            <div class="node-head-right">
              ${connectHint}
            </div>
          </div>
          <section class="uml-section uml-attributes">
            <div class="uml-divider-label">attributes</div>
            <ul class="uml-list">${inputLines}</ul>
            <button
              class="port-arrow port-in"
              data-action="end-connect"
              data-node-id="${node.id}"
              ${canNodeInput(node) ? '' : 'disabled'}
              title="Input port"
            >
              ▸
            </button>
          </section>
          <section class="uml-section uml-operations">
            <div class="uml-divider-label">operations</div>
            <ul class="uml-list">${outputLines}</ul>
            <button
              class="port-arrow port-out"
              data-action="start-connect"
              data-node-id="${node.id}"
              ${canNodeOutput(node) ? '' : 'disabled'}
              title="Output port"
            >
              ▸
            </button>
          </section>
          <div class="uml-stock tiny">${stockLines || 'stored: empty'}</div>
        </article>
      `
    })
    .join('')

  return `
    <main class="graph-page">
      <section class="graph-wrap" id="graphWrap">
        <div
          class="graph-camera"
          style="width:${worldWidth}px; height:${worldHeight}px; transform: translate(${state.cameraX}px, ${state.cameraY}px) scale(${state.cameraZoom});"
        >
          <svg class="edges" viewBox="0 0 ${worldWidth} ${worldHeight}" preserveAspectRatio="none">
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" />
              </marker>
            </defs>
            <g id="edgesLayer"></g>
          </svg>
          <div class="node-layer">${nodesHtml}</div>
        </div>
      </section>

      <aside class="top-dock">
        <section class="dropdown-panel">
          <button class="panel-toggle" data-action="toggle-warehouse">
            Warehouse ${state.warehousePanelOpen ? '▾' : '▸'}
          </button>
          ${
            state.warehousePanelOpen
              ? `<div class="dropdown-body warehouse" data-scroll-key="warehouse">
                  ${warehouseRows}
                </div>`
              : ''
          }
        </section>
        <section class="dropdown-panel build-panel">
          <button class="panel-toggle" data-action="toggle-build">
            Build & Actions ${state.buildPanelOpen ? '▾' : '▸'}
          </button>
          ${
            state.buildPanelOpen
              ? `<div class="dropdown-body toolbar" data-scroll-key="build">
                  <button data-action="add-warehouse">+ Warehouse</button>
                  <button data-action="add-machine" data-machine="coalMine">+ Coal Mine</button>
                  <button data-action="add-machine" data-machine="powerPlant">+ Power Plant</button>
                  <button data-action="add-machine" data-machine="woodcutter">+ Woodcutter</button>
                  <button data-action="add-machine" data-machine="sawmill">+ Sawmill</button>
                  <button data-action="add-connector" data-kind="splitter">+ Splitter</button>
                  <button data-action="add-connector" data-kind="merger">+ Merger</button>
                  <button data-action="clear-connect">Cancel Connect</button>
                  <button data-action="clear-edges">Clear Edges</button>
                </div>`
              : ''
          }
        </section>
        <section class="dropdown-panel">
          <button class="panel-toggle" data-action="toggle-research">
            Research ${state.researchPanelOpen ? '▾' : '▸'}
          </button>
          ${
            state.researchPanelOpen
              ? `<div class="dropdown-body" data-scroll-key="research">
                  <div class="tiny">Credits: ${formatNumber(totalCredits)} | Research: ${formatNumber(totalResearch)}</div>
                  ${
                    researchUnlocked
                      ? researchRows
                      : '<div class="tiny muted">Locked: buy Access to the Public Library in Shop.</div>'
                  }
                </div>`
              : ''
          }
        </section>
        <section class="dropdown-panel">
          <button class="panel-toggle" data-action="toggle-shop">
            Shop ${state.shopPanelOpen ? '▾' : '▸'}
          </button>
          ${
            state.shopPanelOpen
              ? `<div class="dropdown-body" data-scroll-key="shop">
                  <div class="tiny">Credits available: ${formatNumber(totalCredits)}</div>
                  ${shopRows}
                </div>`
              : ''
          }
        </section>
      </aside>
    </main>
  `
}
