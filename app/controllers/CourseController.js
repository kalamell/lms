import CourseModel, { Course } from '../models/Course.js';
import DocumentModel, { Document } from '../models/Document.js';
import CourseDocumentModel from '../models/CourseDocument.js';
import PositionModel from '../models/Position.js';
import CoursePositionModel from '../models/CoursePosition.js';

/**
 * Course Controller
 * Handles all course management operations
 */
class CourseController {
  /**
   * Display list of courses
   */
  async index(req, res) {
    try {
      const { k: keyword, status, type, page = 1 } = req.query;

      const [result, stats] = await Promise.all([
        CourseModel.getAllWithFilters({ keyword, status, type, page: parseInt(page) || 1, perPage: 20 }),
        CourseModel.getStats()
      ]);

      res.render('course/list', {
        pageTitle: 'Course Management',
        courses: result.data,
        pagination: result.pagination,
        stats,
        filters: { keyword, status, type },
        query: req.query,
        Course
      });
    } catch (error) {
      console.error('CourseController.index error:', error);
      res.render('course/list', {
        pageTitle: 'Course Management',
        courses: [],
        pagination: { total: 0, totalPages: 0, currentPage: 1, perPage: 20 },
        stats: { total: 0, active: 0, draft: 0, inactive: 0 },
        filters: {},
        query: req.query,
        Course,
        error: 'Failed to load courses'
      });
    }
  }

  /**
   * Display create form
   */
  async create(req, res) {
    try {
      const allPositions = await PositionModel.getAll();

      res.render('course/form', {
        pageTitle: 'Create Course',
        course: null,
        action: 'create',
        Course,
        Document,
        courseDocuments: [],
        coursePositions: [],
        allPositions,
        positionIds: []
      });
    } catch (error) {
      console.error('CourseController.create error:', error);
      res.redirect('/course?error=fetch');
    }
  }

  /**
   * Store new course
   */
  async store(req, res) {
    try {
      const data = this.extractFormData(req);

      // Validate
      if (!data.name || data.name.trim() === '') {
        return res.render('course/form', {
          pageTitle: 'Create Course',
          course: req.body,
          action: 'create',
          Course,
          error: 'Course name is required'
        });
      }

      // Check if course code exists
      if (data.course_code && await CourseModel.codeExists(data.course_code)) {
        return res.render('course/form', {
          pageTitle: 'Create Course',
          course: req.body,
          action: 'create',
          Course,
          error: 'Course code already exists'
        });
      }

      // Handle file uploads (multer format with Laravel-style paths)
      if (req.files) {
        if (req.files.icon && req.files.icon[0]) {
          data.icon = req.files.icon[0].filename;
          data.icon_path = req.uploadPath || '';
        }
        if (req.files.cover && req.files.cover[0]) {
          data.cover = req.files.cover[0].filename;
          data.cover_path = req.uploadPath || '';
        }
      }

      data.user_id = req.session.user?.id || 1;
      data.department_id = 1;

      await CourseModel.create(data);
      res.redirect('/course?success=created');
    } catch (error) {
      console.error('CourseController.store error:', error);
      res.render('course/form', {
        pageTitle: 'Create Course',
        course: req.body,
        action: 'create',
        Course,
        error: 'Failed to create course: ' + error.message
      });
    }
  }

  /**
   * Display edit form
   */
  async edit(req, res) {
    try {
      const courseId = req.params.id;
      const [course, courseDocuments, coursePositions, allPositions] = await Promise.all([
        CourseModel.getWithDetails(courseId),
        CourseDocumentModel.getDocumentsForCourse(courseId),
        CoursePositionModel.getPositionsForCourse(courseId),
        PositionModel.getAll()
      ]);

      if (!course) {
        return res.redirect('/course?error=notfound');
      }

      // Get position IDs for the course
      const positionIds = coursePositions.map(p => p.position_id);

      res.render('course/form', {
        pageTitle: 'Edit Course',
        course,
        action: 'edit',
        Course,
        Document,
        courseDocuments,
        coursePositions,
        allPositions,
        positionIds
      });
    } catch (error) {
      console.error('CourseController.edit error:', error);
      res.redirect('/course?error=fetch');
    }
  }

