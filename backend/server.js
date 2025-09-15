
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('frontend'));

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('Mongo connection error:', err));

const User = require('./models/User');
const Attendance = require('./models/Attendance');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const upl = path.join(__dirname, 'uploads');
    if(!fs.existsSync(upl)) fs.mkdirSync(upl);
    cb(null, upl);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 2 * 1024 * 1024 } });

function generateToken(user){
  return jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
}

async function authMiddleware(req,res,next){
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({ error: 'Missing token' });
  const parts = auth.split(' ');
  if(parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid token format' });
  const token = parts[1];
  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  }catch(err){ return res.status(401).json({ error: 'Invalid token' }); }
}

app.post('/api/signup', async (req,res)=>{
  try{
    const { name, role, password, email, phone, bio } = req.body;
    if(!name || !role || !password) return res.status(400).json({ error: 'name, role and password required' });
    const existing = await User.findOne({ name });
    if(existing) return res.status(400).json({ error: 'User with that name already exists' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, role, password: hash, email, phone, bio });
    const token = generateToken(user);
    res.json({ user: { _id: user._id, name: user.name, role: user.role, email: user.email, phone: user.phone, bio: user.bio, avatar: user.avatar }, token });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req,res)=>{
  try{
    const { name, password } = req.body;
    if(!name || !password) return res.status(400).json({ error: 'name and password required' });
    const user = await User.findOne({ name });
    if(!user) return res.status(400).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(400).json({ error: 'Invalid password' });
    const token = generateToken(user);
    res.json({ user: { _id: user._id, name: user.name, role: user.role, email: user.email, phone: user.phone, bio: user.bio, avatar: user.avatar }, token });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.get('/api/profile', authMiddleware, async (req,res)=>{
  try{
    const user = await User.findById(req.user.id).select('-password -resetToken -resetTokenExpiry');
    res.json({ user });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.put('/api/profile', authMiddleware, async (req,res)=>{
  try{
    const { email, phone, bio, name } = req.body;
    const user = await User.findById(req.user.id);
    if(!user) return res.status(404).json({ error: 'Not found' });
    if(name) user.name = name;
    if(email) user.email = email;
    if(phone) user.phone = phone;
    if(bio) user.bio = bio;
    await user.save();
    res.json({ user: { _id: user._id, name: user.name, role: user.role, email: user.email, phone: user.phone, bio: user.bio, avatar: user.avatar } });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.post('/api/upload-avatar', authMiddleware, upload.single('avatar'), async (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({ error: 'No file' });
    const user = await User.findById(req.user.id);
    if(!user) return res.status(404).json({ error: 'Not found' });
    if(user.avatar){
      const old = path.join(__dirname, 'uploads', path.basename(user.avatar));
      try{ if(fs.existsSync(old)) fs.unlinkSync(old); }catch(e){}
    }
    user.avatar = '/uploads/' + req.file.filename;
    await user.save();
    res.json({ avatar: user.avatar });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.post('/api/forgot-password', async (req,res)=>{
  try{
    const { name, email } = req.body;
    if(!name && !email) return res.status(400).json({ error: 'Provide name or email' });
    const user = await User.findOne(name ? { name } : { email });
    if(!user) return res.status(400).json({ error: 'User not found' });
    const token = Math.random().toString(36).slice(2,10);
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 60;
    await user.save();
    res.json({ message: 'Reset token (demo) generated', token });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.post('/api/reset-password', async (req,res)=>{
  try{
    const { name, token, newPassword } = req.body;
    if(!name || !token || !newPassword) return res.status(400).json({ error: 'name, token and newPassword required' });
    const user = await User.findOne({ name, resetToken: token });
    if(!user) return res.status(400).json({ error: 'Invalid token or user' });
    if(user.resetTokenExpiry < Date.now()) return res.status(400).json({ error: 'Token expired' });
    user.password = await bcrypt.hash(newPassword,10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    res.json({ message: 'Password reset successful' });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance', authMiddleware, async (req,res) => {
  try{
    const { userId, status, note } = req.body;
    if(!userId || !status) return res.status(400).json({ error: 'userId and status required' });
    const entry = await Attendance.create({ user: userId, status, note, createdBy: req.user.id });
    res.json({ attendance: entry });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.get('/api/attendance/:userId', authMiddleware, async (req,res)=>{
  try{
    const entries = await Attendance.find({ user: req.params.userId }).populate('user').sort({ createdAt:-1 });
    res.json({ entries });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.get('/api/all-attendance', authMiddleware, async (req,res)=>{
  try{
    if(req.user.role !== 'Project Manager') return res.status(403).json({ error: 'Forbidden' });
    const entries = await Attendance.find().populate('user').sort({ createdAt:-1 });
    res.json({ entries });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.delete('/api/attendance/:id', authMiddleware, async (req,res)=>{
  try{
    if(req.user.role !== 'Project Manager') return res.status(403).json({ error: 'Forbidden' });
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.get('/api/users', authMiddleware, async (req,res)=>{
  try{
    const users = await User.find().select('-password -resetToken -resetTokenExpiry').sort({ createdAt: -1 });
    res.json({ users });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', authMiddleware, async (req,res)=>{
  try{
    if(req.user.role !== 'Project Manager') return res.status(403).json({ error: 'Forbidden' });
    await User.findByIdAndDelete(req.params.id);
    await Attendance.deleteMany({ user: req.params.id });
    res.json({ success: true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.post('/api/users', authMiddleware, async (req,res)=>{
  try{
    if(req.user.role !== 'Project Manager') return res.status(403).json({ error: 'Forbidden' });
    const { name, role, password, email, phone, bio } = req.body;
    if(!name || !role || !password) return res.status(400).json({ error: 'name, role, password required' });
    const existing = await User.findOne({ name }); if(existing) return res.status(400).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password,10);
    const user = await User.create({ name, role, password: hash, email, phone, bio });
    res.json({ user: { _id: user._id, name: user.name, role: user.role, email: user.email, phone: user.phone, bio: user.bio } });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.get('/api/coaching/courses', async (req,res)=>{
  const courses = [
    { id: 'nodejs', title: 'Node.js Basic to Advanced', description: 'Backend development coaching for students.' },
    { id: 'python', title: 'Python Programming', description: 'Python for automation & data.' },
    { id: 'project', title: 'Mini Projects', description: 'Build real projects to learn.' }
  ];
  res.json({ courses });
});

app.listen(port, ()=>console.log('Server running on port', port));
