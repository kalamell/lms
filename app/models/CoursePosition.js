import Model from './Model.js';

/**
 * CoursePosition Model
 * Represents relationship between courses and positions (target learners)
 */
class CoursePosition extends Model {
  constructor() {
    super('course_position');
  }

  /**
   * Get positions for a course
   */
  async getPositionsForCourse(courseId) {
    const sql = `
      SELECT cp.*, p.name as position_name
      FROM ${this.table} cp
      INNER JOIN position p ON p.id = cp.position_id AND p.deleted_at IS NULL
      WHERE cp.course_id = ? AND cp.deleted_at IS NULL
      ORDER BY p.name ASC
    `;
    const [rows] = await this.db.query(sql, [courseId]);
    return rows;
  }

  /**
   * Get position IDs for a course
   */
  async getPositionIds(courseId) {
    const sql = `
      SELECT position_id
      FROM ${this.table}
      WHERE course_id = ? AND deleted_at IS NULL
    `;
    const [rows] = await this.db.query(sql, [courseId]);
    return rows.map(r => r.position_id);
  }

  /**
   * Add position to course
   */
  async addPosition(courseId, positionId) {
    // Check if already exists
    const [existing] = await this.db.query(
      `SELECT id FROM ${this.table} WHERE course_id = ? AND position_id = ? AND deleted_at IS NULL`,
      [courseId, positionId]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    return await this.create({
      course_id: courseId,
      position_id: positionId,
      status: 1
    });
  }

  /**
   * Remove position from course
   */
  async removePosition(courseId, positionId) {
    const sql = `
      UPDATE ${this.table}
      SET deleted_at = NOW()
      WHERE course_id = ? AND position_id = ?
    `;
    await this.db.query(sql, [courseId, positionId]);
  }

  /**
   * Sync positions for course (add/remove as needed)
   */
  async syncPositions(courseId, positionIds) {
    // Get current positions
    const currentIds = await this.getPositionIds(courseId);

    // Add new positions
    for (const positionId of positionIds) {
      if (!currentIds.includes(positionId)) {
        await this.addPosition(courseId, positionId);
      }
    }

    // Remove positions that are no longer selected
    for (const currentId of currentIds) {
      if (!positionIds.includes(currentId)) {
        await this.removePosition(courseId, currentId);
      }
    }
  }

  /**
   * Get position count for course
   */
  async getPositionCount(courseId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.table}
      WHERE course_id = ? AND deleted_at IS NULL
    `;
    const [rows] = await this.db.query(sql, [courseId]);
    return rows[0].count;
  }
}

export { CoursePosition };
export default new CoursePosition();
