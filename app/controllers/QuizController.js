import QuizModel, { Quiz } from '../models/Quiz.js';
import QuestionAbcdModel from '../models/QuestionAbcd.js';
import { getTescoDb } from '../config/database.js';

/**
 * Quiz Controller
 * Handles all quiz management operations
 */
class QuizController {
  /**
   * Display list of quizzes
   */
  async index(req, res) {
    try {
      const { k: keyword, course_id: courseId, status, page = 1 } = req.query;

      const [result, stats] = await Promise.all([
        QuizModel.getAllWithFilters({
          keyword,
          courseId,
          status,
          page: parseInt(page) || 1,
          perPage: 20
        }),
        QuizModel.getStats()
      ]);

      res.render('settings/quiz/list', {
        pageTitle: 'Quiz Management',
        quizzes: result.data,
        pagination: result.pagination,
        stats,
        filters: { keyword, courseId, status },
        query: req.query,
        Quiz
      });
    } catch (error) {
      console.error('QuizController.index error:', error);
      res.render('settings/quiz/list', {
        pageTitle: 'Quiz Management',
        quizzes: [],
        pagination: { total: 0, totalPages: 0, currentPage: 1, perPage: 20 },
        stats: { total: 0, published: 0, draft: 0 },
        filters: {},
        query: req.query,
        Quiz,
        error: 'Failed to load quizzes'
      });
    }
  }

  /**
   * Display create form
   */
  async create(req, res) {
    try {
      // Get only active courses for dropdown from tesco_elearning (status=1 is Active)
      const db = getTescoDb();
      const [courses] = await db.query(
        'SELECT id, name FROM course WHERE deleted_at IS NULL AND status = 1 ORDER BY name LIMIT 2000'
      );

      res.render('settings/quiz/form', {
        pageTitle: 'Create Quiz',
        quiz: null,
        action: 'create',
        courses,
        Quiz
      });
    } catch (error) {
      console.error('QuizController.create error:', error);
      res.redirect('/settings/quiz?error=fetch');
    }
  }

  /**
   * Store new quiz
   */
  async store(req, res) {
    try {
      const data = this.extractFormData(req);

      // Validate
      if (!data.title || data.title.trim() === '') {
        return res.redirect('/settings/quiz/create?error=title_required');
      }

      if (!data.course_id) {
        return res.redirect('/settings/quiz/create?error=course_required');
      }

      data.user_id = req.session.user?.id || 1;

      const quiz = await QuizModel.create(data);
      res.redirect(`/settings/quiz/${quiz.id}/edit?success=created`);
    } catch (error) {
      console.error('QuizController.store error:', error);
      res.redirect('/settings/quiz/create?error=create_failed');
    }
  }

  /**
   * Display edit form
   */
  async edit(req, res) {
    try {
      const quizId = req.params.id;
      const db = getTescoDb();

      const [quiz, [courses]] = await Promise.all([
        QuizModel.getWithQuestions(quizId),
        db.query('SELECT id, name FROM course WHERE deleted_at IS NULL AND status = 1 ORDER BY name LIMIT 2000')
      ]);

      if (!quiz) {
        return res.redirect('/settings/quiz?error=notfound');
      }

      res.render('settings/quiz/form', {
        pageTitle: 'Edit Quiz',
        quiz,
        action: 'edit',
        courses,
        Quiz
      });
    } catch (error) {
      console.error('QuizController.edit error:', error);
      res.redirect('/settings/quiz?error=fetch');
    }
  }

  /**
   * Update quiz
   */
  async update(req, res) {
    try {
      const id = req.params.id;
      const data = this.extractFormData(req);

      // Handle submit action
      if (req.body.submit === 'publish') {
        data.is_publish = 1;
      } else if (req.body.submit === 'draft') {
        data.is_publish = 0;
      } else if (req.body.submit === 'duplicate') {
        const newQuiz = await QuizModel.duplicate(id);
        if (newQuiz) {
          return res.redirect(`/settings/quiz/${newQuiz.id}/edit?success=duplicated`);
        }
        return res.redirect(`/settings/quiz/${id}/edit?error=duplicate_failed`);
      }

      await QuizModel.update(id, data);
      res.redirect(`/settings/quiz/${id}/edit?success=updated`);
    } catch (error) {
      console.error('QuizController.update error:', error);
      res.redirect(`/settings/quiz/${req.params.id}/edit?error=update`);
    }
  }

