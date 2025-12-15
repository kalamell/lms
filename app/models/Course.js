import Model from './Model.js';

/**
 * Course Model
 * Represents course/หลักสูตร in the LMS system
 */
class Course extends Model {
  constructor() {
    super('course');
  }

  // Status constants
  static STATUS_INACTIVE = 0;
  static STATUS_ACTIVE = 1;
  static STATUS_DRAFT = 2;

  // Type constants
  static TYPE_NORMAL = 1;
  static TYPE_SCORM_12 = 2;
  static TYPE_SCORM_2004_R2 = 3;
  static TYPE_SCORM_2004_R3 = 4;

  /**
   * Get status label
   */
  static getStatusLabel(status) {
    const labels = {
      [Course.STATUS_INACTIVE]: 'Inactive',
      [Course.STATUS_ACTIVE]: 'Active',
      [Course.STATUS_DRAFT]: 'Draft'
    };
    return labels[status] || 'Unknown';
  }

  /**
   * Get status badge class
   */
  static getStatusBadgeClass(status) {
    const classes = {
      [Course.STATUS_INACTIVE]: 'bg-label-secondary',
      [Course.STATUS_ACTIVE]: 'bg-label-success',
      [Course.STATUS_DRAFT]: 'bg-label-warning'
    };
    return classes[status] || 'bg-label-secondary';
  }

  /**
   * Get type label
   */
  static getTypeLabel(type) {
    const labels = {
      [Course.TYPE_NORMAL]: 'Normal',
      [Course.TYPE_SCORM_12]: 'SCORM 1.2',
      [Course.TYPE_SCORM_2004_R2]: 'SCORM 2004 2nd',
      [Course.TYPE_SCORM_2004_R3]: 'SCORM 2004 3rd'
    };
    return labels[type] || 'Normal';
  }

  /**
   * Get all courses with filters and pagination
   */
  async getAllWithFilters(options = {}) {
    const {
      keyword = null,
      status = null,
      type = null,
      orderBy = 'id DESC',
      page = 1,
      perPage = 20
    } = options;

    let whereSql = `WHERE c.deleted_at IS NULL`;
    const params = [];

    if (keyword) {
      whereSql += ` AND (c.name LIKE ? OR c.course_code LIKE ? OR c.keywords LIKE ?)`;
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (status !== null && status !== '') {
      whereSql += ` AND c.status = ?`;
      params.push(status);
    }

    if (type !== null && type !== '') {
      whereSql += ` AND c.type = ?`;
      params.push(type);
    }

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM ${this.table} c ${whereSql}`;
    const [countResult] = await this.db.query(countSql, params);
    const total = countResult[0].total;

    // Calculate pagination
    const totalPages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;

    // Get data
    const dataSql = `
      SELECT c.*,
             (SELECT COUNT(*) FROM course_document cd WHERE cd.course_id = c.id) as document_count
      FROM ${this.table} c
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ${parseInt(perPage)} OFFSET ${parseInt(offset)}
    `;

    const [rows] = await this.db.query(dataSql, params);

    return {
      data: rows,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        perPage: parseInt(perPage),
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get course with details
   */
  async getWithDetails(id) {
    const sql = `
      SELECT c.*
      FROM ${this.table} c
      WHERE c.id = ? AND c.deleted_at IS NULL
    `;
    const [rows] = await this.db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get courses for dropdown select
   */
  async getForSelect() {
    const sql = `
      SELECT id, name, course_code
      FROM ${this.table}
      WHERE deleted_at IS NULL AND status = ?
      ORDER BY name ASC
    `;
    const [rows] = await this.db.query(sql, [Course.STATUS_ACTIVE]);
    return rows;
  }

  /**
   * Check if course code exists
   */
  async codeExists(code, excludeId = null) {
    if (!code) return false;

    let sql = `SELECT id FROM ${this.table} WHERE course_code = ? AND deleted_at IS NULL`;
    const params = [code];

    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }

    const [rows] = await this.db.query(sql, params);
    return rows.length > 0;
  }

  /**
   * Get statistics
   */
  async getStats() {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as inactive
      FROM ${this.table}
      WHERE deleted_at IS NULL
    `;
    const [rows] = await this.db.query(sql);
    return rows[0];
  }

  /**
   * Duplicate course
   */
  async duplicate(id) {
    const course = await this.findById(id);
    if (!course) return null;

    const newCourse = { ...course };
    delete newCourse.id;
    newCourse.name = `${course.name} (Copy)`;
    newCourse.course_code = course.course_code ? `${course.course_code}-copy` : null;
    newCourse.status = Course.STATUS_DRAFT;
    newCourse.created_at = new Date();
    newCourse.updated_at = new Date();

    return await this.create(newCourse);
  }
}

// Export both the class and the singleton instance
export { Course };
export default new Course();
