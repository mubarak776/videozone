// ভিডিও জোন – টেলিগ্রাম মিনি অ্যাপ সার্ভার (Node 18+, কোনো প্যাকেজ লাগে না)
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {BOT_TOKEN,WEBAPP_URL,PORT=3000}=process.env;
// অ্যাড ডাইরেক্ট লিংক (ঘুরে ঘুরে দেখানো হবে)। বদলাতে চাইলে এখানে বদলান
const AD_URLS=[
 'https://www.profitableratecpmnetwork.com/uckha6zwv?key=c944e22dca0a9b5c5ecc07d3e763f67a',
 'https://www.profitableratecpmnetwork.com/rz8eb07v?key=2499585d102efcb64e82c07604063520',
 'https://www.profitableratecpmnetwork.com/hxgm75469b?key=796c4a1a94e78af66de034e68b111594',
 'https://www.profitableratecpmnetwork.com/ng0g1m4h?key=b75c023b2ba640c7f0ce0e3c1050f87d'
];
const ADMINS=(process.env.ADMIN_IDS||'').split(',').map(Number).filter(Boolean);
if(!BOT_TOKEN||!WEBAPP_URL){console.error('BOT_TOKEN ও WEBAPP_URL সেট করুন');process.exit(1)}
// ===== অ্যাডমিন সেটিংস =====
const RATE=125,PRICE=5,ADS=5,AD_SECONDS=20;
const METHODS={
 bKash:{label:'বিকাশ (সেন্ড মানি)',color:'#e2136e',key:'নম্বর',val:'01873046713',min:50,note:'বিকাশ অ্যাপ থেকে "সেন্ড মানি" করুন'},
 Nagad:{label:'নগদ (সেন্ড মানি)',color:'#f6921e',key:'নম্বর',val:'01863796311',min:50,note:'নগদ অ্যাপ থেকে "সেন্ড মানি" করুন'},
 Binance:{label:'বাইনান্স (Pay ID)',color:'#f0b90b',key:'Binance ID',val:'1268820382',min:RATE,note:'Binance Pay দিয়ে পাঠান। সর্বনিম্ন ১ ডলার'},
 Bitcoin:{label:'বিটকয়েন (BTC)',color:'#f7931a',key:'BTC ঠিকানা',val:'12KjwHj8uNVoX4iiacd5zQkR8k3Jcxe3Gs',min:RATE,note:'শুধু BTC নেটওয়ার্কে পাঠান। সর্বনিম্ন ১ ডলার'}
};
// ===== ডাটাবেস (JSON ফাইল) =====
const DB_FILE=path.join(__dirname,'data.json');
const db=fs.existsSync(DB_FILE)?JSON.parse(fs.readFileSync(DB_FILE)):{users:{},videos:[],tx:[],seq:1000};
const save=()=>fs.writeFileSync(DB_FILE,JSON.stringify(db));
const tg=(m,b)=>fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${m}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
const notify=(id,text,extra)=>tg('sendMessage',Object.assign({chat_id:id,text},extra)).catch(()=>{});
// ===== টেলিগ্রাম initData যাচাই =====
function verify(s){
  const p=new URLSearchParams(s),hash=p.get('hash');if(!hash)return null;p.delete('hash');
  const str=[...p.entries()].map(([k,v])=>k+'='+v).sort().join('\n');
  const key=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
  if(crypto.createHmac('sha256',key).update(str).digest('hex')!==hash)return null;
  if(Date.now()/1000-Number(p.get('auth_date'))>86400)return null;
  try{return JSON.parse(p.get('user'))}catch(e){return null}
}
function addTx(o){db.seq++;const t=Object.assign({id:'TX'+db.seq,ts:Date.now()},o);db.tx.push(t);return t}
function decide(id,ok){
  const t=db.tx.find(x=>x.id===id&&x.type==='dep');
  if(!t||t.st!=='wn')throw 'রিকোয়েস্টটি পাওয়া যায়নি বা আগেই সম্পন্ন';
  t.st=ok?'ok':'no';if(ok)db.users[t.uid].bal+=t.a;save();
  notify(t.uid,ok?`✅ ৳${t.a} ডিপোজিট অনুমোদিত হয়েছে।`:`❌ আপনার ডিপোজিট (${t.id}) বাতিল হয়েছে।`);
}
const fail=m=>{throw m};
// ===== API =====
db.settings=db.settings||{};
const cfg=()=>({price:PRICE,ads:ADS,adSeconds:AD_SECONDS,methods:METHODS,adUrls:AD_URLS,...db.settings});
async function route(m,url,u,body,tu){
  const C=cfg();
  const vid=id=>db.videos.find(v=>v.id===id)||fail('ভিডিও পাওয়া যায়নি');
  const admin=ADMINS.includes(tu.id);
  switch(m+' '+url){
  case 'GET /api/me':return{name:u.name,bal:u.bal,admin,rate:RATE,price:C.price,ads:C.ads,adUrls:C.adUrls,adSeconds:C.adSeconds,methods:C.methods,
    videos:db.videos.map(({id,title,dur,color})=>({id,title,dur,color})),
    tx:db.tx.filter(t=>t.uid===u.id).slice(-100).reverse().map(({id,ts,type,n,a,st})=>({id,ts,type,n,a,st}))};
  case 'POST /api/ad/start':vid(body.vid);u.ad={vid:body.vid,n:0,t:Date.now()};return{ok:1};
  case 'POST /api/ad/next':{
    if(!u.ad)fail('আগে ভিডিও বেছে নিন');
    if(Date.now()-u.ad.t<C.adSeconds*1000-300)fail('অ্যাডটি পুরো '+C.adSeconds+' সেকেন্ড দেখতে হবে');
    u.ad.n++;u.ad.t=Date.now();
    if(u.ad.n<C.ads){save();return{done:false,n:u.ad.n}}
    const v=vid(u.ad.vid);u.ad=null;addTx({uid:u.id,type:'vid',n:'ভিডিও (অ্যাড): '+v.title,a:0,st:'ok'});save();return{done:true,url:v.url,title:v.title}}
  case 'POST /api/pay':{const v=vid(body.vid);if(u.bal<C.price)fail('ব্যালেন্স কম, ডিপোজিট করুন');
    u.bal-=C.price;addTx({uid:u.id,type:'vid',n:'ভিডিও: '+v.title,a:-C.price,st:'ok'});save();return{url:v.url,title:v.title}}
  case 'POST /api/deposit':{
    const me=C.methods[body.method]||fail('পদ্ধতি ঠিক নয়'),a=Math.floor(Number(body.amount)),trx=String(body.trx||'').trim().slice(0,100);
    if(!a||a<me.min)fail('সর্বনিম্ন ডিপোজিট ৳'+me.min);if(!trx)fail('ট্রানজেকশন আইডি দিন');
    if(db.tx.some(t=>t.ref&&t.ref.toLowerCase()===trx.toLowerCase()))fail('এই ট্রানজেকশন আইডি আগেই ব্যবহার হয়েছে');
    const t=addTx({uid:u.id,type:'dep',n:body.method+' ডিপোজিট',a,st:'wn',ref:trx,method:body.method});save();
    ADMINS.forEach(id=>notify(id,`💳 নতুন ডিপোজিট\n${u.name} (${u.id})\n${body.method} · ৳${a}\nTrxID: ${trx}\nID: ${t.id}`,
      {reply_markup:{inline_keyboard:[[{text:'✅ অনুমোদন',callback_data:'ok:'+t.id},{text:'❌ বাতিল',callback_data:'no:'+t.id}]]}}));
    return{ok:1}}
  }
  if(!admin)fail('অনুমতি নেই');
  switch(m+' '+url){
  case 'GET /api/admin/pending':return{pending:db.tx.filter(t=>t.type==='dep'&&t.st==='wn').map(t=>({...t,user:db.users[t.uid].name}))};
  case 'POST /api/admin/decide':decide(body.id,!!body.ok);return{ok:1};
  case 'POST /api/admin/video':{if(!body.title||!/^https?:\/\//.test(body.url||''))fail('টাইটেল ও সঠিক ভিডিও লিংক দিন');
    const colors=['#2a6df4,#7b4dff','#f46b2a,#f4b72a','#12a150,#2ad4a0','#d42a7b,#7b2ad4'];
    db.videos.unshift({id:'v'+Date.now(),title:String(body.title).slice(0,80),dur:String(body.dur||'').slice(0,10),url:body.url,color:colors[db.videos.length%4]});save();return{ok:1}}
  case 'GET /api/admin/stats':{const us=Object.values(db.users),T=db.tx;
    return{users:us.length,bal:us.reduce((a,x)=>a+x.bal,0),dep:T.filter(t=>t.type==='dep'&&t.st==='ok').reduce((a,t)=>a+t.a,0),
      pending:T.filter(t=>t.type==='dep'&&t.st==='wn').length,videos:db.videos.length,adViews:T.filter(t=>t.type==='vid'&&t.a===0).length,paidViews:T.filter(t=>t.type==='vid'&&t.a<0).length}}
  case 'GET /api/admin/users':return{users:Object.values(db.users).map(x=>({id:x.id,name:x.name,bal:x.bal,
    views:db.tx.filter(t=>t.uid===x.id&&t.type==='vid').length,dep:db.tx.filter(t=>t.uid===x.id&&t.type==='dep'&&t.st==='ok').reduce((a,t)=>a+t.a,0)}))};
  case 'GET /api/admin/deposits':return{list:db.tx.filter(t=>t.type==='dep').slice(-200).reverse().map(t=>({...t,user:db.users[t.uid].name}))};
  case 'POST /api/admin/balance':{const x=db.users[body.uid]||fail('ইউজার পাওয়া যায়নি'),a=Math.trunc(Number(body.amount));
    if(!a)fail('সঠিক পরিমাণ দিন');if(x.bal+a<0)fail('ব্যালেন্স ঋণাত্মক হয়ে যাবে');
    x.bal+=a;addTx({uid:x.id,type:'adj',n:'অ্যাডমিন '+(a>0?'যোগ':'কর্তন'),a,st:'ok'});save();
    notify(x.id,(a>0?'✅ ব্যালেন্সে ৳'+a+' যোগ হয়েছে।':'ℹ️ ব্যালেন্স থেকে ৳'+(-a)+' কাটা হয়েছে।'));return{ok:1}}
  case 'GET /api/admin/settings':return{price:C.price,ads:C.ads,adSeconds:C.adSeconds,methods:C.methods,adUrls:C.adUrls};
  case 'POST /api/admin/settings':{
    const price=Math.floor(+body.price),ads=Math.floor(+body.ads),adSeconds=Math.floor(+body.adSeconds);
    if(!(price>=1)||!(ads>=1&&ads<=20)||!(adSeconds>=5&&adSeconds<=120))fail('মান ঠিক নয় (অ্যাড ১-২০টি, সময় ৫-১২০ সেকেন্ড)');
    const adUrls=(body.adUrls||[]).map(x=>String(x).trim()).filter(x=>/^https?:\/\//.test(x));if(!adUrls.length)fail('কমপক্ষে একটি অ্যাড লিংক দিন');
    const methods={};for(const k in C.methods){const m=(body.methods||{})[k]||{},val=String(m.val||'').trim().slice(0,120),min=Math.floor(+m.min);
      if(!val||!(min>=1))fail(k+' এর তথ্য ঠিক নয়');methods[k]={...C.methods[k],val,min}}
    db.settings={price,ads,adSeconds,adUrls,methods};save();return{ok:1}}
  case 'POST /api/admin/video/delete':db.videos=db.videos.filter(v=>v.id!==body.id);save();return{ok:1};
  }
  fail('অজানা অনুরোধ');
}
http.createServer((req,res)=>{
  const url=req.url.split('?')[0];
  if(!url.startsWith('/api/')){
    if(url!=='/'&&url!=='/index.html'&&url!=='/admin'){res.writeHead(404);return res.end('404')}
    return fs.readFile(path.join(__dirname,'public',url==='/admin'?'admin.html':'index.html'),(e,d)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(d)})}
  let raw='';req.on('data',c=>{raw+=c;if(raw.length>1e5)req.destroy()});
  req.on('end',async()=>{
    const send=(c,o)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(o))};
    try{
      const tu=verify(req.headers['x-init']||'');if(!tu)return send(401,{error:'টেলিগ্রাম থেকে অ্যাপটি খুলুন'});
      const u=db.users[tu.id]||(db.users[tu.id]={id:tu.id,name:tu.username?'@'+tu.username:tu.first_name,bal:0,ad:null});
      send(200,await route(req.method,url,u,raw?JSON.parse(raw):{},tu));
    }catch(e){send(400,{error:typeof e==='string'?e:'সার্ভার ত্রুটি'});if(typeof e!=='string')console.error(e)}
  });
}).listen(PORT,()=>console.log('চালু: পোর্ট '+PORT));
// ===== বট (long polling) =====
async function onUpdate(u){
  if(u.message&&/^\/start/.test(u.message.text||''))
    notify(u.message.chat.id,'🎬 ভিডিও জোনে স্বাগতম! নিচের বাটনে চাপ দিন।',{reply_markup:{inline_keyboard:[[{text:'▶️ অ্যাপ খুলুন',web_app:{url:WEBAPP_URL}}]]}});
  if(u.message&&/^\/admin/.test(u.message.text||'')&&ADMINS.includes(u.message.from.id))
    notify(u.message.chat.id,'🛠 অ্যাডমিন প্যানেল',{reply_markup:{inline_keyboard:[[{text:'প্যানেল খুলুন',web_app:{url:WEBAPP_URL.replace(/\/$/,'')+'/admin'}}]]}});
  const c=u.callback_query;
  if(c){let msg='সম্পন্ন';
    try{if(!ADMINS.includes(c.from.id))throw 'অনুমতি নেই';const[a,id]=c.data.split(':');decide(id,a==='ok')}catch(e){msg=typeof e==='string'?e:'ত্রুটি'}
    tg('answerCallbackQuery',{callback_query_id:c.id,text:msg}).catch(()=>{});
    tg('editMessageReplyMarkup',{chat_id:c.message.chat.id,message_id:c.message.message_id,reply_markup:{inline_keyboard:[]}}).catch(()=>{})}
}
(async()=>{await tg('deleteWebhook',{}).catch(()=>{});let off=0;
  for(;;){try{const r=await tg('getUpdates',{offset:off,timeout:30});for(const u of r.result||[]){off=u.update_id+1;onUpdate(u)}}
  catch(e){await new Promise(r=>setTimeout(r,3000))}}})();
