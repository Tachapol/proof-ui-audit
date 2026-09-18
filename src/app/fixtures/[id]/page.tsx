import { notFound } from 'next/navigation';
import { FIXTURES } from '@/fixtures/fixture-registry';
import { TargetSizeFixture } from '@/fixtures/components/TargetSizeFixture';
import { ContrastFixture } from '@/fixtures/components/ContrastFixture';
import { ReflowFixture } from '@/fixtures/components/ReflowFixture';
import { TextSpacingFixture } from '@/fixtures/components/TextSpacingFixture';

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
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
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
        {fixture.id === 'text-spacing-demo' && <TextSpacingFixture />}
      </main>
    </div>
  );
}
