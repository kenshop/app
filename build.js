const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, 'www');

// Ensure clean www directory
if (fs.existsSync(wwwDir)) {
    fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

function copyFile(filename) {
    const src = path.join(__dirname, filename);
    const dest = path.join(wwwDir, filename);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${filename} -> www/`);
    }
}

function copyDir(dirName) {
    const srcDir = path.join(__dirname, dirName);
    const destDir = path.join(wwwDir, dirName);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDir(path.join(dirName, entry.name));
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
    console.log(`Copied directory ${dirName} -> www/`);
}

// Bundle assets
copyFile('index.html');
copyFile('styles.css');
copyFile('manifest.json');
copyDir('js');

console.log('Build complete! Web assets copied to www/');
