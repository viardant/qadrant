import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  children: ReactNode;
  caption?: string;
  size?: 'default' | 'wide';
  as?: 'div' | 'section' | 'header';
  className?: string;
}

export function StageDrop({ eyebrow, children, caption, size = 'default', as: Tag = 'div', className = '' }: Props) {
  const paddingClass = size === 'wide' ? 'stage-drop--wide' : '';
  return (
    <Tag className={`stage-drop ${paddingClass} ${className}`.trim()}>
      {eyebrow && (
        <div className="stage-drop__eyebrow">
          {eyebrow.startsWith('▸') || eyebrow.startsWith('>') ? (
            <span>{eyebrow}</span>
          ) : (
            <span>▸&nbsp;&nbsp;{eyebrow}</span>
          )}
        </div>
      )}
      <div className="stage-drop__number">{children}</div>
      {caption && <div className="stage-drop__caption">{caption}</div>}
    </Tag>
  );
}
