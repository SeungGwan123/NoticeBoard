import { IsEmail, IsString, Min, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
  email: string;

  @IsString({ message: '이름은 문자열이어야 합니다.' })
  name: string;

  @IsString({ message: '닉네임은 문자열이어야 합니다.' })
  @MinLength(2, { message: '닉네임은 최소 2자 이상이어야 합니다.' })
  nickname: string;

  @IsString({ message: '비밀번호는 문자열이어야 합니다.' })
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password: string;
}
