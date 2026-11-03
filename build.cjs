const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const publicDir = path.join(__dirname, 'public');
fs.mkdirSync(publicDir, {recursive:true});
fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(publicDir, 'index.html'));
esbuild.buildSync({
 entryPoints:[path.join(__dirname,'game.js')],
 outfile:path.join(publicDir,'play.js'),
 nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),
 bundle:true,format:'iife',loader:{'.obj':'text'},legalComments:'inline'
});
fs.copyFileSync(path.join(publicDir,'play.js'),path.join(__dirname,'play.js'));
