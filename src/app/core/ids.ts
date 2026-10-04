let counter = 0;

/** Short unique id. Random part avoids clashes between tabs; counter avoids clashes within a millisecond. */
export function uid(prefix = ''): string {
  counter = (counter + 1) % 1_679_616;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}${Math.random().toString(36).slice(2, 6)}`;
}

export function stamp(at = Date.now()): { at: number; eid: string } {
  return { at, eid: uid('e') };
}
