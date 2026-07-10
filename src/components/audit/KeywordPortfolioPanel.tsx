"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeywordPortfolioAnalysis, KeywordPortfolioStatus } from "@/audit/types";

const STATUS_LABELS: Record<KeywordPortfolioStatus, string> = {
  proven_demand: "Proven demand",
  brand_anchor: "Brand anchor",
  rank_without_demand: "Rank without demand",
  growth_target: "Growth target",
  low_priority: "Low priority",
};

const STATUS_STYLES: Record<KeywordPortfolioStatus, string> = {
  proven_demand: "bg-[#e6f4ea] text-[#137333]",
  brand_anchor: "bg-[#e8f0fe] text-[#1a73e8]",
  rank_without_demand: "bg-[#fef7e0] text-[#b06000]",
  growth_target: "bg-[#fce8e6] text-[#c5221f]",
  low_priority: "bg-[#f1f3f4] text-[#5f6368]",
};

const MIN_KEYWORDS = 3;
const MAX_KEYWORDS = 8;

type KeywordSuggestion = { keyword: string; reason: string };

export default function KeywordPortfolioPanel({
  portfolio,
  currentKeywords,
  businessSlug,
  businessName,
  industry,
  city,
  state,
  address,
  website,
  light = true,
  onKeywordsUpdated,
}: {
  portfolio: KeywordPortfolioAnalysis;
  currentKeywords: string[];
  businessSlug?: string;
  businessName?: string;
  industry?: string;
  city?: string;
  state?: string;
  address?: string;
  website?: string;
  light?: boolean;
  onKeywordsUpdated?: (keywords: string[]) => void;
}) {
  const [keywords, setKeywords] = useState(currentKeywords);
  const savedKeywordsRef = useRef<string[] | null>(null);

  useEffect(() => {
    const incoming = currentKeywords.map((k) => k.trim().toLowerCase()).join("|");
    const saved = savedKeywordsRef.current?.map((k) => k.trim().toLowerCase()).join("|") ?? null;

    // After a successful save, parents may still pass stale audit rankings.
    // Keep the saved list until props catch up to the same set.
    if (saved && saved !== incoming) {
      return;
    }
    if (saved && saved === incoming) {
      savedKeywordsRef.current = null;
    }
    setKeywords(currentKeywords);
  }, [currentKeywords]);

  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null);
  const [draftKeyword, setDraftKeyword] = useState("");
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [suggestSource, setSuggestSource] = useState<"llm" | "template" | null>(null);
  const [suggestWarning, setSuggestWarning] = useState<string | null>(null);
  const [suggestingFor, setSuggestingFor] = useState<string | "add" | null>(null);

  const keywordsChanged =
    portfolio.recommendedKeywords.length > 0 &&
    portfolio.recommendedKeywords.join("|") !== keywords.join("|");

  const statusByKeyword = useMemo(() => {
    const map = new Map(portfolio.tracked.map((item) => [item.keyword.toLowerCase(), item]));
    return map;
  }, [portfolio.tracked]);

  const gbpSearchTerms = useMemo(
    () =>
      portfolio.untrackedCandidates
        .map((c) => c.sourceGbpTerm || c.keyword)
        .filter(Boolean)
        .slice(0, 12),
    [portfolio.untrackedCandidates]
  );

  async function persistKeywords(next: string[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/business/keywords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: businessSlug,
          keywords: next,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        business?: { keywords: string[] };
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to update keywords");
      const saved = data.business?.keywords ?? next;
      savedKeywordsRef.current = saved;
      setKeywords(saved);
      setApplied(false);
      onKeywordsUpdated?.(saved);
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update keywords");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function applyRecommendations() {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/business/keywords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: businessSlug,
          applyRecommendations: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        business?: { keywords: string[] };
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to update keywords");
      const saved = data.business?.keywords ?? portfolio.recommendedKeywords;
      savedKeywordsRef.current = saved;
      setKeywords(saved);
      setApplied(true);
      setEditingKeyword(null);
      setAdding(false);
      onKeywordsUpdated?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update keywords");
    } finally {
      setApplying(false);
    }
  }

  async function fetchSuggestions(replaceKeyword?: string) {
    setSuggestingFor(replaceKeyword ?? "add");
    setError(null);
    setSuggestWarning(null);
    try {
      if (replaceKeyword) {
        setEditingKeyword(replaceKeyword);
        setDraftKeyword(replaceKeyword);
        setAdding(false);
      } else {
        setAdding(true);
        setEditingKeyword(null);
      }

      const res = await fetch("/api/keywords/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: businessSlug,
          name: businessName,
          industry,
          city: city ?? "",
          state: state ?? "",
          address,
          website,
          existingKeywords: keywords,
          replaceKeyword,
          gbpSearchTerms,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        keywords?: KeywordSuggestion[];
        source?: "llm" | "template";
        warning?: string;
        llmConfigured?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to suggest keywords");

      const nextSuggestions = data.keywords ?? [];
      setSuggestions(nextSuggestions);
      setSuggestSource(data.source ?? null);
      setSuggestWarning(data.warning ?? null);

      if (nextSuggestions.length === 0) {
        setError("No keyword suggestions returned. Try again or type a keyword manually.");
        return;
      }

      // Immediately fill the draft so the user sees a change without an extra click.
      const top = nextSuggestions[0]?.keyword;
      if (top) {
        if (replaceKeyword) {
          setDraftKeyword(top);
        } else {
          setAddDraft(top);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suggest keywords");
      setSuggestions([]);
      setSuggestSource(null);
    } finally {
      setSuggestingFor(null);
    }
  }

  function beginEdit(keyword: string) {
    setEditingKeyword(keyword);
    setDraftKeyword(keyword);
    setAdding(false);
    setSuggestions([]);
    setSuggestSource(null);
    setSuggestWarning(null);
    setError(null);
  }

  function beginAdd() {
    setAdding(true);
    setAddDraft("");
    setEditingKeyword(null);
    setSuggestions([]);
    setSuggestSource(null);
    setSuggestWarning(null);
    setError(null);
  }

  async function saveEdit() {
    if (!editingKeyword) return;
    const nextValue = draftKeyword.trim().toLowerCase();
    if (!nextValue) {
      setError("Keyword cannot be empty.");
      return;
    }
    if (
      keywords.some(
        (k) => k.toLowerCase() === nextValue && k.toLowerCase() !== editingKeyword.toLowerCase()
      )
    ) {
      setError("That keyword is already tracked.");
      return;
    }

    const next = keywords.map((k) =>
      k.toLowerCase() === editingKeyword.toLowerCase() ? nextValue : k
    );
    try {
      await persistKeywords(next);
      setEditingKeyword(null);
      setSuggestions([]);
    } catch {
      // error already set
    }
  }

  async function removeKeyword(keyword: string) {
    if (keywords.length <= MIN_KEYWORDS) {
      setError(`Keep at least ${MIN_KEYWORDS} keywords.`);
      return;
    }
    const next = keywords.filter((k) => k.toLowerCase() !== keyword.toLowerCase());
    try {
      await persistKeywords(next);
      if (editingKeyword?.toLowerCase() === keyword.toLowerCase()) {
        setEditingKeyword(null);
      }
    } catch {
      // error already set
    }
  }

  async function addKeyword(value?: string) {
    const nextValue = (value ?? addDraft).trim().toLowerCase();
    if (!nextValue) {
      setError("Keyword cannot be empty.");
      return;
    }
    if (keywords.some((k) => k.toLowerCase() === nextValue)) {
      setError("That keyword is already tracked.");
      return;
    }
    if (keywords.length >= MAX_KEYWORDS) {
      setError(`Maximum ${MAX_KEYWORDS} keywords allowed.`);
      return;
    }
    try {
      await persistKeywords([...keywords, nextValue]);
      setAdding(false);
      setAddDraft("");
      setSuggestions([]);
    } catch {
      // error already set
    }
  }

  async function applySuggestion(suggestion: string) {
    if (editingKeyword) {
      setDraftKeyword(suggestion);
      const next = keywords.map((k) =>
        k.toLowerCase() === editingKeyword.toLowerCase() ? suggestion : k
      );
      try {
        await persistKeywords(next);
        setEditingKeyword(null);
        setSuggestions([]);
      } catch {
        // error already set
      }
      return;
    }
    await addKeyword(suggestion);
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        light ? "border-[#dadce0] bg-white" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-semibold ${light ? "text-[#202124]" : "text-white"}`}>
            Keyword portfolio intelligence
          </h3>
          <p className={`mt-1 text-sm ${light ? "text-[#5f6368]" : "text-slate-400"}`}>
            {portfolio.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricPill
            light={light}
            label="Demand alignment"
            value={`${portfolio.demandAlignmentScore}%`}
            warn={portfolio.demandAlignmentScore < 50}
          />
          <MetricPill
            light={light}
            label="Rank-only"
            value={String(portfolio.rankWithoutDemandCount)}
            warn={portfolio.rankWithoutDemandCount > 0}
          />
          <MetricPill
            light={light}
            label="Untracked GBP"
            value={String(portfolio.untrackedDemandCount)}
            warn={portfolio.untrackedDemandCount > 0}
          />
        </div>
      </div>

      {portfolio.recommendedSwaps.length > 0 && (
        <div className="mt-4">
          <p className={`text-xs font-semibold uppercase tracking-wider ${light ? "text-[#80868b]" : "text-slate-500"}`}>
            Recommended swaps
          </p>
          <ul className="mt-2 space-y-2">
            {portfolio.recommendedSwaps.map((swap) => (
              <li
                key={`${swap.swapOut}-${swap.swapIn}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  light ? "bg-[#f8f9fa] text-[#3c4043]" : "bg-white/5 text-slate-300"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-[#c5221f]">{swap.swapOut}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium text-[#137333]">{swap.swapIn}</span>
                    {swap.estimatedImpressionGain != null && swap.estimatedImpressionGain > 0 && (
                      <span className={`ml-2 text-xs ${light ? "text-[#80868b]" : "text-slate-500"}`}>
                        +{swap.estimatedImpressionGain} impressions/mo
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      const next = keywords.map((k) =>
                        k.toLowerCase() === swap.swapOut.toLowerCase() ? swap.swapIn : k
                      );
                      if (!keywords.some((k) => k.toLowerCase() === swap.swapOut.toLowerCase())) {
                        if (keywords.length >= MAX_KEYWORDS) {
                          setError(`Maximum ${MAX_KEYWORDS} keywords allowed.`);
                          return;
                        }
                        void persistKeywords([...keywords, swap.swapIn]);
                        return;
                      }
                      void persistKeywords(next);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      light
                        ? "bg-white text-[#1a73e8] ring-1 ring-[#dadce0] hover:bg-[#e8f0fe]"
                        : "bg-white/10 text-sky-300 hover:bg-white/15"
                    }`}
                  >
                    Apply swap
                  </button>
                </div>
                <p className={`mt-1 text-xs ${light ? "text-[#5f6368]" : "text-slate-400"}`}>
                  {swap.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs font-semibold uppercase tracking-wider ${light ? "text-[#80868b]" : "text-slate-500"}`}>
              Tracked keywords
            </p>
            <button
              type="button"
              disabled={saving || keywords.length >= MAX_KEYWORDS}
              onClick={beginAdd}
              className={`text-xs font-medium ${
                light ? "text-[#1a73e8] hover:underline" : "text-sky-300 hover:underline"
              } disabled:opacity-50`}
            >
              Add keyword
            </button>
          </div>
          <ul className="mt-2 space-y-2">
            {keywords.map((keyword) => {
              const tracked = statusByKeyword.get(keyword.toLowerCase());
              const isEditing = editingKeyword?.toLowerCase() === keyword.toLowerCase();
              return (
                <li
                  key={keyword}
                  className={`rounded-lg px-3 py-2 ${
                    light ? "bg-[#f8f9fa]" : "bg-white/5"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={draftKeyword}
                        onChange={(e) => setDraftKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveEdit();
                          }
                          if (e.key === "Escape") setEditingKeyword(null);
                        }}
                        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
                          light
                            ? "border-[#dadce0] bg-white text-[#202124] focus:border-[#1a73e8]"
                            : "border-white/15 bg-black/20 text-white focus:border-sky-400"
                        }`}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveEdit()}
                          className="rounded-md bg-[#1a73e8] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(suggestingFor)}
                          onClick={() => void fetchSuggestions(keyword)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                            light
                              ? "bg-white text-[#3c4043] ring-1 ring-[#dadce0]"
                              : "bg-white/10 text-slate-200"
                          }`}
                        >
                          {suggestingFor === keyword ? "Suggesting…" : "AI suggest"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingKeyword(null)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                            light ? "text-[#5f6368]" : "text-slate-400"
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm ${light ? "text-[#202124]" : "text-slate-200"}`}>
                        {keyword}
                      </span>
                      {tracked && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[tracked.status]}`}
                        >
                          {STATUS_LABELS[tracked.status]}
                        </span>
                      )}
                      <div className="ml-auto flex gap-1">
                        <button
                          type="button"
                          disabled={saving || Boolean(suggestingFor)}
                          onClick={() => void fetchSuggestions(keyword)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            light ? "text-[#1a73e8] hover:bg-[#e8f0fe]" : "text-sky-300 hover:bg-white/10"
                          } disabled:opacity-50`}
                        >
                          {suggestingFor === keyword ? "Suggesting…" : "AI suggest"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => beginEdit(keyword)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            light ? "text-[#1a73e8] hover:bg-[#e8f0fe]" : "text-sky-300 hover:bg-white/10"
                          }`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving || keywords.length <= MIN_KEYWORDS}
                          onClick={() => void removeKeyword(keyword)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            light ? "text-[#c5221f] hover:bg-[#fce8e6]" : "text-red-300 hover:bg-white/10"
                          } disabled:opacity-40`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {adding && (
            <div
              className={`mt-2 space-y-2 rounded-lg px-3 py-2 ${
                light ? "bg-[#f8f9fa]" : "bg-white/5"
              }`}
            >
              <input
                value={addDraft}
                onChange={(e) => setAddDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addKeyword();
                  }
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder="New keyword"
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
                  light
                    ? "border-[#dadce0] bg-white text-[#202124] focus:border-[#1a73e8]"
                    : "border-white/15 bg-black/20 text-white focus:border-sky-400"
                }`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void addKeyword()}
                  className="rounded-md bg-[#1a73e8] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >
                  Add
                </button>
                <button
                  type="button"
                  disabled={Boolean(suggestingFor)}
                  onClick={() => void fetchSuggestions()}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    light
                      ? "bg-white text-[#3c4043] ring-1 ring-[#dadce0]"
                      : "bg-white/10 text-slate-200"
                  }`}
                >
                  {suggestingFor === "add" ? "Suggesting…" : "AI suggest"}
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    light ? "text-[#5f6368]" : "text-slate-400"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className={`text-xs ${light ? "text-[#80868b]" : "text-slate-500"}`}>
                {suggestSource === "llm"
                  ? "High-volume Maps suggestions"
                  : "High-volume Maps templates"}
                {editingKeyword ? ` for “${editingKeyword}”` : ""}
                {" · click one to apply"}
              </p>
              {suggestWarning && (
                <p className={`text-xs ${light ? "text-[#b06000]" : "text-amber-300"}`}>
                  {suggestWarning}
                </p>
              )}
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.keyword}
                  type="button"
                  disabled={saving}
                  onClick={() => void applySuggestion(suggestion.keyword)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    light
                      ? "border-[#dadce0] bg-white hover:border-[#1a73e8]/40 hover:bg-[#e8f0fe]"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <p className={`text-sm font-medium ${light ? "text-[#202124]" : "text-white"}`}>
                    {suggestion.keyword}
                  </p>
                  <p className={`mt-0.5 text-xs ${light ? "text-[#5f6368]" : "text-slate-400"}`}>
                    {suggestion.reason}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {portfolio.untrackedCandidates.length > 0 && (
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${light ? "text-[#80868b]" : "text-slate-500"}`}>
              Untracked GBP opportunities
            </p>
            <ul className="mt-2 space-y-1.5">
              {portfolio.untrackedCandidates.slice(0, 6).map((candidate) => {
                const alreadyTracked = keywords.some(
                  (k) => k.toLowerCase() === candidate.keyword.toLowerCase()
                );
                return (
                  <li
                    key={candidate.keyword}
                    className={`flex flex-wrap items-center gap-2 text-sm ${
                      light ? "text-[#202124]" : "text-slate-200"
                    }`}
                  >
                    <span className="font-medium">{candidate.keyword}</span>
                    <span className={`text-xs ${light ? "text-[#80868b]" : "text-slate-500"}`}>
                      {candidate.impressions != null && candidate.impressions > 0
                        ? `${candidate.impressions} impressions`
                        : candidate.belowThreshold
                          ? "< threshold"
                          : "from GBP"}
                    </span>
                    <button
                      type="button"
                      disabled={saving || alreadyTracked || keywords.length >= MAX_KEYWORDS}
                      onClick={() => void addKeyword(candidate.keyword)}
                      className={`ml-auto rounded px-2 py-0.5 text-[11px] font-medium disabled:opacity-40 ${
                        light ? "text-[#137333] hover:bg-[#e6f4ea]" : "text-emerald-300 hover:bg-white/10"
                      }`}
                    >
                      {alreadyTracked ? "Tracked" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {keywordsChanged && (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3 ${
            light ? "border-[#dadce0] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <div>
            <p className={`text-sm font-medium ${light ? "text-[#202124]" : "text-white"}`}>
              Optimized portfolio ready
            </p>
            <p className={`text-xs ${light ? "text-[#5f6368]" : "text-slate-400"}`}>
              {portfolio.recommendedKeywords.join(" · ")}
            </p>
          </div>
          <button
            type="button"
            disabled={applying || applied}
            onClick={() => void applyRecommendations()}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              applied
                ? "bg-[#e6f4ea] text-[#137333]"
                : "bg-[#1a73e8] text-white hover:bg-[#1557b0] disabled:opacity-60"
            }`}
          >
            {applied ? "Keywords updated" : applying ? "Applying…" : "Apply recommendations"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-[#c5221f]">{error}</p>}
    </div>
  );
}

function MetricPill({
  label,
  value,
  warn,
  light,
}: {
  label: string;
  value: string;
  warn?: boolean;
  light: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-center ${
        warn
          ? light
            ? "bg-[#fef7e0]"
            : "bg-amber-500/10"
          : light
            ? "bg-[#f8f9fa]"
            : "bg-white/5"
      }`}
    >
      <p className={`text-[10px] uppercase tracking-wide ${light ? "text-[#80868b]" : "text-slate-500"}`}>
        {label}
      </p>
      <p
        className={`text-sm font-semibold ${
          warn ? (light ? "text-[#b06000]" : "text-amber-300") : light ? "text-[#202124]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
