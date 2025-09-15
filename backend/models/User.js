
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, required: true, unique: true },
  role: { type: String, required: true },
  password: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  bio: { type: String },
  avatar: { type: String },
  resetToken: { type: String },
  resetTokenExpiry: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
