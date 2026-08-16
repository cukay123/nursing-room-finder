'use client';

import { Star } from 'lucide-react';

interface StarRatingProps {
  /** 1–5. Fractional values are rounded for display. */
  value: number;
  /** Omit to render read-only. */
  onChange?: (rating: number) => void;
  size?: number;
  disabled?: boolean;
}

export function StarRating({ value, onChange, size = 18, disabled }: StarRatingProps) {
  const interactive = Boolean(onChange);
  const filledCount = Math.round(value);

  if (!interactive) {
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map(n => (
          <Star
            key={n}
            size={size}
            className={n <= filledCount ? 'text-amber-500' : 'text-gray-300'}
            fill={n <= filledCount ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === filledCount}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          disabled={disabled}
          onClick={() => onChange?.(n)}
          className="disabled:opacity-50 transition hover:scale-110"
        >
          <Star
            size={size}
            className={n <= filledCount ? 'text-amber-500' : 'text-gray-300'}
            fill={n <= filledCount ? 'currentColor' : 'none'}
          />
        </button>
      ))}
    </span>
  );
}
