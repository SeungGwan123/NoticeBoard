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
import { PostStats } from '../post/entities/post-stats.entity';

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
          entities: [User, Post, Comment, Like, File, PostStats],
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

    await userRepository.update(user.id, { isDeleted: false });
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
          entities: [User, Post, Comment, Like, File, PostStats],
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

    await userRepository.update(user.id, { isDeleted: false });
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
          entities: [User, Post, Comment, Like, File, PostStats],
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
      .expect(404);

    expect(res.body.message).toBe('존재하지 않는 사용자입니다.');

    await userRepository.update(targetUser.id, { isDeleted: false });
  });

  it('❌ 존재하지 않는 UUID → 401 Unauthorized', async () => {
    const nonExistentId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const res = await request(app.getHttpServer())
      .get(`/user/${nonExistentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

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
          entities: [User, Post, Comment, Like, File, PostStats],
        }),
        TypeOrmModule.forFeature([User, Post, Comment, Like, File]),
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

describe('UserController GET me/posts', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let user: User;
  let accessToken: string;

  const testUser = {
    email: `posts-test-${Date.now()}@example.com`,
    password: 'testpassword123',
    name: '게시물테스트',
    nickname: '테스터',
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
          entities: [User, Post, Comment, Like, File, PostStats],
        }),
        TypeOrmModule.forFeature([User, Post, Comment, Like, File]),
        AuthModule,
        UserModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);
    postRepository = dataSource.getRepository(Post);

    await request(app.getHttpServer()).post('/auth/signup').send(testUser);
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    accessToken = loginRes.body.accessToken;
    user = await userRepository.findOneByOrFail({ email: testUser.email });

    const posts = Array.from({ length: 15 }, (_, i) =>
        postRepository.create({
            title: `테스트 게시물 ${i + 1}`,
            author: user,
            content: `테스트 게시물 ${i + 1}의 내용입니다.`,
            isDeleted: false,
        }),
    );
    await postRepository.save(posts);
  });

  afterAll(async () => {
    await postRepository.delete({ author: { id: user.id } });
    await userRepository.delete({ id: user.id });
    await app.close();
  });

  it('✅ 게시물 15개 등록 후 /user/me/posts 요청 → 최신순 10개 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/user/me/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.posts).toHaveLength(10);
    expect(res.body.posts[0].title).toBe('테스트 게시물 14');
    expect(res.body.posts[9].title).toBe('테스트 게시물 5');
  });

  it('✅ cursor 파라미터를 통해 이전 5개 조회', async () => {
    const cursor = (await postRepository.findOneByOrFail({ title: '테스트 게시물 6' })).id;

    const res = await request(app.getHttpServer())
      .get(`/user/me/posts?cursor=${cursor}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.posts).toHaveLength(5);
    expect(res.body.posts[0].title).toBe('테스트 게시물 5');
    expect(res.body.posts[4].title).toBe('테스트 게시물 1');
  });

  it('❌ 토큰 없이 요청 → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .get('/user/me/posts')
      .expect(401);

    expect(res.body.message).toContain("Access Token이 존재하지 않습니다.");
  });

  it('❌ 삭제된 유저 → 401 Unauthorized', async () => {
    await userRepository.update({ id: user.id }, { isDeleted: true });

    const res = await request(app.getHttpServer())
      .get('/user/me/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(res.body.message).toContain('존재하지 않는 사용자입니다.');

    await userRepository.update({ id: user.id }, { isDeleted: false });
  });

  it('❕ 존재하지 않는 cursor → 최신 게시물 반환', async () => {
    const res = await request(app.getHttpServer())
      .get(`/user/me/posts?cursor=999999`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.posts).toHaveLength(10);
    expect(res.body.posts[0].id).toBeGreaterThan(res.body.posts[res.body.posts.length - 1].id);
  });  

  it('❕ 게시물이 없는 사용자 → 빈 배열 반환', async () => {
    const email = `no-post-${Date.now()}@test.com`;

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: '12345678',
        name: '노포스트',
        nickname: '비어있음',
      })
      .expect(201);

    const token = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: '12345678' })
        .expect(200)
    ).body.accessToken;

    const res = await request(app.getHttpServer())
      .get('/user/me/posts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.posts).toHaveLength(0);

    const user = await userRepository.findOneByOrFail({ email });
    await userRepository.delete({ id: user.id });
  });
});

