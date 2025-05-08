import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { DataSource, Repository } from 'typeorm';

import { User } from '../user/entities/user.entity';
import { Post } from '../post/entities/post.entity';
import { Comment } from './entities/comment.entity';
import { CommentModule } from './comment.module';
import { AuthModule } from '../auth/auth.module';
import { File } from '../file/entities/file.entity';
import { Like } from '../like/entities/like.entity';

describe('CommentController POST /comment', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let commentRepository: Repository<Comment>;
  let accessToken: string;
  let post: Post;
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
          entities: [User, Post, Comment, File, Like],
        }),
        TypeOrmModule.forFeature([User, Post, Comment]),
        AuthModule,
        CommentModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);
    postRepository = dataSource.getRepository(Post);
    commentRepository = dataSource.getRepository(Comment);

    const timestamp = Date.now();
    const testEmail = `comment-${timestamp}@test.com`;

    await request(app.getHttpServer()).post('/auth/signup').send({
      email: testEmail,
      password: '12345678',
      name: '댓글러',
      nickname: '댓댓글',
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: '12345678' });

    accessToken = loginRes.body.accessToken;
    user = await userRepository.findOneByOrFail({ email: testEmail });

    post = await postRepository.save({
      title: '테스트 게시물',
      content: '본문',
      author: user,
      isDeleted: false,
    });
  });

  afterAll(async () => {
    await commentRepository.delete({});
    await postRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  it('✅ 부모 없는 댓글 정상 등록', async () => {
    const res = await request(app.getHttpServer())
      .post('/comment')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        postId: post.id,
        content: '부모 없는 댓글',
      })
      .expect(201);

    expect(res.body.message).toBe('댓글이 등록되었습니다.');
  });

  it('✅ 부모 있는 대댓글 등록', async () => {
    const localPost = await postRepository.save({
      title: '부모와 자식 공유 게시물',
      content: '본문',
      author: user,
      isDeleted: false,
    });

    const parent = await commentRepository.save({
      content: '부모 댓글',
      post: localPost,
      author: user,
      isDeleted: false,
    });

    const res = await request(app.getHttpServer())
      .post('/comment')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: '자식 댓글',
        postId: localPost.id,
        parentId: parent.id,
      })
      .expect(201);

    expect(res.body.message).toBe('댓글이 등록되었습니다.');
  });

  it('❌ 존재하지 않는 부모 댓글 → 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/comment')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        postId: post.id,
        content: '잘못된 부모',
        parentId: 9999999,
      })
      .expect(404);

    expect(res.body.message).toBe('부모 댓글이 존재하지 않습니다.');
  });

  it('❌ 삭제된 부모 댓글 → 400', async () => {
    const parent = await commentRepository.save({
      content: '삭제 댓글',
      post,
      author: user,
      isDeleted: true,
    });

    const res = await request(app.getHttpServer())
      .post('/comment')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        postId: post.id,
        content: '삭제된 댓글에 답글',
        parentId: parent.id,
      })
      .expect(400);

    expect(res.body.message).toBe('삭제된 댓글에는 답글을 작성할 수 없습니다.');
  });

  it('❌ 부모 댓글과 게시물 불일치 → 400', async () => {
    const otherPost = await postRepository.save({
      title: '다른 게시물',
      content: '다름',
      author: user,
      isDeleted: false,
    });

    const parent = await commentRepository.save({
      content: '부모 댓글',
      post: otherPost,
      author: user,
      isDeleted: false,
    });

    const res = await request(app.getHttpServer())
      .post('/comment')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        postId: post.id,
        content: '잘못된 부모와 글 관계',
        parentId: parent.id,
      })
      .expect(400);

    expect(res.body.message).toBe('부모 댓글과 게시물이 일치하지 않습니다.');
  });
});
