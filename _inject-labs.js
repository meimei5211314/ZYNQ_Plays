const fs = require('fs');
const path = require('path');
const root = 'E:/opencode_workspace/zynq-lecture';

const files = ['index.html', 'chapter2.html'];
for (let i = 3; i <= 51; i += 1) files.push('chapter' + i + '.html');

let report = [];
for (const file of files) {
  const full = path.join(root, file);
  let html = fs.readFileSync(full, 'utf8');
  if (html.includes('data-zx-chapter')) {
    report.push(file + ': already injected');
    continue;
  }
  let key;
  if (file === 'index.html') key = 'ch01';
  else if (file === 'chapter2.html') key = 'ch02';
  else key = 'ch' + String(Number(file.match(/\d+/)[0])).padStart(2, '0');

  let changed = 0;

  if (!html.includes('href="lab.css"')) {
    if (html.includes('<link rel="stylesheet" href="chapter.css">')) {
      html = html.replace('<link rel="stylesheet" href="chapter.css">',
        '<link rel="stylesheet" href="chapter.css">\n<link rel="stylesheet" href="lab.css">');
      changed += 1;
    } else if (html.includes('<link rel="stylesheet" href="chapter2.css">')) {
      html = html.replace('<link rel="stylesheet" href="chapter2.css">',
        '<link rel="stylesheet" href="chapter2.css">\n<link rel="stylesheet" href="lab.css">');
      changed += 1;
    } else if (html.includes('<link rel="stylesheet" href="style.css">')) {
      html = html.replace('<link rel="stylesheet" href="style.css">',
        '<link rel="stylesheet" href="style.css">\n<link rel="stylesheet" href="lab.css">');
      changed += 1;
    }
  }

  const section = '  <section id="zx-lab" class="zx-section" data-zx-chapter="' + key + '"></section>\n\n';
  if (html.includes('<section class="chapter-check" id="check"')) {
    html = html.replace('<section class="chapter-check" id="check"', section + '<section class="chapter-check" id="check"');
    changed += 1;
  } else if (html.includes('<section id="check"')) {
    html = html.replace('<section id="check"', section + '<section id="check"');
    changed += 1;
  }

  html = html.replace(/(\n)(\s*)<a href="#check">/, function (m, nl, indent) {
    changed += 1;
    return nl + indent + '<a href="#zx-lab"><span class="num">LAB</span>互动实验室</a>' + nl + indent + '<a href="#check">';
  });

  if (!html.includes('src="lab.js"')) {
    const scripts = '<script src="lab-data-1.js"></script>\n<script src="lab-data-2.js"></script>\n<script src="lab-data-3.js"></script>\n<script src="lab.js"></script>\n';
    html = html.replace('</body>', scripts + '</body>');
    changed += 1;
  }

  fs.writeFileSync(full, html, 'utf8');
  report.push(file + ': ' + key + ' · ' + changed + ' edits');
}

console.log(report.join('\n'));
