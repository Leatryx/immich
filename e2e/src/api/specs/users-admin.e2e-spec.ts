import { LoginResponseDto, deleteUser } from '@immich/sdk';
import { Socket } from 'socket.io-client';
import { createUserDto } from 'src/fixtures';
import { errorDto } from 'src/responses';
import { app, asBearerAuth, utils } from 'src/utils';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('/admin/users', () => {
  let websocket: Socket;

  let admin: LoginResponseDto;
  let deletedUser: LoginResponseDto;
  let userToDelete: LoginResponseDto;
  let userToHardDelete: LoginResponseDto;

  beforeAll(async () => {
    await utils.resetDatabase();
    admin = await utils.adminSetup({ onboarding: false });

    [websocket, deletedUser, userToDelete, userToHardDelete] = await Promise.all([
      utils.connectWebsocket(admin.accessToken),
      utils.userSetup(admin.accessToken, createUserDto.user1),
      utils.userSetup(admin.accessToken, createUserDto.user2),
      utils.userSetup(admin.accessToken, createUserDto.user3),
    ]);

    await deleteUser({ id: deletedUser.userId, deleteUserDto: {} }, { headers: asBearerAuth(admin.accessToken) });
  });

  afterAll(() => {
    utils.disconnectWebsocket(websocket);
  });

  describe('POST /admin/users', () => {
    it('should require authentication', async () => {
      const { status, body } = await request(app).post(`/admin/users`).send(createUserDto.user1);
      expect(status).toBe(401);
      expect(body).toEqual(errorDto.unauthorized);
    });

    for (const key of Object.keys(createUserDto.user1)) {
      it(`should not allow null ${key}`, async () => {
        const { status, body } = await request(app)
          .post(`/admin/users`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .send({ ...createUserDto.user1, [key]: null });
        expect(status).toBe(400);
        expect(body).toEqual(errorDto.badRequest());
      });
    }

    it('should ignore `isAdmin`', async () => {
      const { status, body } = await request(app)
        .post(`/admin/users`)
        .send({
          isAdmin: true,
          email: 'user5@immich.cloud',
          password: 'password123',
          name: 'Immich',
        })
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(body).toMatchObject({
        email: 'user5@immich.cloud',
        isAdmin: false,
        shouldChangePassword: true,
      });
      expect(status).toBe(201);
    });

    it('should create a user without memories enabled', async () => {
      const { status, body } = await request(app)
        .post(`/admin/users`)
        .send({
          email: 'no-memories@immich.cloud',
          password: 'Password123',
          name: 'No Memories',
          memoriesEnabled: false,
        })
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(body).toMatchObject({
        email: 'no-memories@immich.cloud',
        memoriesEnabled: false,
      });
      expect(status).toBe(201);
    });
  });

  describe('DELETE /admin/users/:id', () => {
    it('should require authentication', async () => {
      const { status, body } = await request(app).delete(`/admin/users/${userToDelete.userId}`);
      expect(status).toBe(401);
      expect(body).toEqual(errorDto.unauthorized);
    });

    it('should delete user', async () => {
      const { status, body } = await request(app)
        .delete(`/admin/users/${userToDelete.userId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(status).toBe(200);
      expect(body).toMatchObject({
        id: userToDelete.userId,
        updatedAt: expect.any(String),
        deletedAt: expect.any(String),
      });
    });

    it('should hard delete user', async () => {
      const { status, body } = await request(app)
        .delete(`/admin/users/${userToHardDelete.userId}`)
        .send({ force: true })
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(status).toBe(200);
      expect(body).toMatchObject({
        id: userToHardDelete.userId,
        updatedAt: expect.any(String),
        deletedAt: expect.any(String),
      });

      await utils.waitForWebsocketEvent({ event: 'userDelete', id: userToHardDelete.userId, timeout: 5000 });
    });
  });
});
