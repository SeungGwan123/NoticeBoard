import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Post } from '../post/entities/post.entity';
import { Comment } from '../comment/entities/comment.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,

    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async getMe(userId: string): Promise<{ email: string; name: string; nickname: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }
    return {
      email: user.email,
      name: user.name,
      nickname: user.nickname,
    };
  }

  async updateMe(
    userId: string,
    updateUserDto: { name: string; nickname: string },
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    if (
      user.name === updateUserDto.name &&
      user.nickname === updateUserDto.nickname
    ) {
      return { message: '변경 사항이 없습니다.' };
    }

    const result = await this.userRepository.update(userId, updateUserDto);
    if (result.affected === 0) {
      throw new InternalServerErrorException('사용자 정보 수정에 실패했습니다.');
    }

    return { message: '사용자 정보가 수정되었습니다.' };
  }

  async getUser(userId: string): Promise<{ name: string; nickname: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }
    return {
      name: user.name,
      nickname: user.nickname,
    };
  }

  async deleteMe(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    const result = await this.userRepository.update(userId, { isDeleted: true });
    if (result.affected === 0) {
      throw new InternalServerErrorException('사용자 삭제에 실패했습니다.');
    }
    return { message: '사용자 정보가 삭제되었습니다.' };
  }

  async getMyPosts(
    userId: string,
    lastPostId?: number,
  ): Promise<{ posts: { id: number; title: string }[] }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    let effectiveLastPostId: number | null = null;

    if (lastPostId) {
      const isValid = await this.postRepository
        .createQueryBuilder('post')
        .where('post.authorId = :userId', { userId })
        .andWhere('post.isDeleted = false')
        .andWhere('post.id = :lastPostId', { lastPostId })
        .getCount();
      if (isValid > 0) {
        effectiveLastPostId = lastPostId;
      }
    }

    if (!effectiveLastPostId) {
      const maxPost = await this.postRepository
        .createQueryBuilder('post')
        .select('MAX(post.id)', 'max')
        .where('post.authorId = :userId', { userId })
        .andWhere('post.isDeleted = false')
        .getRawOne();

      if (!maxPost?.max) {
        return { posts: [] };
      }

      effectiveLastPostId = maxPost.max;
    }

    const posts = await this.postRepository
      .createQueryBuilder('post')
      .select(['post.id', 'post.title'])
      .where('post.authorId = :userId', { userId })
      .andWhere('post.isDeleted = false')
      .andWhere('post.id < :lastPostId', { lastPostId: effectiveLastPostId })
      .orderBy('post.id', 'DESC')
      .limit(10)
      .getMany();

    return {
      posts: posts.map((post) => ({
        id: Number(post.id),
        title: post.title,
      })),
    };
  }

  async getMyComments(
    userId: string,
    lastCommentId?: number,
  ): Promise<{ comments: { id: number; content: string }[] }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    let effectiveLastCommentId: number | null = null;

    if (lastCommentId) {
      const isValid = await this.commentRepository
        .createQueryBuilder('comment')
        .where('comment.authorId = :userId', { userId })
        .andWhere('comment.isDeleted = false')
        .andWhere('comment.id = :lastCommentId', { lastCommentId })
        .getCount();

      if (isValid > 0) {
        effectiveLastCommentId = lastCommentId;
      }
    }

    if (!effectiveLastCommentId) {
      const maxComment = await this.commentRepository
        .createQueryBuilder('comment')
        .select('MAX(comment.id)', 'max')
        .where('comment.authorId = :userId', { userId })
        .andWhere('comment.isDeleted = false')
        .getRawOne();

      if (!maxComment?.max) {
        return { comments: [] };
      }

      effectiveLastCommentId = maxComment.max;
    }

    const comments = await this.commentRepository
      .createQueryBuilder('comment')
      .select(['comment.id AS id', 'comment.content AS content'])
      .where('comment.authorId = :userId', { userId })
      .andWhere('comment.isDeleted = false')
      .andWhere('comment.id < :lastCommentId', { lastCommentId: effectiveLastCommentId })
      .orderBy('comment.id', 'DESC')
      .limit(10)
      .getRawMany<{ id: number; content: string }>();

    return {
      comments: comments.map((comment) => ({
        id: Number(comment.id),
        content: comment.content,
      })),
    };
  }
}
