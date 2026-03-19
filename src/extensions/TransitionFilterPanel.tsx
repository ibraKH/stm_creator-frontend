// src/extensions/TransitionFilterPanel.tsx
import { useEffect, useMemo, useState } from 'react';
import type { BMRGData } from '../utils/stateTransition';
import type { DeltaFilterOption } from '../app/types';

type Props = {
  bmrgData: BMRGData | null;
  showSelfTransitions: boolean;
  deltaFilter: DeltaFilterOption;
  onDeltaFilterChange: (opt: DeltaFilterOption) => void;
  onToggleSelfTransitions: () => void;
  onReset: () => void;
  /** When true, renders inline for sidebar (no Panel wrapper) */
  inSidebar?: boolean;
};

function isTruthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
  }
  return false;
}

export function TransitionFilterPanel({
  bmrgData,
  showSelfTransitions,
  deltaFilter,
  onDeltaFilterChange,
  onToggleSelfTransitions: _onToggleSelfTransitions,
  onReset,
  inSidebar = false,
}: Props) {
  const [collapsed, setCollapsed] = useState(!inSidebar);
  const [requireTime25, setRequireTime25] = useState(false);
  const [requireTime100, setRequireTime100] = useState(false);
  const [probMin, setProbMin] = useState<number>(0);
  const [probMax, setProbMax] = useState<number>(1);
  const [rangeMode, setRangeMode] = useState<'any' | 'both'>('any');

  const probActive = probMin !== 0 || probMax !== 1;

  const { visibleIds, matchCount } = useMemo(() => {
    const ids = new Set<number>();
    let count = 0;
    if (!bmrgData) return { visibleIds: ids, matchCount: 0 };

    for (const t of bmrgData.transitions) {
      if (deltaFilter === 'positive' && !(t.transition_delta > 0)) continue;
      if (deltaFilter === 'neutral'  && !(t.transition_delta === 0)) continue;
      if (deltaFilter === 'negative' && !(t.transition_delta < 0)) continue;
      if (!showSelfTransitions && t.start_state_id === t.end_state_id) continue;
      if (requireTime25  && !isTruthy(t.time_25))  continue;
      if (requireTime100 && !isTruthy(t.time_100)) continue;
      if (probActive) {
        const l25  = typeof t.likelihood_25  === 'number' ? t.likelihood_25  : NaN;
        const l100 = typeof t.likelihood_100 === 'number' ? t.likelihood_100 : NaN;
        const in25  = l25  >= probMin && l25  <= probMax;
        const in100 = l100 >= probMin && l100 <= probMax;
        const passRange = rangeMode === 'both' ? (in25 && in100) : (in25 || in100);
        if (!passRange) continue;
      }
      ids.add(t.transition_id);
      count++;
    }
    return { visibleIds: ids, matchCount: count };
  }, [
    bmrgData, showSelfTransitions, deltaFilter,
    requireTime25, requireTime100, probMin, probMax, rangeMode, probActive,
  ]);

  useEffect(() => {
    const hasLocal = requireTime25 || requireTime100 || probActive;
    const allEdges = Array.from(
      document.querySelectorAll<HTMLElement>('[data-id*="transition-"]')
    );
    if (!allEdges.length) return;

    if (!hasLocal) {
      allEdges.forEach((el) => (el.style.display = ''));
      return;
    }

    allEdges.forEach((el) => {
      const idAttr = el.getAttribute('data-id') || '';
      const m = idAttr.match(/transition-(\d+)/);
      if (!m) return;
      const id = Number(m[1]);
      el.style.display = visibleIds.has(id) ? '' : 'none';
    });
  }, [visibleIds, requireTime25, requireTime100, probActive]);

  const clearFilters = () => {
    setRequireTime25(false);
    setRequireTime100(false);
    setProbMin(0);
    setProbMax(1);
    setRangeMode('any');
    Array.from(document.querySelectorAll<HTMLElement>('[data-id*="transition-"]')).forEach((el) => {
      el.style.display = '';
    });
    onReset();
  };

  const content = (
    <div className="stm-ext-card">
      <div className="stm-ext-header">
        <div className="stm-ext-title">
          Transition Filters
          <span style={{ marginLeft: 8, fontWeight: 600, fontSize: 10, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>
            ({matchCount})
          </span>
        </div>
        <button
          className="stm-ext-btn ghost"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="stm-ext-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <label className="stm-ext-field">
              <span>Δ filter</span>
              <select
                value={deltaFilter}
                onChange={(e) => onDeltaFilterChange(e.target.value as DeltaFilterOption)}
              >
                <option value="all">All</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </label>
          </div>

          <div className="stm-ext-row">
            <label className="stm-ext-field">
              <input
                type="checkbox"
                checked={requireTime25}
                onChange={(e) => setRequireTime25(e.target.checked)}
              />
              <span>time_25 = true</span>
            </label>
            <label className="stm-ext-field">
              <input
                type="checkbox"
                checked={requireTime100}
                onChange={(e) => setRequireTime100(e.target.checked)}
              />
              <span>time_100 = true</span>
            </label>
          </div>

          <div className="stm-ext-row">
            <label className="stm-ext-field">
              <span>Prob min</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={probMin}
                onChange={(e) =>
                  setProbMin(Math.min(1, Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </label>
            <label className="stm-ext-field">
              <span>Prob max</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={probMax}
                onChange={(e) =>
                  setProbMax(Math.min(1, Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </label>
          </div>

          <div className="stm-ext-row">
            <label className="stm-ext-field">
              <span>Range</span>
              <select value={rangeMode} onChange={(e) => setRangeMode(e.target.value as 'any' | 'both')}>
                <option value="any">Either in range</option>
                <option value="both">Both in range</option>
              </select>
            </label>
          </div>

          <div className="stm-ext-actions">
            <button className="stm-ext-btn" onClick={clearFilters}>Clear</button>
          </div>
        </>
      )}
    </div>
  );

  // When in sidebar, render inline without Panel wrapper
  if (inSidebar) {
    return content;
  }

  // Fallback: render as floating panel (not used in new layout but kept for compat)
  return content;
}
