import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { AuthModule } from '../auth/auth.module';
import { User } from '../user/entities/user.entity';
import { Post } from '../post/entities/post.entity';
import { Comment } from '../comment/entities/comment.entity';
import { Like } from '../like/entities/like.entity';
import { File } from '../file/entities/file.entity';
import { JwtModule } from '@nestjs/jwt';

describe('AuthController POST signup', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const timestamp = Date.now();
  const validUser = {
    email: `test${timestamp}@example.com`,
    password: 'password123',
    name: '홍길동',
    nickname: `tester${timestamp}`,
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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete({ email: validUser.email });
    await app.close();
  });

  it('✅ 유효한 회원가입 요청 → 201 Created', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send(validUser)
      .expect(201)
      .expect((res) => {
        expect(res.body.message).toBeDefined();
      });
  });

  it('❌ 중복 이메일로 회원가입 시 → 400', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send(validUser)
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('이미 사용 중인 이메일입니다.');
      });
  });

  it('❌ 이메일 형식 아님 → 400', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({ ...validUser, email: 'invalidemail' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toEqual(
          expect.arrayContaining(['이메일 형식이 올바르지 않습니다.']),
        );
      });
  });

  it('❌ 닉네임이 빈 문자열 → 400', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({ ...validUser, nickname: '' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toEqual(
          expect.arrayContaining(['닉네임은 최소 2자 이상이어야 합니다.']),
        );
      });
  });

  it('❌ 비밀번호 8자리 이하 → 400', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({ ...validUser, password: '1234' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toEqual(
          expect.arrayContaining(['비밀번호는 최소 8자 이상이어야 합니다.']),
        );
      });
  });

  it('❌ 필드 누락 (password 없음) → 400', () => {
    const { password, ...partialUser } = validUser;
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send(partialUser)
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toEqual(
          expect.arrayContaining(['비밀번호는 문자열이어야 합니다.']),
        );
      });
  });
});

describe('AuthController POST login', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let dataSource: DataSource;

  const timestamp = Date.now();
  const validUser = {
    email: `login-test-${timestamp}@example.com`,
    password: 'password123',
    name: '로그인테스터',
    nickname: `nickname-${timestamp}`,
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
        JwtModule.register({}),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);

    await request(app.getHttpServer()).post('/auth/signup').send(validUser);
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete({ email: validUser.email });
    await app.close();
  });

  it('✅ 유효한 로그인 → 200 OK + accessToken + refreshToken 포함', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    const decoded = jwt.decode(res.body.accessToken);
    expect(decoded).not.toBeNull();
    expect(typeof (decoded as jwt.JwtPayload).exp).toBe('number');
  });

  it('❌ 존재하지 않는 이메일 → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nonexist@example.com', password: 'password123' })
      .expect(401);

    expect(res.body.message).toBe('이메일이 일치하지 않습니다.');
  });

  it('❌ 잘못된 비밀번호 → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' })
      .expect(401);

    expect(res.body.message).toBe('비밀번호가 일치하지 않습니다.');
  });

  it('❌ 이메일 누락 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ password: validUser.password })
      .expect(400);

    expect(res.body.message).toEqual(expect.arrayContaining(['이메일 형식이 올바르지 않습니다.']));
  });

  it('❌ 비밀번호 누락 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validUser.email })
      .expect(400);

    expect(res.body.message).toEqual(expect.arrayContaining(['비밀번호는 최소 8자 이상이어야 합니다.']));
  });

  it('❌ 이메일 형식 아님 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'invalidemail', password: validUser.password })
      .expect(400);

    expect(res.body.message).toEqual(
      expect.arrayContaining(['이메일 형식이 올바르지 않습니다.']),
    );
  });

  it('🧪 DB에 refreshToken 저장 확인', async () => {
    const user = await dataSource.getRepository(User).findOneBy({
      email: validUser.email,
    });

    expect(user?.refreshToken).toBeDefined();
  });
});

