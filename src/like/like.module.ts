import { Module } from '@nestjs/common';
import { LikeService } from './like.service';
import { LikeController } from './like.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Like } from './entities/like.entity';
import { Post } from '../post/entities/post.entity';
import { User } from '../user/entities/user.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([Like, Post, User]), CommonModule],
  controllers: [LikeController],
  providers: [LikeService],
})
export class LikeModule {}
