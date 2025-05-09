import { Controller, Post, Body, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AccessTokenGuard } from '../common/guard/access-token.guard';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@UseGuards(AccessTokenGuard)
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @ApiOperation({ summary: '댓글 생성' })
  @ApiResponse({ status: 201, description: '댓글이 생성되었습니다.' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiBearerAuth()
  create(
    @Req() req: Request,
    @Body() dto: CreateCommentDto,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.commentService.create({ ...dto, authorId: userId });
  }

  @Delete(':commentId')
  @ApiOperation({ summary: '댓글 삭제' })
  @ApiResponse({ status: 200, description: '댓글이 삭제되었습니다.' })
  @ApiResponse({ status: 403, description: '삭제 권한이 없음' })
  @ApiResponse({ status: 404, description: '댓글 또는 게시물이 존재하지 않음' })
  @ApiBearerAuth()
  deleteComment(
    @Param('commentId') commentId: number,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.commentService.delete(commentId, userId);
  }
}
