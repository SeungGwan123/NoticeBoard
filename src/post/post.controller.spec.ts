import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import * as request from 'supertest';
import { Comment } from '../comment/entities/comment.entity';
import { File } from '../file/entities/file.entity';
import { User } from '../user/entities/user.entity';
import { Post } from '../post/entities/post.entity';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Like } from '../like/entities/like.entity';
import { PostModule } from './post.module';
import * as express from 'express';
import { FileModule } from '../file/file.module';
import { PostStats } from './entities/post-stats.entity';
import { CommentModule } from '../comment/comment.module';
import { v4 as uuid } from 'uuid';

describe('PostController POST post', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let accessToken: string;
  let user: User;

  const testUser = {
    email: `e2e-${Date.now()}@example.com`,
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
          entities: [User, Post, Comment, Like, File, PostStats],
        }),
        TypeOrmModule.forFeature([Post, PostStats, User, File, Comment, Like]),
        AuthModule,
        PostModule,
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
    const fileRepository = dataSource.getRepository(File);
    const postRepository = dataSource.getRepository(Post);

    await fileRepository.delete({});
    if (user) {
      await postRepository.delete({ author: { id: user.id } });
      await userRepository.delete({ email: testUser.email });
    }
    await app.close();
  });

  it('✅ 정상 등록 (파일 포함)', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '정상 등록',
        content: '본문입니다.',
        files: [
          {
            url: 'https://example.com/image.jpg',
            originalName: 'image.jpg',
            mimeType: 'image/jpeg',
            size: 1000,
          },
        ],
      })
      .expect(201);
  });

  it('❌ accessToken 없음', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .send({ title: '제목', content: '본문' })
      .expect(401);
  });

  it('❌ 잘못된 accessToken', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ title: '제목', content: '본문' })
      .expect(401);
  });

  it('❌ title 누락', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: '본문입니다.' })
      .expect(400);
  });

  it('❌ content 누락', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '본문입니다.' })
      .expect(400);
  });

  it('❌ title이 빈 문자열 → 400 + 에러 메시지 확인', async () => {
    const res = await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '',
        content: '본문',
        files: [],
      })
      .expect(400);

    expect(res.body.message).toContain('제목은 1자 이상이어야 합니다.');
  });

  it('❌ content가 빈 문자열 → 400 + 에러 메시지 확인', async () => {
    const res = await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '제목',
        content: '',
        files: [],
      })
      .expect(400);

    expect(res.body.message).toContain('내용은 1자 이상이어야 합니다.');
  });

  it('❌ 삭제된 유저', async () => {
    await userRepository.update(user.id, { isDeleted: true });
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '삭제된 유저', content: '본문입니다.', files: [] })
      .expect(401);
    await userRepository.update(user.id, { isDeleted: false });
  });

  it('✅ files: [] 빈 배열 허용', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '제목', content: '본문', files: [] })
      .expect(201);
  });

  it('✅ files: null → 빈 배열로 처리되어 정상 등록', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'null 테스트', content: '본문', files: null })
      .expect(201);
  });

  it('❌ 파일 수 초과 (11개) → 400', async () => {
    const files = Array(11).fill({
      url: 'https://example.com/image.jpg',
      originalName: 'image.jpg',
      mimeType: 'image/jpeg',
      size: 123,
    });

    const res = await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '파일 초과', content: '본문', files })
      .expect(400);

    expect(res.body.message).toContain('파일은 최대 10개까지 첨부할 수 있습니다.');
  });

  it('❌ 파일 size 음수 → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '음수 테스트',
        content: '본문',
        files: [
          {
            url: 'https://example.com/file.jpg',
            originalName: 'file.jpg',
            mimeType: 'image/jpeg',
            size: -10,
          },
        ],
      })
      .expect(400);

    expect(res.body.message.join()).toContain('파일의 크기(size)는 0 이상이어야 합니다.');
  });

  it('❌ files가 배열이 아님 → 400', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '제목', content: '본문', files: {} })
      .expect(400);
  });

  it('❌ files 내부가 비정상 객체 → 400', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '제목', content: '본문', files: [{ url: 123 }] })
      .expect(400);
  });

  it('❌ 파일 필드 누락 → 400', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '제목',
        content: '본문',
        files: [{ url: 'https://example.com/image.jpg' }],
      })
      .expect(400);
  });

  it('❌ size에 문자열 전달 → 400', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '제목',
        content: '본문',
        files: [
          {
            url: 'https://example.com/image.jpg',
            originalName: 'image.jpg',
            mimeType: 'image/jpeg',
            size: '100KB',
          },
        ],
      })
      .expect(400);
  });

  it('❌ content가 숫자일 경우 → 400', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '제목', content: 1234 })
      .expect(400);
  });

  it('❌ title에 XSS 스크립트 → 저장 실패해야 함', async () => {
    const res = await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '<script>alert(1)</script>',
        content: '스크립트 테스트',
        files: [],
      })
      .expect(400);

    expect(res.body.message).toContain('스크립트 태그는 사용할 수 없습니다.');
  });

  it('✅ 중복된 제목 등록 가능', async () => {
    const payload = { title: '중복 제목', content: '본문', files: [] };
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);
  });

  it('✅ files에 중복된 URL → 허용되는지 확인', async () => {
    await request(app.getHttpServer())
      .post('/post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '중복 파일 URL',
        content: '본문입니다.',
        files: [
          {
            url: 'https://example.com/dup.jpg',
            originalName: 'dup.jpg',
            mimeType: 'image/jpeg',
            size: 1234,
          },
          {
            url: 'https://example.com/dup.jpg',
            originalName: 'dup.jpg',
            mimeType: 'image/jpeg',
            size: 1234,
          },
        ],
      })
      .expect(201); // 비즈니스 로직에 따라 제한할 수도 있음
  });
});

