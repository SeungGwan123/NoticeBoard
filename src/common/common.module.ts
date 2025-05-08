import { Module } from "@nestjs/common";
import { AccessTokenGuard } from "./guard/access-token.guard";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.ACCESS_TOKEN_SECRET,
      signOptions: { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN },
    }),
  ],
  providers: [AccessTokenGuard],
  exports: [AccessTokenGuard, JwtModule],
})
export class CommonModule {}