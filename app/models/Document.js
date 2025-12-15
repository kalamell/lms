import Model from './Model.js';

/**
 * Document Model
 * Represents documents/เอกสาร in the LMS system
 */
class Document extends Model {
  constructor() {
    super('document');
  }

  // Type constants
  static TYPE_INFO = 1;
  static TYPE_VIDEO = 2;
  static TYPE_QUIZ = 3;
  static TYPE_BOOK = 4;
  static TYPE_PDF = 5;

  /**
   * Get type label
   */
  static getTypeLabel(type) {
    const labels = {
      [Document.TYPE_INFO]: 'Info',
      [Document.TYPE_VIDEO]: 'Video',
      [Document.TYPE_QUIZ]: 'Quiz',
      [Document.TYPE_BOOK]: 'Book',
      [Document.TYPE_PDF]: 'PDF'
    };
    return labels[type] || 'Unknown';
  }

  /**
   * Get type icon
   */
  static getTypeIcon(type) {
    const icons = {
      [Document.TYPE_INFO]: 'ri-file-info-line',
      [Document.TYPE_VIDEO]: 'ri-video-line',
      [Document.TYPE_QUIZ]: 'ri-question-line',
      [Document.TYPE_BOOK]: 'ri-book-line',
      [Document.TYPE_PDF]: 'ri-file-pdf-line'
    };
    return icons[type] || 'ri-file-line';
  }

  /**
   * Get all documents with filters
   */
  async getAllWithFilters(options = {}) {
    const {
      keyword = null,
      type = null,
      excludeIds = [],
      orderBy = 'id DESC',
      limit = 50
    } = options;

    let sql = `
      SELECT d.*
      FROM ${this.table} d
      WHERE d.deleted_at IS NULL AND d.status = 1
    `;
    const params = [];

    if (keyword) {
      sql += ` AND d.name LIKE ?`;
      params.push(`%${keyword}%`);
    }

    if (type) {
      sql += ` AND d.type = ?`;
      params.push(type);
    }

    if (excludeIds.length > 0) {
      sql += ` AND d.id NOT IN (${excludeIds.map(() => '?').join(',')})`;
      params.push(...excludeIds);
    }

    sql += ` ORDER BY ${orderBy} LIMIT ${parseInt(limit)}`;

    const [rows] = await this.db.query(sql, params);
    return rows;
  }

  /**
   * Get documents for select dropdown
   */
  async getForSelect() {
    const sql = `
      SELECT id, name, type
      FROM ${this.table}
      WHERE deleted_at IS NULL AND status = 1
      ORDER BY name ASC
    `;
    const [rows] = await this.db.query(sql);
    return rows;
  }
}

export { Document };
export default new Document();
