const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if ((!file.startsWith(root + path.sep) && file !== root) || file.includes(path.sep + '.')) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (error, data) => { if (error) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data); });
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
