export type StatusLightState='active'|'needs-you'|'result'|'off'|'fault';
export interface SpatialThemeSnapshot {canvas:string;zone:string;grid:string;gridMajor:string;label:string;unitMuted:string;selection:string;status:Record<StatusLightState,string>}
