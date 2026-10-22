const Module = require("module");
const B = require("path").join(__dirname, "..") + "/";
process.env.SUPABASE_URL="https://proj.supabase.co"; process.env.GROQ_API_KEY="k";
const db={campaigns:[{id:"c1",user_id:"u1",platform:"Instagram",category:"c",brand_name:"B",headline:"h",ad_copy:"a",cta:"c",hashtags:[],image_url:"https://proj.supabase.co/a.jpg",variants:["https://proj.supabase.co/a.jpg","https://proj.supabase.co/b.jpg"],views:0,likes:0,shares:0,comments:0,clicks:0,created_at:new Date().toISOString()}],ad_events:[]};
function q(table){let f=[],cols=null,single=false;
 const o={select(c){if(c&&c!=="*")cols=c.split(",").map(x=>x.trim());return o},eq(k,v){f.push(r=>r[k]==v);return o},single(){single=true;return o},
  then(res){let r=db[table].filter(x=>f.every(g=>g(x)));const proj=x=>{if(!cols||!x)return x;const y={};cols.forEach(c=>y[c]=x[c]);return y};
   return res(single?{data:proj(r[0])||null,error:r[0]?null:{message:"nf"}}:{data:r.map(proj),error:null})}};return o}
const fake={from:q,auth:{getUser:async()=>({data:{user:{id:"u1"}},error:null})},
 rpc:async(name,a)=>{const c=db.campaigns.find(x=>x.id==a.p_campaign_id);db.ad_events.push({event_type:a.p_type,variant:a.p_variant});
  const k={view:"views",like:"likes",share:"shares",comment:"comments",click:"clicks"}[a.p_type];c[k]++;return {data:{ok:true,counted:true},error:null}}};
const orig=Module._load; Module._load=function(r,p,i){ if(/supabaseClient$/.test(r)) return fake; return orig.apply(this,arguments)};
const express=require(B+"node_modules/express"); const realListen=express.application.listen; let srv;
express.application.listen=function(p,cb){srv=realListen.call(this,0,cb);return srv};
require(B+"server.js");
setTimeout(async()=>{
  const port=srv.address().port;
  const { spawn } = require("child_process");
  const child = spawn("node", [B+"scripts/simulate_demo_traffic.js", "c1", "200", `http://localhost:${port}`]);
  child.stdout.on("data", d => process.stdout.write(d));
  child.stderr.on("data", d => process.stderr.write(d));
  await new Promise(resolve => child.on("close", resolve));
  const byVariantView = {}; db.ad_events.filter(e=>e.event_type==="view").forEach(e=>byVariantView[e.variant]=(byVariantView[e.variant]||0)+1);
  const v0 = byVariantView[0]||0, v1 = byVariantView[1]||0, total = v0+v1;
  const ok = n => console.log((n?"PASS ":"FAIL ")+arguments[1]);
  let pass=0, fail=0;
  const check=(name,cond)=>{console.log((cond?"PASS ":"FAIL ")+name); cond?pass++:fail++;};
  check("no requests were rate-limited (200 visitors all completed)", total === 200);
  check(`split is roughly even across variants (${v0}/${v1})`, v0 > 70 && v1 > 70);
  check("campaign counters match recorded events", db.campaigns[0].views === total);
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close(); process.exit(fail ? 1 : 0);
}, 500);
