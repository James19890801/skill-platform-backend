import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from '../src/auth/auth.service';

interface FakeUser {
  id: number;
  email: string;
  phone: string | null;
  isAdmin: boolean;
  firstLoginAt: Date;
  lastLoginAt: Date;
  loginCount: number;
  createdAt?: Date;
}

function makeService(seedUsers: FakeUser[]) {
  const users = seedUsers.map((user) => ({ ...user }));
  const calls = {
    save: 0,
    update: 0,
    increment: 0,
  };
  const repository = {
    async findOne({ where }: { where: Partial<FakeUser> }) {
      return users.find((user) =>
        Object.entries(where).every(([key, value]) => (user as any)[key] === value)
      ) || null;
    },
    create(data: Partial<FakeUser>) {
      return {
        id: users.length + 1,
        email: '',
        phone: null,
        isAdmin: false,
        firstLoginAt: new Date(),
        lastLoginAt: new Date(),
        loginCount: 0,
        ...data,
      };
    },
    async save(user: FakeUser) {
      calls.save += 1;
      const existingIndex = users.findIndex((item) => item.id === user.id);
      if (existingIndex >= 0) users[existingIndex] = { ...user };
      else users.push({ ...user });
      return user;
    },
    async update() {
      calls.update += 1;
    },
    async increment() {
      calls.increment += 1;
    },
  };
  const jwtService = {
    sign(payload: unknown) {
      return `token:${JSON.stringify(payload)}`;
    },
  };
  const configService = {
    get() {
      return 'test-secret';
    },
  };

  return {
    calls,
    users,
    service: new AuthService(repository as any, jwtService as any, configService as any),
  };
}

test('existing user login does not wait for audit writes on the critical path', async () => {
  process.env.AUTH_LOGIN_AUDIT_DELAY_MS = '60000';
  const { service, calls } = makeService([
    {
      id: 7,
      email: 'trainee@example.com',
      phone: '15500000007',
      isAdmin: false,
      firstLoginAt: new Date('2026-05-01T00:00:00Z'),
      lastLoginAt: new Date('2026-05-01T00:00:00Z'),
      loginCount: 3,
    },
  ]);

  const result = await service.login('trainee@example.com', '15500000007');

  assert.equal(result.user.id, 7);
  assert.equal(calls.save, 0);
  assert.equal(calls.update, 0);
  assert.equal(calls.increment, 0);
});
