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
  Query,
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

  @Patch('me')
  updateMe(
    @Req() req: Request,
    @Body() updateUserDto: { name: string; nickname: string },
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.userService.updateMe(userId, updateUserDto);
  }

  @Get(':id')
  getUser(
    @Param('id') id: string,
  ): Promise<{ name: string; nickname: string }> {
    return this.userService.getUser(id);
  }

  @Delete('me')
  deleteMe(@Req() req: Request): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.userService.deleteMe(userId);
  }

  @Get('me/posts')
  getMyPosts(
    @Req() req: Request,
    @Query('cursor') lastPostId?: string,
  ): Promise<{ posts: { id: string; title: string }[] }> {
    const userId = req['user'].id;
    return this.userService.getMyPosts(userId, lastPostId);
  }
}
