import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { Badge, Modal, Spinner, fmt, inr, toast, Confirm } from '../ui.jsx';
import { Download, Printer, Mail, PlusCircle, ArrowLeft, CheckCircle, Clock, AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { amountToIndianWords } from './NewInvoiceModal.jsx';
import InvoiceHeaderDecoration from '../assets/invoiceHeaderSvg.jsx';
import InvoiceFooterDecoration from '../assets/invoiceFooterSvg.jsx';

export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const staff = user.role !== 'sales';

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState({ recipient: '', subject: '', message: '' });
  const [payOpen, setPayOpen] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [pay, setPay] = useState({
    amount: '',
    method: 'UPI',
    description: '',
    emiNumber: '',
    txnRef: '',
    paymentDate: new Date().toISOString().split('T')[0],
    status: staff ? 'Success' : 'Pending',
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/invoices/${id}`);
      setInv(r.data);
      const custEmail = r.data?.customerEmail || r.data?.customer?.email || r.data?.emailRecipient || '';
      const custName = r.data?.customerName || r.data?.customer?.name || 'Customer';
      setEmail({
        recipient: custEmail,
        subject: `Payment Invoice ${r.data?.invoiceNo} – Eco Friendly Tech Solutions`,
        message: `Dear ${custName},\n\nPlease find attached your payment invoice (${r.data?.invoiceNo}) from Eco Friendly Tech Solutions.\n\nSummary:\n- Invoice No: ${r.data?.invoiceNo}\n- Date: ${new Date(r.data?.invoiceDate || r.data?.createdAt).toLocaleDateString('en-IN')}\n- Total Amount: ₹${Number(r.data?.total || 0).toLocaleString('en-IN')}\n- Amount Paid: ₹${Number(r.data?.paid || 0).toLocaleString('en-IN')}\n- Balance: ₹${Number(r.data?.balance || 0).toLocaleString('en-IN')}\n- Payment Status: ${r.data?.status}\n\nThank you for choosing Eco Friendly Tech Solutions.\n\nWarm regards,\nEco Friendly Tech Solutions\nEducation • Technology • Career Development\nwww.ecofriendlytechsolutions.tech | info@eco-friendly.tech | +91 9043 538 838`,
      });
      const balance = (r.data?.total || 0) - (r.data?.paid || 0);
      setPay((p) => ({
        ...p,
        amount: balance > 0 ? balance : '',
        description: `${r.data?.programName || 'Internship'} – Payment`,
        emiNumber: String((r.data?.paymentRows?.length || 0) + 1),
      }));
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  // Optimized Download PDF button with responsive state
  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(inv?.invoiceNo || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('PDF downloaded successfully');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setDownloading(false);
    }
  };

  // Optimized Print button with responsive state
  const printInvoice = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      // Open inline PDF in print-friendly viewer window
      const res = await api.get(`/invoices/${id}/pdf?inline=true`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.focus();
      } else {
        window.print();
      }
    } catch (e) {
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  // Working Email Invoice button with honest reporting and recipient validation
  const sendEmail = async () => {
    const cleanTo = (email.recipient || '').trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanTo || !emailRegex.test(cleanTo)) {
      toast('Please enter a valid recipient email address (e.g. name@gmail.com)', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await api.post(`/invoices/${id}/send-email`, {
        recipient: cleanTo,
        subject: email.subject,
        message: email.message,
      });
      toast(`Invoice emailed successfully to ${res.data.recipient}!`);
      setEmailOpen(false);
      load();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSending(false);
    }
  };

  // Record Payment
  const recordPayment = async (e) => {
    e.preventDefault();
    if (Number(pay.amount) <= 0) {
      toast('Please enter a valid payment amount', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.post('/payments', {
        invoice: id,
        amount: Number(pay.amount),
        method: pay.method,
        description: pay.description,
        emiNumber: pay.emiNumber,
        txnRef: pay.txnRef,
        paymentDate: pay.paymentDate || undefined,
        status: pay.status,
      });
      toast('Payment recorded successfully');
      setPayOpen(false);
      load();
    } catch (e2) {
      toast(errMsg(e2), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="pt-20 text-center">
        <Spinner />
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="pt-20 text-center text-gray-500">
        <p>Invoice not found or you don't have access.</p>
        <button className="btn btn-ghost mt-4" onClick={() => nav('/invoices')}>
          Back to Invoices
        </button>
      </div>
    );
  }

  const balance = (inv.total || 0) - (inv.paid || 0);
  const customerName = inv.customerName || inv.customer?.name || '—';
  const customerEmail = inv.customerEmail || inv.customer?.email || '—';
  const customerPhone = inv.customerPhone || inv.customer?.phone || '—';
  const programName = inv.programName || inv.course?.name || '—';
  const paymentRows = inv.paymentRows || [];
  const words = inv.amountInWords || amountToIndianWords(inv.total);

  const formatInr = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-IN');
  };

  const displayRows = [];
  if (paymentRows && paymentRows.length > 0) {
    paymentRows.forEach((r, i) => {
      displayRows.push({
        sNo: r.sNo || i + 1,
        description: r.description || `${programName} Internship`,
        date: fmt(r.date || inv.paymentDate || inv.createdAt),
        emiNumber: r.emiNumber || (i + 1),
        amount: formatInr(r.amount),
        txnRef: r.txnRef,
      });
    });
  } else {
    displayRows.push({
      sNo: 1,
      description: `${programName} Internship${inv.mode ? ` (${inv.mode})` : ''}`,
      date: fmt(inv.paymentDate || inv.createdAt),
      emiNumber: 1,
      amount: formatInr(inv.paid || inv.total),
      txnRef: null,
    });
  }

  const minRows = 3;
  const blankRowsCount = Math.max(0, minRows - displayRows.length);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            className="icon-btn text-gray-500 hover:text-gray-900"
            onClick={() => nav('/invoices')}
            title="Back to Invoices"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-gray-900">{inv.invoiceNo}</h1>
              <Badge tone={inv.status === 'Paid' ? 'green' : inv.status === 'Overdue' ? 'red' : 'amber'}>
                {inv.status}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              Payment Invoice • Created {fmt(inv.createdAt)}
            </p>
          </div>
        </div>

        {/* Working Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary flex items-center gap-1.5"
            onClick={downloadPdf}
            disabled={downloading}
            title="Download original invoice PDF"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Download className="h-4 w-4" />}
            {downloading ? 'Downloading…' : 'Download PDF'}
          </button>

          <button
            className="btn btn-secondary flex items-center gap-1.5"
            onClick={printInvoice}
            disabled={printing}
            title="Print invoice"
          >
            {printing ? <Loader2 className="h-4 w-4 animate-spin text-gray-700" /> : <Printer className="h-4 w-4" />}
            {printing ? 'Preparing…' : 'Print'}
          </button>

          <button
            className="btn btn-teal flex items-center gap-1.5"
            onClick={() => setEmailOpen(true)}
            title="Email PDF to Customer"
          >
            <Mail className="h-4 w-4" /> Email Invoice
          </button>

          {staff && balance > 0 && (
            <button
              className="btn btn-ghost flex items-center gap-1.5 border border-gray-300"
              onClick={() => setPayOpen(true)}
              title="Record another payment installment"
            >
              <PlusCircle className="h-4 w-4" /> Record Payment
            </button>
          )}

          {staff && (
            <button
              className="btn btn-ghost flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setDelConfirm(true)}
              title="Delete Invoice"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Email Delivery Status Banner */}
      {inv.emailStatus && inv.emailStatus !== 'Not Sent' && (
        <div
          className={`flex items-center justify-between rounded-xl p-3 text-xs border ${
            inv.emailStatus === 'Sent'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {inv.emailStatus === 'Sent' ? (
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>
              {inv.emailStatus === 'Sent' ? (
                <>Invoice emailed to <strong>{inv.emailRecipient}</strong> on {fmt(inv.emailSentAt)}</>
              ) : (
                <>Email delivery attempt failed: {inv.emailError || 'Unknown error'}</>
              )}
            </span>
          </div>
          <button
            className="text-xs underline font-medium hover:opacity-80"
            onClick={() => setEmailOpen(true)}
          >
            Resend Email
          </button>
        </div>
      )}

      {/* Master PDF Layout Reproduction Document */}
      <div className="bg-white border border-gray-300 shadow-2xl max-w-4xl mx-auto overflow-hidden text-gray-900 font-sans print:border-none print:shadow-none print:m-0">
        {/* Top Geometric Vector Art Banner */}
        <InvoiceHeaderDecoration className="w-full h-auto block" />

        <div className="px-5 sm:px-12 pt-4 pb-8 relative">
          {/* Top Header with Logo and Centered Branding */}
          <div className="relative mb-5 pt-1 min-h-[70px]">
            {/* Top-Left Company Logo */}
            <div className="absolute left-0 top-0">
              <img
                src="/logo.png"
                alt="Eco Friendly Tech Solutions Logo"
                className="h-14 sm:h-16 w-auto object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>

            {/* Centered Document Title */}
            <div className="text-center pt-1">
              <h2 className="text-lg sm:text-2xl font-bold tracking-wide text-gray-900 uppercase">
                ECO FRIENDLY TECH SOLUTIONS
              </h2>
              <h3 className="text-sm sm:text-base font-bold tracking-wider text-gray-900 mt-1 uppercase">
                PAYMENT INVOICE
              </h3>
              <p className="text-[11px] sm:text-xs italic text-gray-600 mt-0.5">
                Education • Technology • Career Development
              </p>
            </div>
          </div>

          {/* 4-Column Metadata Table with Solid Black Borders matching PDF */}
          <table className="w-full border-collapse border border-black text-xs sm:text-[13px] mb-4">
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black px-2.5 py-1.5 font-bold w-[25%] bg-white">Invoice No.</td>
                <td className="border-r border-black px-2.5 py-1.5 font-bold font-mono w-[25%]">{inv.invoiceNo}</td>
                <td className="border-r border-black px-2.5 py-1.5 font-bold w-[25%] bg-white">Invoice Date</td>
                <td className="px-2.5 py-1.5 w-[25%]">{fmt(inv.invoiceDate || inv.createdAt)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black px-2.5 py-1.5 w-[25%]">Customer / Student Name</td>
                <td className="border-r border-black px-2.5 py-1.5 font-bold w-[25%]">{customerName}</td>
                <td className="border-r border-black px-2.5 py-1.5 w-[25%]">Mobile No.</td>
                <td className="px-2.5 py-1.5 w-[25%]">{customerPhone}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black px-2.5 py-1.5 w-[25%]">Program / Internship</td>
                <td className="border-r border-black px-2.5 py-1.5 w-[25%]">{programName}{inv.mode ? ` (${inv.mode})` : ''}</td>
                <td className="border-r border-black px-2.5 py-1.5 w-[25%]">Payment Date</td>
                <td className="px-2.5 py-1.5 w-[25%]">{fmt(inv.paymentDate || inv.createdAt)}</td>
              </tr>
              <tr>
                <td className="border-r border-black px-2.5 py-1.5 w-[25%]">Payment Mode</td>
                <td className="border-r border-black px-2.5 py-1.5 w-[25%]">{inv.paymentMode || inv.method || 'UPI'}</td>
                <td className="border-r border-black px-2.5 py-1.5 w-[25%]">Payment Status</td>
                <td className="px-2.5 py-1.5 font-bold w-[25%] text-teal-800">{inv.status}</td>
              </tr>
            </tbody>
          </table>

          {/* Payment History Table with Central Watermark Symbol in Background */}
          <div className="relative my-4">
            {/* Central Watermark Symbol matching the PDF original */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
              <img
                src="/invoice-watermark.png"
                alt="EFTS Symbol Watermark"
                className="w-[325px] max-w-[65%] h-auto select-none opacity-85"
              />
            </div>

            {/* Table on top of watermark */}
            <table className="w-full border-collapse border border-black text-xs sm:text-[13px] relative z-10 bg-transparent">
              <thead>
                <tr className="border-b border-black bg-gray-100/90 font-bold text-gray-900">
                  <th className="border-r border-black px-2 py-2 text-center w-[10%]">S.No.</th>
                  <th className="border-r border-black px-2.5 py-2 text-left w-[46%]">Description</th>
                  <th className="border-r border-black px-2 py-2 text-center w-[18%]">Date</th>
                  <th className="border-r border-black px-2 py-2 text-center w-[10%]">EMI</th>
                  <th className="px-2.5 py-2 text-right w-[16%]">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, i) => (
                  <tr key={i} className="border-b border-black">
                    <td className="border-r border-black px-2 py-2 text-center font-medium">{r.sNo}</td>
                    <td className="border-r border-black px-2.5 py-2">
                      <p className="font-medium text-gray-900">{r.description}</p>
                      {r.txnRef && <span className="text-[10px] text-gray-500 font-mono">Ref: {r.txnRef}</span>}
                    </td>
                    <td className="border-r border-black px-2 py-2 text-center">{r.date}</td>
                    <td className="border-r border-black px-2 py-2 text-center">{r.emiNumber}</td>
                    <td className="px-2.5 py-2 text-right font-medium">{r.amount}</td>
                  </tr>
                ))}

                {/* Blank underline rows if fewer than 3 rows, matching original PDF */}
                {Array.from({ length: blankRowsCount }).map((_, idx) => (
                  <tr key={`blank-${idx}`} className="border-b border-black text-gray-400">
                    <td className="border-r border-black px-2 py-2 text-center">{displayRows.length + idx + 1}</td>
                    <td className="border-r border-black px-2.5 py-2 tracking-widest text-xs">____________________________________</td>
                    <td className="border-r border-black px-2 py-2 text-center text-xs">________</td>
                    <td className="border-r border-black px-2 py-2 text-center text-xs">____</td>
                    <td className="px-2.5 py-2 text-right text-xs">____________</td>
                  </tr>
                ))}

                {/* Summary Rows matching PDF */}
                <tr className="border-t border-black font-bold">
                  <td colSpan="4" className="border-r border-black px-3 py-1.5 text-gray-900">Total Amount</td>
                  <td className="px-2.5 py-1.5 text-right font-bold whitespace-nowrap">₹ {formatInr(inv.total)}/-</td>
                </tr>
                <tr className="border-t border-black font-bold">
                  <td colSpan="4" className="border-r border-black px-3 py-1.5 text-gray-900">Amount Paid</td>
                  <td className="px-2.5 py-1.5 text-right font-bold whitespace-nowrap text-emerald-800">
                    {balance <= 0 && inv.paid >= inv.total ? 'YES' : `₹ ${formatInr(inv.paid)}/-`}
                  </td>
                </tr>
                <tr className="border-t border-black font-bold">
                  <td colSpan="4" className="border-r border-black px-3 py-1.5 text-gray-900">Balance Amount</td>
                  <td className="px-2.5 py-1.5 text-right font-bold whitespace-nowrap text-red-700">
                    {balance <= 0 && inv.paid >= inv.total ? 'NO' : `₹ ${formatInr(balance)}/-`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="text-xs sm:text-sm my-3 font-sans">
            <strong>Amount in Words: </strong>
            <span className="font-bold text-gray-900">{words}</span>
          </div>

          {/* Terms & Conditions */}
          <div className="text-[11px] sm:text-xs space-y-1 text-gray-800 pt-1">
            <p className="font-bold text-gray-900">Terms & Conditions</p>
            <ul className="list-disc pl-4 space-y-0.5 leading-relaxed text-gray-700">
              <li>This invoice is issued against the payment received by Eco Friendly Tech Solutions.</li>
              <li>All payments are subject to verification and applicable company terms.</li>
              <li>For partial payments, the balance amount must be settled as per the agreed payment schedule.</li>
              <li>Any refund, cancellation, or adjustment will be handled according to the applicable company policy.</li>
              <li>Please retain this invoice as proof of payment.</li>
            </ul>
          </div>

          {/* Centered Thank You */}
          <p className="text-center text-xs font-bold text-gray-900 mt-5 mb-3">
            Thank you for choosing Eco Friendly Tech Solutions.
          </p>

          {/* Contact Bar with Teal Border */}
          <div className="border-t border-teal-500 pt-2 text-center text-[11px] sm:text-xs text-gray-700 font-medium">
            www.ecofriendlytechsolutions.tech | info@eco-friendly.tech | +91 9043 538 838
          </div>
        </div>

        {/* Bottom Geometric Vector Art Banner */}
        <InvoiceFooterDecoration className="w-full h-auto block" />
      </div>

      {/* Email Invoice Modal */}
      {emailOpen && (
        <Modal title="Email Invoice PDF to Customer" onClose={() => setEmailOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Recipient Email <span className="text-red-500">*</span></label>
              <input
                className="input"
                type="email"
                required
                value={email.recipient}
                onChange={(e) => setEmail({ ...email, recipient: e.target.value })}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="label">Subject</label>
              <input
                className="input"
                value={email.subject}
                onChange={(e) => setEmail({ ...email, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Message Body</label>
              <textarea
                className="input"
                rows={6}
                value={email.message}
                onChange={(e) => setEmail({ ...email, message: e.target.value })}
              />
            </div>
            <div className="rounded-lg bg-teal-50 border border-teal-100 p-3 text-xs text-teal-800 flex items-center gap-2">
              <Download className="h-4 w-4 shrink-0 text-teal-600" />
              <span>
                Attachment: <strong>{(inv.invoiceNo || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf</strong> (Master official payment invoice generated with dynamic data)
              </span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEmailOpen(false)}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary flex items-center gap-1.5"
                onClick={sendEmail}
                disabled={sending || !email.recipient?.trim()}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Mail className="h-4 w-4" />}
                {sending ? 'Sending PDF…' : 'Send Invoice Email'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Payment Modal */}
      {payOpen && (
        <Modal title={`Record Payment for ${inv.invoiceNo}`} onClose={() => setPayOpen(false)}>
          <form onSubmit={recordPayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (₹) <span className="text-red-500">*</span></label>
                <input
                  className="input font-bold"
                  type="number"
                  required
                  min="1"
                  max={balance > 0 ? balance : undefined}
                  value={pay.amount}
                  onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                />
                <span className="text-[11px] text-gray-400">Current balance: {inr(balance)}</span>
              </div>
              <div>
                <label className="label">Payment Mode</label>
                <select
                  className="input"
                  value={pay.method}
                  onChange={(e) => setPay({ ...pay, method: e.target.value })}
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">EMI / Installment Number</label>
                <input
                  className="input"
                  value={pay.emiNumber}
                  onChange={(e) => setPay({ ...pay, emiNumber: e.target.value })}
                  placeholder="e.g. 2"
                />
              </div>
              <div>
                <label className="label">Payment Date</label>
                <input
                  className="input"
                  type="date"
                  value={pay.paymentDate}
                  onChange={(e) => setPay({ ...pay, paymentDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={pay.description}
                onChange={(e) => setPay({ ...pay, description: e.target.value })}
                placeholder="e.g. Medical Coding Internship – EMI 2 – Cash"
              />
            </div>

            <div>
              <label className="label">Transaction Reference ID</label>
              <input
                className="input"
                value={pay.txnRef}
                onChange={(e) => setPay({ ...pay, txnRef: e.target.value })}
                placeholder="e.g. UPI/1234567890"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPayOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy || !pay.amount}>
                {busy ? 'Recording…' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {delConfirm && (
        <Confirm
          title="Delete Invoice"
          message={`Are you sure you want to delete invoice ${inv.invoiceNo}? All associated payment records will also be deleted. This action cannot be undone.`}
          onConfirm={async () => {
            try {
              await api.delete(`/invoices/${inv._id}`);
              toast('Invoice deleted successfully');
              nav('/invoices');
            } catch (err) {
              toast(errMsg(err), 'error');
            }
          }}
          onClose={() => setDelConfirm(false)}
        />
      )}
    </div>
  );
}
