export type CellState = 'empty' | 'ship' | 'hit' | 'miss'
export type Orientation = 'h' | 'v'

export interface ShipDef {
  id: string
  name: string
  size: number
  total: number
}
