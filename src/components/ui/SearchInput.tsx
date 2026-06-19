import { forwardRef } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  kbdHint?: string;
  id?: string;
  ariaLabel?: string;
  onEnter?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput(
  { value, onChange, placeholder = 'SEARCH', kbdHint, id, ariaLabel, onEnter },
  ref,
) {
  return (
    <div className="search-input">
      {value === '' && (
        <div className="search-input__placeholder" aria-hidden>
          <span>{placeholder}</span>
          <span className="search-input__cursor" />
        </div>
      )}
      <input
        ref={ref}
        id={id}
        type="text"
        className="search-input__field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder=""
        aria-label={ariaLabel ?? placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {kbdHint && <span className="search-input__kbd">{kbdHint}</span>}
    </div>
  );
});
