import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Loading from './loading';

describe('settings loading', () => {
  it('renders the spinner with numeric svg dimensions', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { container } = render(<Loading />);
      // NOTE: Carbon's Icon forces role="img" on the svg, so select by the
      // aria-label the Spinner sets instead of role="status".
      const svg = container.querySelector('svg[aria-label="Loading"]');
      expect(svg).not.toBeNull();
      // Carbon icons forward `size` to svg width/height, which only accept
      // lengths — a token like "lg" makes React log an <svg> attribute error.
      expect(svg?.getAttribute('width')).toMatch(/^\d+$/);
      expect(svg?.getAttribute('height')).toMatch(/^\d+$/);
      const svgErrors = consoleError.mock.calls.filter((args) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('<svg>')),
      );
      expect(svgErrors).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
