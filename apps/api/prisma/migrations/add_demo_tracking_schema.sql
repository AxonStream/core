-- Demo Session Tracking
CREATE TABLE IF NOT EXISTS "DemoSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL UNIQUE,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "upgradePromptCount" INTEGER NOT NULL DEFAULT 0,
    "upgradeClickCount" INTEGER NOT NULL DEFAULT 0,
    "convertedToPaid" BOOLEAN NOT NULL DEFAULT false,
    "convertedAt" TIMESTAMP(3),
    
    -- Usage Statistics (JSON)
    "usageStats" JSONB NOT NULL DEFAULT '{}',
    
    -- Current Limits (JSON)
    "currentLimits" JSONB NOT NULL DEFAULT '{}',
    
    -- Metadata
    "metadata" JSONB NOT NULL DEFAULT '{}'
);

-- Package Installation Tracking
CREATE TABLE IF NOT EXISTS "PackageInstallation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL UNIQUE,
    "packageName" TEXT NOT NULL,
    "packageVersion" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "region" TEXT,
    "country" TEXT,
    "city" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "uninstalledAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    
    -- Environment Details (JSON)
    "environment" JSONB NOT NULL DEFAULT '{}',
    
    -- Framework Information (JSON)
    "framework" JSONB NOT NULL DEFAULT '{}',
    
    -- Usage Statistics (JSON)
    "usageStats" JSONB NOT NULL DEFAULT '{}',
    
    -- Installation Context
    "installationContext" JSONB NOT NULL DEFAULT '{}'
);

-- Feature Usage Tracking
CREATE TABLE IF NOT EXISTS "FeatureUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "featureName" TEXT NOT NULL,
    "featureCategory" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "firstUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "limitReached" BOOLEAN NOT NULL DEFAULT false,
    "limitReachedAt" TIMESTAMP(3),
    "upgradePrompted" BOOLEAN NOT NULL DEFAULT false,
    "upgradePromptedAt" TIMESTAMP(3),
    
    -- Usage Context (JSON)
    "usageContext" JSONB NOT NULL DEFAULT '{}',
    
    FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("sessionId") ON DELETE CASCADE
);

-- Demo Limits Configuration
CREATE TABLE IF NOT EXISTS "DemoLimitsConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configName" TEXT NOT NULL UNIQUE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Limits Configuration (JSON)
    "limits" JSONB NOT NULL DEFAULT '{}',
    
    -- Feature Gates (JSON)
    "featureGates" JSONB NOT NULL DEFAULT '{}',
    
    -- Upgrade Prompts Configuration (JSON)
    "upgradeConfig" JSONB NOT NULL DEFAULT '{}'
);

-- Upgrade Conversion Tracking
CREATE TABLE IF NOT EXISTS "UpgradeConversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "conversionType" TEXT NOT NULL, -- 'demo_to_trial', 'demo_to_paid', 'trial_to_paid'
    "conversionSource" TEXT NOT NULL, -- 'limit_reached', 'feature_prompt', 'manual'
    "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "planType" TEXT NOT NULL,
    "planPrice" DECIMAL(10,2),
    "currency" TEXT DEFAULT 'USD',
    
    -- Conversion Context (JSON)
    "conversionContext" JSONB NOT NULL DEFAULT '{}',
    
    -- Revenue Attribution
    "revenueAttribution" JSONB NOT NULL DEFAULT '{}',
    
    FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("sessionId") ON DELETE CASCADE
);

-- Analytics Aggregation Tables
CREATE TABLE IF NOT EXISTS "DemoAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE("date", "metric", "dimensions")
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS "DemoSession_sessionId_idx" ON "DemoSession"("sessionId");
CREATE INDEX IF NOT EXISTS "DemoSession_organizationId_idx" ON "DemoSession"("organizationId");
CREATE INDEX IF NOT EXISTS "DemoSession_createdAt_idx" ON "DemoSession"("createdAt");
CREATE INDEX IF NOT EXISTS "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "DemoSession_isActive_idx" ON "DemoSession"("isActive");

CREATE INDEX IF NOT EXISTS "PackageInstallation_packageName_idx" ON "PackageInstallation"("packageName");
CREATE INDEX IF NOT EXISTS "PackageInstallation_installedAt_idx" ON "PackageInstallation"("installedAt");
CREATE INDEX IF NOT EXISTS "PackageInstallation_region_idx" ON "PackageInstallation"("region");
CREATE INDEX IF NOT EXISTS "PackageInstallation_isActive_idx" ON "PackageInstallation"("isActive");

CREATE INDEX IF NOT EXISTS "FeatureUsage_sessionId_idx" ON "FeatureUsage"("sessionId");
CREATE INDEX IF NOT EXISTS "FeatureUsage_featureName_idx" ON "FeatureUsage"("featureName");
CREATE INDEX IF NOT EXISTS "FeatureUsage_lastUsedAt_idx" ON "FeatureUsage"("lastUsedAt");

CREATE INDEX IF NOT EXISTS "UpgradeConversion_sessionId_idx" ON "UpgradeConversion"("sessionId");
CREATE INDEX IF NOT EXISTS "UpgradeConversion_conversionType_idx" ON "UpgradeConversion"("conversionType");
CREATE INDEX IF NOT EXISTS "UpgradeConversion_convertedAt_idx" ON "UpgradeConversion"("convertedAt");

CREATE INDEX IF NOT EXISTS "DemoAnalytics_date_metric_idx" ON "DemoAnalytics"("date", "metric");

-- Insert Default Demo Limits Configuration
INSERT INTO "DemoLimitsConfig" ("id", "configName", "limits", "featureGates", "upgradeConfig") 
VALUES (
    'default_demo_limits',
    'Default Demo Limits',
    '{
        "maxChannels": 20,
        "maxEvents": 1000,
        "maxMagicRooms": 5,
        "maxWebhooks": 3,
        "maxConnections": 10,
        "rateLimit": 50,
        "rateLimitWindow": 60000,
        "dataRetentionDays": 7,
        "maxFileSize": 10485760,
        "maxApiCalls": 10000
    }',
    '{
        "monitoring": {"enabled": true, "upgradeRequired": false},
        "magic": {"enabled": true, "upgradeRequired": false},
        "webhooks": {"enabled": true, "upgradeRequired": false},
        "audit": {"enabled": true, "upgradeRequired": false},
        "analytics": {"enabled": true, "upgradeRequired": false},
        "customDomains": {"enabled": false, "upgradeRequired": true},
        "sso": {"enabled": false, "upgradeRequired": true},
        "advancedSecurity": {"enabled": false, "upgradeRequired": true}
    }',
    '{
        "showUsageWarningAt": 0.8,
        "showUpgradePromptAt": 0.9,
        "upgradePromptCooldown": 3600000,
        "maxUpgradePromptsPerDay": 3
    }'
) ON CONFLICT (configName) DO NOTHING;
