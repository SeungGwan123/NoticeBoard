import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AccessTokenGuard } from '../common/guard/access-token.guard';

@UseGuards(AccessTokenGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(
    @Req() req: Request,
  ): Promise<{ email: string; name: string; nickname: string }> {
    const userId = req['user'].id;
    return this.userService.getMe(userId);
  }
}
