const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting CampusOS Prototype Setup...\n');

const serverDir = path.join(__dirname, 'backend');
const clientDir = path.join(__dirname, 'app');

try {
  console.log('📦 Installing Server Dependencies...');
  execSync('npm install', { cwd: serverDir, stdio: 'inherit' });

  console.log('\n📦 Installing Client Dependencies...');
  execSync('npm install', { cwd: clientDir, stdio: 'inherit' });

  console.log('\n🏗️ Building Client App...');
  execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });

  console.log('\n✅ Setup Complete! Starting Server...');
  console.log('🌐 The app will be available at http://localhost:3001');
  
  // Start the server
  execSync('node index.js', { cwd: serverDir, stdio: 'inherit' });

} catch (error) {
  console.error('\n❌ An error occurred during setup:', error.message);
}
