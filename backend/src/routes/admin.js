import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { generateAdmissionNumber } from '../utils/helpers.js';
import { generateQualificationReasoning } from '../services/qualificationAi.js';
import PDFDocument from 'pdfkit';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

router.use(authMiddleware, adminMiddleware);

router.get('/dashboard', async (_req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE verification_status = 'pending') as under_verification,
        COUNT(*) FILTER (WHERE qualification_status = 'qualified') as qualified,
        COUNT(*) FILTER (WHERE admission_status = 'admitted') as admitted
      FROM applications WHERE status != 'draft'
    `);

    const timeline = await pool.query(`
      SELECT DATE(submitted_at) as date, COUNT(*) as count
      FROM applications
      WHERE submitted_at IS NOT NULL AND submitted_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(submitted_at)
      ORDER BY date
    `);

    const paymentStats = await pool.query(`
      SELECT
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_collected,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0) as total_failed_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending_amount,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_payments,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN amount ELSE 0 END), 0) as today_amount,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE AND status = 'completed' THEN amount ELSE 0 END), 0) as today_collected_amount
      FROM payments
    `);

    res.json({ 
      stats: stats.rows[0], 
      timeline: timeline.rows,
      paymentStats: paymentStats.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/applications', async (req, res) => {
  try {
    const { status, verificationStatus } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Build base where clause
    let where = `WHERE a.status != 'draft'`;
    const params = [];
    let idx = 1;
    if (status) {
      where += ` AND a.status = $${idx}`;
      params.push(status);
      idx++;
    }
    if (verificationStatus) {
      where += ` AND a.verification_status = $${idx}`;
      params.push(verificationStatus);
      idx++;
    }

    // Count total matching
    const countQuery = `SELECT COUNT(*) as total FROM applications a ${where}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total || 0);

    // Fetch paginated rows
    const query = `
      SELECT a.*, s.full_name, s.email, s.kcse_grade, p.name as programme_name
      FROM applications a
      JOIN students s ON s.id = a.student_id
      JOIN programmes p ON p.id = a.programme_id
      ${where}
      ORDER BY a.submitted_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const queryParams = params.concat([limit, offset]);
    const result = await pool.query(query, queryParams);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

router.get('/applications/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, s.*, p.name as programme_name, p.min_qualification, p.min_grade_points,
              p.fees, p.duration, p.intake as programme_intake,
              latest_payment.status as payment_status,
              latest_payment.reference as payment_reference,
              latest_payment.amount as payment_amount
       FROM applications a
       JOIN students s ON s.id = a.student_id
       JOIN programmes p ON p.id = a.programme_id
       LEFT JOIN LATERAL (
         SELECT status, reference, amount
         FROM payments
         WHERE application_id = a.id
         ORDER BY created_at DESC
         LIMIT 1
       ) latest_payment ON TRUE
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = result.rows[0];
    const docs = await pool.query(
      'SELECT * FROM application_documents WHERE application_id = $1',
      [app.id]
    );
    app.documents = docs.rows;
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

router.patch('/applications/:id/verify', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { status, documents, feedbackMessage, rejectionReason } = req.body;
    if (!['verified', 'amendments_needed', 'rejected'].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid verification action' });
    }

    const appResult = await client.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Application not found' });
    }

    let updateQuery = '';
    let updateParams = [];

    if (status === 'verified') {
      updateQuery = `UPDATE applications SET verification_status = 'verified', status = 'verified', verified_at = NOW(), needs_amendment = false, updated_at = NOW() WHERE id = $1`;
      updateParams = [req.params.id];
    } else if (status === 'amendments_needed') {
      updateQuery = `UPDATE applications SET status = 'amendments_needed', verification_status = 'pending', needs_amendment = true, updated_at = NOW() WHERE id = $1`;
      updateParams = [req.params.id];
    } else {
      updateQuery = `UPDATE applications SET status = 'rejected', verification_status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2`;
      updateParams = [rejectionReason || 'Application rejected', req.params.id];
    }

    await client.query(updateQuery, updateParams);

    if (Array.isArray(documents) && documents.length) {
      for (const doc of documents) {
        if (!doc?.id || !doc?.status) continue;
        if (doc.status === 'verified') {
          await client.query(
            `UPDATE application_documents SET verification_status = 'verified', verified_at = NOW() WHERE id = $1 AND application_id = $2`,
            [doc.id, req.params.id]
          );
        } else {
          await client.query(
            `UPDATE application_documents SET verification_status = $1 WHERE id = $2 AND application_id = $3`,
            [doc.status, doc.id, req.params.id]
          );
        }
      }
    }

    if (status === 'amendments_needed') {
      if (!feedbackMessage) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Feedback message is required for amendment requests' });
      }
      await client.query(
        `INSERT INTO application_feedback (application_id, feedback_message, created_by)
         VALUES ($1, $2, $3)`,
        [req.params.id, feedbackMessage, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Application verification updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update application verification' });
  } finally {
    client.release();
  }
});

router.get('/payments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) as total FROM payments');
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(`
      SELECT p.id, p.reference, p.amount, p.status, p.provider, p.created_at,
             a.id as application_id, a.status as application_status,
             s.full_name as student_name, s.email as student_email
      FROM payments p
      LEFT JOIN applications a ON a.id = p.application_id
      LEFT JOIN students s ON s.id = a.student_id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.patch('/payments/:id/approve', async (req, res) => {
  try {
    const payRes = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!payRes.rows.length) return res.status(404).json({ error: 'Payment not found' });

    const pay = payRes.rows[0];
    await pool.query('UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2', ['completed', req.params.id]);
    if (pay.application_id) {
      await pool.query(
        'UPDATE applications SET payment_status = $1, payment_rejection_reason = NULL, updated_at = NOW() WHERE id = $2',
        ['paid', pay.application_id]
      );
    }

    res.json({ message: 'Payment approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

router.patch('/payments/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const payRes = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!payRes.rows.length) return res.status(404).json({ error: 'Payment not found' });

    const pay = payRes.rows[0];
    await pool.query('UPDATE payments SET status = $1, provider_payload = $2, updated_at = NOW() WHERE id = $3', ['failed', { rejectionReason: reason || 'Payment rejected by admin' }, req.params.id]);
    if (pay.application_id) {
      await pool.query(
        'UPDATE applications SET payment_status = $1, payment_rejection_reason = $2, updated_at = NOW() WHERE id = $3',
        ['failed', reason || 'Payment rejected by admin', pay.application_id]
      );
    }

    res.json({ message: 'Payment rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    const payRes = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!payRes.rows.length) return res.status(404).json({ error: 'Payment not found' });

    const pay = payRes.rows[0];
    if (pay.status === 'completed') {
      return res.status(400).json({ error: 'Cannot delete completed payments' });
    }

    await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(`
      SELECT id, email, full_name, role, created_at, last_login_at,
             CASE
               WHEN last_login_at IS NULL THEN 'never_logged_in'
               WHEN last_login_at >= NOW() - INTERVAL '15 minutes' THEN 'online'
               ELSE 'offline'
             END as status
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const userRes = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.get('/departments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) as total FROM departments');
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT d.*, f.name as faculty_name
       FROM departments d
       LEFT JOIN faculties f ON f.id = d.faculty_id
       ORDER BY d.name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const { facultyId, name, description } = req.body;
    if (!facultyId || !name) {
      return res.status(400).json({ error: 'Faculty and department name are required' });
    }
    const result = await pool.query(
      `INSERT INTO departments (faculty_id, name, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [facultyId, name, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.put('/departments/:id', async (req, res) => {
  try {
    const { facultyId, name, description } = req.body;
    if (!facultyId || !name) {
      return res.status(400).json({ error: 'Faculty and department name are required' });
    }
    const result = await pool.query(
      `UPDATE departments SET faculty_id = $1, name = $2, description = $3
       WHERE id = $4 RETURNING *`,
      [facultyId, name, description || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Department not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM departments WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Department not found' });
    res.json({ message: 'Department deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

router.get('/programmes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { departmentId } = req.query;

    let countQuery = `SELECT COUNT(*) as total FROM programmes p
                     WHERE p.is_active = true`;
    let countParams = [];

    if (departmentId) {
      countQuery += ' AND p.department_id = $1';
      countParams.push(departmentId);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    let query = `
      SELECT p.*, d.name as department_name, f.name as faculty_name
      FROM programmes p
      JOIN departments d ON d.id = p.department_id
      LEFT JOIN faculties f ON f.id = d.faculty_id
      WHERE p.is_active = true
    `;
    const params = [];

    if (departmentId) {
      query += ' AND d.id = $1';
      params.push(departmentId);
    }

    query += ' ORDER BY p.name LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch programmes' });
  }
});

router.post('/applications/:id/qualify', async (req, res) => {
  try {
    const appResult = await pool.query(
      `SELECT a.*, s.full_name, s.kcse_grade, p.min_qualification, p.min_grade_points,
              p.name as programme_name, p.requirements
       FROM applications a
       JOIN students s ON s.id = a.student_id
       JOIN programmes p ON p.id = a.programme_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!appResult.rows.length) return res.status(404).json({ error: 'Application not found' });

    const app = appResult.rows[0];
    if (app.verification_status !== 'verified') {
      return res.status(400).json({ error: 'Application must be verified before qualification check' });
    }

    const result = await generateQualificationReasoning({
      studentName: app.full_name,
      studentGrade: app.kcse_grade,
      programmeName: app.programme_name,
      minQualification: app.min_qualification,
      minGradePoints: app.min_grade_points,
      requirements: app.requirements,
    });

    const newStatus = result.qualified ? 'qualified' : 'not_qualified';
    const newAppStatus = result.qualified ? 'qualified' : 'not_qualified';

    await pool.query(
      `UPDATE applications SET
        qualification_status = $1::varchar,
        qualification_reasoning = $2,
        status = $3::varchar,
        qualified_at = NOW(),
        updated_at = NOW()
       WHERE id = $4`,
      [newStatus, result.reasoning, newAppStatus, req.params.id]
    );

    res.json({
      ...result,
      programmeName: app.programme_name,
      studentGrade: app.kcse_grade,
      minQualification: app.min_qualification,
      status: newStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Qualification check failed' });
  }
});

router.post('/applications/:id/admit', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { intake, reportingDate, feeStructure, registrationGuidelines } = req.body;

    const appResult = await client.query(
      `SELECT a.*, s.full_name, p.name as programme_name, p.intake as default_intake, p.fees
       FROM applications a
       JOIN students s ON s.id = a.student_id
       JOIN programmes p ON p.id = a.programme_id
       WHERE a.id = $1 AND a.qualification_status = 'qualified'`,
      [req.params.id]
    );
    if (!appResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Application not found or not qualified' });
    }

    const app = appResult.rows[0];
    const admissionNumber = generateAdmissionNumber();
    const admissionDate = new Date().toISOString().split('T')[0];
    const defaultFee = `Tuition: KES ${Number(app.fees).toLocaleString()} per year\nRegistration Fee: KES 5,000\nStudent Activity Fee: KES 2,000`;
    const defaultGuidelines = '1. Report to the admissions office with original documents.\n2. Complete online registration within 7 days.\n3. Pay registration fees before orientation.';

    await client.query(
      `INSERT INTO admissions (application_id, admission_number, admission_date, intake, reporting_date, fee_structure, registration_guidelines)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (application_id) DO UPDATE SET
         admission_number = $2, admission_date = $3, intake = $4, reporting_date = $5,
         fee_structure = $6, registration_guidelines = $7`,
      [req.params.id, admissionNumber, admissionDate,
       intake || app.default_intake, reportingDate || admissionDate,
       feeStructure || defaultFee, registrationGuidelines || defaultGuidelines]
    );

    await client.query(
      `UPDATE applications SET admission_status = 'admitted', status = 'admitted', admitted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Admission approved', admissionNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Admission failed' });
  } finally {
    client.release();
  }
});

router.post('/applications/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason required' });
    }

    await pool.query(
      `UPDATE applications SET 
        status = 'not_qualified', 
        qualification_status = 'not_qualified',
        rejection_reason = $1,
        qualified_at = NOW(),
        updated_at = NOW()
       WHERE id = $2`,
      [reason, req.params.id]
    );

    res.json({ message: 'Application rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Rejection failed' });
  }
});

router.get('/programmes', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, d.name as department_name, f.name as faculty_name
       FROM programmes p
       JOIN departments d ON d.id = p.department_id
       JOIN faculties f ON f.id = d.faculty_id
       ORDER BY p.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch programmes' });
  }
});

router.post('/programmes', upload.single('image'), async (req, res) => {
  try {
    const {
      departmentId, name, code, description, duration, fees,
      minQualification, minGradePoints, intake, type, degree,
      overview, requirements, modules, career, imageUrl,
    } = req.body;
    const parsedFees = fees === undefined || fees === null || fees === '' ? null : Number(fees);
    const parsedMinGradePoints = minGradePoints === undefined || minGradePoints === null || minGradePoints === '' ? 0 : Number(minGradePoints);
    const finalImageUrl = req.file ? `/uploads/${req.file.filename}` : imageUrl || null;
    const result = await pool.query(
      `INSERT INTO programmes (department_id, name, code, description, duration, fees,
        min_qualification, min_grade_points, intake, type, degree, overview, requirements, modules, career, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [departmentId, name, code, description, duration, parsedFees,
       minQualification, parsedMinGradePoints, intake, type, degree,
       overview, requirements, modules, career, finalImageUrl]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create programme' });
  }
});

router.put('/programmes/:id', upload.single('image'), async (req, res) => {
  try {
    const fields = req.body;
    const parsedFees = fields.fees === undefined || fields.fees === null || fields.fees === '' ? undefined : Number(fields.fees);
    const parsedMinGradePoints = fields.minGradePoints === undefined || fields.minGradePoints === null || fields.minGradePoints === '' ? undefined : Number(fields.minGradePoints);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (fields.imageUrl || undefined);
    const result = await pool.query(
      `UPDATE programmes SET
        department_id = COALESCE($1, department_id), name = COALESCE($2, name),
        code = COALESCE($3, code), description = COALESCE($4, description),
        duration = COALESCE($5, duration), fees = COALESCE($6, fees),
        min_qualification = COALESCE($7, min_qualification),
        min_grade_points = COALESCE($8, min_grade_points),
        intake = COALESCE($9, intake), type = COALESCE($10, type),
        degree = COALESCE($11, degree), overview = COALESCE($12, overview),
        requirements = COALESCE($13, requirements), modules = COALESCE($14, modules),
        career = COALESCE($15, career), image_url = COALESCE($16, image_url),
        is_active = COALESCE($17, is_active)
       WHERE id = $18 RETURNING *`,
      [fields.departmentId, fields.name, fields.code, fields.description,
       fields.duration, parsedFees, fields.minQualification, parsedMinGradePoints,
       fields.intake, fields.type, fields.degree, fields.overview, fields.requirements,
       fields.modules, fields.career, imageUrl || null, fields.isActive, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update programme' });
  }
});

router.delete('/programmes/:id', async (req, res) => {
  try {
    await pool.query('UPDATE programmes SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Programme deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete programme' });
  }
});

// Document viewing endpoint
router.get('/documents/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM application_documents WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Document not found' });
    
    const doc = result.rows[0];
    const filePath = path.join(__dirname, '../../uploads', doc.file_path);
    
    res.download(filePath, doc.original_name, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download document' });
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

export default router;
