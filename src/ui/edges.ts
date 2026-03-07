import { NODE_CLEARANCE_PX } from '../game/state'
import type { GameState } from '../game/types'

interface RenderEdgesOptions {
  state: GameState
  connectionPointerClientX: number | null
  connectionPointerClientY: number | null
  connectionRoutePoints: Array<{ x: number; y: number }>
}

const OUTPUT_LEAD_PX = 18
const INPUT_APPROACH_PX = 18
const OUTSIDE_GAP_PX = NODE_CLEARANCE_PX
const BEND_PENALTY = 24

interface WorldRect {
  left: number
  right: number
  top: number
  bottom: number
}

interface Point {
  x: number
  y: number
}

function rectToWorld(rect: DOMRect, wrapRect: DOMRect, state: GameState): WorldRect {
  return {
    left: (rect.left - wrapRect.left - state.cameraX) / state.cameraZoom,
    right: (rect.right - wrapRect.left - state.cameraX) / state.cameraZoom,
    top: (rect.top - wrapRect.top - state.cameraY) / state.cameraZoom,
    bottom: (rect.bottom - wrapRect.top - state.cameraY) / state.cameraZoom,
  }
}

function inflateRect(rect: WorldRect, by: number): WorldRect {
  return {
    left: rect.left - by,
    right: rect.right + by,
    top: rect.top - by,
    bottom: rect.bottom + by,
  }
}

function isAxisAligned(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.001 || Math.abs(a.y - b.y) < 0.001
}

function segmentBlocked(a: Point, b: Point, obstacles: WorldRect[]): boolean {
  if (!isAxisAligned(a, b)) {
    return true
  }
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  for (const obstacle of obstacles) {
    if (Math.abs(a.y - b.y) < 0.001) {
      const y = a.y
      if (y > obstacle.top && y < obstacle.bottom && maxX > obstacle.left && minX < obstacle.right) {
        return true
      }
    } else {
      const x = a.x
      if (x > obstacle.left && x < obstacle.right && maxY > obstacle.top && minY < obstacle.bottom) {
        return true
      }
    }
  }
  return false
}

function polylineIntersectsRects(points: Point[], rects: WorldRect[]): boolean {
  for (let i = 1; i < points.length; i += 1) {
    if (segmentBlocked(points[i - 1], points[i], rects)) {
      return true
    }
  }
  return false
}

function polylineIntersectsRectsMiddleSegments(points: Point[], rects: WorldRect[]): boolean {
  // Permit the first/last tiny connector segments at source/target ports.
  for (let i = 1; i < points.length; i += 1) {
    if (i === 1 || i === points.length - 1) {
      continue
    }
    if (segmentBlocked(points[i - 1], points[i], rects)) {
      return true
    }
  }
  return false
}

function normalizePolyline(points: Point[]): Point[] {
  const out: Point[] = []
  for (const point of points) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev.x - point.x) < 0.001 && Math.abs(prev.y - point.y) < 0.001) {
      continue
    }
    out.push({ x: point.x, y: point.y })
  }
  const compact: Point[] = []
  for (const point of out) {
    const a = compact[compact.length - 2]
    const b = compact[compact.length - 1]
    if (!a || !b) {
      compact.push(point)
      continue
    }
    if (
      (Math.abs(a.x - b.x) < 0.001 && Math.abs(b.x - point.x) < 0.001) ||
      (Math.abs(a.y - b.y) < 0.001 && Math.abs(b.y - point.y) < 0.001)
    ) {
      compact[compact.length - 1] = point
      continue
    }
    compact.push(point)
  }
  return compact
}

function polylineCost(points: Point[]): number {
  let distance = 0
  let bends = 0
  let prevDir: 'h' | 'v' | null = null
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    distance += Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    const dir: 'h' | 'v' = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'h' : 'v'
    if (prevDir && dir !== prevDir) {
      bends += 1
    }
    prevDir = dir
  }
  return distance + bends * BEND_PENALTY
}

function tryPath(start: Point, end: Point, via: Point[], obstacles: WorldRect[]): Point[] | null {
  const points = normalizePolyline([start, ...via, end])
  for (let i = 1; i < points.length; i += 1) {
    if (segmentBlocked(points[i - 1], points[i], obstacles)) {
      return null
    }
  }
  return points
}

