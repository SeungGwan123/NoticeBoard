import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';

import { CommentService } from './comment.service';
import { User } from '../user/entities/user.entity';
import { Post } from '../post/entities/post.entity';
import { Comment } from '../comment/entities/comment.entity';
import { File } from '../file/entities/file.entity';
import { Like } from '../like/entities/like.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CommentService create', () => {
  let commentService: CommentService;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let commentRepository: Repository<Comment>;
  let user: User;
  let post: Post;

  const testUser = {
    email: `comment-${Date.now()}@test.com`,
    password: 'testpassword1234',
    name: '댓글작성자',
    nickname: '댓글러',
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
          entities: [User, Post, Comment, File, Like],
        }),
        TypeOrmModule.forFeature([Comment, Post, User]),
      ],
      providers: [CommentService],
    }).compile();

    commentService = module.get(CommentService);
    dataSource = module.get(DataSource);
    userRepository = dataSource.getRepository(User);
    postRepository = dataSource.getRepository(Post);
    commentRepository = dataSource.getRepository(Comment);

    user = await userRepository.save({ ...testUser, isDeleted: false });
    post = await postRepository.save({ title: '댓글 테스트용 글', content: '본문', author: user });
  });

  afterAll(async () => {
    await commentRepository.delete({});
    await postRepository.delete({});
    await userRepository.delete({ id: user.id });
    await dataSource.destroy();
  });

  it('✅ 부모 없는 댓글 등록', async () => {
    const res = await commentService.create({
      content: '최상위 댓글',
      postId: post.id,
      authorId: user.id,
    });

    expect(res.message).toBe('댓글이 등록되었습니다.');
  });

  it('✅ 부모 있는 대댓글 등록', async () => {
    const parent = await commentRepository.save({
      content: '부모 댓글',
      post,
      author: user,
      isDeleted: false,
    });

    const res = await commentService.create({
      content: '대댓글',
      postId: post.id,
      parentId: parent.id,
      authorId: user.id,
    });

    expect(res.message).toBe('댓글이 등록되었습니다.');
  });

  it('❌ 존재하지 않는 게시물', async () => {
    await expect(
      commentService.create({
        content: '유령 포스트',
        postId: 999999,
        authorId: user.id,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('❌ 삭제된 게시물', async () => {
    const deletedPost = await postRepository.save({ title: '삭제됨', content: '삭제', author: user, isDeleted: true });

    await expect(
      commentService.create({
        content: '삭제된 글 댓글',
        postId: deletedPost.id,
        authorId: user.id,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('❌ 존재하지 않는 부모 댓글', async () => {
    await expect(
      commentService.create({
        content: '대댓글 실패',
        postId: post.id,
        parentId: 999999,
        authorId: user.id,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('❌ 삭제된 부모 댓글', async () => {
    const deletedParent = await commentRepository.save({
      content: '삭제된 부모',
      post,
      author: user,
      isDeleted: true,
    });

    await expect(
      commentService.create({
        content: '삭제된 부모 댓글에 대댓글',
        postId: post.id,
        parentId: deletedParent.id,
        authorId: user.id,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('❌ 부모 댓글과 게시물이 다를 경우', async () => {
    const anotherPost = await postRepository.save({ title: '다른 글', content: '내용', author: user });
    const parent = await commentRepository.save({
      content: '다른 게시물 댓글',
      post: anotherPost,
      author: user,
      isDeleted: false,
    });

    await expect(
      commentService.create({
        content: '게시물 안 맞는 대댓글',
        postId: post.id,
        parentId: parent.id,
        authorId: user.id,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