describe('PostController GET /post/:postId', () => {
  const uniq = (tag: string) => `${tag}-${uuid()}@example.com`;
  const PASSWORD = 'password1234';

  let app: INestApplication;
  let ds: DataSource;

  let userRepo: Repository<User>;
  let postRepo: Repository<Post>;
  let statsRepo: Repository<PostStats>;
  let fileRepo: Repository<File>;
  let commentRepo: Repository<Comment>;

  let token: string;
  let sharedUser: User;

  const newPost = async (over: Partial<Post> = {}) =>
    postRepo.save({ title: 't', content: 'c', author: sharedUser, ...over });

  const authGet = (url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
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
        TypeOrmModule.forFeature([User, Post, PostStats, File, Comment, Like]),
        AuthModule,
        PostModule,
        CommentModule,
      ],
    }).compile();

    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    ds = mod.get(DataSource);
    userRepo = ds.getRepository(User);
    postRepo = ds.getRepository(Post);
    statsRepo = ds.getRepository(PostStats);
    fileRepo = ds.getRepository(File);
    commentRepo = ds.getRepository(Comment);

    const email = uniq('shared');
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password: PASSWORD, name: 'shared', nickname: 'sh' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    token = login.body.accessToken;
    sharedUser = await userRepo.findOneByOrFail({ email });
  });

  afterEach(async () => {
    await fileRepo.delete({});
    await commentRepo.delete({});
    await statsRepo.delete({});
    await postRepo.delete({});
  });

  afterAll(async () => {
    await userRepo.delete(sharedUser!.id);
    await app.close();
  });

  it('✅ 게시글 정상 조회', async () => {
    const post  = await newPost();
    await statsRepo.save({ post, viewCount: 5, likeCount: 0, commentCount: 0 });

    const res = await authGet(`/post/${post.id}`).expect(200);

    expect(res.body.id).toBe(post.id);
    expect(res.body.stats.viewCount).toBe(6);   // +1
  });

  it('❌ 작성자가 삭제된 게시글 → 404', async () => {
    const ghost = await userRepo.save({
      email: uniq('ghost'),
      password: PASSWORD,
      name: 'g',
      nickname: 'gg',
      isDeleted: true,
    });
    const post = await postRepo.save({ title: 't', content: 'c', author: ghost });
    await statsRepo.save({ post });

    await authGet(`/post/${post.id}`).expect(404);
  });

  it('❌ 삭제된 게시글 → 404', async () => {
    const post = await newPost({ isDeleted: true });
    await authGet(`/post/${post.id}`).expect(404);
  });

  it('❌ 통계 정보 없음 → 500', async () => {
    const post = await newPost();
    await authGet(`/post/${post.id}`).expect(500);
  });

  it('✅ 파일 포함 게시글', async () => {
    const post = await newPost();
    await statsRepo.save({ post });
    await fileRepo.save({
      url: 'https://a.com/a.jpg',
      originalName: 'a.jpg',
      mimeType: 'image/jpeg',
      size: 10,
      post,
    });

    const res = await authGet(`/post/${post.id}`).expect(200);
    expect(res.body.files.length).toBe(1);
    expect(res.body.files[0].url).toBe('https://a.com/a.jpg');
  });

  it('✅ 댓글 + 대댓글 트리 (작성자 정상)', async () => {
    const post = await newPost();
    await statsRepo.save({ post });

    const parent = await commentRepo.save({ content: '부모', author: sharedUser, post });
    await commentRepo.save({ content: '자식', author: sharedUser, post, parent });

    const res = await authGet(`/post/${post.id}`).expect(200);
    expect(res.body.comments.length).toBe(1);
    expect(res.body.comments[0].children.length).toBe(1);
  });

  it('❌ 댓글 작성자 삭제 → 댓글 제외', async () => {
    const ghost = await userRepo.save({
      email: uniq('c-ghost'),
      password: PASSWORD,
      name: 'g',
      nickname: 'gg',
      isDeleted: true,
    });
    const post = await newPost();
    await statsRepo.save({ post });

    await commentRepo.save({ content: '고스트댓글', author: ghost, post });

    const res = await authGet(`/post/${post.id}`).expect(200);
    expect(res.body.comments.length).toBe(0);
  });

  it('❌ 존재하지 않는 ID → 404', async () => {
    await authGet('/post/999999999').expect(404);
  });
});

