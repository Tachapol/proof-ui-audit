'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Code2,
  ExternalLink,
  Layers,
  LayoutGrid,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
} from 'lucide-react';
import type { KnowledgeEntry, KnowledgeKind } from '@/lib/knowledge/catalog';

interface KnowledgeWikiProps {
  entries: KnowledgeEntry[];
  backend?: 'postgres' | 'local';
  dbNotice?: string;
}

type ViewMode = 'wiki' | 'table';

const PILLARS: Array<{
  kind: KnowledgeKind;
  label: string;
  description: string;
  defaultSource: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    kind: 'standard',
    label: 'Standards (WCAG 2.2)',
    description: 'Authoritative deterministic rules & thresholds used in ProofUI audits.',
    defaultSource: 'proofui',
    icon: ShieldCheck,
  },
  {
    kind: 'heuristic',
    label: 'Heuristics & UX',
    description: 'UX guidelines, interaction patterns, and UI reasoning anti-patterns.',
    defaultSource: 'ux-guidelines.csv',
    icon: Sparkles,
  },
  {
    kind: 'implementation',
    label: 'Implementation (Stacks)',
    description: 'Framework & UI library best practices across React, Next.js, Tailwind, etc.',
    defaultSource: '',
    icon: Code2,
  },
  {
    kind: 'style',
    label: 'Styles & Products',
    description: 'Product profiles, layout patterns, and visual direction guidance.',
    defaultSource: 'products.csv',
    icon: Palette,
  },
];

