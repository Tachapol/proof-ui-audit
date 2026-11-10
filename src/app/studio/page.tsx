'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Code2,
  Download,
  Eye,
  History,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
  Sliders,
  ExternalLink,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { ProductContextFields } from '@/components/ProductContextFields';
import { EMPTY_PRODUCT_CONTEXT, ProductContextSchema, type ProductContext } from '@/lib/schema/product-context';
import { ROLE_NAMES, findStudioIssue, type StudioRole, type StudioSession } from '@/lib/studio/types';
import { formatStudioMarkdown } from '@/lib/studio/markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import './studio.css';

const frames = [
  { id: 'mvp-contrast-demo', name: 'Text contrast', detail: 'Four controlled cases', path: '/fixtures/mvp-contrast-demo' },
  { id: 'text-contrast-demo', name: 'Contrast suite', detail: 'Broader contrast examples', path: '/fixtures/text-contrast-demo' },
];

const frameName = (r: { fixtureId?: string; targetUrl: string }) =>
  frames.find(f => f.id === r.fixtureId)?.name || r.targetUrl;

const descriptions: Record<StudioRole, string> = {
  ux: 'Readability, accessibility & user needs',
  product: 'Product goals, brand & trade-offs',
  engineering: 'Feasible changes & verification',
};

const roleMeta: Record<StudioRole | 'lead', { icon: any; color: string; badge: string; bg: string; border: string }> = {
  ux: {
    icon: Users,
    color: 'text-blue-700',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    bg: 'bg-blue-50/50',
    border: 'border-blue-200',
  },
  product: {
    icon: Target,
    color: 'text-amber-800',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    bg: 'bg-amber-50/50',
    border: 'border-amber-200',
  },
  engineering: {
    icon: Code2,
    color: 'text-purple-700',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    bg: 'bg-purple-50/50',
    border: 'border-purple-200',
  },
  lead: {
    icon: Sparkles,
    color: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-200',
  },
};

const round = (n: number) => Number(n.toFixed(2));

