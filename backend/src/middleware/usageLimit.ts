import { Request, Response, NextFunction } from 'express';
import { dailyLimits } from '../config';
import { isSubscriber } from '../services/entitlements';
import { consumeUsage, UsageCategory } from '../services/usageStore';

// Consumes one unit of `category` for the requesting device, enforcing the
// tier-appropriate daily cap. Responds 402 (Payment Required) when a free
// device is out of quota — the app shows the paywall on this code.
export function usageLimit(category: UsageCategory) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscribed = await isSubscriber(req.deviceId);
      const limits = dailyLimits(subscribed);
      const result = await consumeUsage(req.deviceId, category, limits[category]);

      res.locals.usage = {
        category,
        used: result.used,
        limit: result.limit,
        remaining: result.remaining,
        isSubscriber: subscribed,
      };

      if (!result.allowed) {
        res.status(402).json({
          error: subscribed
            ? 'Daily usage limit reached. Try again tomorrow.'
            : 'Free daily limit reached. Subscribe for unlimited discussions.',
          code: 'LIMIT_REACHED',
          usage: res.locals.usage,
        });
        return;
      }

      next();
    } catch (error) {
      // Usage tracking must never take the product down.
      console.error('Usage limit check failed (allowing request):', error);
      next();
    }
  };
}
