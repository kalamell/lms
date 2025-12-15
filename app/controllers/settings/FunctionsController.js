import Functions from '../../models/Functions.js';
import Format from '../../models/Format.js';

/**
 * Functions Controller
 * Handles all functions-related operations
 */
class FunctionsController {
  /**
   * Display list of functions
   */
  async index(req, res) {
    try {
      const [functions, formats] = await Promise.all([
        Functions.getAllWithFormat(),
        Format.getForSelect()
      ]);

      res.render('settings/functions-list', {
        pageTitle: 'Functions Management',
        functions,
        formats,
        query: req.query
      });
    } catch (error) {
      console.error('FunctionsController.index error:', error);
      res.render('settings/functions-list', {
        pageTitle: 'Functions Management',
        functions: [],
        formats: [],
        query: req.query,
        error: 'Failed to load functions'
      });
    }
  }

  /**
   * Display create form
   */
  async create(req, res) {
    try {
      const formats = await Format.getForSelect();

      res.render('settings/functions-form', {
        pageTitle: 'Create Function',
        func: null,
        formats,
        action: 'create'
      });
    } catch (error) {
      console.error('FunctionsController.create error:', error);
      res.redirect('/settings/functions?error=fetch');
    }
  }

  /**
   * Store new function
   */
  async store(req, res) {
    try {
      const { format_id, name, color, order, status } = req.body;

      // Validate
      if (!format_id || !name || name.trim() === '') {
        const formats = await Format.getForSelect();
        return res.render('settings/functions-form', {
          pageTitle: 'Create Function',
          func: req.body,
          formats,
          action: 'create',
          error: 'Format and Function name are required'
        });
      }

      await Functions.create({
        format_id: parseInt(format_id),
        name: name.trim(),
        color: color || null,
        order: parseInt(order) || 999,
        status: status === 'on' ? 1 : 0
      });

      res.redirect('/settings/functions?success=created');
    } catch (error) {
      console.error('FunctionsController.store error:', error);
      res.redirect('/settings/functions/create?error=create');
    }
  }

  /**
   * Display edit form
   */
  async edit(req, res) {
    try {
      const [func, formats] = await Promise.all([
        Functions.findById(req.params.id),
        Format.getForSelect()
      ]);

      if (!func) {
        return res.redirect('/settings/functions?error=notfound');
      }

      res.render('settings/functions-form', {
        pageTitle: 'Edit Function',
        func,
        formats,
        action: 'edit'
      });
    } catch (error) {
      console.error('FunctionsController.edit error:', error);
      res.redirect('/settings/functions?error=fetch');
    }
  }

  /**
   * Update function
   */
  async update(req, res) {
    try {
      const { format_id, name, color, order, status } = req.body;
      const id = req.params.id;

      // Validate
      if (!format_id || !name || name.trim() === '') {
        return res.redirect(`/settings/functions/${id}/edit?error=validation`);
      }

      await Functions.update(id, {
        format_id: parseInt(format_id),
        name: name.trim(),
        color: color || null,
        order: parseInt(order) || 999,
        status: status === 'on' ? 1 : 0
      });

      res.redirect('/settings/functions?success=updated');
    } catch (error) {
      console.error('FunctionsController.update error:', error);
      res.redirect(`/settings/functions/${req.params.id}/edit?error=update`);
    }
  }

  /**
   * Delete function (soft delete)
   */
  async destroy(req, res) {
    try {
      await Functions.delete(req.params.id);
      res.redirect('/settings/functions?success=deleted');
    } catch (error) {
      console.error('FunctionsController.destroy error:', error);
      res.redirect('/settings/functions?error=delete');
    }
  }

  /**
   * API: Get functions by format ID
   */
  async getByFormat(req, res) {
    try {
      const functions = await Functions.getByFormatId(req.params.formatId);
      res.json(functions);
    } catch (error) {
      console.error('FunctionsController.getByFormat error:', error);
      res.status(500).json({ error: 'Failed to fetch functions' });
    }
  }
}

export default new FunctionsController();
