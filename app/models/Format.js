import Model from './Model.js';

/**
 * Format Model
 * Represents store formats (e.g., Hypermarket, Express, DC, Head Office)
 */
class Format extends Model {
  constructor() {
    super('format');
  }

  /**
   * Get all active formats ordered by display order
   * @returns {Promise<Array>}
   */
  async getAllActive() {
    return this.findAll({
      where: { status: 1 },
      orderBy: '`order` ASC, id ASC'
    });
  }

  /**
   * Get formats for dropdown/select options
   * @returns {Promise<Array>}
   */
  async getForSelect() {
    return this.query(
      'SELECT id, name FROM format WHERE deleted_at IS NULL AND status = 1 ORDER BY `order` ASC, name ASC'
    );
  }

  /**
   * Get format with related functions count
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getWithFunctionsCount(id) {
    const [rows] = await this.db.query(`
      SELECT f.*,
             (SELECT COUNT(*) FROM functions fn WHERE fn.format_id = f.id AND fn.deleted_at IS NULL) as functions_count
      FROM format f
      WHERE f.id = ? AND f.deleted_at IS NULL
    `, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Check if format name already exists
   * @param {string} name
   * @param {number} excludeId - ID to exclude (for update check)
   * @returns {Promise<boolean>}
   */
  async nameExists(name, excludeId = null) {
    let sql = 'SELECT COUNT(*) as count FROM format WHERE name = ? AND deleted_at IS NULL';
    const params = [name];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await this.db.query(sql, params);
    return rows[0].count > 0;
  }
}

export default new Format();
