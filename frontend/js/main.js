async function api(path, method='GET', data=null, isForm=false){
  const opts = { method, headers: {} };

  if(data){
    if(isForm){
      opts.body = data; // FormData
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
  }

  const token = localStorage.getItem('token');
  if(token) opts.headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api' + path, opts);
  return res.json();
}

document.getElementById('signupBtn').addEventListener('click', async ()=>{
  const name = document.getElementById('su_name').value.trim();
  const role = document.getElementById('su_role').value;
  const email = document.getElementById('su_email').value.trim();
  const phone = document.getElementById('su_phone').value.trim();
  const password = document.getElementById('su_password').value;
  const bio = document.getElementById('su_bio').value.trim();
  if(!name || !role || !password){ alert('Please fill username, role and password'); return; }
  if(password.length < 6){ alert('Password should be 6+ chars'); return; }
  const resp = await api('/signup','POST',{ name, role, password, email, phone, bio });
  if(resp.error) return alert(resp.error);
  localStorage.setItem('token', resp.token);
  const user = resp.user;
  const slug = user.role.toLowerCase().replace(/\s+/g,'-');
  location.href = `/roles/${slug}.html?userId=${user._id}&name=${encodeURIComponent(user.name)}&role=${encodeURIComponent(user.role)}`;
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
  location.href = `/roles/${slug}.html?userId=${user._id}&name=${encodeURIComponent(user.name)}&role=${encodeURIComponent(user.role)}`;
});

document.getElementById('forgotLink').addEventListener('click', ()=>{
  document.getElementById('forgotCard').style.display = 'block';
  window.scrollTo(0,1000);
});

document.getElementById('fpBtn').addEventListener('click', async ()=>{
  const name = document.getElementById('fp_name').value.trim();
  if(!name) return alert('Enter username or email');
  const resp = await api('/forgot-password','POST',{ name });
  if(resp.error) return alert(resp.error);
  document.getElementById('fpResult').innerHTML = 'Reset token (demo): <b>' + resp.token + '</b><br/>Use it with /reset-password endpoint.';
});

// Avatar Upload (Profile Save Example)
document.getElementById('saveProfileBtn').addEventListener('click', async ()=>{
  const file = document.getElementById('p_avatar').files[0];
  if(file){
    const fd = new FormData();
    fd.append('avatar', file);
    const up = await api('/upload-avatar','POST', fd, true);
    if(up.error) return alert(up.error);
    alert('Profile updated with avatar');
  } else {
    alert('Profile updated without avatar');
  }
});




