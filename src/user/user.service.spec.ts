import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Post } from '../post/entities/post.entity';
import { Comment } from '../comment/entities/comment.entity';
import { Like } from '../like/entities/like.entity';
import { File } from '../file/entities/file.entity';

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
