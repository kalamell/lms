import DashboardModel from '../models/Dashboard.js';
import { User } from '../models/User.js';

/**
 * Dashboard Controller
 * Handles dashboard-related operations
 */
class DashboardController {
  /**
   * Display main dashboard with system-wide statistics
   */
  async index(req, res) {
    try {
      const sessionUser = req.session.user;

      // Get year and company from query params
      const currentYear = new Date().getFullYear();
      const year = parseInt(req.query.year) || currentYear;
      const company = req.query.company || 'lotus'; // Default to Lotus

      // Get all dashboard statistics from database (with caching)
      const stats = await DashboardModel.getAllStats(year, company);

      // Calculate completion rate
      const completionRate = stats.learning?.total_records > 0
        ? ((stats.learning.completed / stats.learning.total_records) * 100).toFixed(1)
        : 0;

      // Prepare monthly data for chart (fill missing months with 0)
      const monthlyData = Array(12).fill(null).map((_, i) => {
        const month = i + 1;
        const data = stats.monthlyStats?.find(m => m.month === month);
        return {
          month,
          enrollments: data ? Number(data.enrollments) : 0,
          completions: data ? Number(data.completions) : 0
        };
      });

      const dashboardData = {
        pageTitle: 'Dashboard',
        user: {
          name: sessionUser.name,
          role: sessionUser.role,
          avatar: sessionUser.avatar,
          organization: sessionUser.organization,
          department: sessionUser.department
        },
        stats: {
          users: {
            total: Number(stats.users?.total) || 0,
            active: Number(stats.users?.active) || 0,
            admins: Number(stats.users?.admins) || 0
          },
          learning: {
            total: Number(stats.learning?.total_records) || 0,
            completed: Number(stats.learning?.completed) || 0,
            inProgress: Number(stats.learning?.in_progress) || 0,
            pendingReview: Number(stats.learning?.pending_review) || 0,
            avgPosttest: stats.learning?.avg_posttest || 0,
            avgPretest: stats.learning?.avg_pretest || 0
          },
          courses: {
            total: Number(stats.courses?.total) || 0,
            active: Number(stats.courses?.active) || 0
          },
          completionRate
        },
        topCourses: stats.topCourses || [],
        monthlyData,
        recentCompletions: stats.recentCompletions || [],
        availableYears: stats.availableYears || [currentYear],
        selectedYear: year,
        selectedCompany: company,
        User
      };

      res.render('dashboard', dashboardData);
    } catch (error) {
      console.error('DashboardController.index error:', error);
      const currentYear = new Date().getFullYear();
      // Fallback to empty data
      res.render('dashboard', {
        pageTitle: 'Dashboard',
        user: req.session.user,
        stats: {
          users: { total: 0, active: 0, admins: 0 },
          learning: { total: 0, completed: 0, inProgress: 0, pendingReview: 0, avgPosttest: 0, avgPretest: 0 },
          courses: { total: 0, active: 0 },
          completionRate: 0
        },
        topCourses: [],
        monthlyData: [],
        recentCompletions: [],
        availableYears: [currentYear],
        selectedYear: currentYear,
        selectedCompany: 'lotus',
        User,
        error: 'Failed to load dashboard data: ' + error.message
      });
    }
  }

  /**
   * Clear dashboard cache
   */
  async clearCache(req, res) {
    try {
      const result = await DashboardModel.clearCache();
      res.json({ success: result, message: result ? 'Cache cleared' : 'Cache not available' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Display analytics dashboard
   */
  async analytics(req, res) {
    res.render('analytics', {
      pageTitle: 'Analytics Dashboard',
      user: req.session.user
    });
  }
}

export default new DashboardController();
