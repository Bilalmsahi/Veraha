import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });
import '../models/index.js';

await mongoose.connect(process.env.MONGODB_URI);
const orgs = await mongoose.model('Organization').find({}).lean();
orgs.forEach(o => console.log(o._id, '|', JSON.stringify(o.name), '|', JSON.stringify(o.domain)));
await mongoose.connection.close();
