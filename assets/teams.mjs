import {skillGroups} from './catalog.mjs';
const vocabulary=Object.values(skillGroups).flat();
// Match complete words and common inflections, then infer supporting skills from the task type.
// All recommendations must exist in the same catalogue used by student profiles.
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const directAliases={
 'Graphic Design':['visual design','graphics','poster','graphic designer','graficki dizajn','graficki dizajner'],
 'Brand Identity':['brand identity','visual identity','logo','crest','badge design','vizualni identitet','logotip'],
 'Brand Strategy':['brand strategy','brand positioning','positioning','strategija brenda'],
 'Editorial Design':['editorial','publication','page layout','book design','prijelom','urednicki dizajn'],
 'Photography':['photo','photos','photographer','photograph','fotografija','fotografiranje'],
 'Journalism':['journalist','article','reporting','novinarstvo'], 'Interviewing':['interview','interviews','intervju'],
 'Creative Writing':['writer','fiction','creative writer'], 'Copywriting':['copywriter','slogan','tagline','tekst oglasa'],
 'Web Development':['website','web site','web app','web stranica'], 'Frontend Development':['frontend','front end'], 'Backend Development':['backend','back end'],
 'UX Design':['ux','user experience'], 'UI Design':['ui','interface'], 'Mobile Development':['mobile app','android app','ios app'],
 'Social Media':['social media','instagram','tiktok','drustvene mreze'], 'Digital Marketing':['online marketing','digital campaign','digitalni marketing'],
 'Film Production':['filmmaking','movie','short film','documentary','dokumentarac'], 'Video Editing':['video editor','montaza'],
 'Qualitative Research':['focus group','focus groups','qualitative','kvalitativno istrazivanje'], 'Quantitative Research':['survey','questionnaire','anketa'],
 'Market Research':['market analysis','consumer research','competitor research','istrazivanje trzista'],
 'Presentations':['pitch','slide deck','presentation','prezentacija'], 'Data Analysis':['analytics','statistical analysis','analiza podataka'],
 'Music Production':['music production','recording music'], 'Event Management':['event planning','organising events','organizacija dogadaja'],
 'Public Relations':['pr campaign','media relations','odnosi s javnoscu'], '3D Modelling':['3d modeling','3d model','3d models'],
 'Interior Design':['interiors','interior architecture','dizajn interijera'], 'AI Tools':['artificial intelligence','generative ai','umjetna inteligencija']
};
// Patterns recognise project domains, including inflections and common Croatian terms.
const domains=[
 [/\b(?:rebrand\w*|branding|brand identity|brand refresh|brand redesign|visual identity|logo(?:s)?|crest(?:s)?|vizualni identitet|brendiranje|rebrendiranje|logotip\w*)\b/, ['Brand Identity','Brand Strategy','Graphic Design','Typography','Design Research','Art Direction','Market Research','Copywriting','Adobe Illustrator']],
 [/\b(?:football|soccer|sports?|nogomet\w*|sportsk\w*)\b/, ['Market Research','Social Media','Content Strategy']],
 [/\b(?:magazine\w*|publication\w*|editorial|newspaper\w*|book design|casopis\w*|magazin\w*)\b/, ['Editorial Design','Typography','Graphic Design','Journalism','Photography','Interviewing','Editing','Adobe InDesign']],
 [/\b(?:website\w*|web site\w*|web app\w*|ecommerce|e commerce|landing page\w*|web stranic\w*)\b/, ['Web Development','Frontend Development','UI Design','UX Design','Content Strategy','Figma']],
 [/\b(?:mobile app\w*|digital product\w*|application prototype|aplikacij\w*|software product)\b/, ['UX Design','UI Design','Frontend Development','Backend Development','User Interviews','Figma','Mobile Development']],
 [/\b(?:campaign\w*|advertis\w*|marketing campaign|kampanj\w*|oglasavanj\w*)\b/, ['Digital Marketing','Copywriting','Graphic Design','Brand Strategy','Market Research','Social Media','Content Strategy']],
 [/\b(?:film\w*|documentar\w*|short video\w*|music video\w*|video production|dokumentar\w*)\b/, ['Film Production','Videography','Cinematography','Video Editing','Sound Design','Directing','Storytelling']],
 [/\b(?:event\w*|festival\w*|exhibition\w*|conference\w*|concert\w*|izlozb\w*|dogadaj\w*)\b/, ['Event Management','Project Management','Public Relations','Graphic Design','Social Media','Content Strategy']],
 [/\b(?:research\w*|survey\w*|thesis|study design|istrazivanj\w*|anket\w*)\b/, ['Qualitative Research','Quantitative Research','Data Analysis','Critical Thinking','Presentations']],
 [/\b(?:business plan|startup\w*|start up|business model|business strateg\w*|poslovni plan)\b/, ['Business Strategy','Entrepreneurship','Market Research','Finance','Project Management','Presentations']],
 [/\b(?:machine learning|artificial intelligence|data science|data analys\w*|predictive model\w*|umjetna inteligencija)\b/, ['Data Science','Data Analysis','Machine Learning','Python','Data Visualisation']],
 [/\b(?:game design|video game\w*|game development|videoigr\w*)\b/, ['Game Development','Unity','3D Modelling','Animation','UI Design','Sound Design']],
 [/\b(?:interior design|interior space|room design|dizajn interijera)\b/, ['Interior Design','3D Modelling','Design Research','Art Direction','Presentations']],
 [/\b(?:podcast\w*|audio show\w*|radio show\w*)\b/, ['Audio Engineering','Interviewing','Storytelling','Sound Design','Content Strategy']],
 [/\b(?:music production|record an album|recording studio|songwriting)\b/, ['Music Production','Audio Engineering','Songwriting','Sound Design']],
 [/\b(?:cybersecurity|cyber security|network security|security audit)\b/, ['Cybersecurity','Backend Development','Python','Critical Thinking']],
 [/\b(?:social media|instagram|tiktok|content creation|drustvene mreze)\b/, ['Social Media','Content Strategy','Copywriting','Graphic Design','Photography','Digital Marketing']],
 [/\b(?:motion graphics|animation|animated video|animacij\w*)\b/, ['Motion Design','Animation','Illustration','Video Editing','Art Direction']],
 [/\b(?:pitch|presentation|slide deck|prezentacij\w*)\b/, ['Presentations','Public Speaking','Storytelling','Graphic Design']]
];
export function suggestSkills(task){
 const t=norm(task);if(!t)return [];
 const phrase=' '+t+' ';const scores=new Map();
 const add=(skill,score)=>{if(vocabulary.includes(skill))scores.set(skill,(scores.get(skill)||0)+score)};
 for(const skill of vocabulary){if([skill,...(directAliases[skill]||[])].some(alias=>phrase.includes(' '+norm(alias)+' ')))add(skill,20)}
 for(const [pattern,skills] of domains){if(pattern.test(t))skills.forEach((skill,i)=>add(skill,Math.max(3,12-i)))}
 // Prefer explicit skills, then domain relevance; never return arbitrary guesses.
 return [...scores.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([skill])=>skill);
}
function compatible(a,b,key){const x=a.habits?.[key],y=b.habits?.[key];if(!x||!y)return 0;if(x===y||x==='Flexible'||y==='Flexible'||(key==='mode'&&(x==='Hybrid'||y==='Hybrid')))return 1;return 0}
export function teamInfo(team,required){const skills=[...new Set(team.flatMap(p=>p.skills||[]))];const covered=required.filter(s=>skills.includes(s));let pairs=0,compatiblePairs=0;for(let i=0;i<team.length;i++)for(let j=i+1;j<team.length;j++){pairs+=2;compatiblePairs+=compatible(team[i],team[j],'time')+compatible(team[i],team[j],'mode')}return {covered,missing:required.filter(s=>!skills.includes(s)),skills,compatibility:pairs?compatiblePairs/pairs:null,unknownPreferences:team.some(p=>!p.habits?.time||!p.habits?.mode)}}
export function recommend(people,count,required=[],weights={skills:3,diversity:1,availability:2},seed=1){if(!Array.isArray(people)||people.length<2||people.length>60||!Number.isInteger(count)||count<1||count>people.length)throw Error('Choose a valid number of groups for 2–60 students.');if(new Set(people.map(p=>p.id)).size!==people.length)throw Error('Duplicate students.');required=[...new Set(required.filter(s=>vocabulary.includes(s)))];let state=seed>>>0||1;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};const sizes=Array.from({length:count},(_,i)=>Math.floor(people.length/count)+(i<people.length%count?1:0));const val=t=>{const d=teamInfo(t,required);return (required.length?weights.skills*d.covered.length/required.length:0)+weights.diversity*Math.min(d.skills.length/Math.max(1,t.length*4),1)+weights.availability*(d.compatibility??0)};let best,bestScore=-Infinity;for(let trial=0;trial<8;trial++){const pool=shuffle(people);let offset=0;const groups=sizes.map(n=>{const a=pool.slice(offset,offset+n);offset+=n;return a});let scores=groups.map(val);const objective=s=>s.reduce((a,b)=>a+b,0)/s.length+0.7*Math.min(...s);let score=objective(scores);for(let step=0;step<Math.min(1800,people.length*55)&&count>1;step++){const a=Math.floor(random()*count),b=Math.floor(random()*count);if(a===b)continue;const i=Math.floor(random()*groups[a].length),j=Math.floor(random()*groups[b].length);[groups[a][i],groups[b][j]]=[groups[b][j],groups[a][i]];const next=[...scores];next[a]=val(groups[a]);next[b]=val(groups[b]);const ns=objective(next);if(ns>=score){scores=next;score=ns}else [groups[a][i],groups[b][j]]=[groups[b][j],groups[a][i]]}if(score>bestScore){bestScore=score;best=groups}}return best.map((members,i)=>({number:i+1,members:members.map(p=>({id:p.id,name:p.name,skills:p.skills||[],habits:p.habits||{}})),...teamInfo(members,required)}))}
