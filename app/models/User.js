import { getTescoDb } from '../config/database.js';

/**
 * User Model
 * Manages user data from tesco_elearning database
 */
class User {
  // Type constants
  static TYPE_USER = 1;
  static TYPE_ADMIN = 2;
  static TYPE_SUPER_ADMIN = 3;

  // Status constants
  static STATUS_INACTIVE = 0;
  static STATUS_ACTIVE = 1;

  constructor() {
    this.table = 'user';
  }

  getDb() {
    return getTescoDb();
  }

  /**
   * Get all users with filters and pagination
   */
  async getAllWithFilters(options = {}) {
    const {
      keyword = '',
      formatId = null,
      status = null,
      type = null,
      isInactive = null,
      company = null,
      page = 1,
      perPage = 50
    } = options;

    const db = this.getDb();
    let whereConditions = ['u.deleted_at IS NULL'];
    let params = [];

    // Company filter: 'lotus' = NULL/empty, 'makro' = makro, 'all' = no filter
    if (company === 'lotus') {
      whereConditions.push("(u.company IS NULL OR u.company = '' OR u.company != 'makro')");
    } else if (company === 'makro') {
      whereConditions.push("u.company = 'makro'");
    }
    // 'all' or null = no company filter

    if (keyword) {
      whereConditions.push(`(
        u.employee_id LIKE ? OR
        u.first_name LIKE ? OR
        u.last_name LIKE ? OR
        u.name_thai LIKE ? OR
        u.email LIKE ? OR
        u.phone LIKE ?
      )`);
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw, kw, kw, kw);
    }

    if (formatId) {
      whereConditions.push('u.format_id = ?');
      params.push(formatId);
    }

    if (status !== null && status !== '') {
      whereConditions.push('u.status = ?');
      params.push(status);
    }

    if (type !== null && type !== '') {
      whereConditions.push('u.type = ?');
      params.push(type);
    }

    if (isInactive !== null && isInactive !== '') {
      whereConditions.push('u.is_inactive = ?');
      params.push(isInactive);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM ${this.table} u ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get paginated data
    const offset = (page - 1) * perPage;
    const [rows] = await db.query(
      `SELECT u.*, f.name as format_name
       FROM ${this.table} u
       LEFT JOIN format f ON u.format_id = f.id
       ${whereClause}
       ORDER BY u.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    return {
      data: rows,
      pagination: {
        total,
        totalPages: Math.ceil(total / perPage),
        currentPage: page,
        perPage
      }
    };
  }

  /**
   * Get user by ID with details
   */
  async getById(id) {
    const db = this.getDb();
    const [rows] = await db.query(
      `SELECT u.*, f.name as format_name
       FROM ${this.table} u
       LEFT JOIN format f ON u.format_id = f.id
       WHERE u.id = ? AND u.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Get user by employee ID
   */
  async getByEmployeeId(employeeId) {
    const db = this.getDb();
    const [rows] = await db.query(
      `SELECT u.*, f.name as format_name
       FROM ${this.table} u
       LEFT JOIN format f ON u.format_id = f.id
       WHERE u.employee_id = ? AND u.deleted_at IS NULL`,
      [employeeId]
    );
    return rows[0] || null;
  }

  /**
   * Get user's course history from class_student
   */
  async getCourseHistory(userId, options = {}) {
    const { page = 1, perPage = 20 } = options;
    const db = this.getDb();
    const offset = (page - 1) * perPage;

    // Count total
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total
       FROM class_student cs
       WHERE cs.user_id = ? AND cs.deleted_at IS NULL`,
      [userId]
    );
    const total = countResult[0].total;

    // Get paginated data
    const [rows] = await db.query(
      `SELECT
         cs.id as class_student_id,
         cs.user_id,
         cs.class_id,
         cs.course_id,
         cs.is_finished,
         cs.score,
         cs.total_score,
         cs.pretest,
         cs.posttest,
         cs.ontime,
         cs.created_at,
         cs.updated_at,
         co.name as course_name,
         c.user_id as class_creator_id,
         c.is_finished as class_finished
       FROM class_student cs
       LEFT JOIN course co ON cs.course_id = co.id
       LEFT JOIN class c ON cs.class_id = c.id
       WHERE cs.user_id = ? AND cs.deleted_at IS NULL
       ORDER BY cs.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, perPage, offset]
    );

    return {
      data: rows,
      pagination: {
        total,
        totalPages: Math.ceil(total / perPage),
        currentPage: page,
        perPage
      }
    };
  }