function chooseBestPath(start: Point, end: Point, obstacles: WorldRect[]): Point[] {
  const candidates: Point[][] = []

  const xCandidates = new Set<number>([start.x, end.x, (start.x + end.x) * 0.5])
  const yCandidates = new Set<number>([start.y, end.y, (start.y + end.y) * 0.5])
  let minLeft = Math.min(start.x, end.x)
  let maxRight = Math.max(start.x, end.x)
  let minTop = Math.min(start.y, end.y)
  let maxBottom = Math.max(start.y, end.y)
  for (const obstacle of obstacles) {
    xCandidates.add(obstacle.left)
    xCandidates.add(obstacle.right)
    yCandidates.add(obstacle.top)
    yCandidates.add(obstacle.bottom)
    minLeft = Math.min(minLeft, obstacle.left)
    maxRight = Math.max(maxRight, obstacle.right)
    minTop = Math.min(minTop, obstacle.top)
    maxBottom = Math.max(maxBottom, obstacle.bottom)
  }
  // Guaranteed global outside corridors for robust rerouting after node moves.
  xCandidates.add(minLeft - OUTSIDE_GAP_PX * 2)
  xCandidates.add(maxRight + OUTSIDE_GAP_PX * 2)
  yCandidates.add(minTop - OUTSIDE_GAP_PX * 2)
  yCandidates.add(maxBottom + OUTSIDE_GAP_PX * 2)
  const xs = Array.from(xCandidates)
  const ys = Array.from(yCandidates)

  candidates.push([])
  for (const x of xs) {
    candidates.push([{ x, y: start.y }, { x, y: end.y }])
  }
  for (const y of ys) {
    candidates.push([{ x: start.x, y }, { x: end.x, y }])
  }
  for (const x of xs) {
    for (const y of ys) {
      candidates.push([{ x, y: start.y }, { x, y }, { x: end.x, y }])
      candidates.push([{ x: start.x, y }, { x, y }, { x, y: end.y }])
    }
  }

  let best: Point[] | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const via of candidates) {
    const maybe = tryPath(start, end, via, obstacles)
    if (!maybe) {
      continue
    }
    const score = polylineCost(maybe)
    if (score < bestScore) {
      best = maybe
      bestScore = score
    }
  }

  if (best) {
    return best
  }

  // Hard fallback: route on the global right corridor (outside all obstacles).
  const safeX = maxRight + OUTSIDE_GAP_PX * 3
  return normalizePolyline([
    start,
    { x: safeX, y: start.y },
    { x: safeX, y: end.y },
    end,
  ])
}

function routeBetweenAnchors(start: Point, end: Point, waypoints: Point[], obstacles: WorldRect[]): Point[] {
  const targets = [...waypoints, end]
  let current = start
  let full: Point[] = [start]
  for (const target of targets) {
    const leg = chooseBestPath(current, target, obstacles)
    full = [...full, ...leg.slice(1)]
    current = target
  }
  return normalizePolyline(full)
}

function buildEdgePolyline(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  waypoints: Point[],
  obstacles: WorldRect[],
  sourceRect: WorldRect | null,
  targetRect: WorldRect | null,
): Point[] {
  const sourceOutsideX = sourceRect ? sourceRect.right + OUTSIDE_GAP_PX : fromX + OUTPUT_LEAD_PX
  const targetOutsideX = targetRect ? targetRect.left - OUTSIDE_GAP_PX : toX - INPUT_APPROACH_PX
  const leadStartX = Math.max(fromX + OUTPUT_LEAD_PX, sourceOutsideX)
  const leadEndX = Math.min(toX - INPUT_APPROACH_PX, targetOutsideX)
  const leadStart: Point = { x: leadStartX, y: fromY }
  const leadEnd: Point = { x: leadEndX, y: toY }
  const core = routeBetweenAnchors(leadStart, leadEnd, waypoints, obstacles)
  return normalizePolyline([{ x: fromX, y: fromY }, ...core, { x: toX, y: toY }])
}

function buildFreePreviewPolyline(fromX: number, fromY: number, toX: number, toY: number, waypoints: Point[]): Point[] {
  const leadStart: Point = { x: fromX + OUTPUT_LEAD_PX, y: fromY }
  const leadEnd: Point = { x: toX, y: toY }
  const core = routeBetweenAnchors(leadStart, leadEnd, waypoints, [])
  return normalizePolyline([{ x: fromX, y: fromY }, ...core])
}

