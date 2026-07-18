const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js') && f !== 'auth.js');

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Convert route handlers to async
  content = content.replace(/router\.(get|post|put|delete)\(([^,]+),\s*(?:requireAuth,\s*)?\(req, res\) => {/g, (match, method, route) => {
    return match.replace('(req, res) => {', 'async (req, res) => {');
  });
  
  // Convert db.prepare('QUERY').get(args) -> (await db.execute({ sql: 'QUERY', args: [args] })).rows[0]
  content = content.replace(/db\.prepare\(([`'"])([\s\S]*?)\1\)\.get\(([\s\S]*?)\)/g, '(await db.execute({ sql: $1$2$1, args: [$3] })).rows[0]');
  content = content.replace(/db\.prepare\(([`'"])([\s\S]*?)\1\)\.get\(\)/g, '(await db.execute($1$2$1)).rows[0]');
  
  // Convert db.prepare('QUERY').all(args) -> (await db.execute({ sql: 'QUERY', args: [args] })).rows
  content = content.replace(/db\.prepare\(([`'"])([\s\S]*?)\1\)\.all\(([\s\S]*?)\)/g, '(await db.execute({ sql: $1$2$1, args: [$3] })).rows');
  content = content.replace(/db\.prepare\(([`'"])([\s\S]*?)\1\)\.all\(\)/g, '(await db.execute($1$2$1)).rows');
  
  // Convert db.prepare('QUERY').run(args) -> await db.execute({ sql: 'QUERY', args: [args] })
  content = content.replace(/db\.prepare\(([`'"])([\s\S]*?)\1\)\.run\(([\s\S]*?)\)/g, 'await db.execute({ sql: $1$2$1, args: [$3] })');
  content = content.replace(/db\.prepare\(([`'"])([\s\S]*?)\1\)\.run\(\)/g, 'await db.execute($1$2$1)');

  // Fix cases where args has spread operator e.g. ...params
  content = content.replace(/args: \[\.\.\.([^\]]+)\]/g, 'args: $1');
  
  // Fix db.transaction() -> since @libsql/client has different transaction API, we can just await the statements
  content = content.replace(/const tx = db\.transaction\(\(\) => (\{[\s\S]*?\})\);\s*tx\(\);/g, 'await (async () => $1)();');
  content = content.replace(/const tx = db\.transaction\(\(\) => ([^\n]+)\);\s*tx\(\);/g, 'await (async () => { $1 })();');
  
  // Custom fixes for `...params` that are inside execute arguments
  content = content.replace(/args: \[([^\]]+)\]/g, (match, argsContent) => {
    if (argsContent.includes('...params')) return `args: ${argsContent.replace('...', '')}`;
    return match;
  });

  fs.writeFileSync(filePath, content);
  console.log('Migrated', file);
}
