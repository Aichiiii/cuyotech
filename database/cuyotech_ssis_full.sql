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

-- CuyoTech University SSIS - Demo / seed data
-- Import AFTER 01_schema.sql.  All demo accounts use the password:  password123

USE cuyotech_ssis;
SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+08:00';

-- ---------------------------------------------------------------------------
-- Roles and permissions
-- ---------------------------------------------------------------------------
INSERT INTO roles (role_id, role_code, role_name, description) VALUES
 (1, 'STUDENT',    'Student',          'Uses the Student Portal: profile, grades, enrollment, documents, clearance, payments'),
 (2, 'REGISTRAR',  'Registrar',        'Reviews and finalizes enrollment, encodes and publishes grades, processes document requests'),
 (3, 'CASHIER',    'Cashier',          'Verifies payments and issues official receipts; reviews financial clearance'),
 (4, 'DEPARTMENT', 'Department Staff', 'Processes departmental clearance and maintains department courses'),
 (5, 'ADMIN',      'Administrator',    'Manages user accounts, roles, permissions, service policies and audit records');

INSERT INTO permissions (permission_id, permission_code, description) VALUES
 (1,  'portal.access',       'Access the Student Portal (own profile, grades, subjects)'),
 (2,  'enrollment.submit',   'Create, submit and cancel own enrollment application'),
 (3,  'documents.request',   'Request TOR, COR and certifications'),
 (4,  'clearance.request',   'Request clearance and resubmit pending requirements'),
 (5,  'payments.submit',     'Submit payments for own transactions'),
 (6,  'enrollment.review',   'Approve, return or reject enrollment applications'),
 (7,  'enrollment.finalize', 'Finalize enrollment and generate the COR'),
 (8,  'grades.encode',       'Encode grades'),
 (9,  'grades.publish',      'Publish encoded grades to students'),
 (10, 'documents.review',    'Approve, return or reject document requests'),
 (11, 'documents.release',   'Release approved documents'),
 (12, 'payments.verify',     'Confirm or unconfirm submitted payments'),
 (13, 'receipts.issue',      'Issue official receipts for confirmed payments'),
 (14, 'clearance.decide',    'Approve clearance or record pending requirements for own office'),
 (15, 'courses.manage',      'Maintain department courses, prerequisites and offerings'),
 (16, 'users.manage',        'Create user accounts, change account status, reset passwords'),
 (17, 'roles.manage',        'Assign permissions to roles'),
 (18, 'policies.manage',     'Maintain fees, document types, academic terms and office clearance settings'),
 (19, 'audit.view',          'View audit logs');

INSERT INTO role_permissions (role_id, permission_id, granted_by) VALUES
 (1,1,1),(1,2,1),(1,3,1),(1,4,1),(1,5,1),
 (2,6,1),(2,7,1),(2,8,1),(2,9,1),(2,10,1),(2,11,1),(2,14,1),
 (3,12,1),(3,13,1),(3,14,1),
 (4,14,1),(4,15,1),
 (5,16,1),(5,17,1),(5,18,1),(5,19,1);

-- ---------------------------------------------------------------------------
-- User accounts  (password for all: password123)
-- ---------------------------------------------------------------------------
SET @pw = '$2y$10$wxUyHrIAj3Tg4f.btDBI3.q7o1xL2uNxNMqZT7tZKKmxlQsKSUd/W';

INSERT INTO users (user_id, role_id, username, password_hash, account_status, created_by) VALUES
 (1,  5, 'admin',      @pw, 'Active', NULL),
 (2,  2, 'registrar',  @pw, 'Active', 1),
 (3,  3, 'cashier',    @pw, 'Active', 1),
 (4,  4, 'dept.ccs',   @pw, 'Active', 1),
 (5,  4, 'dept.cba',   @pw, 'Active', 1),
 (6,  1, '2023-00001', @pw, 'Active', 1),
 (7,  1, '2023-00002', @pw, 'Active', 1),
 (8,  1, '2026-00003', @pw, 'Active', 1),
 (9,  1, '2024-00004', @pw, 'Active', 1),
 (10, 1, '2023-00005', @pw, 'Active', 1);

