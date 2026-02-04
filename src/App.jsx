import React, { useState } from 'react';
import { 
  Wrench, 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  User, 
  LogOut, 
  ChevronRight,
  AlertCircle,
  Building2,
  Phone,
  LayoutDashboard
} from 'lucide-react';

// --- Components ---

const Navbar = ({ activeTab, setActiveTab }) => (
  <nav className="bg-blue-700 text-white shadow-lg sticky top-0 z-50">
    <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <Wrench size={24} />
        <span className="font-bold text-xl tracking-tight">TCI CARE v2</span>
      </div>
      <div className="flex space-x-4">
        <button onClick={() => setActiveTab('request')} className={`p-2 rounded-full ${activeTab === 'request' ? 'bg-blue-600' : 'hover:bg-blue-600/50'}`}>
          <PlusCircle size={24} />
        </button>
        <button onClick={() => setActiveTab('history')} className={`p-2 rounded-full ${activeTab === 'history' ? 'bg-blue-600' : 'hover:bg-blue-600/50'}`}>
          <ClipboardList size={24} />
        </button>
      </div>
    </div>
  </nav>
);

const RequestForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    description: '',
    urgency: 'ปกติ',
    contact: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, id: Date.now(), status: 'รอดำเนินการ', date: new Date().toLocaleDateString('th-TH') });
    setFormData({ title: '', location: '', description: '', urgency: 'ปกติ', contact: '' });
  };

  return (
    <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
      <h2 className="text-xl font-bold mb-4 flex items-center text-slate-800">
        <PlusCircle className="mr-2 text-blue-600" size={24} />
        แจ้งซ่อม/แจ้งปัญหา
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">หัวข้อปัญหา</label>
          <input 
            required
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="เช่น ไฟทางเดินเสีย, ก๊อกน้ำรั่ว"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">สถานที่/ตึก</label>
            <input 
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="ตึก A ชั้น 2"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ความเร่งด่วน</label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.urgency}
              onChange={(e) => setFormData({...formData, urgency: e.target.value})}
            >
              <option>ปกติ</option>
              <option>ด่วน</option>
              <option>ด่วนมาก</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">รายละเอียดเพิ่มเติม</label>
          <textarea 
            rows="3"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="ระบุรายละเอียดอาการเสีย..."
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          ></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">เบอร์โทรติดต่อ</label>
          <input 
            required
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="08X-XXXXXXX"
            value={formData.contact}
            onChange={(e) => setFormData({...formData, contact: e.target.value})}
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-colors flex justify-center items-center">
          <CheckCircle2 className="mr-2" /> ส่งข้อมูลแจ้งซ่อม
        </button>
      </form>
    </div>
  );
};

const HistoryList = ({ jobs }) => (
  <div className="space-y-4">
    <h2 className="text-xl font-bold p-2 flex items-center text-slate-800">
      <ClipboardList className="mr-2 text-blue-600" size={24} />
      ประวัติการแจ้งซ่อม ({jobs.length})
    </h2>
    {jobs.length === 0 ? (
      <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
        <AlertCircle size={48} className="mx-auto text-slate-300 mb-2" />
        <p className="text-slate-500">ยังไม่มีประวัติการแจ้งซ่อม</p>
      </div>
    ) : (
      jobs.map(job => (
        <div key={job.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-blue-200 transition-all cursor-pointer">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                job.urgency === 'ด่วนมาก' ? 'bg-red-100 text-red-600' : 
                job.urgency === 'ด่วน' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {job.urgency}
              </span>
              <span className="text-xs text-slate-400">{job.date}</span>
            </div>
            <h3 className="font-bold text-slate-800">{job.title}</h3>
            <div className="flex items-center text-xs text-slate-500 mt-1">
              <Building2 size={12} className="mr-1" /> {job.location}
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-xs px-3 py-1 bg-amber-50 text-amber-600 rounded-full font-medium border border-amber-100 mb-2">
              {job.status}
            </span>
            <ChevronRight size={20} className="text-slate-300" />
          </div>
        </div>
      ))
    )}
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('request');
  const [jobs, setJobs] = useState([]);
  const [showToast, setShowToast] = useState(false);

  const addJob = (newJob) => {
    setJobs([newJob, ...jobs]);
    setShowToast(true);
    setTimeout(() => {
        setShowToast(false);
        setActiveTab('history');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-xl mx-auto p-4 mt-2">
        {activeTab === 'request' ? (
          <RequestForm onSubmit={addJob} />
        ) : (
          <HistoryList jobs={jobs} />
        )}
      </main>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 animate-bounce z-50">
          <CheckCircle2 size={20} />
          <span>ส่งข้อมูลแจ้งซ่อมสำเร็จ!</span>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-2 flex justify-around items-center md:hidden">
        <button onClick={() => setActiveTab('request')} className={`flex flex-col items-center ${activeTab === 'request' ? 'text-blue-600' : 'text-slate-400'}`}>
          <PlusCircle size={20} />
          <span className="text-[10px] mt-1 font-medium">แจ้งซ่อม</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-400'}`}>
          <ClipboardList size={20} />
          <span className="text-[10px] mt-1 font-medium">รายการ</span>
        </button>
      </div>
    </div>
  );
}
