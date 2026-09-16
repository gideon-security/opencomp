process.env.SECRET_KEY =
  process.env.SECRET_KEY || 'test-secret-key-16-chars-min';

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AdminController } from './admin.controller';
import { HybridAuthGuard } from './hybrid-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import type { AuthenticatedRequest } from './types';

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserFindMany = jest.fn();
const mockSessionCreate = jest.fn();
const mockSessionDeleteMany = jest.fn();
const mockOrgFindFirst = jest.fn();
const mockAuditCreate = jest.fn();

jest.mock('@db', () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    session: {
      create: (...args: unknown[]) => mockSessionCreate(...args),
      deleteMany: (...args: unknown[]) => mockSessionDeleteMany(...args),
    },
    organization: {
      findFirst: (...args: unknown[]) => mockOrgFindFirst(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
  },
}));

function adminRequest(
  overrides: Partial<AuthenticatedRequest> = {},
): AuthenticatedRequest {
  return {
    organizationId: 'org_1',
    authType: 'session',
    isApiKey: false,
    isPlatformAdmin: true,
    userId: 'admin_1',
    userRoles: ['admin'],
    ...overrides,
  } as AuthenticatedRequest;
}

function mockResponse(): { cookie: jest.Mock } {
  return { cookie: jest.fn() };
}

describe('AdminController (native admin endpoints)', () => {
  let controller: AdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOrgFindFirst.mockResolvedValue({ id: 'org_1' });
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
    })
      .overrideGuard(HybridAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PlatformAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
  });

  describe('impersonate', () => {
    it('mints an impersonation session and sets the cookie', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'usr_2',
        email: 'user@acme.com',
        banned: false,
      });
      mockSessionCreate.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'ses_new',
          ...data,
        }),
      );
      const res = mockResponse();

      const result = await controller.impersonate(
        adminRequest(),
        res as never,
        { userId: 'usr_2' },
      );

      expect(result).toEqual({ success: true, userId: 'usr_2' });
      expect(mockSessionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr_2',
          impersonatedBy: 'admin_1',
        }),
      });
      expect(res.cookie).toHaveBeenCalledTimes(1);
      expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    });

    it('rejects self-impersonation', async () => {
      await expect(
        controller.impersonate(adminRequest(), mockResponse() as never, {
          userId: 'admin_1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects banned targets and unknown users', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'usr_3',
        email: 'banned@acme.com',
        banned: true,
      });
      await expect(
        controller.impersonate(adminRequest(), mockResponse() as never, {
          userId: 'usr_3',
        }),
      ).rejects.toThrow(ForbiddenException);

      mockUserFindUnique.mockResolvedValueOnce(null);
      await expect(
        controller.impersonate(adminRequest(), mockResponse() as never, {
          userId: 'usr_missing',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('enforces aal>=2 for Gideon-JWT callers', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'usr_2',
        email: 'user@acme.com',
        banned: false,
      });

      await expect(
        controller.impersonate(
          adminRequest({ isGideonJwt: true, gideonAal: 1 }),
          mockResponse() as never,
          { userId: 'usr_2' },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockSessionCreate).not.toHaveBeenCalled();

      mockSessionCreate.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'ses_new',
          ...data,
        }),
      );
      await expect(
        controller.impersonate(
          adminRequest({ isGideonJwt: true, gideonAal: 3 }),
          mockResponse() as never,
          { userId: 'usr_2' },
        ),
      ).resolves.toEqual({ success: true, userId: 'usr_2' });
    });
  });

  describe('stopImpersonating', () => {
    it('requires an active impersonation', async () => {
      await expect(
        controller.stopImpersonating(adminRequest(), mockResponse() as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('drops the impersonation session and restores the admin session', async () => {
      mockSessionDeleteMany.mockResolvedValue({ count: 1 });
      mockSessionCreate.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'ses_restored',
          ...data,
        }),
      );
      const res = mockResponse();

      const result = await controller.stopImpersonating(
        adminRequest({ sessionId: 'ses_imp', impersonatedBy: 'admin_1' }),
        res as never,
      );

      expect(result).toEqual({ success: true, activeOrganizationId: 'org_1' });
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({
        where: { id: 'ses_imp' },
      });
      expect(mockSessionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'admin_1' }),
      });
      const createdData = mockSessionCreate.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(createdData.data).not.toHaveProperty('impersonatedBy');
      expect(res.cookie).toHaveBeenCalledTimes(1);
    });
  });

  describe('ban / unban', () => {
    it('bans the user and revokes all sessions', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'usr_2',
        email: 'u@acme.com',
      });
      mockSessionDeleteMany.mockResolvedValue({ count: 3 });

      const result = await controller.banUser(adminRequest(), {
        userId: 'usr_2',
        reason: 'policy violation',
      });

      expect(result).toEqual({ success: true });
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'usr_2' },
        data: { banned: true, banReason: 'policy violation', banExpires: null },
      });
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({
        where: { userId: 'usr_2' },
      });
    });

    it('rejects self-ban and unknown users', async () => {
      await expect(
        controller.banUser(adminRequest(), { userId: 'admin_1' }),
      ).rejects.toThrow(BadRequestException);

      mockUserFindUnique.mockResolvedValueOnce(null);
      await expect(
        controller.banUser(adminRequest(), { userId: 'usr_missing' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('unbans the user and clears ban metadata', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'usr_2',
        email: 'u@acme.com',
      });

      await expect(
        controller.unbanUser(adminRequest(), { userId: 'usr_2' }),
      ).resolves.toEqual({ success: true });
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'usr_2' },
        data: { banned: false, banReason: null, banExpires: null },
      });
    });
  });

  describe('listUsers', () => {
    it('passes search and limit through to the query', async () => {
      mockUserFindMany.mockResolvedValue([]);
      await controller.listUsers({ search: 'acme', limit: 5 });

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe('revokeUserSessions', () => {
    it('revokes every session for the target user', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'usr_2',
        email: 'u@acme.com',
      });
      mockSessionDeleteMany.mockResolvedValue({ count: 2 });

      await expect(
        controller.revokeUserSessions(adminRequest(), { userId: 'usr_2' }),
      ).resolves.toEqual({ success: true, revokedCount: 2 });
    });
  });
});
