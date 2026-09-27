const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB = path.join(ROOT, 'db.json');
const sessions = new Map();

function getDB(){
  if(!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify({users:[],attempts:[]}, null, 2));
  try { return JSON.parse(fs.readFileSync(DB,'utf8')); }
  catch { return {users:[],attempts:[]}; }
}
function saveDB(d){ fs.writeFileSync(DB, JSON.stringify(d,null,2)); }
function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')){
  return {salt, hash:crypto.scryptSync(String(password), salt, 64).toString('hex')};
}
function send(res,status,data,headers={}){
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  res.end(body);
}
function parseAuth(req){
  const h=req.headers.authorization||'';
  const token=h.startsWith('Bearer ')?h.slice(7):'';
  return sessions.get(token);
}
function requireAuth(req,res){
  const u=parseAuth(req);
  if(!u){send(res,401,{error:'Login required'});return null;}
  return u;
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',c=>{raw+=c;if(raw.length>2*1024*1024){reject(new Error('Payload too large'));req.destroy();}});
    req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(new Error('Invalid JSON'));}});
    req.on('error',reject);
  });
}
function safeFilePath(urlPath){
  let p=decodeURIComponent(urlPath.split('?')[0]);
  if(p==='/'||p==='') p='/index.html';
  const full=path.normalize(path.join(ROOT,p));
  if(!full.startsWith(ROOT)) return null;
  return full;
}
function serveStatic(req,res){
  const file=safeFilePath(req.url);
  if(!file) return send(res,403,{error:'Forbidden'});
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile()) return send(res,404,{error:'Not found'});
    const ext=path.extname(file).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-cache'});
    fs.createReadStream(file).pipe(res);
  });
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://127.0.0.1:${PORT}`);
    const p=url.pathname;
    if(p.startsWith('/api/')){
      if(req.method==='POST' && p==='/api/register'){
        const b=await readBody(req); const name=String(b.name||'').trim(); const mobile=String(b.mobile||'').trim(); const password=String(b.password||'');
        if(name.length<2||mobile.length<6||password.length<4) return send(res,400,{error:'Enter valid name, mobile/student ID and password.'});
        const d=getDB(); if(d.users.some(u=>u.mobile===mobile)) return send(res,409,{error:'Student account already exists.'});
        const h=hashPassword(password); const u={id:crypto.randomUUID(),name,mobile,salt:h.salt,hash:h.hash,createdAt:new Date().toISOString()}; d.users.push(u); saveDB(d);
        const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{id:u.id,name:u.name,mobile:u.mobile});
        return send(res,200,{token,user:{id:u.id,name:u.name,mobile:u.mobile}});
      }
      if(req.method==='POST' && p==='/api/login'){
        const b=await readBody(req), d=getDB(); const mobile=String(b.mobile||'').trim(); const password=String(b.password||''); const u=d.users.find(x=>x.mobile===mobile);
        if(!u || crypto.scryptSync(password,u.salt,64).toString('hex')!==u.hash) return send(res,401,{error:'Invalid student ID/mobile or password.'});
        const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{id:u.id,name:u.name,mobile:u.mobile});
        return send(res,200,{token,user:{id:u.id,name:u.name,mobile:u.mobile}});
      }
      const user=requireAuth(req,res); if(!user)return;
      if(req.method==='POST' && p==='/api/logout'){ const t=(req.headers.authorization||'').slice(7); sessions.delete(t); return send(res,200,{ok:true}); }
      if(req.method==='GET' && p==='/api/me'){ const d=getDB(); return send(res,200,{user,attempts:d.attempts.filter(x=>x.userId===user.id)}); }
      const m=p.match(/^\/api\/attempt\/(\d+)$/); if(m){ const day=Number(m[1]); if(day<7||day>20)return send(res,400,{error:'Invalid day'}); const d=getDB();
        if(req.method==='GET'){ return send(res,200,d.attempts.find(x=>x.userId===user.id&&x.day===day)||null); }
        if(req.method==='POST'){ const b=await readBody(req); let a=d.attempts.find(x=>x.userId===user.id&&x.day===day); if(!a){a={id:crypto.randomUUID(),userId:user.id,day,answers:{},reviewed:{},timer:9600,status:'in-progress',updatedAt:null};d.attempts.push(a);} if(b.answers)a.answers=b.answers; if(b.reviewed)a.reviewed=b.reviewed; if(Number.isFinite(b.timer))a.timer=Math.max(0,Math.min(9600,Number(b.timer))); if(b.status)a.status=b.status; if(b.result)a.result=b.result; a.updatedAt=new Date().toISOString(); saveDB(d); return send(res,200,a); }
      }
      return send(res,404,{error:'API route not found'});
    }
    serveStatic(req,res);
  }catch(e){ console.error(e); if(!res.headersSent)send(res,500,{error:'Server error'}); }
});
server.on('error',e=>{ console.error('SERVER_ERROR',e.message); process.exit(1); });
server.listen(PORT,'127.0.0.1',()=>console.log(`AP DSC Biology Student SaaS running at http://127.0.0.1:${PORT}`));