function buildForcedOutsideDetour(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  obstacles: WorldRect[],
  sourceRect: WorldRect | null,
  targetRect: WorldRect | null,
): Point[] {
  const sourceOutsideX = sourceRect ? sourceRect.right + OUTSIDE_GAP_PX : fromX + OUTPUT_LEAD_PX
  const targetOutsideX = targetRect ? targetRect.left - OUTSIDE_GAP_PX : toX - INPUT_APPROACH_PX
  const startX = Math.max(fromX + OUTPUT_LEAD_PX, sourceOutsideX)
  const endX = Math.min(toX - INPUT_APPROACH_PX, targetOutsideX)
  const start = { x: startX, y: fromY }
  const end = { x: endX, y: toY }

  const yCandidates = new Set<number>([fromY, toY])
  let minTop = Math.min(fromY, toY)
  let maxBottom = Math.max(fromY, toY)
  for (const obstacle of obstacles) {
    yCandidates.add(obstacle.top)
    yCandidates.add(obstacle.bottom)
    minTop = Math.min(minTop, obstacle.top)
    maxBottom = Math.max(maxBottom, obstacle.bottom)
  }
  yCandidates.add(minTop - OUTSIDE_GAP_PX * 2)
  yCandidates.add(maxBottom + OUTSIDE_GAP_PX * 2)

  let best: Point[] | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const y of yCandidates) {
    const points = normalizePolyline([
      { x: fromX, y: fromY },
      start,
      { x: start.x, y },
      { x: end.x, y },
      end,
      { x: toX, y: toY },
    ])
    if (polylineIntersectsRects(points, obstacles)) {
      continue
    }
    const score = polylineCost(points)
    if (score < bestScore) {
      best = points
      bestScore = score
    }
  }

  if (best) {
    return best
  }
  return normalizePolyline([
    { x: fromX, y: fromY },
    start,
    { x: start.x, y: minTop - OUTSIDE_GAP_PX * 3 },
    { x: end.x, y: minTop - OUTSIDE_GAP_PX * 3 },
    end,
    { x: toX, y: toY },
  ])
}