export function KnowledgeWiki({ entries, backend = 'local', dbNotice }: KnowledgeWikiProps) {
  const [selectedSource, setSelectedSource] = useState<string>('__overview__');
  const [selectedKind, setSelectedKind] = useState<KnowledgeKind | ''>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('wiki');

  const kindCounts = useMemo(() => {
    const counts: Record<KnowledgeKind, number> = {
      standard: 0,
      heuristic: 0,
      implementation: 0,
      style: 0,
    };
    for (const e of entries) {
      counts[e.kind] = (counts[e.kind] || 0) + 1;
    }
    return counts;
  }, [entries]);

  const sourceGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.source, (map.get(e.source) || 0) + 1);
    }
    const core = ['proofui', 'ux-guidelines.csv', 'ui-reasoning.csv', 'products.csv'].filter((s) =>
      map.has(s)
    );
    const stacks = Array.from(map.keys())
      .filter((s) => s.startsWith('stacks/'))
      .sort();
    return { map, core, stacks };
  }, [entries]);

  const isOverview =
    selectedSource === '__overview__' && !selectedKind && !selectedCategory && search.trim() === '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const activeSrc = selectedSource === '__overview__' ? '' : selectedSource;
    return entries.filter((e) => {
      if (activeSrc && e.source !== activeSrc) return false;
      if (selectedKind && e.kind !== selectedKind) return false;
      if (selectedCategory && e.category !== selectedCategory) return false;
      if (!q) return true;
      return `${e.stableKey} ${e.source} ${e.category} ${e.title} ${e.body} ${e.recommendation}`
        .toLowerCase()
        .includes(q);
    });
  }, [entries, selectedSource, selectedKind, selectedCategory, search]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, KnowledgeEntry[]>();
    for (const e of filtered) {
      const key = e.category || 'General';
      const list = groups.get(key) || [];
      list.push(e);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleSelectSource = (src: string) => {
    setSelectedSource(src);
    setSelectedCategory('');
  };

  const handleToggleKind = (kind: KnowledgeKind | '') => {
    if (kind === '') {
      setSelectedKind('');
      setSelectedCategory('');
      if (selectedSource === '__overview__') setSelectedSource('');
      return;
    }
    const next = selectedKind === kind ? '' : kind;
    setSelectedKind(next);
    setSelectedCategory('');
    if (next && selectedSource === '__overview__') {
      setSelectedSource('');
    }
  };

  const handleReset = () => {
    setSelectedSource('__overview__');
    setSelectedKind('');
    setSelectedCategory('');
    setSearch('');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#212121] text-[#ececec] text-[13px]">
      {/* Wiki Sidebar */}
      <aside className="w-64 shrink-0 bg-[#171717] border-r border-white/[0.08] flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-[#ececec]">
            <BookOpen className="w-4 h-4 text-[#10a37f]" />
            <span>Knowledge Wiki</span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-[#9b9b9b] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Audit
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <button
            type="button"
            onClick={() => handleSelectSource('__overview__')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
              selectedSource === '__overview__'
                ? 'bg-[#2f2f2f] text-white font-medium'
                : 'text-[#d4d4d4] hover:bg-[#262626]'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <LayoutGrid className="w-3.5 h-3.5 text-[#10a37f]" />
              Overview
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSource('')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
              selectedSource === ''
                ? 'bg-[#2f2f2f] text-white font-medium'
                : 'text-[#d4d4d4] hover:bg-[#262626]'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Layers className="w-3.5 h-3.5 text-[#9b9b9b]" />
              All Entries
            </span>
            <span className="text-[11px] text-[#8e8e8e]">{entries.length}</span>
          </button>

          <div className="pt-3 pb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
            Core Knowledge
          </div>
          {sourceGroups.core.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => handleSelectSource(src)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                selectedSource === src
                  ? 'bg-[#2f2f2f] text-white font-medium'
                  : 'text-[#d4d4d4] hover:bg-[#262626]'
              }`}
            >
              <span className="truncate">{src}</span>
              <span className="text-[11px] text-[#8e8e8e]">{sourceGroups.map.get(src)}</span>
            </button>
          ))}

          <div className="pt-3 pb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
            Stacks ({sourceGroups.stacks.length})
          </div>
          {sourceGroups.stacks.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => handleSelectSource(src)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                selectedSource === src
                  ? 'bg-[#2f2f2f] text-white font-medium'
                  : 'text-[#d4d4d4] hover:bg-[#262626]'
              }`}
            >
              <span className="truncate">{src.replace('stacks/', '')}</span>
              <span className="text-[11px] text-[#8e8e8e]">{sourceGroups.map.get(src)}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 py-2.5 border-t border-white/[0.08] text-[11px] text-[#8e8e8e] flex items-center justify-between" title={dbNotice}>
          <span>Source</span>
          <span className={backend === 'postgres' ? 'text-[#10a37f] font-medium' : 'text-[#9b9b9b]'}>
            {backend === 'postgres' ? 'Supabase PG' : 'Local CSV'}
          </span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Clickable KPI Strip */}
        <section className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] bg-[#212121]">
          <button
            type="button"
            onClick={() => handleToggleKind('')}
            className={`px-3 py-1.5 rounded-lg border text-left transition-colors flex items-baseline gap-1.5 ${
              selectedKind === ''
                ? 'bg-[#2f2f2f] border-[#10a37f] text-white'
                : 'bg-[#171717] border-white/[0.08] hover:bg-[#2a2a2a]'
            }`}
          >
            <strong className="text-[15px]">{entries.length}</strong>
            <span className="text-xs text-[#9b9b9b]">Total</span>
          </button>

          {(['standard', 'heuristic', 'implementation', 'style'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleToggleKind(kind)}
              className={`px-3 py-1.5 rounded-lg border text-left transition-colors flex items-baseline gap-1.5 capitalize ${
                selectedKind === kind
                  ? 'bg-[#2f2f2f] border-[#10a37f] text-white'
                  : 'bg-[#171717] border-white/[0.08] hover:bg-[#2a2a2a]'
              }`}
            >
              <strong className="text-[15px]">{kindCounts[kind]}</strong>
              <span className="text-xs text-[#9b9b9b]">{kind}</span>
            </button>
          ))}

          <div className="ml-auto px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#171717] flex items-baseline gap-1.5">
            <strong className="text-[15px] text-[#10a37f]">{isOverview ? entries.length : filtered.length}</strong>
            <span className="text-xs text-[#9b9b9b]">Showing</span>
          </div>
        </section>

        {/* Search & View Bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] bg-[#212121]">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-[#8e8e8e] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search wiki..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#2f2f2f] border border-white/[0.12] text-[#ececec] placeholder:text-[#8e8e8e] focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="inline-flex rounded-lg border border-white/[0.12] bg-[#171717] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('wiki')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                viewMode === 'wiki' ? 'bg-[#2f2f2f] text-white font-medium' : 'text-[#9b9b9b] hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Wiki
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                viewMode === 'table' ? 'bg-[#2f2f2f] text-white font-medium' : 'text-[#9b9b9b] hover:text-white'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              Table
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg bg-[#2f2f2f] border border-white/[0.12] hover:bg-[#383838] text-xs"
          >
            Reset
          </button>
        </div>

        {/* Content Scroll */}
        <div className="flex-1 overflow-y-auto p-5">
          {isOverview ? (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h1 className="text-lg font-semibold text-white">ProofUI Knowledge Structure</h1>
                <p className="text-[#9b9b9b] mt-1">
                  Organized into 4 pillars. Deterministic rules remain authoritative; heuristics, stacks, and styles provide context.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PILLARS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.kind}
                      type="button"
                      onClick={() => {
                        setSelectedKind(p.kind);
                        setSelectedSource(p.defaultSource);
                      }}
                      className="text-left p-4 rounded-xl bg-[#171717] border border-white/[0.08] hover:border-[#10a37f] hover:bg-[#1e1e1e] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 font-medium text-white">
                          <Icon className="w-4 h-4 text-[#10a37f]" />
                          {p.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#2f2f2f] text-[#d4d4d4]">
                          {kindCounts[p.kind]}
                        </span>
                      </div>
                      <p className="text-xs text-[#9b9b9b] mt-2">{p.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-[#9b9b9b]">No matching entries</div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#171717] text-[#9b9b9b] border-b border-white/[0.08]">
                    <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Key</th>
                    <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Category</th>
                    <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Title</th>
                    <th className="text-left font-medium px-3 py-2.5">Body</th>
                    <th className="text-left font-medium px-3 py-2.5">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 400).map((r) => (
                    <tr key={r.stableKey} className="border-b border-white/[0.06] hover:bg-[#2a2a2a]">
                      <td className="px-3 py-2.5 font-mono text-xs text-[#9b9b9b] whitespace-nowrap align-top">
                        {r.stableKey}
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#2f2f2f] text-[#d4d4d4]">
                          {r.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-white align-top">{r.title}</td>
                      <td className="px-3 py-2.5 text-[#d4d4d4] whitespace-pre-wrap align-top">{r.body}</td>
                      <td className="px-3 py-2.5 text-[#d4d4d4] whitespace-pre-wrap align-top">
                        {r.recommendation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 400 && (
                <div className="p-3 text-center text-xs text-[#9b9b9b] bg-[#171717]">
                  Showing 400 / {filtered.length} entries. Narrow with search or category filter.
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Category Jump Pills */}
              {groupedByCategory.length > 1 && (
                <div className="flex flex-wrap gap-1.5 pb-2 border-b border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      selectedCategory === ''
                        ? 'bg-[#2f2f2f] border-[#10a37f] text-white'
                        : 'bg-[#171717] border-white/[0.08] text-[#9b9b9b] hover:text-white'
                    }`}
                  >
                    All categories ({groupedByCategory.length})
                  </button>
                  {groupedByCategory.map(([cat, list]) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        selectedCategory === cat
                          ? 'bg-[#2f2f2f] border-[#10a37f] text-white'
                          : 'bg-[#171717] border-white/[0.08] text-[#9b9b9b] hover:text-white'
                      }`}
                    >
                      {cat} ({list.length})
                    </button>
                  ))}
                </div>
              )}

              {/* Grouped Wiki Sections */}
              {groupedByCategory.slice(0, 40).map(([category, items]) => (
                <section key={category} className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                    <h2 className="text-sm font-semibold text-white">{category}</h2>
                    <span className="text-xs text-[#8e8e8e]">{items.length}</span>
                  </div>

                  <div className="space-y-2">
                    {items.slice(0, 100).map((item) => (
                      <article
                        key={item.stableKey}
                        className="p-3.5 rounded-xl bg-[#171717] border border-white/[0.08] space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-white">{item.title}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#2f2f2f] text-[#d4d4d4]">
                              {item.kind}
                            </span>
                            <span className="text-[11px] text-[#9b9b9b]">{item.severity}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-[#8e8e8e]">
                              {item.stableKey}
                            </span>
                            {item.docsUrl && (
                              <a
                                href={item.docsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-[#10a37f] hover:underline"
                              >
                                Docs <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        {item.body && <p className="text-[#d4d4d4] whitespace-pre-wrap">{item.body}</p>}

                        {item.recommendation && (
                          <p className="text-xs text-[#b4b4b4] whitespace-pre-wrap border-l-2 border-[#10a37f]/60 pl-2.5">
                            {item.recommendation}
                          </p>
                        )}

                        {(item.codeGood || item.codeBad) && (
                          <details className="pt-1">
                            <summary className="cursor-pointer text-xs text-[#10a37f] select-none">
                              Code example
                            </summary>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                              {item.codeGood && (
                                <pre className="p-2.5 rounded-lg bg-[#212121] border border-white/[0.08] text-[11px] text-[#d4d4d4] overflow-x-auto whitespace-pre-wrap">
                                  {item.codeGood}
                                </pre>
                              )}
                              {item.codeBad && (
                                <pre className="p-2.5 rounded-lg bg-[#212121] border border-white/[0.08] text-[11px] text-[#9b9b9b] overflow-x-auto whitespace-pre-wrap">
                                  {item.codeBad}
                                </pre>
                              )}
                            </div>
                          </details>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
