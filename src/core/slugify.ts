const SAFE_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function assertSafeSlug(value: string, label: string): void {
  if (!SAFE_SLUG_RE.test(value)) {
    throw new Error(
      `Invalid ${label} "${value}". Use lowercase letters, numbers, and single hyphens.`,
    );
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
