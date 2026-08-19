import { fireEvent, render, screen } from '@testing-library/react';
import { mockNextIntl } from '@/test-utils/mocks/next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from './language-switcher';

const { useLocale } = mockNextIntl();

const reloadSpy = vi.fn();

beforeEach(() => {
  reloadSpy.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload: reloadSpy },
  });
  document.cookie = 'NEXT_LOCALE=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('LanguageSwitcher', () => {
  it('highlights the active locale', () => {
    useLocale.mockReturnValue('es');
    render(<LanguageSwitcher />);
    expect(screen.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'false');
  });

  it('sets the NEXT_LOCALE cookie and reloads when switching', () => {
    useLocale.mockReturnValue('en');
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('radio', { name: 'Español' }));
    expect(document.cookie).toContain('NEXT_LOCALE=es');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload when selecting the active locale', () => {
    useLocale.mockReturnValue('en');
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
