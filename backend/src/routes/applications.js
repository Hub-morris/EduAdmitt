import express from 'express';
import pool from '../config/db.js';
import { authMiddleware, studentMiddleware } from '../middleware/auth.js';
import { uploadFields } from '../middleware/upload.js';
import { gradeToPoints } from '../utils/helpers.js';
import { isPaymentSuccessful } from '../utils/paymentStatus.js';

const router = express.Router();

async function getStudentId(userId) {
  const result = await pool.query('SELECT id FROM students WHERE user_id = $1', [userId]);
  return result.rows[0]?.id;
}

router.post('/select-programme', authMiddleware, studentMiddleware, async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.id);
    if (!studentId) return res.status(404).json({ error: 'Student profile not found' });
    const { programmeId } = req.body;
    if (!programmeId) return res.status(400).json({ error: 'Programme ID required' });

    await pool.query(
      `INSERT INTO programme_selections (student_id, programme_id)
       VALUES ($1, $2)
       ON CONFLICT (student_id) DO UPDATE SET programme_id = $2, selected_at = NOW()`,
      [studentId, programmeId]
    );

    const prog = await pool.query('SELECT * FROM programmes WHERE id = $1', [programmeId]);
    res.json({ message: 'Programme selected', programme: prog.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to select programme' });
  }
});

router.get('/my-selection', authMiddleware, studentMiddleware, async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.id);
    const result = await pool.query(
      `SELECT ps.*, p.id as programme_id, p.name, p.description as programme_description, p.duration, p.fees,
              p.min_qualification, p.intake, p.type, p.degree,
              d.name as department_name, f.name as faculty_name
       FROM programme_selections ps
       JOIN programmes p ON p.id = ps.programme_id
       JOIN departments d ON d.id = p.department_id
       JOIN faculties f ON f.id = d.faculty_id
       WHERE ps.student_id = $1`,
      [studentId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch selection' });
  }
});

