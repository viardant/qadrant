import type { ReactNode } from 'react';
import { useResponsiveValue } from '../../hooks/useResponsiveValue';

interface Props {
  eyebrow?: string;
  children: ReactNode;
  caption?: string;
  size?: 'default' | 'wide';
  as?: 'div' | 'section' | 'header';
  className?: string;
}

export function StageDrop({ eyebrow, children, caption, size = 'default', as: Tag = 'div', className = '' }: Props) {
  const paddingBlock = useResponsiveValue({ mobile: '24px', tablet: '48px', desktop: '96px' });
  const paddingInline = useResponsiveValue({ mobile: '16px', tablet: '24px', desktop: '64px' });
  const numberFontSize = useResponsiveValue({
    mobile: 'clamp(48px, 14vw, 64px)',
    tablet: 'clamp(40px, 6vw, 72px)',
    desktop: 'clamp(40px, 6vw, 72px)',
  });

  const paddingClass = size === 'wide' ? 'stage-drop--wide' : '';
  return (
    <Tag
      className={`stage-drop ${paddingClass} ${className}`.trim()}
      style={{ paddingBlock, paddingInline }}
    >
      {eyebrow && (
        <div className="stage-drop__eyebrow">
          {eyebrow.startsWith('▸') || eyebrow.startsWith('>') ? (
            <span>{eyebrow}</span>
          ) : (
            <span>▸&nbsp;&nbsp;{eyebrow}</span>
          )}
        </div>
      )}
      <div className="stage-drop__number" style={{ fontSize: numberFontSize }}>
        {children}
      </div>
      {caption && <div className="stage-drop__caption">{caption}</div>}
    </Tag>
  );
}
