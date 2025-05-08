import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { CommonModule } from '../common/common.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    UserModule, 
    CommonModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
