const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'admin', 'index.html');
let content = fs.readFileSync(file, 'utf8');

// Change the CSS root variables to a White theme
const darkTheme = `:root {
    --bg: #0f1117; --bg2: #161b27; --bg3: #1e2535;
    --border: #2a3045; --accent: #3b82f6; --accent2: #1d4ed8;
    --success: #10b981; --danger: #ef4444; --warning: #f59e0b;
    --text1: #f1f5f9; --text2: #94a3b8; --text3: #64748b;
    --radius: 10px; --sidebar: 240px;
  }`;

const lightTheme = `:root {
    --bg: #f8fafc; --bg2: #ffffff; --bg3: #f1f5f9;
    --border: #e2e8f0; --accent: #3b82f6; --accent2: #1d4ed8;
    --success: #10b981; --danger: #ef4444; --warning: #f59e0b;
    --text1: #0f172a; --text2: #475569; --text3: #64748b;
    --radius: 10px; --sidebar: 240px;
  }`;

content = content.replace(darkTheme, lightTheme);

// Also replace "CampusOS" with "ADHI-IT" in the title and sidebar
content = content.replace(/<title>CampusOS Admin<\/title>/g, '<title>ADHI-IT Admin</title>');
content = content.replace(/<h1>CampusOS<\/h1>/g, '<h1>ADHI-IT</h1>');
content = content.replace(/Campus Management System/g, 'Adhi IT Department System');

fs.writeFileSync(file, content);
console.log('Updated index.html to light theme and ADHI-IT branding');
