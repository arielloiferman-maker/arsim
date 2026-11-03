const fs = require('node:fs');
const path = require('node:path');
const {createHash}=require('node:crypto');
const esbuild = require('esbuild');
const publicDir = path.join(__dirname, 'public');
fs.mkdirSync(publicDir, {recursive:true});
const options={
 entryPoints:[path.join(__dirname,'game.js')],
 nodePaths:(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean),
 bundle:true,format:'iife',minify:true,legalComments:'eof'
};
const online=esbuild.buildSync({...options,outfile:path.join(publicDir,'play.js'),assetNames:'assets/[name]-[hash]',loader:{'.glb':'file'},write:false});
for(const file of online.outputFiles){
 if(!file.path.endsWith('play.js')){
  fs.mkdirSync(path.dirname(file.path),{recursive:true});
  fs.writeFileSync(file.path,file.contents);
  continue;
 }
 const hash=createHash('sha256').update(file.contents).digest('hex').slice(0,12);
 const filename='play-'+hash+'.js';
 fs.writeFileSync(path.join(publicDir,filename),file.contents);
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 fs.writeFileSync(path.join(publicDir,'index.html'),html.replace(/play\.js\?v=\d+/,filename));
}
esbuild.buildSync({...options,outfile:path.join(__dirname,'play.js'),loader:{'.glb':'binary'}});
fs.copyFileSync(path.join(__dirname,'cloudflare-headers.txt'),path.join(publicDir,'_headers'));
