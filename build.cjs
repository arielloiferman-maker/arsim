const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const publicDir = path.join(__dirname, 'public');
fs.mkdirSync(publicDir, {recursive:true});
fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(publicDir, 'index.html'));
const options={
 entryPoints:[path.join(__dirname,'game.js')],
 nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),
 bundle:true,format:'iife',minify:true,legalComments:'eof'
};
esbuild.buildSync({...options,outfile:path.join(publicDir,'play.js'),assetNames:'assets/[name]-[hash]',loader:{'.glb':'file'}});
esbuild.buildSync({...options,outfile:path.join(__dirname,'play.js'),loader:{'.glb':'binary'}});
fs.copyFileSync(path.join(__dirname,'cloudflare-headers.txt'),path.join(publicDir,'_headers'));
