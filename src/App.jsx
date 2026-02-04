import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, 
  updateDoc, deleteDoc, doc, setDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
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

// --- Safe Configuration Handling ---
const defaultFirebaseConfig = {
  apiKey: "demo-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo.appspot.com",
  messagingSenderId: "00000000",
  appId: "demo-app-id"
};

const firebaseConfig = typeof window !== 'undefined' && window.__firebase_config 
  ? JSON.parse(window.__firebase_config) 
  : defaultFirebaseConfig;

const appId = typeof window !== 'undefined' && window.__app_id 
  ? window.__app_id 
  : 'tci-care-main';

let db, auth;
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
db = getFirestore(app);
auth = getAuth(app);

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
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
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
    const requestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'requests');
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
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'requests'), newRequest);
      
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
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', req.id), {
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
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', id));
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
    
    // ตั้งค่าความกว้างของคอลัมน์แบบคร่าวๆ
    const wscols = [
      {wch: 10}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 40}, {wch: 15}, {wch: 40}, {wch: 20}
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `TCI_Care_Report_${selectedMonth + 1}_${new Date().getFullYear()}.xlsx`);
  };

  if (loading) return <div className="p-10 text-center font-bold animate-pulse text-indigo-600">กำลังเชื่อมต่อฐานข้อมูล...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-10 font-sans relative overflow-hidden">
      
      {/* Background Animated Gears (ฟันเฟืองหมุน) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <Cog className="absolute -top-10 -left-10 w-40 h-40 text-indigo-100/50 animate-[spin_10s_linear_infinite]" />
        <Cog className="absolute top-1/4 -right-20 w-64 h-64 text-slate-200/40 animate-[spin_15s_linear_infinite_reverse]" />
        <Cog className="absolute bottom-1/4 -left-16 w-32 h-32 text-indigo-50/60 animate-[spin_8s_linear_infinite]" />
        <Cog className="absolute -bottom-20 right-1/4 w-48 h-48 text-slate-200/50 animate-[spin_12s_linear_infinite]" />
        <Cog className="absolute top-1/2 right-1/3 w-20 h-20 text-indigo-100/30 animate-[spin_6s_linear_infinite_reverse]" />
      </div>

      {/* Modal QR Code */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative text-center animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowQRModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
              <X className="w-5 h-5 text-slate-600"/>
            </button>
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
               <QrCode className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-black mb-1 text-slate-900">Scan to Report</h3>
            <p className="text-slate-400 text-sm mb-6 font-bold uppercase tracking-wider">สแกนเพื่อแจ้งซ่อมทันที</p>
            
            <div className="bg-white p-4 rounded-3xl border-2 border-indigo-50 mb-6 shadow-inner">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(window.location.href)}`} 
                className="mx-auto w-48 h-48" 
                alt="QR Code สำหรับแจ้งซ่อม" 
              />
            </div>

            <div className="flex gap-2">
                <button onClick={handleCopyLink} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                    {copyStatus ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4"/>}
                    {copyStatus ? "Copied!" : "Copy Link"}
                </button>
                <button onClick={() => window.print()} className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                    <Download className="w-4 h-4"/> Print QR
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-slate-100 p-4 flex justify-between items-center px-6 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('user-form')}>
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-xl tracking-tighter block leading-none">TCI CARE</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">IT Support System</span>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setView(view === 'user-form' ? 'admin-login' : 'user-form')} 
                className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
                    view === 'user-form' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
                {view === 'user-form' ? <ShieldCheck className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                {view === 'user-form' ? 'Admin Login' : 'แจ้งซ่อมไอที'}
            </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6 relative z-10">
        {/* User Submission Form */}
        {view === 'user-form' && (
          <div className="max-w-2xl mx-auto space-y-10 py-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-xl border border-indigo-50 mb-4 animate-bounce">
                <Wrench className="w-10 h-10 text-indigo-600" />
              </div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tight">แจ้งซ่อมอุปกรณ์ IT</h1>
              <p className="text-slate-400 text-sm font-black uppercase tracking-[0.4em]">Fast & Efficient Enterprise Support</p>
            </div>

            <form onSubmit={handleSubmitRequest} className="bg-white/80 backdrop-blur-sm p-10 rounded-[3rem] shadow-2xl shadow-indigo-100/50 border border-white space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase ml-2 tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> ชื่อผู้แจ้ง
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder="ระบุชื่อจริง-นามสกุล"
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] p-5 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                    value={formData.requester} 
                    onChange={e => setFormData({...formData, requester: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase ml-2 tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> แผนก (Department)
                  </label>
                  <select 
                    required 
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] p-5 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 appearance-none transition-all font-bold cursor-pointer" 
                    value={formData.department} 
                    onChange={e => setFormData({...formData, department: e.target.value})}
                  >
                    <option value="">เลือกแผนกของคุณ</option>
                    {config.departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase ml-2 tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> หมวดหมู่ปัญหา
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {config.categories.map(cat => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setFormData({...formData, category: cat})}
                            className={`p-4 rounded-2xl text-[11px] font-black border-2 transition-all flex flex-col items-center gap-2 ${
                                formData.category === cat 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase ml-2 tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> อาการที่พบ / สิ่งที่ต้องการให้ทำ
                </label>
                <textarea 
                  required 
                  rows="4" 
                  placeholder="กรุณาอธิบายอาการเสียอย่างละเอียด เพื่อให้ช่างเตรียมอุปกรณ์ได้ถูกต้อง..."
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-[2rem] p-6 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold resize-none" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-slate-200 hover:bg-black hover:-translate-y-1 transition-all flex justify-center items-center gap-3 text-xl active:scale-95 group"
              >
                {isSubmitting ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <><Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"/> ส่งเรื่องแจ้งซ่อม</>
                )}
              </button>
            </form>
            
            <div className="text-center pt-4">
                <div className="inline-flex items-center gap-2 text-slate-300">
                    <div className="h-px w-8 bg-slate-200"></div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">TCI Technology Operation</p>
                    <div className="h-px w-8 bg-slate-200"></div>
                </div>
            </div>
          </div>
        )}

        {/* Admin Login */}
        {view === 'admin-login' && (
          <div className="max-w-sm mx-auto mt-20 bg-white/90 backdrop-blur-md p-10 rounded-[3rem] shadow-2xl text-center border border-white animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black mb-2 text-slate-900 italic">ADMIN SECURE</h2>
            <p className="text-slate-400 text-[10px] font-bold mb-8 uppercase tracking-[0.2em]">Restricted Access Area</p>
            <input 
                type="password" 
                className="w-full bg-slate-50 p-5 rounded-2xl text-center text-3xl mb-5 outline-none border-2 border-slate-100 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/5 transition-all font-black tracking-widest placeholder:tracking-normal placeholder:font-bold" 
                placeholder="••••" 
                onChange={e => setPasswordInput(e.target.value)} 
                onKeyPress={e => e.key === 'Enter' && (passwordInput === ADMIN_PASSWORD ? setView('admin-dashboard') : alert("รหัสผ่านไม่ถูกต้อง"))}
            />
            <button 
                onClick={() => passwordInput === ADMIN_PASSWORD ? setView('admin-dashboard') : alert("รหัสผ่านไม่ถูกต้อง")} 
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-black transition-all shadow-lg shadow-slate-200 active:scale-95 text-sm tracking-widest"
            >
                LOGIN SYSTEM
            </button>
          </div>
        )}

        {/* Admin Dashboard */}
        {view === 'admin-dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Management Dashboard</h2>
                <div className="flex items-center gap-2 mt-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                   <CalendarDays className="w-4 h-4 text-slate-400" />
                   <select className="bg-transparent text-sm font-black text-slate-700 outline-none" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                      {["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"].map((m, i) => <option key={i} value={i}>{m}</option>)}
                   </select>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                <button onClick={exportToExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl text-sm font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all whitespace-nowrap">
                    <FileOutput className="w-4 h-4"/> Export Excel
                </button>
                <button onClick={handleCopyLink} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all whitespace-nowrap">
                    {copyStatus ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4 text-slate-400"/>}
                    {copyStatus ? "Copied!" : "Share Link"}
                </button>
                <button onClick={() => setShowQRModal(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl text-sm font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all whitespace-nowrap">
                    <QrCode className="w-4 h-4"/> Get QR Code
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] shadow-sm border border-white group hover:border-amber-200 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">รอดำเนินการ</p>
                    <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-4xl font-black text-amber-500">{filteredRequests.filter(r => r.status === 'pending').length}</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] shadow-sm border border-white group hover:border-blue-200 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">กำลังแก้ไข</p>
                    <Monitor className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-4xl font-black text-blue-500">{filteredRequests.filter(r => r.status === 'processing').length}</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] shadow-sm border border-white group hover:border-emerald-200 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">เสร็จสมบูรณ์</p>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-4xl font-black text-emerald-500">{filteredRequests.filter(r => r.status === 'completed').length}</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Bar Chart by Department */}
               <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-50 flex flex-col h-[400px]">
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-2 italic uppercase mb-6">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Requests by Department
                  </h3>
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={100} 
                          tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                        />
                        <Tooltip 
                           contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        />
                        <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                          {deptChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {/* Pie Chart by Category */}
               <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-50 flex flex-col h-[400px]">
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-2 italic uppercase mb-6">
                    <PieChart className="w-5 h-5 text-indigo-600" />
                    Problem Categories
                  </h3>
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="45%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartTooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>

            {/* Main Table Content Area */}
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-50 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                <h3 className="font-black text-xl text-slate-900 flex items-center gap-3 italic uppercase tracking-tighter">
                    <ClipboardList className="w-6 h-6 text-indigo-600" />
                    Service Records
                </h3>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full uppercase tracking-widest border border-indigo-100">
                    {filteredRequests.length} TOTAL REQUESTS
                </span>
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
                            <td colSpan="4" className="p-20 text-center text-slate-300 font-black italic text-xl tracking-widest opacity-40">NO DATA FOUND FOR THIS PERIOD</td>
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
                                <div className="animate-in slide-in-from-top-2">
                                    <textarea 
                                        className="w-full p-3 text-xs border border-indigo-100 rounded-2xl bg-indigo-50/30 outline-none focus:border-indigo-400 focus:bg-white transition-all font-bold placeholder:italic" 
                                        placeholder="👉 วิธีการแก้ไขงานนี้..." 
                                        value={tempResolution[req.id] || ""}
                                        onChange={e => setTempResolution({...tempResolution, [req.id]: e.target.value})}
                                    />
                                </div>
                                )}
                                {req.status === 'completed' && req.resolution && (
                                    <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                                        <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Resolved
                                        </p>
                                        <p className="text-[11px] text-emerald-800 font-bold italic">{req.resolution}</p>
                                    </div>
                                )}
                            </td>
                            <td className="p-6 px-8 text-right">
                                <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                                    {req.status === 'pending' && (
                                    <button 
                                        onClick={() => handleUpdateStatus(req, 'processing')} 
                                        className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white hover:scale-110 transition-all shadow-sm"
                                    >
                                        <Monitor className="w-5 h-5"/>
                                    </button>
                                    )}
                                    {req.status === 'processing' && (
                                    <button 
                                        onClick={() => handleUpdateStatus(req, 'completed')} 
                                        className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white hover:scale-110 transition-all shadow-sm"
                                    >
                                        <CheckCircle2 className="w-5 h-5"/>
                                    </button>
                                    )}
                                    <button 
                                        onClick={() => deleteRequest(req.id)} 
                                        className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white hover:scale-110 transition-all shadow-sm"
                                    >
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
      
      {/* Footer Branding */}
      <footer className="max-w-4xl mx-auto px-6 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] pb-10 relative z-10">
        TCI CARE &copy; {new Date().getFullYear()} - Digital Support Ecosystem
      </footer>

      {/* Styles for custom animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

export default App;
