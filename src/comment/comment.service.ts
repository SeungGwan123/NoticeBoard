import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../post/entities/post.entity';
import { User } from '../user/entities/user.entity';
import { PostStats } from '../post/entities/post-stats.entity'; // ← PostStats import 추가

@Injectable()
export class CommentService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,

    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(PostStats)
    private readonly postStatsRepository: Repository<PostStats>, // ← 추가
  ) {}

  async create({
    content,
    postId,
    parentId,
    authorId,
  }: {
    content: string;
    postId: number;
    parentId?: number;
    authorId: string;
  }): Promise<{ message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const author = await queryRunner.manager.findOneByOrFail(User, { id: authorId });

      const post = await queryRunner.manager.findOneBy(Post, { id: postId });
      if (!post || post.isDeleted) {
        throw new NotFoundException('게시물이 존재하지 않습니다.');
      }

      let parent: Comment | null = null;
      if (parentId) {
        parent = await queryRunner.manager.findOne(Comment, {
          where: { id: parentId },
          relations: ['post'],
        });

        if (!parent) throw new NotFoundException('부모 댓글이 존재하지 않습니다.');
        if (parent.isDeleted) throw new BadRequestException('삭제된 댓글에는 답글을 작성할 수 없습니다.');
        if (parent.post.id !== post.id) {
          throw new BadRequestException('부모 댓글과 게시물이 일치하지 않습니다.');
        }
      }

      const newComment = this.commentRepository.create({
        content,
        post,
        author,
        parent: parent ?? undefined,
        isDeleted: false,
      });

      await queryRunner.manager.save(newComment);

      await queryRunner.manager.increment(PostStats, { post: { id: post.id } }, 'commentCount', 1);

      await queryRunner.commitTransaction();
      return { message: '댓글이 등록되었습니다.' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async delete(commentId: number, userId: string): Promise<{ message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOneBy(User, { id: userId });
      if (!user || user.isDeleted) {
        throw new UnauthorizedException('존재하지 않는 사용자입니다.');
      }

      const comment = await queryRunner.manager.findOne(Comment, {
        where: { id: commentId },
        relations: ['author', 'post'],
      });

      if (!comment || comment.isDeleted) {
        throw new NotFoundException('댓글이 존재하지 않습니다.');
      }

      if (comment.author.id !== userId) {
        throw new ForbiddenException('삭제 권한이 없습니다.');
      }

      const result = await queryRunner.manager.update(Comment, commentId, {
        isDeleted: true,
      });

      if (result.affected === 0) {
        throw new InternalServerErrorException('댓글 삭제에 실패했습니다.');
      }

      await queryRunner.manager.decrement(PostStats, { post: { id: comment.post.id } }, 'commentCount', 1);

      await queryRunner.commitTransaction();
      return { message: '댓글이 삭제되었습니다.' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
