const crypto = require('crypto');

// Generate RSA key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

console.log('🔑 Generated JWT Keys for Docker Environment:');
console.log('\n📋 JWT_PUBLIC_KEY:');
console.log(publicKey.replace(/\n/g, '\\n'));
console.log('\n🔐 JWT_PRIVATE_KEY:');
console.log(privateKey.replace(/\n/g, '\\n'));
console.log('\n💡 Copy these values to your docker-compose.yml environment section');
