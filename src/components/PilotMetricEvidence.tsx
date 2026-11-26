import type { PilotMetricResult } from '@/lib/schema/pilot-metric';

const labels = { 'touch-target-spacing': 'Touch Target Spacing', 'heading-hierarchy': 'Heading Hierarchy' };
const executionLabels = { completed: 'Completed', partial: 'Partial', skipped: 'Skipped', error: 'Measurement error' };
const applicabilityLabels = { applicable: 'Applicable', not_applicable: 'Not applicable', unknown: 'Undetermined' };

type Measurement = PilotMetricResult['measurements'][number];
type Finding = { key: string; text: string; distance?: number; overlap?: boolean };

function record(value: unknown): Measurement {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Measurement : {};
}

function viewportName(result: PilotMetricResult) {
  return `${result.viewport.width}×${result.viewport.height}`;
}

function elementName(element: Measurement, actionLabels: Map<string, string>) {
  const tag = typeof element.element === 'string' ? element.element : 'control';
  const name = typeof element.accessibleName === 'string' && element.accessibleName.trim()
    ? element.accessibleName.trim()
    : typeof element.actionId === 'string' ? actionLabels.get(element.actionId) : undefined;
  if (name) return `“${name}” ${tag}`;
  return typeof element.selector === 'string' && /^#[\w-]+$/.test(element.selector)
    ? `${tag} (${element.selector})`
    : tag;
}

function measuredFindings(result: PilotMetricResult): Finding[] {
  const actionLabels = new Map<string, string>();
  if (result.metricId === 'touch-target-spacing') {
    for (const row of result.measurements) {
      const target = record(row.target);
      if (target.element === 'label' && typeof target.actionId === 'string' &&
        typeof target.accessibleName === 'string' && target.accessibleName.trim()) {
        actionLabels.set(target.actionId, target.accessibleName.trim());
      }
    }
  }

  const findings = new Map<string, Finding>();
  for (const row of result.measurements) {
    if (row.outcome !== 'needsReview') continue;

    if (result.metricId === 'touch-target-spacing') {
      const target = record(row.target);
      const neighbor = record(row.nearestTarget);
      const { distance, overlap } = row;
      if (typeof target.selector !== 'string' || typeof neighbor.selector !== 'string' ||
        typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0 || typeof overlap !== 'boolean') continue;

      // The same nearest pair can be recorded in both directions.
      const pair = target.selector.localeCompare(neighbor.selector) <= 0 ? [target, neighbor] : [neighbor, target];
      const key = JSON.stringify([pair[0].selector, pair[1].selector, distance, overlap]);
      const names = pair.map(item => elementName(item, actionLabels)).join(' and ');
      const gap = `${distance} CSS px`;
      const text = overlap ? `The ${names} overlap (${gap} edge gap)`
        : distance === 0 ? `The ${names} sit edge to edge (${gap} gap)`
          : `The ${names} are ${gap} apart`;
      findings.set(key, { key, text, distance, overlap });
    } else {
      const previous = record(row.previousHeading);
      if (typeof row.selector !== 'string' || typeof row.level !== 'number' || typeof previous.level !== 'number') continue;
      const key = JSON.stringify([previous.selector, previous.level, row.selector, row.level]);
      const name = typeof row.accessibleName === 'string' && row.accessibleName.trim()
        ? `The heading “${row.accessibleName.trim()}”` : 'A heading';
      findings.set(key, { key, text: `${name} follows H${previous.level} at H${row.level}, skipping a level` });
    }
  }

  return [...findings.values()].sort((a, b) =>
    (a.distance ?? 0) - (b.distance ?? 0) || Number(b.overlap ?? false) - Number(a.overlap ?? false));
}

function describeResult(result: PilotMetricResult) {
  if (result.outcome === 'needsReview') return 'Review recommended for the available measurements.';
  if (result.outcome === 'pass') return result.metricId === 'touch-target-spacing'
    ? 'Measured gaps meet the 8 CSS px project advisory.'
    : 'No deeper heading levels were skipped in the measured transitions.';
  return result.reason;
}

