
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('frontend'));

// Connect to Mongo
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('Mongo connection error:', err));

// Models
const User = require('./models/User');
const Attendance = require('./models/Attendance');

// Helpers
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

// Routes
// Signup - create user with password
app.post('/api/signup', async (req,res)=>{
  try{
    const { name, role, password } = req.body;
    if(!name || !role || !password) return res.status(400).json({ error: 'name, role and password required' });
    const existing = await User.findOne({ name });
    if(existing) return res.status(400).json({ error: 'User with that name already exists' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, role, password: hash });
    const token = generateToken(user);
    res.json({ user: { _id: user._id, name: user.name, role: user.role }, token });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Login - check password
app.post('/api/login', async (req,res)=>{
  try{
    const { name, password } = req.body;
    if(!name || !password) return res.status(400).json({ error: 'name and password required' });
    const user = await User.findOne({ name });
    if(!user) return res.status(400).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(400).json({ error: 'Invalid password' });
    const token = generateToken(user);
    res.json({ user: { _id: user._id, name: user.name, role: user.role }, token });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Protected attendance routes require token
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

// Manager: get all attendance (only Project Manager role)
app.get('/api/all-attendance', authMiddleware, async (req,res)=>{
  try{
    if(req.user.role !== 'Project Manager') return res.status(403).json({ error: 'Forbidden' });
    const entries = await Attendance.find().populate('user').sort({ createdAt:-1 });
    res.json({ entries });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Manager: delete attendance by id
app.delete('/api/attendance/:id', authMiddleware, async (req,res)=>{
  try{
    if(req.user.role !== 'Project Manager') return res.status(403).json({ error: 'Forbidden' });
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Manager: list all users
app.get('/api/users', authMiddleware, async (req,res)=>{
  try{
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// Manager: delete user
app.delete('/api/users/:id', authMiddleware, async (req,res)=>{
  try{
    if(req.user.role !== 'Project Manager') return res.status(403).json({ error: 'Forbidden' });
    await User.findByIdAndDelete(req.params.id);
    // also delete their attendance
    await Attendance.deleteMany({ user: req.params.id });
    res.json({ success: true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

// create user (manager can create)
app.post('/api/users', authMiddleware, async (req,res)=>{
  try{
    if(req.user.role !== 'Project Manager') return res.status(403).json({ error: 'Forbidden' });
    const { name, role, password } = req.body;
    if(!name || !role || !password) return res.status(400).json({ error: 'name, role, password required' });
    const existing = await User.findOne({ name }); if(existing) return res.status(400).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password,10);
    const user = await User.create({ name, role, password: hash });
    res.json({ user: { _id: user._id, name: user.name, role: user.role } });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.listen(port, ()=>console.log('Server running on port', port));
