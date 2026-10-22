const Module = require("module");
const B=require("path").join(__dirname,"..")+"/";
process.env.SUPABASE_URL="https://proj.supabase.co"; process.env.PORT="0"; process.env.GROQ_API_KEY="k";
// This suite verifies the STRICT, real-deployment rate limits (NODE_ENV=production).
// The separate simulate_traffic.test.js verifies the relaxed local-dev limits instead.
process.env.NODE_ENV="production";
const db={campaigns:[{id:"c1",user_id:"u1",platform:"Instagram",category:"Streetwear",brand_name:"B",headline:"h",ad_copy:"a",cta:"c",hashtags:[],image_url:"https://proj.supabase.co/x0.jpg",variants:[],views:0,likes:0,shares:0,comments:0,clicks:0,created_at:new Date().toISOString()}],ad_events:[]};
function q(table){let f=[],upd=null,single=false,cols=null;
 const o={select(c){if(c&&c!=='*')cols=c.split(',').map(x=>x.trim());return o},eq(k,v){f.push(r=>r[k]==v);return o},gte(k,v){f.push(r=>r[k]>=v);return o},not(k,op,v){f.push(r=>r[k]!==null&&r[k]!==undefined);return o},order(){return o},limit(){return o},update(u){upd=u;return o},single(){single=true;return o},
  then(res){let r=db[table].filter(x=>f.every(g=>g(x)));if(upd){r.forEach(x=>Object.assign(x,upd));return res({data:single?r[0]:null,error:r.length?null:{message:"nf"}})}
   const proj=x=>{if(!cols||!x)return x;const y={};cols.forEach(c=>y[c]=x[c]);return y};return res(single?{data:proj(r[0])||null,error:r[0]?null:{message:"nf"}}:{data:r.map(proj),error:null})}};return o}
const fake={from:q,auth:{getUser:async()=>({data:{user:{id:"u1"}},error:null})},
 rpc:async(name,a)=>{const c=db.campaigns.find(x=>x.id==a.p_campaign_id);db.ad_events.push({campaign_id:c.id,event_type:a.p_type,variant:a.p_variant,visitor:a.p_visitor});
  const k={view:"views",like:"likes",share:"shares",comment:"comments",click:"clicks"}[a.p_type];c[k]++;return {data:{ok:true,counted:true},error:null}}};
// mock node-fetch (Groq) with scripted responses
let groqCalls=[]; const groqScript=[];
const nodeFetch=async(url,opts)=>{const body=JSON.parse(opts.body);groqCalls.push(body);const r=groqScript.shift();
  return {ok:r.ok!==false,status:r.status||200,text:async()=>r.text||"",json:async()=>({choices:[{message:{content:r.content}}],usage:{total_tokens:123}})}};
const orig=Module._load; Module._load=function(r,p,i){ if(/supabaseClient$/.test(r)) return fake; if(r==="node-fetch") return nodeFetch; return orig.apply(this,arguments)};
let pass=0,fail=0; const ok=(n,c)=>{console.log((c?"PASS ":"FAIL ")+n);c?pass++:fail++};

