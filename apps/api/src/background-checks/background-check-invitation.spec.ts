import { UnauthorizedException } from '@nestjs/common';
import { terminalStatusFromInvitation } from './background-check-invitation';

function clientWith(invitation: unknown): {
  getInvitation: jest.Mock;
} {
  return { getInvitation: jest.fn().mockResolvedValue(invitation) };
}

describe('terminalStatusFromInvitation', () => {
  it('maps an expired invitation to failed', async () => {
    const result = await terminalStatusFromInvitation({
      client: clientWith({ id: 'inv_1', status: 'expired' }),
      invitationId: 'inv_1',
    });
    expect(result).toBe('failed');
  });

  it('maps a deleted invitation to cancelled', async () => {
    const result = await terminalStatusFromInvitation({
      client: clientWith({ id: 'inv_1', status: 'deleted' }),
      invitationId: 'inv_1',
    });
    expect(result).toBe('cancelled');
  });

  it('returns null for a still-live invitation', async () => {
    const result = await terminalStatusFromInvitation({
      client: clientWith({ id: 'inv_1', status: 'pending' }),
      invitationId: 'inv_1',
    });
    expect(result).toBeNull();
  });

  it('returns null when the invitation is gone', async () => {
    const result = await terminalStatusFromInvitation({
      client: clientWith(null),
      invitationId: 'inv_1',
    });
    expect(result).toBeNull();
  });

  it('propagates auth failures instead of dissolving them into a backoff', async () => {
    const client = {
      getInvitation: jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException('Checkr credentials are invalid.'),
        ),
    };
    await expect(
      terminalStatusFromInvitation({ client, invitationId: 'inv_1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
