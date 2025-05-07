import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(signupDto: SignupDto): Promise<{ message: string }> {
    const { email, password, name, nickname } = signupDto;

    try {
      const isExist = await this.userRepository.findOne({ where: { email } });
      if (isExist) {
        if (!isExist.isDeleted) {
          throw new BadRequestException('이미 사용 중인 이메일입니다.');
        }
        isExist.isDeleted = false;
        await this.userRepository.save(isExist);
        return { message: '회원가입이 성공적으로 진행되었습니다' };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = this.userRepository.create({ email, password: hashedPassword, name, nickname });
      await this.userRepository.save(user);

      return { message: '회원가입이 성공적으로 진행되었습니다' };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('회원가입 중 오류가 발생했습니다.');
    }
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = loginDto;

    try {
      const user = await this.userRepository.findOne({ where: { email } });
      if (!user || user.isDeleted) {
        throw new UnauthorizedException('이메일이 일치하지 않습니다.');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('비밀번호가 일치하지 않습니다.');
      }

      const payload = { id: user.id, email: user.email };
      const accessToken = this.jwtService.sign(payload, {
        secret: process.env.ACCESS_TOKEN_SECRET,
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
      });

      const refreshToken = this.jwtService.sign(payload, {
        secret: process.env.REFRESH_TOKEN_SECRET,
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
      });

      user.refreshToken = refreshToken;
      await this.userRepository.save(user);

      return { accessToken, refreshToken };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new InternalServerErrorException('로그인 중 오류가 발생했습니다.');
    }
  }

  async logout(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    if (user.refreshToken === null) {
      throw new BadRequestException('이미 로그아웃된 사용자입니다.');
    }

    try {
      user.refreshToken = null;
      await this.userRepository.save(user);
    } catch (e) {
      throw new InternalServerErrorException('로그아웃 처리 중 오류가 발생했습니다.');
    }
    return {
      message: '로그아웃이 완료되었습니다.',
    };
  }

  async reissueToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> 
  {
    let payload: any;
    const secret = process.env.REFRESH_TOKEN_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('환경변수에 REFRESH_TOKEN_SECRET이 없습니다.');
    }
    try {
      payload = jwt.verify(refreshToken, secret);
    } catch (e) {
      throw new UnauthorizedException('유효하지 않은 refreshToken입니다.');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.id },
    });

    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    if (user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('refreshToken이 일치하지 않습니다.');
    }

    const newPayload = { id: user.id, email: user.email };

    try {
      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: process.env.ACCESS_TOKEN_SECRET,
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
      });

      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: process.env.REFRESH_TOKEN_SECRET,
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
      });

      user.refreshToken = newRefreshToken;
      await this.userRepository.save(user);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (e) {
      throw new InternalServerErrorException('토큰 재발급 중 오류가 발생했습니다.');
    }
  }
}