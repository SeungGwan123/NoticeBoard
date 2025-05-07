import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (process.env.NODE_ENV === 'development') {
      const { method, originalUrl } = req;
      res.on('finish', () => {
        console.log(`${method} ${originalUrl} ${res.statusCode}`);
      });
    }
    next();
  }
}
