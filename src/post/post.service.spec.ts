import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PostService } from './post.service';
import { Post } from './entities/post.entity';
import { PostStats } from './entities/post-stats.entity';
import { User } from '../user/entities/user.entity';
import { File } from '../file/entities/file.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Like } from '../like/entities/like.entity';
import { Comment } from '../comment/entities/comment.entity';

describe('PostService createPost', () => {
  let postService: PostService;
  let userRepository: Repository<User>;
  let dataSource: DataSource;
  let user: User;

  const testUser = {
    email: `post-e2e-${Date.now()}@example.com`,
    password: 'password1234',
    name: '작성자',
    nickname: '테스터',
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
          entities: [User, Post, PostStats, File, Comment, Like],
        }),
        TypeOrmModule.forFeature([Post, PostStats, User, File]),
      ],
      providers: [PostService],
    }).compile();

    postService = module.get(PostService);
    userRepository = module.get(DataSource).getRepository(User);
    dataSource = module.get(DataSource);

    user = await userRepository.save({ ...testUser, isDeleted: false });
  });

  afterAll(async () => {
    await dataSource.getRepository(File).delete({});
    await dataSource.getRepository(PostStats).delete({});
    await dataSource.getRepository(Post).delete({ author: { id: user.id } });
    await userRepository.delete({ id: user.id });
    await dataSource.destroy();
  });

  it('✅ 정상 등록', async () => {
    const dto: CreatePostDto = {
      title: '제목',
      content: '본문',
      files: [],
    };
    const res = await postService.createPost(user.id, dto);
    expect(res.message).toBe('게시글이 등록되었습니다.');
  });

  it('❌ 존재하지 않거나 탈퇴한 유저', async () => {
    await expect(postService.createPost('11111111-1111-1111-1111-111111111111', { title: 't', content: 'c', files: [] }))
      .rejects.toThrow(NotFoundException);
  });

  it('❌ 파일 10개 초과', async () => {
    const files = Array.from({ length: 11 }).map((_, i) => ({
      url: `https://f.com/${i}`,
      originalName: `f${i}.jpg`,
      mimeType: 'image/jpeg',
      size: 100,
    }));

    await expect(postService.createPost(user.id, { title: 't', content: 'c', files }))
      .rejects.toThrow(BadRequestException);
  });

  it('✅ 파일 size가 null일 경우 0으로 처리', async () => {
    const dto: CreatePostDto = {
      title: '사이즈 없는 파일',
      content: '본문',
      files: [
        {
          url: 'https://example.com/a.jpg',
          originalName: 'a.jpg',
          mimeType: 'image/jpeg',
          size: null,
        } as any,
      ],
    };
    const res = await postService.createPost(user.id, dto);
    expect(res.message).toBe('게시글이 등록되었습니다.');
  });

  it('✅ 파일 size가 음수인 경우 0으로 저장', async () => {
    const dto: CreatePostDto = {
      title: '음수 사이즈',
      content: '본문',
      files: [
        {
          url: 'https://example.com/b.jpg',
          originalName: 'b.jpg',
          mimeType: 'image/jpeg',
          size: -100,
        },
      ],
    };
    const res = await postService.createPost(user.id, dto);
    expect(res.message).toBe('게시글이 등록되었습니다.');
  });
});