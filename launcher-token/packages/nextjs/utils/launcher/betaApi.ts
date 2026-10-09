export async function betaApi<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(`/api/beta/${path}`, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Beta request failed. Retry.");
  return data;
}
export type BetaSession = {
  address: string;
  participant: boolean;
  launcher: boolean;
  operator: boolean;
  chainId: number;
};
