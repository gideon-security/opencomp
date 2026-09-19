import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@db/server', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { db } from '@db/server';
import { requireGideonTenantId } from './require-gideon-tenant';

const mockFindUnique = vi.mocked(db.user.findUnique);

describe('requireGideonTenantId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the tid stamped on the user at Gideon login', async () => {
    mockFindUnique.mockResolvedValue({
      gideonTenantId: 'tenant-1',
    } as never);

    await expect(
      requireGideonTenantId({ user: { id: 'user-1' } }),
    ).resolves.toEqual({ tenantId: 'tenant-1' });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { gideonTenantId: true },
    });
  });

  it('rejects users without a tid (no second way to create orgs)', async () => {
    mockFindUnique.mockResolvedValue({ gideonTenantId: null } as never);

    const result = await requireGideonTenantId({ user: { id: 'user-1' } });

    expect(result).toEqual({ error: expect.stringContaining('Gideon') });
  });

  it('rejects missing sessions', async () => {
    await expect(requireGideonTenantId(null)).resolves.toEqual({
      error: 'Not authorized.',
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
