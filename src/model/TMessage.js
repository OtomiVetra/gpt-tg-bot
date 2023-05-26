import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// 1) user написал в tg
// 2) tg написал chatGPT (ошибка ?)
// 3) tg написал user'у

const MessageSchema = new Schema({
  user_id: Number,
  media_type: String, // text | voice
  file_info: Schema.Types.Mixed,
  message: String,
  reply: String,
  error: Schema.Types.Mixed
}, { timeseries: true });

const model = mongoose.model('Message', MessageSchema, 'telegram_messages');

export default model;