import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PostService } from './post.service';
import { Post } from './entities/post.entity';
import { PostStats } from './entities/post-stats.entity';
import { User } from '../user/entities/user.entity';
import { File } from '../file/entities/file.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { BadRequestException, INestApplication, InternalServerErrorException, NotFoundException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Like } from '../like/entities/like.entity';
import { Comment } from '../comment/entities/comment.entity';
import { FileDto } from '../file/dto/file.dto';
import { AuthModule } from '../auth/auth.module';
import { PostModule } from './post.module';
import * as request from 'supertest';

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
        TypeOrmModule.forFeature([Post, PostStats, User, File, Comment]),
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

describe('PostService getPostById', () => {
  let postService: PostService;
  let dataSource: DataSource;

  let userRepo: Repository<User>;
  let postRepo: Repository<Post>;
  let statsRepo: Repository<PostStats>;
  let fileRepo: Repository<File>;
  let commentRepo: Repository<Comment>;

  let user: User;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
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
        TypeOrmModule.forFeature([User, Post, PostStats, File, Comment]),
      ],
      providers: [PostService],
    }).compile();

    postService = module.get(PostService);
    dataSource = module.get(DataSource);
    userRepo = dataSource.getRepository(User);
    postRepo = dataSource.getRepository(Post);
    statsRepo = dataSource.getRepository(PostStats);
    fileRepo = dataSource.getRepository(File);
    commentRepo = dataSource.getRepository(Comment);

    user = await userRepo.save({
      email: `service-${Date.now()}@example.com`,
      password: '1234',
      name: '서비스',
      nickname: '유저',
      isDeleted: false,
    });
  });

  afterAll(async () => {
    await fileRepo.delete({});
    await commentRepo.delete({});
    await statsRepo.delete({});
    await postRepo.delete({});
    await userRepo.delete(user.id);
    await dataSource.destroy();
  });

  it('✅ 게시글 정상 조회', async () => {
    const post = await postRepo.save({ title: '제목', content: '본문', author: user });
    await statsRepo.save({ post, viewCount: 0, likeCount: 0, commentCount: 0 });

    const result = await postService.getPostById(post.id);

    expect(result.id).toBe(post.id);
    expect(result.author.nickname).toBe(user.nickname);
    expect(result.stats.viewCount).toBe(1);
  });

  it('❌ 존재하지 않는 게시글 → 404', async () => {
    await expect(postService.getPostById(99999999)).rejects.toThrow(NotFoundException);
  });

  it('❌ 삭제된 게시글 → 404', async () => {
    const deletedPost = await postRepo.save({ title: '삭제', content: 'x', author: user, isDeleted: true });
    await statsRepo.save({ post: deletedPost });

    await expect(postService.getPostById(deletedPost.id)).rejects.toThrow(NotFoundException);
  });

  it('❌ 작성자가 삭제된 게시글 → 404', async () => {
    const ghost = await userRepo.save({
      email: `ghost-${Date.now()}@test.com`,
      password: '1',
      name: '고스트',
      nickname: '고스트',
      isDeleted: true,
    });
    const ghostPost = await postRepo.save({ title: '고스트', content: 'x', author: ghost });
    await statsRepo.save({ post: ghostPost });

    await expect(postService.getPostById(ghostPost.id)).rejects.toThrow(NotFoundException);
  });

  it('❌ 통계 없음 → 500', async () => {
    const post = await postRepo.save({ title: '통계 없음', content: 'x', author: user });
    await expect(postService.getPostById(post.id)).rejects.toThrow(InternalServerErrorException);
  });

  it('✅ 댓글 + 대댓글 정상 반환', async () => {
    const post = await postRepo.save({ title: '댓글 테스트', content: 'c', author: user });
    await statsRepo.save({ post });

    const parent = await commentRepo.save({ content: '부모', author: user, post });
    await commentRepo.save({ content: '자식', author: user, post, parent });

    const result = await postService.getPostById(post.id);
    expect(result.comments.length).toBe(1);
    expect(result.comments[0].children.length).toBe(1);
  });

  it('❌ 댓글 작성자 삭제 → 댓글 제외', async () => {
    const ghost = await userRepo.save({
      email: `cghost-${Date.now()}@test.com`,
      password: '1',
      name: '고스트',
      nickname: '삭제됨',
      isDeleted: true,
    });
    const post = await postRepo.save({ title: '고스트 댓글', content: 'c', author: user });
    await statsRepo.save({ post });
    await commentRepo.save({ content: '고스트 댓글', author: ghost, post });

    const result = await postService.getPostById(post.id);
    expect(result.comments.length).toBe(0);
  });
});

