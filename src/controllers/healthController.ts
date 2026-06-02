import { Request, Response } from 'express';

export const getHealth = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Servidor está funcionando',
    timestamp: new Date().toISOString(),
  });
};
