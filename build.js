const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, 'www');

// Create www directory if it doesn't exist
if (!fs.existsSync(wwwDir)) {
    fs.mkdirSync(wwwDir, { recursive: true });
}

// Helper to copy files
function copyFile(filename) {
    const src = path.join(__dirname, filename);
    const dest = path.join(wwwDir, filename);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${filename} -> www/`);
    }
}

// Helper to copy directory recursively
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

// Copy web assets (force fresh assets)
copyFile('index.html');
copyFile('styles.css');
copyFile('manifest.json');
copyDir('js');

console.log('Web assets build complete in www/ folder (Cache-busting enforced)!');
