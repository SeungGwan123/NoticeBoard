import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Post } from '../../post/entities/post.entity';

@Entity()
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;
  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({ nullable: true })
  size: number;

  @Index('idx_file_post_id', ['post'])
  @ManyToOne(() => Post, (post) => post.files, { onDelete: 'CASCADE' })
  post: Post;

  @CreateDateColumn()
  createdAt: Date;
}
