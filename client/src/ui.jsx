import { createContext, useContext, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Inbox, Loader2, Upload } from 'lucide-react';

// Exact color palette extracted from the official EFTS logo
export const LOGO_PALETTE = {
  teal: '#23AAA7',   // Primary teal ("FRIENDLY" & circuits)
  coral: '#FD7B69',  // Coral / salmon ("ECO" & 'E' emblem)
  green: '#3EC4A9',  // Mint / emerald green (Leaf)
  cyan: '#38CACF',   // Cyan circuit highlight
  slate: '#969696',  // Slate gray ("TECH SOLUTIONS")
};

export const LEAD_STATUS_LIST = [
  'New',
  'Contacted',
  'Interested',
  'Follow-up',
  'Qualified',
  'Admission in Progress',
  'Converted',
  'Lost',
  'RNR (Ring No Response)',
  'Busy',
  'Switch Off',
  'Not Reachable',
  'Not Interested',
];

export const getLogoColor = (tone = '', label = '') => {
  const l = (label || '').toLowerCase();
  const t = (tone || '').toLowerCase();
  if (t.includes('green') || l.includes('converted') || l.includes('completed') || l.includes('paid') || l.includes('admission') || l.includes('collected')) {
    return LOGO_PALETTE.green;
  }
  if (t.includes('red') || t.includes('coral') || t.includes('orange') || t.includes('amber') || l.includes('lost') || l.includes('overdue') || l.includes('unassigned') || l.includes('unpaid') || l.includes('due') || l.includes('switch off') || l.includes('busy') || l.includes('rnr') || l.includes('not reachable') || l.includes('not interested')) {
    return LOGO_PALETTE.coral;
  }
  if (t.includes('blue') || l.includes('new') || l.includes('sales')) {
    return LOGO_PALETTE.cyan;
  }
  if (t.includes('gray') || l.includes('pending')) {
    return LOGO_PALETTE.slate;
  }
  return LOGO_PALETTE.teal;
};

const CardSelectionContext = createContext({
  selectedId: null,
  selectCard: () => {},
});

export const CardSelectionProvider = ({ children, initialSelectedId = null }) => {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const selectCard = (id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };
  return (
    <CardSelectionContext.Provider value={{ selectedId, selectCard, setSelectedId }}>
      {children}
    </CardSelectionContext.Provider>
  );
};

export const useCardSelection = () => useContext(CardSelectionContext);

let toastFn = () => {};
export const toast = (msg, type = 'success') => toastFn(msg, type);
export function Toaster() {
  const [items, set] = useState([]);
  useEffect(() => { toastFn = (m, t) => { const id = Math.random(); set((x) => [...x, { id, m, t }]); setTimeout(() => set((x) => x.filter((i) => i.id !== id)), 3800); }; }, []);
  return (
    <div className="fixed right-4 top-4 z-[100] space-y-2">
      {items.map((i) => <div key={i.id} className={`max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${i.t === 'error' ? 'bg-coral-600 text-white' : 'bg-brand-600 text-white'}`}>{i.m}</div>)}
    </div>
  );
}

