# Progression Milestones (Rough)

This is a balancing reference for expected player progression through current early/mid content.

## Assumptions

- New save, default start credits (`2500`)
- Player builds a reasonably efficient graph (not perfect optimization)
- Player uses `Market` nodes to sell production continuously
- Player is semi-active (checks occasionally and adds machines when affordable)

## Milestone Path

| Stage | Goal | Typical Requirement Gate | Rough Time (Active Play) | Rough Time (Mostly Idle) |
|---|---|---|---:|---:|
| 1 | Stabilize basic income | Start machines (`Coal Mine`, `Woodcutter`) + first `Market` | 2-6 min | 6-15 min |
| 2 | Unlock utility production | `Sawmill` (`wood >= 30`) + early power planning | 6-15 min | 15-35 min |
| 3 | Start ore chain | Buy `Prospecting Pickaxes`, then `Iron Mine`, `Iron Smelter` | 12-28 min | 30-70 min |
| 4 | Expand to copper chain | `Copper Mine` -> `Copper Smelter` -> `Wire Mill` gates | 20-45 min | 55-120 min |
| 5 | Reach mixed-industry tier | `Steelworks` unlock and steady steel production | 30-65 min | 80-170 min |
| 6 | Produce advanced goods | `Machine Shop` unlock and `machineParts` output online | 40-90 min | 100-220 min |
| 7 | Full current early-stage completion | All current early-stage machines unlocked and running | 50-110 min | 120-260 min |

## Practical "Completed Current Content" Definition

For now, a player is considered done with current implemented early-stage content when they can:

- Build and run all available production machines
- Sustain energy and mixed-input chains without frequent stalls
- Produce `machineParts` continuously and sell them for stable credits
- Purchase currently available shop/research entries relevant to this stage

## Notes for Future Balance Iterations

- If progression feels too short, raise advanced unlock thresholds (`steel`, `copperWire`) or late machine costs.
- If progression feels too long, reduce tier-gate resource thresholds or increase intermediate machine throughput.
- Keep `machineParts` as a clear capstone for this phase (highest ROI in the current tree).
