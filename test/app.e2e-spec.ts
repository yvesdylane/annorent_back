import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Hello (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /hello greets using a public user', async () => {
    const response = await request(app.getHttpServer()).get('/hello').expect(200);

    expect(response.body.message).toBe('Hello World!');
    expect(response.body.user).toMatchObject({
      name: 'Annorent',
      email: 'hello@annorent.cm',
      role: 'admin',
      kycStatus: 'verified',
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  afterEach(async () => {
    await app.close();
  });
});
