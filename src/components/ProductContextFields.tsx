import { ProductContext } from '@/lib/schema/product-context';

interface Props {
  value: ProductContext;
  onChange: (value: ProductContext) => void;
  disabled?: boolean;
}

export function ProductContextFields({ value, onChange, disabled }: Props) {
  const fields = [
    { key: 'productGoal', label: 'Product Goal', placeholder: 'Help students find and register for courses easily.', max: 1000, multiline: true },
    { key: 'brandKeywords', label: 'Brand Keywords', placeholder: 'Friendly, trustworthy, clear', max: 300 },
    { key: 'themeColor', label: 'Theme Color', placeholder: '#2563EB', max: 7 },
    { key: 'targetAudience', label: 'Target Audience', placeholder: 'University students using mobile devices', max: 1000, multiline: true },
    { key: 'additionalContext', label: 'Others / Additional Context', placeholder: 'Key task, platform, language, design constraints or evaluation focus', max: 2000, multiline: true },
  ] as const;

  return (
    <fieldset disabled={disabled} className="product-context-fields space-y-3.5">
      <legend className="sr-only">Product Context <span>(optional)</span></legend>
      <p id="product-context-help" className="text-xs text-zinc-500 leading-relaxed">
        Optional details to help guide recommendations.
      </p>
      <div className="product-context-grid grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {fields.map(field => (
          <div
            className={`field-group flex flex-col gap-1.5 ${
              field.key === 'productGoal' || field.key === 'additionalContext' ? 'md:col-span-2' : ''
            }`}
            key={field.key}
          >
            <label className="text-xs font-medium text-zinc-700" htmlFor={`context-${field.key}`}>
              {field.label}
            </label>
            {'multiline' in field && field.multiline ? (
              <textarea
                className="flex min-h-[64px] w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                id={`context-${field.key}`}
                value={value[field.key]}
                maxLength={field.max}
                rows={2}
                placeholder={field.placeholder}
                onChange={e => onChange({ ...value, [field.key]: e.target.value })}
                aria-describedby="product-context-help"
              />
            ) : (
              <input
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-1 text-xs shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                id={`context-${field.key}`}
                type="text"
                value={value[field.key]}
                maxLength={field.max}
                placeholder={field.placeholder}
                onChange={e => onChange({ ...value, [field.key]: e.target.value })}
                aria-describedby="product-context-help"
              />
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
