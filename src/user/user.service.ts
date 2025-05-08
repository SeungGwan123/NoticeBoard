import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Post } from 'post/entities/post.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly userRepository: Repository<User>,
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

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .select(['post.id', 'post.title'])
      .where('post.authorId = :userId', { userId })
      .andWhere('post.id > :lastPostId', { lastPostId: lastPostId ?? 0 })
      .andWhere('post.isDeleted = false')
      .orderBy('post.id', 'ASC')
      .limit(10);

    const posts = await queryBuilder.getMany();

    return {
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
      })),
    };
  }
}
