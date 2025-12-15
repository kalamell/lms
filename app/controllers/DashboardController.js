/**
 * Dashboard Controller
 * Handles dashboard-related operations
 */
class DashboardController {
  /**
   * Display main dashboard
   */
  async index(req, res) {
    const sessionUser = req.session.user;

    // Mock data - จะเปลี่ยนเป็นดึงจาก database ภายหลัง
    const dashboardData = {
      pageTitle: 'Academy Dashboard',
      user: {
        name: sessionUser.name,
        role: sessionUser.role,
        avatar: sessionUser.avatar,
        organization: sessionUser.organization,
        department: sessionUser.department
      },
      stats: {
        hoursSpent: 34,
        testResults: 82,
        courseCompleted: 14,
        timeSpending: {
          hours: 231,
          minutes: 14,
          growth: 18.4
        }
      },
      topics: [
        { name: 'UI Design', percentage: 35, color: 'primary' },
        { name: 'UX Design', percentage: 20, color: 'info' },
        { name: 'Music', percentage: 14, color: 'success' },
        { name: 'Animation', percentage: 12, color: 'secondary' },
        { name: 'React', percentage: 10, color: 'danger' },
        { name: 'SEO', percentage: 9, color: 'warning' }
      ],
      instructors: [
        { name: 'Maven Analytics', specialty: 'Business Intelligence', courses: 33, avatar: '/theme/assets/img/avatars/1.png' },
        { name: 'Bentlee Emblin', specialty: 'Digital Marketing', courses: 52, avatar: '/theme/assets/img/avatars/2.png' },
        { name: 'Benedetto Rossiter', specialty: 'UI/UX Design', courses: 12, avatar: '/theme/assets/img/avatars/3.png' },
        { name: 'Beverlie Krabbe', specialty: 'React Native', courses: 8, avatar: '/theme/assets/img/avatars/4.png' }
      ],
      topCourses: [
        { title: 'Videography Basic Design Course', icon: 'ri ri-vidicon-line', color: 'primary', views: 1200 },
        { title: 'Basic Front-end Development Course', icon: 'ri ri-code-fill', color: 'info', views: 834 },
        { title: 'Basic Fundamentals of Photography', icon: 'ri ri-image-2-line', color: 'success', views: 3700 },
        { title: 'Advance Dribble Base Visual Design', icon: 'ri ri-palette-line', color: 'warning', views: 2500 },
        { title: 'Your First Singing Lesson', icon: 'ri ri-music-2-line', color: 'danger', views: 948 }
      ],
      webinar: {
        title: 'Next Generation Frontend Architecture Using Layout Engine And React Native Web.',
        date: '17 Nov 23',
        duration: '32 minutes'
      },
      assignments: [
        { name: 'User experience Design', tasks: 120, progress: 72, color: 'primary' },
        { name: 'Basic fundamentals', tasks: 32, progress: 48, color: 'success' },
        { name: 'React native components', tasks: 182, progress: 15, color: 'danger' },
        { name: 'Basic of music theory', tasks: 56, progress: 24, color: 'info' }
      ]
    };

    res.render('dashboard', dashboardData);
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
