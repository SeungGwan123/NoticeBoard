import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { Post } from '../post/entities/post.entity';
import { Like } from '../like/entities/like.entity';
import { Comment } from '../comment/entities/comment.entity';
import { File } from '../file/entities/file.entity';
import { JwtModule } from '@nestjs/jwt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AuthModule } from './auth.module';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';

describe('AuthService signup', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let dataSource: DataSource;

  const timestamp = Date.now();
  const testEmail = `test${timestamp}@example.com`;
  const dto: SignupDto = {
    email: testEmail,
    password: '123456',
    name: '홍길동',
    nickname: `tester${timestamp}`,
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
          entities: [User, Post, Comment, Like, File],
        }),
        TypeOrmModule.forFeature([User]),
        JwtModule.register({}),
      ],
      providers: [AuthService],
    }).compile();

    service = module.get(AuthService);
    userRepository = module.get('UserRepository');
    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    await userRepository.delete({ email: testEmail });
    await dataSource.destroy();
  });

  it('✅ 새로운 유저 가입 성공', async () => {
    const result = await service.signUp(dto);
    expect(result.message).toBe('회원가입이 성공적으로 진행되었습니다');

    const user = await userRepository.findOneBy({ email: dto.email });
    expect(user).toBeDefined();
    expect(user?.nickname).toBe(dto.nickname);
    expect(await bcrypt.compare(dto.password, user!.password)).toBe(true);
  });

  it('❌ 이미 존재하는 이메일로 가입 시 예외 발생 (isDeleted: false)', async () => {
    await expect(service.signUp(dto)).rejects.toThrow('이미 사용 중인 이메일입니다.');
  });

  it('✅ soft-delete 복구 (isDeleted: true)', async () => {
    // 삭제된 사용자로 만들기
    const user = await userRepository.findOneByOrFail({ email: dto.email });
    user.isDeleted = true;
    await userRepository.save(user);

    // 다시 가입 시 복구
    const result = await service.signUp(dto);
    expect(result.message).toBe('회원가입이 성공적으로 진행되었습니다');

    const restored = await userRepository.findOneByOrFail({ email: dto.email });
    expect(restored.isDeleted).toBe(false);
  });
});

describe('AuthService login', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authService: AuthService;
  let userRepository: Repository<User>;

  const timestamp = Date.now();
  const validUser = {
    email: `login-service-${timestamp}@example.com`,
    password: 'password123',
    name: '테스트계정',
    nickname: `svc${timestamp}`,
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
    authService = moduleFixture.get(AuthService);
    userRepository = dataSource.getRepository(User);

    await request(app.getHttpServer()).post('/auth/signup').send(validUser);
  });

  afterAll(async () => {
    await userRepository.delete({ email: validUser.email });
    await app.close();
  });

  it('✅ 정상 로그인 시 accessToken, refreshToken이 반환되고, refreshToken이 DB에 저장됨', async () => {
    const { accessToken, refreshToken } = await authService.login({
      email: validUser.email,
      password: validUser.password,
    });

    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    const decoded = jwt.decode(accessToken);
    expect(decoded).not.toBeNull();
    expect(typeof (decoded as jwt.JwtPayload).exp).toBe('number');

    const userInDb = await userRepository.findOneBy({ email: validUser.email });
    expect(userInDb?.refreshToken).toBe(refreshToken);
  });

  it('❌ 존재하지 않는 이메일 → UnauthorizedException', async () => {
    await expect(
      authService.login({ email: 'nonexistent@email.com', password: 'password123' }),
    ).rejects.toThrow('이메일이 일치하지 않습니다.');
  });

  it('❌ 삭제된 유저(isDeleted: true) → UnauthorizedException', async () => {
    const user = await userRepository.findOneBy({ email: validUser.email });
    if (user) {
      user.isDeleted = true;
      await userRepository.save(user);

      await expect(
        authService.login({ email: validUser.email, password: validUser.password }),
      ).rejects.toThrow('이메일이 일치하지 않습니다.');

      user.isDeleted = false; // 테스트 후 복구
      await userRepository.save(user);
    }
  });

  it('❌ 비밀번호 불일치 → UnauthorizedException', async () => {
    await expect(
      authService.login({ email: validUser.email, password: 'wrong-password' }),
    ).rejects.toThrow('비밀번호가 일치하지 않습니다.');
  });
});

