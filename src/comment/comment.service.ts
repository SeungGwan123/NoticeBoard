import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { Repository } from 'typeorm';
import { Post } from '../post/entities/post.entity';
import { User } from '../user/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create({
    content,
    postId,
    parentId,
    authorId,
  }: {
    content: string;
    postId: number;
    parentId?: number;
    authorId: string;
  }): Promise<{ message: string }> {
    const author = await this.userRepository.findOneByOrFail({ id: authorId });
    let post: Post;
    try {
      post = await this.postRepository.findOneByOrFail({ id: postId });
      if (post.isDeleted) {
        throw new NotFoundException('게시물이 존재하지 않습니다.');
      }
    } catch (err) {
      throw new NotFoundException('게시물이 존재하지 않습니다.');
    }

    let parent: Comment | undefined | null = undefined;
    if (parentId) {
      parent = await this.commentRepository.findOne({
        where: { id: parentId },
        relations: ['post'],
      });

      if (!parent) {
        throw new NotFoundException('부모 댓글이 존재하지 않습니다.');
      }

      if (parent.isDeleted) {
        throw new BadRequestException('삭제된 댓글에는 답글을 작성할 수 없습니다.');
      }

      if (parent.post.id !== post.id) {
        throw new BadRequestException('부모 댓글과 게시물이 일치하지 않습니다.');
      }
    }

    const newComment = this.commentRepository.create({
      content,
      post,
      author,
      parent,
      isDeleted: false,
    });

    await this.commentRepository.save(newComment);

    return { message: '댓글이 등록되었습니다.' };
  }

  async delete(commentId: number, userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['author'],
    });

    if (!comment || comment.isDeleted) {
      throw new NotFoundException('댓글이 존재하지 않습니다.');
    }

    if (comment.author.id !== userId) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }

    const result = await this.commentRepository.update(commentId, { isDeleted: true });
    if (result.affected === 0) {
      throw new InternalServerErrorException('댓글 삭제에 실패했습니다.');
    }

    return { message: '댓글이 삭제되었습니다.' };
  }
}
