/* Enhancements intentionally use the existing API and saved-workspace keys. */
const helpDialog = document.createElement('dialog');
helpDialog.className = 'help-dialog';
helpDialog.setAttribute('aria-labelledby', 'helpTitle');
helpDialog.innerHTML = `<button aria-label="Close help">✕</button><div class="eyebrow">TAKE TECHMAP WITH YOU</div><h2 id="helpTitle">Your workspace. Your files.</h2><p>Download the complete source, extract the ZIP, then open a terminal in the TechMap folder. Python 3.10 or newer is required.</p><code>python -m venv .venv\n# Activate it (see README for Windows / macOS)\npython -m pip install -r requirements.txt\npython run.py</code><p>Open http://127.0.0.1:8000. Company discovery, saved companies, and insights work without an AI provider. AI tools require your own gateway settings in .env.</p><p>Saved companies, resumes, and drafts stay in this browser. Export a workspace backup before moving to another device. Uploaded resumes and AI prompts are sent to your configured provider.</p><a href="/api/download/source">↓ Download complete source (.zip)</a><br><a href="#" id="backupWorkspace">↓ Export my workspace backup (.json)</a><br><label class="backup-label">Restore backup <input id="restoreWorkspace" type="file" accept=".json,application/json"></label>`;
document.body.append(helpDialog);
helpDialog.querySelector('button').onclick = () => helpDialog.close();
document.getElementById('helpBtn').onclick = () => helpDialog.showModal();
helpDialog.addEventListener('click', e => { if (e.target === helpDialog) { const r = helpDialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) helpDialog.close(); } });
document.getElementById('exploreBtn').onclick = () => { document.getElementById('searchInput').focus({preventScroll:true}); document.querySelector('.directory-heading').scrollIntoView({behavior:reduceMotion?'instant':'smooth',block:'start'}); };
for (const mode of ['grid','list']) document.getElementById(`${mode}View`).onclick = () => {
  document.getElementById('companiesGrid').classList.toggle('list-mode',mode==='list');
  for(const m of ['grid','list']) { const b = document.getElementById(`${m}View`); b.classList.toggle('active',m===mode); b.setAttribute('aria-pressed',String(m===mode)); }
};
apiJson('/stats').then(stats => {
  document.getElementById('heroCompanies').textContent = stats.total_companies.toLocaleString();
  document.getElementById('heroCities').textContent = Object.keys(stats.city_distribution).length;
  document.getElementById('heroSpecialties').textContent = Object.keys(stats.specialty_distribution).length;
}).catch(() => {});
for(const id of ['analyzer','resume','assistant']) {
  const note = document.createElement('p'); note.className='ai-notice'; note.textContent='✧ AI-powered · Requires a configured AI provider. Your input is sent to that provider; review generated content before using it.';
  document.querySelector(`#${id} .panel-header`).after(note);
}
document.getElementById('exportCompanies').onclick = async function () {
  this.disabled=true; this.textContent='Preparing export…';
  try {
    let items=[];
    if(state.view==='favorites') items=(await apiJson(`/companies/by-ids?ids=${[...state.favorites].join(',')}`)).items;
    else {
      const params=new URLSearchParams({limit:200,city:state.city,search:state.search,specialties:[...state.specs].join('|'),match:state.matchAll?'all':'any'});
      for(let offset=0;;offset+=200) { params.set('offset',offset); const page=await apiJson(`/companies?${params}`); items.push(...page.items); if(items.length>=page.total || !page.items.length) break; }
    }
    const fields=['company_name','city','specialties','description','website','apply_email','careers_url','phone'];
    const cell = value => { let s=Array.isArray(value)?value.join('; '):String(value||''); if(/^[=+@\-\t\r]/.test(s)) s="'"+s; return '"'+s.replaceAll('"','""')+'"'; };
    downloadTextFile('techmap-companies.csv','\uFEFF'+[fields.map(cell).join(','),...items.map(c=>fields.map(f=>cell(c[f])).join(','))].join('\r\n'),'text/csv;charset=utf-8');
    showToast(`Exported ${items.length} companies`);
  } catch(e) { showToast('Export failed. Please try again.'); }
  finally { this.disabled=false;this.textContent='↓ Export directory'; }
};
const workspaceKeys=['techmap_favorites','techmap_profile','techmap_applications','techmap_resume_data','techmap_resume_form','techmap_resume_template'];
document.getElementById('backupWorkspace').onclick=e=>{e.preventDefault();const data={format:'techmap-workspace-v1',data:{}};try {for(const key of workspaceKeys) data.data[key]=localStorage.getItem(key);downloadTextFile('techmap-workspace.json',JSON.stringify(data,null,2),'application/json');}catch{showToast('Browser storage is unavailable.');}};
document.getElementById('restoreWorkspace').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try {
    if(file.size>5*1024*1024)throw Error('Backup exceeds 5 MB.');
    const backup=JSON.parse(await file.text());
    if(backup.format!=='techmap-workspace-v1'||!backup.data||typeof backup.data!=='object')throw Error('Not a TechMap backup.');
    for(const key of workspaceKeys){const value=backup.data[key];if(value!=null){if(typeof value!=='string')throw Error('Invalid backup value.');if(key!=='techmap_resume_template') {const parsed=JSON.parse(value);if(!parsed||typeof parsed!=='object')throw Error('Invalid backup data.');if(['techmap_favorites','techmap_applications'].includes(key)&&!Array.isArray(parsed))throw Error('Invalid backup list.');}else if(!['classic','modern','bold'].includes(value))throw Error('Invalid template.');}}
    if(!confirm('Replace the saved workspace in this browser with this backup?'))return;
    for(const key of workspaceKeys){if(backup.data[key]!=null)localStorage.setItem(key,backup.data[key]);else localStorage.removeItem(key);}
    location.reload();
  } catch(err){showToast(err.message||'Could not restore backup.');}
};
