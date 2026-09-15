import { Router, type Request, type Response } from "express";
import { getUsers, findUserById, createUser, updateUser, updatePassword, deleteUser, toSafeUser, type UserRole } from "../lib/users.js";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth.js";
import { logger } from "../lib/logger.js";

const router = Router();

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function adminShell(title: string, body: string, currentUser: { name: string; username: string; role: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} — PharmaConnect Growth Engine</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;min-height:100vh;}
.topbar{background:#005EB8;color:#fff;padding:0 24px;display:flex;align-items:center;height:54px;gap:16px;box-shadow:0 2px 8px rgba(0,0,0,.18);}
.topbar-logo{font-size:1rem;font-weight:800;letter-spacing:-.02em;white-space:nowrap;}
.topbar-logo span{opacity:.6;font-weight:400;font-size:.82rem;margin-left:6px;}
.topbar-back{margin-left:auto;background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:7px;padding:5px 14px;font-size:.82rem;font-weight:600;text-decoration:none;white-space:nowrap;}
.topbar-back:hover{background:rgba(255,255,255,.22);}
.topbar-user{font-size:.8rem;opacity:.8;margin-left:8px;}
.page{max-width:900px;margin:32px auto;padding:0 20px 60px;}
.card{background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.07);padding:28px 28px 24px;margin-bottom:20px;}
h1{font-size:1.2rem;font-weight:800;margin-bottom:4px;}
.subtitle{font-size:.83rem;color:#64748b;margin-bottom:24px;}
label{display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:4px;}
input[type=text],input[type=password],select{width:100%;padding:9px 13px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.9rem;background:#f8fafc;}
input:focus,select:focus{outline:none;border-color:#005EB8;background:#fff;}
.field{margin-bottom:14px;}
.btn{padding:9px 20px;border:none;border-radius:8px;font-size:.88rem;font-weight:700;cursor:pointer;}
.btn-primary{background:#005EB8;color:#fff;}
.btn-primary:hover{background:#004a94;}
.btn-ghost{background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;}
.btn-ghost:hover{background:#e2e8f0;}
.btn-danger{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}
.btn-danger:hover{background:#fee2e2;}
.msg-ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;border-radius:8px;padding:10px 14px;font-size:.85rem;margin-bottom:16px;}
.msg-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:8px;padding:10px 14px;font-size:.85rem;margin-bottom:16px;}
table{width:100%;border-collapse:collapse;font-size:.87rem;}
th{padding:9px 12px;font-weight:700;color:#374151;text-align:left;border-bottom:2px solid #e2e8f0;}
td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle;}
tr:last-child td{border-bottom:none;}
.badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:700;}
.badge-admin{background:#dbeafe;color:#1e40af;}
.badge-staff{background:#f1f5f9;color:#475569;}
.badge-you{background:#dcfce7;color:#15803d;font-size:.68rem;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.form-row{display:flex;gap:10px;margin-top:6px;}
#add-form{display:none;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:22px;}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-logo">PharmaConnect Growth Engine <span>admin</span></div>
  <a href="/api/admin/master" class="topbar-back" style="margin-left:0">Client Portfolio</a>
  <span class="topbar-user">👤 ${esc(currentUser.name || currentUser.username)}</span>
  <a href="/api/dashboard" class="topbar-back">← Back to Dashboard</a>
</div>
<div class="page">
${body}
</div>
<script>
function apiFetch(path,opts){
  const t='${process.env.SESSION_SECRET ? process.env.SESSION_SECRET.replace(/'/g,"\\'"): ""}';
  const h={...(opts?.headers||{})};
  if(t){h['X-Internal-Token']=t;h['Authorization']='Bearer '+t;}
  return fetch(window.location.origin+path,{cache:'no-store',...opts,headers:h});
}
</script>
</body>
</html>`;
}

// ── GET /admin/users ─────────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, (req: Request, res: Response) => {
  const users = getUsers().map(toSafeUser);
  const currentUserId = req.session.userId!;
  const currentUser   = { name: req.session.userName ?? "", username: req.session.username ?? "", role: req.session.userRole ?? "staff" };

  const rows = users.map(u => {
    const isMe    = u.id === currentUserId;
    const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "Never";
    const roleClass = u.role === "admin" ? "badge-admin" : "badge-staff";
    const meTag   = isMe ? ` <span class="badge badge-you">You</span>` : "";
    const actions = isMe
      ? `<span style="color:#94a3b8;font-size:.8rem;">—</span>`
      : `<button class="btn btn-danger" onclick="delUser('${u.id}','${esc(u.name)}')">Remove</button>`;
    return `<tr>
      <td>${esc(u.name)}${meTag}</td>
      <td style="color:#64748b;">${esc(u.username)}</td>
      <td><span class="badge ${roleClass}">${esc(u.role)}</span></td>
      <td style="color:#94a3b8;">${lastLogin}</td>
      <td>${actions}</td>
    </tr>`;
  }).join("");

  const body = `
<h1>Team Members</h1>
<p class="subtitle">Manage who can access the PharmaConnect Growth Engine. ${users.length} member${users.length !== 1 ? "s" : ""} total.</p>

<div id="msg"></div>

<div class="card">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
    <strong style="font-size:.95rem;">All Users</strong>
    <button class="btn btn-primary" onclick="showAdd()">+ Add Team Member</button>
  </div>

  <div id="add-form">
    <strong style="font-size:.9rem;display:block;margin-bottom:14px;">New Team Member</strong>
    <div class="grid2">
      <div class="field"><label>Full Name</label><input id="u-name" type="text" placeholder="Jane Smith"/></div>
      <div class="field"><label>Username</label><input id="u-username" type="text" placeholder="janesmith"/></div>
      <div class="field"><label>Password</label><input id="u-password" type="password" placeholder="Min 8 characters"/></div>
      <div class="field"><label>Role</label>
        <select id="u-role">
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>
    </div>
    <div id="add-err" style="color:#dc2626;font-size:.82rem;margin-bottom:10px;display:none;"></div>
    <div class="form-row">
      <button class="btn btn-primary" onclick="addUser()">Create</button>
      <button class="btn btn-ghost" onclick="hideAdd()">Cancel</button>
    </div>
  </div>

  <div style="overflow-x:auto;">
    <table>
      <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Last Login</th><th>Actions</th></tr></thead>
      <tbody id="users-tbody">${rows}</tbody>
    </table>
  </div>
</div>

<script>
(function(){
  function showMsg(txt,ok){
    var el=document.getElementById('msg');
    el.className=ok?'msg-ok':'msg-err';
    el.textContent=txt;
    el.style.display='block';
    setTimeout(function(){el.style.display='none';},4000);
  }
  function reloadTable(){
    fetch('/api/users').then(function(r){return r.json();}).then(function(d){
      if(!d.users)return;
      var html=d.users.map(function(u){
        var isMe=u.id==='${currentUserId}';
        var lastLogin=u.lastLoginAt?new Date(u.lastLoginAt).toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'}):'Never';
        var rc=u.role==='admin'?'badge-admin':'badge-staff';
        var me=isMe?' <span class="badge badge-you">You</span>':'';
        var act=isMe?'<span style="color:#94a3b8;font-size:.8rem;">—</span>':'<button class="btn btn-danger" onclick="delUser(\\''+u.id+'\\',\\''+u.name.replace(/'/g,"\\\\'")+'\\')">Remove</button>';
        return '<tr><td>'+u.name+me+'</td><td style="color:#64748b;">'+u.username+'</td><td><span class="badge '+rc+'">'+u.role+'</span></td><td style="color:#94a3b8;">'+lastLogin+'</td><td>'+act+'</td></tr>';
      }).join('');
      document.getElementById('users-tbody').innerHTML=html;
    });
  }
  window.showAdd=function(){document.getElementById('add-form').style.display='block';document.getElementById('u-name').focus();};
  window.hideAdd=function(){
    document.getElementById('add-form').style.display='none';
    ['u-name','u-username','u-password'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('u-role').value='staff';
    document.getElementById('add-err').style.display='none';
  };
  window.addUser=function(){
    var name=document.getElementById('u-name').value.trim();
    var username=document.getElementById('u-username').value.trim();
    var password=document.getElementById('u-password').value;
    var role=document.getElementById('u-role').value;
    var err=document.getElementById('add-err');
    if(!name||!username||!password){err.textContent='All fields required';err.style.display='block';return;}
    if(password.length<8){err.textContent='Password must be at least 8 characters';err.style.display='block';return;}
    err.style.display='none';
    fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,username,password,role})})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.error){err.textContent=d.error;err.style.display='block';return;}
        hideAdd();reloadTable();showMsg(name+' added successfully.',true);
      }).catch(function(){err.textContent='Request failed';err.style.display='block';});
  };
  window.delUser=function(id,name){
    if(!confirm('Remove '+name+' from the team? They will no longer be able to log in.'))return;
    fetch('/api/users/'+id,{method:'DELETE'})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.error){showMsg(d.error,false);return;}
        reloadTable();showMsg(name+' removed.',true);
      });
  };
})();
</script>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(adminShell("Manage Team", body, currentUser));
});