-- ---------------------------------------------------------------------------
-- Offices, departments, programs
-- ---------------------------------------------------------------------------
INSERT INTO offices (office_id, office_code, office_name, office_type, requires_clearance, created_by) VALUES
 (1, 'REG',   'Office of the University Registrar', 'Registrar',      1, 1),
 (2, 'CASH',  'Cashier''s Office',                  'Cashier',        1, 1),
 (3, 'ADMIN', 'Office of Administration',           'Administration', 0, 1),
 (4, 'CCS',   'College of Computing Studies Office','Department',     1, 1),
 (5, 'CBA',   'College of Business Administration Office', 'Department', 1, 1);

INSERT INTO departments (department_id, office_id, department_code, department_name, created_by) VALUES
 (1, 4, 'CCS', 'College of Computing Studies', 1),
 (2, 5, 'CBA', 'College of Business Administration', 1);

INSERT INTO programs (program_id, department_id, program_code, program_name, created_by) VALUES
 (1, 1, 'BSIT', 'Bachelor of Science in Information Technology', 1),
 (2, 1, 'BSCS', 'Bachelor of Science in Computer Science', 1),
 (3, 2, 'BSBA', 'Bachelor of Science in Business Administration', 1);

-- ---------------------------------------------------------------------------
-- Staff and students
-- ---------------------------------------------------------------------------
INSERT INTO staff (staff_id, user_id, employee_number, office_id, first_name, middle_name, last_name, email, position_title) VALUES
 (1, 1, 'EMP-0001', 3, 'Ricardo', NULL,    'Aquino',     'admin@cuyotech.edu.ph',     'System Administrator'),
 (2, 2, 'EMP-0002', 1, 'Liza',    'M.',    'Bautista',   'registrar@cuyotech.edu.ph', 'University Registrar'),
 (3, 3, 'EMP-0003', 2, 'Ramon',   NULL,    'Garcia',     'cashier@cuyotech.edu.ph',   'Cashier'),
 (4, 4, 'EMP-0004', 4, 'Grace',   NULL,    'Villanueva', 'ccs@cuyotech.edu.ph',       'CCS Department Secretary'),
 (5, 5, 'EMP-0005', 5, 'Paolo',   NULL,    'Ramos',      'cba@cuyotech.edu.ph',       'CBA Department Secretary');

INSERT INTO students (student_id, user_id, student_number, program_id, first_name, middle_name, last_name, birth_date, email, contact_number, address, year_level) VALUES
 (1, 6,  '2023-00001', 1, 'Juan',  'Santos',  'Dela Cruz', '2004-03-15', 'juan.delacruz@student.cuyotech.edu.ph', '0917 123 4567', 'Brgy. Banay-banay, City of Cabuyao, Laguna', 3),
 (2, 7,  '2023-00002', 1, 'Maria', 'Lopez',   'Santos',    '2004-07-22', 'maria.santos@student.cuyotech.edu.ph',  '0918 222 3344', 'Brgy. Pulo, City of Cabuyao, Laguna', 3),
 (3, 8,  '2026-00003', 1, 'Jose',  NULL,      'Mercado',   '2007-11-02', 'jose.mercado@student.cuyotech.edu.ph',  '0920 555 1212', 'Brgy. Mamatid, City of Cabuyao, Laguna', 1),
 (4, 9,  '2024-00004', 3, 'Ana',   'Cruz',    'Reyes',     '2005-01-09', 'ana.reyes@student.cuyotech.edu.ph',     '0921 777 8899', 'Brgy. Marinig, City of Cabuyao, Laguna', 2),
 (5, 10, '2023-00005', 1, 'Carlo', 'Diaz',    'Mendoza',   '2004-05-30', 'carlo.mendoza@student.cuyotech.edu.ph', '0915 444 0001', 'Brgy. Sala, City of Cabuyao, Laguna', 3);

-- ---------------------------------------------------------------------------
-- Academic terms
-- ---------------------------------------------------------------------------
INSERT INTO academic_terms (term_id, school_year, semester, start_date, end_date, enrollment_start, enrollment_end, term_status, created_by) VALUES
 (1, '2025-2026', 'First',  '2025-08-11', '2025-12-19', '2025-07-14', '2025-08-08', 'Closed',   1),
 (2, '2025-2026', 'Second', '2026-01-12', '2026-05-22', '2025-12-08', '2026-01-09', 'Closed',   1),
 (3, '2026-2027', 'First',  '2026-08-10', '2026-12-18', '2026-07-13', '2026-11-30', 'Open',     1),
 (4, '2026-2027', 'Second', '2027-01-11', '2027-05-21', '2026-12-07', '2027-01-08', 'Upcoming', 1);

