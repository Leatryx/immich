import { LoginResponseDto, deleteUser, getUserById } from '@immich/sdk';
import { Socket } from 'socket.io-client';
import { createUserDto, userDto } from 'src/fixtures';
import { errorDto } from 'src/responses';
import { app, asBearerAuth, utils } from 'src/utils';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('/users', () => {
  let websocket: Socket;

  let admin: LoginResponseDto;
  let deletedUser: LoginResponseDto;
  let nonAdmin: LoginResponseDto;

  beforeAll(async () => {
    await utils.resetDatabase();
    admin = await utils.adminSetup({ onboarding: false });

    [websocket, deletedUser, nonAdmin] = await Promise.all([
      utils.connectWebsocket(admin.accessToken),
      utils.userSetup(admin.accessToken, createUserDto.user1),
      utils.userSetup(admin.accessToken, createUserDto.user2),
    ]);

    await deleteUser({ id: deletedUser.userId, deleteUserDto: {} }, { headers: asBearerAuth(admin.accessToken) });
  });

  afterAll(() => {
    utils.disconnectWebsocket(websocket);
  });

  describe('GET /users', () => {
    it('should require authentication', async () => {
      const { status, body } = await request(app).get('/users');
      expect(status).toBe(401);
      expect(body).toEqual(errorDto.unauthorized);
    });

    it('should get users', async () => {
      const { status, body } = await request(app).get('/users').set('Authorization', `Bearer ${admin.accessToken}`);
      expect(status).toEqual(200);
      expect(body).toHaveLength(5);
      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: 'admin@immich.cloud' }),
          expect.objectContaining({ email: 'user1@immich.cloud' }),
          expect.objectContaining({ email: 'user2@immich.cloud' }),
          expect.objectContaining({ email: 'user3@immich.cloud' }),
          expect.objectContaining({ email: 'user4@immich.cloud' }),
        ]),
      );
    });

    it('should hide deleted users', async () => {
      const { status, body } = await request(app)
        .get(`/users`)
        .query({ isAll: true })
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(status).toBe(200);
      expect(body).toHaveLength(4);
      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: 'admin@immich.cloud' }),
          expect.objectContaining({ email: 'user2@immich.cloud' }),
          expect.objectContaining({ email: 'user3@immich.cloud' }),
          expect.objectContaining({ email: 'user4@immich.cloud' }),
        ]),
      );
    });

    it('should include deleted users', async () => {
      const { status, body } = await request(app)
        .get(`/users`)
        .query({ isAll: false })
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(status).toBe(200);
      expect(body).toHaveLength(3);
      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: 'admin@immich.cloud' }),
          expect.objectContaining({ email: 'user1@immich.cloud' }),
          expect.objectContaining({ email: 'user2@immich.cloud' }),
        ]),
      );
    });
  });

  describe('GET /users/:id', () => {
    it('should require authentication', async () => {
      const { status } = await request(app).get(`/users/${admin.userId}`);
      expect(status).toEqual(401);
    });

    it('should get the user info', async () => {
      const { status, body } = await request(app)
        .get(`/users/${admin.userId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(status).toBe(200);
      expect(body).toMatchObject({
        id: admin.userId,
        email: 'admin@immich.cloud',
      });
    });
  });

  describe('GET /users/me', () => {
    it('should require authentication', async () => {
      const { status, body } = await request(app).get(`/users/me`);
      expect(status).toBe(401);
      expect(body).toEqual(errorDto.unauthorized);
    });

    it('should get my info', async () => {
      const { status, body } = await request(app).get(`/users/me`).set('Authorization', `Bearer ${admin.accessToken}`);
      expect(status).toBe(200);
      expect(body).toMatchObject({
        id: admin.userId,
        email: 'admin@immich.cloud',
      });
    });
  });

  describe('PUT /users', () => {
    it('should require authentication', async () => {
      const { status, body } = await request(app).put(`/users`);
      expect(status).toBe(401);
      expect(body).toEqual(errorDto.unauthorized);
    });

    for (const key of Object.keys(userDto.admin)) {
      it(`should not allow null ${key}`, async () => {
        const { status, body } = await request(app)
          .put(`/users`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .send({ ...userDto.admin, [key]: null });
        expect(status).toBe(400);
        expect(body).toEqual(errorDto.badRequest());
      });
    }

    it('should not allow a non-admin to become an admin', async () => {
      const { status, body } = await request(app)
        .put(`/users`)
        .send({ isAdmin: true, id: nonAdmin.userId })
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(status).toBe(400);
      expect(body).toEqual(errorDto.alreadyHasAdmin);
    });

    it('ignores updates to profileImagePath', async () => {
      const { status, body } = await request(app)
        .put(`/users`)
        .send({ id: admin.userId, profileImagePath: 'invalid.jpg' })
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(status).toBe(200);
      expect(body).toMatchObject({ id: admin.userId, profileImagePath: '' });
    });

    it('should update first and last name', async () => {
      const before = await getUserById({ id: admin.userId }, { headers: asBearerAuth(admin.accessToken) });

      const { status, body } = await request(app)
        .put(`/users`)
        .send({
          id: admin.userId,
          name: 'Name',
        })
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(status).toBe(200);
      expect(body).toEqual({
        ...before,
        updatedAt: expect.any(String),
        name: 'Name',
      });
      expect(before.updatedAt).not.toEqual(body.updatedAt);
    });

    it('should update memories enabled', async () => {
      const before = await getUserById({ id: admin.userId }, { headers: asBearerAuth(admin.accessToken) });
      const { status, body } = await request(app)
        .put(`/users`)
        .send({
          id: admin.userId,
          memoriesEnabled: false,
        })
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(status).toBe(200);
      expect(body).toMatchObject({
        ...before,
        updatedAt: expect.anything(),
        memoriesEnabled: false,
      });
      expect(before.updatedAt).not.toEqual(body.updatedAt);
    });
  });
});