function PilotMetricCard({ results }: { results: PilotMetricResult[] }) {
  const { metricId } = results[0];
  const viewports = results.map(result => ({ result, findings: measuredFindings(result) }));
  const observed = new Map<string, { finding: Finding; viewports: Set<string> }>();
  for (const { result, findings } of viewports) {
    for (const finding of findings) {
      const entry = observed.get(finding.key) ?? { finding, viewports: new Set<string>() };
      entry.viewports.add(viewportName(result));
      observed.set(finding.key, entry);
    }
  }
  const mostRelevant = [...observed.values()].sort((a, b) =>
    (a.finding.distance ?? 0) - (b.finding.distance ?? 0) ||
    Number(b.finding.overlap ?? false) - Number(a.finding.overlap ?? false) ||
    b.viewports.size - a.viewports.size)[0];
  const total = new Set(results.map(viewportName)).size;
  const reviewCount = results.filter(result => result.outcome === 'needsReview').length;
  const passed = results.find(result => result.outcome === 'pass');
  const measuredCount = results.filter(result => result.outcome !== null).length;
  const incompleteCount = results.filter(result => result.executionStatus !== 'completed').length;
  const affected = mostRelevant?.viewports.size ?? 0;
  const coverage = affected === total
    ? total === 1 ? 'in the tested viewport' : `across all ${total} tested viewports`
    : `in ${affected} of ${total} tested viewports`;
  const status = reviewCount ? 'Review recommended'
    : measuredCount === results.length && !incompleteCount ? 'No advisory triggered'
      : measuredCount ? 'Limited coverage' : 'Not assessed';

  return (
    <article className="space-y-2 border-t border-zinc-200 pt-3" data-metric-id={metricId}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4 className="text-sm font-semibold">{labels[metricId]}</h4>
        <span className="text-xs font-medium text-zinc-600">{status}</span>
      </div>
      <p className="safe-wrap text-sm text-zinc-800">
        {mostRelevant ? `${mostRelevant.finding.text} ${coverage}.`
          : reviewCount ? `Review recommended in ${reviewCount} of ${total} tested viewports.`
            : passed ? describeResult(passed)
              : results.every(result => result.reason === results[0].reason)
                ? results[0].reason
                : 'See viewport details for measurement availability.'}
      </p>
      {incompleteCount > 0 && (measuredCount > 0 || incompleteCount < results.length) && (
        <p className="text-xs text-zinc-600">Coverage is limited in {incompleteCount} of {total} tested viewports.</p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer py-1 font-medium">View details by viewport ({total})</summary>
        <div className="mt-2 space-y-3">
          {viewports.map(({ result, findings }) => (
            <section key={viewportName(result)} className="space-y-2 rounded-lg border border-zinc-200 p-3">
              <h5 className="font-semibold">{viewportName(result)} viewport</h5>
              {findings.length > 0 ? (
                <ul className="safe-wrap list-disc space-y-1 pl-5">
                  {findings.map(finding => <li key={finding.key}>{finding.text}.</li>)}
                </ul>
              ) : <p className="text-zinc-700">{describeResult(result)}</p>}
              {result.executionStatus !== 'completed' && findings.length > 0 && <p className="text-xs text-zinc-600">{result.reason}</p>}
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                <div><dt className="inline font-semibold">Execution </dt><dd className="inline">{executionLabels[result.executionStatus]}</dd></div>
                <div><dt className="inline font-semibold">Applicability </dt><dd className="inline">{applicabilityLabels[result.applicability]}</dd></div>
                <div><dt className="inline font-semibold">Version </dt><dd className="inline">{result.metricVersion}</dd></div>
                <div><dt className="inline font-semibold">Unit </dt><dd className="inline">{result.unit}</dd></div>
              </dl>
              <p className="safe-wrap text-xs text-zinc-600">UI scope <code>{result.scopeSelector ?? 'Unavailable'}</code>{result.parentHeadingLevel !== undefined ? ` · Parent heading H${result.parentHeadingLevel}` : ''}</p>
              <details className="text-xs">
                <summary className="cursor-pointer py-1 font-medium">Raw metric evidence ({result.measurements.length})</summary>
                <p className="mt-2 text-zinc-600"><code>null</code> indicates an unavailable value or comparison.</p>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-zinc-50 p-3">{JSON.stringify(result.measurements, null, 2)}</pre>
                {result.limitations.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
                  {result.limitations.map(text => <li key={text}>{text}</li>)}
                </ul>}
              </details>
            </section>
          ))}
        </div>
      </details>
    </article>
  );
}

export function PilotMetricEvidence({ results }: { results?: PilotMetricResult[] }) {
  if (!results?.length) return null;
  return (
    <section aria-labelledby="pilot-metric-heading" className="min-w-0 space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
      <h3 id="pilot-metric-heading" className="font-semibold text-zinc-900">Pilot metric evidence</h3>
      <p className="text-xs text-zinc-600">Project advisories for spacing below 8 CSS px and skipped heading levels.</p>
      {(Object.keys(labels) as Array<PilotMetricResult['metricId']>).map(metricId => {
        const matching = results.filter(result => result.metricId === metricId)
          .sort((a, b) => a.viewport.width - b.viewport.width || a.viewport.height - b.viewport.height);
        return matching.length > 0 && <PilotMetricCard key={metricId} results={matching} />;
      })}
    </section>
  );
}
