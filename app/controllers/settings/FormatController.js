import Format from '../../models/Format.js';

/**
 * Format Controller
 * Handles all format-related operations
 */
class FormatController {
  /**
   * Display list of formats
   */
  async index(req, res) {
    try {
      const formats = await Format.findAll({
        orderBy: '`order` ASC, id ASC'
      });

      res.render('settings/format-list', {
        pageTitle: 'Format Management',
        formats,
        query: req.query
      });
    } catch (error) {
      console.error('FormatController.index error:', error);
      res.render('settings/format-list', {
        pageTitle: 'Format Management',
        formats: [],
        query: req.query,
        error: 'Failed to load formats'
      });
    }
  }

  /**
   * Display create form
   */
  async create(req, res) {
    res.render('settings/format-form', {
      pageTitle: 'Create Format',
      format: null,
      action: 'create'
    });
  }

  /**
   * Store new format
   */
  async store(req, res) {
    try {
      const { name, order, status } = req.body;

      // Validate
      if (!name || name.trim() === '') {
        return res.render('settings/format-form', {
          pageTitle: 'Create Format',
          format: req.body,
          action: 'create',
          error: 'Format name is required'
        });
      }

      // Check if name exists
      if (await Format.nameExists(name)) {
        return res.render('settings/format-form', {
          pageTitle: 'Create Format',
          format: req.body,
          action: 'create',
          error: 'Format name already exists'
        });
      }

      await Format.create({
        name: name.trim(),
        order: parseInt(order) || 999,
        status: status === 'on' ? 1 : 0
      });

      res.redirect('/settings/format?success=created');
    } catch (error) {
      console.error('FormatController.store error:', error);
      res.render('settings/format-form', {
        pageTitle: 'Create Format',
        format: req.body,
        action: 'create',
        error: 'Failed to create format'
      });
    }
  }

  /**
   * Display edit form
   */
  async edit(req, res) {
    try {
      const format = await Format.findById(req.params.id);

      if (!format) {
        return res.redirect('/settings/format?error=notfound');
      }

      res.render('settings/format-form', {
        pageTitle: 'Edit Format',
        format,
        action: 'edit'
      });
    } catch (error) {
      console.error('FormatController.edit error:', error);
      res.redirect('/settings/format?error=fetch');
    }
  }

  /**
   * Update format
   */
  async update(req, res) {
    try {
      const { name, order, status } = req.body;
      const id = req.params.id;

      // Validate
      if (!name || name.trim() === '') {
        const format = await Format.findById(id);
        return res.render('settings/format-form', {
          pageTitle: 'Edit Format',
          format: { ...format, ...req.body },
          action: 'edit',
          error: 'Format name is required'
        });
      }

      // Check if name exists (excluding current)
      if (await Format.nameExists(name, id)) {
        const format = await Format.findById(id);
        return res.render('settings/format-form', {
          pageTitle: 'Edit Format',
          format: { ...format, ...req.body },
          action: 'edit',
          error: 'Format name already exists'
        });
      }

      await Format.update(id, {
        name: name.trim(),
        order: parseInt(order) || 999,
        status: status === 'on' ? 1 : 0
      });

      res.redirect('/settings/format?success=updated');
    } catch (error) {
      console.error('FormatController.update error:', error);
      res.redirect(`/settings/format/${req.params.id}/edit?error=update`);
    }
  }

  /**
   * Delete format (soft delete)
   */
  async destroy(req, res) {
    try {
      await Format.delete(req.params.id);
      res.redirect('/settings/format?success=deleted');
    } catch (error) {
      console.error('FormatController.destroy error:', error);
      res.redirect('/settings/format?error=delete');
    }
  }
}

export default new FormatController();
