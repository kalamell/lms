import { getTescoDb } from '../config/database.js';

/**
 * Quiz Model
 * Manages quiz data from tesco_elearning database
 */
class Quiz {
  // Status constants
  static STATUS_DRAFT = 0;
  static STATUS_PUBLISHED = 1;

  // Type constants
  static TYPE_PRETEST = 1;
  static TYPE_POSTTEST = 2;

  constructor() {
    this.table = 'quiz';
  }

  /**
   * Get database pool
   */
  getDb() {
    return getTescoDb();
  }

  /**
   * Get all quizzes with filters and pagination
   */
  async getAllWithFilters(options = {}) {
    const {
      keyword = '',
      courseId = null,
      status = null,
      page = 1,
      perPage = 20
    } = options;

    const db = this.getDb();
    let whereConditions = ['q.deleted_at IS NULL'];
    let params = [];

    if (keyword) {
      whereConditions.push('(q.title LIKE ? OR q.description LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (courseId) {
      whereConditions.push('q.course_id = ?');
      params.push(courseId);
    }

    if (status !== null && status !== '') {
      whereConditions.push('q.is_publish = ?');
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM ${this.table} q ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get paginated data
    const offset = (page - 1) * perPage;
    const [rows] = await db.query(
      `SELECT q.*, c.name as course_name,
              (SELECT COUNT(*) FROM question WHERE quiz_id = q.id AND deleted_at IS NULL) as question_count
       FROM ${this.table} q
       LEFT JOIN course c ON q.course_id = c.id
       ${whereClause}
       ORDER BY q.updated_at DESC
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
   * Get quiz by ID with details
   */
  async getById(id) {
    const db = this.getDb();
    const [rows] = await db.query(
      `SELECT q.*, c.name as course_name
       FROM ${this.table} q
       LEFT JOIN course c ON q.course_id = c.id
       WHERE q.id = ? AND q.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Get quiz with all questions
   */
  async getWithQuestions(id) {
    const quiz = await this.getById(id);
    if (!quiz) return null;

    const db = this.getDb();

    // Get all questions for this quiz
    const [questions] = await db.query(
      `SELECT q.*,
              CASE q.type
                WHEN 1 THEN 'abcd'
                WHEN 2 THEN 'yn'
                WHEN 3 THEN 'write'
                WHEN 4 THEN 'match'
                WHEN 5 THEN 'matchp'
              END as type_name
       FROM question q
       WHERE q.quiz_id = ? AND q.deleted_at IS NULL
       ORDER BY q.order ASC`,
      [id]
    );

    // Load question details based on type
    for (const q of questions) {
      if (q.type === 1) {
        const [detail] = await db.query(
          'SELECT * FROM question_abcd WHERE id = ?',
          [q.question_id]
        );
        q.detail = detail[0];
      } else if (q.type === 2) {
        const [detail] = await db.query(
          'SELECT * FROM question_yn WHERE id = ?',
          [q.question_id]
        );
        q.detail = detail[0];
      } else if (q.type === 3) {
        const [detail] = await db.query(
          'SELECT * FROM question_write WHERE id = ?',
          [q.question_id]
        );
        q.detail = detail[0];
      } else if (q.type === 4) {
        const [detail] = await db.query(
          'SELECT * FROM question_match WHERE id = ?',
          [q.question_id]
        );
        q.detail = detail[0];
      } else if (q.type === 5) {
        const [detail] = await db.query(
          'SELECT * FROM question_match_picture WHERE id = ?',
          [q.question_id]
        );
        q.detail = detail[0];
      }
    }

    quiz.questions = questions;
    return quiz;
  }

  /**
   * Create new quiz
   */
  async create(data) {
    const db = this.getDb();
    const now = new Date();

    const [result] = await db.query(
      `INSERT INTO ${this.table}
       (course_id, user_id, title, description, score, is_publish, is_random_question, is_show_answer, type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.course_id,
        data.user_id || 1,
        data.title,
        data.description || null,
        data.score || 80,
        data.is_publish || 0,
        data.is_random_question || 0,
        data.is_show_answer || 0,
        data.type || 1,
        1,
        now,
        now
      ]
    );

    return { id: result.insertId, ...data };
  }

  /**
   * Update quiz
   */
  async update(id, data) {
    const db = this.getDb();
    const now = new Date();

    const fields = [];
    const values = [];

    const allowedFields = [
      'course_id', 'title', 'description', 'score',
      'is_publish', 'is_random_question', 'is_show_answer', 'type', 'video'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

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
   * Delete quiz (soft delete)
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
   * Duplicate quiz
   */
  async duplicate(id) {
    const quiz = await this.getWithQuestions(id);
    if (!quiz) return null;

    const db = this.getDb();
    const now = new Date();

    // Create new quiz
    const [result] = await db.query(
      `INSERT INTO ${this.table}
       (course_id, user_id, title, description, score, is_publish, is_random_question, is_show_answer, type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quiz.course_id,
        quiz.user_id,
        quiz.title + ' (Copy)',
        quiz.description,
        quiz.score,
        0, // Draft
        quiz.is_random_question,
        quiz.is_show_answer,
        quiz.type,
        1,
        now,
        now
      ]
    );

    const newQuizId = result.insertId;

    // Duplicate questions
    for (const q of quiz.questions) {
      if (q.detail) {
        // Duplicate question detail based on type
        let newDetailId;

        if (q.type === 1) {
          const [detailResult] = await db.query(
            `INSERT INTO question_abcd
             (quiz_id, title, answer_a, answer_a_correct, answer_b, answer_b_correct,
              answer_c, answer_c_correct, answer_d, answer_d_correct, \`order\`, path, image,
              video, media_type, is_random, weight, status, created_at, updated_at)
             SELECT ?, title, answer_a, answer_a_correct, answer_b, answer_b_correct,
                    answer_c, answer_c_correct, answer_d, answer_d_correct, \`order\`, path, image,
                    video, media_type, is_random, weight, status, ?, ?
             FROM question_abcd WHERE id = ?`,
            [newQuizId, now, now, q.question_id]
          );
          newDetailId = detailResult.insertId;
        }
        // Add other types as needed...

        if (newDetailId) {
          await db.query(
            `INSERT INTO question (quiz_id, question_id, type, \`order\`, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, ?, ?)`,
            [newQuizId, newDetailId, q.type, q.order, now, now]
          );
        }
      }
    }

    return this.getById(newQuizId);
  }

  /**
   * Get statistics
   */
  async getStats() {
    const db = this.getDb();
    const [rows] = await db.query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN is_publish = 1 THEN 1 ELSE 0 END) as published,
         SUM(CASE WHEN is_publish = 0 THEN 1 ELSE 0 END) as draft
       FROM ${this.table}
       WHERE deleted_at IS NULL`
    );
    return rows[0];
  }

  /**
   * Get status label
   */
  static getStatusLabel(status) {
    const labels = {
      0: 'Draft',
      1: 'Published'
    };
    return labels[status] || 'Unknown';
  }

  /**
   * Get status badge class
   */
  static getStatusBadgeClass(status) {
    const classes = {
      0: 'bg-label-warning',
      1: 'bg-label-success'
    };
    return classes[status] || 'bg-label-secondary';
  }
}

// Export both class and instance
export { Quiz };
export default new Quiz();
