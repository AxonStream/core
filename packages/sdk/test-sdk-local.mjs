#!/usr/bin/env node

/**
 * 🧪 LOCAL SDK TEST
 * Tests the SDK build locally before publishing
 */

import { AxonPulsClient } from './dist/index.js';

console.log('🚀 Testing Local SDK Build\n');

// Test 1: Basic import
console.log('✅ SDK imported successfully');
console.log('   - AxonPulsClient type:', typeof AxonPulsClient);

// Test 2: Client creation with validation
console.log('\n🧪 Testing client validation...');
try {
    new AxonPulsClient({
        url: 'wss://test',
        token: 'invalid'
    });
    console.log('❌ Should have failed with invalid token');
} catch (error) {
    console.log('✅ Proper validation:', error.message.substring(0, 50) + '...');
}

// Test 3: Valid client
console.log('\n🧪 Testing valid client...');
try {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJvcmdhbml6YXRpb25JZCI6InRlc3Qtb3JnIiwiaWF0IjoxNjM5NTM2MDAwLCJleHAiOjk5OTk5OTk5OTl9.fake-signature';

    const client = new AxonPulsClient({
        url: 'wss://api.axonstream.ai',
        token: jwt
    });

    console.log('✅ Client created successfully');
    console.log('   - Organization:', client.getOrganizationId());
    console.log('   - User:', client.getUserId());
} catch (error) {
    console.log('❌ Valid client creation failed:', error.message);
}

console.log('\n🎯 Local SDK test complete!');
