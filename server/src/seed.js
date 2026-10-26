import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Team, Course, Lead, Customer, Task, nextSeq } from './models.js';

const COURSES = [['Data Analytics', 25000], ['Data Science', 35000], ['Full Stack Development', 30000], ['Cyber Security', 28000], ['UI/UX Design', 22000], ['Software Testing', 18000], ['Digital Marketing', 15000], ['Robotic Automation', 32000]];
await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eco_crm');
const hash = (p) => bcrypt.hash(p, 12);

for (const [name, fee] of COURSES) await Course.updateOne({ name }, { $setOnInsert: { name, fee, duration: '3 months' } }, { upsert: true });
let sa = await User.findOne({ email: process.env.SEED_EMAIL.toLowerCase() });
if (!sa) sa = await User.create({ name: process.env.SEED_NAME, email: process.env.SEED_EMAIL, role: 'superadmin', passwordHash: await hash(process.env.SEED_PASSWORD), mustChangePassword: false });
console.log(`Super Admin: ${sa.email} / ${process.env.SEED_PASSWORD}`);

if (process.argv.includes('--demo')) {
  const pw = 'Welcome@123';
  const mk = async (name, email, role) => (await User.findOne({ email })) || User.create({ name, email, role, passwordHash: await hash(pw), mustChangePassword: false });
  const admin = await mk('Anitha Admin', 'admin.demo@gmail.com', 'admin');
  const s1 = await mk('Karthik Sales', 'sales1.demo@gmail.com', 'sales');
  const s2 = await mk('Divya Sales', 'sales2.demo@gmail.com', 'sales');
  let team = await Team.findOne({ name: 'Alpha Team' });
  if (!team) team = await Team.create({ name: 'Alpha Team', admin: admin._id, members: [s1._id, s2._id] });
  await User.updateMany({ _id: { $in: [admin._id, s1._id, s2._id] } }, { team: team._id });
  if (!(await Lead.countDocuments())) {
    const courses = await Course.find(); const st = ['New', 'Contacted', 'Interested', 'Follow-up', 'Qualified', 'Converted', 'Lost'];
    for (let i = 0; i < 14; i++) {
      const se = i % 3 === 2 ? null : i % 2 ? s1 : s2;
      await Lead.create({ leadId: 'LD-' + String(await nextSeq('lead')).padStart(5, '0'), name: `Student ${i + 1}`, phone: `98765${String(10000 + i)}`, email: `student${i + 1}@example.com`, course: courses[i % courses.length]._id, source: ['Website', 'Walk-in', 'Referral', 'Social Media'][i % 4], status: st[i % st.length], priority: ['Low', 'Medium', 'High'][i % 3], team: se ? team._id : null, admin: se ? admin._id : null, assignedTo: se?._id || null, createdBy: sa._id, nextFollowUp: new Date(Date.now() + (i - 3) * 864e5) });
    }
    await Task.create({ title: 'Call new enquiries', assignee: s1._id, team: team._id, createdBy: admin._id, dueDate: new Date(Date.now() + 864e5), priority: 'High' });
    await Task.create({ title: 'Follow up overdue leads', assignee: s2._id, team: team._id, createdBy: admin._id, dueDate: new Date(Date.now() - 864e5) });
    await Customer.create({ name: 'Ravi Kumar', phone: '9000000001', email: 'ravi@example.com', owner: s1._id, team: team._id, createdBy: s1._id, course: courses[2]._id, admissionStatus: 'In Progress' });
  }
  console.log(`Demo logins (password ${pw}): admin.demo@gmail.com, sales1.demo@gmail.com, sales2.demo@gmail.com`);
}
await mongoose.disconnect();