describe('AuthService logout', () => {
  let module: TestingModule;
  let authService: AuthService;
  let userRepository: Repository<User>;
  let dataSource: DataSource;
  let testUserId: string;

  const testUser = {
    email: `logout-test-${Date.now()}@example.com`,
    password: 'password123',
    name: '테스트유저',
    nickname: 'logouttester',
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST,
          port: Number(process.env.DB_TEST_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_TEST_DATABASE,
          synchronize: true,
          autoLoadEntities: true,
          entities: [User, Post, Comment, Like, File],
        }),
        AuthModule,
      ],
    }).compile();

    const app = module.createNestApplication();
    await app.init();

    authService = module.get(AuthService);
    dataSource = module.get(DataSource);
    userRepository = dataSource.getRepository(User);

    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const saved = await userRepository.save({
      ...testUser,
      password: hashedPassword,
      refreshToken: 'test-refresh-token',
    });

    testUserId = String(saved.id);
  });

  afterAll(async () => {
    await userRepository.delete({ email: testUser.email });
    await dataSource.destroy();
  });

  it('✅ 정상 로그아웃 처리', async () => {
    const result = await authService.logout(testUserId);
    expect(result).toEqual({ message: '로그아웃이 완료되었습니다.' });

    const user = await userRepository.findOneBy({ id: testUserId });
    expect(user?.refreshToken).toBeNull();
  });

  it('❌ 존재하지 않는 사용자 → UnauthorizedException', async () => {
    const nonExistentUUID = '11111111-1111-1111-1111-111111111111';
    await expect(authService.logout(nonExistentUUID))
      .rejects.toThrow('존재하지 않는 사용자입니다.');
  });

  it('❌ 이미 로그아웃된 사용자 → BadRequestException', async () => {
    await expect(authService.logout(testUserId))
      .rejects.toThrow('이미 로그아웃된 사용자입니다.');
  });
});

describe('AuthService reissueToken', () => {
  let app: INestApplication;
  let authService: AuthService;
  let userRepository: Repository<User>;
  let dataSource: DataSource;
  let refreshToken: string;
  let user: User;

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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    authService = moduleFixture.get(AuthService);
    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);

    // 유저 등록 + 로그인
    const timestamp = Date.now();
    const email = `reissue-${timestamp}@example.com`;
    const password = 'password123';

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password, name: '리이슈', nickname: `nick-${timestamp}` });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });

    refreshToken = res.body.refreshToken;
    user = await userRepository.findOneByOrFail({ email });
  });

  afterAll(async () => {
    await userRepository.delete({ id: user.id });
    await app.close();
  });

  it('✅ 정상적인 재발급 → accessToken + refreshToken 반환', async () => {
    const result = await authService.reissueToken(refreshToken);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('❌ 토큰 형식 잘못됨 → UnauthorizedException', async () => {
    await expect(authService.reissueToken('invalid-token')).rejects.toThrow('유효하지 않은 refreshToken입니다.');
  });

  it('❌ 존재하지 않는 유저 ID → UnauthorizedException', async () => {
    const fakeToken = jwt.sign({ id: '11111111-1111-1111-1111-111111111111', email: 'a@a.com' }, process.env.REFRESH_TOKEN_SECRET!);
    await expect(authService.reissueToken(fakeToken)).rejects.toThrow('존재하지 않는 사용자입니다.');
  });

  it('❌ 삭제된 유저 → UnauthorizedException', async () => {
    await userRepository.update(user.id, { isDeleted: true });

    await expect(authService.reissueToken(refreshToken)).rejects.toThrow('존재하지 않는 사용자입니다.');

    await userRepository.update(user.id, { isDeleted: false });
  });

  it('❌ DB의 refreshToken과 다름 → UnauthorizedException', async () => {
    await userRepository.update(user.id, { refreshToken: null });

    await expect(authService.reissueToken(refreshToken)).rejects.toThrow('refreshToken이 일치하지 않습니다.');
  });

  it('❌ 환경변수 누락 → InternalServerErrorException', async () => {
    const original = process.env.REFRESH_TOKEN_SECRET;
    delete process.env.REFRESH_TOKEN_SECRET;

    await expect(authService.reissueToken(refreshToken)).rejects.toThrow('환경변수에 REFRESH_TOKEN_SECRET이 없습니다.');

    process.env.REFRESH_TOKEN_SECRET = original;
  });
});
