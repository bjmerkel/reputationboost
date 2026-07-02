"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface KeywordSuggestion {
  keyword: string;
  reason: string;
}

interface KeywordSuggestionsProps {
  businessName: string;
  industry: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website?: string;
  selected: string[];
  onChange: (keywords: string[]) => void;
  disabled?: boolean;
}

export function KeywordSuggestions({
  businessName,
  industry,
  address,
  city,
  state,
  zip,
  website,
  selected,
  onChange,
  disabled,
}: KeywordSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customKeyword, setCustomKeyword] = useState("");
  const [source, setSource] = useState<"llm" | "template" | null>(null);
  const autoSelectedRef = useRef(false);

  const fetchSuggestions = useCallback(async () => {
    if (!businessName.trim() || !industry.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/keywords/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: businessName,
          industry,
          address,
          city,
          state,
          website,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to suggest keywords");

      const items: KeywordSuggestion[] = data.keywords ?? [];
      setSuggestions(items);
      setSource(data.source ?? null);

      if (!autoSelectedRef.current && items.length > 0) {
        autoSelectedRef.current = true;
        onChange(items.slice(0, 5).map((s) => s.keyword));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }, [businessName, industry, address, city, state, website, onChange]);

  useEffect(() => {
    autoSelectedRef.current = false;
    setSuggestions([]);
    setSource(null);
    if (businessName.trim() && industry.trim()) {
      fetchSuggestions();
    }
  }, [businessName, industry, address, city, state, zip, website]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleKeyword = (keyword: string) => {
    if (selected.includes(keyword)) {
      onChange(selected.filter((k) => k !== keyword));
    } else {
      onChange([...selected, keyword]);
    }
  };

  const addCustomKeyword = () => {
    const trimmed = customKeyword.trim().toLowerCase();
    if (!trimmed || selected.includes(trimmed)) return;

    onChange([...selected, trimmed]);
    if (!suggestions.some((s) => s.keyword.toLowerCase() === trimmed)) {
      setSuggestions((prev) => [
        ...prev,
        { keyword: trimmed, reason: "Added manually by you" },
      ]);
    }
    setCustomKeyword("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-300">Target keywords</label>
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={disabled || loading || !businessName.trim()}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-white disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Regenerate"}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        {source === "llm"
          ? "AI-picked local SEO keywords for rank tracking. Select at least 3."
          : "Suggested keywords for rank tracking. Select at least 3."}
      </p>

      {loading && suggestions.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
          Analyzing your business and suggesting keywords…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s) => {
            const isSelected = selected.includes(s.keyword);
            return (
              <button
                key={s.keyword}
                type="button"
                disabled={disabled}
                onClick={() => toggleKeyword(s.keyword)}
                className={`w-full rounded-xl border p-3 text-left transition disabled:opacity-50 ${
                  isSelected
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.03] hover:border-emerald-500/30 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? "border-emerald-400 bg-emerald-400 text-slate-900"
                        : "border-slate-500"
                    }`}
                  >
                    {isSelected && (
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{s.keyword}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{s.reason}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={customKeyword}
          onChange={(e) => setCustomKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomKeyword();
            }
          }}
          disabled={disabled}
          placeholder="Add a custom keyword"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={addCustomKeyword}
          disabled={disabled || !customKeyword.trim()}
          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <p className="text-xs text-slate-500">
        {selected.length} selected
        {selected.length < 3 && " — select at least 3 to continue"}
      </p>
    </div>
  );
}
