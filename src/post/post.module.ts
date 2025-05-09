import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../post/entities/post.entity';
import { PostStats } from './entities/post-stats.entity';
import { User } from '../user/entities/user.entity';
import { CommonModule } from '../common/common.module';
import { Comment } from '../comment/entities/comment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostStats, User, Comment]),
    CommonModule,
  ],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
