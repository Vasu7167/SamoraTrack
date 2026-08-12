window._doCarry = function(e) {
  e.stopPropagation();
  var item = e.target.closest('[data-task-idx]');
  var idx = parseInt(item.getAttribute('data-task-idx'));
  var rawText = item.getAttribute('data-carry-text') || '';
  var tmp = document.createElement('textarea');
  tmp.innerHTML = rawText;
  var text = tmp.value || item.querySelector('.item-text').textContent.trim();
  var modal = document.getElementById('carryFwdModal');
  if (!modal) { alert('Modal not found'); return; }
  document.getElementById('carryFwdTaskText').textContent = text;
  document.getElementById('carryFwdReason').value = '';
  var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  var fmt = function(d){ return d.toISOString().split('T')[0]; };
  var lbl = function(d){ return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}); };
  var qd = document.getElementById('carryFwdQuickDays');
  var dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate()+2);
  var nextMon = new Date(); nextMon.setDate(nextMon.getDate() + ((8-nextMon.getDay())%7||7));
  qd.innerHTML = [
    {label:'Tomorrow · '+lbl(tomorrow), val:fmt(tomorrow)},
    {label:lbl(dayAfter), val:fmt(dayAfter)},
    {label:'Next Mon · '+lbl(nextMon), val:fmt(nextMon)}
  ].map(function(o){ return '<button onclick="window._pickDate(\'' + o.val + '\')" style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:12px;cursor:pointer;white-space:nowrap">'+o.label+'</button>'; }).join('');
  document.getElementById('carryFwdDate').value = fmt(tomorrow);
  window._pendingCarryIdx = idx;
  window._pendingCarryText = text;
  modal.style.display = 'flex';
};
window._pickDate = function(val) {
  document.getElementById('carryFwdDate').value = val;
};
window.confirmCarryForward = function() {
  var targetDate = document.getElementById('carryFwdDate').value;
  var reason = document.getElementById('carryFwdReason').value.trim();
  var taskText = window._pendingCarryText;
  if (!targetDate) { alert('Please choose a date'); return; }
  var today = new Date().toISOString().split('T')[0];
  if (targetDate <= today) { alert('Please choose a future date'); return; }
  var now = new Date();
  var ts = now.toLocaleDateString('en-IN',{day:'numeric',month:'short'}) + ' · ' + now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
  var targetLbl = new Date(targetDate+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  var d = dayData(targetDate);
  if (!d.tasks) d.tasks = [];
  if (!d.tasks.find(function(t){ return t.text === taskText; })) {
    d.tasks.push({text:taskText, done:false, addedAt:ts, priority:false, carriedFrom:viewDate, carryReason:reason||null});
  }
  save(targetDate);
  var srcDay = dayData(viewDate);
  if (!srcDay.tasks) srcDay.tasks = [];
  var srcTask = null;
  if (window._pendingCarryIdx != null) srcTask = srcDay.tasks[window._pendingCarryIdx];
  if (!srcTask || srcTask.text !== taskText) srcTask = srcDay.tasks.find(function(t){ return t.text === taskText; });
  if (srcTask) {
    srcTask.carriedTo = targetDate;
    srcTask.carriedToLabel = targetLbl;
    srcTask.done = false;
    srcTask.addedToMisses = true;
  }
  if (!srcDay.issues) srcDay.issues = [];
  var issueText = 'Moved forward: "' + taskText + '" to ' + targetLbl + (reason ? '. Reason: ' + reason : '');
  srcDay.issues.push({ text: issueText, addedAt: ts, isCarryLog: true, addedToMisses: true });
  save(viewDate);
  document.getElementById('carryFwdModal').style.display = 'none';
  save(viewDate);
  save(targetDate);
  setTodaySection('issues');
  setTimeout(function() {
    runCarryOver();
    renderToday();
    render();
  }, 100);
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#231F17;border:1px solid #A0752A;padding:10px 18px;border-radius:8px;font-size:13px;color:#D6CFC4;z-index:9999;font-family:"DM Sans",sans-serif;white-space:nowrap';
  t.textContent = 'Moved to ' + targetLbl + ' ✓';
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 3000);
};
window.closeCarryForward = function() {
  document.getElementById('carryFwdModal').style.display = 'none';
};
document.addEventListener('click', function(e) {
  var m = document.getElementById('carryFwdModal');
  if (m && e.target === m) m.style.display = 'none';
});
