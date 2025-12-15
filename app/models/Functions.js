import Model from './Model.js';

/**
 * Functions Model
 * Represents organizational functions/divisions within a format
 */
class Functions extends Model {
  constructor() {
    super('functions');
  }

  /**
   * Get all functions with format name
   * @returns {Promise<Array>}
   */
  async getAllWithFormat() {
    return this.query(`
      SELECT f.*, fmt.name as format_name
      FROM functions f
      LEFT JOIN format fmt ON f.format_id = fmt.id
      WHERE f.deleted_at IS NULL
      ORDER BY f.format_id ASC, f.order ASC, f.id ASC
    `);
  }

  /**
   * Get functions by format ID
   * @param {number} formatId
   * @returns {Promise<Array>}
   */
  async getByFormatId(formatId) {
    return this.findAll({
      where: { format_id: formatId, status: 1 },
      orderBy: '`order` ASC, name ASC'
    });
  }

  /**
   * Get functions for dropdown with format name
   * @returns {Promise<Array>}
   */
  async getForSelect() {
    return this.query(`
      SELECT f.id, f.name, fmt.name as format_name
      FROM functions f
      LEFT JOIN format fmt ON f.format_id = fmt.id
      WHERE f.deleted_at IS NULL AND f.status = 1
      ORDER BY fmt.name ASC, f.name ASC
    `);
  }

  /**
   * Get function with format details
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getWithFormat(id) {
    const [rows] = await this.db.query(`
      SELECT f.*, fmt.name as format_name
      FROM functions f
      LEFT JOIN format fmt ON f.format_id = fmt.id
      WHERE f.id = ? AND f.deleted_at IS NULL
    `, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get function with department count
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getWithDepartmentCount(id) {
    const [rows] = await this.db.query(`
      SELECT f.*,
             fmt.name as format_name,
             (SELECT COUNT(*) FROM department d WHERE d.functions_id = f.id AND d.deleted_at IS NULL) as department_count
      FROM functions f
      LEFT JOIN format fmt ON f.format_id = fmt.id
      WHERE f.id = ? AND f.deleted_at IS NULL
    `, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Check if function name exists in format
   * @param {string} name
   * @param {number} formatId
   * @param {number} excludeId
   * @returns {Promise<boolean>}
   */
  async nameExistsInFormat(name, formatId, excludeId = null) {
    let sql = 'SELECT COUNT(*) as count FROM functions WHERE name = ? AND format_id = ? AND deleted_at IS NULL';
    const params = [name, formatId];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await this.db.query(sql, params);
    return rows[0].count > 0;
  }
}

export default new Functions();
