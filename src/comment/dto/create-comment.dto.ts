import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: '댓글 내용은 비어 있을 수 없습니다.' })
  content: string;

  @IsNumber()
  @IsNotEmpty({ message: 'postId는 필수입니다.' })
  @Type(() => Number)
  postId: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  parentId?: number;
}
