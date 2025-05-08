import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { Post } from '../post/entities/post.entity';
import { Comment } from '../comment/entities/comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Post, Comment]), CommonModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [TypeOrmModule],
})
export class UserModule {}
