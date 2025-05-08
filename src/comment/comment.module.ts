import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../post/entities/post.entity';
import { User } from '../user/entities/user.entity';
import { CommonModule } from '../common/common.module';
@Module({
  imports: [TypeOrmModule.forFeature([Comment, Post, User]), CommonModule],
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
