import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({
    description: '댓글 내용',
    example: '이 게시글 정말 좋습니다!',
  })
  @IsString()
  @IsNotEmpty({ message: '댓글 내용은 비어 있을 수 없습니다.' })
  content: string;

  @ApiProperty({
    description: '게시글 ID',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty({ message: 'postId는 필수입니다.' })
  @Type(() => Number)
  postId: number;

  @ApiProperty({
    description: '부모 댓글 ID (옵션)',
    example: null,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  parentId?: number;
}
