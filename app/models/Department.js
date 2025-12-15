import Model from './Model.js';

/**
 * Department Model
 * Represents departments within a function
 */
class Department extends Model {
  constructor() {
    super('department');
  }

  /**
   * Get all departments with function and format names
   * @returns {Promise<Array>}
   */
  async getAllWithRelations() {
    return this.query(`
      SELECT d.*,
             f.name as functions_name,
             fmt.name as format_name
      FROM department d
      LEFT JOIN functions f ON d.functions_id = f.id
      LEFT JOIN format fmt ON f.format_id = fmt.id
      WHERE d.deleted_at IS NULL
      ORDER BY fmt.id ASC, f.id ASC, d.order ASC, d.id ASC
    `);
  }

  /**
   * Get departments by function ID
   * @param {number} functionsId
   * @returns {Promise<Array>}
   */
  async getByFunctionsId(functionsId) {
    return this.findAll({
      where: { functions_id: functionsId, status: 1 },
      orderBy: '`order` ASC, name ASC'
    });
  }

  /**
   * Get department with full hierarchy
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getWithHierarchy(id) {
    const [rows] = await this.db.query(`
      SELECT d.*,
             f.name as functions_name,
             f.format_id,
             fmt.name as format_name
      FROM department d
      LEFT JOIN functions f ON d.functions_id = f.id
      LEFT JOIN format fmt ON f.format_id = fmt.id
      WHERE d.id = ? AND d.deleted_at IS NULL
    `, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get departments for dropdown grouped by function
   * @returns {Promise<Array>}
   */
  async getForSelect() {
    return this.query(`
      SELECT d.id, d.name, f.name as functions_name, fmt.name as format_name
      FROM department d
      LEFT JOIN functions f ON d.functions_id = f.id
      LEFT JOIN format fmt ON f.format_id = fmt.id
      WHERE d.deleted_at IS NULL AND d.status = 1
      ORDER BY fmt.name ASC, f.name ASC, d.name ASC
    `);
  }

  /**
   * Get department count by function
   * @param {number} functionsId
   * @returns {Promise<number>}
   */
  async countByFunction(functionsId) {
    return this.count({ functions_id: functionsId });
  }

  /**
   * Check if department name exists in function
   * @param {string} name
   * @param {number} functionsId
   * @param {number} excludeId
   * @returns {Promise<boolean>}
   */
  async nameExistsInFunction(name, functionsId, excludeId = null) {
    let sql = 'SELECT COUNT(*) as count FROM department WHERE name = ? AND functions_id = ? AND deleted_at IS NULL';
    const params = [name, functionsId];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await this.db.query(sql, params);
    return rows[0].count > 0;
  }

  /**
   * Get user count in department
   * @param {number} departmentId
   * @returns {Promise<number>}
   */
  async getUserCount(departmentId) {
    const [rows] = await this.db.query(
      'SELECT COUNT(*) as count FROM user WHERE department_id = ? AND deleted_at IS NULL',
      [departmentId]
    );
    return rows[0].count;
  }
}

export default new Department();
