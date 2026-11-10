import { describe, it, expect } from 'vitest';
import { POST } from '../route';

describe('/api/context/detect route', () => {
  it('returns 400 when target is missing', async () => {
    const req = new Request('http://localhost:3123/api/context/detect', {
      method: 'POST',
      body: JSON.stringify({ target: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('returns pre-set context for local fixtures', async () => {
    const req = new Request('http://localhost:3123/api/context/detect', {
      method: 'POST',
      body: JSON.stringify({ target: 'fixture://mvp-contrast-demo' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.context.themeColor).toBe('#2563EB');
    expect(data.context.productGoal).toContain('Course registration demo');
  });

  it('rejects invalid or ssrf-blocked addresses', async () => {
    const req = new Request('http://localhost:3123/api/context/detect', {
      method: 'POST',
      body: JSON.stringify({ target: 'http://169.254.169.254/latest/meta-data' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });
});

