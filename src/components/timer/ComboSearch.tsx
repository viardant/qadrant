import { forwardRef } from 'react';
import { SearchInput } from '../ui/SearchInput';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export const ComboSearch = forwardRef<HTMLInputElement, Props>(function ComboSearch(
  { value, onChange },
  ref,
) {
  const { isDesktop } = useBreakpoint();
  return (
    <section className="section" aria-label="Replay existing combo">
      <div className="section__head">
        <span className="eyebrow">REPLAY_EXISTING_COMBO&nbsp;//&nbsp;MAIN_CTA</span>
        {isDesktop && <span className="search-input__kbd" aria-hidden>⌘K</span>}
      </div>
      <SearchInput
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder="SEARCH"
        ariaLabel="Search existing combos"
      />
    </section>
  );
});
