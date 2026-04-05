export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')     // remove non-alphanumeric
    .trim()
    .replace(/\s+/g, '-')             // spaces to hyphens
    .replace(/-+/g, '-')              // collapse multiple hyphens
}

// Appends a unique suffix (e.g. CI) to guarantee global uniqueness
export function slugifyWithSuffix(text: string, suffix: string): string {
  return `${slugify(text)}-${suffix.toLowerCase()}`
}
