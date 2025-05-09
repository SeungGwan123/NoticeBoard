import { Expose, Type } from 'class-transformer';
import { FileDto } from '../../file/dto/file.dto';
import { PostStatsDto } from './post-stats.dto';
import { NestedCommentDto } from '../../comment/dto/comment.dto';

export class AuthorDto {
  @Expose()
  id: string;

  @Expose()
  nickname: string;
}

export class GetPostResponseDto {
  @Expose()
  id: number;

  @Expose()
  title: string;

  @Expose()
  content: string;

  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => AuthorDto)
  author: AuthorDto;

  @Expose()
  @Type(() => FileDto)
  files: FileDto[];

  @Expose()
  @Type(() => PostStatsDto)
  stats: PostStatsDto;

  @Expose()
  @Type(() => NestedCommentDto)
  comments: NestedCommentDto[];
}
