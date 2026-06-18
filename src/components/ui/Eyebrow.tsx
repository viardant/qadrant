import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  muted?: boolean;
  as?: 'span' | 'div' | 'p' | 'label';
  className?: string;
}

export function Eyebrow({ children, muted = false, as: Tag = 'span', className = '' }: Props) {
  return (
    <Tag className={`${muted ? 'eyebrow-soft' : 'eyebrow'} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
