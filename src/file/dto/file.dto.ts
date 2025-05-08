import { IsString, IsOptional, IsNumber, IsIn, Min } from 'class-validator';

export const ALLOWED_MIME_TYPES = [
  // 이미지
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',

  // 문서
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // 압축
  'application/zip',
];

export class FileDto {
  @IsString({ message: '파일 URL은 문자열이어야 합니다.' })
  url: string;

  @IsString({ message: '파일의 원본 이름(originalName)은 문자열이어야 합니다.' })
  originalName: string;

  @IsString({ message: '파일의 MIME 타입은 문자열이어야 합니다.' })
  @IsIn(ALLOWED_MIME_TYPES, {
    message: '허용되지 않은 MIME 타입입니다.',
  })
  mimeType: string;

  @IsOptional()
  @IsNumber({}, { message: '파일의 크기(size)는 숫자여야 합니다.' })
  @Min(0, { message: '파일의 크기(size)는 0 이상이어야 합니다.' })
  size?: number;
}