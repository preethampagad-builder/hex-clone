export function metabaseHeaders(
  token: string,
  authType: string
): Record<string, string> {
  if (authType === "apikey") {
    return { "X-API-KEY": token };
  }
  return { "X-Metabase-Session": token };
}