-- ---------------------------------------------------------------------------
-- Courses and prerequisites
-- ---------------------------------------------------------------------------
INSERT INTO courses (course_id, department_id, course_code, course_name, units, created_by) VALUES
 (1,  1, 'IT101', 'Introduction to Computing', 3, 4),
 (2,  1, 'IT102', 'Computer Programming 1', 3, 4),
 (3,  1, 'IT201', 'Computer Programming 2', 3, 4),
 (4,  1, 'IT202', 'Data Structures and Algorithms', 3, 4),
 (5,  1, 'IT203', 'Networking 1', 3, 4),
 (6,  1, 'IT301', 'Systems Analysis and Design', 3, 4),
 (7,  1, 'IT302', 'Database Management Systems', 3, 4),
 (8,  1, 'IT303', 'Web Systems and Technologies', 3, 4),
 (9,  1, 'IT304', 'Information Assurance and Security', 3, 4),
 (10, 1, 'IT305', 'Software Engineering', 3, 4),
 (11, 2, 'GE101', 'Purposive Communication', 3, 5),
 (12, 2, 'BA101', 'Principles of Management', 3, 5),
 (13, 2, 'BA102', 'Financial Accounting', 3, 5),
 (14, 2, 'BA201', 'Marketing Management', 3, 5),
 (15, 2, 'GE102', 'Mathematics in the Modern World', 3, 5);

INSERT INTO course_prerequisites (course_id, prerequisite_course_id, created_by) VALUES
 (3, 2, 4),   -- IT201 needs IT102
 (4, 3, 4),   -- IT202 needs IT201
 (5, 1, 4),   -- IT203 needs IT101
 (6, 4, 4),   -- IT301 needs IT202
 (7, 3, 4),   -- IT302 needs IT201
 (8, 3, 4),   -- IT303 needs IT201
 (9, 5, 4),   -- IT304 needs IT203
 (10, 4, 4),  -- IT305 needs IT202
 (14, 12, 5); -- BA201 needs BA101

-- ---------------------------------------------------------------------------
-- Course offerings
-- ---------------------------------------------------------------------------
INSERT INTO course_offerings (offering_id, course_id, term_id, section_code, capacity, offering_status, created_by) VALUES
 -- 1st Sem 2025-2026 (closed)
 (1, 1, 1, '2IT-B', 40, 'Closed', 4),
 (2, 2, 1, '2IT-B', 40, 'Closed', 4),
 (3, 11, 1, '2IT-B', 40, 'Closed', 5),
 (4, 15, 1, '2IT-B', 40, 'Closed', 5),
 -- 2nd Sem 2025-2026 (closed)
 (5, 3, 2, '2IT-B', 40, 'Closed', 4),
 (6, 5, 2, '2IT-B', 40, 'Closed', 4),
 (7, 12, 2, '1BA-A', 40, 'Closed', 5),
 (8, 11, 2, '1BA-A', 40, 'Closed', 5),
 -- 1st Sem 2026-2027 (current, open for enrollment)
 (9,  4,  3, '3IT-B', 40, 'Open', 4),
 (10, 7,  3, '3IT-B', 40, 'Open', 4),
 (11, 8,  3, '3IT-B', 40, 'Open', 4),
 (12, 9,  3, '3IT-B', 40, 'Open', 4),
 (13, 6,  3, '3IT-B', 40, 'Open', 4),
 (14, 1,  3, '1IT-A', 40, 'Open', 4),
 (15, 2,  3, '1IT-A', 40, 'Open', 4),
 (16, 11, 3, '1IT-A', 40, 'Open', 5),
 (17, 13, 3, '2BA-A', 2,  'Open', 5),
 (18, 14, 3, '2BA-A', 35, 'Open', 5),
 (19, 3,  3, '3IT-B', 30, 'Open', 4),
 (20, 15, 3, '1IT-A', 40, 'Open', 5);

-- ---------------------------------------------------------------------------
-- Fees and document types
-- ---------------------------------------------------------------------------
INSERT INTO fees (fee_id, fee_code, fee_name, applies_to, fee_basis, amount, created_by) VALUES
 (1, 'TUITION', 'Tuition Fee',          'Enrollment', 'Per Unit', 450.00, 1),
 (2, 'MISC',    'Miscellaneous Fee',    'Enrollment', 'Fixed',   2500.00, 1),
 (3, 'TOR',     'Transcript of Records Fee', 'Document', 'Per Copy', 150.00, 1),
 (4, 'CORF',    'COR Copy Fee',         'Document',   'Per Copy',   50.00, 1),
 (5, 'CERT',    'Certification Fee',    'Document',   'Per Copy',  100.00, 1);

