
async function api(path, method='GET', data=null, token=null){
  const opts = { method, headers: {} };
  if(data){ opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(data); }
  if(token) opts.headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch('/api' + path, opts);
  return res.json();
}

// Show login after first successful signup (per request)
document.getElementById('signupBtn').addEventListener('click', async ()=>{
  const name = document.getElementById('su_name').value.trim();
  const role = document.getElementById('su_role').value;
  const password = document.getElementById('su_password').value;
  if(!name || !role || !password){ alert('Please fill name, role and password'); return; }
  if(password.length < 6){ alert('Password should be 6+ chars'); return; }
  const resp = await api('/signup','POST',{ name, role, password });
  if(resp.error) return alert(resp.error);
  // store token and redirect to dashboard
  localStorage.setItem('token', resp.token);
  const user = resp.user;
  const slug = user.role.toLowerCase().replace(/\s+/g,'-');
  const url = `/roles/${slug}.html?userId=${user._id}&name=${encodeURIComponent(user.name)}&role=${encodeURIComponent(user.role)}`;
  window.location.href = url;
});

document.getElementById('loginBtn').addEventListener('click', async ()=>{
  const name = document.getElementById('name').value.trim();
  const password = document.getElementById('password').value;
  if(!name || !password){ alert('Enter name and password'); return; }
  const resp = await api('/login','POST',{ name, password });
  if(resp.error) return alert(resp.error);
  localStorage.setItem('token', resp.token);
  const user = resp.user;
  const slug = user.role.toLowerCase().replace(/\s+/g,'-');
  const url = `/roles/${slug}.html?userId=${user._id}&name=${encodeURIComponent(user.name)}&role=${encodeURIComponent(user.role)}`;
  window.location.href = url;
});

// If previously signed up and have token, show login card so they can login (or can auto-login if token present)
window.addEventListener('load', ()=>{
  const t = localStorage.getItem('token');
  if(!t){
    // show signup & login both (signup visible, login hidden until signup success per previous flow).
    document.getElementById('signupCard').style.display = 'block';
    document.getElementById('loginCard').style.display = 'block';
  } else {
    // token exists - user may be logged in already; keep both visible
    document.getElementById('signupCard').style.display = 'block';
    document.getElementById('loginCard').style.display = 'block';
  }
});
