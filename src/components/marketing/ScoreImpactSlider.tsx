"use client";

import { useState } from "react";

const DEFAULT_START = 47;
const DEFAULT_END = 72;
const DEFAULT_MAX_REVENUE = 4200;

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function scoreBorderColor(score: number): string {
  if (score >= 70) return "border-emerald-500";
  if (score >= 40) return "border-orange-500";
  return "border-red-500";
}

function scoreGrade(score: number): string {
  if (score >= 70) return "Healthy";
  if (score >= 40) return "At risk";
  return "Urgent";
}

interface ScoreImpactSliderProps {
  startScore?: number;
  endScore?: number;
  maxRevenueGain?: number;
}

export default function ScoreImpactSlider({
  startScore = DEFAULT_START,
  endScore = DEFAULT_END,
  maxRevenueGain = DEFAULT_MAX_REVENUE,
}: ScoreImpactSliderProps) {
  const [progress, setProgress] = useState(0);

  const score = Math.round(startScore + ((endScore - startScore) * progress) / 100);
  const revenueGain = Math.round((maxRevenueGain * progress) / 100);
  const fillPct = score;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-8">
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full border-4 text-2xl font-bold transition-colors duration-300 ${scoreBorderColor(score)} ${scoreColor(score)}`}
        >
          {score}
        </div>
        <div className="text-left">
          <p className="text-sm text-slate-400">Reputation Boost Score</p>
          <p className={`text-2xl font-bold transition-colors duration-300 ${scoreColor(score)}`}>
            {score}/100
          </p>
          <p className={`text-sm capitalize transition-colors duration-300 ${scoreColor(score)}`}>
            {scoreGrade(score)}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-400">Plan progress</span>
          <span className="font-medium text-white">{progress}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          className="score-slider w-full"
          aria-label="Plan completion progress"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-600">
          <span>Current ({startScore})</span>
          <span>Target ({endScore})</span>
        </div>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all duration-300"
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <p className="text-center text-sm font-medium text-emerald-400 transition-all duration-300">
        {revenueGain > 0
          ? `+$${revenueGain.toLocaleString()}/mo estimated revenue gain`
          : "Drag the slider to see projected revenue impact"}
      </p>
    </div>
  );
}
