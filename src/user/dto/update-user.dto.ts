import { IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsString({ message: '이름은 문자열이어야 합니다.' })
  name: string;

  @IsString({ message: '닉네임은 문자열이어야 합니다.' })
  @MinLength(2, { message: '닉네임은 최소 2자 이상이어야 합니다.' })
  nickname: string;
}