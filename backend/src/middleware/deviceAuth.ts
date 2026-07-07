import { Request, Response, NextFunction } from 'express';

// UUID v4-ish: 8-4-4-4-12 hex groups. Lenient on version bits — the goal is a
// well-formed opaque identifier, not strict RFC validation.
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      deviceId: string;
    }
  }
}

// Requires a well-formed X-Device-Id header on every request.
// This is anonymous identity, not authentication — it exists so usage limits
// and subscriptions can be tracked per install without user accounts.
export function deviceAuth(req: Request, res: Response, next: NextFunction): void {
  const deviceId = req.header('x-device-id');

  if (!deviceId || !DEVICE_ID_PATTERN.test(deviceId)) {
    res.status(401).json({
      error: 'Missing or invalid X-Device-Id header',
      code: 'DEVICE_ID_REQUIRED',
    });
    return;
  }

  req.deviceId = deviceId.toLowerCase();
  next();
}
