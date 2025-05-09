import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from './entities/like.entity';
import { Post } from '../post/entities/post.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class LikeService {
  constructor(
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,

    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async likePost(userId: string, postId: number): Promise<{ message: string }> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.isDeleted) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const existingLike = await this.likeRepository.findOne({
      where: { user: { id: userId }, post: { id: postId } },
    });
    if (existingLike) {
      throw new ForbiddenException('이미 좋아요를 누른 게시글입니다.');
    }

    const like = this.likeRepository.create({
      user,
      post,
    });
    await this.likeRepository.save(like);

    return { message: '게시글 좋아요 등록 성공' };
  }

  async unlikePost(userId: string, postId: number): Promise<{ message: string }> {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.isDeleted) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const existingLike = await this.likeRepository.findOne({
      where: { user: { id: userId }, post: { id: postId } },
    });
    if (!existingLike) {
      throw new NotFoundException('좋아요가 등록되지 않은 게시글입니다.');
    }

    await this.likeRepository.remove(existingLike);

    return { message: '게시글 좋아요 삭제 성공' };
  }
}
