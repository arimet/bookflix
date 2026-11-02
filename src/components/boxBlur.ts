// Blurs RGBA pixels in place: one horizontal then one vertical box pass, edges clamped.
// Used on a tiny canvas, where Safari ignores ctx.filter.
export function boxBlur(data: Uint8ClampedArray, w: number, h: number, r: number) {
  const pass = (count: number, length: number, at: (line: number, i: number) => number) => {
    const line = new Float32Array(length * 3)
    for (let l = 0; l < count; l++) {
      for (let i = 0; i < length; i++) for (let c = 0; c < 3; c++) line[i * 3 + c] = data[at(l, i) + c]
      for (let i = 0; i < length; i++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0
          for (let k = -r; k <= r; k++) sum += line[Math.min(length - 1, Math.max(0, i + k)) * 3 + c]
          data[at(l, i) + c] = sum / (2 * r + 1)
        }
      }
    }
  }
  pass(h, w, (y, x) => (y * w + x) * 4)
  pass(w, h, (x, y) => (y * w + x) * 4)
}