  /**
   * Update course
   */
  async update(req, res) {
    try {
      const id = req.params.id;
      const data = this.extractFormData(req);

      // Validate
      if (!data.name || data.name.trim() === '') {
        const course = await CourseModel.findById(id);
        return res.render('course/form', {
          pageTitle: 'Edit Course',
          course: { ...course, ...req.body },
          action: 'edit',
          Course,
          error: 'Course name is required'
        });
      }

      // Check if course code exists
      if (data.course_code && await CourseModel.codeExists(data.course_code, id)) {
        const course = await CourseModel.findById(id);
        return res.render('course/form', {
          pageTitle: 'Edit Course',
          course: { ...course, ...req.body },
          action: 'edit',
          Course,
          error: 'Course code already exists'
        });
      }

      // Handle file uploads (multer format with Laravel-style paths)
      if (req.files) {
        if (req.files.icon && req.files.icon[0]) {
          data.icon = req.files.icon[0].filename;
          data.icon_path = req.uploadPath || '';
        }
        if (req.files.cover && req.files.cover[0]) {
          data.cover = req.files.cover[0].filename;
          data.cover_path = req.uploadPath || '';
        }
      }

      await CourseModel.update(id, data);
      res.redirect('/course?success=updated');
    } catch (error) {
      console.error('CourseController.update error:', error);
      res.redirect(`/course/${req.params.id}/edit?error=update`);
    }
  }

  /**
   * Delete course (soft delete)
   */
  async destroy(req, res) {
    try {
      await CourseModel.delete(req.params.id);
      res.redirect('/course?success=deleted');
    } catch (error) {
      console.error('CourseController.destroy error:', error);
      res.redirect('/course?error=delete');
    }
  }

  /**
   * Duplicate course
   */
  async duplicate(req, res) {
    try {
      const newCourse = await CourseModel.duplicate(req.params.id);
      if (newCourse) {
        res.redirect(`/course/${newCourse.id}/edit?success=duplicated`);
      } else {
        res.redirect('/course?error=duplicate');
      }
    } catch (error) {
      console.error('CourseController.duplicate error:', error);
      res.redirect('/course?error=duplicate');
    }
  }

  /**
   * Extract form data from request
   */
  extractFormData(req) {
    const {
      name,
      course_code,
      expire_at,
      totaltopic,
      keywords,
      courselevel,
      howtopass,
      description,
      toc,
      howto,
      targetlearner,
      pretest,
      pre_testing,
      pretest_description,
      class_description,
      posttest,
      post_testing,
      posttest_description,
      homework,
      example_description,
      sendemail,
      evaluate_link,
      email_template,
      status,
      type,
      course_show,
      course_access,
      course_group,
      is_register,
      delete_all,
      fullscreen,
      is_certificated,
      is_document_lock,
      status_action
    } = req.body;

    // If status_action is provided (from Publish/Draft buttons), use it
    const finalStatus = status_action || status;

    return {
      name: name?.trim() || null,
      course_code: course_code?.trim() || null,
      expire_at: expire_at || null,
      totaltopic: totaltopic || null,
      keywords: keywords || null,
      courselevel: courselevel || null,
      howtopass: howtopass || null,
      description: description || null,
      toc: toc || null,
      howto: howto || null,
      targetlearner: targetlearner || null,
      pretest: pretest == '1' ? 1 : 0,
      pre_testing: pre_testing || null,
      pretest_description: pretest_description || null,
      class_description: class_description || null,
      posttest: posttest == '1' ? 1 : 0,
      post_testing: post_testing || null,
      posttest_description: posttest_description || null,
      homework: homework == '1' ? 1 : 0,
      example_description: example_description || null,
      sendemail: sendemail == '1' ? 1 : 0,
      evaluate_link: evaluate_link || null,
      email_template: email_template || null,
      status: parseInt(finalStatus) || Course.STATUS_DRAFT,
      type: parseInt(type) || Course.TYPE_NORMAL,
      course_show: course_show || null,
      course_access: course_access || null,
      course_group: course_group || null,
      is_register: is_register ? 1 : 0,
      delete_all: delete_all ? 1 : 0,
      fullscreen: fullscreen ? 1 : 0,
      is_certificated: is_certificated ? 1 : 0,
      is_document_lock: is_document_lock ? 1 : 0
    };
  }

