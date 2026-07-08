"use client";

import { useCallback, useEffect, useState } from "react";
import type { GbpPlaceActionCoverage, GbpPlaceActionLinkSummary } from "@/audit/types";

interface PlaceActionsProbe {
  ok?: boolean;
  partial?: boolean;
  error?: string;
  linkCount?: number;
  availableTypeCount?: number;
  coverage?: GbpPlaceActionCoverage;
  endpoints?: {
    links: string;
    typeMetadata: string;
  };
  summary?: string;
}

const ENDPOINT_LABELS = {
  links: "Action links",
  typeMetadata: "Available types",
} as const;

function endpointBadgeClass(status: string, isLight: boolean): string {
  if (status === "ok") {
    return isLight ? "bg-[#e6f4ea] text-[#137333]" : "bg-emerald-500/15 text-emerald-300";
  }
  if (status === "denied") {
    return isLight ? "bg-[#fce8e6] text-[#c5221f]" : "bg-red-500/15 text-red-300";
  }
  if (status === "failed") {
    return isLight ? "bg-[#fef7e0] text-[#e37400]" : "bg-amber-500/15 text-amber-300";
  }
  return isLight ? "bg-[#f1f3f4] text-[#5f6368]" : "bg-white/10 text-slate-400";
}

export default function GbpPlaceActionsSetup({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";
  const [probe, setProbe] = useState<PlaceActionsProbe | null>(null);
  const [links, setLinks] = useState<GbpPlaceActionLinkSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [probeRes, linksRes] = await Promise.all([
        fetch("/api/google/gbp/place-actions"),
        fetch("/api/google/gbp/place-actions?mode=links"),
      ]);
      const probeData = await probeRes.json();
      const linksData = await linksRes.json();

      if (!probeRes.ok) {
        setProbe({ error: probeData.error ?? "Failed to load place action links" });
      } else {
        setProbe(probeData);
      }

      if (linksRes.ok) {
        setLinks(
          (linksData.links ?? []).map((link: GbpPlaceActionLinkSummary) => ({
            name: link.name,
            uri: link.uri,
            placeActionType: link.placeActionType,
            displayType:
              link.displayType ??
              String(link.placeActionType).replace(/_/g, " ").toLowerCase(),
            isPreferred: link.isPreferred,
            isEditable: link.isEditable,
            providerType: link.providerType,
          }))
        );
      }
    } catch {
      setProbe({ error: "Failed to load place action links" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const coverage = probe?.coverage;

  return (
    <div
      className={`rounded-xl border p-6 shadow-sm ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-lg font-bold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Booking &amp; action links
          </h2>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Place action links for appointments, reservations, food ordering, and online shopping.
          </p>
        </div>
        {!loading && coverage && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              coverage.coverageScore >= 70
                ? "bg-[#e6f4ea] text-[#137333]"
                : "bg-[#fef7e0] text-[#e37400]"
            }`}
          >
            {coverage.coverageScore}% coverage
          </span>
        )}
      </div>

      {loading ? (
        <p className={`mt-4 text-sm ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>Checking…</p>
      ) : probe?.error ? (
        <p className="mt-4 text-sm text-[#d93025]">{probe.error}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {probe?.endpoints && (
            <dl className={`space-y-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
              {(Object.keys(ENDPOINT_LABELS) as Array<keyof typeof ENDPOINT_LABELS>).map((key) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <dt className={isLight ? "text-[#80868b]" : "text-slate-500"}>
                    {ENDPOINT_LABELS[key]}
                  </dt>
                  <dd>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${endpointBadgeClass(
                        probe.endpoints![key],
                        isLight
                      )}`}
                    >
                      {probe.endpoints![key]}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {coverage && (
            <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              {coverage.linkCount} link{coverage.linkCount === 1 ? "" : "s"} configured
              {probe?.availableTypeCount != null
                ? ` · ${probe.availableTypeCount} types available for your location`
                : ""}
            </p>
          )}

          {links.length > 0 && (
            <ul className={`space-y-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
              {links.slice(0, 6).map((link) => (
                <li
                  key={link.name}
                  className={`rounded-lg border px-3 py-2 ${
                    isLight ? "border-[#e8eaed]" : "border-white/8"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{link.displayType}</span>
                    {link.isPreferred && (
                      <span className="text-xs text-[#137333]">Preferred</span>
                    )}
                  </div>
                  <p className={`mt-1 truncate text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                    {link.uri}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {coverage?.missingAvailableTypes.length ? (
            <p className={`text-sm ${isLight ? "text-[#b06000]" : "text-amber-200"}`}>
              Missing action links:{" "}
              {coverage.missingAvailableTypes
                .map((type) => type.replace(/_/g, " ").toLowerCase())
                .join(", ")}
            </p>
          ) : null}

          {coverage?.recommendations.length ? (
            <ul className={`space-y-1.5 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              {coverage.recommendations.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
