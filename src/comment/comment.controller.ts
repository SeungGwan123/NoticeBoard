import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AccessTokenGuard } from '../common/guard/access-token.guard';

@UseGuards(AccessTokenGuard)
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  create(
    @Req() req: Request,
    @Body() dto: CreateCommentDto,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.commentService.create({ ...dto, authorId: userId });
  }

  @Delete(':commentId')
  deleteComment(
    @Param('commentId') commentId: number,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.commentService.delete(commentId, userId);
  }
}
