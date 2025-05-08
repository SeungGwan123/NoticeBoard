import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Post } from '../post/entities/post.entity';
import { Comment } from '../comment/entities/comment.entity';
import { Like } from '../like/entities/like.entity';
import { File } from '../file/entities/file.entity';
import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';

describe('UserService getMe', () => {
  let userService: UserService;
  let dataSource: DataSource;
  let testUserId: string;

  const testUser = {
    email: `me-test-${Date.now()}@example.com`,
    password: 'password123',
    name: '프로필',
    nickname: 'me-user',
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
      ],
      providers: [UserService],
    }).compile();

    userService = module.get(UserService);
    dataSource = module.get(DataSource);

    const userRepo = dataSource.getRepository(User);
    const hashed = await bcrypt.hash(testUser.password, 10);
    const saved = await userRepo.save({ ...testUser, password: hashed });
    testUserId = saved.id;
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete({ id: testUserId });
    await dataSource.destroy();
  });

  it('✅ 정상적으로 사용자 정보 반환', async () => {
    const me = await userService.getMe(testUserId);
    expect(me).toMatchObject({
      email: testUser.email,
      name: testUser.name,
      nickname: testUser.nickname,
    });
  });

  it('❌ 존재하지 않는 사용자 → UnauthorizedException', async () => {
    await expect(userService.getMe('11111111-1111-1111-1111-111111111111')).rejects.toThrow(
      '존재하지 않는 사용자입니다.',
    );
  });

  it('❌ 삭제된 사용자 → UnauthorizedException', async () => {
    const userRepo = dataSource.getRepository(User);
    await userRepo.update({ id: testUserId }, { isDeleted: true });

    await expect(userService.getMe(testUserId)).rejects.toThrow('존재하지 않는 사용자입니다.');

    await userRepo.update({ id: testUserId }, { isDeleted: false });
  });
});

describe('UserService updateMe', () => {
  let userService: UserService;
  let userRepository: Repository<User>;
  let dataSource: DataSource;
  let user: User;

  const testUser = {
    email: `update-me-${Date.now()}@example.com`,
    password: 'password123',
    name: '기존이름',
    nickname: '기존닉네임',
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
          autoLoadEntities: true,
          entities: [User, Post, Comment, Like, File],
        }),
        TypeOrmModule.forFeature([User]),
      ],
      providers: [UserService],
    }).compile();

    userService = module.get(UserService);
    dataSource = module.get(DataSource);
    userRepository = dataSource.getRepository(User);

    // 테스트 유저 생성
    user = userRepository.create(testUser);
    await userRepository.save(user);
  });

  afterAll(async () => {
    await userRepository.delete({ id: user.id });
    await dataSource.destroy();
  });

  it('✅ 정상 수정 → 성공 메시지 반환', async () => {
    const result = await userService.updateMe(user.id, {
      name: '수정이름',
      nickname: '수정닉',
    });

    expect(result).toEqual({ message: '사용자 정보가 수정되었습니다.' });

    const updated = await userRepository.findOneByOrFail({ id: user.id });
    expect(updated.name).toBe('수정이름');
    expect(updated.nickname).toBe('수정닉');
  });

  it('❕ 변경사항 없음 → 메시지만 반환', async () => {
    const result = await userService.updateMe(user.id, {
      name: '수정이름',
      nickname: '수정닉',
    });

    expect(result).toEqual({ message: '변경 사항이 없습니다.' });
  });

  it('❌ 삭제된 유저 → UnauthorizedException', async () => {
    await userRepository.update(user.id, { isDeleted: true });

    await expect(
      userService.updateMe(user.id, {
        name: '누군가',
        nickname: '삭제자',
      }),
    ).rejects.toThrow(UnauthorizedException);

    await userRepository.update(user.id, { isDeleted: false }); // 원복
  });

  it('❌ 존재하지 않는 유저 → UnauthorizedException', async () => {
    await expect(
      userService.updateMe('11111111-1111-1111-1111-111111111111', {
        name: 'XX',
        nickname: 'YY',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('❌ update 실패 → InternalServerErrorException', async () => {
    const spy = jest.spyOn(userRepository, 'update').mockResolvedValue({ affected: 0 } as any);

    await expect(
      userService.updateMe(user.id, {
        name: '업데이트실패',
        nickname: '업데이트실패',
      }),
    ).rejects.toThrow(InternalServerErrorException);

    spy.mockRestore();
  });
});