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
  Query,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { AccessTokenGuard } from '../common/guard/access-token.guard';
import { GetPostResponseDto } from './dto/get-post-response.dto';
import { ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

@UseGuards(AccessTokenGuard)
@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @ApiOperation({ summary: '게시글 생성' })
  @ApiResponse({ status: 201, description: '게시글 등록 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiBearerAuth()
  createPost(
    @Req() req: Request,
    @Body() createPostDto: CreatePostDto,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.postService.createPost(userId, createPostDto);
  }

  @Get(':postId')
  @ApiOperation({ summary: '게시글 조회' })
  @ApiResponse({ status: 200, description: '게시글 조회 성공', type: GetPostResponseDto })
  @ApiResponse({ status: 404, description: '게시글이 존재하지 않음' })
  @ApiBearerAuth()
  getPost(
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<GetPostResponseDto> {
    return this.postService.getPostById(postId);
  }

  @Patch(':postId')
  @ApiOperation({ summary: '게시글 수정' })
  @ApiResponse({ status: 200, description: '게시글 수정 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 404, description: '게시글이 존재하지 않음' })
  @ApiBearerAuth()
  updatePost(
    @Req() req: Request,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() updatePostDto: CreatePostDto,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    return this.postService.updatePost(userId, postId, updatePostDto);
  }

  @Delete(':postId')
  @ApiOperation({ summary: '게시글 삭제' })
  @ApiResponse({ status: 200, description: '게시글 삭제 성공' })
  @ApiResponse({ status: 404, description: '게시글이 존재하지 않음' })
  @ApiResponse({ status: 403, description: '삭제 권한이 없음' })
  @ApiBearerAuth()
  async deletePost(
    @Req() req: Request,
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<{ message: string }> {
    const userId = req['user'].id;
    await this.postService.deletePost(userId, postId);
    return { message: '게시글이 삭제되었습니다.' };
  }

  @Get('list/posts')
  @ApiOperation({ summary: '게시글 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '게시글 목록 조회 성공',
    type: [GetPostResponseDto],
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiQuery({
    name: 'cursor',
    description: '게시글 조회의 커서',
    required: false,
  })
  @ApiBearerAuth()
  getPosts(
    @Req() req: Request,
    @Query('cursor') cursor?: number,
    @Query('sortBy') sortBy: 'id' | 'like' = 'id',
  ): Promise<{ posts: { id: number; title: string; author: { id: string; name: string } }[] }> {
    const userId = req['user'].id;
    return this.postService.getPosts(userId, sortBy, cursor);
  }

  @Get('search')
  @ApiOperation({ summary: '게시글 검색' })
  @ApiResponse({
    status: 200,
    description: '게시글 검색 성공',
    type: [GetPostResponseDto],
  })
  @ApiResponse({ status: 400, description: '잘못된 검색 타입' })
  @ApiBearerAuth()
  searchPosts(
    @Query('query') query: string,
    @Query('type') type: 'title_data' | 'nickname',
  ) {
    if (!query) {
      throw new BadRequestException('검색어가 필요합니다.');
    }

    if (type === 'title_data') {
      return this.postService.searchByTitleOrContent(query);
    } else if (type === 'nickname') {
      return this.postService.searchByNickname(query);
    } else {
      throw new BadRequestException('잘못된 검색 타입입니다.');
    }
  }
}
