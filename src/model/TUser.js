import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  username: String,
  telegram_id: Number,
  role: {
    type: String,
    default: 'guest' // admin | guest | user
  },
  access_timestamp: Number
}, { timeseries: true });

const model = mongoose.model('TUser', UserSchema, 'telegram_users');

export default model;