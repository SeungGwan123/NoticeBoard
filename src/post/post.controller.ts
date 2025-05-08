import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { AccessTokenGuard } from '../common/guard/access-token.guard';

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
}
