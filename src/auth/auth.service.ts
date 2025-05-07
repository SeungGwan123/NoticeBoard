import { BadRequestException, Injectable } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async signUp(signupDto: SignupDto): Promise<{ message: string }> {
    const { email, password, name, nickname } = signupDto;

    const isExist = await this.userRepository.findOne({ where: { email } });
    if (isExist) {
      if (!isExist.isDeleted) {
        throw new BadRequestException('이미 사용 중인 이메일입니다.');
      }
      isExist.isDeleted = false;
      await this.userRepository.save(isExist);
      return {
        message: '회원가입이 성공적으로 진행되었습니다',
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      nickname,
    });

    await this.userRepository.save(user);

    return {
      message: '회원가입이 성공적으로 진행되었습니다',
    };
  }
}
