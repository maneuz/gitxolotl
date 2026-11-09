// Lienzo de pixeles y conversión a SVG compacto (un <path> por color).

export class PixelCanvas {
  readonly width: number;
  readonly height: number;
  private readonly data: (string | undefined)[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Array(width * height);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, color: string): void {
    if (this.inBounds(x, y)) this.data[y * this.width + x] = color;
  }

  /** Pinta solo si el pixel está vacío. */
  setIfEmpty(x: number, y: number, color: string): void {
    if (this.inBounds(x, y) && this.data[y * this.width + x] === undefined) {
      this.data[y * this.width + x] = color;
    }
  }

  get(x: number, y: number): string | undefined {
    return this.inBounds(x, y) ? this.data[y * this.width + x] : undefined;
  }

  fillRect(x: number, y: number, w: number, h: number, color: string): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color);
  }

  /** Copia otro lienzo encima (los pixeles vacíos no tapan). */
  draw(other: PixelCanvas, dx: number, dy: number): void {
    for (let y = 0; y < other.height; y++) {
      for (let x = 0; x < other.width; x++) {
        const c = other.get(x, y);
        if (c !== undefined) this.set(x + dx, y + dy, c);
      }
    }
  }

  /** Copia espejo horizontal. */
  mirrored(): PixelCanvas {
    const out = new PixelCanvas(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = this.get(x, y);
        if (c !== undefined) out.set(this.width - 1 - x, y, c);
      }
    }
    return out;
  }

  /** Caja que contiene todos los pixeles pintados, o null si está vacío. */
  bounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y) !== undefined) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    return minX === Infinity ? null : { minX, minY, maxX, maxY };
  }

  /**
   * Convierte el lienzo en <path> agrupando corridas horizontales del mismo
   * color. Acepta colores #rrggbbaa: la transparencia sale como fill-opacity.
   */
  toSvg(offsetX = 0, offsetY = 0): string {
    const byColor = new Map<string, string[]>();
    for (let y = 0; y < this.height; y++) {
      let x = 0;
      while (x < this.width) {
        const c = this.get(x, y);
        if (c === undefined) {
          x++;
          continue;
        }
        let len = 1;
        while (x + len < this.width && this.get(x + len, y) === c) len++;
        let parts = byColor.get(c);
        if (!parts) byColor.set(c, (parts = []));
        parts.push(`M${x + offsetX} ${y + offsetY}h${len}v1h-${len}z`);
        x += len;
      }
    }
    let out = "";
    for (const [color, parts] of byColor) {
      const solid = color.slice(0, 7);
      const alpha = color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
      const opacity = alpha < 1 ? ` fill-opacity="${alpha.toFixed(2)}"` : "";
      out += `<path fill="${solid}"${opacity} d="${parts.join("")}"/>`;
    }
    return out;
  }
}

/** Generador pseudoaleatorio determinista (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
