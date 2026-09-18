import React from 'react';
import * as LucideIcons from 'lucide-react';

export type IconName =
  | 'Target'
  | 'Contrast'
  | 'Maximize2'
  | 'Type'
  | 'CheckCircle2'
  | 'AlertTriangle'
  | 'HelpCircle'
  | 'ArrowRight'
  | 'RefreshCw'
  | 'ChevronDown'
  | 'ChevronRight'
  | 'FileText'
  | 'Download'
  | 'ExternalLink'
  | 'Check'
  | 'X'
  | 'Edit3'
  | 'Sliders'
  | 'Play'
  | 'Info'
  | 'ShieldAlert';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  'aria-label'?: string;
}

export function Icon({
  name,
  size = 18,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel,
  ...props
}: IconProps) {
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<LucideIcons.LucideProps>>)[name];

  if (!IconComponent) {
    return null;
  }

  return (
    <IconComponent
      size={size}
      color={color}
      className={className}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      {...props}
    />
  );
}