function buildPathData(points: Point[]): string {
  if (points.length === 0) {
    return ''
  }
  return points.reduce((acc, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`
    }
    return `${acc} L ${point.x} ${point.y}`
  }, '')
}

export function renderEdgesFromPorts({
  state,
  connectionPointerClientX,
  connectionPointerClientY,
  connectionRoutePoints,
}: RenderEdgesOptions): void {
  const wrap = document.getElementById('graphWrap')
  const edgesLayer = document.getElementById('edgesLayer')
  if (!wrap || !edgesLayer) {
    return
  }
  const wrapRect = wrap.getBoundingClientRect()
  const nodeRectMap = new Map<string, WorldRect>()
  const nodeRects = wrap.querySelectorAll('.graph-node[data-node-id]')
  nodeRects.forEach((nodeEl) => {
    const nodeId = nodeEl.getAttribute('data-node-id')
    if (!nodeId) {
      return
    }
    nodeRectMap.set(nodeId, rectToWorld((nodeEl as HTMLElement).getBoundingClientRect(), wrapRect, state))
  })

  const persistedPaths = state.edges
    .map((edge) => {
      const outPort = wrap.querySelector(
        `.port-out[data-node-id="${edge.from}"]`,
      ) as HTMLButtonElement | null
      const inPort = wrap.querySelector(
        `.port-in[data-node-id="${edge.to}"]`,
      ) as HTMLButtonElement | null
      if (!outPort || !inPort) {
        return ''
      }
      const outRect = outPort.getBoundingClientRect()
      const inRect = inPort.getBoundingClientRect()
      const fromX =
        (outRect.right - wrapRect.left - state.cameraX) / state.cameraZoom
      const fromY =
        (outRect.top - wrapRect.top + outRect.height * 0.5 - state.cameraY) / state.cameraZoom
      const toX =
        (inRect.left - wrapRect.left - state.cameraX) / state.cameraZoom
      const toY =
        (inRect.top - wrapRect.top + inRect.height * 0.5 - state.cameraY) / state.cameraZoom
      const sourceRect = nodeRectMap.get(edge.from) ?? null
      const targetRect = nodeRectMap.get(edge.to) ?? null
      const obstacles = Array.from(nodeRectMap.values()).map((rect) => inflateRect(rect, OUTSIDE_GAP_PX))
      const strictRects = obstacles
      const manualPolyline = buildEdgePolyline(
        fromX,
        fromY,
        toX,
        toY,
        edge.isRouteManual ? edge.routePoints : [],
        obstacles,
        sourceRect,
        targetRect,
      )
      const autoPolyline = buildEdgePolyline(
        fromX,
        fromY,
        toX,
        toY,
        [],
        obstacles,
        sourceRect,
        targetRect,
      )
      const useManual = edge.isRouteManual && !polylineIntersectsRectsMiddleSegments(manualPolyline, strictRects)
      if (edge.isRouteManual && !useManual) {
        edge.isRouteManual = false
        edge.routePoints = []
      }
      let polyline = useManual ? manualPolyline : autoPolyline
      if (polylineIntersectsRectsMiddleSegments(polyline, strictRects)) {
        polyline = buildForcedOutsideDetour(
          fromX,
          fromY,
          toX,
          toY,
          obstacles,
          sourceRect,
          targetRect,
        )
      }
      const pathData = buildPathData(polyline)
      const isSelected = state.selectedEdgeId === edge.id
      const handlePoints = edge.isRouteManual
        ? edge.routePoints
        : [
            { x: fromX + (toX - fromX) * 0.5, y: fromY },
            { x: fromX + (toX - fromX) * 0.5, y: toY },
          ]
      const midpointIndex = Math.floor(handlePoints.length * 0.5)
      const deleteAnchor = handlePoints[midpointIndex] ?? { x: (fromX + toX) * 0.5, y: (fromY + toY) * 0.5 }
      const handles = isSelected
        ? handlePoints
            .map(
              (point, pointIndex) =>
                `<circle class="edge-handle" data-edge-id="${edge.id}" data-point-index="${pointIndex}" cx="${point.x}" cy="${point.y}" r="7" />`,
            )
            .join('')
        : ''
      const deleteButton = isSelected
        ? `<g class="edge-delete" data-action="delete-edge" data-edge-id="${edge.id}" transform="translate(${deleteAnchor.x + 14}, ${deleteAnchor.y - 14})">
            <circle r="10" cx="0" cy="0"></circle>
            <text x="0" y="1">x</text>
          </g>`
        : ''
      return `<path class="edge-hit" data-action="select-edge" data-edge-id="${edge.id}" d="${pathData}" />
        <path class="edge-line ${isSelected ? 'edge-line-selected' : ''}" d="${pathData}" />
        ${handles}
        ${deleteButton}`
    })
    .join('')

  let previewPath = ''
  if (
    state.pendingConnectionFrom &&
    connectionPointerClientX !== null &&
    connectionPointerClientY !== null
  ) {
    const outPort = wrap.querySelector(
      `.port-out[data-node-id="${state.pendingConnectionFrom}"]`,
    ) as HTMLButtonElement | null
    if (outPort) {
      const outRect = outPort.getBoundingClientRect()
      const fromX =
        (outRect.right - wrapRect.left - state.cameraX) / state.cameraZoom
      const fromY =
        (outRect.top - wrapRect.top + outRect.height * 0.5 - state.cameraY) / state.cameraZoom

      let toX = (connectionPointerClientX - wrapRect.left - state.cameraX) / state.cameraZoom
      let toY = (connectionPointerClientY - wrapRect.top - state.cameraY) / state.cameraZoom
      const targetAtPointer = document.elementFromPoint(
        connectionPointerClientX,
        connectionPointerClientY,
      )
      const inPort = targetAtPointer?.closest('.port-in[data-node-id]') as HTMLButtonElement | null
      if (inPort) {
        const inRect = inPort.getBoundingClientRect()
        toX = (inRect.left - wrapRect.left - state.cameraX) / state.cameraZoom
        toY = (inRect.top - wrapRect.top + inRect.height * 0.5 - state.cameraY) / state.cameraZoom
      }

      const sourceRect = state.pendingConnectionFrom ? (nodeRectMap.get(state.pendingConnectionFrom) ?? null) : null
      const targetNodeId = inPort?.getAttribute('data-node-id')
      const targetRect = targetNodeId ? (nodeRectMap.get(targetNodeId) ?? null) : null
      let previewPolyline: Point[]
      if (!targetNodeId) {
        // While freely aiming (not on a target port), keep preview compact and unobtrusive.
        previewPolyline = buildFreePreviewPolyline(fromX, fromY, toX, toY, connectionRoutePoints)
      } else {
        const obstacles = Array.from(nodeRectMap.values()).map((rect) => inflateRect(rect, OUTSIDE_GAP_PX))
        const strictRects = obstacles
        previewPolyline = buildEdgePolyline(
          fromX,
          fromY,
          toX,
          toY,
          connectionRoutePoints,
          obstacles,
          sourceRect,
          targetRect,
        )
        if (polylineIntersectsRectsMiddleSegments(previewPolyline, strictRects)) {
          previewPolyline = buildForcedOutsideDetour(
            fromX,
            fromY,
            toX,
            toY,
            obstacles,
            sourceRect,
            targetRect,
          )
        }
      }
      previewPath = `<path class="edge-line edge-line-preview" d="${buildPathData(previewPolyline)}" />`
    }
  }

  edgesLayer.innerHTML = `${persistedPaths}${previewPath}`
}
