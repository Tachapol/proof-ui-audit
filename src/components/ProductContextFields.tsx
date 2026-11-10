import { ProductContext } from '@/lib/schema/product-context';
interface Props { value: ProductContext; onChange: (value: ProductContext) => void; disabled?: boolean; }
export function ProductContextFields({ value, onChange, disabled }: Props) {
  const fields = [
    { key: 'productGoal', label: 'Product Goal', placeholder: 'Help students find and register for courses easily.', max: 1000, multiline: true },
    { key: 'brandKeywords', label: 'Brand Keywords', placeholder: 'Friendly, trustworthy, clear', max: 300 },
    { key: 'themeColor', label: 'Theme Color', placeholder: '#2563EB', max: 7 },
    { key: 'targetAudience', label: 'Target Audience', placeholder: 'University students using mobile devices', max: 1000, multiline: true },
    { key: 'additionalContext', label: 'Others / Additional Context', placeholder: 'Key task, platform, language, design constraints or evaluation focus', max: 2000, multiline: true },
  ] as const;
  return <fieldset disabled={disabled} className="product-context-fields">
    <legend>Product Context <span>(optional)</span></legend>
    <p id="product-context-help">Give the critique context about your product. These details are sent to the configured AI provider with measured evidence. Measurements and guideline thresholds stay unchanged.</p>
    <div className="product-context-grid">{fields.map(field => <div className="field-group" key={field.key}>
      <label htmlFor={`context-${field.key}`}>{field.label}</label>
      {'multiline' in field && field.multiline ? <textarea id={`context-${field.key}`} value={value[field.key]} maxLength={field.max} rows={2} placeholder={field.placeholder} onChange={e => onChange({ ...value, [field.key]: e.target.value })} aria-describedby="product-context-help" />
        : <input id={`context-${field.key}`} type="text" value={value[field.key]} maxLength={field.max} placeholder={field.placeholder} onChange={e => onChange({ ...value, [field.key]: e.target.value })} aria-describedby="product-context-help" />}
    </div>)}</div>
  </fieldset>;
}
