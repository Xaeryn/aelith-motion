// Canvas' 8-bit alpha can round a tiny destination-out fade back to the
// same value indefinitely. Ease only that quantization tail down to zero.
// Call before drawing fresh effects, leaving brighter pixels untouched.
export function clearQuantizedTail(data, eraseAlpha) {
  const floor = Math.min(255, Math.ceil(1 / Math.max(eraseAlpha, 1 / 255)));
  let changed = false;
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i];
    if (!alpha || alpha > floor) continue;
    data[i] = Math.min(alpha - 1, Math.floor(alpha * (.5 + .5 * alpha / floor)));
    if (!data[i]) data[i - 3] = data[i - 2] = data[i - 1] = 0;
    changed = true;
  }
  return changed;
}
