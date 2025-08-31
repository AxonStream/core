# API Consolidation Implementation Guide

## 🎯 **Overview**

This guide provides step-by-step instructions to implement the API consolidation plan, transforming two separate API versions into a single, production-ready system.

## 📋 **Prerequisites**

- Node.js 18+ installed
- PostgreSQL database access
- Redis server access
- Git repository access
- Production environment access

## 🚀 **Phase 1: Secure Foundation (Week 1)**

### **Step 1: Deploy Original API to Production**

1. **Make deployment script executable:**
   ```bash
   chmod +x deployment/production-deploy.sh
   ```

2. **Review and update environment configuration:**
   ```bash
   # The script will create .env.production template
   # Update it with your actual production values
   ./deployment/production-deploy.sh
   ```

3. **Verify deployment:**
   ```bash
   curl http://localhost:3000/health
   ```

### **Step 2: Fix Hardened API Security Vulnerabilities**

1. **Run security fix script:**
   ```bash
   chmod +x scripts/fix-hardened-api-security.sh
   ./scripts/fix-hardened-api-security.sh
   ```

2. **Validate fixes:**
   ```bash
   node scripts/validate-consolidation.js
   ```

### **Step 3: Test Both APIs**

1. **Test Original API:**
   ```bash
   cd apps/api
   npm test
   npm run test:e2e
   ```

2. **Test Fixed Hardened API:**
   ```bash
   cd apps/axonstream_api_hardened_full_v6/api
   npm test
   npm run test:e2e
   ```

## 🔄 **Phase 2: Code Deduplication (Weeks 2-3)**

### **Step 1: Remove Exact Duplicates**

1. **Identify duplicates:**
   ```bash
   # Find identical files
   diff -r apps/api/src/common/services/ apps/axonstream_api_hardened_full_v6/api/src/common/services/
   ```

2. **Remove duplicate event-replay.service.ts:**
   ```bash
   # Keep original, remove hardened duplicate
   rm apps/axonstream_api_hardened_full_v6/api/src/common/services/event-replay.service.ts
   
   # Create symlink or import from original
   ln -s ../../../../api/src/common/services/event-replay.service.ts \
     apps/axonstream_api_hardened_full_v6/api/src/common/services/event-replay.service.ts
   ```

### **Step 2: Consolidate Configuration Utilities**

1. **Create shared configuration library:**
   ```bash
   mkdir -p shared/config
   cp apps/api/src/config/config.utils.ts shared/config/
   ```

2. **Update imports in both APIs:**
   ```typescript
   // In both APIs, update imports:
   import { safeParseInt, validateProductionSecrets } from '../../../shared/config/config.utils';
   ```

### **Step 3: Standardize Configuration Patterns**

1. **Apply consistent patterns:**
   ```bash
   # Use the validation script to ensure consistency
   node scripts/validate-consolidation.js
   ```

## 🎨 **Phase 3: Feature Integration (Weeks 4-6)**

### **Step 1: Integrate Zod Validation**

1. **Install Zod in Original API:**
   ```bash
   cd apps/api
   npm install zod
   ```

2. **Copy env.ts from hardened API:**
   ```bash
   cp apps/axonstream_api_hardened_full_v6/api/src/config/env.ts apps/api/src/config/
   ```

3. **Update main.ts to use Zod validation:**
   ```typescript
   import { validateEnv } from './config/env';
   
   // Add at the start of bootstrap()
   validateEnv(process.env);
   ```

### **Step 2: Fix SDK UI Component Issue**

1. **Investigate bundling issue:**
   ```bash
   cd packages/sdk
   npm run build -- --verbose
   ```

2. **Fix class inheritance issue:**
   ```typescript
   // In packages/sdk/src/ui/index.ts
   // Ensure proper export order and class definitions
   ```

3. **Re-enable UI exports:**
   ```typescript
   // In packages/sdk/src/index.ts
   // Uncomment UI component exports after fixing
   ```

### **Step 3: Replace Mock Implementations**

1. **Identify mock implementations:**
   ```bash
   grep -r "mock\|Mock\|TODO\|FIXME" apps/api/src/
   ```

2. **Replace with real implementations:**
   - Update rate limiting logic
   - Implement real analytics
   - Replace placeholder data

## 🧪 **Testing Strategy**

### **Unit Tests**
```bash
# Run tests for both APIs
npm run test:all

# Run specific test suites
npm run test:config
npm run test:security
```

### **Integration Tests**
```bash
# Test API endpoints
npm run test:integration

# Test database connections
npm run test:db

# Test Redis connections
npm run test:redis
```

### **Security Tests**
```bash
# Run security audit
npm audit

# Test configuration validation
node scripts/validate-consolidation.js

# Test production secrets
npm run test:secrets
```

## 📊 **Monitoring & Validation**

### **Health Checks**
```bash
# API health
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/db

# Redis health
curl http://localhost:3000/health/redis
```

### **Performance Monitoring**
```bash
# Monitor API performance
npm run monitor:performance

# Check memory usage
npm run monitor:memory

# Monitor error rates
npm run monitor:errors
```

## 🚨 **Rollback Procedures**

### **Quick Rollback**
```bash
# Rollback to original API
git checkout original-api-baseline
npm run deploy:rollback
```

### **Gradual Rollback**
```bash
# Disable specific features
npm run feature:disable --feature=hardened-integration
npm run feature:disable --feature=zod-validation
```

## 📈 **Success Metrics**

### **Phase 1 Success Criteria**
- [ ] Original API deployed and healthy
- [ ] Security vulnerabilities fixed
- [ ] All tests passing
- [ ] Configuration validation working

### **Phase 2 Success Criteria**
- [ ] Code duplication < 5%
- [ ] Shared utilities implemented
- [ ] Configuration consolidated
- [ ] No breaking changes

### **Phase 3 Success Criteria**
- [ ] UI components working
- [ ] Zod validation integrated
- [ ] Mock implementations replaced
- [ ] Production readiness score > 95%

## 🔗 **Next Steps**

1. **Execute Phase 1** using the provided scripts
2. **Monitor and validate** each step
3. **Proceed to Phase 2** only after Phase 1 success
4. **Maintain rollback capability** at each phase
5. **Document any issues** and solutions

## 📞 **Support**

If you encounter issues during implementation:

1. **Check logs** in the respective API directories
2. **Run validation script** to identify specific problems
3. **Review error messages** for configuration issues
4. **Test in staging** before applying to production

---

**Remember**: This is a production system migration. Take your time, test thoroughly, and maintain rollback capabilities at each step.