describe('PostService updatePost', () => {
  let service: PostService;
  let ds: DataSource;

  let userRepo: Repository<User>;
  let postRepo: Repository<Post>;
  let fileRepo: Repository<File>;

  let user: User;
  let post: Post;

  const dto = (files: FileDto[] = []): CreatePostDto => ({
    title: '수정 제목',
    content: '수정된 본문',
    files,
  });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
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
        TypeOrmModule.forFeature([User, Post, PostStats, File, Comment]),
      ],
      providers: [PostService],
    }).compile();

    service = mod.get(PostService);
    ds = mod.get(DataSource);
    userRepo = ds.getRepository(User);
    postRepo = ds.getRepository(Post);
    fileRepo = ds.getRepository(File);

    user = await userRepo.save({
      email: 'edit@example.com',
      password: '1234',
      name: 'u',
      nickname: 'nn',
    });
    post = await postRepo.save({ title: '원본', content: '본문', author: user });
  });

  afterEach(async () => {
    await fileRepo.delete({});
    await postRepo.update({}, { title: '원본', content: '본문', isDeleted: false });
    await userRepo.update({}, { isDeleted: false });
  });

  afterAll(async () => {
    await fileRepo.delete({});
    await postRepo.delete({});
    await userRepo.delete({});
    await ds.destroy();
  });

  it('✅ 정상 수정', async () => {
    const res = await service.updatePost(user.id, post.id, dto());
    expect(res.message).toBe('게시글이 수정되었습니다.');
  });

  it('❌ 존재하지 않거나 탈퇴한 유저', async () => {
    await expect(
      service.updatePost('11111111-1111-1111-1111-111111111111', post.id, dto()),
    ).rejects.toThrow(NotFoundException);

    await userRepo.update(user.id, { isDeleted: true });
    await expect(service.updatePost(user.id, post.id, dto())).rejects.toThrow(NotFoundException);
  });

  it('❌ 존재하지 않거나 삭제된 게시글', async () => {
    await expect(service.updatePost(user.id, 987654321, dto())).rejects.toThrow(NotFoundException);

    await postRepo.update(post.id, { isDeleted: true });
    await expect(service.updatePost(user.id, post.id, dto())).rejects.toThrow(NotFoundException);
  });

  it('❌ 다른 사용자가 수정하려는 경우', async () => {
    const stranger = await userRepo.save({
      email: 'stranger@example.com',
      password: '1234',
      name: 's',
      nickname: 'ss',
    });

    await expect(service.updatePost(stranger.id, post.id, dto())).rejects.toThrow(NotFoundException);
  });

  it('❌ 파일 10개 초과', async () => {
    const files: FileDto[] = Array.from({ length: 11 }).map((_, i) => ({
      url: `https://x.com/${i}`,
      originalName: `x${i}.jpg`,
      mimeType: 'image/jpeg',
      size: 100,
    }));

    await expect(service.updatePost(user.id, post.id, dto(files))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('✅ 파일 size 가 null/음수면 0 으로 저장', async () => {
    const files: FileDto[] = [
      {
        url: 'https://a.com',
        originalName: 'a',
        mimeType: 'image/png',
      } as any,
      {
        url: 'https://b.com',
        originalName: 'b',
        mimeType: 'image/png',
        size: -123,
      },
    ];

    const res = await service.updatePost(user.id, post.id, dto(files));
    expect(res.message).toBe('게시글이 수정되었습니다.');
  });
});

describe('PostService deletePost', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let postRepository: Repository<Post>;
  let userRepository: Repository<User>;
  let postService: PostService;
  let user: User;
  let accessToken: string;

  const testUser = {
    email: `delete-post-${Date.now()}@example.com`,
    password: 'password1234',
    name: '유저',
    nickname: '작성자',
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
          entities: [User, Post, PostStats, File, Like, Comment],
        }),
        TypeOrmModule.forFeature([User, Post, File, PostStats, Like, Comment]),
        AuthModule,
        PostModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    postRepository = dataSource.getRepository(Post);
    userRepository = dataSource.getRepository(User);
    postService = moduleFixture.get(PostService);

    await request(app.getHttpServer()).post('/auth/signup').send(testUser);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    accessToken = res.body.accessToken;
    user = await userRepository.findOneByOrFail({ email: testUser.email });
  });

  afterAll(async () => {
    await postRepository.delete({ author: { id: user.id } });
    await userRepository.delete({ email: testUser.email });
    await app.close();
  });

  it('✅ 정상 삭제', async () => {
    const post = await postRepository.save({
      title: '제목',
      content: '본문',
      author: user,
    });

    await postService.deletePost(user.id, post.id);

    const deletedPost = await postRepository.findOneOrFail({
      where: { id: post.id },
    });
    expect(deletedPost.isDeleted).toBe(true);
  });

  it('❌ 게시글이 존재하지 않으면 404 반환', async () => {
    await expect(postService.deletePost(user.id, 99999999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('❌ 작성자가 아닌 경우 401 반환', async () => {
    const otherUser = await userRepository.save({
      email: `other-${Date.now()}@example.com`,
      password: 'password1234',
      name: '다른 유저',
      nickname: '작성자2',
    });

    const post = await postRepository.save({
      title: '제목',
      content: '본문',
      author: otherUser,
    });

    await expect(
      postService.deletePost(user.id, post.id),
    ).rejects.toThrow(UnauthorizedException);

    await postRepository.delete({ id: post.id });
    await userRepository.delete({ email: otherUser.email });
  });

  it('❌ 이미 삭제된 게시글에 대해서 404 반환', async () => {
    const post = await postRepository.save({
      title: '제목',
      content: '본문',
      author: user,
      isDeleted: true,
    });

    await expect(
      postService.deletePost(user.id, post.id),
    ).rejects.toThrow(NotFoundException);
  });
});