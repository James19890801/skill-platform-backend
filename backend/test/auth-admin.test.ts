import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from '../src/auth/auth.service';

type FakeUser = {
  id: number;
  email: string;
  phone: string | null;
  isAdmin: boolean;
  firstLoginAt?: Date;
  lastLoginAt?: Date;
  loginCount: number;
};

function makeAuthService(seedUsers: FakeUser[]) {
  const users = seedUsers.map((user) => ({ ...user }));
  let nextId = users.length + 1;

  const repository = {
    async findOne({ where }: { where: Partial<FakeUser> }) {
      if (where.email !== undefined) return users.find((user) => user.email === where.email) || null;
      if (where.phone !== undefined) return users.find((user) => user.phone === where.phone) || null;
      if (where.id !== undefined) return users.find((user) => user.id === where.id) || null;
      return null;
    },
    create(input: Partial<FakeUser>) {
      return { id: nextId++, isAdmin: false, loginCount: 0, phone: null, ...input } as FakeUser;
    },
    async save(user: FakeUser) {
      const index = users.findIndex((item) => item.id === user.id);
      if (index >= 0) users[index] = { ...user };
      else users.push({ ...user });
      return user;
    },
    users,
  };

  const jwtService = { sign: () => 'signed-token' };
  const configService = { get: () => 'test-secret' };

  return {
    service: new AuthService(repository as any, jwtService as any, configService as any),
    users,
  };
}

test('configured admin email is promoted and phone is corrected on login', async () => {
  process.env.ADMIN_EMAIL = '494161546@qq.com';
  process.env.ADMIN_PHONE = '13136092523';

  const { service, users } = makeAuthService([
    { id: 1, email: '494161546@qq.com', phone: null, isAdmin: false, loginCount: 3 },
  ]);

  const result = await service.login('494161546@qq.com', '13136092523');

  assert.equal(result.user.email, '494161546@qq.com');
  assert.equal(result.user.phone, '13136092523');
  assert.equal(result.user.isAdmin, true);
  assert.equal(users[0].phone, '13136092523');
  assert.equal(users[0].isAdmin, true);
});

test('configured admin phone is released from another account before promotion', async () => {
  process.env.ADMIN_EMAIL = '494161546@qq.com';
  process.env.ADMIN_PHONE = '13136092523';

  const { service, users } = makeAuthService([
    { id: 1, email: 'other@example.com', phone: '13136092523', isAdmin: false, loginCount: 1 },
    { id: 2, email: '494161546@qq.com', phone: null, isAdmin: false, loginCount: 0 },
  ]);

  const result = await service.login('494161546@qq.com', '13136092523');

  assert.equal(result.user.isAdmin, true);
  assert.equal(result.user.phone, '13136092523');
  assert.equal(users.find((user) => user.email === 'other@example.com')?.phone, null);
});