describe('PostController DELETE /post/:postId', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let accessToken: string;
  let user: User;

  const testUser = {
    email: `delete-e2e-${Date.now()}@example.com`,
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
    userRepository = dataSource.getRepository(User);
    postRepository = dataSource.getRepository(Post);

    await request(app.getHttpServer()).post('/auth/signup').send(testUser);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    accessToken = res.body.accessToken;
    user = await userRepository.findOneByOrFail({ email: testUser.email });
  });

  afterAll(async () => {
    const postRepository = dataSource.getRepository(Post);
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

    await request(app.getHttpServer())
      .delete(`/post/${post.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect({ message: '게시글이 삭제되었습니다.' });
    
    const deletedPost = await postRepository.findOneByOrFail({ id: post.id });
    expect(deletedPost.isDeleted).toBe(true);
  });

  it('❌ 작성자가 아닌 경우 삭제 불가', async () => {
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

    await request(app.getHttpServer())
      .delete(`/post/${post.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
      
    await postRepository.delete({ id: post.id });
    await userRepository.delete({ email: otherUser.email });
  });

  it('❌ 게시글이 존재하지 않으면 404 반환', async () => {
    await request(app.getHttpServer())
      .delete('/post/999999999')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('❌ 이미 삭제된 게시글에 대해서 404 반환', async () => {
    const post = await postRepository.save({
      title: '제목',
      content: '본문',
      author: user,
      isDeleted: true,
    });

    await request(app.getHttpServer())
      .delete(`/post/${post.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('❌ accessToken 없음', async () => {
    const post = await postRepository.save({
      title: '제목',
      content: '본문',
      author: user,
    });

    await request(app.getHttpServer())
      .delete(`/post/${post.id}`)
      .expect(401);
  });

  it('❌ 잘못된 accessToken', async () => {
    const post = await postRepository.save({
      title: '제목',
      content: '본문',
      author: user,
    });

    await request(app.getHttpServer())
      .delete(`/post/${post.id}`)
      .set('Authorization', 'Bearer invalid.token.here')
      .expect(401);
  });

  it('❌ 삭제된 유저', async () => {
    await userRepository.update(user.id, { isDeleted: true });

    const post = await postRepository.save({
      title: '삭제된 유저 게시글',
      content: '본문입니다.',
      author: user,
    });

    await request(app.getHttpServer())
      .delete(`/post/${post.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
    await userRepository.update(user.id, { isDeleted: false });
  });
});

describe('PostController PATCH /post/:postId', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let postRepo: Repository<Post>;
  let fileRepo: Repository<File>;
  let token: string;
  let user: User;

  const testUser = {
    email: `update-e2e-${Date.now()}@example.com`,
    password: 'password1234',
    name: '수정자',
    nickname: '업데이터',
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
          entities: [User, Post, File, PostStats],
        }),
        TypeOrmModule.forFeature([User, Post, File, PostStats]),
        AuthModule,
        PostModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepo = dataSource.getRepository(User);
    postRepo = dataSource.getRepository(Post);
    fileRepo = dataSource.getRepository(File);

    await request(app.getHttpServer()).post('/auth/signup').send(testUser);
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    token = loginRes.body.accessToken;
    user = await userRepo.findOneByOrFail({ email: testUser.email });
  });

  afterEach(async () => {
    await fileRepo.delete({});
    await postRepo.delete({});
  });

  afterAll(async () => {
    await userRepo.delete(user.id);
    await app.close();
  });

  it('✅ 정상 수정', async () => {
    const post = await postRepo.save({ title: '기존 제목', content: '기존 내용', author: user });

    await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '수정된 제목',
        content: '수정된 내용',
        files: [],
      })
      .expect(200);
  });

  it('❌ 게시글 없음 → 404', async () => {
    await request(app.getHttpServer())
      .patch('/post/9999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '무제', content: '내용', files: [] })
      .expect(404);
  });

  it('❌ 다른 유저의 게시글 → 404', async () => {
    const other = await userRepo.save({ email: 'other@test.com', password: '1234', name: 'o', nickname: 'oo' });
    const post = await postRepo.save({ title: 't', content: 'c', author: other });

    await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '변경', content: '변경', files: [] })
      .expect(404);
  });

  it('❌ 삭제된 게시글 → 404', async () => {
    const post = await postRepo.save({ title: '삭제된', content: 'c', author: user, isDeleted: true });

    await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '변경', content: '변경', files: [] })
      .expect(404);
  });

  it('❌ 파일 11개 → 400', async () => {
    const post = await postRepo.save({ title: 't', content: 'c', author: user });

    const files = Array.from({ length: 11 }).map((_, i) => ({
      url: `https://f.com/${i}`,
      originalName: `file${i}.jpg`,
      mimeType: 'image/jpeg',
      size: 100,
    }));

    await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '제목', content: '내용', files })
      .expect(400);
  });

  it('❌ title이 빈 문자열 → 400 + 에러 메시지 확인', async () => {
    const post = await postRepo.save({ title: 't', content: 'c', author: user });

    const res = await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '', content: '내용', files: [] })
      .expect(400);

    expect(res.body.message).toContain('제목은 1자 이상이어야 합니다.');
  });

  it('❌ content가 빈 문자열 → 400 + 에러 메시지 확인', async () => {
    const post = await postRepo.save({ title: 't', content: 'c', author: user });

    const res = await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '제목', content: '', files: [] })
      .expect(400);

    expect(res.body.message).toContain('내용은 1자 이상이어야 합니다.');
  });

  it('❌ files가 배열이 아님 → 400', async () => {
    const post = await postRepo.save({ title: 't', content: 'c', author: user });

    await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '제목', content: '본문', files: {} })
      .expect(400);
  });

  it('❌ files 내부가 비정상 객체 → 400', async () => {
    const post = await postRepo.save({ title: 't', content: 'c', author: user });

    await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '제목', content: '본문', files: [{ url: 123 }] })
      .expect(400);
  });

  it('❌ 파일 필드 누락 → 400', async () => {
    const post = await postRepo.save({ title: 't', content: 'c', author: user });

    await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '제목',
        content: '본문',
        files: [{ url: 'https://example.com/image.jpg' }],
      })
      .expect(400);
  });

  it('❌ size에 문자열 전달 → 400', async () => {
    const post = await postRepo.save({ title: 't', content: 'c', author: user });

    await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '제목',
        content: '본문',
        files: [
          {
            url: 'https://example.com/image.jpg',
            originalName: 'image.jpg',
            mimeType: 'image/jpeg',
            size: '100KB',
          },
        ],
      })
      .expect(400);
  });

  it('❌ content가 숫자일 경우 → 400', async () => {
    const post = await postRepo.save({ title: 't', content: 'c', author: user });

    await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '제목', content: 1234 })
      .expect(400);
  });

  it('❌ title에 XSS 스크립트 → 저장 실패해야 함', async () => {
    const post = await postRepo.save({ title: 't', content: 'c', author: user });

    const res = await request(app.getHttpServer())
      .patch(`/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '<script>alert(1)</script>',
        content: '스크립트 테스트',
        files: [],
      })
      .expect(400);

    expect(res.body.message).toContain('스크립트 태그는 사용할 수 없습니다.');
  });
});