(async()=>{
 // ---- Groq service ----
 const {generateAdCopy}=require(B+"services/groqService.js");
 groqScript.push({ok:false,status:400,text:"unsupported reasoning_effort"},{content:'Sure! Here you go:\n```json\n{"headline":"Own The Street","adCopy":"Built for movers. Wear the city.","cta":"Shop the drop","hashtags":["Streetwear","new in","#OOTD"]}\n```'});
 let r=await generateAdCopy({brandName:"B",category:"Streetwear",audience:"Gen Z",platform:"Instagram"});
 ok("groq: retries after 400 and parses fenced JSON with prose", r.headline==="Own The Street" && r.attempts===2);
 ok("groq: hashtags normalised", JSON.stringify(r.hashtags)==='["#Streetwear","#newin","#OOTD"]');
 ok("groq: 1st attempt used json mode + low reasoning + 2000 tokens", groqCalls[0].response_format?.type==="json_object"&&groqCalls[0].reasoning_effort==="low"&&groqCalls[0].max_tokens===2000);
 groqScript.push({content:""},{content:'{"headline":"","adCopy":""}'},{content:'{"headline":"Ok","adCopy":"Fine copy here.","cta":"","hashtags":[]}'});
 r=await generateAdCopy({brandName:"B",category:"c",audience:"a",platform:"p"});
 ok("groq: empty reasoning-only reply and empty fields both retried; cta defaults", r.headline==="Ok"&&r.cta==="Shop Now"&&r.attempts===3);
 groqScript.push({ok:false,status:401,text:"bad key"});
 let threw=false; try{await generateAdCopy({brandName:"B",category:"c",audience:"a",platform:"p"})}catch(e){threw=/401/.test(e.message)}
 ok("groq: bad API key fails fast (no pointless retries)", threw && groqScript.length===0);

 // ---- server ----
 const cp=require("child_process"); 
 const appMod=Module._load; 
 // load server without listening on fixed port
 const express=require(B+"node_modules/express");
 const realListen=express.application.listen; let srv;
 express.application.listen=function(p,cb){srv=realListen.call(this,0,cb);return srv};
 require(B+"server.js"); await new Promise(r=>setTimeout(r,300));
 const base=`http://localhost:${srv.address().port}`; const H={"Content-Type":"application/json",Authorization:"Bearer t"};
 const J=async(m,u,b,h={})=>{const x=await fetch(base+u,{method:m,headers:{...H,...h},body:b?JSON.stringify(b):undefined});return [x.status,await x.json().catch(()=>null),x.headers]};

 let [s,d,h]=await J("GET","/api/health");
 ok("helmet security headers present", !!h.get("x-content-type-options") && !h.get("x-powered-by"));
 [s]=await J("GET","/api/health",null,{Origin:"https://evil.example"}); ok("CORS blocks unknown origin", s===403);
 [s]=await J("GET","/api/health",null,{Origin:"http://localhost:5173"}); ok("CORS allows local dev origin", s===200);

 [s,d]=await J("POST","/api/campaign/c1/start-ab",{variants:["https://proj.supabase.co/a.jpg"]}); ok("start-ab rejects <2 variants", s===400);
 [s,d]=await J("POST","/api/campaign/c1/start-ab",{variants:["https://evil.com/a.jpg","https://evil.com/b.jpg"]}); ok("start-ab rejects foreign image URLs", s===400);
 const vs=["https://proj.supabase.co/a.jpg","https://proj.supabase.co/b.jpg","https://proj.supabase.co/c.jpg"];
 [s,d]=await J("POST","/api/campaign/c1/start-ab",{variants:vs}); ok("start-ab accepts 3 storage images", s===200&&db.campaigns[0].variants.length===3);

 // public view: same visitor => same variant; split roughly even; no private fields leaked
 const seen={}; let stable=true, leaked=false;
 for(let i=0;i<300;i++){const v="visitor-"+i;const ip={"X-Forwarded-For":`10.1.${i>>8}.${i&255}`};const [,a]=await J("GET",`/api/campaign/public/c1?visitor=${v}`,null,ip);const [,b]=await J("GET",`/api/campaign/public/c1?visitor=${v}`,null,ip);
   if(a.variant!==b.variant||a.campaign.image_url!==vs[a.variant]) stable=false; seen[a.variant]=(seen[a.variant]||0)+1; if("user_id" in a.campaign||"variants" in a.campaign) leaked=true;
   await J("POST","/api/campaign/public/c1/event",{type:"view",visitorId:v},ip);
   if(i%5===0) await J("POST","/api/campaign/public/c1/event",{type:"like",visitorId:v},ip);}
 ok("visitor always gets the same variant and its own image", stable);
 ok(`split is even: ${JSON.stringify(seen)}`, Object.values(seen).every(n=>n>75&&n<125));
 ok("public payload hides user_id and raw variants list", !leaked);
 ok("events stored with server-computed variant", db.ad_events.every(e=>e.variant===[0,1,2].find(k=>e.variant===k)) && db.ad_events.filter(e=>e.event_type==="view").length===300);
 [s]=await J("POST","/api/campaign/public/c1/event",{type:"hack",visitorId:"visitor-zzzz"}); ok("event endpoint rejects bad type", s===400);
 [s]=await J("POST","/api/campaign/public/c1/event",{type:"view",visitorId:"x"}); ok("event endpoint rejects short visitor id", s===400);

 [s,d]=await J("GET","/api/performance/ab/c1");
 ok("A/B endpoint returns 3 variants with probabilities", s===200&&d.active&&d.variants.length===3&&Math.abs(d.variants.reduce((a,v)=>a+v.prob_best,0)-100)<0.5);
 ok(`A/B status with equal true rates is not a false winner (${d.status})`, d.status!=="winner");
 // make variant 1 truly better and re-check
 db.ad_events.forEach(e=>{}); for(let i=0;i<250;i++) db.ad_events.push({campaign_id:"c1",event_type:"like",variant:1,visitor:"x"+i});
 [s,d]=await J("GET","/api/performance/ab/c1"); ok(`clear winner detected after variant 1 gets +250 likes (${d.status}, leader ${d.leader})`, d.status==="winner"&&d.leader===1);
 [s,d]=await J("POST","/api/campaign/c1/select-image",{imageUrl:vs[1]}); ok("choosing a variant ends the test", db.campaigns[0].variants.length===0&&db.campaigns[0].image_url===vs[1]);
 [s,d]=await J("GET","/api/performance/ab/c1"); ok("A/B endpoint reports inactive after ending", d.active===false);
 let lim; for(let i=0;i<130;i++){[lim]=await J("GET","/api/campaign/public/c1?visitor=v",null,{"X-Forwarded-For":"9.9.9.9"});} ok("public endpoint limiter (120/min per IP, production mode) returns 429", lim===429);
 // login rate limit
 let last; for(let i=0;i<32;i++){[last]=await J("POST","/api/auth/login",{email:"a@b.c",password:"x"});} ok("auth rate limiter kicks in (429)", last===429);

 // preview mode: forced variant, no event recorded, no leak of full variants array
 db.campaigns[0].variants=vs.length?db.campaigns[0].variants:vs; // ensure still set (may have been cleared above)
 if(db.campaigns[0].variants.length===0) db.campaigns[0].variants=vs;
 const beforeViews=db.campaigns[0].views;
 [s,d]=await J("GET",`/api/campaign/public/c1?preview=1&v=1`);
 ok("preview returns the forced variant image", d.campaign.image_url===vs[1] && d.variant===1 && d.preview===true);
 ok("preview does not leak the raw variants array", !("variants" in d.campaign));
 [s,d]=await J("GET",`/api/campaign/public/c1?preview=1&v=99`); ok("preview rejects out-of-range variant", s===400);
 [s,d]=await J("GET",`/api/campaign/public/c1?preview=1&v=abc`); ok("preview rejects non-numeric variant", s===400);
 ok("preview request itself recorded no view (frontend must also not call /event)", db.campaigns[0].views===beforeViews);

 console.log(`\n${pass} passed, ${fail} failed`); srv.close(); process.exit(fail?1:0);
})();
