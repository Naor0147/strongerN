// scripts/analyze-cpu-profile.js
// High-precision V8 CPU Profile Analyzer for Playwright CDP Traces

const fs = require('fs');
const path = require('path');

function analyzeProfile(profilePath) {
  if (!fs.existsSync(profilePath)) {
    console.warn(`[Analyzer] Profile file not found: ${profilePath}`);
    return null;
  }

  console.log(`\n🔍 Analyzing V8 CPU Profile: ${path.basename(profilePath)}`);
  const raw = fs.readFileSync(profilePath, 'utf8');
  let profile;
  try {
    profile = JSON.parse(raw);
  } catch (err) {
    console.error(`[Analyzer] Failed to parse JSON profile: ${err.message}`);
    return null;
  }

  const { nodes, samples, timeDeltas } = profile;
  if (!nodes || !samples || !timeDeltas) {
    console.warn('[Analyzer] Invalid V8 profile structure.');
    return null;
  }

  // Map nodes by ID
  const nodeMap = new Map();
  nodes.forEach(node => nodeMap.set(node.id, node));

  // Compute duration per sample tick (in ms)
  const nodeSelfTimeMs = new Map();
  let totalDurationMs = 0;

  for (let i = 0; i < samples.length; i++) {
    const nodeId = samples[i];
    const deltaMs = (timeDeltas[i] || 0) / 1000;
    totalDurationMs += deltaMs;
    nodeSelfTimeMs.set(nodeId, (nodeSelfTimeMs.get(nodeId) || 0) + deltaMs);
  }

  // Aggregate function-level stats
  const funcStats = new Map();

  nodes.forEach(node => {
    const selfMs = nodeSelfTimeMs.get(node.id) || 0;
    const name = node.callFrame.functionName || '(anonymous / internal)';
    const url = node.callFrame.url ? path.basename(node.callFrame.url) : '(native/v8)';
    const line = node.callFrame.lineNumber || 0;
    const key = `${name} [${url}:${line}]`;

    if (!funcStats.has(key)) {
      funcStats.set(key, { name, url, line, selfMs: 0, hitCount: 0 });
    }
    const stat = funcStats.get(key);
    stat.selfMs += selfMs;
    stat.hitCount += node.hitCount || 0;
  });

  const sortedStats = Array.from(funcStats.values())
    .filter(s => s.selfMs > 0.05)
    .sort((a, b) => b.selfMs - a.selfMs);

  console.log(`========================================================================`);
  console.log(`⏱️  Total Sampled Profiling Time: ${totalDurationMs.toFixed(2)} ms`);
  console.log(`========================================================================`);
  console.log(`TOP CPU BOTTLENECKS BY SELF TIME:`);
  console.log(`------------------------------------------------------------------------`);
  console.log(`Rank | Self Time (ms) | % CPU | Function Name [Source]`);
  console.log(`------------------------------------------------------------------------`);

  sortedStats.slice(0, 15).forEach((stat, idx) => {
    const pct = ((stat.selfMs / Math.max(1, totalDurationMs)) * 100).toFixed(1);
    console.log(
      `${(idx + 1).toString().padStart(4)} | ${stat.selfMs.toFixed(2).padStart(14)} | ${pct.padStart(5)}% | ${stat.name} [${stat.url}:${stat.line}]`
    );
  });
  console.log(`========================================================================\n`);

  return {
    profileFile: path.basename(profilePath),
    totalDurationMs: parseFloat(totalDurationMs.toFixed(2)),
    topBottlenecks: sortedStats.slice(0, 20).map(s => ({
      functionName: s.name,
      source: `${s.url}:${s.line}`,
      selfTimeMs: parseFloat(s.selfMs.toFixed(2)),
      cpuPercentage: parseFloat(((s.selfMs / Math.max(1, totalDurationMs)) * 100).toFixed(2)),
    })),
  };
}

function runAnalysis() {
  const root = path.resolve(__dirname, '..');
  const path4x = path.join(root, 'cpu_profile_4x.json');
  const path6x = path.join(root, 'cpu_profile_6x.json');

  const report4x = analyzeProfile(path4x);
  const report6x = analyzeProfile(path6x);

  const finalReport = {
    analyzedAt: new Date().toISOString(),
    throttled4x: report4x,
    throttled6x: report6x,
  };

  const reportPath = path.join(root, 'profile_analysis_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
  console.log(`✅ Analysis report saved to: ${reportPath}\n`);
}

if (require.main === module) {
  runAnalysis();
}

module.exports = { analyzeProfile, runAnalysis };