  /**
   * Delete quiz
   */
  async destroy(req, res) {
    try {
      await QuizModel.delete(req.params.id);
      res.redirect('/settings/quiz?success=deleted');
    } catch (error) {
      console.error('QuizController.destroy error:', error);
      res.redirect('/settings/quiz?error=delete');
    }
  }

  /**
   * Extract form data
   */
  extractFormData(req) {
    const {
      course_id,
      title,
      description,
      score,
      is_random_question,
      is_show_answer,
      type,
      video
    } = req.body;

    return {
      course_id: parseInt(course_id) || null,
      title: title?.trim() || null,
      description: description || null,
      score: parseInt(score) || 80,
      is_random_question: is_random_question ? 1 : 0,
      is_show_answer: is_show_answer ? 1 : 0,
      type: parseInt(type) || 1,
      video: video || null
    };
  }

  // ============================================
  // Question ABCD APIs
  // ============================================

  /**
   * API: Create ABCD question
   */
  async apiCreateQuestionAbcd(req, res) {
    try {
      const quizId = req.params.id;
      const data = { ...req.body, quiz_id: quizId };

      const question = await QuestionAbcdModel.create(data);

      // Get updated quiz with questions
      const quiz = await QuizModel.getWithQuestions(quizId);

      res.json({
        success: true,
        question,
        questions: quiz.questions
      });
    } catch (error) {
      console.error('QuizController.apiCreateQuestionAbcd error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * API: Update ABCD question
   */
  async apiUpdateQuestionAbcd(req, res) {
    try {
      const { questionId } = req.params;
      const data = req.body;

      const question = await QuestionAbcdModel.update(questionId, data);

      res.json({ success: true, question });
    } catch (error) {
      console.error('QuizController.apiUpdateQuestionAbcd error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * API: Delete question
   */
  async apiDeleteQuestion(req, res) {
    try {
      const { questionId } = req.params;
      const { type } = req.body;

      if (type === 1 || type === 'abcd') {
        await QuestionAbcdModel.delete(questionId);
      }
      // Add other types as needed

      res.json({ success: true });
    } catch (error) {
      console.error('QuizController.apiDeleteQuestion error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * API: Get quiz data
   */
  async apiGet(req, res) {
    try {
      const quiz = await QuizModel.getWithQuestions(req.params.id);
      if (!quiz) {
        return res.status(404).json({ success: false, error: 'Quiz not found' });
      }
      res.json({ success: true, data: quiz });
    } catch (error) {
      console.error('QuizController.apiGet error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * API: Get single ABCD question
   */
  async apiGetQuestionAbcd(req, res) {
    try {
      const { questionId } = req.params;
      const question = await QuestionAbcdModel.getById(questionId);
      if (!question) {
        return res.status(404).json({ success: false, error: 'Question not found' });
      }
      res.json({ success: true, data: question });
    } catch (error) {
      console.error('QuizController.apiGetQuestionAbcd error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * API: Reorder questions
   */
  async apiReorderQuestions(req, res) {
    try {
      const { id: quizId } = req.params;
      const { orders } = req.body; // Array of { id: questionId, order: newOrder }

      const db = getTescoDb();
      const now = new Date();

      for (const item of orders) {
        await db.query(
          'UPDATE question SET `order` = ?, updated_at = ? WHERE id = ? AND quiz_id = ?',
          [item.order, now, item.id, quizId]
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error('QuizController.apiReorderQuestions error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * API: List quizzes
   */
  async apiList(req, res) {
    try {
      const { keyword, course_id: courseId, status, page = 1, perPage = 50 } = req.query;
      const result = await QuizModel.getAllWithFilters({
        keyword,
        courseId,
        status,
        page: parseInt(page),
        perPage: parseInt(perPage)
      });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      console.error('QuizController.apiList error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new QuizController();
