const BI_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";

export interface GbpChain {
  name: string;
  chainId: string;
  displayName: string;
  websites: string[];
  locationCount: number;
}

function extractChainId(resourceName: string): string {
  const parts = resourceName.split("/");
  const idx = parts.indexOf("chains");
  return idx >= 0 ? parts[idx + 1] : resourceName;
}

interface ChainApi {
  name?: string;
  chainNames?: Array<{ displayName?: string; languageCode?: string }>;
  websites?: Array<{ uri?: string }>;
  locationCount?: number;
}

function parseChain(data: ChainApi): GbpChain | null {
  if (!data.name) return null;
  const displayName =
    data.chainNames?.find((n) => n.languageCode === "en")?.displayName ??
    data.chainNames?.[0]?.displayName ??
    extractChainId(data.name);

  return {
    name: data.name,
    chainId: extractChainId(data.name),
    displayName,
    websites: (data.websites ?? []).map((w) => w.uri ?? "").filter(Boolean),
    locationCount: data.locationCount ?? 0,
  };
}

/** chains.search — find brand chains by display name. */
export async function searchGbpChains(
  accessToken: string,
  chainName: string,
  pageSize = 10
): Promise<GbpChain[]> {
  const res = await fetch(`${BI_BASE}/chains:search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chainName, pageSize }),
  });

  const data = (await res.json()) as {
    chains?: ChainApi[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Chain search failed (${res.status})`);
  }

  return (data.chains ?? []).map(parseChain).filter((c): c is GbpChain => Boolean(c));
}

/** chains.get — resolve a chain resource name to display metadata. */
export async function getGbpChain(
  accessToken: string,
  chainResourceName: string
): Promise<GbpChain | null> {
  const name = chainResourceName.startsWith("chains/")
    ? chainResourceName
    : `chains/${chainResourceName}`;

  const res = await fetch(`${BI_BASE}/${name}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = (await res.json()) as ChainApi & { error?: { message?: string } };

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(data.error?.message ?? `Chain lookup failed (${res.status})`);
  }

  return parseChain(data);
}

/** Resolve unique chain resource names to display labels. */
export async function resolveGbpChainLabels(
  accessToken: string,
  chainResourceNames: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(chainResourceNames.filter(Boolean))];
  const labels = new Map<string, string>();

  await Promise.all(
    unique.map(async (resourceName) => {
      try {
        const chain = await getGbpChain(accessToken, resourceName);
        if (chain) labels.set(resourceName, chain.displayName);
      } catch {
        // Chain lookup is best-effort for onboarding grouping
      }
    })
  );

  return labels;
}
