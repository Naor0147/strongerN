#!/usr/bin/env node
/**
 * benchmark-history-hydration.js — Compact, jank-free history hydration benchmark
 * Measures Frame 0, header-only query, SQL aggregate, hydrator streaming at 300/1k/10k/100k
 * Run: node scripts/benchmark-history-hydration.js --sessions=300,1000,10000 --iterations=5
 */
'use strict';
const { DatabaseSync } = require('node:sqlite');
const { performance } = require('node:perf_hooks');
const fs = require('node:fs');
const path = require('node:path');

function createPrng(seed=133742){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;}}
function calculateChecksum(str){let h=5381;for(let i=0;i<str.length;i++) h=((h*33)^str.charCodeAt(i))>>>0;return (h>>>0).toString(16);}
function normalizeLookupKey(v){return String(v??'').trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');}
const EXERCISE_CATALOG=[{name:'Barbell Bench Press',muscle:'Chest'},{name:'Barbell Back Squat',muscle:'Quads'},{name:'Romanian Deadlift',muscle:'Hamstrings'},{name:'Overhead Press',muscle:'Shoulders'},{name:'Lat Pulldown',muscle:'Back'},{name:'Row',muscle:'Back'},{name:'Lateral Raise',muscle:'Shoulders'},{name:'Triceps Pushdown',muscle:'Triceps'}];
function generateSessions(count,seed=42){
  const prng=createPrng(seed); const nowMs=Date.now(); const sessions=[];
  for(let i=0;i<count;i++){
    const startedAtMs=nowMs - i*2.3*86400000 - Math.floor(prng()*3600000*4);
    const durationSec=(45+Math.floor(prng()*45))*60;
    const title=['Upper','Lower','Push','Pull','Legs & Core','Full Body'][i%6];
    const sessionId=`session-${calculateChecksum(`${startedAtMs}|${title}|${i}`)}`;
    const exCount=4+Math.floor(prng()*2);
    const exercises=[]; let vol=0;
    for(let e=0;e<exCount;e++){
      const tmpl=EXERCISE_CATALOG[e%EXERCISE_CATALOG.length];
      const exId=`ex-${calculateChecksum(`${sessionId}|${e}|${tmpl.name}`)}`;
      const setCount=3+Math.floor(prng()*2);
      const sets=[];
      for(let s=0;s<setCount;s++){
        const w=Math.round((60+Math.floor(prng()*40))*1000);
        const reps=6+Math.floor(prng()*6);
        vol+=w/1000*reps;
        sets.push({id:`set-${calculateChecksum(`${exId}|${s}`)}`,position:s,category:'S',completed:1,weight_milli_kg:w,reps,rpe_tenths:80,is_unilateral:0,left_weight_milli_kg:null,left_reps:null,right_weight_milli_kg:null,right_reps:null});
      }
      exercises.push({id:exId,session_id:sessionId,exercise_id:null,name_snapshot:tmpl.name,name_norm:normalizeLookupKey(tmpl.name),variation_key:'',position:e,superset_group_id:null,note:null,sets});
    }
    sessions.push({id:sessionId,title,title_norm:normalizeLookupKey(title),started_at_ms:startedAtMs,ended_at_ms:startedAtMs+durationSec*1000,duration_sec:durationSec,comment:null,total_volume_milli_kg:Math.round(vol*1000),prs:0,created_at_ms:startedAtMs,updated_at_ms:startedAtMs+durationSec*1000,revision:1,deleted_at_ms:null,exercises});
  }
  return sessions;
}
function setupDb(sessions){
  const db=new DatabaseSync(':memory:');
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;
  CREATE TABLE persistence_meta(key TEXT PRIMARY KEY,value TEXT,updated_at_ms INTEGER);
  CREATE TABLE workout_sessions(id TEXT PRIMARY KEY,title TEXT,title_norm TEXT,started_at_ms INTEGER,ended_at_ms INTEGER,duration_sec INTEGER,comment TEXT,total_volume_milli_kg INTEGER,prs INTEGER,created_at_ms INTEGER,updated_at_ms INTEGER,revision INTEGER,deleted_at_ms INTEGER);
  CREATE TABLE session_exercises(id TEXT PRIMARY KEY,session_id TEXT REFERENCES workout_sessions(id) ON DELETE CASCADE,exercise_id TEXT,name_snapshot TEXT,name_norm TEXT,variation_key TEXT DEFAULT '',position INTEGER,superset_group_id TEXT,note TEXT,UNIQUE(session_id,position));
  CREATE TABLE set_logs(id TEXT PRIMARY KEY,session_exercise_id TEXT REFERENCES session_exercises(id) ON DELETE CASCADE,position INTEGER,category TEXT,completed INTEGER,weight_milli_kg INTEGER,reps INTEGER,rpe_tenths INTEGER,is_unilateral INTEGER,left_weight_milli_kg INTEGER,left_reps INTEGER,right_weight_milli_kg INTEGER,right_reps INTEGER,UNIQUE(session_exercise_id,position));
  CREATE INDEX idx_sessions_started_desc ON workout_sessions(deleted_at_ms,started_at_ms DESC,id);
  CREATE INDEX idx_exercises_lookup ON session_exercises(name_norm,variation_key,session_id);`);
  const insSess=db.prepare(`INSERT INTO workout_sessions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insEx=db.prepare(`INSERT INTO session_exercises VALUES (?,?,?,?,?,?,?,?,?)`);
  const insSet=db.prepare(`INSERT INTO set_logs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN TRANSACTION;');
  for(const s of sessions){
    insSess.run(s.id,s.title,s.title_norm,s.started_at_ms,s.ended_at_ms,s.duration_sec,s.comment,s.total_volume_milli_kg,s.prs,s.created_at_ms,s.updated_at_ms,s.revision,s.deleted_at_ms);
    for(const ex of s.exercises){
      insEx.run(ex.id,ex.session_id,ex.exercise_id,ex.name_snapshot,ex.name_norm,ex.variation_key,ex.position,ex.superset_group_id,ex.note);
      for(const st of ex.sets) insSet.run(st.id,ex.id,st.position,st.category,st.completed,st.weight_milli_kg,st.reps,st.rpe_tenths,st.is_unilateral,st.left_weight_milli_kg,st.left_reps,st.right_weight_milli_kg,st.right_reps);
    }
  }
  db.exec('COMMIT;');
  return db;
}
function calculateStats(a){
  if(!a.length) return {mean:0,p95:0,min:0,max:0,median:0};
  const s=[...a].sort((x,y)=>x-y); const sum=s.reduce((x,y)=>x+y,0);
  return {mean:+(sum/s.length).toFixed(2),median:+s[Math.floor(s.length/2)].toFixed(2),min:+s[0].toFixed(2),max:+s[s.length-1].toFixed(2),p95:+s[Math.min(s.length-1,Math.floor(s.length*0.95))].toFixed(2),samples:s.length};
}
function benchmarkFrame0(db){
  // Simulates MMKV getCachedRecentSessions (20) + getCachedLifetimeStats — sync JSON parse
  const recent=db.prepare(`SELECT id,title,started_at_ms,duration_sec,total_volume_milli_kg FROM workout_sessions WHERE deleted_at_ms IS NULL ORDER BY started_at_ms DESC LIMIT 20`).all();
  const json=JSON.stringify(recent);
  const t0=performance.now(); JSON.parse(json); return performance.now()-t0;
}
function benchmarkHeader50(db){
  const t0=performance.now();
  const rows=db.prepare(`SELECT id,title,started_at_ms,ended_at_ms,duration_sec,comment,total_volume_milli_kg,prs,created_at_ms,updated_at_ms,revision,deleted_at_ms FROM workout_sessions WHERE deleted_at_ms IS NULL ORDER BY started_at_ms DESC, id DESC LIMIT 50`).all();
  return {ms:performance.now()-t0,count:rows.length};
}
function benchmarkLifetimeAggregate(db){
  const t0=performance.now();
  const rows=db.prepare(`SELECT se.name_norm, COUNT(sl.id) as c FROM set_logs sl JOIN session_exercises se ON se.id=sl.session_exercise_id JOIN workout_sessions ws ON ws.id=se.session_id WHERE ws.deleted_at_ms IS NULL AND sl.completed=1 GROUP BY se.name_norm`).all();
  return {ms:performance.now()-t0,groups:rows.length};
}
function benchmarkHydratorStreaming(db, chunk=30){
  const total=db.prepare(`SELECT COUNT(*) as c FROM workout_sessions WHERE deleted_at_ms IS NULL`).get().c;
  let loaded=0; let lastMs,lastId; const times=[];
  // prime first 50
  let cur=db.prepare(`SELECT id,started_at_ms FROM workout_sessions WHERE deleted_at_ms IS NULL ORDER BY started_at_ms DESC, id DESC LIMIT 50`).all();
  loaded=cur.length;
  if(cur.length) { lastMs=cur[cur.length-1].started_at_ms; lastId=cur[cur.length-1].id; }
  while(loaded<total){
    const t0=performance.now();
    const stmt=db.prepare(`SELECT id,started_at_ms FROM workout_sessions WHERE deleted_at_ms IS NULL AND (started_at_ms < ? OR (started_at_ms=? AND id<?)) ORDER BY started_at_ms DESC, id DESC LIMIT ?`);
    const chunkRows=stmt.all(lastMs,lastMs,lastId,chunk);
    times.push(performance.now()-t0);
    if(chunkRows.length===0) break;
    loaded+=chunkRows.length;
    lastMs=chunkRows[chunkRows.length-1].started_at_ms;
    lastId=chunkRows[chunkRows.length-1].id;
    if(chunkRows.length<chunk) break;
  }
  return {total,loaded,chunkMs:calculateStats(times)};
}
function runScenario(count, iterations=5){
  const sessions=generateSessions(count, 100+count);
  const db=setupDb(sessions);
  const frame0=[], h50=[], lifetime=[], hydrator=[];
  for(let i=0;i<iterations;i++){
    frame0.push(benchmarkFrame0(db));
    h50.push(benchmarkHeader50(db).ms);
    lifetime.push(benchmarkLifetimeAggregate(db).ms);
    hydrator.push(benchmarkHydratorStreaming(db).chunkMs.mean);
  }
  const rawJson=JSON.stringify(sessions);
  const recentJson=JSON.stringify(sessions.slice(0,20));
  return {
    count,
    totalSets:sessions.reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+e.sets.length,0),0),
    rawKB:+(Buffer.byteLength(rawJson,'utf8')/1024).toFixed(1),
    recentKB:+(Buffer.byteLength(recentJson,'utf8')/1024).toFixed(1),
    frame0:calculateStats(frame0),
    header50:calculateStats(h50),
    lifetime:calculateStats(lifetime),
    hydrator,
  };
}
function main(){
  const args=process.argv.slice(2);
  let sessionsArg=[300,1000,10000];
  let iterations=5;
  let save=null;
  let json=false;
  for(const a of args){
    if(a.startsWith('--sessions=')) sessionsArg=a.split('=')[1].split(',').map(s=>parseInt(s,10)).filter(Boolean);
    if(a.startsWith('--iterations=')) iterations=parseInt(a.split('=')[1],10)||5;
    if(a.startsWith('--save=')) save=a.split('=')[1];
    if(a==='--json') json=true;
  }
  const scenarios=sessionsArg.map(c=>runScenario(c,iterations));
  if(json){ console.log(JSON.stringify(scenarios,null,2)); return; }
  console.log('\n=== StrongerN Compact History Hydration Benchmark ===\n');
  for(const s of scenarios){
    console.log(`▶ ${s.count} sessions (${s.totalSets} sets, raw ${s.rawKB}KB, recent 20 ${s.recentKB}KB)`);
    console.log(`  Frame 0 JSON.parse(20): ${s.frame0.mean}ms p95 ${s.frame0.p95}ms`);
    console.log(`  Header 50 (no JOIN): ${s.header50.mean}ms p95 ${s.header50.p95}ms`);
    console.log(`  SQL aggregate (lifetime): ${s.lifetime.mean}ms p95 ${s.lifetime.p95}ms`);
    console.log(`  Hydrator 30-chunk mean: ${s.hydrator[0]?.toFixed? s.hydrator[0].toFixed(2): s.hydrator[0]}ms`);
    const ok = s.header50.p95 < 8 && s.lifetime.p95 < 40;
    console.log(`  ${ok ? '✅ PASS' : '❌ SLOW'} (header <8ms, lifetime <40ms)\n`);
  }
  if(save){
    const outPath=path.resolve(process.cwd(), save);
    const md=[`# History Hydration Benchmark ${new Date().toISOString()}`,`| Sessions | rawKB | Frame0 p95 | Header50 p95 | Lifetime p95 | Result |`,`|---|---|---|---|---|---|`];
    for(const s of scenarios) md.push(`| ${s.count} | ${s.rawKB} | ${s.frame0.p95} | ${s.header50.p95} | ${s.lifetime.p95} | ${s.header50.p95<8 && s.lifetime.p95<40?'PASS':'FAIL'} |`);
    fs.writeFileSync(outPath, md.join('\n'), 'utf8');
    console.log(`Saved ${outPath}`);
  }
}
if(require.main===module) main();
module.exports={runScenario};