describe('AuthController POST logout', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let accessToken: string;
  let userId: string;

  const testUser = {
    email: `logout-${Date.now()}@example.com`,
    password: 'password123',
    name: '테스트',
    nickname: `logoutTest-${Date.now()}`,
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
        JwtModule.register({}), // for jwt decoding
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);

    // 회원가입 및 로그인
    await request(app.getHttpServer()).post('/auth/signup').send(testUser);
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    accessToken = res.body.accessToken;

    const user = await userRepository.findOneBy({ email: testUser.email });
    userId = user!.id;
  });

  afterAll(async () => {
    await userRepository.delete({ email: testUser.email });
    await app.close();
  });

  it('✅ 정상 로그아웃 요청 → 200 OK', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.message).toBe('로그아웃이 완료되었습니다.');
  });

  it('❌ 이미 로그아웃된 사용자 → 400 BadRequest', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(res.body.message).toBe('이미 로그아웃된 사용자입니다.');
  });

  it('❌ accessToken 누락 → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .expect(401);

    expect(res.body.message).toBeDefined();
  });

  it('❌ 잘못된 accessToken → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer invalid.token.here`)
      .expect(401);

    expect(res.body.message).toBeDefined();
  });

  it('❌ 삭제된 유저 → 401 Unauthorized', async () => {
    const deletedUser = await userRepository.findOneBy({ email: testUser.email });
    if (deletedUser) {
      deletedUser.isDeleted = true;
      await userRepository.save(deletedUser);
    }

    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(res.body.message).toBe('존재하지 않는 사용자입니다.');
  });
});

describe('AuthController POST refresh-token', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let refreshToken: string;
  let user: User;

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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // 사용자 생성 및 로그인
    const timestamp = Date.now();
    const validUser = {
      email: `test-${timestamp}@example.com`,
      password: 'password123',
      name: '테스트',
      nickname: `tester-${timestamp}`,
    };

    await request(app.getHttpServer()).post('/auth/signup').send(validUser);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    refreshToken = res.body.refreshToken;
    user = await dataSource.getRepository(User).findOneByOrFail({ email: validUser.email });
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete({ id: user.id });
    await app.close();
  });

  it('✅ 유효한 refreshToken → 200 OK', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh-token')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('❌ refreshToken 누락 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh-token')
      .send({})
      .expect(400);

    expect(res.body.message).toContain('refreshToken이 존재하지 않습니다.');
  });

  it('❌ 형식이 잘못된 refreshToken → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh-token')
      .send({ refreshToken: 'not-a-token' })
      .expect(401);

    expect(res.body.message).toBe('유효하지 않은 refreshToken입니다.');
  });

  it('❌ refreshToken 일치하지 않음 → 401', async () => {
    const forged = jwt.sign({ id: user.id, email: user.email }, 'wrong-secret');
    const res = await request(app.getHttpServer())
      .post('/auth/refresh-token')
      .send({ refreshToken: forged })
      .expect(401);

    expect(res.body.message).toBe('유효하지 않은 refreshToken입니다.');
  });

  it('❌ 삭제된 사용자 → 401', async () => {
    await dataSource.getRepository(User).update(user.id, { isDeleted: true });

    const res = await request(app.getHttpServer())
      .post('/auth/refresh-token')
      .send({ refreshToken })
      .expect(401);

    expect(res.body.message).toBe('존재하지 않는 사용자입니다.');

    await dataSource.getRepository(User).update(user.id, { isDeleted: false }); // 복구
  });

  it('❌ refreshToken이 DB와 일치하지 않음 → 401', async () => {
    await dataSource.getRepository(User).update(user.id, { refreshToken: null });

    const res = await request(app.getHttpServer())
      .post('/auth/refresh-token')
      .send({ refreshToken })
      .expect(401);

    expect(res.body.message).toBe('refreshToken이 일치하지 않습니다.');
  });
});
