import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
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
}
