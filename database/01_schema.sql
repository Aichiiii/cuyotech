-- CuyoTech University Student Services Information System (SSIS)

CREATE DATABASE IF NOT EXISTS cuyotech_ssis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cuyotech_ssis;

SET FOREIGN_KEY_CHECKS = 0;

-- roles: The five account roles: Student, Registrar, Cashier, Department Staff and Administrator.
CREATE TABLE `roles` (
  `role_id` TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_code` VARCHAR(20) NOT NULL,
  `role_name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uq_roles_role_code` (`role_code`),
  UNIQUE KEY `uq_roles_role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- permissions: Individual actions a role may perform, for example encode grades, issue receipts or manage accounts.
CREATE TABLE `permissions` (
  `permission_id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `permission_code` VARCHAR(60) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `uq_permissions_permission_code` (`permission_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- users: Login accounts (UserAccount). An account must be Active and have the right role before it can enter any workflow.
CREATE TABLE `users` (
  `user_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id` TINYINT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `account_status` ENUM('Active', 'Inactive', 'Locked') NOT NULL DEFAULT 'Active',
  `last_login_at` DATETIME NULL,
  `created_by` INT UNSIGNED NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_username` (`username`),
  CONSTRAINT `fk_users_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`),
  CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_users_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- role_permissions: Which permissions each role has. Lets the Administrator change access without touching user accounts.
CREATE TABLE `role_permissions` (
  `role_id` TINYINT UNSIGNED NOT NULL,
  `permission_id` SMALLINT UNSIGNED NOT NULL,
  `granted_by` INT UNSIGNED NOT NULL,
  `granted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_role_permissions_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- offices: Every university office that processes records: each academic department, the Registrar, the Cashier and Administration. requires_clearance marks the offices that must approve a clearance.
CREATE TABLE `offices` (
  `office_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `office_code` VARCHAR(20) NOT NULL,
  `office_name` VARCHAR(100) NOT NULL,
  `office_type` ENUM('Department', 'Registrar', 'Cashier', 'Administration') NOT NULL,
  `requires_clearance` TINYINT(1) NOT NULL DEFAULT 0,
  `office_status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`office_id`),
  UNIQUE KEY `uq_offices_office_code` (`office_code`),
  UNIQUE KEY `uq_offices_office_name` (`office_name`),
  CONSTRAINT `fk_offices_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_offices_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- departments: Academic departments. Each department has its own office, offers courses and owns programs.
CREATE TABLE `departments` (
  `department_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `office_id` INT UNSIGNED NOT NULL,
  `department_code` VARCHAR(20) NOT NULL,
  `department_name` VARCHAR(150) NOT NULL,
  `department_status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`department_id`),
  UNIQUE KEY `uq_departments_office_id` (`office_id`),
  UNIQUE KEY `uq_departments_department_code` (`department_code`),
  UNIQUE KEY `uq_departments_department_name` (`department_name`),
  CONSTRAINT `fk_departments_office_id` FOREIGN KEY (`office_id`) REFERENCES `offices` (`office_id`),
  CONSTRAINT `fk_departments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_departments_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- programs: Degree programs (for example BSIT) under a department. A student's department comes through the program.
CREATE TABLE `programs` (
  `program_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `department_id` INT UNSIGNED NOT NULL,
  `program_code` VARCHAR(20) NOT NULL,
  `program_name` VARCHAR(150) NOT NULL,
  `program_status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`program_id`),
  UNIQUE KEY `uq_programs_program_code` (`program_code`),
  CONSTRAINT `fk_programs_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`),
  CONSTRAINT `fk_programs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_programs_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- students: Student profile linked one-to-one to a user account. Students can update only the permitted fields.
CREATE TABLE `students` (
  `student_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `student_number` VARCHAR(20) NOT NULL,
  `program_id` INT UNSIGNED NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `birth_date` DATE NULL,
  `email` VARCHAR(150) NOT NULL,
  `contact_number` VARCHAR(30) NULL,
  `address` VARCHAR(255) NULL,
  `year_level` TINYINT UNSIGNED NOT NULL,
  `student_status` ENUM('Active', 'Inactive', 'Graduated') NOT NULL DEFAULT 'Active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `uq_students_user_id` (`user_id`),
  UNIQUE KEY `uq_students_student_number` (`student_number`),
  UNIQUE KEY `uq_students_email` (`email`),
  CONSTRAINT `fk_students_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_students_program_id` FOREIGN KEY (`program_id`) REFERENCES `programs` (`program_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- staff: Registrar, Cashier, Department and Admin personnel (AdminUser / employee). The office decides which records they may process.
CREATE TABLE `staff` (
  `staff_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `employee_number` VARCHAR(20) NOT NULL,
  `office_id` INT UNSIGNED NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `position_title` VARCHAR(100) NOT NULL,
  `staff_status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`staff_id`),
  UNIQUE KEY `uq_staff_user_id` (`user_id`),
  UNIQUE KEY `uq_staff_employee_number` (`employee_number`),
  UNIQUE KEY `uq_staff_email` (`email`),
  CONSTRAINT `fk_staff_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_staff_office_id` FOREIGN KEY (`office_id`) REFERENCES `offices` (`office_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- academic_terms: School year and semester, with the enrollment window. Enrollments, offerings and clearances belong to a term.
CREATE TABLE `academic_terms` (
  `term_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `school_year` CHAR(9) NOT NULL,
  `semester` ENUM('First', 'Second', 'Summer') NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `enrollment_start` DATE NOT NULL,
  `enrollment_end` DATE NOT NULL,
  `term_status` ENUM('Upcoming', 'Open', 'Closed') NOT NULL DEFAULT 'Upcoming',
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`term_id`),
  UNIQUE KEY `uq_academic_terms_school_year_semester` (`school_year`, `semester`),
  CONSTRAINT `fk_academic_terms_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_academic_terms_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- courses: Subjects maintained by the department that offers them: code, title, units and status (Active or Archived).
CREATE TABLE `courses` (
  `course_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `department_id` INT UNSIGNED NOT NULL,
  `course_code` VARCHAR(20) NOT NULL,
  `course_name` VARCHAR(150) NOT NULL,
  `units` TINYINT UNSIGNED NOT NULL,
  `course_status` ENUM('Active', 'Archived') NOT NULL DEFAULT 'Active',
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`course_id`),
  UNIQUE KEY `uq_courses_course_code` (`course_code`),
  CONSTRAINT `fk_courses_department_id` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`),
  CONSTRAINT `fk_courses_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_courses_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- course_prerequisites: Subjects that must be passed before another subject can be taken. One subject can have many prerequisites.
CREATE TABLE `course_prerequisites` (
  `course_id` INT UNSIGNED NOT NULL,
  `prerequisite_course_id` INT UNSIGNED NOT NULL,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`course_id`, `prerequisite_course_id`),
  CONSTRAINT `chk_course_prerequisites_1` CHECK (course_id <> prerequisite_course_id),
  CONSTRAINT `fk_course_prerequisites_course_id` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_course_prerequisites_prerequisite_course_id` FOREIGN KEY (`prerequisite_course_id`) REFERENCES `courses` (`course_id`),
  CONSTRAINT `fk_course_prerequisites_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- course_offerings: A subject offered in a term and section, with its capacity. These are the Offered Subjects students choose from.
CREATE TABLE `course_offerings` (
  `offering_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` INT UNSIGNED NOT NULL,
  `term_id` INT UNSIGNED NOT NULL,
  `section_code` VARCHAR(20) NOT NULL,
  `capacity` SMALLINT UNSIGNED NOT NULL,
  `offering_status` ENUM('Open', 'Closed', 'Cancelled') NOT NULL DEFAULT 'Open',
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`offering_id`),
  UNIQUE KEY `uq_course_offerings_course_id_term_id_section_code` (`course_id`, `term_id`, `section_code`),
  CONSTRAINT `chk_course_offerings_1` CHECK (capacity > 0),
  CONSTRAINT `fk_course_offerings_course_id` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`),
  CONSTRAINT `fk_course_offerings_term_id` FOREIGN KEY (`term_id`) REFERENCES `academic_terms` (`term_id`),
  CONSTRAINT `fk_course_offerings_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_course_offerings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- enrollments: One enrollment application per student per term: status, Registrar decision and reason, finalization and the COR number.
CREATE TABLE `enrollments` (
  `enrollment_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `term_id` INT UNSIGNED NOT NULL,
  `enrollment_status` ENUM('Draft', 'Submitted', 'For Correction', 'Approved', 'Rejected', 'Finalized', 'Cancelled') NOT NULL DEFAULT 'Draft',
  `submitted_at` DATETIME NULL,
  `reviewed_by` INT UNSIGNED NULL,
  `reviewed_at` DATETIME NULL,
  `decision_reason` VARCHAR(500) NULL,
  `finalized_by` INT UNSIGNED NULL,
  `finalized_at` DATETIME NULL,
  `cor_number` VARCHAR(30) NULL,
  `cancelled_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`enrollment_id`),
  UNIQUE KEY `uq_enrollments_cor_number` (`cor_number`),
  CONSTRAINT `fk_enrollments_student_id` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `fk_enrollments_term_id` FOREIGN KEY (`term_id`) REFERENCES `academic_terms` (`term_id`),
  CONSTRAINT `fk_enrollments_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_enrollments_finalized_by` FOREIGN KEY (`finalized_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- enrollment_subjects: The subjects (offerings) selected in an enrollment application.
CREATE TABLE `enrollment_subjects` (
  `enrollment_subject_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `enrollment_id` BIGINT UNSIGNED NOT NULL,
  `offering_id` INT UNSIGNED NOT NULL,
  `added_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`enrollment_subject_id`),
  UNIQUE KEY `uq_enrollment_subjects_enrollment_id_offering_id` (`enrollment_id`, `offering_id`),
  CONSTRAINT `fk_enrollment_subjects_enrollment_id` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`enrollment_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_subjects_offering_id` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings` (`offering_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- grades: One grade per enrolled subject. Students see a grade only after it is Published.
CREATE TABLE `grades` (
  `grade_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `enrollment_subject_id` BIGINT UNSIGNED NOT NULL,
  `grade_value` DECIMAL(3,2) NULL,
  `special_mark` ENUM('INC', 'DRP') NULL,
  `grade_status` ENUM('Encoded', 'Published') NOT NULL DEFAULT 'Encoded',
  `encoded_by` INT UNSIGNED NOT NULL,
  `encoded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `published_by` INT UNSIGNED NULL,
  `published_at` DATETIME NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`grade_id`),
  UNIQUE KEY `uq_grades_enrollment_subject_id` (`enrollment_subject_id`),
  CONSTRAINT `chk_grades_1` CHECK (grade_value IS NOT NULL OR special_mark IS NOT NULL),
  CONSTRAINT `fk_grades_enrollment_subject_id` FOREIGN KEY (`enrollment_subject_id`) REFERENCES `enrollment_subjects` (`enrollment_subject_id`),
  CONSTRAINT `fk_grades_encoded_by` FOREIGN KEY (`encoded_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_grades_published_by` FOREIGN KEY (`published_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- clearance_requests: A student's clearance request. It is Completed only after every required office approves.
CREATE TABLE `clearance_requests` (
  `clearance_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `term_id` INT UNSIGNED NOT NULL,
  `purpose` VARCHAR(255) NOT NULL,
  `clearance_status` ENUM('In Progress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'In Progress',
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME NULL,
  `cancelled_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`clearance_id`),
  CONSTRAINT `fk_clearance_requests_student_id` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `fk_clearance_requests_term_id` FOREIGN KEY (`term_id`) REFERENCES `academic_terms` (`term_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- clearance_office_decisions: One decision per required office per clearance, with the pending items the student must resolve. A resubmission goes back to the same office.
CREATE TABLE `clearance_office_decisions` (
  `decision_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clearance_id` BIGINT UNSIGNED NOT NULL,
  `office_id` INT UNSIGNED NOT NULL,
  `decision_status` ENUM('For Review', 'Approved', 'Pending Requirements') NOT NULL DEFAULT 'For Review',
  `pending_items` VARCHAR(500) NULL,
  `resubmitted_at` DATETIME NULL,
  `decided_by` INT UNSIGNED NULL,
  `decided_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`decision_id`),
  UNIQUE KEY `uq_clearance_office_decisions_clearance_id_office_id` (`clearance_id`, `office_id`),
  CONSTRAINT `fk_clearance_office_decisions_clearance_id` FOREIGN KEY (`clearance_id`) REFERENCES `clearance_requests` (`clearance_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_clearance_office_decisions_office_id` FOREIGN KEY (`office_id`) REFERENCES `offices` (`office_id`),
  CONSTRAINT `fk_clearance_office_decisions_decided_by` FOREIGN KEY (`decided_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- fees: Fee policy set by the Administrator: enrollment and document fees, fixed, per unit or per copy.
CREATE TABLE `fees` (
  `fee_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `fee_code` VARCHAR(20) NOT NULL,
  `fee_name` VARCHAR(100) NOT NULL,
  `applies_to` ENUM('Enrollment', 'Document') NOT NULL,
  `fee_basis` ENUM('Fixed', 'Per Unit', 'Per Copy') NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `fee_status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`fee_id`),
  UNIQUE KEY `uq_fees_fee_code` (`fee_code`),
  CONSTRAINT `chk_fees_1` CHECK (amount >= 0),
  CONSTRAINT `fk_fees_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_fees_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- document_types: TOR, COR and certifications, with their rules: whether clearance is required, the fee that applies and processing days.
CREATE TABLE `document_types` (
  `document_type_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `document_code` VARCHAR(20) NOT NULL,
  `document_name` VARCHAR(100) NOT NULL,
  `requires_clearance` TINYINT(1) NOT NULL DEFAULT 0,
  `fee_id` INT UNSIGNED NULL,
  `processing_days` TINYINT UNSIGNED NOT NULL,
  `document_status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`document_type_id`),
  UNIQUE KEY `uq_document_types_document_code` (`document_code`),
  UNIQUE KEY `uq_document_types_document_name` (`document_name`),
  CONSTRAINT `fk_document_types_fee_id` FOREIGN KEY (`fee_id`) REFERENCES `fees` (`fee_id`),
  CONSTRAINT `fk_document_types_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_document_types_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- document_requests: A student's request for a document: purpose, copies, delivery channel, Registrar decision and release.
CREATE TABLE `document_requests` (
  `request_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `document_type_id` INT UNSIGNED NOT NULL,
  `clearance_id` BIGINT UNSIGNED NULL,
  `purpose` VARCHAR(255) NOT NULL,
  `copies` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `delivery_channel` ENUM('Pickup', 'Email', 'Courier') NOT NULL,
  `request_status` ENUM('Submitted', 'For Correction', 'Approved', 'Rejected', 'Released', 'Cancelled') NOT NULL DEFAULT 'Submitted',
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` INT UNSIGNED NULL,
  `reviewed_at` DATETIME NULL,
  `decision_reason` VARCHAR(500) NULL,
  `released_by` INT UNSIGNED NULL,
  `released_at` DATETIME NULL,
  `cancelled_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`),
  CONSTRAINT `chk_document_requests_1` CHECK (copies > 0),
  CONSTRAINT `fk_document_requests_student_id` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `fk_document_requests_document_type_id` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`document_type_id`),
  CONSTRAINT `fk_document_requests_clearance_id` FOREIGN KEY (`clearance_id`) REFERENCES `clearance_requests` (`clearance_id`),
  CONSTRAINT `fk_document_requests_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_document_requests_released_by` FOREIGN KEY (`released_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payments: A payment for exactly one transaction: an enrollment or a document request. The Cashier verifies it.
CREATE TABLE `payments` (
  `payment_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `enrollment_id` BIGINT UNSIGNED NULL,
  `document_request_id` BIGINT UNSIGNED NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_method` ENUM('Cash', 'Bank Transfer', 'E-Wallet') NOT NULL,
  `reference_number` VARCHAR(50) NULL,
  `payment_status` ENUM('Submitted', 'Confirmed', 'Unconfirmed', 'Cancelled') NOT NULL DEFAULT 'Submitted',
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_by` INT UNSIGNED NULL,
  `verified_at` DATETIME NULL,
  `remarks` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_id`),
  CONSTRAINT `chk_payments_1` CHECK ((enrollment_id IS NULL) <> (document_request_id IS NULL)),
  CONSTRAINT `chk_payments_2` CHECK (amount > 0),
  CONSTRAINT `fk_payments_enrollment_id` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`enrollment_id`),
  CONSTRAINT `fk_payments_document_request_id` FOREIGN KEY (`document_request_id`) REFERENCES `document_requests` (`request_id`),
  CONSTRAINT `fk_payments_verified_by` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- receipts: Official receipt issued by the Cashier, only for a confirmed payment.
CREATE TABLE `receipts` (
  `receipt_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id` BIGINT UNSIGNED NOT NULL,
  `receipt_number` VARCHAR(30) NOT NULL,
  `issued_by` INT UNSIGNED NOT NULL,
  `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`receipt_id`),
  UNIQUE KEY `uq_receipts_payment_id` (`payment_id`),
  UNIQUE KEY `uq_receipts_receipt_number` (`receipt_number`),
  CONSTRAINT `fk_receipts_payment_id` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`payment_id`),
  CONSTRAINT `fk_receipts_issued_by` FOREIGN KEY (`issued_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- notifications: Messages to a user, for example enrollment finalized, clearance pending or document released.
CREATE TABLE `notifications` (
  `notification_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `reference_table` VARCHAR(64) NULL,
  `reference_id` BIGINT UNSIGNED NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `read_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  CONSTRAINT `fk_notifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- audit_logs: Read-only trail of every status change, decision, receipt, grade publication and release: who, what, which record and when.
CREATE TABLE `audit_logs` (
  `audit_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `table_name` VARCHAR(64) NOT NULL,
  `record_id` BIGINT UNSIGNED NULL,
  `old_value` LONGTEXT NULL,
  `new_value` LONGTEXT NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`),
  CONSTRAINT `fk_audit_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

