import rateLimit from 'express-rate-limit';
import logger from '../services/logger';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Muitas requisições enviadas deste IP, por favor, tente novamente após 15 minutos.',
  },
  handler: (req, res, next, options) => {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
      },
      `Rate limit excedido para o IP: ${req.ip}`
    );
    res.status(options.statusCode).send(options.message);
  },
});
