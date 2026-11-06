export function functionUrl(slug: string): string {
  const key = `NEON_FUNCTION_${slug.toUpperCase()}_BASE_URL`;
  const url = process.env[key];
  if (!url) throw new Error(`Missing env var ${key}. Run \`neon deploy\`.`);
  return url.replace(/\/$/, "");
}
