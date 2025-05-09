import { Controller, Post, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { LikeService } from './like.service';
import { AccessTokenGuard } from 'src/common/guard/access-token.guard';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@UseGuards(AccessTokenGuard)
@Controller('like')
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @Post(':postId')
  @ApiOperation({ summary: '게시글 좋아요' })
  @ApiResponse({ status: 201, description: '게시글 좋아요 등록 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiBearerAuth()
  likePost(@Param('postId') postId: number, @Req() req) {
    const userId = req['user'].id;
    return this.likeService.likePost(userId, postId);
  }

  @Delete(':postId')
  @ApiOperation({ summary: '게시글 좋아요 취소' })
  @ApiResponse({ status: 200, description: '게시글 좋아요 삭제 성공' })
  @ApiBearerAuth()
  unlikePost(@Param('postId') postId: number, @Req() req) {
    const userId = req['user'].id;
    return this.likeService.unlikePost(userId, postId);
  }
}
