/**
 * Auth Controller
 * Handles authentication operations
 */
class AuthController {
  /**
   * Display login page
   */
  showLogin(req, res) {
    if (req.session && req.session.user) {
      return res.redirect('/dashboard');
    }
    res.render('login', { layout: false, error: null });
  }

  /**
   * Display login form page
   */
  showLoginForm(req, res) {
    if (req.session && req.session.user) {
      return res.redirect('/dashboard');
    }
    res.render('login-form', { layout: false, error: null });
  }

  /**
   * SSO Login - Lotuss
   */
  ssoLotuss(req, res) {
    req.session.user = {
      id: 1,
      name: 'Somchai Lotuss',
      email: 'somchai@lotuss.com',
      role: 'Student',
      organization: 'Lotuss',
      avatar: '/theme/assets/img/avatars/1.png',
      department: 'Store Operations',
      employeeId: 'LTS-001234'
    };

    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/dashboard');
    });
  }

  /**
   * SSO Login - Makro
   */
  ssoMakro(req, res) {
    req.session.user = {
      id: 2,
      name: 'Nattaya Makro',
      email: 'nattaya@makro.com',
      role: 'Manager',
      organization: 'Makro',
      avatar: '/theme/assets/img/avatars/2.png',
      department: 'Warehouse',
      employeeId: 'MKR-005678'
    };

    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/dashboard');
    });
  }

  /**
   * Form Login - Makro
   */
  loginMakro(req, res) {
    const { username, password } = req.body;

    if (username && password) {
      req.session.user = {
        id: 2,
        name: username,
        email: `${username}@makro.com`,
        role: 'Employee',
        organization: 'Makro',
        avatar: '/theme/assets/img/avatars/2.png',
        department: 'Warehouse',
        employeeId: `MKR-${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`
      };

      req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        res.redirect('/dashboard');
      });
    } else {
      res.render('login', { layout: false, error: 'Please enter username and password' });
    }
  }

  /**
   * Form Login - General
   */
  login(req, res) {
    const { email, password } = req.body;

    if (email && password) {
      req.session.user = {
        id: 3,
        name: email.split('@')[0] || 'User',
        email: email,
        role: 'Student',
        organization: 'iLearn',
        avatar: '/theme/assets/img/avatars/3.png',
        department: 'General',
        employeeId: 'ILN-000001'
      };

      req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        res.redirect('/dashboard');
      });
    } else {
      res.render('login-form', { layout: false, error: 'Please enter email and password' });
    }
  }

  /**
   * Logout
   */
  logout(req, res) {
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
      res.redirect('/login');
    });
  }
}

export default new AuthController();
