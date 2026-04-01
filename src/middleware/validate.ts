import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(422).json({
          error: 'Dados invalidos',
          details: err.issues.map((e) => ({
            field: (e.path as unknown[]).map(String).join('.'),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };
}