  /**
   * API: Get courses for AJAX
   */
  async apiList(req, res) {
    try {
      const { keyword, status, type, page = 1, perPage = 50 } = req.query;
      const result = await CourseModel.getAllWithFilters({
        keyword,
        status,
        type,
        page: parseInt(page),
        perPage: parseInt(perPage)
      });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      console.error('CourseController.apiList error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch courses' });
    }
  }

  /**
   * API: Get course by ID
   */
  async apiGet(req, res) {
    try {
      const course = await CourseModel.getWithDetails(req.params.id);
      if (!course) {
        return res.status(404).json({ success: false, error: 'Course not found' });
      }
      res.json({ success: true, data: course });
    } catch (error) {
      console.error('CourseController.apiGet error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch course' });
    }
  }

  // ============================================
  // Document Management APIs
  // ============================================

  /**
   * API: Search available documents
   */
  async apiSearchDocuments(req, res) {
    try {
      const { k: keyword, courseId } = req.query;

      // Get IDs of documents already in this course
      const excludeIds = courseId
        ? await CourseDocumentModel.getDocumentIds(courseId)
        : [];

      const documents = await DocumentModel.getAllWithFilters({
        keyword,
        excludeIds,
        limit: 50
      });

      res.json({
        success: true,
        data: documents.map(d => ({
          ...d,
          typeLabel: Document.getTypeLabel(d.type),
          typeIcon: Document.getTypeIcon(d.type)
        }))
      });
    } catch (error) {
      console.error('CourseController.apiSearchDocuments error:', error);
      res.status(500).json({ success: false, error: 'Failed to search documents' });
    }
  }

  /**
   * API: Get course documents
   */
  async apiGetCourseDocuments(req, res) {
    try {
      const documents = await CourseDocumentModel.getDocumentsForCourse(req.params.id);
      res.json({ success: true, data: documents });
    } catch (error) {
      console.error('CourseController.apiGetCourseDocuments error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch documents' });
    }
  }

  /**
   * API: Add document to course
   */
  async apiAddDocument(req, res) {
    try {
      const { documentId } = req.body;
      const courseId = req.params.id;

      await CourseDocumentModel.addDocument(courseId, documentId);
      const documents = await CourseDocumentModel.getDocumentsForCourse(courseId);

      res.json({ success: true, data: documents });
    } catch (error) {
      console.error('CourseController.apiAddDocument error:', error);
      res.status(500).json({ success: false, error: 'Failed to add document' });
    }
  }

  /**
   * API: Remove document from course
   */
  async apiRemoveDocument(req, res) {
    try {
      const { documentId } = req.body;
      const courseId = req.params.id;

      await CourseDocumentModel.removeDocument(courseId, documentId);
      const documents = await CourseDocumentModel.getDocumentsForCourse(courseId);

      res.json({ success: true, data: documents });
    } catch (error) {
      console.error('CourseController.apiRemoveDocument error:', error);
      res.status(500).json({ success: false, error: 'Failed to remove document' });
    }
  }

  /**
   * API: Update document order
   */
  async apiUpdateDocumentOrder(req, res) {
    try {
      const { documentIds } = req.body;
      const courseId = req.params.id;

      await CourseDocumentModel.updateOrder(courseId, documentIds);
      res.json({ success: true });
    } catch (error) {
      console.error('CourseController.apiUpdateDocumentOrder error:', error);
      res.status(500).json({ success: false, error: 'Failed to update order' });
    }
  }

  // ============================================
  // Position Management APIs
  // ============================================

  /**
   * API: Search positions
   */
  async apiSearchPositions(req, res) {
    try {
      const { k: keyword } = req.query;
      const positions = keyword
        ? await PositionModel.search(keyword)
        : await PositionModel.getAll();

      res.json({ success: true, data: positions });
    } catch (error) {
      console.error('CourseController.apiSearchPositions error:', error);
      res.status(500).json({ success: false, error: 'Failed to search positions' });
    }
  }

  /**
   * API: Get course positions
   */
  async apiGetCoursePositions(req, res) {
    try {
      const positions = await CoursePositionModel.getPositionsForCourse(req.params.id);
      res.json({ success: true, data: positions });
    } catch (error) {
      console.error('CourseController.apiGetCoursePositions error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch positions' });
    }
  }

  /**
   * API: Sync course positions
   */
  async apiSyncPositions(req, res) {
    try {
      const { positionIds } = req.body;
      const courseId = req.params.id;

      await CoursePositionModel.syncPositions(courseId, positionIds || []);
      const positions = await CoursePositionModel.getPositionsForCourse(courseId);

      res.json({ success: true, data: positions, message: 'Positions updated' });
    } catch (error) {
      console.error('CourseController.apiSyncPositions error:', error);
      res.status(500).json({ success: false, error: 'Failed to sync positions' });
    }
  }
}

export default new CourseController();