describe('UserController GET /user/me/comments', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let commentRepository: Repository<Comment>;
  let postRepository: Repository<Post>;
  let user: User;
  let accessToken: string;
  let post: Post;

  const testUser = {
    email: `comments-test-${Date.now()}@example.com`,
    password: 'testpassword123',
    name: '댓글테스트',
    nickname: '테스터',
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
        TypeOrmModule.forFeature([User, Post, Comment, Like, File]),
        AuthModule,
        UserModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);
    postRepository = dataSource.getRepository(Post);
    commentRepository = dataSource.getRepository(Comment);

    await request(app.getHttpServer()).post('/auth/signup').send(testUser);
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    accessToken = loginRes.body.accessToken;
    user = await userRepository.findOneByOrFail({ email: testUser.email });

    post = await postRepository.save({
      title: '댓글용 게시글',
      content: '댓글 테스트용입니다.',
      author: user,
      isDeleted: false,
    });

    const comments = Array.from({ length: 15 }, (_, i) =>
      commentRepository.create({
        content: `댓글 ${i + 1}`,
        post,
        author: user,
        isDeleted: false,
      }),
    );
    await commentRepository.save(comments);
  });

  afterAll(async () => {
    await commentRepository.delete({});
    await postRepository.delete({});
    await userRepository.delete({ id: user.id });
    await app.close();
  });

  it('✅ 댓글 15개 등록 후 /user/me/comments 요청 → 최신순 10개 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/user/me/comments')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.comments).toHaveLength(10);
    expect(res.body.comments[0].content).toBe('댓글 14');
    expect(res.body.comments[9].content).toBe('댓글 5');
  });

  it('✅ cursor 파라미터를 통해 이전 5개 조회', async () => {
    const cursor = (
      await commentRepository.findOneByOrFail({ content: '댓글 6' })
    ).id;

    const res = await request(app.getHttpServer())
      .get(`/user/me/comments?cursor=${cursor}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.comments).toHaveLength(5);
    expect(res.body.comments[0].content).toBe('댓글 5');
    expect(res.body.comments[4].content).toBe('댓글 1');
  });

  it('❌ 토큰 없이 요청 → 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .get('/user/me/comments')
      .expect(401);

    expect(res.body.message).toContain('Access Token이 존재하지 않습니다.');
  });

  it('❌ 다른 사용자의 댓글 ID를 cursor로 넘기면 → 무시하고 최신 댓글 반환', async () => {
    const otherUser = await userRepository.save({
      email: `other-${Date.now()}@test.com`,
      password: 'pass1234',
      name: '다른유저',
      nickname: '다유',
      isDeleted: false,
    });

    const otherPost = await postRepository.save({
      title: '다른 유저 글',
      content: '다른 글 내용',
      author: otherUser,
      isDeleted: false,
    });

    const otherComment = await commentRepository.save({
      content: '타 유저 댓글',
      author: otherUser,
      post: otherPost,
      isDeleted: false,
    });

    const res = await request(app.getHttpServer())
      .get(`/user/me/comments?cursor=${otherComment.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.comments).toHaveLength(10);
    expect(res.body.comments[0].content).toBe('댓글 14');
  });

  it('❕ cursor로 지정된 댓글이 삭제된 경우 → 무시하고 최신 댓글 반환', async () => {
    const deleted = await commentRepository.save({
      content: '삭제된 커서',
      author: user,
      post,
      isDeleted: true,
    });

    const res = await request(app.getHttpServer())
      .get(`/user/me/comments?cursor=${deleted.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.comments[0].content).toBe('댓글 14');
  });

  it('❌ 삭제된 유저 → 401 Unauthorized', async () => {
    await userRepository.update({ id: user.id }, { isDeleted: true });

    const res = await request(app.getHttpServer())
      .get('/user/me/comments')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(res.body.message).toContain('존재하지 않는 사용자입니다.');

    await userRepository.update({ id: user.id }, { isDeleted: false });
  });

  it('❕ 존재하지 않는 cursor → 최신 댓글 반환', async () => {
    const res = await request(app.getHttpServer())
      .get(`/user/me/comments?cursor=999999`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.comments).toHaveLength(10);
    expect(res.body.comments[0].id).toBeGreaterThan(res.body.comments[9].id);
  });

  it('❕ 댓글이 없는 사용자 → 빈 배열 반환', async () => {
    const email = `no-comment-${Date.now()}@test.com`;

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: '12345678',
        name: '노댓글',
        nickname: '비어있음',
      })
      .expect(201);

    const token = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: '12345678' })
        .expect(200)
    ).body.accessToken;

    const res = await request(app.getHttpServer())
      .get('/user/me/comments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.comments).toHaveLength(0);

    const user = await userRepository.findOneByOrFail({ email });
    await userRepository.delete({ id: user.id });
  });
});
