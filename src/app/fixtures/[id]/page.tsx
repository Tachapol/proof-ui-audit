import { notFound } from 'next/navigation';
import { FIXTURES } from '@/fixtures/fixture-registry';
import { TargetSizeFixture } from '@/fixtures/components/TargetSizeFixture';
import { ContrastFixture } from '@/fixtures/components/ContrastFixture';
import {
  ReflowFixture,
  ReflowPass,
  ReflowFail,
  ReflowReview,
  ReflowNestedFail,
  ReflowControlsFail,
  ReflowDecorativePass,
} from '@/fixtures/components/ReflowFixture';
import {
  TextSpacingFixture,
  TextSpacingPass,
  TextSpacingFail,
  TextSpacingHorizontalFail,
  TextSpacingObscuredFail,
  TextSpacingReview,
  TextSpacingPreserved,
} from '@/fixtures/components/TextSpacingFixture';
import { OccurrenceFixture } from '@/fixtures/components/OccurrenceFixture';

interface FixturePageProps {
  params: Promise<{ id: string }>;
}

export default async function FixturePage({ params }: FixturePageProps) {
  const { id } = await params;
  const fixture = FIXTURES.find((f) => f.id === id);

  if (!fixture) {
    notFound();
  }

  return (
    <div style={{ padding: '16px', maxWidth: '100%', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <header style={{ marginBottom: '24px', borderBottom: '1px solid #dededb', paddingBottom: '16px' }}>
        <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#676767' }}>
          ProofUI Test Fixture: {fixture.category}
        </span>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#202123', marginTop: '4px' }}>
          {fixture.name}
        </h1>
        <p style={{ fontSize: '14px', color: '#676767', marginTop: '4px' }}>
          {fixture.description}
        </p>
      </header>

      <main id="fixture-content">
        {fixture.id === 'target-size-demo' && <TargetSizeFixture />}
        {fixture.id === 'text-contrast-demo' && <ContrastFixture />}
        {fixture.id === 'reflow-demo' && <ReflowFixture />}
        {fixture.id === 'reflow-pass' && <ReflowPass />}
        {fixture.id === 'reflow-fail' && <ReflowFail />}
        {fixture.id === 'reflow-review' && <ReflowReview />}
        {fixture.id === 'reflow-nested-fail' && <ReflowNestedFail />}
        {fixture.id === 'reflow-controls-fail' && <ReflowControlsFail />}
        {fixture.id === 'reflow-decorative-pass' && <ReflowDecorativePass />}
        {fixture.id === 'text-spacing-demo' && <TextSpacingFixture />}
        {fixture.id === 'text-spacing-pass' && <TextSpacingPass />}
        {fixture.id === 'text-spacing-fail' && <TextSpacingFail />}
        {fixture.id === 'text-spacing-horiz-fail' && <TextSpacingHorizontalFail />}
        {fixture.id === 'text-spacing-obscured-fail' && <TextSpacingObscuredFail />}
        {fixture.id === 'text-spacing-review' && <TextSpacingReview />}
        {fixture.id === 'text-spacing-preserved' && <TextSpacingPreserved />}
        {fixture.id === 'occurrence-demo' && <OccurrenceFixture />}
      </main>
    </div>
  );
}
