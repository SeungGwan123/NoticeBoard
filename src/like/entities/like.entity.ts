import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Post } from '../../post/entities/post.entity';

@Entity()
@Unique(['user', 'post'])
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.likes)
  user: User;

  @ManyToOne(() => Post, (post) => post.likes)
  post: Post;

  @CreateDateColumn()
  createdAt: Date;
}
