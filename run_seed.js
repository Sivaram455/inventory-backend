const { execSync } = require('child_process');
const fs = require('fs');

try {
    console.log('Starting seed...');
    const output = execSync('node seed.js', { encoding: 'utf8' });
    console.log('Output:', output);
    fs.writeFileSync('seed_runner_result.txt', 'SUCCESS:\n' + output);
} catch (e) {
    console.error('Error:', e.message);
    fs.writeFileSync('seed_runner_result.txt', 'ERROR:\n' + e.stdout + '\n' + e.stderr + '\n' + e.message);
}
