import geoip from 'geoip-lite';

const ALLOWED_COUNTRIES = ['KE'];

export function checkLocation(req, res, next) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket.remoteAddress || '';

  if (ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    console.warn('Local/dev IP detected — skipping geo check');
    return next();
  }

  const geo = geoip.lookup(ip);
  if (!geo) {
    return next();
  }

  if (!ALLOWED_COUNTRIES.includes(geo.country)) {
    return res.status(403).json({
      error: `Login blocked — unexpected location (${geo.country})`,
    });
  }

  req.userGeo = geo;
  next();
}