  /**
   * Get single class_student record
   */
  async getClassStudent(classStudentId) {
    const db = this.getDb();
    const [rows] = await db.query(
      `SELECT
         cs.*,
         co.name as course_name,
         u.employee_id,
         u.first_name,
         u.last_name,
         u.name_thai
       FROM class_student cs
       LEFT JOIN course co ON cs.course_id = co.id
       LEFT JOIN user u ON cs.user_id = u.id
       WHERE cs.id = ? AND cs.deleted_at IS NULL`,
      [classStudentId]
    );
    return rows[0] || null;
  }

  /**
   * Update user
   */
  async update(id, data) {
    const db = this.getDb();
    const now = new Date();

    const fields = [];
    const values = [];

    const allowedFields = [
      'first_name', 'last_name', 'name_thai', 'email', 'phone',
      'position', 'department', 'status', 'is_inactive', 'type'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`\`${field}\` = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await db.query(
      `UPDATE ${this.table} SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.getById(id);
  }

  /**
   * Delete user (soft delete)
   */
  async delete(id) {
    const db = this.getDb();
    const now = new Date();

    await db.query(
      `UPDATE ${this.table} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );

    return true;
  }

  /**
   * Get statistics
   */
  async getStats(company = null) {
    const db = this.getDb();

    let whereConditions = ['deleted_at IS NULL'];

    // Company filter: 'lotus' = NULL/empty, 'makro' = makro, 'all' = no filter
    if (company === 'lotus') {
      whereConditions.push("(company IS NULL OR company = '' OR company != 'makro')");
    } else if (company === 'makro') {
      whereConditions.push("company = 'makro'");
    }
    // 'all' = no company filter

    const whereClause = whereConditions.join(' AND ');

    const [rows] = await db.query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 1 AND is_inactive = 0 THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN is_inactive = 1 THEN 1 ELSE 0 END) as inactive,
         SUM(CASE WHEN type = 2 OR type = 3 THEN 1 ELSE 0 END) as admins
       FROM ${this.table}
       WHERE ${whereClause}`
    );
    return rows[0];
  }

  /**
   * Search users (for autocomplete)
   */
  async search(query, limit = 20) {
    const db = this.getDb();
    const [rows] = await db.query(
      `SELECT id, employee_id, first_name, last_name, name_thai, position, department
       FROM ${this.table}
       WHERE deleted_at IS NULL AND (
         employee_id LIKE ? OR
         first_name LIKE ? OR
         last_name LIKE ? OR
         name_thai LIKE ?
       )
       ORDER BY employee_id
       LIMIT ?`,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit]
    );
    return rows;
  }

  /**
   * Get all formats for dropdown
   */
  async getFormats() {
    const db = this.getDb();
    const [rows] = await db.query(
      'SELECT id, name FROM format WHERE deleted_at IS NULL ORDER BY name'
    );
    return rows;
  }

  /**
   * Get full name
   */
  static getFullName(user) {
    if (user.name_thai) {
      return user.name_thai;
    }
    return [user.first_name, user.last_name].filter(Boolean).join(' ') || '-';
  }

  /**
   * Get display name (Thai or English)
   */
  static getDisplayName(user) {
    const thaiName = user.name_thai || '';
    const engName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return thaiName || engName || '-';
  }

  /**
   * Get status label
   */
  static getStatusLabel(user) {
    if (user.is_inactive === 1) return 'Inactive';
    if (user.status === 1) return 'Active';
    return 'Inactive';
  }

  /**
   * Get status badge class
   */
  static getStatusBadgeClass(user) {
    if (user.is_inactive === 1) return 'bg-label-danger';
    if (user.status === 1) return 'bg-label-success';
    return 'bg-label-warning';
  }

  /**
   * Get type label
   */
  static getTypeLabel(type) {
    const labels = {
      1: 'User',
      2: 'Admin',
      3: 'Super Admin'
    };
    return labels[type] || 'Unknown';
  }

  /**
   * Get type badge class
   */
  static getTypeBadgeClass(type) {
    const classes = {
      1: 'bg-label-info',
      2: 'bg-label-warning',
      3: 'bg-label-danger'
    };
    return classes[type] || 'bg-label-secondary';
  }

  /**
   * Get avatar URL
   */
  static getAvatarUrl(user) {
    if (user.avatar_path) {
      return user.avatar_path;
    }
    if (user.avatar) {
      return `/uploads/avatars/${user.avatar}`;
    }
    return '/img/avatar-placeholder.png';
  }
}

export { User };
export default new User();
