import express from 'express';
import pool from '../config/db.js';
import { authMiddleware, studentMiddleware } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

const router = express.Router();

router.get('/:applicationId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, ad.admission_number, ad.admission_date, ad.intake, ad.reporting_date,
              ad.fee_structure, ad.registration_guidelines, ad.status,
              s.full_name, s.email, p.name as programme_name, p.fees
       FROM admissions ad
       JOIN applications a ON a.id = ad.application_id
       JOIN students s ON s.id = a.student_id
       JOIN programmes p ON p.id = a.programme_id
       WHERE a.id = $1`,
      [req.params.applicationId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Admission letter not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch letter data' });
  }
});

router.get('/:applicationId/pdf', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ad.*, s.full_name, s.email, p.name as programme_name, p.type as programme_type
       FROM admissions ad
       JOIN applications a ON a.id = ad.application_id
       JOIN students s ON s.id = a.student_id
       JOIN programmes p ON p.id = a.programme_id
       WHERE a.id = $1`,
      [req.params.applicationId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Admission letter not found' });

    const letter = result.rows[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=admission-letter-${letter.admission_number.replace(/\//g, '-')}.pdf`);

    const doc = new PDFDocument({ margin: 35, size: 'A4' });
    doc.pipe(res);

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    // ===== PAGE 1 =====
    // Header
    doc.fontSize(22).fillColor('#1E3A8A').text('EduAdmit University', { align: 'center' });
    doc.fontSize(10).fillColor('#666666').text('Office of Admissions • Academic Affairs', { align: 'center' });
    doc.moveDown(0.8);

    // Date
    doc.fontSize(9).fillColor('#333333').text(formatDate(letter.admission_date));
    doc.moveDown(0.8);

    // Badges with better styling (pill-shaped)
    const badgeY = doc.y;
    doc.fontSize(8).fillColor('#FFFFFF');
    
    doc.rect(35, badgeY, 60, 18).fillAndStroke('#1E3A8A', '#1E3A8A').fill();
    doc.fillColor('#FFFFFF').text('Admitted', 35, badgeY + 3, { width: 60, align: 'center' });
    
    doc.rect(100, badgeY, 120, 18).fillAndStroke('#1E3A8A', '#1E3A8A').fill();
    doc.fillColor('#FFFFFF').text(letter.programme_type || 'Degree Programme', 100, badgeY + 3, { width: 120, align: 'center' });
    
    doc.rect(225, badgeY, 80, 18).fillAndStroke('#1E3A8A', '#1E3A8A').fill();
    doc.fillColor('#FFFFFF').text(letter.intake, 225, badgeY + 3, { width: 80, align: 'center' });
    
    doc.moveDown(1.8);

    // Greeting
    doc.fontSize(10).fillColor('#000000').text(`Dear ${letter.full_name},`);
    doc.moveDown(0.5);

    // Body text
    doc.fontSize(9).fillColor('#333333');
    doc.text(
      'We are delighted to confirm your admission to EduAdmit University for the programme shown below. ' +
      'This offer is issued by the Office of Admissions and confirms your eligibility to enroll for the upcoming intake.'
    );
    doc.moveDown(1);

    // Admission Details Table with proper styling
    doc.fontSize(10).fillColor('#1E3A8A').text('Admission Details', { underline: true });
    doc.moveDown(0.4);

    const tableX = 35;
    const tableWidth = 250;
    const cellHeight = 18;
    let yPos = doc.y;

    // Row 1
    doc.rect(tableX, yPos, tableWidth, cellHeight).fillAndStroke('#EFF6FF', '#DBEAFE');
    doc.fontSize(9).fillColor('#333333').text('Admission Number', tableX + 5, yPos + 4);
    doc.fillColor('#1E3A8A').text(letter.admission_number, tableX + 140, yPos + 4);

    // Row 2
    yPos += cellHeight;
    doc.rect(tableX, yPos, tableWidth, cellHeight).fillAndStroke('#FFFFFF', '#DBEAFE');
    doc.fontSize(9).fillColor('#333333').text('Programme', tableX + 5, yPos + 4);
    doc.fillColor('#1E3A8A').text(letter.programme_name, tableX + 140, yPos + 4);

    // Row 3
    yPos += cellHeight;
    doc.rect(tableX, yPos, tableWidth, cellHeight).fillAndStroke('#EFF6FF', '#DBEAFE');
    doc.fontSize(9).fillColor('#333333').text('Intake', tableX + 5, yPos + 4);
    doc.fillColor('#1E3A8A').text(letter.intake, tableX + 140, yPos + 4);

    // Row 4
    yPos += cellHeight;
    doc.rect(tableX, yPos, tableWidth, cellHeight).fillAndStroke('#FFFFFF', '#DBEAFE');
    doc.fontSize(9).fillColor('#333333').text('Reporting Date', tableX + 5, yPos + 4);
    doc.fillColor('#1E3A8A').text(formatDate(letter.reporting_date), tableX + 140, yPos + 4);

    doc.moveDown(3.2);

    // Two column layout - Campus Address and QR Code
    const col1X = 35;
    const col2X = 300;
    const sectionY = doc.y;

    // Campus Location Section
    doc.fontSize(10).fillColor('#1E3A8A').text('Campus Address', col1X, sectionY, { underline: true });
    doc.fontSize(9).fillColor('#333333');
    doc.rect(col1X, sectionY + 20, 220, 60).fillAndStroke('#F8FAFC', '#DBEAFE');
    doc.text('EduAdmit University', col1X + 8, sectionY + 25);
    doc.text('123 Academic Way', col1X + 8, sectionY + 35);
    doc.text('Knowledge City, ED 45678', col1X + 8, sectionY + 45);

    // Campus Map image section
    const mapX = col2X;
    const mapY = sectionY + 18;
    const mapWidth = 220;
    const mapHeight = 90;

    doc.fontSize(10).fillColor('#1E3A8A').text('Campus Location', col2X, sectionY, { underline: true });
    doc.rect(mapX, mapY, mapWidth, mapHeight).fillAndStroke('#F8FAFC', '#DBEAFE');
    doc.image(
      'https://tile.openstreetmap.org/14/9867/8250.png',
      mapX + 10,
      mapY + 8,
      { width: mapWidth - 20, height: mapHeight - 20 }
    );
    doc.fontSize(8).fillColor('#475569').text('EduAdmit campus location for registration and orientation.', mapX, mapY + mapHeight + 4, { width: mapWidth });

    doc.moveDown(6.0);

    // Fee Structure
    doc.fontSize(10).fillColor('#1E3A8A').text('Fee Structure', { underline: true });
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor('#333333');
    doc.text(letter.fee_structure || 'See attached fee schedule.', { width: 450 });
    doc.moveDown(0.8);

    // Registration Guidelines
    doc.fontSize(10).fillColor('#1E3A8A').text('Registration Guidelines', { underline: true });
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor('#333333');
    doc.text(letter.registration_guidelines || 'Please report to the admissions office with original documents.', { width: 450 });

    // ===== PAGE BREAK =====
    doc.addPage();

    // ===== PAGE 2 =====
    // Header repeated
    doc.fontSize(22).fillColor('#1E3A8A').text('EduAdmit University', { align: 'center' });
    doc.fontSize(10).fillColor('#666666').text('Office of Admissions • Academic Affairs', { align: 'center' });
    doc.moveDown(1.2);

    // Footer message box
    doc.rect(35, doc.y, 450, 70).fillAndStroke('#EFF6FF', '#90CAF9');
    doc.rect(35, doc.y, 4, 70).fillAndStroke('#2563EB', '#2563EB');
    
    doc.fontSize(9).fillColor('#1F2937');
    doc.text('Please complete your acceptance and registration steps before the reporting date. For questions about enrollment, contact the Office of Admissions at admissions@eduadmit.edu or call +1 (800) 555-0100.', 43, doc.y + 3, { width: 435 });
    
    doc.fontSize(8).fillColor('#475569');
    doc.text('This offer is subject to the terms and conditions of EduAdmit University.', 43, doc.y + 10, { width: 435 });
    
    doc.moveDown(4.5);

    // Closing message
    doc.fontSize(10).fillColor('#000000');
    doc.text('Congratulations once again. We look forward to welcoming you to our campus.');
    doc.moveDown(1.5);

    // Signature block
    doc.fontSize(9).fillColor('#000000');
    doc.text('_________________________');
    doc.moveDown(0.2);
    doc.text('Director of Admissions');
    doc.moveDown(0.1);
    doc.text('EduAdmit University');

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
