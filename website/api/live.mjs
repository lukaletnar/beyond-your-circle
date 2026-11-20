import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
const env = Object.fromEntries(
  Object.entries(process.env).map(
    ([key, value]) => [key, value.trim()]
  )
);
const hash=s=>createHash('sha256').update(s).digest('hex');
const eq=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;return timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)))};
const ids=['magazine','exhibition','platform'];
const clean=(v,max)=>typeof v==='string'?v.trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,max):'';
const tags=v=>Array.isArray(v)?[...new Set(v.map(x=>clean(x,32)).filter(Boolean))].slice(0,6):[];
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function db(path,options={}){
 const key=env.SUPABASE_SECRET_KEY;
 const headers={apikey:key,'Content-Type':'application/json',...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{}) ,...options.headers};
 const r=await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${path}`,{...options,headers,signal:AbortSignal.timeout(10000)});
if (!r.ok) {
  const body = await r.text();
  let code = "unknown";

  try {
    code = JSON.parse(body).code || "unknown";
  } catch {}

  console.error("SUPABASE ERROR", {
    status: r.status,
    code: code
  });

  if (body.includes("DEMO_CAPACITY"))
    throw fail(409, "Classroom is full. Ask the presenter.");

throw fail(503, `BYC-DIAG-V1: Supabase HTTP ${r.status}`);} return r.status===204?null:await r.json();
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(payload));};
 try{
  if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY||!env.DEMO_CODE||!env.HOST_TOKEN||env.DEMO_CODE.length<8||env.HOST_TOKEN.length<16||!Number.isFinite(Date.parse(env.DEMO_EXPIRES_AT)))throw fail(503,'Live classroom setup is not complete. Concept preview is still available.');
  const action=new URL(req.url,'http://localhost').searchParams.get('action')||'list';
  if(req.method==='GET'&&action==='status')return send(200,{open:Date.now()<Date.parse(env.DEMO_EXPIRES_AT)});
  if (!eq(req.headers['x-demo-code'], env.DEMO_CODE)) {
  console.warn('BYC DEBUG', {
    configuredLength: env.DEMO_CODE?.length,
    receivedLength: req.headers['x-demo-code']?.length,
    deployment: process.env.VERCEL_GIT_COMMIT_SHA
  });
  throw fail(401, 'Enter the classroom access code.');
}
  const host=eq(req.headers['x-host-token'],env.HOST_TOKEN);
  if(Date.now()>=Date.parse(env.DEMO_EXPIRES_AT)&&!(host&&action==='reset')&&action!=='delete')throw fail(410,'The classroom session has ended.');
  const session=hash(env.DEMO_CODE).slice(0,32);
  const scope=`session=eq.${session}`;
  if(req.method==='GET'&&action==='host') {if(!host)throw fail(403,'Incorrect presenter token.');return send(200,{ok:true});}
  if(req.method==='GET'&&action==='list'){
   const people=await db(`byc_profiles?${scope}&select=id,name,programme,skills,interests,bio,projects,created_at&order=created_at.desc&limit=60`);
   return send(200,{people});
  }
  if(req.method!=='POST')throw fail(405,'Unsupported request.');
  if(Number(req.headers['content-length']||0)>10000)throw fail(413,'Request too large.');
  let body=req.body;if(typeof body==='string')body=JSON.parse(body);if(!body||typeof body!=='object')throw fail(400,'Invalid request.');
  if(action==='reset'){if(!host)throw fail(403,'Presenter authorization required.');await db(`byc_profiles?${scope}`,{method:'DELETE'});return send(200,{ok:true});}
  if(action==='join'){
   if(body.consent!==true)throw fail(400,'Please confirm you want to join the classroom demo.');
   const name=clean(body.name,48);if(!name)throw fail(400,'Enter a display name or nickname.');
   const token=typeof body.token==='string'&&/^[a-f0-9]{64}$/.test(body.token)?body.token:randomBytes(32).toString('hex');
   const p={p_session:session,p_token_hash:hash(token),p_name:name,p_programme:clean(body.programme,70),p_skills:tags(body.skills),p_interests:tags(body.interests),p_bio:clean(body.bio,180)};
   const result=await db('rpc/byc_join',{method:'POST',body:JSON.stringify(p)});
   return send(200,{id:result,token});
  }
  const token=body.token;if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw fail(401,'Create a profile first.');
  const own=`${scope}&token_hash=eq.${hash(token)}`;
  if(action==='delete'){await db(`byc_profiles?${own}`,{method:'DELETE'});return send(200,{ok:true});}
  if(action==='interest'){
   if(!ids.includes(body.project))throw fail(400,'Unknown project.');
   const rows=await db(`byc_profiles?${own}&select=projects`);if(!rows.length)throw fail(404,'Profile not found. Join again.');
   const old=rows[0].projects||[],projects=old.includes(body.project)?old.filter(x=>x!==body.project):[...old,body.project];
   await db(`byc_profiles?${own}`,{method:'PATCH',body:JSON.stringify({projects})});return send(200,{projects});
  }
  throw fail(404,'Unknown action.');
 }catch(e){return send(e.status||500,{error:e.status?e.message:'Something went wrong. Please retry.'});}
}
