import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty({
    description: '댓글 작성자의 ID',
    example: '1234',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: '댓글 작성자의 닉네임',
    example: 'testUser',
  })
  @Expose()
  nickname: string;
}

export class NestedCommentDto {
  @ApiProperty({
    description: '댓글 ID',
    example: 1,
  })
  @Expose()
  id: number;

  @ApiProperty({
    description: '댓글 내용',
    example: '이 게시글 정말 좋습니다!',
  })
  @Expose()
  content: string;

  @ApiProperty({
    description: '댓글 작성일',
    example: '2021-09-01T00:00:00Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: '부모 댓글 ID (없을 경우 null)',
    example: null,
  })
  @Expose()
  parentId: number | null;

  @ApiProperty({
    description: '댓글 작성자 정보',
    type: CommentAuthorDto,
  })
  @Expose()
  @Type(() => CommentAuthorDto)
  author: CommentAuthorDto;

  @ApiProperty({
    description: '하위 댓글들',
    type: [NestedCommentDto],
    isArray: true,
  })
  @Expose()
  @Type(() => NestedCommentDto)
  children: NestedCommentDto[];
}
