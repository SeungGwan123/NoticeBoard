import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Post } from '../../post/entities/post.entity';

@Entity()
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string; // S3 주소 등

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({ nullable: true })
  size: number;

  @ManyToOne(() => Post, (post) => post.files, { onDelete: 'CASCADE' })
  post: Post;

  @CreateDateColumn()
  createdAt: Date;
}
