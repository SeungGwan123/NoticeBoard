import { Expose, Type } from 'class-transformer';
import { FileDto } from '../../file/dto/file.dto';
import { PostStatsDto } from './post-stats.dto';
import { NestedCommentDto } from '../../comment/dto/comment.dto';
import { ApiProperty } from '@nestjs/swagger';

export class AuthorDto {
  @ApiProperty({
    description: '작성자의 UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: '작성자의 닉네임',
    example: 'test_user',
  })
  @Expose()
  nickname: string;
}

export class GetPostResponseDto {
  @ApiProperty({
    description: '게시글 ID',
    example: '123000',
  })
  @Expose()
  id: number;

  @ApiProperty({
    description: '게시글 제목',
    example: '제목을 입력하세요',
  })
  @Expose()
  title: string;

  @ApiProperty({
    description: '게시글 내용',
    example: '게시글 내용을 입력하세요',
  })
  @Expose()
  content: string;

  @ApiProperty({
    description: '게시글 생성 날짜',
    example: '2021-01-01T00:00:00.000Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: '작성자 정보',
    type: AuthorDto,
  })
  @Expose()
  @Type(() => AuthorDto)
  author: AuthorDto;

  @ApiProperty({
    description: '게시글에 첨부된 파일들',
    type: [FileDto],
    required: false,
  })
  @Expose()
  @Type(() => FileDto)
  files: FileDto[];

  @ApiProperty({
    description: '게시글 통계 정보',
    type: PostStatsDto,
  })
  @Expose()
  @Type(() => PostStatsDto)
  stats: PostStatsDto;

  @ApiProperty({
    description: '댓글들',
    type: [NestedCommentDto],
  })
  @Expose()
  @Type(() => NestedCommentDto)
  comments: NestedCommentDto[];
}