router.post('/submit', authMiddleware, studentMiddleware, uploadFields, async (req, res) => {
  console.log('Applications submit hit - files keys:', Object.keys(req.files || {}));
  console.log('Uploaded files summary:', Object.entries(req.files || {}).map(([k, v]) => ({ field: k, count: v.length })));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const studentId = await getStudentId(req.user.id);
    if (!studentId) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const programmeId = Number.parseInt(String(req.body.programmeId ?? ''), 10);
    const paymentId = Number.parseInt(String(req.body.paymentId ?? ''), 10);

    if (!Number.isFinite(programmeId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Programme selection is required before submission.' });
    }

    if (!Number.isFinite(paymentId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment confirmation is required before submission.' });
    }

    // Check for an existing application to this programme
    const existingApplication = await client.query(
      `SELECT id, needs_amendment FROM applications
       WHERE student_id = $1 AND programme_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [studentId, programmeId]
    );

    if (existingApplication.rows.length && !existingApplication.rows[0].needs_amendment) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'You have already applied for this programme. View your status or choose a different programme.' 
      });
    }

    const {
      fullName, dateOfBirth, gender, idNumber,
      email, phone, address, county,
      emergencyContactName, emergencyContactPhone,
      kcseIndex, kcseGrade, previousSchool,
    } = req.body;

    const dateOfBirthValue = dateOfBirth && typeof dateOfBirth === 'string' && dateOfBirth.trim() !== ''
      ? new Date(dateOfBirth).toISOString().split('T')[0]
      : null;

    if (!dateOfBirthValue || Number.isNaN(Date.parse(dateOfBirth))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Date of birth is required and must be a valid date.' });
    }

    const requiredDocFields = ['kcse_certificate', 'national_id', 'passport_photo'];
    const missingDocs = requiredDocFields.filter((field) => !req.files?.[field]?.[0]);
    if (missingDocs.length) {
      console.warn('Missing document fields on submit:', missingDocs);
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Missing documents: ${missingDocs.join(', ')}` });
    }

    const gradePoints = gradeToPoints(kcseGrade);

    let payment = null;
    if (Number.isFinite(paymentId) && paymentId > 0) {
      const paymentResult = await client.query('SELECT id, status, application_id, provider_payload FROM payments WHERE id = $1', [paymentId]);
      payment = paymentResult.rows[0];
    }

    if (!payment) {
      const recentPaymentResult = await client.query(
        `SELECT id, status, application_id, provider_payload
         FROM payments
         WHERE application_id IS NULL OR application_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [null]
      );
      payment = recentPaymentResult.rows[0];
    }

    if (!payment) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment record not found.' });
    }

    const paymentIsSuccessful = isPaymentSuccessful(payment);
    if (!paymentIsSuccessful) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment must be completed before your application can be submitted.' });
    }

    await client.query(
      `UPDATE students SET
        full_name = $1, date_of_birth = $2, gender = $3, id_number = $4,
        email = $5, phone = $6, address = $7,
        county = $8, emergency_contact_name = $9, emergency_contact_phone = $10,
        kcse_index = $11, kcse_grade = $12, kcse_grade_points = $13, previous_school = $14
       WHERE id = $15`,
      [fullName, dateOfBirthValue, gender, idNumber, email, phone, address,
       county || null, emergencyContactName || null, emergencyContactPhone || null,
       kcseIndex, kcseGrade, gradePoints, previousSchool, studentId]
    );

    const existing = await client.query(
      'SELECT id FROM applications WHERE student_id = $1 AND needs_amendment = true AND programme_id = $2',
      [studentId, programmeId]
    );

    let applicationId;
    if (existing.rows.length) {
      applicationId = existing.rows[0].id;
      await client.query(
        `UPDATE applications SET programme_id = $1, status = 'submitted', 
         verification_status = 'pending', qualification_status = 'pending', 
         needs_amendment = false, amendment_count = amendment_count + 1,
         last_amendment_at = NOW(), submitted_at = NOW(), updated_at = NOW() 
         WHERE id = $2`,
        [programmeId, applicationId]
      );
    } else {
      const appResult = await client.query(
        `INSERT INTO applications (student_id, programme_id, status, verification_status, submitted_at)
         VALUES ($1, $2, 'submitted', 'pending', NOW()) RETURNING id`,
        [studentId, programmeId]
      );
      applicationId = appResult.rows[0].id;
    }

    const docTypes = {
      kcse_certificate: 'kcse_certificate',
      national_id: 'national_id',
      passport_photo: 'passport_photo',
    };

    await client.query(
      `UPDATE payments
       SET application_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [applicationId, paymentId]
    );

    await client.query(
      `UPDATE applications SET payment_status = $1, updated_at = NOW() WHERE id = $2`,
      ['paid', applicationId]
    );

    for (const [field, docType] of Object.entries(docTypes)) {
      const file = req.files?.[field]?.[0];
      if (file) {
        await client.query(
          'DELETE FROM application_documents WHERE application_id = $1 AND doc_type = $2',
          [applicationId, docType]
        );
        await client.query(
          `INSERT INTO application_documents (application_id, doc_type, file_path, original_name)
           VALUES ($1, $2, $3, $4)`,
          [applicationId, docType, file.filename, file.originalname]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Application submitted successfully', applicationId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Submit application error:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
    });
    res.status(500).json({ error: err.message || 'Failed to submit application' });
  } finally {
    client.release();
  }
});

router.get('/my-application', authMiddleware, studentMiddleware, async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.id);
    const result = await pool.query(
      `SELECT a.*, p.name as programme_name, p.duration, p.fees, p.intake, p.min_qualification,
              s.full_name, s.email, s.kcse_grade, ad.admission_number, ad.admission_date,
              ad.reporting_date, ad.fee_structure, ad.registration_guidelines
       FROM applications a
       JOIN programmes p ON p.id = a.programme_id
       JOIN students s ON s.id = a.student_id
       LEFT JOIN admissions ad ON ad.application_id = a.id
       WHERE a.student_id = $1
       ORDER BY a.created_at DESC LIMIT 1`,
      [studentId]
    );
    if (!result.rows.length) return res.json(null);

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

router.get('/status', authMiddleware, studentMiddleware, async (req, res) => {
  try {
    const studentId = await getStudentId(req.user.id);
    const result = await pool.query(
      `SELECT a.id, a.status, a.verification_status, a.qualification_status, a.admission_status,
              a.submitted_at, a.verified_at, a.qualified_at, a.admitted_at,
              a.qualification_reasoning, a.rejection_reason, a.needs_amendment,
              a.amendment_count, a.last_amendment_at, a.payment_status,
              a.payment_rejection_reason,
              p.name as programme_name, p.id as programme_id, ad.admission_number
       FROM applications a
       JOIN programmes p ON p.id = a.programme_id
       LEFT JOIN admissions ad ON ad.application_id = a.id
       WHERE a.student_id = $1
       ORDER BY a.created_at DESC LIMIT 1`,
      [studentId]
    );
    
    if (!result.rows.length) return res.json({ status: 'none' });
    
    const app = result.rows[0];
    
    // Get feedback messages if amendments needed
    if (app.needs_amendment) {
      const feedback = await pool.query(
        `SELECT id, feedback_message, created_at FROM application_feedback 
         WHERE application_id = $1 ORDER BY created_at DESC`,
        [app.id]
      );
      app.feedback = feedback.rows;
    }
    
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
