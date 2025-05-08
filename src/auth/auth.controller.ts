import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
  UseGuards,
  HttpCode,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AccessTokenGuard } from '../common/guard/access-token.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signUp(@Body() SignupDto: SignupDto): Promise<{ message: string }> {
    return this.authService.signUp(SignupDto);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() loginDto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { accessToken, refreshToken } =
      await this.authService.login(loginDto);

    // 배포환경에서 https통신이면 쿠키로 전송
    // res.cookie('refreshToken', refreshToken, {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: 'strict',
    //   path: '/auth/refresh-token',
    //   maxAge: Number(process.env.REFRESH_TOKEN_EXPIRES_NUMBER),
    // });

    return { accessToken, refreshToken };
  }

  @UseGuards(AccessTokenGuard)
  @HttpCode(200)
  @Post('logout')
  logout(@Req() req: Request): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.authService.logout(userId);
  }

  @Post('refresh-token')
  @HttpCode(200)
  refreshToken(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('refreshToken이 존재하지 않습니다.');
    }
    return this.authService.reissueToken(refreshToken);
  }
}
