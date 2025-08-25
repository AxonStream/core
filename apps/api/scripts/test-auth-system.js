#!/usr/bin/env node

/**
 * AxonPuls Platform - Authentication & RBAC System Test
 * Tests the complete authentication and RBAC system functionality
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'SecureTestPassword123!';
const TEST_ORG_NAME = `Test Organization ${Date.now()}`;
const TEST_ORG_SLUG = `test-org-${Date.now()}`;

console.log('🧪 AxonPuls Platform - Authentication & RBAC System Test');
console.log('===================================================\n');

let accessToken = '';
let organizationId = '';
let userId = '';

/**
 * Test runner with error handling
 */
async function runTest(testName, testFunction) {
    try {
        console.log(`🔍 Testing: ${testName}`);
        await testFunction();
        console.log(`✅ ${testName} - PASSED\n`);
        return true;
    } catch (error) {
        console.log(`❌ ${testName} - FAILED`);
        console.log(`   Error: ${error.message}\n`);
        return false;
    }
}

/**
 * Test 1: User Registration
 */
async function testUserRegistration() {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        firstName: 'Test',
        lastName: 'User',
        organizationName: TEST_ORG_NAME,
        organizationSlug: TEST_ORG_SLUG,
    });

    if (response.status !== 201) {
        throw new Error(`Expected status 201, got ${response.status}`);
    }

    if (!response.data.accessToken) {
        throw new Error('No access token returned');
    }

    if (!response.data.user) {
        throw new Error('No user data returned');
    }

    if (!response.data.organization) {
        throw new Error('No organization data returned');
    }

    // Store for subsequent tests
    accessToken = response.data.accessToken;
    organizationId = response.data.organization.id;
    userId = response.data.user.id;

    console.log(`   User ID: ${userId}`);
    console.log(`   Organization ID: ${organizationId}`);
}

/**
 * Test 2: User Login
 */
async function testUserLogin() {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });

    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!response.data.accessToken) {
        throw new Error('No access token returned');
    }

    // Update token
    accessToken = response.data.accessToken;
}

/**
 * Test 3: Protected Route Access
 */
async function testProtectedRouteAccess() {
    const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!response.data.id) {
        throw new Error('No user profile data returned');
    }
}

/**
 * Test 4: RBAC - Get System Roles
 */
async function testGetSystemRoles() {
    const response = await axios.get(`${API_BASE_URL}/rbac/roles`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!Array.isArray(response.data)) {
        throw new Error('Expected array of roles');
    }

    // Should have system roles
    const systemRoles = response.data.filter(role => role.isSystem);
    if (systemRoles.length === 0) {
        throw new Error('No system roles found');
    }

    console.log(`   Found ${systemRoles.length} system roles`);
    console.log(`   Total roles: ${response.data.length}`);
}

/**
 * Test 5: RBAC - Create Custom Role
 */
async function testCreateCustomRole() {
    const roleData = {
        name: 'Test Custom Role',
        description: 'A test role for validation',
        permissions: ['user:read', 'connection:read'],
        level: 'VIEWER',
    };

    const response = await axios.post(`${API_BASE_URL}/rbac/roles`, roleData, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (response.status !== 201) {
        throw new Error(`Expected status 201, got ${response.status}`);
    }

    if (response.data.name !== roleData.name) {
        throw new Error('Role name mismatch');
    }

    console.log(`   Created role: ${response.data.name}`);
    console.log(`   Role ID: ${response.data.id}`);
}

/**
 * Test 6: RBAC - Get User Roles and Permissions
 */
async function testGetUserRolesAndPermissions() {
    const response = await axios.get(`${API_BASE_URL}/rbac/users/${userId}/roles`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!Array.isArray(response.data.roles)) {
        throw new Error('Expected roles array');
    }

    if (!Array.isArray(response.data.permissions)) {
        throw new Error('Expected permissions array');
    }

    console.log(`   User roles: ${response.data.roles.join(', ')}`);
    console.log(`   Permissions count: ${response.data.permissions.length}`);
}

/**
 * Test 7: RBAC - Get Available Permissions
 */
async function testGetAvailablePermissions() {
    const response = await axios.get(`${API_BASE_URL}/rbac/permissions`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!Array.isArray(response.data.permissions)) {
        throw new Error('Expected permissions array');
    }

    if (response.data.permissions.length === 0) {
        throw new Error('No permissions found');
    }

    console.log(`   Available permissions: ${response.data.permissions.length}`);
}

/**
 * Test 8: Token Refresh
 */
async function testTokenRefresh() {
    // First, get the refresh token from login
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });

    const refreshToken = loginResponse.data.refreshToken;
    if (!refreshToken) {
        throw new Error('No refresh token returned from login');
    }

    // Test token refresh
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken: refreshToken,
    });

    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!response.data.accessToken) {
        throw new Error('No new access token returned');
    }

    console.log(`   Token refresh successful`);
}