// ── GET /admin/change-password ────────────────────────────────────────────────
router.get("/admin/change-password", requireAuth, (req: Request, res: Response) => {
  const currentUser = { name: req.session.userName ?? "", username: req.session.username ?? "", role: req.session.userRole ?? "staff" };

  const body = `
<h1>Change Password</h1>
<p class="subtitle">Update your login password for ${esc(currentUser.username)}.</p>

<div class="card" style="max-width:480px;">
  <div id="pw-msg"></div>
  <div class="field"><label>New Password</label><input id="pw-new" type="password" placeholder="Min 8 characters"/></div>
  <div class="field"><label>Confirm Password</label><input id="pw-confirm" type="password" placeholder="Repeat password"/></div>
  <button class="btn btn-primary" onclick="changePw()" style="margin-top:8px;">Update Password</button>
</div>

<script>
(function(){
  var uid=null;
  fetch('/api/auth/me').then(function(r){return r.json();}).then(function(d){uid=d.id;});
  window.changePw=function(){
    var np=document.getElementById('pw-new').value;
    var cp=document.getElementById('pw-confirm').value;
    var msg=document.getElementById('pw-msg');
    msg.style.display='none';
    if(np.length<8){msg.className='msg-err';msg.textContent='Password must be at least 8 characters';msg.style.display='block';return;}
    if(np!==cp){msg.className='msg-err';msg.textContent='Passwords do not match';msg.style.display='block';return;}
    fetch('/api/users/'+uid,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:np})})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.error){msg.className='msg-err';msg.textContent=d.error;msg.style.display='block';return;}
        msg.className='msg-ok';msg.textContent='Password updated successfully!';msg.style.display='block';
        document.getElementById('pw-new').value='';document.getElementById('pw-confirm').value='';
      }).catch(function(){msg.className='msg-err';msg.textContent='Request failed';msg.style.display='block';});
  };
})();
</script>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(adminShell("Change Password", body, currentUser));
});

export default router;
