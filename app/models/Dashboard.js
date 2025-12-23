import { getTescoDb, getRedis } from '../config/database.js';

/**
 * Dashboard Model
 * Fetches system-wide statistics from tesco_elearning database
 * With Redis caching, year filtering, and company filtering for performance
 */
class Dashboard {
  constructor() {
    this.CACHE_TTL = 300; // 5 minutes cache
  }

  getDb() {
    return getTescoDb();
  }

  getRedis() {
    return getRedis();
  }

  /**
   * Get company WHERE clause
   */
  getCompanyCondition(alias = 'u', company = 'lotus') {
    if (company === 'makro') {
      return `${alias}.company = 'makro'`;
    } else if (company === 'all') {
      return '1=1'; // No filter
    }
    // Default: lotus (NULL or empty or not makro)
    return `(${alias}.company IS NULL OR ${alias}.company = '' OR ${alias}.company != 'makro')`;
  }

  /**
   * Get cached data or fetch from database
   */
  async getCachedOrFetch(cacheKey, fetchFn) {
    const redis = this.getRedis();

    // Try to get from cache
    if (redis?.isOpen) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        console.error('Redis get error:', err);
      }
    }

    // Fetch from database
    const data = await fetchFn();

    // Store in cache
    if (redis?.isOpen) {
      try {
        await redis.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(data));
      } catch (err) {
        console.error('Redis set error:', err);
      }
    }

    return data;
  }

  /**
   * Get user statistics by company
   */
  async getUserStats(company = 'lotus') {
    const cacheKey = `dashboard:users:${company}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const db = this.getDb();
      const companyCondition = this.getCompanyCondition('', company).replace(/\./g, '');

      const [rows] = await db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 1 AND is_inactive = 0 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN type = 2 OR type = 3 THEN 1 ELSE 0 END) as admins
        FROM user
        WHERE deleted_at IS NULL AND ${companyCondition}
      `);
      return rows[0];
    });
  }

  /**
   * Get learning statistics for a specific year and company
   */
  async getLearningStats(year, company = 'lotus') {
    const cacheKey = `dashboard:learning:${year}:${company}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const db = this.getDb();
      const companyCondition = this.getCompanyCondition('u', company);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31 23:59:59`;

      const [rows] = await db.query(`
        SELECT
          COUNT(*) as total_records,
          SUM(CASE WHEN cs.is_finished = 1 THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN cs.is_finished = 0 OR cs.is_finished IS NULL THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN cs.is_finished = 2 THEN 1 ELSE 0 END) as pending_review,
          ROUND(AVG(CASE WHEN cs.posttest IS NOT NULL THEN cs.posttest END), 1) as avg_posttest,
          ROUND(AVG(CASE WHEN cs.pretest IS NOT NULL THEN cs.pretest END), 1) as avg_pretest
        FROM class_student cs
        LEFT JOIN user u ON cs.user_id = u.id
        WHERE cs.deleted_at IS NULL
          AND cs.created_at BETWEEN ? AND ?
          AND ${companyCondition}
      `, [startDate, endDate]);
      return rows[0];
    });
  }

  /**
   * Get course statistics (no company filter needed)
   */
  async getCourseStats() {
    return this.getCachedOrFetch('dashboard:courses', async () => {
      const db = this.getDb();
      const [rows] = await db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active
        FROM course
        WHERE deleted_at IS NULL
      `);
      return rows[0];
    });
  }

  /**
   * Get top courses by enrollments for a specific year and company
   */
  async getTopCourses(year, company = 'lotus', limit = 10) {
    const cacheKey = `dashboard:topCourses:${year}:${company}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const db = this.getDb();
      const companyCondition = this.getCompanyCondition('u', company);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31 23:59:59`;

      const [rows] = await db.query(`
        SELECT
          cs.course_id,
          co.name as course_name,
          COUNT(*) as total_enrollments,
          SUM(CASE WHEN cs.is_finished = 1 THEN 1 ELSE 0 END) as completed_count,
          ROUND(AVG(CASE WHEN cs.posttest IS NOT NULL THEN cs.posttest END), 1) as avg_posttest
        FROM class_student cs
        LEFT JOIN course co ON cs.course_id = co.id
        LEFT JOIN user u ON cs.user_id = u.id
        WHERE cs.deleted_at IS NULL
          AND cs.course_id IS NOT NULL
          AND cs.created_at BETWEEN ? AND ?
          AND ${companyCondition}
        GROUP BY cs.course_id
        ORDER BY total_enrollments DESC
        LIMIT ?
      `, [startDate, endDate, limit]);
      return rows;
    });
  }

  /**
   * Get monthly statistics for a specific year and company
   */
  async getMonthlyStats(year, company = 'lotus') {
    const cacheKey = `dashboard:monthly:${year}:${company}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const db = this.getDb();
      const companyCondition = this.getCompanyCondition('u', company);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31 23:59:59`;

      const [rows] = await db.query(`
        SELECT
          MONTH(cs.created_at) as month,
          COUNT(*) as enrollments,
          SUM(CASE WHEN cs.is_finished = 1 THEN 1 ELSE 0 END) as completions
        FROM class_student cs
        LEFT JOIN user u ON cs.user_id = u.id
        WHERE cs.deleted_at IS NULL
          AND cs.created_at BETWEEN ? AND ?
          AND ${companyCondition}
        GROUP BY MONTH(cs.created_at)
        ORDER BY month
      `, [startDate, endDate]);
      return rows;
    });
  }

  /**
   * Get recent completed courses for a specific year and company
   */
  async getRecentCompletions(year, company = 'lotus', limit = 10) {
    const cacheKey = `dashboard:recentCompletions:${year}:${company}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const db = this.getDb();
      const companyCondition = this.getCompanyCondition('u', company);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31 23:59:59`;

      const [rows] = await db.query(`
        SELECT
          cs.id,
          cs.user_id,
          cs.course_id,
          cs.score,
          cs.total_score,
          cs.posttest,
          cs.updated_at,
          u.employee_id,
          u.first_name,
          u.last_name,
          u.name_thai,
          u.company,
          co.name as course_name
        FROM class_student cs
        LEFT JOIN user u ON cs.user_id = u.id
        LEFT JOIN course co ON cs.course_id = co.id
        WHERE cs.deleted_at IS NULL
          AND cs.is_finished = 1
          AND cs.created_at BETWEEN ? AND ?
          AND ${companyCondition}
        ORDER BY cs.updated_at DESC
        LIMIT ?
      `, [startDate, endDate, limit]);
      return rows;
    });
  }

  /**
   * Get available years from class_student table
   */
  async getAvailableYears() {
    return this.getCachedOrFetch('dashboard:availableYears', async () => {
      const db = this.getDb();
      const [rows] = await db.query(`
        SELECT DISTINCT YEAR(created_at) as year
        FROM class_student
        WHERE deleted_at IS NULL AND created_at IS NOT NULL
        ORDER BY year DESC
        LIMIT 10
      `);
      return rows.map(r => r.year);
    });
  }

  /**
   * Get all dashboard data for a specific year and company
   */
  async getAllStats(year = new Date().getFullYear(), company = 'lotus') {
    const [
      userStats,
      learningStats,
      courseStats,
      topCourses,
      monthlyStats,
      recentCompletions,
      availableYears
    ] = await Promise.all([
      this.getUserStats(company),
      this.getLearningStats(year, company),
      this.getCourseStats(),
      this.getTopCourses(year, company, 10),
      this.getMonthlyStats(year, company),
      this.getRecentCompletions(year, company, 10),
      this.getAvailableYears()
    ]);

    return {
      users: userStats,
      learning: learningStats,
      courses: courseStats,
      topCourses,
      monthlyStats,
      recentCompletions,
      availableYears,
      selectedYear: year,
      selectedCompany: company
    };
  }

  /**
   * Clear all dashboard cache
   */
  async clearCache() {
    const redis = this.getRedis();
    if (redis?.isOpen) {
      try {
        const keys = await redis.keys('dashboard:*');
        if (keys.length > 0) {
          await redis.del(keys);
        }
        return true;
      } catch (err) {
        console.error('Redis clear cache error:', err);
        return false;
      }
    }
    return false;
  }
}

export { Dashboard };
export default new Dashboard();
