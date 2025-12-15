import Department from '../../models/Department.js';
import Functions from '../../models/Functions.js';

/**
 * Department Controller
 * Handles all department-related operations
 */
class DepartmentController {
  /**
   * Display list of departments
   */
  async index(req, res) {
    try {
      const [departments, functions] = await Promise.all([
        Department.getAllWithRelations(),
        Functions.getForSelect()
      ]);

      res.render('settings/department-list', {
        pageTitle: 'Department Management',
        departments,
        functions,
        query: req.query
      });
    } catch (error) {
      console.error('DepartmentController.index error:', error);
      res.render('settings/department-list', {
        pageTitle: 'Department Management',
        departments: [],
        functions: [],
        query: req.query,
        error: 'Failed to load departments'
      });
    }
  }

  /**
   * Display create form
   */
  async create(req, res) {
    try {
      const functions = await Functions.getForSelect();

      res.render('settings/department-form', {
        pageTitle: 'Create Department',
        department: null,
        functions,
        action: 'create'
      });
    } catch (error) {
      console.error('DepartmentController.create error:', error);
      res.redirect('/settings/department?error=fetch');
    }
  }

  /**
   * Store new department
   */
  async store(req, res) {
    try {
      const { functions_id, name, order, status } = req.body;

      // Validate
      if (!functions_id || !name || name.trim() === '') {
        const functions = await Functions.getForSelect();
        return res.render('settings/department-form', {
          pageTitle: 'Create Department',
          department: req.body,
          functions,
          action: 'create',
          error: 'Function and Department name are required'
        });
      }

      await Department.create({
        functions_id: parseInt(functions_id),
        name: name.trim(),
        order: parseInt(order) || 999,
        status: status === 'on' ? 1 : 0
      });

      res.redirect('/settings/department?success=created');
    } catch (error) {
      console.error('DepartmentController.store error:', error);
      res.redirect('/settings/department/create?error=create');
    }
  }

  /**
   * Display edit form
   */
  async edit(req, res) {
    try {
      const [department, functions] = await Promise.all([
        Department.findById(req.params.id),
        Functions.getForSelect()
      ]);

      if (!department) {
        return res.redirect('/settings/department?error=notfound');
      }

      res.render('settings/department-form', {
        pageTitle: 'Edit Department',
        department,
        functions,
        action: 'edit'
      });
    } catch (error) {
      console.error('DepartmentController.edit error:', error);
      res.redirect('/settings/department?error=fetch');
    }
  }

  /**
   * Update department
   */
  async update(req, res) {
    try {
      const { functions_id, name, order, status } = req.body;
      const id = req.params.id;

      // Validate
      if (!functions_id || !name || name.trim() === '') {
        return res.redirect(`/settings/department/${id}/edit?error=validation`);
      }

      await Department.update(id, {
        functions_id: parseInt(functions_id),
        name: name.trim(),
        order: parseInt(order) || 999,
        status: status === 'on' ? 1 : 0
      });

      res.redirect('/settings/department?success=updated');
    } catch (error) {
      console.error('DepartmentController.update error:', error);
      res.redirect(`/settings/department/${req.params.id}/edit?error=update`);
    }
  }

  /**
   * Delete department (soft delete)
   */
  async destroy(req, res) {
    try {
      await Department.delete(req.params.id);
      res.redirect('/settings/department?success=deleted');
    } catch (error) {
      console.error('DepartmentController.destroy error:', error);
      res.redirect('/settings/department?error=delete');
    }
  }

  /**
   * API: Get departments by function ID
   */
  async getByFunction(req, res) {
    try {
      const departments = await Department.getByFunctionsId(req.params.functionsId);
      res.json(departments);
    } catch (error) {
      console.error('DepartmentController.getByFunction error:', error);
      res.status(500).json({ error: 'Failed to fetch departments' });
    }
  }
}

export default new DepartmentController();
