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
      .expect(201);

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