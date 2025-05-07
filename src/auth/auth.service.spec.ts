import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { Post } from '../post/entities/post.entity';
import { Like } from '../like/entities/like.entity';
import { Comment } from '../comment/entities/comment.entity';
import { File } from '../file/entities/file.entity';

let service: AuthService;
let userRepository: Repository<User>;
let dataSource: DataSource;

const timestamp = Date.now();
const testEmail = `test${timestamp}@example.com`;
const dto: SignupDto = {
  email: testEmail,
  password: '123456',
  name: '홍길동',
  nickname: `tester${timestamp}`,
};

beforeAll(async () => {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_TEST_PORT),
        username: process.env.DB_USERNAME,
        password: String(process.env.DB_PASSWORD),
        database: process.env.DB_TEST_DATABASE,
        synchronize: true,
        entities: [User, Post, Comment, Like, File],
      }),
      TypeOrmModule.forFeature([User]),
    ],
    providers: [AuthService],
  }).compile();

  service = module.get(AuthService);
  userRepository = module.get('UserRepository');
  dataSource = module.get(DataSource);
});

describe('AuthService signup', () => {
  afterAll(async () => {
    await userRepository.delete({ email: testEmail });
    await dataSource.destroy();
  });

  it('✅ 새로운 유저 가입 성공', async () => {
    const result = await service.signUp(dto);
    expect(result.message).toBe('회원가입이 성공적으로 진행되었습니다');

    const user = await userRepository.findOneBy({ email: dto.email });
    expect(user).toBeDefined();
    expect(user?.nickname).toBe(dto.nickname);
    expect(await bcrypt.compare(dto.password, user!.password)).toBe(true);
  });

  it('❌ 이미 존재하는 이메일로 가입 시 예외 발생 (isDeleted: false)', async () => {
    await expect(service.signUp(dto)).rejects.toThrow('이미 사용 중인 이메일입니다.');
  });

  it('✅ soft-delete 복구 (isDeleted: true)', async () => {
    // 삭제된 사용자로 만들기
    const user = await userRepository.findOneByOrFail({ email: dto.email });
    user.isDeleted = true;
    await userRepository.save(user);

    // 다시 가입 시 복구
    const result = await service.signUp(dto);
    expect(result.message).toBe('회원가입이 성공적으로 진행되었습니다');

    const restored = await userRepository.findOneByOrFail({ email: dto.email });
    expect(restored.isDeleted).toBe(false);
  });
});
