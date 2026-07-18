import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS faculties (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        faculty_id INTEGER REFERENCES faculties(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS programmes (
        id SERIAL PRIMARY KEY,
        department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE,
        description TEXT,
        duration VARCHAR(100),
        fees DECIMAL(12,2),
        min_qualification VARCHAR(50),
        min_grade_points INTEGER DEFAULT 0,
        intake VARCHAR(100),
        type VARCHAR(50),
        degree VARCHAR(100),
        overview TEXT,
        requirements TEXT,
        modules TEXT,
        career TEXT,
        image_url VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'student',
        full_name VARCHAR(255),
        is_email_verified BOOLEAN DEFAULT false,
        email_verification_token VARCHAR(255),
        email_verification_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_otps (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts INTEGER DEFAULT 0,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        fingerprint VARCHAR(500) NOT NULL,
        first_seen TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, fingerprint)
      );

      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT NOT NULL,
        credential_public_key TEXT NOT NULL,
        counter BIGINT NOT NULL,
        transports JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(255) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(20),
        id_number VARCHAR(50),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        kcse_index VARCHAR(50),
        kcse_grade VARCHAR(10),
        kcse_grade_points INTEGER,
        previous_school VARCHAR(255),
        county VARCHAR(100),
        emergency_contact_name VARCHAR(255),
        emergency_contact_phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS programme_selections (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        programme_id INTEGER REFERENCES programmes(id) ON DELETE CASCADE,
        selected_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id)
      );

      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        programme_id INTEGER REFERENCES programmes(id),
        status VARCHAR(50) DEFAULT 'draft',
        verification_status VARCHAR(50) DEFAULT 'pending',
        qualification_status VARCHAR(50) DEFAULT 'pending',
        admission_status VARCHAR(50) DEFAULT 'pending',
        submitted_at TIMESTAMP,
        verified_at TIMESTAMP,
        qualified_at TIMESTAMP,
        admitted_at TIMESTAMP,
        rejection_reason TEXT,
        qualification_reasoning TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS application_documents (
        id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
        doc_type VARCHAR(50) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        original_name VARCHAR(255),
        verification_status VARCHAR(50) DEFAULT 'pending',
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admissions (
        id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
        admission_number VARCHAR(50) UNIQUE NOT NULL,
        admission_date DATE NOT NULL,
        intake VARCHAR(100),
        reporting_date DATE,
        fee_structure TEXT,
        registration_guidelines TEXT,
        status VARCHAR(50) DEFAULT 'admitted',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS school_info (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tagline VARCHAR(500),
        about TEXT,
        mission TEXT,
        vision TEXT,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        address TEXT,
        hero_image VARCHAR(500),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS application_feedback (
        id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
        feedback_message TEXT NOT NULL,
        requires_amendment BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
        reference VARCHAR(100) NOT NULL UNIQUE,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'KES',
        status VARCHAR(50) DEFAULT 'pending',
        provider VARCHAR(100),
        provider_payload JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS county VARCHAR(100);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS qualification_reasoning TEXT;
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS amendment_count INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS last_amendment_at TIMESTAMP;
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS needs_amendment BOOLEAN DEFAULT false;
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_rejection_reason TEXT;
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}
