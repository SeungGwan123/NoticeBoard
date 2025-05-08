import {
  IsString,
  MinLength,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FileDto } from '../../file/dto/file.dto';

export class CreatePostDto {
  @Matches(/^[^<>]+$/, { message: '스크립트 태그는 사용할 수 없습니다.' })
  @IsString({ message: '제목은 문자열이어야 합니다.' })
  @MinLength(1, { message: '제목은 1자 이상이어야 합니다.' })
  title: string;

  @IsString({ message: '내용은 문자열이어야 합니다.' })
  @MinLength(1, { message: '내용은 1자 이상이어야 합니다.' })
  content: string;

  @IsOptional()
  @IsArray({ message: 'files는 배열이어야 합니다.' })
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  files: FileDto[];
}
