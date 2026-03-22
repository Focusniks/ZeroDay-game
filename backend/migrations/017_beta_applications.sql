-- Migration: Create beta_applications table
-- Description: Table for storing beta test applications

CREATE TABLE IF NOT EXISTS beta_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    source VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_beta_applications_email ON beta_applications(email);

-- Index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_beta_applications_status ON beta_applications(status);

-- Index for faster date sorting
CREATE INDEX IF NOT EXISTS idx_beta_applications_created_at ON beta_applications(created_at DESC);