const TONES = {
  gray: 'bg-gray-100 text-gray-700', blue: 'bg-blue-100 text-blue-700', indigo: 'bg-indigo-100 text-indigo-700', violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-amber-100 text-amber-800', teal: 'bg-brand-100 text-brand-700', orange: 'bg-orange-100 text-orange-700', green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700',
  coral: 'bg-coral-100 text-coral-600',
};
const MAP = {
  New: 'blue', Contacted: 'indigo', Interested: 'violet', 'Follow-up': 'amber', Qualified: 'teal', 'Admission in Progress': 'orange', Converted: 'green', Lost: 'red',
  'RNR (Ring No Response)': 'amber', RNR: 'amber', Busy: 'orange', 'Switch Off': 'gray',
  'Not Reachable': 'orange', 'Not reachable': 'orange', 'Not Interested': 'red', 'Not interested': 'red',
  High: 'red', Medium: 'amber', Low: 'gray', 'To Do': 'gray', 'In Progress': 'blue', Completed: 'green', Cancelled: 'red',
  Pending: 'amber', 'Partially Paid': 'orange', Paid: 'green', Failed: 'red', Refunded: 'gray', Success: 'green', Confirmed: 'green',
  Active: 'green', Inactive: 'red', admin: 'violet', sales: 'blue', superadmin: 'teal', Admitted: 'green', Dropped: 'red', 'Not Started': 'gray',
  Enquiry: 'gray', Counselling: 'blue', Registered: 'indigo', Enrolled: 'teal',
};
export const Badge = ({ children, tone }) => <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone || MAP[children] || 'gray']}`}>{children}</span>;
export const roleLabel = (r) => ({ superadmin: 'Super Admin', admin: 'Admin', sales: 'Sales Executive' }[r] || r);

export const Spinner = () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>;
export const Empty = ({ text = 'Nothing here yet' }) => <div className="flex flex-col items-center gap-2 py-12 text-gray-400"><Inbox className="h-8 w-8" /><p className="text-sm">{text}</p></div>;

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} my-auto max-h-[92vh] flex flex-col shadow-2xl overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-3.5 shrink-0 bg-white">
          <h3 className="font-semibold text-base sm:text-lg truncate pr-2">{title}</h3>
          <button className="icon-btn shrink-0" onClick={onClose} title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
export const Confirm = ({ title = 'Are you sure?', text, onYes, onClose, busy }) => (
  <Modal title={title} onClose={onClose}>
    <p className="text-sm text-gray-600">{text}</p>
    <div className="mt-5 flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-danger" disabled={busy} onClick={onYes}>Confirm</button></div>
  </Modal>
);

export function Pagination({ page, pages, total, onPage }) {
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-gray-500">
      <span>{total} record{total === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-1 sm:gap-2">
        <button className="icon-btn disabled:opacity-30" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></button>
        <span className="whitespace-nowrap">Page {page} / {pages || 1}</span>
        <button className="icon-btn disabled:opacity-30" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function Field({ f, value, onChange, options, disabled }) {
  const common = { className: 'input', value: value ?? '', disabled, required: f.required, onChange: (e) => onChange(e.target.value), placeholder: f.placeholder };
  return (
    <div className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="label mb-0">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
        {f.allowFileUpload && !disabled && (
          <label className="text-[11px] text-brand-600 hover:text-brand-700 cursor-pointer font-medium hover:underline inline-flex items-center gap-1 select-none" title="Upload address text file (.txt, .csv, .doc)">
            <Upload className="h-3 w-3" />
            <span>Upload file</span>
            <input
              type="file"
              accept=".txt,.csv,.json,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  toast('File too large (max 2MB)', 'error');
                  return;
                }
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const text = String(evt.target.result || '').trim();
                  if (text) {
                    onChange(text);
                    toast(`Loaded address from ${file.name}`);
                  }
                };
                reader.onerror = () => toast('Failed to read file', 'error');
                reader.readAsText(file);
              }}
            />
          </label>
        )}
      </div>
      {f.type === 'select' ? (
        <select {...common}><option value="">{f.required ? 'Select…' : '— None —'}</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      ) : f.type === 'textarea' ? <textarea rows={3} {...common} />
      : <input type={f.type === 'datetime' ? 'datetime-local' : f.type || 'text'} min={f.type === 'number' ? 0 : undefined} {...common} />}
      {f.hint && <p className="mt-1 text-xs text-gray-400">{f.hint}</p>}
    </div>
  );
}
export const Card = ({ id, title, icon: Icon, children, className = '', color, index = 0, onClick }) => {
  const { selectedId, selectCard } = useCardSelection();
  const cardId = id || title;
  const isSelected = !!(cardId && selectedId === cardId);
  const matchingColor = color || (index % 2 === 0 ? LOGO_PALETTE.teal : LOGO_PALETTE.coral);

  return (
    <div
      onClick={(e) => {
        if (e.target.closest('button, a, input, select, textarea')) return;
        if (cardId) selectCard(cardId);
        onClick?.(e);
      }}
      className={`card p-4 transition-all duration-300 ${cardId ? 'cursor-pointer hover:shadow-sm' : ''} ${className}`}
      style={{
        borderTop: isSelected ? `4.5px solid ${matchingColor}` : `4px solid ${matchingColor}`,
        boxShadow: isSelected ? `0 4px 14px -2px ${matchingColor}33` : undefined,
      }}
    >
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && (
              <Icon
                className="h-4 w-4 transition-colors duration-300"
                style={{ color: isSelected ? matchingColor : undefined }}
              />
            )}
            <h3
              className="text-sm font-semibold transition-colors duration-300"
              style={{ color: isSelected ? matchingColor : undefined }}
            >
              {title}
            </h3>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export const Stat = ({ id, label, value, icon: Icon, tone, sub, color, index = 0, onClick }) => {
  const { selectedId, selectCard } = useCardSelection();
  const cardId = id || label;
  const isSelected = !!(cardId && selectedId === cardId);
  // Alternate between logo teal/blue (#23AAA7) and logo coral/red (#FD7B69)
  const matchingColor = color || (index % 2 === 0 ? LOGO_PALETTE.teal : LOGO_PALETTE.coral);
  const isTeal = matchingColor === LOGO_PALETTE.teal;
  const defaultTone = tone || (isTeal ? 'bg-brand-50 text-brand-600' : 'bg-coral-50 text-coral-600');

  return (
    <div
      onClick={(e) => {
        if (e.target.closest('button, a, input, select, textarea')) return;
        if (cardId) selectCard(cardId);
        onClick?.(e);
      }}
      className="card flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 cursor-pointer transition-all duration-300 hover:shadow-sm active:scale-[0.99]"
      style={{
        borderTop: isSelected ? `4.5px solid ${matchingColor}` : `4px solid ${matchingColor}`,
        boxShadow: isSelected ? `0 4px 14px -2px ${matchingColor}33` : undefined,
      }}
    >
      {Icon && (
        <div
          className={`rounded-lg p-2 sm:p-2.5 transition-all duration-300 shrink-0 ${isSelected ? 'shadow-sm' : defaultTone}`}
          style={
            isSelected
              ? {
                  backgroundColor: matchingColor,
                  color: '#FFFFFF',
                }
              : undefined
          }
        >
          <Icon
            className="h-4.5 w-4.5 sm:h-5 sm:w-5 transition-colors duration-300"
            style={isSelected ? { color: '#FFFFFF', stroke: '#FFFFFF' } : undefined}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-gray-500">{label}</p>
        <p className="text-lg sm:text-xl font-bold leading-tight truncate text-gray-900">{value}</p>
        {sub && <p className="truncate text-[10px] sm:text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};
export const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDT = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
