declare module 'figma' {
  const figma: any
  export default figma
}

declare module '*/digitalTwin/Gis' {
  import type React from 'react'
  const Gis: React.ComponentType<any>
  export default Gis
}

declare module '*/digitalTwin/DigitalTwin' {
  import type React from 'react'
  const DigitalTwin: React.ComponentType<any>
  export default DigitalTwin
}

declare module '*/digitalTwin/data' {
  export const COL: Record<string, string>
  export const FL: Array<{ n: string; z: string[] }>
  export const CAT: string[]
  export const PL: Array<{ c: string; co: string; b: string; u: string }>
  export const CN: Record<string, string>
  export const BL: string[]
  export const DIM: Record<string, [number, number, number, string]>
  export function buildMachines(): any[]
}
