import { Expose, Type } from 'class-transformer';

export class CommentAuthorDto {
  @Expose()
  id: string;

  @Expose()
  nickname: string;
}

export class NestedCommentDto {
  @Expose()
  id: number;

  @Expose()
  content: string;

  @Expose()
  createdAt: Date;

  @Expose()
  parentId: number | null;

  @Expose()
  @Type(() => CommentAuthorDto)
  author: CommentAuthorDto;

  @Expose()
  @Type(() => NestedCommentDto)
  children: NestedCommentDto[];
}
