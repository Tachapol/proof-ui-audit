import { ChecklistWorkspace } from '@/components/ChecklistWorkspace';
import {
  DEFAULT_UXBENCH_BOOKING_DIR,
  listUXBenchBookingPages,
  loadUXBenchBookingHtml,
} from '@/lib/checklist/uxbench-baseline';

export const dynamic = 'force-dynamic';

export default function ChecklistPage() {
  const pages = listUXBenchBookingPages();
  const initialHtml = loadUXBenchBookingHtml(pages[0] || 'index.html');
  return (
    <ChecklistWorkspace
      initialHtml={initialHtml}
      baselinePages={pages}
      baselineDir={DEFAULT_UXBENCH_BOOKING_DIR}
    />
  );
}
