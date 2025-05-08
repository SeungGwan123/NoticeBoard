import { Module } from "@nestjs/common";
import { AccessTokenGuard } from "./guard/access-token.guard";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../user/entities/user.entity";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.ACCESS_TOKEN_SECRET,
      signOptions: { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN },
    }),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [AccessTokenGuard],
  exports: [AccessTokenGuard, JwtModule],
})
export class CommonModule {}