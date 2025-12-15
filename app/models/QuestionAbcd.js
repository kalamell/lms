import { getTescoDb } from '../config/database.js';

/**
 * QuestionAbcd Model
 * Manages ABCD type questions
 */
class QuestionAbcd {
  constructor() {
    this.table = 'question_abcd';
    this.questionTable = 'question';
  }

  getDb() {
    return getTescoDb();
  }

  /**
   * Get question by ID
   */
  async getById(id) {
    const db = this.getDb();
    const [rows] = await db.query(
      `SELECT * FROM ${this.table} WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Get all questions for a quiz
   */
  async getByQuizId(quizId) {
    const db = this.getDb();
    const [rows] = await db.query(
      `SELECT qa.*, q.order as sort_order
       FROM ${this.table} qa
       JOIN ${this.questionTable} q ON q.question_id = qa.id AND q.type = 1
       WHERE qa.quiz_id = ? AND qa.deleted_at IS NULL
       ORDER BY q.order ASC`,
      [quizId]
    );
    return rows;
  }

  /**
   * Create new ABCD question
   */
  async create(data) {
    const db = this.getDb();
    const now = new Date();

    // Insert into question_abcd
    const [result] = await db.query(
      `INSERT INTO ${this.table}
       (quiz_id, title, answer_a, answer_a_correct, answer_b, answer_b_correct,
        answer_c, answer_c_correct, answer_d, answer_d_correct, \`order\`, path, image,
        video, media_type, is_random, weight, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        data.quiz_id,
        data.title,
        data.answer_a || '',
        data.answer_a_correct || 0,
        data.answer_b || '',
        data.answer_b_correct || 0,
        data.answer_c || '',
        data.answer_c_correct || 0,
        data.answer_d || '',
        data.answer_d_correct || 0,
        data.order || 9999,
        data.path || null,
        data.image || null,
        data.video || null,
        data.media_type || 1,
        data.is_random || 0,
        data.weight || 1,
        now,
        now
      ]
    );

    const questionAbcdId = result.insertId;

    // Insert into question table
    await db.query(
      `INSERT INTO ${this.questionTable}
       (quiz_id, question_id, type, \`order\`, status, created_at, updated_at)
       VALUES (?, ?, 1, ?, 1, ?, ?)`,
      [data.quiz_id, questionAbcdId, data.order || 9999, now, now]
    );

    return this.getById(questionAbcdId);
  }

  /**
   * Update ABCD question
   */
  async update(id, data) {
    const db = this.getDb();
    const now = new Date();

    const fields = [];
    const values = [];

    const allowedFields = [
      'title', 'answer_a', 'answer_a_correct', 'answer_b', 'answer_b_correct',
      'answer_c', 'answer_c_correct', 'answer_d', 'answer_d_correct',
      'order', 'path', 'image', 'video', 'media_type', 'is_random', 'weight'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`\`${field}\` = ?`);
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
   * Delete question (soft delete)
   */
  async delete(id) {
    const db = this.getDb();
    const now = new Date();

    // Delete from question_abcd
    await db.query(
      `UPDATE ${this.table} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );

    // Delete from question table
    await db.query(
      `UPDATE ${this.questionTable} SET deleted_at = ?, updated_at = ? WHERE question_id = ? AND type = 1`,
      [now, now, id]
    );

    return true;
  }
}

export default new QuestionAbcd();
