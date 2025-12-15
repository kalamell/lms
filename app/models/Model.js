import { getTescoDb } from '../config/database.js';

/**
 * Base Model class with common CRUD operations
 * All models should extend this class
 */
class Model {
  constructor(table) {
    this.table = table;
    this.primaryKey = 'id';
    this.softDelete = true; // Use deleted_at for soft deletes
  }

  // Get database connection
  get db() {
    return getTescoDb();
  }

  /**
   * Find all records
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    const {
      where = {},
      orderBy = `${this.primaryKey} ASC`,
      limit = null,
      offset = null,
      includeDeleted = false
    } = options;

    let sql = `SELECT * FROM ${this.table}`;
    const params = [];
    const conditions = [];

    // Add soft delete condition
    if (this.softDelete && !includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }

    // Add where conditions
    Object.entries(where).forEach(([key, value]) => {
      if (value === null) {
        conditions.push(`\`${key}\` IS NULL`);
      } else {
        conditions.push(`\`${key}\` = ?`);
        params.push(value);
      }
    });

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY ${orderBy}`;

    if (limit) {
      sql += ` LIMIT ${parseInt(limit)}`;
      if (offset) {
        sql += ` OFFSET ${parseInt(offset)}`;
      }
    }

    const [rows] = await this.db.query(sql, params);
    return rows;
  }

  /**
   * Find a single record by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    let sql = `SELECT * FROM ${this.table} WHERE ${this.primaryKey} = ?`;
    const params = [id];

    if (this.softDelete) {
      sql += ' AND deleted_at IS NULL';
    }

    const [rows] = await this.db.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find a single record by conditions
   * @param {Object} where
   * @returns {Promise<Object|null>}
   */
  async findOne(where = {}) {
    const results = await this.findAll({ where, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Create a new record
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    // Add timestamps
    const now = new Date();
    data.created_at = now;
    data.updated_at = now;

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');

    const sql = `INSERT INTO ${this.table} (\`${keys.join('`, `')}\`) VALUES (${placeholders})`;
    const [result] = await this.db.query(sql, values);

    return {
      id: result.insertId,
      ...data
    };
  }

  /**
   * Update a record by ID
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<boolean>}
   */
  async update(id, data) {
    // Add updated timestamp
    data.updated_at = new Date();

    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(key => `\`${key}\` = ?`).join(', ');

    const sql = `UPDATE ${this.table} SET ${setClause} WHERE ${this.primaryKey} = ?`;
    const [result] = await this.db.query(sql, [...values, id]);

    return result.affectedRows > 0;
  }

  /**
   * Soft delete a record by ID
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (this.softDelete) {
      const sql = `UPDATE ${this.table} SET deleted_at = NOW() WHERE ${this.primaryKey} = ?`;
      const [result] = await this.db.query(sql, [id]);
      return result.affectedRows > 0;
    } else {
      const sql = `DELETE FROM ${this.table} WHERE ${this.primaryKey} = ?`;
      const [result] = await this.db.query(sql, [id]);
      return result.affectedRows > 0;
    }
  }

  /**
   * Restore a soft-deleted record
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async restore(id) {
    if (!this.softDelete) {
      throw new Error('Restore is only available for soft-delete models');
    }

    const sql = `UPDATE ${this.table} SET deleted_at = NULL, updated_at = NOW() WHERE ${this.primaryKey} = ?`;
    const [result] = await this.db.query(sql, [id]);
    return result.affectedRows > 0;
  }

  /**
   * Count records
   * @param {Object} where
   * @returns {Promise<number>}
   */
  async count(where = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${this.table}`;
    const params = [];
    const conditions = [];

    if (this.softDelete) {
      conditions.push('deleted_at IS NULL');
    }

    Object.entries(where).forEach(([key, value]) => {
      conditions.push(`\`${key}\` = ?`);
      params.push(value);
    });

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const [rows] = await this.db.query(sql, params);
    return rows[0].count;
  }

  /**
   * Execute raw SQL query
   * @param {string} sql
   * @param {Array} params
   * @returns {Promise<Array>}
   */
  async query(sql, params = []) {
    const [rows] = await this.db.query(sql, params);
    return rows;
  }
}

export default Model;