/**
 * Test 9: Invalid Authentication
 */
async function testInvalidAuthentication() {
    try {
        await axios.get(`${API_BASE_URL}/auth/profile`, {
            headers: {
                Authorization: 'Bearer invalid-token',
            },
        });
        throw new Error('Expected authentication to fail');
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log(`   Correctly rejected invalid token`);
        } else {
            throw error;
        }
    }
}

/**
 * Test 10: Rate Limiting (if enabled)
 */
async function testRateLimiting() {
    console.log(`   Testing rate limiting (making multiple requests)...`);
    
    const requests = [];
    for (let i = 0; i < 10; i++) {
        requests.push(
            axios.get(`${API_BASE_URL}/rbac/permissions`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }).catch(error => error.response)
        );
    }

    const responses = await Promise.all(requests);
    const successCount = responses.filter(r => r.status === 200).length;
    const rateLimitedCount = responses.filter(r => r.status === 429).length;

    console.log(`   Successful requests: ${successCount}`);
    console.log(`   Rate limited requests: ${rateLimitedCount}`);
    
    if (successCount === 0) {
        throw new Error('All requests were blocked');
    }
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log(`🎯 Target API: ${API_BASE_URL}`);
    console.log(`📧 Test Email: ${TEST_EMAIL}\n`);

    const tests = [
        ['User Registration', testUserRegistration],
        ['User Login', testUserLogin],
        ['Protected Route Access', testProtectedRouteAccess],
        ['RBAC - Get System Roles', testGetSystemRoles],
        ['RBAC - Create Custom Role', testCreateCustomRole],
        ['RBAC - Get User Roles and Permissions', testGetUserRolesAndPermissions],
        ['RBAC - Get Available Permissions', testGetAvailablePermissions],
        ['Token Refresh', testTokenRefresh],
        ['Invalid Authentication', testInvalidAuthentication],
        ['Rate Limiting', testRateLimiting],
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const [testName, testFunction] of tests) {
        const passed = await runTest(testName, testFunction);
        if (passed) passedTests++;
    }

    console.log('📊 Test Results Summary');
    console.log('======================');
    console.log(`✅ Passed: ${passedTests}/${totalTests}`);
    console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 All tests passed! Authentication & RBAC system is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the system configuration.');
        process.exit(1);
    }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node test-auth-system.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h     Show this help message');
    console.log('  --url <url>    Set API base URL (default: http://localhost:3001)');
    console.log('');
    console.log('Environment Variables:');
    console.log('  API_BASE_URL   Set the API base URL');
    console.log('');
    console.log('Example:');
    console.log('  node test-auth-system.js --url http://localhost:3001');
    console.log('  API_BASE_URL=http://localhost:3001 node test-auth-system.js');
    process.exit(0);
}

// Check if API is accessible
axios.get(`${API_BASE_URL}/health`)
    .then(() => {
        console.log('🟢 API is accessible, starting tests...\n');
        runAllTests();
    })
    .catch((error) => {
        console.log('🔴 API is not accessible!');
        console.log(`   URL: ${API_BASE_URL}`);
        console.log(`   Error: ${error.message}`);
        console.log('\n💡 Make sure the API server is running:');
        console.log('   npm run start:dev  (for development)');
        console.log('   npm run start:prod (for production)');
        process.exit(1);
    });
