import Model from './Model.js';
import { Document } from './Document.js';

/**
 * CourseDocument Model
 * Represents relationship between courses and documents
 */
class CourseDocument extends Model {
  constructor() {
    super('course_document');
  }

  /**
   * Get documents for a course
   */
  async getDocumentsForCourse(courseId) {
    const sql = `
      SELECT cd.*, d.name, d.type, d.is_new
      FROM ${this.table} cd
      INNER JOIN document d ON d.id = cd.document_id AND d.deleted_at IS NULL
      WHERE cd.course_id = ? AND cd.deleted_at IS NULL
      ORDER BY cd.\`order\` ASC, cd.id ASC
    `;
    const [rows] = await this.db.query(sql, [courseId]);
    return rows.map(row => ({
      ...row,
      typeLabel: Document.getTypeLabel(row.type),
      typeIcon: Document.getTypeIcon(row.type)
    }));
  }

  /**
   * Get document IDs for a course
   */
  async getDocumentIds(courseId) {
    const sql = `
      SELECT document_id
      FROM ${this.table}
      WHERE course_id = ? AND deleted_at IS NULL
    `;
    const [rows] = await this.db.query(sql, [courseId]);
    return rows.map(r => r.document_id);
  }

  /**
   * Add document to course
   */
  async addDocument(courseId, documentId, order = 999) {
    // Check if already exists
    const [existing] = await this.db.query(
      `SELECT id FROM ${this.table} WHERE course_id = ? AND document_id = ? AND deleted_at IS NULL`,
      [courseId, documentId]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    const result = await this.create({
      course_id: courseId,
      document_id: documentId,
      order: order,
      status: 1
    });

    return result;
  }

  /**
   * Remove document from course
   */
  async removeDocument(courseId, documentId) {
    const sql = `
      UPDATE ${this.table}
      SET deleted_at = NOW()
      WHERE course_id = ? AND document_id = ?
    `;
    await this.db.query(sql, [courseId, documentId]);
  }

  /**
   * Update document order for a course
   */
  async updateOrder(courseId, documentIds) {
    for (let i = 0; i < documentIds.length; i++) {
      await this.db.query(
        `UPDATE ${this.table} SET \`order\` = ? WHERE course_id = ? AND document_id = ? AND deleted_at IS NULL`,
        [i + 1, courseId, documentIds[i]]
      );
    }
  }

  /**
   * Get document count for course
   */
  async getDocumentCount(courseId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.table}
      WHERE course_id = ? AND deleted_at IS NULL
    `;
    const [rows] = await this.db.query(sql, [courseId]);
    return rows[0].count;
  }
}

export { CourseDocument };
export default new CourseDocument();