async function post(data: unknown) {
  const response = await fetch('/api/studio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body.session as StudioSession;
}

export default function StudioPage() {
  const [inputMode, setInputMode] = useState<'fixture' | 'url'>('fixture');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [allowLocalhost, setAllowLocalhost] = useState(false);

  const [session, setSession] = useState<StudioSession | null>(null);
  const [selectedFrames, setSelectedFrames] = useState(['mvp-contrast-demo']);
  const [roles, setRoles] = useState<StudioRole[]>(['ux', 'product', 'engineering']);
  const [selectedModel, setSelectedModel] = useState('gpt-6-luna');

  const [context, setContext] = useState<ProductContext>(EMPTY_PRODUCT_CONTEXT);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [active, setActive] = useState('');
  const [chatRole, setChatRole] = useState<StudioRole | 'lead'>('lead');
  const [message, setMessage] = useState('');
  const [color, setColor] = useState('#111827');
  const [panel, setPanel] = useState<'agenda' | 'discussion' | 'preview'>('agenda');
  const [copied, setCopied] = useState(false);

  const [history, setHistory] = useState<Array<{ id: string; createdAt: string; frames: number; goal: string }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadHistory = () =>
    fetch('/api/studio')
      .then(r => r.json())
      .then(d => setHistory(d.sessions || []))
      .catch(() => undefined);

  const handleCopySummary = async () => {
    if (!session) return;
    try {
      const md = formatStudioMarkdown(session);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Could not copy to clipboard. Use Download MD instead.');
    }
  };

  useEffect(() => {
    void loadHistory();
    const params = new URLSearchParams(location.search);
    const id = params.get('session');
    const runId = params.get('runId');
    const issueFingerprint = params.get('issue');

    if (id) {
      setBusy('Opening saved critique…');
      fetch('/api/studio?id=' + encodeURIComponent(id))
        .then(r => r.json())
        .then(d => {
          if (!d.session) throw new Error(d.error);
          setSession(d.session);
          setActive(d.session.agenda[0]?.id || '');
        })
        .catch(e => setError(e.message))
        .finally(() => setBusy(''));
    } else if (runId) {
      setBusy('Importing audit evidence into Critique Studio…');
      post({ action: 'create', runIds: [runId], roles: ['ux', 'product', 'engineering'], model: selectedModel })
        .then(next => {
          acceptSession(next);
          if (issueFingerprint) {
            const matched = next.agenda.find(a => a.fingerprint === issueFingerprint);
            setActive(matched?.id || next.agenda[0]?.id || '');
          } else {
            setActive(next.agenda[0]?.id || '');
          }
          setPanel('agenda');
        })
        .catch(e => setError(e instanceof Error ? e.message : 'Could not import audit run into Studio.'))
        .finally(() => setBusy(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = session?.agenda.find(a => a.id === active);
  const run = session?.runs.find(r => r.id === item?.runId) || session?.runs[0];
  const issue = session && item ? findStudioIssue(session, item) : undefined;
  const candidate = session?.candidates[active];

  useEffect(() => {
    setColor(session?.candidates[active]?.color || '#111827');
  }, [active, session?.candidates]);

  function acceptSession(next: StudioSession) {
    setSession(next);
    historyReplace(next.id);
    void loadHistory();
  }

  function historyReplace(id: string) {
    window.history.replaceState(null, '', '/studio?session=' + encodeURIComponent(id));
  }

  async function start() {
    setError('');
    const parsed = ProductContextSchema.safeParse(context);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      const targets = inputMode === 'url' ? [websiteUrl.trim()] : selectedFrames.map(id => 'fixture://' + id);
      if (!targets[0]) throw new Error('Enter a website URL.');
      const ids: string[] = [];
      for (let i = 0; i < targets.length; i++) {
        setBusy(`Measuring frame ${i + 1} of ${targets.length}…`);
        const response = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: targets[i],
            allowLocalhost: inputMode === 'url' && allowLocalhost,
            productContext: parsed.data,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Audit failed.');
        ids.push(body.run.id);
      }
      setBusy('Analyzing findings and preparing agenda…');
      const next = await post({ action: 'create', runIds: ids, roles, model: selectedModel });
      acceptSession(next);
      setActive(next.agenda[0]?.id || '');
      setPanel('agenda');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start critique.');
    } finally {
      setBusy('');
    }
  }

  async function action(type: string, extra: Record<string, unknown> = {}) {
    if (!session || !item) return;
    setError('');
    setBusy(
      type === 'chat'
        ? 'Preparing a grounded reply…'
        : type === 'preview'
        ? 'Rendering and measuring the candidate in a sandbox…'
        : 'Saving your decision…'
    );
    try {
      acceptSession(await post({ action: type, sessionId: session.id, issueId: active, ...extra }));
      if (type === 'chat') setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy('');
    }
  }

  function selectIssue(id: string) {
    setActive(id);
    setError('');
    setPanel('discussion');
  }

  const applied = Object.values(session?.candidates || {}).filter(c => c.applied).length;

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 font-sans antialiased flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-zinc-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link className="flex items-center gap-2.5 font-semibold text-zinc-900 text-sm tracking-tight" href="/studio">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white shadow-sm">
              P
            </span>
            <span>ProofUI</span>
            <span className="hidden sm:inline-block border-l border-zinc-200 pl-2.5 text-xs font-normal text-zinc-500">
              Critique Studio
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400">
            <ChevronRight className="size-3.5" />
            <span className="text-zinc-600 font-medium">{session ? 'Design review' : 'New critique'}</span>
          </div>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1.5 font-normal text-zinc-600 border-zinc-200/80 bg-zinc-50/50">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>Evidence first</span>
          </Badge>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-zinc-200 hover:bg-zinc-100"
            onClick={() => {
              setHistoryOpen(!historyOpen);
              void loadHistory();
            }}
          >
            <History className="size-3.5" />
            <span>History</span>
            {history.length > 0 && (
              <span className="ml-0.5 rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-600">
                {history.length}
              </span>
            )}
          </Button>

          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-zinc-600 hover:text-zinc-900" asChild>
            <Link href="/">
              <span>Audit workspace</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </nav>
      </header>

      {/* History Slide-over/Flyout */}
      {historyOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 border-l border-zinc-200 bg-white p-5 shadow-2xl flex flex-col transition-all">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Review history</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Locally saved critique sessions</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close history" onClick={() => setHistoryOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 py-3 -mr-2 pr-2">
            {history.length ? (
              <div className="space-y-2">
                {history.map(h => (
                  <Link
                    key={h.id}
                    href={'/studio?session=' + h.id}
                    className="block rounded-lg border border-zinc-200/80 bg-white p-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50/70 shadow-sm"
                  >
                    <p className="text-xs font-medium text-zinc-900 truncate">{h.goal}</p>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-zinc-500">
                      <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">
                        {h.frames} frame{h.frames > 1 ? 's' : ''}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-8 text-center">Your saved critiques will appear here.</p>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Global Alerts: Error & Busy */}
      {error && (
        <div className="border-b border-red-200 bg-red-50/90 px-4 py-2.5 text-xs text-red-900 flex items-center justify-between sticky top-14 z-30 shadow-sm" role="alert">
          <div className="flex items-center gap-2">
            <CircleHelp className="size-4 text-red-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-700 hover:bg-red-100" aria-label="Dismiss error" onClick={() => setError('')}>
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {busy && (
        <div className="border-b border-zinc-200 bg-zinc-900 text-zinc-50 px-4 py-2.5 text-xs flex items-center gap-2.5 sticky top-14 z-30 shadow-sm" role="status" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin text-zinc-300 shrink-0" />
          <span className="font-medium text-zinc-100">{busy}</span>
        </div>
      )}

      {/* Main Content Area */}
      {!session ? (
        /* SETUP SCREEN */
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 mb-8 border-b border-zinc-200">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">Create a new critique</h1>
            </div>
            <Button
              size="lg"
              className="bg-zinc-900 text-zinc-50 hover:bg-zinc-800 shadow gap-2 shrink-0 h-11 px-5"
              onClick={() => void start()}
              disabled={!!busy || (inputMode === 'fixture' ? !selectedFrames.length : !websiteUrl.trim()) || !roles.length}
            >
              <span>Start critique</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Step 1: Select Frames (Col span 5) */}
            <Card className="lg:col-span-5 shadow-sm border-zinc-200">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-700">
                    01
                  </span>
                  <CardTitle className="text-base font-semibold">Select your frames</CardTitle>
                </div>
                <CardDescription className="text-xs">Choose the rendered UI you want to review.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                {/* Input Mode Selector */}
                <div className="flex rounded-lg bg-zinc-100 p-1 text-xs" role="group" aria-label="UI input type">
                  <button
                    type="button"
                    aria-pressed={inputMode === 'fixture'}
                    disabled={!!busy}
                    onClick={() => setInputMode('fixture')}
                    className={cn(
                      'flex-1 py-1.5 px-3 rounded-md font-medium transition-all text-center',
                      inputMode === 'fixture'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900'
                    )}
                  >
                    Demo frames
                  </button>
                  <button
                    type="button"
                    aria-pressed={inputMode === 'url'}
                    disabled={!!busy}
                    onClick={() => setInputMode('url')}
                    className={cn(
                      'flex-1 py-1.5 px-3 rounded-md font-medium transition-all text-center',
                      inputMode === 'url'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900'
                    )}
                  >
                    Website URL
                  </button>
                </div>

                {inputMode === 'url' ? (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <label htmlFor="studio-website" className="text-xs font-medium text-zinc-700">
                        Website URL
                      </label>
                      <Input
                        id="studio-website"
                        type="url"
                        placeholder="https://your-website.com or http://localhost:3000"
                        value={websiteUrl}
                        onChange={e => setWebsiteUrl(e.target.value)}
                        disabled={!!busy}
                        className="text-xs"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Code opens the page and measures its rendered DOM/CSS at mobile and desktop widths. The review panel currently focuses on text contrast.
                    </p>
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowLocalhost}
                        onChange={e => setAllowLocalhost(e.target.checked)}
                        disabled={!!busy}
                        className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                      />
                      <span>Allow this localhost target (local development only)</span>
                    </label>
                    <p className="text-[10px] text-zinc-400">
                      Use a page that opens without signing in.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {frames.map(frame => {
                      const isSelected = selectedFrames.includes(frame.id);
                      return (
                        <label
                          key={frame.id}
                          className={cn(
                            'relative flex flex-col items-center p-3 rounded-lg border text-center cursor-pointer transition-all',
                            isSelected
                              ? 'border-zinc-900 bg-zinc-50/50 ring-1 ring-zinc-900 shadow-sm'
                              : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/30'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!!busy}
                            onChange={e =>
                              setSelectedFrames(
                                e.target.checked
                                  ? [...selectedFrames, frame.id]
                                  : selectedFrames.filter(f => f !== frame.id)
                              )
                            }
                            className="sr-only"
                          />
                          <div className="studio-thumb-frame my-2 border border-zinc-200">
                            <iframe src={frame.path} title={frame.name + ' thumbnail'} tabIndex={-1} />
                          </div>
                          <span className="text-xs font-semibold text-zinc-900 mt-1">{frame.name}</span>
                          <span className="text-[10px] text-zinc-500 mt-0.5">{frame.detail}</span>
                          {isSelected && (
                            <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-white">
                              <Check className="size-2.5 stroke-[3]" />
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-start gap-2.5 pt-3 border-t border-zinc-100 text-xs text-zinc-500">
                  <Layers className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-zinc-700">Working MVP · Text contrast</span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Use Website URL for your own rendered UI. Figma import is not connected.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Steps 2 & 3 (Col span 7) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 2: Add Perspective */}
              <Card className="shadow-sm border-zinc-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-700">
                      02
                    </span>
                    <CardTitle className="text-base font-semibold">Add your perspective</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Optional product details for this critique.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ProductContextFields value={context} onChange={setContext} disabled={!!busy} />
                </CardContent>
              </Card>

              {/* Step 3: Build Review Panel */}
              <Card className="shadow-sm border-zinc-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-700">
                      03
                    </span>
                    <CardTitle className="text-base font-semibold">Build your review panel</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Select roles for this review.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['ux', 'product', 'engineering'] as StudioRole[]).map(role => {
                      const isSelected = roles.includes(role);
                      const meta = roleMeta[role];
                      const Icon = meta.icon;
                      return (
                        <button
                          key={role}
                          type="button"
                          aria-pressed={isSelected}
                          disabled={!!busy}
                          onClick={() =>
                            setRoles(isSelected ? roles.filter(r => r !== role) : [...roles, role])
                          }
                          className={cn(
                            'relative flex flex-col p-3.5 rounded-lg border text-left transition-all',
                            isSelected
                              ? 'border-zinc-900 bg-white ring-1 ring-zinc-900 shadow-sm'
                              : 'border-zinc-200 bg-zinc-50/50 hover:bg-white hover:border-zinc-300 opacity-75'
                          )}
                        >
                          <div className="flex items-center justify-between w-full mb-2">
                            <span className={cn('flex h-7 w-7 items-center justify-center rounded-md border', meta.badge)}>
                              <Icon className="size-3.5" />
                            </span>
                            {isSelected && (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-white">
                                <Check className="size-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-zinc-900">{ROLE_NAMES[role]}</span>
                          <span className="text-[11px] text-zinc-500 mt-1 leading-snug">{descriptions[role]}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-4 mt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <label htmlFor="studio-model-select" className="text-xs font-semibold text-zinc-900 block">
                        AI Model
                      </label>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Select the model to power this critique session
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        id="studio-model-select"
                        value={selectedModel}
                        onChange={e => setSelectedModel(e.target.value)}
                        disabled={!!busy}
                        className="h-8 text-xs rounded-md border border-zinc-200 bg-white px-2.5 font-medium text-zinc-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-950 min-w-[200px]"
                      >
                        <option value="gpt-6-luna">gpt-6-luna (Fast & Accurate)</option>
                        <option value="gpt-6-luna-decisions">gpt-6-luna-decisions (Decisive)</option>
                        <option value="gpt-5.6-luna">gpt-5.6-luna (Lightweight)</option>
                        <option value="qwen3.8-27b">qwen3.8-27b (KMUTT)</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      ) : (
        /* WORKSPACE / REVIEW SCREEN */
        <main className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Review Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-zinc-200 bg-white">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  setSession(null);
                  setActive('');
                  window.history.replaceState(null, '', '/studio');
                }}
                disabled={!!busy}
              >
                <ArrowLeft className="size-3.5" />
                <span>New critique</span>
              </Button>
              <h1 className="text-sm font-semibold text-zinc-900">Design review</h1>
              <Badge variant="secondary" className="font-medium text-[11px]">
                {session.runs.length} frame(s)
              </Badge>
              <Badge variant="secondary" className="font-medium text-[11px]">
                {session.agenda.length} findings
              </Badge>
              {applied > 0 && (
                <Badge variant="success" className="font-medium text-[11px] gap-1">
                  <CheckCircle2 className="size-3" />
                  {applied} applied in preview
                </Badge>
              )}
            </div>

            <nav className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:inline-flex text-[11px] text-zinc-500 border-zinc-200 font-normal">
                CPE · {session.model}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-zinc-200 text-zinc-700 hover:text-zinc-900 shadow-xs"
                onClick={handleCopySummary}
                title="Copy Markdown summary to clipboard"
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-zinc-200 text-zinc-700 hover:text-zinc-900 shadow-xs" asChild>
                <a href={`/api/studio?id=${session.id}&format=markdown`} download={`proofui-studio-${session.id}.md`}>
                  <Download className="size-3.5" />
                  <span>Report</span>
                </a>
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-zinc-200 text-zinc-700 hover:text-zinc-900 shadow-xs" asChild>
                <a href={`/api/studio?id=${session.id}&format=json`} download={`proofui-studio-${session.id}.json`}>
                  <span>JSON</span>
                </a>
              </Button>
            </nav>
          </div>

          {/* Mobile / Tablet Tab Switcher */}
          <div className="xl:hidden flex border-b border-zinc-200 bg-zinc-50/80 p-1.5 gap-1.5" role="tablist" aria-label="Review panels">
            {(['agenda', 'discussion', 'preview'] as const).map(tab => (
              <button
                key={tab}
                role="tab"
                aria-selected={panel === tab}
                onClick={() => setPanel(tab)}
                className={cn(
                  'flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all text-center',
                  panel === tab
                    ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/80'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                {tab === 'agenda' ? 'Agenda' : tab === 'discussion' ? 'Discussion' : 'Preview'}
              </button>
            ))}
          </div>

          {/* Multi-Panel Studio Grid */}
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-[100px_minmax(280px,0.95fr)_minmax(350px,1.15fr)_minmax(320px,1fr)] h-auto xl:h-[calc(100vh-112px)] overflow-hidden divide-y xl:divide-y-0 xl:divide-x divide-zinc-200">
            {/* Column 1: Frames Sidebar */}
            <aside className="hidden xl:flex flex-col p-3 bg-zinc-50/50 overflow-y-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3 px-1">Frames</span>
              <div className="space-y-3">
                {session.runs.map(r => (
                  <button
                    key={r.id}
                    aria-pressed={run?.id === r.id}
                    onClick={() => {
                      setActive(session.agenda.find(a => a.runId === r.id)?.id || '');
                      setPanel('agenda');
                    }}
                    className={cn(
                      'w-full flex flex-col items-center p-2 rounded-lg border text-center transition-all',
                      run?.id === r.id
                        ? 'border-zinc-900 bg-white shadow-sm ring-1 ring-zinc-900'
                        : 'border-zinc-200 bg-white/70 hover:border-zinc-300 hover:bg-white'
                    )}
                  >
                    <div className="studio-mini-frame-box mb-1.5">
                      {r.fixtureId ? (
                        <iframe title={r.fixtureId + ' frame thumbnail'} src={'/fixtures/' + r.fixtureId} tabIndex={-1} />
                      ) : r.pageScreenshots?.[0] ? (
                        <img src={r.pageScreenshots[0].path} alt={'Captured UI: ' + r.targetUrl} className="w-full h-full object-cover object-top" />
                      ) : (
                        <span className="text-[9px] text-zinc-400 flex items-center justify-center h-full">N/A</span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-700 truncate w-full px-1">{frameName(r)}</span>
                  </button>
                ))}
              </div>
              <span className="mt-auto pt-4 text-[10px] text-zinc-400 text-center">Saved locally</span>
            </aside>

            {/* Column 2: Critique Agenda */}
            <section
              className={cn(
                'flex-col bg-white overflow-y-auto',
                panel === 'agenda' ? 'flex' : 'hidden xl:flex'
              )}
            >
              {/* Agenda Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/30">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Agenda</span>
                  <h2 className="text-sm font-semibold text-zinc-900 mt-0.5">Critique agenda</h2>
                </div>
                <Avatar className="h-7 w-7 border border-emerald-200 bg-emerald-50 text-emerald-800">
                  <AvatarFallback className="bg-transparent text-emerald-800">
                    <Sparkles className="size-3.5" />
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Lead Summary Callout Card */}
              <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-900">Lead Coordinator</span>
                    <span className="text-[11px] text-zinc-500">· {session.roles.length} roles</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1 px-2 text-zinc-600 hover:text-zinc-900"
                    onClick={handleCopySummary}
                  >
                    {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">
                  {session.agenda.reduce(
                    (text, a, index) => text.replaceAll(a.id, `finding ${index + 1}`),
                    session.leadSummary
                  )}
                </p>
                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-zinc-200/60">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1.5 border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 shadow-xs"
                    onClick={handleCopySummary}
                  >
                    {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{copied ? 'Copied to clipboard!' : 'Copy Summary for Jira/Slack'}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1.5 border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 shadow-xs"
                    asChild
                  >
                    <a href={`/api/studio?id=${session.id}&format=markdown`} download={`proofui-studio-${session.id}.md`}>
                      <Download className="size-3" />
                      <span>Download Markdown</span>
                    </a>
                  </Button>
                </div>
              </div>

              {/* Role Errors if any */}
              {Object.entries(session.roleErrors).map(([role, msg]) => (
                <div key={role} className="m-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>{ROLE_NAMES[role as StudioRole | 'lead']}:</strong> {msg}
                  </span>
                </div>
              ))}

              {/* Agenda Findings List */}
              <div className="p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1 mb-2 block">
                  Prioritized for discussion
                </span>
                <div className="space-y-1.5">
                  {session.agenda.map((a, index) => {
                    const isActive = active === a.id;
                    const frame = frames.find(f => f.id === session.runs.find(r => r.id === a.runId)?.fixtureId);
                    return (
                      <button
                        key={a.id}
                        onClick={() => selectIssue(a.id)}
                        className={cn(
                          'w-full flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all',
                          isActive
                            ? 'border-zinc-900 bg-zinc-50/70 shadow-sm ring-1 ring-zinc-900'
                            : 'border-zinc-200/80 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                            a.status === 'needsReview'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-red-100 text-red-900'
                          )}
                        >
                          {index + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-0.5">
                            <span>{frame?.name || 'Frame'}</span>
                            <span>·</span>
                            <span>{a.status === 'needsReview' ? 'Needs review' : 'Candidate issue'}</span>
                          </div>
                          <strong className="text-xs font-semibold text-zinc-900 line-clamp-2">{a.title}</strong>
                          <div className="flex flex-wrap items-center gap-1 mt-2">
                            {a.notes.map(n => {
                              const meta = roleMeta[n.role];
                              return (
                                <span
                                  key={n.role}
                                  className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded border', meta.badge)}
                                >
                                  {ROLE_NAMES[n.role]}
                                </span>
                              );
                            })}
                            {a.decision && (
                              <Badge
                                variant={a.decision === 'accepted' ? 'success' : 'secondary'}
                                className="text-[9px] px-1.5 py-0"
                              >
                                {a.decision}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="size-4 text-zinc-400 shrink-0 self-center" />
                      </button>
                    );
                  })}
                </div>

                {!session.agenda.length && (
                  <div className="py-12 px-4 text-center">
                    <ShieldCheck className="size-8 text-zinc-300 mx-auto mb-2" />
                    <h3 className="text-xs font-semibold text-zinc-700">No candidate findings</h3>
                    <p className="text-[11px] text-zinc-400 mt-1">No text contrast issue was flagged by the selected checks.</p>
                  </div>
                )}
              </div>

              {/* Collapsible Product Context */}
              <div className="p-3 border-t border-zinc-100 mt-auto">
                <details className="text-xs text-zinc-600 group">
                  <summary className="font-medium text-zinc-800 cursor-pointer hover:text-zinc-900 py-1 flex items-center justify-between">
                    <span>Product context</span>
                    <span className="text-[10px] text-zinc-400 group-open:rotate-90 transition-transform">▸</span>
                  </summary>
                  <div className="space-y-2 pt-2 text-[11px]">
                    {Object.entries(session.runs[0]?.productContext || {})
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="p-2 rounded bg-zinc-50 border border-zinc-100">
                          <strong className="block text-[10px] uppercase font-bold text-zinc-400">
                            {
                              (
                                {
                                  productGoal: 'Product goal',
                                  brandKeywords: 'Brand keywords',
                                  themeColor: 'Theme color',
                                  targetAudience: 'Target audience',
                                  additionalContext: 'Others',
                                } as Record<string, string>
                              )[k]
                            }
                          </strong>
                          <span className="text-zinc-700 mt-0.5 block">{v}</span>
                        </div>
                      ))}
                  </div>
                </details>
              </div>
            </section>

            {/* Column 3: Discussion */}
            <section
              className={cn(
                'flex-col bg-white overflow-y-auto',
                panel === 'discussion' ? 'flex' : 'hidden xl:flex'
              )}
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/30">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Discussion</span>
                  <h2 className="text-sm font-semibold text-zinc-900 mt-0.5">Discussion</h2>
                </div>
                <MessageSquare className="size-4 text-zinc-400" />
              </div>

              {item && issue ? (
                <>
                  {/* Selected Finding Header Card */}
                  <div className="p-4 border-b border-zinc-100 bg-zinc-50/40">
                    <Badge
                      variant={item.status === 'needsReview' ? 'review' : 'destructive'}
                      className="text-[10px] mb-2"
                    >
                      {item.status === 'needsReview' ? 'Designer review needed' : 'Measured finding'}
                    </Badge>
                    <h3 className="text-sm font-semibold text-zinc-900 leading-snug">{item.title}</h3>

                    {/* Measured Evidence Strip */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 p-2.5 rounded-lg border border-zinc-200/80 bg-white text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Contrast</span>
                        <strong className="text-xs font-bold text-zinc-900">{String(issue.representative.measured.contrastRatio)}:1</strong>
                      </div>
                      <div className="border-l border-zinc-200 pl-4">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Criterion</span>
                        <strong className="text-xs font-bold text-zinc-900">{String(issue.representative.expected.minRatio)}:1</strong>
                      </div>
                      <div className="border-l border-zinc-200 pl-4">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Scope</span>
                        <span className="text-xs font-medium text-zinc-700">Text contrast</span>
                      </div>
                    </div>

                    <details className="mt-2.5 text-xs text-zinc-500">
                      <summary className="cursor-pointer hover:text-zinc-800 text-[11px]">
                        Measurement evidence & guideline
                      </summary>
                      <pre className="mt-1.5 p-2 rounded bg-zinc-100 text-[10px] font-mono overflow-x-auto text-zinc-800">
                        {JSON.stringify({ measured: issue.representative.measured, expected: issue.representative.expected }, null, 2)}
                      </pre>
                      <a
                        href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-1.5"
                      >
                        <span>WCAG 1.4.3 · Contrast (Minimum)</span>
                        <ExternalLink className="size-3" />
                      </a>
                    </details>
                  </div>

                  {/* Conversation & Role Notes */}
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {item.notes.map(note => {
                      const meta = roleMeta[note.role];
                      const Icon = meta.icon;
                      return (
                        <div key={note.role} className="flex gap-3 p-3.5 rounded-xl border border-zinc-200/80 bg-white shadow-sm">
                          <Avatar className={cn('h-8 w-8 shrink-0 border', meta.badge)}>
                            <AvatarFallback className="bg-transparent font-bold text-xs">
                              <Icon className="size-4" />
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-semibold text-zinc-900 mb-1">{ROLE_NAMES[note.role]}</h4>
                            <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">{note.comment}</p>

                            <div className="mt-3 p-2.5 rounded-lg border-l-2 border-emerald-600 bg-emerald-50/50 text-xs">
                              <strong className="block text-[10px] uppercase font-bold text-emerald-800 mb-0.5">Possible direction</strong>
                              <p className="text-zinc-800 text-[11px] leading-relaxed">{note.recommendation}</p>
                            </div>

                            {note.tradeoff && (
                              <div className="mt-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 text-xs text-amber-900">
                                <strong className="block text-[10px] uppercase font-bold text-amber-800 mb-0.5">Trade-off</strong>
                                <p className="text-[11px] leading-relaxed">{note.tradeoff}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {!item.notes.length && (
                      <p className="p-3 text-xs text-amber-800 bg-amber-50 rounded-lg border border-amber-200">
                        Role feedback is unavailable. You can still inspect the measured evidence or start a new review.
                      </p>
                    )}

                    {session.messages
                      .filter(m => m.issueId === active)
                      .map(m => (
                        <div
                          key={m.id}
                          className={cn(
                            'p-3 rounded-xl text-xs max-w-[85%] leading-relaxed shadow-sm',
                            m.sender === 'user'
                              ? 'ml-auto bg-zinc-900 text-zinc-50'
                              : 'mr-auto bg-zinc-100 text-zinc-900 border border-zinc-200/70'
                          )}
                        >
                          <small className={cn('block text-[10px] font-semibold mb-1', m.sender === 'user' ? 'text-zinc-300' : 'text-zinc-500')}>
                            {m.sender === 'user' ? 'You' : ROLE_NAMES[m.sender]}
                          </small>
                          <p className="whitespace-pre-wrap">{m.text}</p>
                        </div>
                      ))}
                  </div>

                  {/* Decision Bar */}
                  <div className="flex items-center justify-between gap-2 p-3 border-t border-zinc-200 bg-zinc-50/50">
                    <span className="text-xs text-zinc-500">{item.decision ? 'Decision: ' + item.decision : ''}</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={item.decision === 'accepted' ? 'default' : 'outline'}
                        className="h-7 text-xs gap-1"
                        disabled={!!busy}
                        aria-pressed={item.decision === 'accepted'}
                        onClick={() => void action('decision', { decision: 'accepted' })}
                      >
                        <Check className="size-3" />
                        <span>Accept finding</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={item.decision === 'rejected' ? 'destructive' : 'outline'}
                        className="h-7 text-xs"
                        disabled={!!busy}
                        aria-pressed={item.decision === 'rejected'}
                        onClick={() => void action('decision', { decision: 'rejected' })}
                      >
                        <span>Reject</span>
                      </Button>
                    </div>
                  </div>

                  {/* Chat Composer */}
                  <form
                    className="p-3 border-t border-zinc-200 bg-white space-y-2 sticky bottom-0"
                    onSubmit={e => {
                      e.preventDefault();
                      void action('chat', { role: chatRole, message });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor="studio-chat-role">
                        Discussion role
                      </label>
                      <select
                        id="studio-chat-role"
                        value={chatRole}
                        onChange={e => setChatRole(e.target.value as StudioRole | 'lead')}
                        disabled={!!busy}
                        className="h-7 text-xs rounded-md border border-zinc-200 bg-zinc-50 px-2 font-medium text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                      >
                        {(['lead', ...session.roles] as Array<StudioRole | 'lead'>).map(role => (
                          <option key={role} value={role}>
                            @{ROLE_NAMES[role]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <label className="sr-only" htmlFor="studio-message">
                        Your question
                      </label>
                      <Textarea
                        id="studio-message"
                        placeholder="Ask about this finding or explore a trade-off…"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        maxLength={1500}
                        disabled={!!busy}
                        rows={2}
                        className="text-xs min-h-[50px] resize-none"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="h-auto w-10 shrink-0 bg-zinc-900 text-white hover:bg-zinc-800"
                        aria-label="Send question"
                        disabled={!!busy || !message.trim()}
                      >
                        <Send className="size-4" />
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                  <MessageSquare className="size-8 mb-2 text-zinc-300" />
                  <h3 className="text-xs font-semibold text-zinc-700">Choose a finding</h3>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">
                    Select an agenda item to view findings and discuss.
                  </p>
                </div>
              )}
            </section>

            {/* Column 4: Preview & Apply */}
            <section
              className={cn(
                'flex-col bg-zinc-50/50 overflow-y-auto',
                panel === 'preview' ? 'flex' : 'hidden xl:flex'
              )}
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 bg-white">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Preview</span>
                  <h2 className="text-sm font-semibold text-zinc-900 mt-0.5">Preview & apply</h2>
                </div>
                <Eye className="size-4 text-zinc-400" />
              </div>

              {run && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-600">
                    <span className="font-medium text-zinc-800 truncate">{frameName(run)}</span>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {run.viewports[0]?.width}px · {candidate?.applied ? 'Session preview' : 'Original frame'}
                    </Badge>
                  </div>

                  {/* Device Frame Viewport */}
                  <div className="studio-live-viewport">
                    {run.fixtureId ? (
                      <iframe
                        key={session.id + active + candidate?.applied}
                        title="Active frame preview"
                        src={`/fixtures/${run.fixtureId}?studioSession=${session.id}`}
                        style={{ width: run.viewports[0]?.width || 375 }}
                      />
                    ) : run.pageScreenshots?.[0] ? (
                      <a href={run.targetUrl} target="_blank" rel="noreferrer" className="block max-w-full">
                        <img src={run.pageScreenshots[0].path} alt="Captured website UI at audit time" className="rounded-lg shadow" />
                      </a>
                    ) : (
                      <a href={run.targetUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                        Open audited website ↗
                      </a>
                    )}
                  </div>

                  {!run.fixtureId && (
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Captured at audit time.{' '}
                      <a href={run.targetUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        Open original ↗
                      </a>{' '}
                      · Website fixes require source changes and a new audit.
                    </p>
                  )}

                  {run.auditWarnings?.map(w => (
                    <p key={w} className="text-xs p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Patch & Color Exploration */}
              {run?.fixtureId &&
              ['mvp-contrast-demo', 'text-contrast-demo'].includes(run.fixtureId) &&
              item &&
              issue &&
              item.status === 'candidateFail' &&
              /^#[a-zA-Z][\w-]*$/.test(issue.representative.selector) ? (
                <div className="p-4 border-t border-zinc-200 bg-white space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-900">Explore a color correction</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      A code-generated CSS candidate. Preview runs the contrast check again before you apply it.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="studio-color" className="text-xs font-medium text-zinc-700 block">
                      Candidate text color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="studio-color"
                        type="color"
                        value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#111827'}
                        onChange={e => setColor(e.target.value)}
                        disabled={!!busy}
                        className="h-8 w-9 rounded border border-zinc-200 p-0.5 cursor-pointer"
                      />
                      <label className="sr-only" htmlFor="studio-color-hex">
                        Candidate color hex
                      </label>
                      <Input
                        id="studio-color-hex"
                        type="text"
                        value={color}
                        maxLength={7}
                        onChange={e => setColor(e.target.value)}
                        disabled={!!busy}
                        className="h-8 w-24 text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 ml-auto"
                        disabled={!!busy || !/^#[0-9a-f]{6}$/i.test(color)}
                        onClick={() => {
                          setPanel('preview');
                          void action('preview', { color });
                        }}
                      >
                        <Eye className="size-3.5" />
                        <span>Preview & measure</span>
                      </Button>
                    </div>
                  </div>

                  <pre className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-[11px] font-mono text-zinc-800 overflow-x-auto">
                    {issue.representative.selector + ' {\n  color: ' + color + ';\n}'}
                  </pre>

                  {/* Candidate Verification & Results */}
                  {candidate && (
                    <Card className="border-zinc-200 shadow-none bg-zinc-50/50">
                      <CardContent className="p-3.5 space-y-3">
                        <div
                          className={cn(
                            'flex items-center gap-2 text-xs font-semibold',
                            candidate.verified ? 'text-emerald-700' : 'text-red-700'
                          )}
                        >
                          {candidate.verified ? <ShieldCheck className="size-4" /> : <CircleHelp className="size-4" />}
                          <span>{candidate.verified ? 'Selected checks passed' : 'Candidate needs revision'}</span>
                        </div>

                        {/* Before / After comparison */}
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <figure className="space-y-1">
                            <img
                              src={candidate.beforeScreenshot}
                              alt="Baseline before color patch"
                              className="h-28 w-full object-cover object-top rounded-lg border border-zinc-200 bg-white"
                            />
                            <figcaption className="text-[10px] text-zinc-500 font-medium">
                              Before · {round(candidate.beforeRatio)}:1
                            </figcaption>
                          </figure>
                          <figure className="space-y-1">
                            <img
                              src={candidate.afterScreenshot}
                              alt="Candidate after color patch"
                              className="h-28 w-full object-cover object-top rounded-lg border border-zinc-200 bg-white"
                            />
                            <figcaption className="text-[10px] text-zinc-500 font-medium">
                              Candidate · {round(candidate.afterRatio)}:1
                            </figcaption>
                          </figure>
                        </div>

                        {/* Checks */}
                        <ul className="text-[11px] text-zinc-600 space-y-1 pt-1 border-t border-zinc-200">
                          <li className="flex items-center gap-1.5">
                            <span className={candidate.checks.contrast ? 'text-emerald-600' : 'text-red-600'}>●</span>
                            <span>Contrast: {candidate.checks.contrast ? 'passed' : 'below threshold'}</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className={candidate.checks.noNewOverflow ? 'text-emerald-600' : 'text-red-600'}>●</span>
                            <span>No new horizontal overflow: {candidate.checks.noNewOverflow ? 'passed' : 'failed'}</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className={candidate.checks.geometryUnchanged ? 'text-emerald-600' : 'text-red-600'}>●</span>
                            <span>Target geometry unchanged: {candidate.checks.geometryUnchanged ? 'passed' : 'failed'}</span>
                          </li>
                        </ul>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            size="sm"
                            className="h-8 text-xs gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
                            disabled={!!busy || !candidate.verified || candidate.applied || candidate.color !== color}
                            onClick={() => void action('apply')}
                          >
                            {candidate.applied ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                            <span>{candidate.applied ? 'Applied to preview' : 'Apply to preview'}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            disabled={!!busy || !candidate.applied}
                            onClick={() => void action('revert')}
                          >
                            <RotateCcw className="size-3.5" />
                            <span>Revert</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="p-4 border-t border-zinc-200 text-xs text-zinc-500">
                  <p>
                    {!run?.fixtureId
                      ? 'Automatic Apply is available for demo frames only. Use the measured evidence and discussion to guide changes to your website.'
                      : item?.status === 'needsReview'
                      ? 'This finding needs contextual designer review. No automatic correction is offered.'
                      : 'Select a candidate finding to explore a verified color correction.'}
                  </p>
                </div>
              )}

              <footer className="p-4 mt-auto border-t border-zinc-200 text-[11px] text-zinc-400">
                Apply updates this session’s preview. Original source files remain unchanged.
              </footer>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
