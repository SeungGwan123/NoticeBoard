import { InjectRepository } from '@nestjs/typeorm';
import { PostStats } from '../post/entities/post-stats.entity';
import { CreatePostDto } from './dto/create-post.dto';
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Post } from './entities/post.entity';
import { User } from '../user/entities/user.entity';
import { Repository, DataSource } from 'typeorm';
import { File } from '../file/entities/file.entity';
import { GetPostResponseDto } from './dto/get-post-response.dto';
import { NestedCommentDto } from '../comment/dto/comment.dto';
import { Comment } from '../comment/entities/comment.entity';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,

    @InjectRepository(PostStats)
    private readonly postStatsRepository: Repository<PostStats>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,

    private readonly dataSource: DataSource,
  ) {}

  async createPost(
    userId: string,
    dto: CreatePostDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || user.isDeleted) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    const files = dto.files ?? [];
    if (files.length > 10) {
      throw new BadRequestException('파일은 최대 10개까지 첨부할 수 있습니다.');
    }

    const fileEntities: File[] = files.map((file) =>
      this.postRepository.manager.create(File, {
        url: file.url,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size != null && file.size >= 0 ? file.size : 0,
      }),
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const post = queryRunner.manager.create(Post, {
        title: dto.title,
        content: dto.content,
        author: user,
        isDeleted: false,
        files: fileEntities,
      });

      const savedPost = await queryRunner.manager.save(Post, post);

      const stats = queryRunner.manager.create(PostStats, {
        post: savedPost,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      });

      await queryRunner.manager.save(PostStats, stats);

      await queryRunner.commitTransaction();
      return { message: '게시글이 등록되었습니다.' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('게시글 등록에 실패했습니다.');
    } finally {
      await queryRunner.release();
    }
  }

  async getPostById(postId: number): Promise<GetPostResponseDto> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['author', 'files'],
    });

    if (!post || post.isDeleted) {
      throw new NotFoundException('게시글이 존재하지 않습니다.');
    }
    if (!post.author || post.author.isDeleted) {
      throw new NotFoundException('게시글이 존재하지 않습니다.');
    }

    const stats = await this.postStatsRepository.findOneBy({ post: { id: post.id } });
    if (!stats) {
      throw new InternalServerErrorException('통계 정보가 없습니다.');
    }
    this.postStatsRepository.increment({ id: stats.id }, 'viewCount', 1);

    const rawComments = await this.commentRepository.find({
      where: { post: { id: post.id }, isDeleted: false },
      relations: ['author', 'parent'],
      order: { createdAt: 'ASC' },
    });

    const commentMap = new Map<number, NestedCommentDto>();
    const nested: NestedCommentDto[] = [];

    for (const c of rawComments) {
      if (!c.author || c.author.isDeleted) continue;

      const item: NestedCommentDto = {
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        parentId: c.parent?.id ?? null,
        author: { id: c.author.id, nickname: c.author.nickname },
        children: [],
      };

      commentMap.set(c.id, item);

      if (item.parentId === null) nested.push(item);
      else commentMap.get(item.parentId)?.children.push(item);
    }

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      createdAt: post.createdAt,
      author: { id: post.author.id, nickname: post.author.nickname },
      files: post.files.map(f => ({
        url: f.url,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
      })),
      stats: {
        postId: post.id,
        viewCount: stats.viewCount + 1,
        likeCount: stats.likeCount,
        commentCount: stats.commentCount,
      },
      comments: nested,
    };
  }

  async updatePost(
    userId: string,
    postId: number,
    dto: CreatePostDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || user.isDeleted) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['author', 'files'],
    });
    if (!post || post.isDeleted || post.author.id !== userId) {
      throw new NotFoundException('수정할 게시글이 존재하지 않습니다.');
    }

    const files = dto.files ?? [];
    if (files.length > 10) {
      throw new BadRequestException('파일은 최대 10개까지 첨부할 수 있습니다.');
    }

    const fileEntities = files.map((file) =>
      this.postRepository.manager.create(File, {
        url: file.url,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size != null && file.size >= 0 ? file.size : 0,
        post,
      }),
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      post.title = dto.title;
      post.content = dto.content;

      await queryRunner.manager.delete(File, { post: { id: post.id } });
      await queryRunner.manager.save(File, fileEntities);
      await queryRunner.manager.save(Post, post);

      await queryRunner.commitTransaction();
      return { message: '게시글이 수정되었습니다.' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('게시글 수정에 실패했습니다.');
    } finally {
      await queryRunner.release();
    }
  }

  async deletePost(userId: string, postId: number): Promise<void> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['author'],
    });

    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    if (post.author.id !== userId) {
      throw new UnauthorizedException('자신의 게시글만 삭제할 수 있습니다.');
    }

    if (post.isDeleted) {
      throw new NotFoundException('이미 삭제된 게시글입니다.');
    }

    post.isDeleted = true;
    await this.postRepository.save(post);
  }

  async getPosts(
    userId: string,
    sortBy: string,
    cursor?: number,
  ): Promise<{ posts: { id: number; title: string; author: { id: string; name: string } }[] }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    let effectiveCursor: number | null = null;

    if (cursor) {
      const isValid = await this.postRepository
        .createQueryBuilder('post')
        .where('post.authorId = :userId', { userId })
        .andWhere('post.isDeleted = false')
        .andWhere('post.id = :cursor', { cursor })
        .getCount();

      if (isValid > 0) {
        effectiveCursor = cursor;
      }
    }
    const postsQuery = this.postRepository
      .createQueryBuilder('post')
      .select(['post.id', 'post.title'])
      .addSelect(['author.id', 'author.name'])
      .innerJoin('post.author', 'author')
      .where('post.authorId = :userId', { userId })
      .andWhere('post.isDeleted = false');

    if (!effectiveCursor) {
      const maxPost = await this.postRepository
        .createQueryBuilder('post')
        .select('MAX(post.id)', 'max')
        .where('post.authorId = :userId', { userId })
        .andWhere('post.isDeleted = false')
        .getRawOne();

      if (!maxPost?.max) {
        return { posts: [] };
      }

      effectiveCursor = maxPost.max;
      postsQuery.andWhere('post.id <= :cursor', { cursor: effectiveCursor });
    }
    else {
      postsQuery.andWhere('post.id < :cursor', { cursor: effectiveCursor });
    }

    if (sortBy === 'like') {
      postsQuery
        .leftJoin('post.postStats', 'postStats')
        .addSelect('postStats.likeCount', 'likeCount')
        .orderBy('postStats.likeCount', 'DESC');
    } else {
      postsQuery.orderBy('post.id', 'DESC');
    }

    const posts = await postsQuery.limit(10).getMany();

    return {
      posts: posts.map((post) => ({
        id: Number(post.id),
        title: post.title,
        author: {
          id: post.author.id,
          name: post.author.name,
        },
      })),
    };
  }
}