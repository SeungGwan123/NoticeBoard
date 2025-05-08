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
import { v4 as uuidv4 } from 'uuid';

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
        TypeOrmModule.forFeature([User, Post]),
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
        TypeOrmModule.forFeature([User, Post]),
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

describe('UserService getUser', () => {
  let userService: UserService;
  let userRepository: Repository<User>;
  let dataSource: DataSource;
  let user: User;

  const testUser = {
    email: `get-user-service-${Date.now()}@example.com`,
    password: 'password123',
    name: '서비스사용자',
    nickname: '서비스닉',
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
        TypeOrmModule.forFeature([User, Post]),
      ],
      providers: [UserService],
    }).compile();

    userService = module.get(UserService);
    dataSource = module.get(DataSource);
    userRepository = dataSource.getRepository(User);

    user = userRepository.create(testUser);
    await userRepository.save(user);
  });

  afterAll(async () => {
    await userRepository.delete({ id: user.id });
    await dataSource.destroy();
  });

  it('✅ 존재하는 유저 ID → name, nickname 반환', async () => {
    const result = await userService.getUser(user.id);

    expect(result).toEqual({
      name: testUser.name,
      nickname: testUser.nickname,
    });
  });

  it('❌ 삭제된 유저 → UnauthorizedException', async () => {
    await userRepository.update(user.id, { isDeleted: true });

    await expect(userService.getUser(user.id)).rejects.toThrow(UnauthorizedException);

    await userRepository.update(user.id, { isDeleted: false }); // 원복
  });

  it('❌ 존재하지 않는 UUID → UnauthorizedException', async () => {
    const nonExistentId = uuidv4();

    await expect(userService.getUser(nonExistentId)).rejects.toThrow(UnauthorizedException);
  });
});

describe('UserService deleteMe', () => {
  let userService: UserService;
  let userRepository: Repository<User>;
  let dataSource: DataSource;
  let user: User;

  const testUser = {
    email: `delete-me-${Date.now()}@example.com`,
    password: 'password123',
    name: '삭제유저',
    nickname: '삭제닉',
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
        TypeOrmModule.forFeature([User, Post]),
      ],
      providers: [UserService],
    }).compile();

    userService = module.get(UserService);
    dataSource = module.get(DataSource);
    userRepository = dataSource.getRepository(User);

    user = userRepository.create(testUser);
    await userRepository.save(user);
  });

  afterAll(async () => {
    await userRepository.delete({ id: user.id });
    await dataSource.destroy();
  });

  it('✅ 정상 삭제 → 성공 메시지 & isDeleted true', async () => {
    const result = await userService.deleteMe(user.id);
    expect(result).toEqual({ message: '사용자 정보가 삭제되었습니다.' });

    const updated = await userRepository.findOneBy({ id: user.id });
    expect(updated?.isDeleted).toBe(true);
  });

  it('❌ 이미 삭제된 유저 → UnauthorizedException', async () => {
    await expect(userService.deleteMe(user.id)).rejects.toThrow(UnauthorizedException);
  });

  it('❌ 존재하지 않는 UUID → UnauthorizedException', async () => {
    const fakeId = uuidv4();
    await expect(userService.deleteMe(fakeId)).rejects.toThrow(UnauthorizedException);
  });

  it('❌ update 실패 → InternalServerErrorException', async () => {
    const testUser2 = await userRepository.save({
      email: `delete-test-${Date.now()}@example.com`,
      password: 'password123',
      name: '업데이트실패',
      nickname: '실패',
    });

    const spy = jest
      .spyOn(userRepository, 'update')
      .mockResolvedValue({ affected: 0 } as any);

    await expect(userService.deleteMe(testUser2.id)).rejects.toThrow(InternalServerErrorException);

    spy.mockRestore();
    await userRepository.delete({ id: testUser2.id });
  });
});

describe('UserService getMyPosts', () => {
  let userService: UserService;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let dataSource: DataSource;
  let user: User;

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
        TypeOrmModule.forFeature([User, Post]),
      ],
      providers: [UserService],
    }).compile();

    userService = module.get(UserService);
    dataSource = module.get(DataSource);
    userRepository = dataSource.getRepository(User);
    postRepository = dataSource.getRepository(Post);

    // 테스트 유저 생성
    user = await userRepository.save({
      email: `myposts-${Date.now()}@test.com`,
      password: '12345678',
      name: '유저',
      nickname: '게시유저',
    });

    // 게시물 15개 생성
    const posts = Array.from({ length: 15 }, (_, i) =>
      postRepository.create({
        title: `테스트 ${i + 1}`,
        content: `내용 ${i + 1}`,
        author: user,
        isDeleted: false,
      }),
    );
    await postRepository.save(posts);
  });

  afterAll(async () => {
    await postRepository.delete({ author: { id: user.id } });
    await userRepository.delete({ id: user.id });
    await dataSource.destroy();
  });

  it('✅ 최신 10개 반환', async () => {
    const res = await userService.getMyPosts(user.id);
    expect(res.posts).toHaveLength(10);
    expect(res.posts[0].title).toBe('테스트 14');
    expect(res.posts[9].title).toBe('테스트 5');
  });

  it('✅ 유효한 cursor → 이전 게시물 5개 반환', async () => {
    const cursor = (await postRepository.findOneByOrFail({ title: '테스트 6' })).id;
    const res = await userService.getMyPosts(user.id, cursor);
    expect(res.posts).toHaveLength(5);
    expect(res.posts[0].title).toBe('테스트 5');
    expect(res.posts[4].title).toBe('테스트 1');
  });

  it('✅ 존재하지 않는 cursor → 최신 10개 반환', async () => {
    const res = await userService.getMyPosts(user.id, 9999999);
    expect(res.posts).toHaveLength(10);
    expect(res.posts[0].title).toBe('테스트 14');
  });

  it('✅ 게시물이 없는 유저 → 빈 배열 반환', async () => {
    const noPostUser = await userRepository.save({
      email: `nopost-${Date.now()}@test.com`,
      password: '12345678',
      name: '무',
      nickname: '게시물없음',
    });

    const res = await userService.getMyPosts(noPostUser.id);
    expect(res.posts).toHaveLength(0);

    await userRepository.delete({ id: noPostUser.id });
  });

  it('❌ 삭제된 유저 → UnauthorizedException', async () => {
    await userRepository.update({ id: user.id }, { isDeleted: true });

    await expect(userService.getMyPosts(user.id)).rejects.toThrow('존재하지 않는 사용자입니다.');

    await userRepository.update({ id: user.id }, { isDeleted: false }); // 원복
  });

  it('❌ 존재하지 않는 유저 → UnauthorizedException', async () => {
    await expect(
      userService.getMyPosts('11111111-1111-1111-1111-111111111111'),
    ).rejects.toThrow('존재하지 않는 사용자입니다.');
  });
});