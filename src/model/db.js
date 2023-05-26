import config from 'config'
import mongoose from 'mongoose';

const CONNECTION =
  config.get("CONNECTION") || 'mongodb://127.0.0.1:27017/WorkflowTools';

const connection = mongoose.connect(CONNECTION, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

export default connection