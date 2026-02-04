import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, 
  updateDoc, deleteDoc, doc, setDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Settings, Wrench, ClipboardList, BarChart3, LogOut, Plus, Trash2, 
  CheckCircle2, Clock, Send, FileSpreadsheet, QrCode, LayoutDashboard,
  ShieldCheck, Monitor, CalendarDays, Cog, MessageSquareQuote, CheckCircle,
  Download, X, Copy, Share2, ExternalLink, FileOutput
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

// --- Updated Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAS_AhigGx0xEYe7rT0OktXp3me27GkIWE",
  authDomain: "tci-service.firebaseapp.com",
  projectId: "tci-service",
  storageBucket: "tci-service.firebasestorage.app",
  messagingSenderId: "788585030674",
  appId: "1:788585030674:web:97ae12402d136b0e1064cb",
  measurementId: "G-8V0G6HZ9JT"
};

const appId = 'tci-care-main';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

// --- Telegram Configuration ---
const TELEGRAM_BOT_TOKEN = "8276580714:AAFTjoyR3y1PuIWU7QWZQ26wJYpa0qUmPsE";
const TELEGRAM_CHAT_ID = "-4991010648";

const ADMIN_PASSWORD = "tci@1234";
const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#06b6d4'];

const DEPARTMENTS_DEFAULT = [
  "Packing", "Purchasing", "Accounting", "Marketing", "Maintenance", 
  "Import/Export", "HR", "Safety", "Filingsoldering", "Stone setting", 
  "Executive secretary", "QA-QC", "Wax", "Waxsetting", "Store inventory"
];
const CATEGORIES_DEFAULT = ["Hardware", "Software", "Network", "Printer", "Other"];

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('user-form'); 
  const [requests, setRequests] = useState([]);
  const [config, setConfig] = useState({ departments: DEPARTMENTS_DEFAULT, categories: CATEGORIES_DEFAULT });
  const [loading, setLoading] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [tempResolution, setTempResolution] = useState({}); 
  const [showQRModal, setShowQRModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);

  const [formData, setFormData] = useState({
    requester: '', department: '', category: 'Hardware', description: '', location: ''
  });

  // Load XLSX via Script for compatibility
  useEffect(() => {
    if (!window.XLSX) {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // --- Telegram Notify Function ---
  const sendTelegramNotification = async (message) => {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      });
    } catch (error) {
      console.error("Telegram notification failed:", error);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { 
        console.error("Auth error:", err); 
      } finally {
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, setUser);
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    // Path สำหรับเก็บข้อมูล requests
    const requestsRef = collection(db, 'requests');
    const unsubscribeReq = onSnapshot(requestsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }, (err) => {
      console.error("Firestore error:", err);
    });
    return () => unsubscribeReq();
  }, [user]);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const d = new Date(req.createdAt);
      return d.getMonth() === parseInt(selectedMonth);
    });
  }, [requests, selectedMonth]);

  // --- Data for Charts ---
  const deptChartData = useMemo(() => {
    const counts = {};
    filteredRequests.forEach(r => {
      counts[r.department] = (counts[r.department] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRequests]);

  const categoryChartData = useMemo(() => {
    const counts = {};
    filteredRequests.forEach(r => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [filteredRequests]);

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.requester || !formData.department || !formData.description) return;
    
    setIsSubmitting(true);
    const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRequest = { 
      ...formData, 
      displayId: shortId,
      status: 'pending', 
      createdAt: Date.now(), 
      updatedAt: Date.now(), 
      userId: user.uid 
    };

    try {
      await addDoc(collection(db, 'requests'), newRequest);
      
      const msg = `⚠️ <b>มีการแจ้งซ่อมใหม่</b>\n\n🆔 รหัสงาน: ${shortId}\n👤 ผู้แจ้ง: ${formData.requester}\n🏢 แผนก: ${formData.department}\n📂 ประเภท: ${formData.category}\n📝 รายละเอียด: ${formData.description}`;
      sendTelegramNotification(msg);

      setFormData({ requester: '', department: '', category: 'Hardware', description: '', location: '' });
      alert("✅ ส่งข้อมูลแจ้งซ่อมเรียบร้อยแล้ว ช่างไอทีจะรีบดำเนินการให้ครับ");
    } catch (err) { 
      alert("Error: " + err.message);
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleUpdateStatus = async (req, newStatus) => {
    if (!user) return;
    const resolutionText = newStatus === 'completed' ? (tempResolution[req.id] || "") : (req.resolution || "");
    
    if (newStatus === 'completed' && !resolutionText.trim()) {
      alert("กรุณาระบุรายละเอียดการแก้ไข (Resolution) ก่อนปิดงาน");
      return;
    }

    try {
      await updateDoc(doc(db, 'requests', req.id), {
        status: newStatus,
        resolution: resolutionText,
        updatedAt: Date.now()
      });

      const statusLabel = newStatus === 'processing' ? '👨‍🔧 กำลังดำเนินการ' : '✅ เสร็จสมบูรณ์';
      let msg = `⚙️ <b>อัปเดตสถานะงาน</b>\n\n🆔 รหัสงาน: ${req.displayId || req.id.substring(0, 6)}\n👤 ผู้แจ้ง: ${req.requester}\n📊 สถานะใหม่: ${statusLabel}`;
      if (newStatus === 'completed') msg += `\n🛠 รายละเอียดการแก้: ${resolutionText}`;
      sendTelegramNotification(msg);

      if(newStatus === 'completed') {
          setTempResolution(prev => {
              const newState = {...prev};
              delete newState[req.id];
              return newState;
          });
      }
    } catch (err) {
      alert("Update failed");
    }
  };

  const deleteRequest = async (id) => {
    if (!user || !window.confirm("ยืนยันการลบรายการนี้?")) return;
    try {
      await deleteDoc(doc(db, 'requests', id));
    } catch (err) {
      alert("Delete failed");
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    const textArea = document.createElement("textarea");
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  // --- Export to Excel Function ---
  const exportToExcel = () => {
    if (!window.XLSX) {
      alert("ระบบ Export กำลังโหลด กรุณาลองอีกครั้งในครู่เดียว");
      return;
    }
    
    if (filteredRequests.length === 0) {
      alert("ไม่มีข้อมูลที่จะส่งออกในเดือนนี้");
      return;
    }

    const exportData = filteredRequests.map(item => ({
      "ID": item.displayId || item.id.substring(0, 6),
      "วันที่แจ้ง": new Date(item.createdAt).toLocaleString('th-TH'),
      "ผู้แจ้ง": item.requester,
      "แผนก": item.department,
      "หมวดหมู่": item.category,
      "รายละเอียด": item.description,
      "สถานะ": item.status === 'pending' ? 'รอดำเนินการ' : item.status === 'processing' ? 'กำลังดำเนินการ' : 'เสร็จสมบูรณ์',
      "วิธีแก้ไข": item.resolution || "-",
      "อัปเดตล่าสุด": new Date(item.updatedAt).toLocaleString('th-TH')
    }));

    const XLSX = window.XLSX;
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ServiceRequests");
    
    const wscols = [
      {wch: 10}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 40}, {wch: 15}, {wch: 40}, {wch: 20}
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `TCI_Care_Report_${selectedMonth + 1}_${new Date().getFullYear()}.xlsx`);
  };

  if (loading) return <div className="p-10 text-center font-bold animate-pulse text-indigo-600">กำลังเชื่อมต่อฐานข้อมูล...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-xl">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-xl tracking-tighter text-slate-900 uppercase italic">TCI CARE</span>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
              <button 
                onClick={() => setView('user-form')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'user-form' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                แจ้งซ่อม
              </button>
              <button 
                onClick={() => setView('admin-login')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${view.includes('admin') ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                จัดการงาน
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {view === 'user-form' && (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-slate-100 overflow-hidden">
              <div className="p-8 sm:p-12">
                <div className="mb-10 text-center">
                  <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight italic uppercase">IT Service Request</h2>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">ระบบแจ้งซ่อมไอทีออนไลน์</p>
                </div>

                <form onSubmit={handleSubmitRequest} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อผู้แจ้ง</label>
                      <input 
                        required
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                        placeholder="ระบุชื่อของคุณ"
                        value={formData.requester}
                        onChange={e => setFormData({...formData, requester: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">แผนก</label>
                      <select 
                        required
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700"
                        value={formData.department}
                        onChange={e => setFormData({...formData, department: e.target.value})}
                      >
                        <option value="">เลือกแผนก</option>
                        {config.departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ประเภทปัญหา</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {config.categories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormData({...formData, category: cat})}
                          className={`py-3 px-4 rounded-xl text-xs font-black transition-all border-2 ${
                            formData.category === cat 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-600' 
                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รายละเอียด</label>
                    <textarea 
                      required
                      rows="4"
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 resize-none"
                      placeholder="อธิบายปัญหาที่พบ..."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <button 
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        <span>ส่งข้อมูลแจ้งซ่อม</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {view === 'admin-login' && (
          <div className="max-w-md mx-auto mt-20 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 text-center">
              <div className="bg-indigo-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <ShieldCheck className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2 italic uppercase">Admin Access</h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-8">กรุณาระบุรหัสผ่านเพื่อเข้าสู่ระบบ</p>
              
              <input 
                type="password"
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-black text-center text-lg tracking-[0.5em] mb-4"
                placeholder="••••"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && passwordInput === ADMIN_PASSWORD && setView('admin-dashboard')}
              />
              
              <button 
                onClick={() => {
                  if (passwordInput === ADMIN_PASSWORD) setView('admin-dashboard');
                  else alert("รหัสผ่านไม่ถูกต้อง");
                }}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-indigo-600 transition-all uppercase tracking-widest text-xs"
              >
                เข้าสู่ระบบ
              </button>
            </div>
          </div>
        )}

        {view === 'admin-dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
            {/* Admin Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div>
                <h2 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter">Control Center</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Dashboard & Request Management</p>
              </div>
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <select 
                  className="flex-1 md:flex-none bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-black text-slate-600 focus:ring-2 focus:ring-indigo-500"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                >
                  {Array.from({length: 12}).map((_, i) => (
                    <option key={i} value={i}>{new Date(0, i).toLocaleString('th-TH', {month: 'long'})}</option>
                  ))}
                </select>
                <button onClick={exportToExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 px-5 py-3 rounded-2xl text-sm font-black hover:bg-emerald-600 hover:text-white transition-all whitespace-nowrap">
                    <FileSpreadsheet className="w-4 h-4"/> Export
                </button>
                <button onClick={() => setView('user-form')} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm font-black hover:bg-indigo-600 transition-all whitespace-nowrap">
                    <LogOut className="w-4 h-4"/> Exit
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">รอดำเนินการ</p>
                    <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-4xl font-black text-amber-500">{filteredRequests.filter(r => r.status === 'pending').length}</p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">กำลังแก้ไข</p>
                    <Monitor className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-4xl font-black text-blue-500">{filteredRequests.filter(r => r.status === 'processing').length}</p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">เสร็จสมบูรณ์</p>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-4xl font-black text-emerald-500">{filteredRequests.filter(r => r.status === 'completed').length}</p>
              </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                <h3 className="font-black text-xl text-slate-900 flex items-center gap-3 italic uppercase tracking-tighter">
                    <ClipboardList className="w-6 h-6 text-indigo-600" />
                    Service Records
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                        <th className="p-4 px-8">STATUS</th>
                        <th className="p-4">REQUESTER INFO</th>
                        <th className="p-4">DESCRIPTION</th>
                        <th className="p-4 px-8 text-right">CONTROLS</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                    {filteredRequests.length === 0 ? (
                        <tr>
                            <td colSpan="4" className="p-20 text-center text-slate-300 font-black italic text-xl tracking-widest opacity-40">NO DATA FOUND</td>
                        </tr>
                    ) : (
                        filteredRequests.map(req => (
                            <tr key={req.id} className="group hover:bg-slate-50/40 transition-colors">
                            <td className="p-6 px-8">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                    req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                    req.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                    'bg-emerald-100 text-emerald-700'
                                }`}>
                                    {req.status === 'pending' ? 'Pending' : req.status === 'processing' ? 'Working' : 'Done'}
                                </span>
                            </td>
                            <td className="p-6">
                                <p className="font-black text-slate-800 text-base leading-none mb-1">{req.requester}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{req.department} • {req.category}</p>
                            </td>
                            <td className="p-6 max-w-xs">
                                <p className="text-sm font-bold text-slate-600 line-clamp-2 mb-2 leading-relaxed">{req.description}</p>
                                {req.status === 'processing' && (
                                    <textarea 
                                        className="w-full p-3 text-xs border border-indigo-100 rounded-2xl bg-indigo-50/30 outline-none focus:border-indigo-400 focus:bg-white transition-all font-bold" 
                                        placeholder="วิธีการแก้ไข..." 
                                        value={tempResolution[req.id] || ""}
                                        onChange={e => setTempResolution({...tempResolution, [req.id]: e.target.value})}
                                    />
                                )}
                                {req.status === 'completed' && req.resolution && (
                                    <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                                        <p className="text-[11px] text-emerald-800 font-bold italic">{req.resolution}</p>
                                    </div>
                                )}
                            </td>
                            <td className="p-6 px-8 text-right">
                                <div className="flex justify-end gap-2">
                                    {req.status === 'pending' && (
                                    <button onClick={() => handleUpdateStatus(req, 'processing')} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                                        <Monitor className="w-5 h-5"/>
                                    </button>
                                    )}
                                    {req.status === 'processing' && (
                                    <button onClick={() => handleUpdateStatus(req, 'completed')} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all">
                                        <CheckCircle2 className="w-5 h-5"/>
                                    </button>
                                    )}
                                    <button onClick={() => deleteRequest(req.id)} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all">
                                        <Trash2 className="w-5 h-5"/>
                                    </button>
                                </div>
                            </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="max-w-4xl mx-auto px-6 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] pb-10">
        TCI CARE &copy; {new Date().getFullYear()} - Digital Support Ecosystem
      </footer>
    </div>
  );
};

export default App;
