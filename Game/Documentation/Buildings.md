# Buildings (Nodes)

Current buildable structures and machines.

## Structures and Connectors

| Node | Cost (credits) | Notes |
|---|---:|---|
| Warehouse | 180 | Storage node, no output production |
| Market | 140 | Sells incoming goods for credits |
| Splitter | 90 | Connector for flow splitting |
| Merger | 90 | Connector for flow merging |

## Production Machines

| Machine | Cost (credits) | Inputs per cycle | Outputs per cycle | Base Ops/s | Unlock |
|---|---:|---|---|---:|---|
| Municipal Dynamo | 260 | - | `energy: 2.5` | 1.00 | Municipal Dynamo Contract |
| Coal Mine | 240 | `energy: 0.4` | `coal: 1` | 1.20 | Start |
| Woodcutter | 220 | `energy: 0.3` | `wood: 1` | 1.00 | Start |
| Sawmill | 420 | `wood: 1` | `lumber: 1` | 0.50 | Wood total `>= 30` |
| Iron Mine | 460 | `energy: 0.55` | `ironOre: 1` | 0.95 | Prospecting Pickaxes |
| Iron Smelter | 620 | `ironOre: 1`, `coal: 0.35` | `ironPlate: 1` | 0.72 | Prospecting Pickaxes + iron ore total `>= 24` |
| Copper Mine | 560 | `energy: 0.6` | `copperOre: 1` | 0.90 | Prospecting Pickaxes + iron plate total `>= 14` |
| Copper Smelter | 740 | `copperOre: 1`, `coal: 0.3` | `copperIngot: 1` | 0.75 | Prospecting Pickaxes + copper ore total `>= 22` |
| Wire Mill | 860 | `copperIngot: 1`, `energy: 0.25` | `copperWire: 1.35` | 0.90 | Prospecting Pickaxes + copper ingot total `>= 18` |
| Steelworks | 1080 | `ironPlate: 1.4`, `coal: 0.6`, `energy: 0.5` | `steel: 1` | 0.55 | Prospecting Pickaxes + iron plate total `>= 42` |
| Machine Shop | 1480 | `steel: 1`, `copperWire: 1`, `energy: 0.5` | `machineParts: 1.2` | 0.55 | Prospecting Pickaxes + steel total `>= 22` + copper wire total `>= 40` |
| Power Plant | 680 | `coal: 1` | `energy: 5` | 0.75 | Municipal Dynamo Contract + coal total `>= 45` |
