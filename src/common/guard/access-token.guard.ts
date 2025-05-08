import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access Token이 존재하지 않습니다.');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.ACCESS_TOKEN_SECRET,
      });

      const user = await this.userRepository.findOneBy({ id: payload.id });

      if (!user) {
        throw new UnauthorizedException('유효하지 않은 Access Token입니다.');
      }

      if (user.isDeleted) {
        throw new UnauthorizedException('존재하지 않는 사용자입니다.');
      }

      request['user'] = payload;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('유효하지 않은 Access Token입니다.');
    }
  }
}