INSERT INTO document_types (document_type_id, document_code, document_name, requires_clearance, fee_id, processing_days, created_by) VALUES
 (1, 'TOR',         'Transcript of Records',            1, 3,    7, 1),
 (2, 'COR',         'Certificate of Registration',      0, 4,    1, 1),
 (3, 'CERT-GRADES', 'Certification of Grades',          0, 5,    3, 1),
 (4, 'CERT-ENROLL', 'Certificate of Enrollment',        0, 5,    2, 1),
 (5, 'GOOD-MORAL',  'Certificate of Good Moral Character', 0, NULL, 3, 1);

-- ---------------------------------------------------------------------------
-- Enrollments (history + current term)
-- ---------------------------------------------------------------------------
INSERT INTO enrollments (enrollment_id, student_id, term_id, enrollment_status, submitted_at, reviewed_by, reviewed_at, finalized_by, finalized_at, cor_number) VALUES
 (1,  1, 1, 'Finalized', '2025-07-20 09:00:00', 2, '2025-07-21 10:00:00', 2, '2025-07-25 14:00:00', 'COR-2025-000001'),
 (2,  1, 2, 'Finalized', '2025-12-10 09:00:00', 2, '2025-12-11 10:00:00', 2, '2025-12-15 14:00:00', 'COR-2025-000002'),
 (3,  2, 1, 'Finalized', '2025-07-20 09:30:00', 2, '2025-07-21 10:30:00', 2, '2025-07-25 14:30:00', 'COR-2025-000003'),
 (4,  2, 2, 'Finalized', '2025-12-10 09:30:00', 2, '2025-12-11 10:30:00', 2, '2025-12-15 14:30:00', 'COR-2025-000004'),
 (5,  4, 2, 'Finalized', '2025-12-12 08:00:00', 2, '2025-12-12 11:00:00', 2, '2025-12-16 09:00:00', 'COR-2025-000005'),
 (6,  5, 1, 'Finalized', '2025-07-22 13:00:00', 2, '2025-07-23 09:00:00', 2, '2025-07-28 10:00:00', 'COR-2025-000006'),
 (7,  5, 2, 'Finalized', '2025-12-11 13:00:00', 2, '2025-12-12 09:00:00', 2, '2025-12-17 10:00:00', 'COR-2025-000007'),
 (8,  1, 3, 'Finalized', '2026-07-15 08:30:00', 2, '2026-07-16 09:00:00', 2, '2026-07-20 15:00:00', 'COR-2026-000008'),
 (9,  5, 3, 'Finalized', '2026-07-16 10:00:00', 2, '2026-07-17 09:00:00', 2, '2026-07-21 15:00:00', 'COR-2026-000009'),
 (10, 4, 3, 'Submitted', '2026-10-14 10:15:00', NULL, NULL, NULL, NULL, NULL);

INSERT INTO enrollment_subjects (enrollment_subject_id, enrollment_id, offering_id) VALUES
 (1,1,1),(2,1,2),(3,1,3),(4,1,4),
 (5,2,5),(6,2,6),
 (7,3,1),(8,3,2),(9,3,3),(10,3,4),
 (11,4,5),(12,4,6),
 (13,5,7),(14,5,8),
 (15,6,1),(16,6,2),(17,6,3),(18,6,4),
 (19,7,5),(20,7,6),
 (21,8,9),(22,8,10),(23,8,11),(24,8,12),
 (25,9,9),(26,9,10),(27,9,11),
 (28,10,17),(29,10,18);

