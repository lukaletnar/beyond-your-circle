import { recommend } from '../assets/teams.mjs';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { programmes, skillGroups, interestGroups, habits } from '../assets/catalog.mjs';
const env=Object.fromEntries(Object.entries(process.env).map(([k,v])=>[k,v.trim()]));
const hash=s=>createHash('sha256').update(s).digest('hex');
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
const fail=(status,message)=>Object.assign(new Error(message),{status});
const clean=(v,n)=>typeof v==='string'?v.trim().replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').slice(0,n):'';
const required=(v,n,label)=>{const s=clean(v,n);if(!s)throw fail(400,`Enter ${label}.`);return s};
const uuid=v=>{if(typeof v!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)))throw fail(400,'Invalid reference.');return v};
const validToken=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t);
const tags=(v,allowed,max)=>{const a=Array.isArray(v)?[...new Set(v.filter(x=>allowed.includes(x)))]:[];if(!a.length||a.length>max)throw fail(400,`Choose 1 to ${max} items.`);return a};
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v)))throw fail(400,'Choose valid dates.');return v};
const publicPeople='id,name,first_name,last_name,programme,skills,interests,bio,habits,portfolio,photo_version,created_at';
const publicCalls='id,owner_id,title,summary,detail,kind,roles,deadline,delivery,deliverables,created_at';
async function db(path,opts={}){const key=env.SUPABASE_SECRET_KEY;const headers={apikey:key,'Content-Type':'application/json',...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{}) ,...opts.headers};const base=env.SUPABASE_URL.replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');let r;try{r=await fetch(`${base}/rest/v1/${path}`,{...opts,headers,signal:AbortSignal.timeout(10000)})}catch{throw fail(503,'Database connection unavailable.');}if(!r.ok){const body=await r.text();let errorCode='unknown';try{errorCode=JSON.parse(body).code||'unknown'}catch{}console.error('BYC database failure',{status:r.status,code:errorCode});if(body.includes('BYC_DM_RATE'))throw fail(429,'Message limit reached. Try again later.');if(body.includes('BYC_INVALID_RECIPIENT'))throw fail(404,'Recipient unavailable.');if(body.includes('DEMO_CAPACITY'))throw fail(409,'Classroom is full.');if(r.status===409)throw fail(409,'This record already exists. Refresh and try again.');throw fail(503,'Database unavailable. Please tell the presenter.');}if(r.status===204||r.status===205)return null;const text=await r.text();return text.trim()?JSON.parse(text):null}
const write=(path,method,value,representation=false)=>db(path,{method,...(value===undefined?{}:{body:JSON.stringify(value)}),headers:{Prefer:representation?'return=representation':'return=minimal'}});
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const send=(status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(payload));};try{
 if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY||!env.DEMO_CODE||!env.HOST_TOKEN||env.DEMO_CODE.length<8||env.HOST_TOKEN.length<16||!Number.isFinite(Date.parse(env.DEMO_EXPIRES_AT)))throw fail(503,'Live classroom setup is not complete.');
 const url=new URL(req.url,'http://localhost'),action=url.searchParams.get('action')||'list';
 if(req.method==='GET'&&action==='status')return send(200,{open:Date.now()<Date.parse(env.DEMO_EXPIRES_AT)});
 if(!eq(req.headers['x-demo-code'],env.DEMO_CODE))throw fail(401,'Enter the classroom access code.');
 const host=eq(req.headers['x-host-token'],env.HOST_TOKEN);if(Date.now()>=Date.parse(env.DEMO_EXPIRES_AT)&&!(host&&action==='reset')&&action!=='delete')throw fail(410,'The classroom session has ended.');
 const session=hash(env.DEMO_CODE).slice(0,32), scope=`session=eq.${session}`;
 if(req.method==='GET'&&action==='host'){if(!host)throw fail(403,'Incorrect presenter token.');return send(200,{ok:true})}
 const me=async t=>validToken(t)?(await db(`byc_profiles?${scope}&token_hash=eq.${hash(t)}&select=id`))[0]?.id:null;
 const getCall=async id=>{const p=(await db(`byc_calls?${scope}&id=eq.${uuid(id)}&select=*`))[0];if(!p)throw fail(404,'Project not found.');return p};
 const apps=async id=>db(`byc_applications?call_id=eq.${id}&select=*&order=created_at.asc&limit=60`);
 const dmFields='id,sender_id,recipient_id,message,created_at,read_at';
 const peer=async (id,target)=>{target=uuid(target);if(id===target)throw fail(400,'Choose another student.');if(!(await db(`byc_profiles?${scope}&id=eq.${target}&select=id`))[0])throw fail(404,'Student unavailable.');return target};
 if(req.method==='GET'&&['inbox','thread'].includes(action)){
  const id=await me(req.headers['x-profile-token']);if(!id)throw fail(401,'Create your profile first.');
  if(action==='thread'){const target=await peer(id,url.searchParams.get('id'));const messages=await db(`byc_direct_messages?${scope}&or=(and(sender_id.eq.${id},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${id}))&select=${dmFields}&order=created_at.desc,id.desc&limit=100`);return send(200,{messages:messages.reverse()})}
  const [messages,unread,saved]=await Promise.all([db(`byc_direct_messages?${scope}&or=(sender_id.eq.${id},recipient_id.eq.${id})&select=${dmFields}&order=created_at.desc,id.desc&limit=500`),db(`byc_direct_messages?${scope}&recipient_id=eq.${id}&read_at=is.null&select=sender_id&limit=1000`),db(`byc_saved_people?${scope}&owner_id=eq.${id}&select=person_id&limit=60`)]);
  const counts={};for(const m of unread)counts[m.sender_id]=(counts[m.sender_id]||0)+1;
  const threads=[];const seen=new Set();for(const m of messages){const other=m.sender_id===id?m.recipient_id:m.sender_id;if(seen.has(other))continue;seen.add(other);threads.push({person_id:other,last:m.message,created_at:m.created_at,unread:counts[other]||0})}
  return send(200,{threads,unread:unread.length,saved:saved.map(x=>x.person_id)});
 }
 if(req.method==='GET'&&action==='photos'){
  const ids=[...new Set((url.searchParams.get('id')||'').split(',').filter(Boolean).map(uuid))];if(!ids.length||ids.length>60)throw fail(400,'Invalid photo request.');
  const rows=await db(`byc_profiles?${scope}&id=in.(${ids.join(',')})&select=id,photo_version,photo_data&limit=60`);return send(200,{photos:rows});
 }
 if(req.method==='GET'&&action==='list'){
  const [people,calls]=await Promise.all([db(`byc_profiles?${scope}&select=${publicPeople}&order=created_at.desc&limit=60`),db(`byc_calls?${scope}&select=${publicCalls}&order=created_at.desc&limit=60`)]);
  const links=calls.length?await db(`byc_applications?call_id=in.(${calls.map(c=>c.id).join(',')})&select=call_id,person_id,status,role&limit=3600`):[];
  return send(200,{people,calls:calls.map(c=>({...c,count:links.filter(a=>a.call_id===c.id).length,team:links.filter(a=>a.call_id===c.id&&a.status==='accepted').map(({person_id,role})=>({person_id,role}))}))});
 }
 if(req.method==='GET'&&action==='project'){
  const p=await getCall(url.searchParams.get('id'));const id=await me(req.headers['x-profile-token']);const a=await apps(p.id),mine=a.find(x=>x.person_id===id),owner=id===p.owner_id,member=owner||mine?.status==='accepted';const {private_brief,...publicData}=p;
  const messages=member?await db(`byc_messages?call_id=eq.${p.id}&select=id,person_id,message,created_at&order=created_at.desc&limit=100`):[];
  return send(200,{...publicData,count:a.length,team:a.filter(x=>x.status==='accepted').map(({person_id,role})=>({person_id,role})),owner,member,mine:mine?{role:mine.role,status:mine.status}:null,...(owner?{applicants:a}:{}),...(member?{private_brief,messages:messages.reverse()}: {})});
 }
 if(req.method!=='POST')throw fail(405,'Unsupported request.');if(Number(req.headers['content-length']||0)>20000)throw fail(413,'Request too large.');let b=req.body;if(typeof b==='string')b=JSON.parse(b);if(!b||typeof b!=='object'||JSON.stringify(b).length>20000)throw fail(400,'Invalid request.');
 if(action==='teams'){if(!host)throw fail(403,'Presenter authorization required.');const roster=await db(`byc_profiles?${scope}&select=${publicPeople}&limit=60`);const ids=Array.isArray(b.ids)?[...new Set(b.ids.map(uuid))]:[];const chosen=roster.filter(p=>ids.includes(p.id));if(chosen.length!==ids.length||chosen.length<2)throw fail(400,'Refresh the roster and choose at least two students.');const count=Number(b.count);if(!Number.isInteger(count)||count<1||count>chosen.length)throw fail(400,'Invalid group count.');const weights=Object.fromEntries(['skills','diversity','availability'].map(k=>[k,Math.max(0,Math.min(5,Number.isFinite(Number(b.weights?.[k]))?Number(b.weights[k]):2))]));return send(200,{teams:recommend(chosen,count,Array.isArray(b.required)?b.required:[],weights,Number(b.seed)||1)});}
 if(action==='reset'){if(!host)throw fail(403,'Presenter authorization required.');await write(`byc_profiles?${scope}`,'DELETE');return send(200,{ok:true})}
 if(action==='join'){
  if(b.consent!==true)throw fail(400,'Confirm voluntary classroom sharing.');const first=required(b.first,24,'your first name'),last=required(b.last,24,'your last name');if((first+' '+last).length>48)throw fail(400,'Use a combined name of up to 48 characters.');if(!Object.values(programmes).flat().includes(b.programme))throw fail(400,'Choose your programme.');const h={};for(const [k,options] of Object.entries(habits)){if(!options.includes(b.habits?.[k]))throw fail(400,'Complete your working preferences.');h[k]=b.habits[k]};const portfolio=clean(b.portfolio,250);if(portfolio&&!/^https:\/\/[^\s]+$/i.test(portfolio))throw fail(400,'Use an HTTPS portfolio link.');const t=validToken(b.token)?b.token:randomBytes(32).toString('hex');const result=await db('rpc/byc_join_v2',{method:'POST',body:JSON.stringify({p_session:session,p_token_hash:hash(t),p_first:first,p_last:last,p_programme:b.programme,p_skills:tags(b.skills,Object.values(skillGroups).flat(),12),p_interests:tags(b.interests,Object.values(interestGroups).flat(),10),p_bio:required(b.bio,500,'a short bio'),p_habits:h,p_portfolio:portfolio})});return send(200,{id:result,token:t});
 }
 const id=await me(b.token);if(!id)throw fail(401,'Create your profile first.');
 if(action==='photo'){
  let photo=b.photo;
  if(photo!==null){if(typeof photo!=='string'||photo.length>18000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))throw fail(400,'Choose a valid profile photo.');const raw=Buffer.from(photo.slice(23),'base64');if(raw.length<4||raw.length>13400||raw[0]!==255||raw[1]!==216||raw[2]!==255||raw.at(-2)!==255||raw.at(-1)!==217)throw fail(400,'Choose a valid JPEG photo.');}
  await write(`byc_profiles?${scope}&id=eq.${id}`,'PATCH',{photo_data:photo,photo_version:photo===null?null:randomUUID()});return send(200,{ok:true});
 }
 if(action==='delete'){await write(`byc_profiles?${scope}&id=eq.${id}`,'DELETE');return send(200,{ok:true})}
 if(['dm','dmread','bookmark'].includes(action)){
  const target=await peer(id,b.person);
  if(action==='dm'){await db('rpc/byc_send_dm',{method:'POST',body:JSON.stringify({p_session:session,p_sender:id,p_recipient:target,p_message:required(b.message,1000,'a message')})})}
  else if(action==='dmread'){const ids=Array.isArray(b.ids)?[...new Set(b.ids.map(uuid))].slice(0,100):[];if(ids.length)await write(`byc_direct_messages?${scope}&recipient_id=eq.${id}&sender_id=eq.${target}&read_at=is.null&id=in.(${ids.join(',')})`,'PATCH',{read_at:new Date().toISOString()})}
  else if(b.saved===true){await db('byc_saved_people',{method:'POST',body:JSON.stringify({session,owner_id:id,person_id:target}),headers:{Prefer:'resolution=ignore-duplicates,return=minimal'}})}else{await write(`byc_saved_people?${scope}&owner_id=eq.${id}&person_id=eq.${target}`,'DELETE')}
  return send(200,{ok:true});
 }
 if(action==='create'){
  const roles=Array.isArray(b.roles)?[...new Set(b.roles.map(x=>clean(x,60)).filter(Boolean))].slice(0,8):[];if(!roles.length)throw fail(400,'Enter at least one role.');const deadline=date(b.deadline),delivery=date(b.delivery);if(delivery<deadline)throw fail(400,'Delivery must follow the application deadline.');if(deadline<new Date().toISOString().slice(0,10))throw fail(400,'Choose a future application deadline.');const current=await db(`byc_calls?${scope}&select=id&limit=60`);if(current.length>=60)throw fail(409,'Classroom project limit reached.');const created=await write('byc_calls','POST',{session,owner_id:id,title:required(b.title,90,'a title'),summary:required(b.summary,200,'a summary'),detail:required(b.detail,2500,'the project description'),kind:['Coursework','Independent project','Open Call'].includes(b.kind)?b.kind:'Open Call',roles,deadline,delivery,deliverables:required(b.deliverables,1400,'deliverables and milestones'),private_brief:clean(b.private_brief,2000)},true);return send(200,{id:created[0].id});
 }
 const p=await getCall(b.project),a=await apps(p.id),mine=a.find(x=>x.person_id===id),owner=p.owner_id===id,member=owner||mine?.status==='accepted';
 if(action==='apply'){if(owner||mine)throw fail(409,'You already have a role or application.');if(p.deadline<new Date().toISOString().slice(0,10))throw fail(400,'Applications closed.');if(!p.roles.includes(b.role))throw fail(400,'Choose an available role.');if(b.consent!==true)throw fail(400,'Confirm that accepted team membership will be visible.');await write('byc_applications','POST',{call_id:p.id,person_id:id,role:b.role,note:required(b.note,600,'your application note')});}
 else if(action==='withdraw'){if(!mine)throw fail(404,'Application not found.');await write(`byc_applications?call_id=eq.${p.id}&person_id=eq.${id}`,'DELETE');}
 else if(action==='decide'){if(!owner)throw fail(403,'Only the project creator can review applications.');const target=uuid(b.person);if(!['accepted','declined'].includes(b.status))throw fail(400,'Invalid decision.');await write(`byc_applications?call_id=eq.${p.id}&person_id=eq.${target}&status=eq.pending`,'PATCH',{status:b.status});}
 else if(action==='message'){if(!member)throw fail(403,'Only the project team can access the workspace.');await write('byc_messages','POST',{call_id:p.id,person_id:id,message:required(b.message,1000,'a message')});}
 else if(action==='removeproject'){if(!owner)throw fail(403,'Only the creator can delete this project.');await write(`byc_calls?${scope}&id=eq.${p.id}`,'DELETE');}
 else throw fail(404,'Unknown action.');return send(200,{ok:true});
 }catch(e){return send(e.status||500,{error:e.status?e.message:'Something went wrong. Please retry.'})}}
