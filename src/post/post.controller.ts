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
  ParseIntPipe,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { AccessTokenGuard } from '../common/guard/access-token.guard';
import { GetPostResponseDto } from './dto/get-post-response.dto';

@UseGuards(AccessTokenGuard)
@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  createPost(
    @Req() req: Request,
    @Body() createPostDto: CreatePostDto,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.postService.createPost(userId, createPostDto);
  }

  @Get(':postId')
  getPost(
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<GetPostResponseDto> {
    return this.postService.getPostById(postId);
  }

  @Patch(':postId')
  updatePost(
    @Req() req: Request,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() updatePostDto: CreatePostDto,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.postService.updatePost(userId, postId, updatePostDto);
  }

  @Delete(':postId')
  async deletePost(
    @Req() req: Request,
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    await this.postService.deletePost(userId, postId);
    return { message: '게시글이 삭제되었습니다.' };
  }
}