-- Published grades from previous terms (current-term grades are encoded live by the Registrar)
INSERT INTO grades (enrollment_subject_id, grade_value, special_mark, grade_status, encoded_by, encoded_at, published_by, published_at) VALUES
 (1, 1.50, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (2, 1.75, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (3, 2.00, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (4, 1.25, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (5, 1.75, NULL, 'Published', 2, '2026-05-25 10:00:00', 2, '2026-05-27 08:00:00'),
 (6, 2.00, NULL, 'Published', 2, '2026-05-25 10:00:00', 2, '2026-05-27 08:00:00'),
 (7, 2.00, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (8, 2.50, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (9, 1.75, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (10, 2.25, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (11, 5.00, NULL, 'Published', 2, '2026-05-25 10:00:00', 2, '2026-05-27 08:00:00'),
 (12, 2.25, NULL, 'Published', 2, '2026-05-25 10:00:00', 2, '2026-05-27 08:00:00'),
 (13, 1.75, NULL, 'Published', 2, '2026-05-25 10:00:00', 2, '2026-05-27 08:00:00'),
 (14, 2.00, NULL, 'Published', 2, '2026-05-25 10:00:00', 2, '2026-05-27 08:00:00'),
 (15, 2.25, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (16, 2.00, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (17, 2.50, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (18, 2.75, NULL, 'Published', 2, '2025-12-20 10:00:00', 2, '2025-12-22 08:00:00'),
 (19, 2.50, NULL, 'Published', 2, '2026-05-25 10:00:00', 2, '2026-05-27 08:00:00'),
 (20, NULL, 'INC', 'Published', 2, '2026-05-25 10:00:00', 2, '2026-05-27 08:00:00');

-- ---------------------------------------------------------------------------
-- Clearance
-- ---------------------------------------------------------------------------
INSERT INTO clearance_requests (clearance_id, student_id, term_id, purpose, clearance_status, submitted_at, completed_at) VALUES
 (1, 1, 3, 'Requirement for Transcript of Records request', 'In Progress', '2026-10-12 09:00:00', NULL),
 (2, 5, 3, 'Requirement for Transcript of Records (scholarship application)', 'Completed', '2026-09-01 09:00:00', '2026-09-05 16:00:00');

INSERT INTO clearance_office_decisions (clearance_id, office_id, decision_status, pending_items, decided_by, decided_at) VALUES
 (1, 1, 'Approved', NULL, 2, '2026-10-12 14:00:00'),
 (1, 2, 'For Review', NULL, NULL, NULL),
 (1, 4, 'Pending Requirements', 'Return the borrowed laptop to the CCS Computer Laboratory', 4, '2026-10-13 10:30:00'),
 (2, 1, 'Approved', NULL, 2, '2026-09-02 10:00:00'),
 (2, 2, 'Approved', NULL, 3, '2026-09-03 11:00:00'),
 (2, 4, 'Approved', NULL, 4, '2026-09-05 16:00:00');

-- ---------------------------------------------------------------------------
-- Document requests
-- ---------------------------------------------------------------------------
INSERT INTO document_requests (request_id, student_id, document_type_id, clearance_id, purpose, copies, delivery_channel, request_status, submitted_at, reviewed_by, reviewed_at, released_by, released_at) VALUES
 (1, 1, 2, NULL, 'Scholarship renewal requirement', 1, 'Email',  'Released',  '2026-07-22 09:00:00', 2, '2026-07-22 13:00:00', 2, '2026-07-23 10:00:00'),
 (2, 1, 1, NULL, 'Application for on-the-job training', 1, 'Pickup', 'Submitted', '2026-10-13 08:45:00', NULL, NULL, NULL, NULL),
 (3, 5, 5, NULL, 'Requirement for scholarship application', 1, 'Pickup', 'Approved', '2026-10-10 10:00:00', 2, '2026-10-11 09:00:00', NULL, NULL),
 (4, 2, 3, NULL, 'Requirement for academic scholarship', 2, 'Pickup', 'Approved', '2026-10-09 14:00:00', 2, '2026-10-10 09:00:00', NULL, NULL);

-- ---------------------------------------------------------------------------
-- Payments and official receipts
--   Enrollment fee = units x 450 + 2,500   (12 units = 7,900 ; 9 units = 6,550 ; 6 units = 5,200)
-- ---------------------------------------------------------------------------
INSERT INTO payments (payment_id, enrollment_id, document_request_id, amount, payment_method, reference_number, payment_status, submitted_at, verified_by, verified_at) VALUES
 (1, 1, NULL, 7900.00, 'Cash', NULL, 'Confirmed', '2025-07-22 09:00:00', 3, '2025-07-22 09:10:00'),
 (2, 2, NULL, 5200.00, 'E-Wallet', 'GC-88120001', 'Confirmed', '2025-12-12 09:00:00', 3, '2025-12-12 11:00:00'),
 (3, 3, NULL, 7900.00, 'Cash', NULL, 'Confirmed', '2025-07-22 10:00:00', 3, '2025-07-22 10:10:00'),
 (4, 4, NULL, 5200.00, 'Bank Transfer', 'BDO-551200', 'Confirmed', '2025-12-12 10:00:00', 3, '2025-12-12 13:00:00'),
 (5, 5, NULL, 5200.00, 'Cash', NULL, 'Confirmed', '2025-12-13 08:30:00', 3, '2025-12-13 08:40:00'),
 (6, 6, NULL, 7900.00, 'Cash', NULL, 'Confirmed', '2025-07-24 08:30:00', 3, '2025-07-24 08:40:00'),
 (7, 7, NULL, 5200.00, 'E-Wallet', 'GC-88120077', 'Confirmed', '2025-12-13 15:00:00', 3, '2025-12-14 09:00:00'),
 (8, 8, NULL, 7900.00, 'E-Wallet', 'GC-99110008', 'Confirmed', '2026-07-17 10:00:00', 3, '2026-07-18 09:00:00'),
 (9, 9, NULL, 6550.00, 'Bank Transfer', 'BPI-771009', 'Confirmed', '2026-07-18 11:00:00', 3, '2026-07-19 09:00:00'),
 (10, NULL, 1, 50.00, 'E-Wallet', 'GC-99110010', 'Confirmed', '2026-07-22 14:00:00', 3, '2026-07-22 16:00:00');

INSERT INTO receipts (payment_id, receipt_number, issued_by, issued_at) VALUES
 (1, 'OR-2025-000001', 3, '2025-07-22 09:15:00'),
 (2, 'OR-2025-000002', 3, '2025-12-12 11:05:00'),
 (3, 'OR-2025-000003', 3, '2025-07-22 10:15:00'),
 (4, 'OR-2025-000004', 3, '2025-12-12 13:05:00'),
 (5, 'OR-2025-000005', 3, '2025-12-13 08:45:00'),
 (6, 'OR-2025-000006', 3, '2025-07-24 08:45:00'),
 (7, 'OR-2025-000007', 3, '2025-12-14 09:05:00'),
 (8, 'OR-2026-000008', 3, '2026-07-18 09:05:00'),
 (9, 'OR-2026-000009', 3, '2026-07-19 09:05:00'),
 (10, 'OR-2026-000010', 3, '2026-07-22 16:05:00');

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
INSERT INTO notifications (user_id, title, message, reference_table, reference_id, is_read, created_at) VALUES
 (6, 'Enrollment finalized', 'You are officially enrolled. Your Certificate of Registration (COR-2026-000008) is now available.', 'enrollments', 8, 1, '2026-07-20 15:00:00'),
 (6, 'Clearance approved - Office of the University Registrar', 'Office of the University Registrar approved your clearance.', 'clearance_requests', 1, 0, '2026-10-12 14:00:00'),
 (6, 'Clearance pending - College of Computing Studies Office', 'College of Computing Studies Office needs: Return the borrowed laptop to the CCS Computer Laboratory. Resolve it and resubmit to this office.', 'clearance_requests', 1, 0, '2026-10-13 10:30:00'),
 (7, 'Document request Approved', 'Your Certification of Grades request was approved. Please pay ₱200.00 under Payments.', 'document_requests', 4, 0, '2026-10-10 09:00:00'),
 (10, 'Document request Approved', 'Your Certificate of Good Moral Character request was approved. No fee is due.', 'document_requests', 3, 0, '2026-10-11 09:00:00'),
 (2, 'New enrollment application', 'Ana Reyes (2024-00004) submitted an enrollment application.', 'enrollments', 10, 0, '2026-10-14 10:15:00'),
 (2, 'New document request', 'Juan Dela Cruz requested Transcript of Records (1).', 'document_requests', 2, 0, '2026-10-13 08:45:00'),
 (3, 'New clearance request', 'Juan Dela Cruz (2023-00001) requested clearance.', 'clearance_requests', 1, 0, '2026-10-12 09:00:00'),
 (4, 'New clearance request', 'Juan Dela Cruz (2023-00001) requested clearance.', 'clearance_requests', 1, 1, '2026-10-12 09:00:00');

INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value, created_at) VALUES
 (1, 'SYSTEM_SEEDED', 'users', NULL, '{"note":"Demo data loaded"}', NOW());

SET FOREIGN_KEY_CHECKS = 1;
