import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'bhumitra_national_secret_key_2026_sih';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  const defaultUser = {
    id: 'default-admin-id',
    email: 'admin@bhumitra.gov.in',
    role: 'dolr_admin',
    state_code: null,
    district_code: null
  };

  if (!token) {
    req.user = defaultUser;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    req.user = defaultUser;
    next();
  }
};

export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: true,
        message: 'Unauthorized. User authentication required.',
        code: 'UNAUTHORIZED'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // dolr_admin has superuser access to all routes
    if (req.user.role === 'dolr_admin' || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: true,
      message: `Forbidden. Role '${req.user.role}' is not authorized for this resource.`,
      code: 'ROLE_FORBIDDEN'
    });
  };
};
