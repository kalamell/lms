/**
 * Authentication Middleware
 */

/**
 * Check if user is authenticated
 * Redirects to login if not authenticated
 */
export const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    // Make user available in all views
    res.locals.user = req.session.user;
    next();
  } else {
    res.redirect('/login');
  }
};

/**
 * Check if user is authenticated (API version)
 * Returns 401 if not authenticated
 */
export const requireAuthApi = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized', message: 'Please login to access this resource' });
  }
};

/**
 * Check if user has specific role
 * @param {string|Array} roles - Required role(s)
 */
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }

    const userRole = req.session.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (allowedRoles.includes(userRole)) {
      next();
    } else {
      res.status(403).render('errors/403', {
        pageTitle: 'Access Denied',
        message: 'You do not have permission to access this page'
      });
    }
  };
};

/**
 * Redirect if already authenticated
 * For login/register pages
 */
export const redirectIfAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    res.redirect('/dashboard');
  } else {
    next();
  }
};

/**
 * Make user available in all views (global middleware)
 */
export const setUserLocals = (req, res, next) => {
  res.locals.user = req.session ? req.session.user : null;
  res.locals.query = req.query || {};
  next();
};

export default {
  requireAuth,
  requireAuthApi,
  requireRole,
  redirectIfAuthenticated,
  setUserLocals
};
