export function slugPart(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'node';
}

export function generateBlockId(path: string[], type: string): string {
  const pathSlug = path.map(slugPart).join('_');
  return `block_${pathSlug || slugPart(type)}`;
}

export function ensureUniqueId(baseId: string, seen: Set<string>): string {
  let candidate = baseId;
  let index = 2;
  while (seen.has(candidate)) {
    candidate = `${baseId}_${index}`;
    index += 1;
  }
  seen.add(candidate);
  return candidate;
}

export function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
