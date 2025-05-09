import {
  Controller,
  Post,
  Body,
  HttpCode,
  Res,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AccessTokenGuard } from '../common/guard/access-token.guard';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: '회원가입' })
  @ApiResponse({ status: 201, description: '회원가입 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  signUp(@Body() signupDto: SignupDto): Promise<{ message: string }> {
    return this.authService.signUp(signupDto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '로그인' })
  @ApiResponse({ status: 200, description: '로그인 성공', type: Object })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() loginDto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { accessToken, refreshToken } =
      await this.authService.login(loginDto);

    return { accessToken, refreshToken };
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: '로그아웃' })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  logout(@Req() req: Request): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.authService.logout(userId);
  }

  @Post('refresh-token')
  @HttpCode(200)
  @ApiOperation({ summary: '새로운 액세스 토큰 발급' })
  @ApiResponse({ status: 200, description: '새로운 액세스 토큰 발급 성공' })
  @ApiResponse({ status: 400, description: 'refreshToken이 존재하지 않습니다.' })
  refreshToken(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('refreshToken이 존재하지 않습니다.');
    }
    return this.authService.reissueToken(refreshToken);
  }
}
