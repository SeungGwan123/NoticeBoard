import { Column, Entity, In, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Post } from "./post.entity";

@Index('idx_like_count_post_id', ['likeCount', 'post'])
@Entity()
export class PostStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn()
  post: Post;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  likeCount: number;

  @Column({ default: 0 })
  commentCount: number;
}
