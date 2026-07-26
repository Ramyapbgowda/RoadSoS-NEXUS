/* ============================================================
   RoadSoS NEXUS — Multi-Agent Visualization
   Renders live status cards for all 9 agents and animates them
   through processing -> done as real orchestration results arrive.
   ============================================================ */

const AGENT_META = {
  Triage:        { icon: '🩺', color: 'var(--red)' },
  Dispatch:      { icon: '🚑', color: 'var(--cyan)' },
  Route:         { icon: '🗺️', color: 'var(--green)' },
  Legal:         { icon: '⚖️', color: 'var(--yellow)' },
  Medical:       { icon: '💉', color: 'var(--red)' },
  Prediction:    { icon: '📈', color: 'var(--purple)' },
  Communication: { icon: '📡', color: 'var(--cyan)' },
  Weather:       { icon: '🌦️', color: 'var(--yellow)' },
  Traffic:       { icon: '🚦', color: 'var(--green)' },
};

const AgentViz = (() => {
  function renderIdle(containerEl) {
    containerEl.innerHTML = Object.entries(AGENT_META).map(([name, meta]) => `
      <div class="agent-card" id="agent-${name}">
        <div class="agent-icon">${meta.icon}</div>
        <div class="agent-name">${name} Agent</div>
        <div class="agent-status">Standing by</div>
      </div>
    `).join('');
  }

  async function runSequence(containerEl, agentsResult) {
    Object.keys(AGENT_META).forEach(name => {
      const el = document.getElementById(`agent-${name}`);
      if (!el) return;
      el.classList.add('processing');
      el.classList.remove('done');
      const shimmer = document.createElement('div');
      shimmer.className = 'shimmer';
      el.appendChild(shimmer);
      el.querySelector('.agent-status').textContent = 'Thinking…';
    });

    for (const name of Object.keys(AGENT_META)) {
      const startT = performance.now();
      const el = document.getElementById(`agent-${name}`);
      if (el) el.querySelector('.agent-status').textContent = 'Dispatching…';
      await new Promise(r => setTimeout(r, 90));
      if (!el) continue;
      const result = agentsResult[name];
      el.classList.remove('processing');
      el.classList.add('done');
      const shimmer = el.querySelector('.shimmer');
      if (shimmer) shimmer.remove();
      el.querySelector('.agent-status').textContent = '✅ Completed';
      const elapsed = (performance.now() - startT).toFixed(1);

      let detail = '';
      if (result) {
        const entries = Object.entries(result).filter(([k]) => k !== 'agent');
        detail = entries.slice(0, 2).map(([k, v]) => {
          const val = Array.isArray(v) ? v.join(', ') : (typeof v === 'object' ? JSON.stringify(v) : v);
          return `<div><b>${k.replace(/_/g, ' ')}:</b> ${val}</div>`;
        }).join('');
      }
      let detailEl = el.querySelector('.agent-detail');
      if (!detailEl) {
        detailEl = document.createElement('div');
        detailEl.className = 'agent-detail';
        el.appendChild(detailEl);
      }
      detailEl.innerHTML = detail;

      let timeEl = el.querySelector('.agent-time');
      if (!timeEl) {
        timeEl = document.createElement('div');
        timeEl.className = 'agent-time';
        el.appendChild(timeEl);
      }
      timeEl.textContent = `⚡ ${elapsed} ms`;
    }
  }

  return { renderIdle, runSequence };
})();
