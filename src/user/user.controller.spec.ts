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
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';

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

describe('UserController PATCH me', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let accessToken: string;
  let user: User;

  const testUser = {
    email: `patch-me-${Date.now()}@example.com`,
    password: 'password123',
    name: '기존이름',
    nickname: '기존닉네임',
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

    await request(app.getHttpServer()).post('/auth/signup').send(testUser);

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

  it('✅ 유효한 accessToken과 변경 정보 → 200 + 성공 메시지', async () => {
    const res = await request(app.getHttpServer())
      .patch('/user/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '수정이름', nickname: '수정닉네임' })
      .expect(200);

    expect(res.body).toEqual({ message: '사용자 정보가 수정되었습니다.' });

    const updated = await userRepository.findOneByOrFail({ id: user.id });
    expect(updated.name).toBe('수정이름');
    expect(updated.nickname).toBe('수정닉네임');
  });

  it('❕ 동일한 정보 → 200 + "변경 사항이 없습니다."', async () => {
    const res = await request(app.getHttpServer())
      .patch('/user/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '수정이름', nickname: '수정닉네임' })
      .expect(200);

    expect(res.body).toEqual({ message: '변경 사항이 없습니다.' });
  });

  it('❌ accessToken 없음 → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .patch('/user/me')
      .send({ name: 'abc', nickname: 'def' })
      .expect(401);

    expect(res.body.message).toBe('Access Token이 존재하지 않습니다.');
  });

  it('❌ 잘못된 accessToken → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .patch('/user/me')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ name: 'abc', nickname: 'def' })
      .expect(401);

    expect(res.body.message).toBe('유효하지 않은 Access Token입니다.');
  });

  it('❌ 삭제된 유저 → 401 Unauthorized', async () => {
    await userRepository.update(user.id, { isDeleted: true });

    const res = await request(app.getHttpServer())
      .patch('/user/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '누구', nickname: '없음' })
      .expect(401);

    expect(res.body.message).toBe('존재하지 않는 사용자입니다.');

    await userRepository.update(user.id, { isDeleted: false }); // 원복
  });
});

describe('UserController GET :userId', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let viewerUser: User;
  let targetUser: User;
  let accessToken: string;

  const now = Date.now();

  const viewerSignup = {
    email: `viewer-${now}@example.com`,
    password: 'pw1234pw1234',
    name: '조회자',
    nickname: '조회자닉',
  };

  const targetSignup = {
    email: `target-${now}@example.com`,
    password: 'pw1234pw1234',
    name: '대상자',
    nickname: '대상자닉',
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
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

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(viewerSignup)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: viewerSignup.email, password: viewerSignup.password })
      .expect(200);

    accessToken = loginRes.body.accessToken;

    viewerUser = await userRepository.findOneByOrFail({ email: viewerSignup.email });
    if (!viewerUser) throw new Error('viewerUser가 DB에 저장되지 않았습니다.');

    // targetUser 회원가입
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(targetSignup)
      .expect(201);

    targetUser = await userRepository.findOneByOrFail({ email: targetSignup.email });
    if (!targetUser) throw new Error('targetUser가 DB에 저장되지 않았습니다.');
  });

  afterAll(async () => {
    if (viewerUser?.id) await userRepository.delete({ id: viewerUser.id });
    if (targetUser?.id) await userRepository.delete({ id: targetUser.id });
    await app.close();
  });

  it('✅ 타인의 유저 ID → name, nickname 반환', async () => {
    const res = await request(app.getHttpServer())
      .get(`/user/${targetUser.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      name: targetSignup.name,
      nickname: targetSignup.nickname,
    });
  });

  it('❌ 삭제된 유저 → 401 Unauthorized', async () => {
    await userRepository.update(targetUser.id, { isDeleted: true });

    const res = await request(app.getHttpServer())
      .get(`/user/${targetUser.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(res.body.message).toBe('존재하지 않는 사용자입니다.');

    await userRepository.update(targetUser.id, { isDeleted: false }); // 원복
  });

  it('❌ 존재하지 않는 UUID → 401 Unauthorized', async () => {
    const nonExistentId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const res = await request(app.getHttpServer())
      .get(`/user/${nonExistentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(res.body.message).toBe('존재하지 않는 사용자입니다.');
  });

  it('❌ 토큰 없이 요청 → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .get(`/user/${targetUser.id}`)
      .expect(401);

    expect(res.body.message).toBe('Access Token이 존재하지 않습니다.');
  });
});

describe('UserController DELETE me', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let user: User;
  let accessToken: string;

  const testUser = {
    email: `delete-me-${Date.now()}@example.com`,
    password: 'password123',
    name: '삭제유저',
    nickname: '삭제닉',
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
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

    await request(app.getHttpServer()).post('/auth/signup').send(testUser);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    accessToken = loginRes.body.accessToken;
    user = await userRepository.findOneByOrFail({ email: testUser.email });
    if (!user) throw new Error('user가 저장되지 않았습니다.');
  });

  afterAll(async () => {
    if (user?.id) await userRepository.delete({ id: user.id });
    await app.close();
  });

  it('✅ 정상 삭제 → 200 OK', async () => {
    const res = await request(app.getHttpServer())
      .delete('/user/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toEqual({ message: '사용자 정보가 삭제되었습니다.' });

    const updated = await userRepository.findOneBy({ id: user.id });
    expect(updated?.isDeleted).toBe(true);
  });

  it('❌ 이미 삭제된 유저 → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .delete('/user/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(res.body.message).toBe('존재하지 않는 사용자입니다.');
  });

  it('❌ 토큰 없이 요청 → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .delete('/user/me')
      .expect(401);

    expect(res.body.message).toBe('Access Token이 존재하지 않습니다.');
  });
});
