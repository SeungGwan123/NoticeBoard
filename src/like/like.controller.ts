import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { LikeService } from './like.service';
import { AccessTokenGuard } from 'src/common/guard/access-token.guard';

@UseGuards(AccessTokenGuard)
@Controller('like')
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @Post(':postId')
  likePost(@Param('postId') postId: number, @Req() req) {
    const userId = req['user'].id;
    return this.likeService.likePost(userId, postId);
  }

  @Delete(':postId')
  unlikePost(@Param('postId') postId: number, @Req() req) {
    const userId = req['user'].id;
    return this.likeService.unlikePost(userId, postId);
  }
}
