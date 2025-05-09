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
import { ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

@UseGuards(AccessTokenGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '내 정보 조회' })
  @ApiResponse({ status: 200, description: '내 정보 조회 성공' })
  @ApiResponse({ status: 401, description: '존재하지 않는 사용자' })
  @ApiBearerAuth()
  getMe(
    @Req() req: Request,
  ): Promise<{ email: string; name: string; nickname: string }> {
    const userId = req['user'].id;
    return this.userService.getMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: '내 정보 수정' })
  @ApiResponse({ status: 200, description: '내 정보 수정 성공' })
  @ApiResponse({ status: 400, description: '변경 사항이 없습니다.' })
  @ApiResponse({ status: 401, description: '존재하지 않는 사용자' })
  @ApiBearerAuth()
  updateMe(
    @Req() req: Request,
    @Body() updateUserDto: { name: string; nickname: string },
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.userService.updateMe(userId, updateUserDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '특정 사용자 조회' })
  @ApiResponse({ status: 200, description: '사용자 조회 성공' })
  @ApiResponse({ status: 404, description: '존재하지 않는 사용자' })
  @ApiBearerAuth()
  getUser(
    @Param('id') id: string,
  ): Promise<{ name: string; nickname: string }> {
    return this.userService.getUser(id);
  }

  @Delete('me')
  @ApiOperation({ summary: '내 정보 삭제' })
  @ApiResponse({ status: 200, description: '내 정보 삭제 성공' })
  @ApiResponse({ status: 401, description: '존재하지 않는 사용자' })
  @ApiBearerAuth()
  deleteMe(@Req() req: Request): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.userService.deleteMe(userId);
  }

  @Get('me/posts')
  @ApiOperation({ summary: '내 게시글 조회' })
  @ApiResponse({ status: 200, description: '게시글 조회 성공' })
  @ApiResponse({ status: 401, description: '존재하지 않는 사용자' })
  @ApiQuery({
    name: 'cursor',
    description: '게시글 조회의 커서',
    required: false,
  })
  @ApiBearerAuth()
  getMyPosts(
    @Req() req: Request,
    @Query('cursor') lastPostId?: number,
  ): Promise<{ posts: { id: number; title: string }[] }> {
    const userId = req['user'].id;
    return this.userService.getMyPosts(userId, lastPostId);
  }

  @Get('me/comments')
  @ApiOperation({ summary: '내 댓글 조회' })
  @ApiResponse({ status: 200, description: '댓글 조회 성공' })
  @ApiResponse({ status: 401, description: '존재하지 않는 사용자' })
  @ApiQuery({
    name: 'cursor',
    description: '게시글 조회의 커서',
    required: false,
  })
  @ApiBearerAuth()
  getMyComments(
    @Req() req: Request,
    @Query('cursor') lastCommentId?: number,
  ): Promise<{ comments: { id: number; content: string }[] }> {
    const userId = req['user'].id;
    return this.userService.getMyComments(userId, lastCommentId);
  }
}
