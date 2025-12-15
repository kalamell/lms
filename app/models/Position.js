import Model from './Model.js';

/**
 * Position Model
 * Represents positions/ตำแหน่งงาน in the LMS system
 */
class Position extends Model {
  constructor() {
    super('position');
  }

  /**
   * Get all positions
   */
  async getAll() {
    const sql = `
      SELECT *
      FROM ${this.table}
      WHERE deleted_at IS NULL AND status = 1
      ORDER BY name ASC
    `;
    const [rows] = await this.db.query(sql);
    return rows;
  }

  /**
   * Get positions with format hierarchy
   */
  async getAllWithHierarchy() {
    const sql = `
      SELECT p.*, fp.format_id, f.name as format_name
      FROM ${this.table} p
      LEFT JOIN format_position fp ON fp.position_id = p.id AND fp.deleted_at IS NULL
      LEFT JOIN format f ON f.id = fp.format_id AND f.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 1
      ORDER BY f.name ASC, p.name ASC
    `;
    const [rows] = await this.db.query(sql);
    return rows;
  }

  /**
   * Search positions by keyword
   */
  async search(keyword) {
    const sql = `
      SELECT *
      FROM ${this.table}
      WHERE deleted_at IS NULL AND status = 1
        AND name LIKE ?
      ORDER BY name ASC
      LIMIT 100
    `;
    const [rows] = await this.db.query(sql, [`%${keyword}%`]);
    return rows;
  }
}

export { Position };
export default new Position();
