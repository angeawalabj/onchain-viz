/**
 * Déclarations de types pour d3-force-3d.
 * Le package n'a pas de @types officiel — déclarations minimales pour TypeScript strict.
 */

declare module "d3-force-3d" {
  export interface SimulationNode {
    id?:    string;
    x?:     number;
    y?:     number;
    z?:     number;
    vx?:    number;
    vy?:    number;
    vz?:    number;
    index?: number;
    fx?:    number | null;
    fy?:    number | null;
    fz?:    number | null;
  }

  export interface SimulationLink<N extends SimulationNode = SimulationNode> {
    source: N | string;
    target: N | string;
  }

  export interface Simulation<N extends SimulationNode> {
    nodes(nodes: N[]): this;
    numDimensions(d: number): this;
    force(name: string, force: any): this;
    alpha(): number;
    alpha(a: number): this;
    alphaDecay(d: number): this;
    alphaMin(m: number): this;
    velocityDecay(d: number): this;
    on(event: "tick" | "end", listener: () => void): this;
    stop(): this;
    restart(): this;
    tick(n?: number): this;
  }

  export interface ForceLink<N extends SimulationNode> {
    links(links: any[]): this;
    id(fn: (d: N) => string): this;
    distance(d: number | ((l: any) => number)): this;
    strength(s: number | ((l: any) => number)): this;
    iterations(n: number): this;
  }

  export interface ForceManyBody {
    strength(s: number | ((d: any) => number)): this;
    theta(t: number): this;
    distanceMin(d: number): this;
    distanceMax(d: number): this;
  }

  export interface ForceCenter {
    strength(s: number): this;
  }

  export interface ForceCollide {
    radius(r: number | ((d: any) => number)): this;
    strength(s: number): this;
    iterations(n: number): this;
  }

  function forceSimulation<N extends SimulationNode>(numDimensions?: number): Simulation<N>;

  namespace forceSimulation {
    function forceLink<N extends SimulationNode>(links?: any[]): ForceLink<N>;
    function forceManyBody(): ForceManyBody;
    function forceCenter(x?: number, y?: number, z?: number): ForceCenter;
    function forceCollide(): ForceCollide;
  }

  export default forceSimulation;
}
