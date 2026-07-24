import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
    res.setHeader('x-request-id', req.requestId);
    next();
  }
}
