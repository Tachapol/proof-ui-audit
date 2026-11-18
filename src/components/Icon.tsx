import React from 'react';
import * as LucideIcons from 'lucide-react';

export type IconName =
  | 'Target'
  | 'Contrast'
  | 'Maximize2'
  | 'Minimize2'
  | 'Type'
  | 'CheckCircle2'
  | 'AlertTriangle'
  | 'HelpCircle'
  | 'ArrowRight'
  | 'RefreshCw'
  | 'Plus'
  | 'ChevronDown'
  | 'ChevronUp'
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
  | 'ShieldAlert'
  | 'Menu'
  | 'PanelLeft'
  | 'PanelLeftClose'
  | 'PanelLeftOpen'
  | 'FlaskConical'
  | 'History'
  | 'CircleDot'
  | 'Clock3'
  | 'Users'
  | 'Layers'
  | 'Sparkles'
  | 'Globe'
  | 'Upload'
  | 'Code'
  | 'FileCode'
  | 'Eye'
  | 'Columns'
  | 'Copy'
  | 'LoaderCircle'
  | 'Monitor'
  | 'Smartphone'
  | 'FoldHorizontal'
  | 'ViewportDesktop'
  | 'ViewportMobile'
  | 'ViewportReflow';

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
  if (name === 'ViewportDesktop') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label={ariaLabel}
        aria-hidden={!ariaLabel}
        {...props}
      >
        <rect x="2" y="3.5" width="16" height="11" rx="1.5" />
        <path d="M6.5 17.5h7" />
        <path d="M10 14.5v3" />
      </svg>
    );
  }

  if (name === 'ViewportMobile') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label={ariaLabel}
        aria-hidden={!ariaLabel}
        {...props}
      >
        <rect x="5.5" y="2.5" width="9" height="15" rx="1.5" />
        <path d="M8.5 4.5h3" />
        <path d="M8.5 15h3" />
      </svg>
    );
  }

  if (name === 'ViewportReflow') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-label={ariaLabel}
        aria-hidden={!ariaLabel}
        {...props}
      >
        <rect x="6.5" y="2.5" width="7" height="15" rx="1.25" />
        <path d="M2 10h2.5M3.2 8.7 4.5 10 3.2 11.3" />
        <path d="M18 10h-2.5m1.3-1.3L15.5 10l1.3 1.3" />
      </svg>
    );
  }

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
