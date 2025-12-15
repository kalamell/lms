import UserModel, { User } from '../models/User.js';

/**
 * User Controller
 * Handles user management operations
 */
class UserController {
  /**
   * Display list of users
   */
  async index(req, res) {
    try {
      const {
        k: keyword,
        format_id: formatId,
        status,
        type,
        is_inactive: isInactive,
        company = 'lotus',  // Default to Lotus
        page = 1
      } = req.query;

      const [result, stats, formats] = await Promise.all([
        UserModel.getAllWithFilters({
          keyword,
          formatId,
          status,
          type,
          isInactive,
          company,
          page: parseInt(page) || 1,
          perPage: 50
        }),
        UserModel.getStats(company),
        UserModel.getFormats()
      ]);

      res.render('user/list', {
        pageTitle: 'User Management',
        users: result.data,
        pagination: result.pagination,
        stats,
        formats,
        filters: { keyword, formatId, status, type, isInactive, company },
        query: req.query,
        User
      });
    } catch (error) {
      console.error('UserController.index error:', error);
      res.render('user/list', {
        pageTitle: 'User Management',
        users: [],
        pagination: { total: 0, totalPages: 0, currentPage: 1, perPage: 50 },
        stats: { total: 0, active: 0, inactive: 0, admins: 0 },
        formats: [],
        filters: {},
        query: req.query,
        User,
        error: 'Failed to load users'
      });
    }
  }

  /**
   * Display user detail
   */
  async show(req, res) {
    try {
      const userId = req.params.id;
      const page = parseInt(req.query.page) || 1;

      const [user, courseHistoryResult] = await Promise.all([
        UserModel.getById(userId),
        UserModel.getCourseHistory(userId, { page, perPage: 20 })
      ]);

      if (!user) {
        return res.redirect('/user?error=notfound');
      }

      res.render('user/view', {
        pageTitle: `User: ${User.getDisplayName(user)}`,
        user,
        courseHistory: courseHistoryResult.data,
        pagination: courseHistoryResult.pagination,
        query: req.query,
        User
      });
    } catch (error) {
      console.error('UserController.show error:', error);
      res.redirect('/user?error=fetch');
    }
  }

  /**
   * Display edit form
   */
  async edit(req, res) {
    try {
      const userId = req.params.id;
      const [user, formats] = await Promise.all([
        UserModel.getById(userId),
        UserModel.getFormats()
      ]);

      if (!user) {
        return res.redirect('/user?error=notfound');
      }

      res.render('user/edit', {
        pageTitle: `Edit User: ${User.getDisplayName(user)}`,
        user,
        formats,
        User
      });
    } catch (error) {
      console.error('UserController.edit error:', error);
      res.redirect('/user?error=fetch');
    }
  }

  /**
   * Update user
   */
  async update(req, res) {
    try {
      const userId = req.params.id;
      const data = req.body;

      await UserModel.update(userId, data);
      res.redirect(`/user/${userId}?success=updated`);
    } catch (error) {
      console.error('UserController.update error:', error);
      res.redirect(`/user/${req.params.id}/edit?error=update`);
    }
  }

  /**
   * Delete user
   */
  async destroy(req, res) {
    try {
      await UserModel.delete(req.params.id);
      res.redirect('/user?success=deleted');
    } catch (error) {
      console.error('UserController.destroy error:', error);
      res.redirect('/user?error=delete');
    }
  }

  /**
   * API: Search users
   */
  async apiSearch(req, res) {
    try {
      const { q: query } = req.query;
      if (!query || query.length < 2) {
        return res.json({ success: true, data: [] });
      }

      const users = await UserModel.search(query);
      const results = users.map(u => ({
        id: u.id,
        text: `${u.employee_id} - ${User.getDisplayName(u)}`,
        employee_id: u.employee_id,
        name: User.getDisplayName(u),
        position: u.position,
        department: u.department
      }));

      res.json({ success: true, data: results });
    } catch (error) {
      console.error('UserController.apiSearch error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * API: Get user by ID
   */
  async apiGet(req, res) {
    try {
      const user = await UserModel.getById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json({ success: true, data: user });
    } catch (error) {
      console.error('UserController.apiGet error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * API: Get user course history
   */
  async apiCourseHistory(req, res) {
    try {
      const courseHistory = await UserModel.getCourseHistory(req.params.id);
      res.json({ success: true, data: courseHistory });
    } catch (error) {
      console.error('UserController.apiCourseHistory error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * API: Get stats
   */
  async apiStats(req, res) {
    try {
      const stats = await UserModel.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('UserController.apiStats error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new UserController();
