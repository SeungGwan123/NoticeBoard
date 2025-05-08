import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Post } from '../post/entities/post.entity';
import { Comment } from '../comment/entities/comment.entity';
import { Like } from '../like/entities/like.entity';
import { File } from '../file/entities/file.entity';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from './user.module';
import * as jwt from 'jsonwebtoken';

describe('UserController GET me', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let accessToken: string;
  let user: User;

  const testUser = {
    email: `me-test-${Date.now()}@example.com`,
    password: 'password123',
    name: '내정보',
    nickname: 'myinfo',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST,
          port: Number(process.env.DB_TEST_PORT),
          username: process.env.DB_USERNAME,
          password: String(process.env.DB_PASSWORD),
          database: process.env.DB_TEST_DATABASE,
          synchronize: true,
          autoLoadEntities: true,
          entities: [User, Post, Comment, Like, File],
        }),
        AuthModule,
        UserModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);

    // 회원가입
    await request(app.getHttpServer()).post('/auth/signup').send(testUser);

    // 로그인 후 accessToken 획득
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    accessToken = res.body.accessToken;
    user = await userRepository.findOneByOrFail({ email: testUser.email });
  });

  afterAll(async () => {
    await userRepository.delete({ email: testUser.email });
    await app.close();
  });

  it('✅ 유효한 accessToken → 200 + 유저 정보 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/user/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      email: testUser.email,
      name: testUser.name,
      nickname: testUser.nickname,
    });
  });

  it('❌ accessToken 없음 → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .get('/user/me')
      .expect(401);

    expect(res.body.message).toBe('Access Token이 존재하지 않습니다.');
  });

  it('❌ 잘못된 accessToken → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .get('/user/me')
      .set('Authorization', 'Bearer invalid.token.here')
      .expect(401);

    expect(res.body.message).toBe('유효하지 않은 Access Token입니다.');
  });

  it('❌ 삭제된 유저 → 401 Unauthorized', async () => {
    await userRepository.update(user.id, { isDeleted: true });

    const res = await request(app.getHttpServer())
      .get('/user/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(res.body.message).toBe('존재하지 않는 사용자입니다.');

    await userRepository.update(user.id, { isDeleted: false }); // 원복
  });
});