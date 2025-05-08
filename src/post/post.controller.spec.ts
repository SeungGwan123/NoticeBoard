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
          entities: [User, Post, Comment, Like, File],
        }),
        AuthModule,
        UserModule,
        PostModule,
        FileModule,
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
    await postRepository.delete({ author: { id: user.id } });
    await userRepository.delete({ email: testUser.email });

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
      .expect(404);
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
