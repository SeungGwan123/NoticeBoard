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
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({
    description: '게시글 제목',
    example: '제목을 입력하세요',
  })
  @Matches(/^[^<>]+$/, { message: '스크립트 태그는 사용할 수 없습니다.' })
  @IsString({ message: '제목은 문자열이어야 합니다.' })
  @MinLength(1, { message: '제목은 1자 이상이어야 합니다.' })
  title: string;

  @ApiProperty({
    description: '게시글 내용',
    example: '게시글 내용을 입력하세요',
  })
  @IsString({ message: '내용은 문자열이어야 합니다.' })
  @MinLength(1, { message: '내용은 1자 이상이어야 합니다.' })
  content: string;

  @ApiProperty({
    description: '게시글에 첨부된 파일',
    type: [FileDto],
    example: [
      {
        url: 'file1.jpg',
        originalName: 'file1',
        mimeType: 'image/jpeg',
        size: 12345,
      },
      {
        url: 'file2.jpg',
        originalName: 'file2',
        mimeType: 'image/jpeg',
        size: 12345,
      },
    ],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'files는 배열이어야 합니다.' })
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  files: FileDto[];
}
