import { InjectRepository } from '@nestjs/typeorm';
import { PostStats } from '../post/entities/post-stats.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Post } from './entities/post.entity';
import { User } from '../user/entities/user.entity';
import { Repository, DataSource } from 'typeorm';
import { File } from '../file/entities/file.entity';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,

    @InjectRepository(PostStats)
    private readonly postStatsRepository: Repository<PostStats>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,
  ) {}

  async createPost(
    userId: string,
    dto: CreatePostDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || user.isDeleted) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    const files = dto.files ?? [];
    if (files.length > 10) {
      throw new BadRequestException('파일은 최대 10개까지 첨부할 수 있습니다.');
    }

    const fileEntities: File[] = files.map((file) =>
      this.postRepository.manager.create(File, {
        url: file.url,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size != null && file.size >= 0 ? file.size : 0,
      }),
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const post = queryRunner.manager.create(Post, {
        title: dto.title,
        content: dto.content,
        author: user,
        isDeleted: false,
        files: fileEntities,
      });

      const savedPost = await queryRunner.manager.save(Post, post);

      const stats = queryRunner.manager.create(PostStats, {
        post: savedPost,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      });

      await queryRunner.manager.save(PostStats, stats);

      await queryRunner.commitTransaction();
      return { message: '게시글이 등록되었습니다.' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('게시글 등록에 실패했습니다.');
    } finally {
      await queryRunner.release();
    }
  }
}
