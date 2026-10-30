import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import { Badge, Spinner, fmt, inr, toast } from '../ui.jsx';
import { X, Plus, Trash2, RefreshCw, Calendar, CreditCard, User, BookOpen, FileText, CheckCircle2, Globe, Building2, Tag, Percent } from 'lucide-react';

export function amountToIndianWords(num) {
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'Zero Only';
  if (num < 0) return 'Minus ' + amountToIndianWords(Math.abs(num));

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n === 0) return '';
    if (n < 20) return a[n];
    const tens = b[Math.floor(n / 10)];
    const ones = a[n % 10];
    return tens + (ones ? ' ' + ones : '');
  }

  function convertThreeDigits(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) res += a[hundred] + ' Hundred';
    if (rest > 0) res += (res ? ' ' : '') + convertTwoDigits(rest);
    return res;
  }

  let words = '';
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundredAndRest = num;

  if (crore > 0) words += (words ? ' ' : '') + convertThreeDigits(crore) + ' Crore';
  if (lakh > 0) words += (words ? ' ' : '') + convertThreeDigits(lakh) + ' Lakh';
  if (thousand > 0) words += (words ? ' ' : '') + convertThreeDigits(thousand) + ' Thousand';
  if (hundredAndRest > 0) words += (words ? ' ' : '') + convertThreeDigits(hundredAndRest);

  return (words.trim() + ' Only').replace(/\s+/g, ' ');
}

export function resolveInitialPrice(inv) {
  if (!inv) return 20000;
  if (inv.unitPrice != null && Number(inv.unitPrice) > 0) {
    return Number(inv.unitPrice);
  }
  if (inv.total != null && Number(inv.total) > 0) {
    return Number(inv.total);
  }
  if (inv.totalInternshipFee != null && Number(inv.totalInternshipFee) > 0) {
    return Number(inv.totalInternshipFee);
  }
  if (Array.isArray(inv.paymentRows) && inv.paymentRows.length > 0) {
    const sum = inv.paymentRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    if (sum > 0) return sum;
  }
  return inv.mode === 'Offline' ? 30000 : 20000;
}

const PAYMENT_MODES = ['UPI', 'Cash', 'Bank Transfer', 'Card', 'Other'];
const PAYMENT_PLANS = ['One-Time Payment', 'Monthly EMI', 'Custom Installments'];
const PAYMENT_STATUSES = ['Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];

export default function NewInvoiceModal({ onClose, onSuccess, initialInvoice = null }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const { customers, courses } = useLookups();

  const isEdit = Boolean(initialInvoice && initialInvoice._id);
  const canEdit = user?.role === 'superadmin' || user?.role === 'admin';

  useEffect(() => {
    if (isEdit && !canEdit) {
      toast('You do not have permission to edit invoices', 'error');
      onClose();
    }
  }, [isEdit, canEdit, onClose]);

  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'preview'
  const [loadingNumber, setLoadingNumber] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState(
    initialInvoice?.customer?._id || (typeof initialInvoice?.customer === 'string' ? initialInvoice.customer : '')
  );
  const [isManualCustomer, setIsManualCustomer] = useState(
    Boolean(initialInvoice?.customerName && !initialInvoice?.customer)
  );
  const [customerInfo, setCustomerInfo] = useState(null);

  // Itemized Pricing & Calculations
  const [quantity, setQuantity] = useState(() => {
    return initialInvoice?.quantity != null && Number(initialInvoice.quantity) > 0
      ? Number(initialInvoice.quantity)
      : 1;
  });
  const [unitPrice, setUnitPrice] = useState(() => resolveInitialPrice(initialInvoice));
  const [discount, setDiscount] = useState(() => {
    return initialInvoice?.discount != null ? Number(initialInvoice.discount) : 0;
  });
  const [taxRate, setTaxRate] = useState(() => {
    return initialInvoice?.taxRate != null ? Number(initialInvoice.taxRate) : 0;
  });

  const [formData, setFormData] = useState({
    invoiceNo: initialInvoice?.invoiceNo || '',
    invoiceDate: initialInvoice?.invoiceDate
      ? new Date(initialInvoice.invoiceDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    dueDate: initialInvoice?.dueDate
      ? new Date(initialInvoice.dueDate).toISOString().split('T')[0]
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentDate: initialInvoice?.paymentDate
      ? new Date(initialInvoice.paymentDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    customerName: initialInvoice?.customerName || initialInvoice?.customer?.name || '',
    customerEmail: initialInvoice?.customerEmail || initialInvoice?.customer?.email || '',
    customerPhone: initialInvoice?.customerPhone || initialInvoice?.customer?.phone || '',
    courseId: initialInvoice?.course?._id || (typeof initialInvoice?.course === 'string' ? initialInvoice.course : ''),
    admissionId: initialInvoice?.admission?._id || (typeof initialInvoice?.admission === 'string' ? initialInvoice.admission : ''),
    programName: initialInvoice?.programName || initialInvoice?.course?.name || '',
    mode: initialInvoice?.mode || 'Online',
    registrationFee: initialInvoice?.registrationFee != null
      ? Number(initialInvoice.registrationFee)
      : (initialInvoice?.mode === 'Offline' ? 3000 : 2000),
    total: resolveInitialPrice(initialInvoice),
    description: initialInvoice?.description || '',
    paymentMode: initialInvoice?.paymentMode || 'UPI',
    paymentPlan: initialInvoice?.paymentPlan || 'One-Time Payment',
    totalInstallments: initialInvoice?.totalInstallments != null ? Number(initialInvoice.totalInstallments) : 1,
    statusOverride: initialInvoice?.status || '',
    notes: initialInvoice?.notes || '',
  });

  // Dynamic payment rows
  const [paymentRows, setPaymentRows] = useState(() => {
    if (initialInvoice?.paymentRows && initialInvoice.paymentRows.length > 0) {
      return initialInvoice.paymentRows.map((r, i) => ({
        id: r._id || Date.now() + i,
        paymentId: r.paymentId || r._id,
        sNo: r.sNo || i + 1,
        description: r.description || `${initialInvoice.programName || 'Internship'} – EMI ${r.emiNumber || (i + 1)}`,
        date: r.date ? new Date(r.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        emiNumber: String(r.emiNumber || (i + 1)),
        mode: r.mode || initialInvoice.paymentMode || 'UPI',
        amount: Number(r.amount) || 0,
        status: r.status || 'Paid',
        txnRef: r.txnRef || '',
      }));
    }
    return [
      {
        id: 1,
        sNo: 1,
        description: 'Internship Program – Registration (Online)',
        date: new Date().toISOString().split('T')[0],
        emiNumber: '1',
        mode: 'UPI',
        amount: 2000,
        status: 'Paid',
        txnRef: '',
      },
    ];
  });

  // Sequential invoice number (only for new invoices)
  const fetchInvoiceNumber = async () => {
    if (isEdit) return;
    setLoadingNumber(true);
    try {
      const res = await api.get('/invoices/next-number');
      if (res.data?.invoiceNo) {
        setFormData((prev) => ({ ...prev, invoiceNo: res.data.invoiceNo }));
      }
    } catch (e) {
      const yr = new Date().getFullYear();
      const initial = yr === 2026 ? '030' : '001';
      setFormData((prev) => ({ ...prev, invoiceNo: `EFTS-INV-/${yr}-${initial}` }));
    } finally {
      setLoadingNumber(false);
    }
  };

  useEffect(() => {
    if (!isEdit) {
      fetchInvoiceNumber();
    } else if (initialInvoice?._id) {
      // Refresh full invoice in case some fields weren't in table row
      api.get(`/invoices/${initialInvoice._id}`).then((res) => {
        const inv = res.data;
        if (inv) {
          if (inv.paymentRows && inv.paymentRows.length > 0) {
            setPaymentRows(
              inv.paymentRows.map((r, i) => ({
                id: r._id || Date.now() + i,
                paymentId: r.paymentId || r._id,
                sNo: r.sNo || i + 1,
                description: r.description || '',
                date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
                emiNumber: String(r.emiNumber || (i + 1)),
                mode: r.mode || 'UPI',
                amount: Number(r.amount) || 0,
                status: r.status || 'Paid',
                txnRef: r.txnRef || '',
              }))
            );
          }
          if (inv.quantity != null && Number(inv.quantity) > 0) {
            setQuantity(Number(inv.quantity));
          }
          const price = resolveInitialPrice(inv);
          if (price > 0) {
            setUnitPrice(price);
          }
          if (inv.discount != null && Number(inv.discount) >= 0) {
            setDiscount(Number(inv.discount));
          }
          if (inv.taxRate != null && Number(inv.taxRate) >= 0) {
            setTaxRate(Number(inv.taxRate));
          }
          setFormData((prev) => ({
            ...prev,
            invoiceNo: inv.invoiceNo || prev.invoiceNo,
            customerName: inv.customerName || inv.customer?.name || prev.customerName,
            customerEmail: inv.customerEmail || inv.customer?.email || prev.customerEmail,
            customerPhone: inv.customerPhone || inv.customer?.phone || prev.customerPhone,
            programName: inv.programName || inv.course?.name || prev.programName,
            mode: inv.mode || prev.mode || 'Online',
            description: inv.description || prev.description,
            paymentMode: inv.paymentMode || prev.paymentMode,
            paymentPlan: inv.paymentPlan || prev.paymentPlan,
            totalInstallments: inv.totalInstallments || prev.totalInstallments,
            registrationFee: inv.registrationFee != null ? Number(inv.registrationFee) : prev.registrationFee,
            total: price > 0 ? price : prev.total,
            notes: inv.notes || prev.notes,
          }));
        }
      }).catch((e) => console.warn('Failed to load invoice fresh details:', e.message));
    }
  }, [isEdit, initialInvoice?._id]);

  // Online / Offline Mode Switcher
  const handleModeSelect = (newMode) => {
    const isOnline = newMode === 'Online';
    const totalFee = isOnline ? 20000 : 30000;
    const regFee = isOnline ? 2000 : 3000;
    const progName = formData.programName || 'Internship Program';
    const desc = `${progName} – Registration (${newMode})`;

    setUnitPrice(totalFee);
    setQuantity(1);
    setDiscount(0);
    setTaxRate(0);

    setFormData((prev) => ({
      ...prev,
      mode: newMode,
      total: totalFee,
      registrationFee: regFee,
      description: desc,
    }));

    setPaymentRows((prev) => {
      if (!prev || prev.length === 0) {
        return [
          {
            id: 1,
            sNo: 1,
            description: desc,
            date: formData.paymentDate || new Date().toISOString().split('T')[0],
            emiNumber: '1',
            mode: formData.paymentMode || 'UPI',
            amount: regFee,
            status: 'Paid',
            txnRef: '',
          },
        ];
      }
      return prev.map((r, i) =>
        i === 0
          ? {
              ...r,
              description: desc,
              amount: regFee,
              status: 'Paid',
            }
          : r
      );
    });
  };

  // Customer autofill
  const handleCustomerChange = async (customerId) => {
    setSelectedCustomer(customerId);
    if (!customerId) {
      setCustomerInfo(null);
      return;
    }

    setLoadingCustomer(true);
    try {
      const res = await api.get(`/invoices/customer-info/${customerId}`);
      const d = res.data;
      setCustomerInfo(d);

      const progName = d.programName || (courses.find((c) => c._id === d.course?._id)?.name) || '';
      const mode = d.admission?.mode === 'Offline' ? 'Offline' : (formData.mode || 'Online');
      const isOnline = mode === 'Online';
      const totalFee = isOnline ? 20000 : 30000;
      const regFee = isOnline ? 2000 : 3000;
      const desc = `${progName || 'Internship'} – Registration (${mode})`;

      setUnitPrice(totalFee);
      setQuantity(1);
      setDiscount(0);
      setTaxRate(0);

      setFormData((prev) => ({
        ...prev,
        customerName: d.customer.name || '',
        customerEmail: d.customer.email || '',
        customerPhone: d.customer.phone || '',
        courseId: d.course?._id || prev.courseId,
        admissionId: d.admission?._id || '',
        programName: progName,
        mode,
        total: totalFee,
        registrationFee: regFee,
        description: desc,
      }));

      if (!isEdit) {
        setPaymentRows([
          {
            id: 1,
            sNo: 1,
            description: desc,
            date: new Date().toISOString().split('T')[0],
            emiNumber: '1',
            mode: formData.paymentMode || 'UPI',
            amount: regFee,
            status: 'Paid',
            txnRef: '',
          },
        ]);
      }
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLoadingCustomer(false);
    }
  };

  // Program / Course change
  const handleCourseChange = (courseId) => {
    const found = courses.find((c) => c._id === courseId);
    if (found) {
      const progName = found.name;
      const isOnline = formData.mode === 'Online';
      const fee = found.fee || (isOnline ? 20000 : 30000);
      const reg = isOnline ? 2000 : 3000;
      const desc = `${progName} – Registration (${formData.mode})`;

      setUnitPrice(fee);
      setQuantity(1);
      setDiscount(0);
      setTaxRate(0);

      setFormData((prev) => ({
        ...prev,
        courseId,
        programName: progName,
        total: fee,
        registrationFee: reg,
        description: desc,
      }));

      setPaymentRows((prev) =>
        prev.map((r, i) => (i === 0 ? { ...r, description: desc, amount: reg } : r))
      );
    } else {
      setFormData((prev) => ({ ...prev, courseId }));
    }
  };

  // Calculations
  const qtyNum = Math.max(1, Number(quantity) || 1);
  const unitPriceNum = Math.max(0, Number(unitPrice) || 0);
  const subtotal = Math.round(qtyNum * unitPriceNum);
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const discountRate = subtotal > 0 ? Math.round((discountAmount / subtotal) * 100) : 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxRateNum = Math.max(0, Number(taxRate) || 0);
  const taxAmount = Math.round(taxableAmount * (taxRateNum / 100));
  const calculatedGrandTotal = Math.max(0, taxableAmount + taxAmount);
  const totalAmount = calculatedGrandTotal > 0 ? calculatedGrandTotal : (unitPriceNum > 0 ? unitPriceNum : 0);

  // Auto-generate EMI schedule when Monthly EMI selected or installments changed
  const generateEmiSchedule = (installmentsCount, totalFee, pMode, prog) => {
    const count = Math.max(1, parseInt(installmentsCount) || 2);
    const pName = prog || formData.programName || 'Internship';
    const mode = pMode || formData.paymentMode || 'UPI';
    const isOnline = formData.mode === 'Online';
    const regFee = isOnline ? 2000 : 3000;
    const effectiveFee = Number(totalFee) || totalAmount || 20000;
    const remainingToSplit = Math.max(0, effectiveFee - regFee);
    const amountPerRemaining = count > 1 ? Math.round(remainingToSplit / (count - 1)) : 0;

    const startDate = formData.paymentDate ? new Date(formData.paymentDate) : new Date();

    const newRows = [];
    // Installment 1: Registration Fee
    newRows.push({
      id: Date.now() + 1,
      sNo: 1,
      description: `${pName} Internship – Registration / EMI 1 (${formData.mode})`,
      date: startDate.toISOString().split('T')[0],
      emiNumber: '1',
      mode,
      amount: regFee,
      status: 'Paid',
      txnRef: '',
    });

    // Installments 2..N: Remaining split
    for (let i = 2; i <= count; i++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + (i - 1));
      newRows.push({
        id: Date.now() + i,
        sNo: i,
        description: `${pName} Internship – EMI ${i} (${formData.mode})`,
        date: d.toISOString().split('T')[0],
        emiNumber: String(i),
        mode,
        amount: amountPerRemaining,
        status: 'Pending',
        txnRef: '',
      });
    }
    setPaymentRows(newRows);
  };

  const totalReceived = useMemo(() => {
    return paymentRows.reduce((acc, row) => {
      const amt = Number(row.amount) || 0;
      const isPaid = row.status === 'Paid' || row.status === 'Success';
      return acc + (isPaid ? amt : 0);
    }, 0);
  }, [paymentRows]);

  const outstandingBalance = Math.max(0, totalAmount - totalReceived);

  const paidInstallmentsCount = useMemo(() => {
    return paymentRows.filter((r) => (r.status === 'Paid' || r.status === 'Success') && Number(r.amount) > 0).length;
  }, [paymentRows]);

  const remainingInstallmentsCount = Math.max(0, paymentRows.length - paidInstallmentsCount);

  // Derived payment status
  const calculatedStatus = useMemo(() => {
    if (formData.statusOverride) return formData.statusOverride;
    if (totalReceived >= totalAmount && totalAmount > 0) return 'Paid';
    if (totalReceived > 0 && totalReceived < totalAmount) return 'Partially Paid';
    const isPastDue = formData.dueDate && new Date(formData.dueDate) < new Date();
    if (isPastDue) return 'Overdue';
    return 'Pending';
  }, [totalReceived, totalAmount, formData.dueDate, formData.statusOverride]);

  const amountInWords = useMemo(() => {
    return amountToIndianWords(totalAmount);
  }, [totalAmount]);

  // Payment row actions
  const addPaymentRow = () => {
    const nextIdx = paymentRows.length + 1;
    const pName = formData.programName || 'Internship';
    const mode = formData.paymentMode || 'UPI';
    const lastDate = paymentRows[paymentRows.length - 1]?.date;
    const nextDate = lastDate ? new Date(lastDate) : new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);

    setPaymentRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        sNo: nextIdx,
        description: `${pName} Internship – EMI ${nextIdx} (${formData.mode})`,
        date: nextDate.toISOString().split('T')[0],
        emiNumber: String(nextIdx),
        mode,
        amount: outstandingBalance > 0 ? outstandingBalance : '',
        status: 'Pending',
        txnRef: '',
      },
    ]);
  };

  const removePaymentRow = (id) => {
    if (paymentRows.length <= 1) {
      toast('At least one payment row is required', 'error');
      return;
    }
    setPaymentRows((prev) => prev.filter((r) => r.id !== id).map((r, i) => ({ ...r, sNo: i + 1 })));
  };

  const updatePaymentRow = (id, field, value) => {
    setPaymentRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Submit invoice (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (isEdit && !canEdit) {
      toast('You do not have permission to edit invoices', 'error');
      return;
    }

    if (!formData.customerName?.trim()) {
      toast('Please enter or select a customer name', 'error');
      return;
    }

    let finalTotal = totalAmount;
    if (finalTotal <= 0 && unitPriceNum > 0) {
      finalTotal = unitPriceNum;
    }
    if (finalTotal <= 0 && Number(formData.total) > 0) {
      finalTotal = Number(formData.total);
    }
    if (finalTotal <= 0 && totalReceived > 0) {
      finalTotal = totalReceived;
    }

    if (finalTotal <= 0) {
      toast('Total invoice amount must be greater than zero. Please enter a valid fee.', 'error');
      return;
    }

    if (totalReceived > finalTotal) {
      toast(`Amount received (₹${totalReceived}) exceeds invoice total (₹${finalTotal})`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const cleanCustomerId = selectedCustomer && selectedCustomer !== 'manual' && selectedCustomer.length === 24
        ? selectedCustomer
        : undefined;
      const cleanCourseId = formData.courseId && formData.courseId.length === 24
        ? formData.courseId
        : undefined;
      const cleanAdmissionId = formData.admissionId && formData.admissionId.length === 24
        ? formData.admissionId
        : undefined;

      const payload = {
        invoiceNo: formData.invoiceNo || undefined,
        customer: cleanCustomerId,
        customerName: formData.customerName.trim(),
        customerEmail: formData.customerEmail?.trim() || undefined,
        customerPhone: formData.customerPhone?.trim() || undefined,
        course: cleanCourseId,
        admission: cleanAdmissionId,
        programName: formData.programName || undefined,
        mode: formData.mode || 'Online',
        description: formData.description || undefined,
        quantity: qtyNum,
        unitPrice: unitPriceNum > 0 ? unitPriceNum : finalTotal,
        subtotal: subtotal > 0 ? subtotal : finalTotal,
        discount: discountAmount,
        discountRate,
        tax: taxAmount,
        taxRate: taxRateNum,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate,
        paymentDate: formData.paymentDate,
        paymentMode: formData.paymentMode,
        paymentPlan: formData.paymentPlan,
        totalInstallments: Number(formData.totalInstallments) || paymentRows.length,
        registrationFee: Number(formData.registrationFee) || (formData.mode === 'Offline' ? 3000 : 2000),
        totalInternshipFee: finalTotal,
        total: finalTotal,
        paid: totalReceived,
        balance: Math.max(0, finalTotal - totalReceived),
        status: calculatedStatus,
        amountInWords: amountToIndianWords(finalTotal),
        notes: formData.notes,
        paymentRows: paymentRows.map((r, i) => ({
          sNo: i + 1,
          description: r.description || `${formData.programName || 'Internship'} – EMI ${r.emiNumber || (i + 1)}`,
          date: r.date,
          emiNumber: r.emiNumber || String(i + 1),
          mode: r.mode || formData.paymentMode,
          amount: Number(r.amount) || 0,
          status: r.status,
          txnRef: r.txnRef,
          paymentId: r.paymentId,
        })),
      };

      if (isEdit) {
        const res = await api.put(`/invoices/${initialInvoice._id}`, payload);
        toast('Invoice updated successfully!');
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        const res = await api.post('/invoices', payload);
        toast('Invoice and payment records saved successfully!');
        if (onSuccess) onSuccess(res.data);
        onClose();
        nav(`/invoices/${res.data._id}`);
      }
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="card w-full max-w-5xl my-auto max-h-[94vh] flex flex-col shadow-2xl overflow-hidden bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isEdit ? 'Edit Payment Invoice' : 'New Payment Invoice'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEdit
                  ? `Editing ${formData.invoiceNo} • Eco Friendly Tech Solutions`
                  : 'Eco Friendly Tech Solutions • Sequential Invoice Generator'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-gray-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`rounded-md px-3 py-1 font-medium transition-all ${
                  activeTab === 'form' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Invoice Form
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`rounded-md px-3 py-1 font-medium transition-all ${
                  activeTab === 'preview' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Master PDF Preview
              </button>
            </div>
            <button className="icon-btn text-gray-400 hover:text-gray-700" onClick={onClose} title="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 space-y-6 flex-1">
          {activeTab === 'form' ? (
            <form id="new-invoice-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Top Banner / Number & Date bar */}
              <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50/50 via-white to-coral-50/40 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                      Invoice Number
                      {!isEdit && loadingNumber && <Spinner />}
                    </label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="text"
                        readOnly
                        value={formData.invoiceNo}
                        className="input font-mono font-bold text-teal-800 bg-white/90 border-teal-200 text-sm w-full truncate"
                        placeholder="EFTS-INV-/2026-030"
                      />
                      {!isEdit ? (
                        <button
                          type="button"
                          onClick={fetchInvoiceNumber}
                          disabled={loadingNumber}
                          className="icon-btn shrink-0 text-teal-600 hover:bg-teal-100/50"
                          title="Regenerate next number"
                        >
                          <RefreshCw className={`h-4 w-4 ${loadingNumber ? 'animate-spin' : ''}`} />
                        </button>
                      ) : (
                        <span className="shrink-0 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded">
                          Preserved
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {isEdit ? 'Original invoice number is preserved' : 'Sequential & race-condition safe'}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Invoice Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.invoiceDate}
                      onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                      className="input mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Payment Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="input mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Mode Selector (Online vs Offline) */}
              <div className="rounded-xl border-2 border-teal-500/30 bg-teal-50/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                    Internship Mode Selection
                  </label>
                  <span className="text-xs text-teal-700">
                    Auto-fills: <strong>{formData.mode === 'Online' ? '₹20,000 (Reg: ₹2,000)' : '₹30,000 (Reg: ₹3,000)'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleModeSelect('Online')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                      formData.mode === 'Online'
                        ? 'border-teal-600 bg-teal-600 text-white shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe className={`h-5 w-5 ${formData.mode === 'Online' ? 'text-white' : 'text-teal-600'}`} />
                      <div className="text-left">
                        <p className="font-bold text-sm">Online Mode</p>
                        <p className={`text-xs ${formData.mode === 'Online' ? 'text-teal-100' : 'text-gray-500'}`}>
                          Standard Fee: ₹20,000 • Reg Paid: ₹2,000
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${formData.mode === 'Online' ? 'bg-white text-teal-700' : 'bg-gray-100 text-gray-600'}`}>
                      Base ₹20,000
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeSelect('Offline')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                      formData.mode === 'Offline'
                        ? 'border-coral-500 bg-coral-500 text-white shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-coral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className={`h-5 w-5 ${formData.mode === 'Offline' ? 'text-white' : 'text-coral-500'}`} />
                      <div className="text-left">
                        <p className="font-bold text-sm">Offline Mode</p>
                        <p className={`text-xs ${formData.mode === 'Offline' ? 'text-coral-100' : 'text-gray-500'}`}>
                          Standard Fee: ₹30,000 • Reg Paid: ₹3,000
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${formData.mode === 'Offline' ? 'bg-white text-coral-600' : 'bg-gray-100 text-gray-600'}`}>
                      Base ₹30,000
                    </span>
                  </button>
                </div>
              </div>

              {/* Customer Autofill Section */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-4 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-brand-600" />
                    <h3 className="font-semibold text-gray-900 text-sm">Customer Details & Autofill</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualCustomer(!isManualCustomer);
                      if (!isManualCustomer) setSelectedCustomer('');
                    }}
                    className="text-xs text-brand-600 hover:underline font-medium"
                  >
                    {isManualCustomer ? '← Select from CRM Customers' : '+ Enter New / Manual Customer'}
                  </button>
                </div>

                {!isManualCustomer ? (
                  <div>
                    <label className="label">
                      Select Registered Customer <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="input"
                      value={selectedCustomer}
                      onChange={(e) => handleCustomerChange(e.target.value)}
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.phone || c.email || 'No contact info'})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5">
                    Manual entry mode: Enter customer details below. No duplicate customer record will be created.
                  </p>
                )}

                {/* Customer Details: 3 columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">
                      Customer / Student Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="e.g. Sunil Kumar R"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">Customer Email</label>
                    <input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="student@example.com"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">Customer Mobile Number</label>
                    <input
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      placeholder="e.g. 9867453423"
                      className="input"
                    />
                  </div>
                </div>

                {customerInfo && (
                  <div className="flex flex-wrap gap-4 text-xs bg-gray-50 border border-gray-100 rounded-lg p-3 text-gray-600">
                    <div>Total Invoiced: <strong className="text-gray-900">{inr(customerInfo.totalInvoiced)}</strong></div>
                    <div>Previously Paid: <strong className="text-green-600">{inr(customerInfo.totalPaid)}</strong></div>
                    <div>Prior Balance: <strong className="text-coral-600">{inr(customerInfo.outstandingBalance)}</strong></div>
                    {customerInfo.admission && (
                      <div className="ml-auto">
                        Admission Mode: <Badge>{customerInfo.admission.mode}</Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Program & Course Details */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-4 bg-white">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <BookOpen className="h-4 w-4 text-brand-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">Program, Course & Payment Terms</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Select Internship / Course</label>
                    <select
                      className="input"
                      value={formData.courseId}
                      onChange={(e) => handleCourseChange(e.target.value)}
                    >
                      <option value="">-- Choose Course --</option>
                      {courses.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">
                      Program / Internship Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.programName}
                      onChange={(e) => setFormData({ ...formData, programName: e.target.value })}
                      placeholder="e.g. Medical Coding / Data Analytics"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">
                      Total Program Fee (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={totalAmount > 0 ? totalAmount : (unitPrice > 0 ? unitPrice : '')}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setUnitPrice(val);
                        setQuantity(1);
                        setDiscount(0);
                        setTaxRate(0);
                      }}
                      placeholder={formData.mode === 'Online' ? '20000' : '30000'}
                      className="input font-bold text-gray-900"
                    />
                    <span className="text-[11px] text-gray-400">
                      {formData.mode === 'Online' ? 'Standard Online: ₹20,000' : 'Standard Offline: ₹30,000'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="label">Payment Plan</label>
                    <select
                      className="input"
                      value={formData.paymentPlan}
                      onChange={(e) => {
                        const plan = e.target.value;
                        setFormData({ ...formData, paymentPlan: plan });
                        if (plan === 'Monthly EMI') {
                          generateEmiSchedule(formData.totalInstallments || 2, totalAmount, formData.paymentMode, formData.programName);
                        }
                      }}
                    >
                      {PAYMENT_PLANS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Payment Mode</label>
                    <select
                      className="input"
                      value={formData.paymentMode}
                      onChange={(e) => {
                        const mode = e.target.value;
                        setFormData({ ...formData, paymentMode: mode });
                        setPaymentRows((prev) => prev.map((r) => ({ ...r, mode })));
                      }}
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Initial Registration Fee (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.registrationFee}
                      onChange={(e) => setFormData({ ...formData, registrationFee: parseFloat(e.target.value) || 0 })}
                      className="input"
                    />
                  </div>
                </div>

                {formData.paymentPlan === 'Monthly EMI' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-gray-100">
                    <div>
                      <label className="label">Number of Installments</label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={formData.totalInstallments}
                        onChange={(e) => {
                          const n = e.target.value;
                          setFormData({ ...formData, totalInstallments: n });
                        }}
                        className="input"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => generateEmiSchedule(formData.totalInstallments, totalAmount, formData.paymentMode, formData.programName)}
                        className="btn btn-secondary w-full text-xs"
                      >
                        Recalculate EMI Schedule
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Item Pricing, Quantity, Discount & Tax (GST) Section */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-4 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-brand-600" />
                    <h3 className="font-semibold text-gray-900 text-sm">Course / Service Itemization, Discount & Tax</h3>
                  </div>
                  <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium">
                    Auto-recalculates Subtotal, GST & Total
                  </span>
                </div>

                {/* Description */}
                <div>
                  <label className="label">Item Description / Particulars</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g. Medical Coding Internship Program – Registration (Online)"
                    className="input text-sm"
                  />
                </div>

                {/* Grid for Quantity, Unit Price, Subtotal, Discount, Tax Rate, Tax Amount */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="input mt-1 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Unit Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="input mt-1 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Subtotal (₹)</label>
                    <div className="input mt-1 font-bold text-gray-900 bg-gray-50 border-gray-200 flex items-center justify-end select-none">
                      {inr(subtotal)}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Discount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      max={subtotal}
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="input mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Tax / GST (%)</label>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="input mt-1 font-medium"
                    >
                      <option value="0">0% (Nil / Exempt)</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST (Standard)</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Tax Amount (₹)</label>
                    <div className="input mt-1 font-semibold text-gray-800 bg-gray-50 border-gray-200 flex items-center justify-end select-none">
                      {inr(taxAmount)}
                    </div>
                  </div>
                </div>

                {/* Calculation Breakdown Pill */}
                <div className="rounded-lg bg-teal-50/70 border border-teal-100 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-gray-700">
                    <span>Subtotal: <strong className="text-gray-900">{inr(subtotal)}</strong></span>
                    {discountAmount > 0 && (
                      <span className="text-coral-600 font-medium">
                        − Discount: <strong>{inr(discountAmount)}</strong> ({discountRate}%)
                      </span>
                    )}
                    <span>Taxable: <strong className="text-gray-900">{inr(taxableAmount)}</strong></span>
                    {taxAmount > 0 && (
                      <span className="text-teal-700 font-medium">
                        + GST ({taxRate}%): <strong>{inr(taxAmount)}</strong>
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-teal-900 flex items-center gap-1.5 ml-auto">
                    Grand Total: <span className="text-base text-teal-800 bg-white px-2.5 py-0.5 rounded-md border border-teal-200">{inr(totalAmount)}</span>
                  </div>
                </div>

                {/* Status Override */}
                <div className="pt-1">
                  <label className="text-xs font-semibold text-gray-600">Payment Status Override</label>
                  <select
                    value={formData.statusOverride}
                    onChange={(e) => setFormData({ ...formData, statusOverride: e.target.value })}
                    className="input mt-1"
                  >
                    <option value="">Auto-derive from collected payments</option>
                    {PAYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-gray-400">
                    Effective status: <strong className="text-gray-700">{calculatedStatus}</strong>
                  </span>
                </div>
              </div>

              {/* Payment Rows Section */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-4 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-brand-600" />
                      <h3 className="font-semibold text-gray-900 text-sm">Payment & Installment Rows</h3>
                    </div>
                    <p className="text-xs text-gray-500">
                      Manage individual installments, amounts, payment dates and modes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addPaymentRow}
                    className="btn btn-primary text-xs flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Another Payment Row
                  </button>
                </div>

                <div className="space-y-3">
                  {paymentRows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                          Row #{idx + 1} • {idx === 0 ? 'Registration / EMI 1' : `EMI ${row.emiNumber || idx + 1}`}
                        </span>
                        {paymentRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePaymentRow(row.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                        <div className="md:col-span-2">
                          <label className="text-[11px] font-medium text-gray-500">Description</label>
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updatePaymentRow(row.id, 'description', e.target.value)}
                            placeholder="e.g. Medical Coding Internship – EMI 1 – UPI"
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-gray-500">Payment Date</label>
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updatePaymentRow(row.id, 'date', e.target.value)}
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-gray-500">Payment Mode</label>
                          <select
                            value={row.mode}
                            onChange={(e) => updatePaymentRow(row.id, 'mode', e.target.value)}
                            className="input text-xs"
                          >
                            {PAYMENT_MODES.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-gray-500">Amount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={row.amount}
                            onChange={(e) => updatePaymentRow(row.id, 'amount', e.target.value)}
                            placeholder={formData.mode === 'Online' ? '2000' : '3000'}
                            className="input text-xs font-bold text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-gray-500">Status</label>
                          <select
                            value={row.status}
                            onChange={(e) => updatePaymentRow(row.id, 'status', e.target.value)}
                            className="input text-xs"
                          >
                            <option value="Paid">Paid / Success</option>
                            <option value="Pending">Pending</option>
                            <option value="Partially Paid">Partially Paid</option>
                            <option value="Failed">Failed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculated Summary Box */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-2xs">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block">Total Program Fee</span>
                    <span className="text-base sm:text-lg font-bold text-gray-900">{inr(totalAmount)}</span>
                    <span className="text-[10px] text-gray-400 block">{formData.mode} Mode</span>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-2xs">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block">Amount Paid</span>
                    <span className="text-base sm:text-lg font-bold text-green-600">{inr(totalReceived)}</span>
                    <span className="text-[10px] text-green-500 block">Collected</span>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-2xs">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block">Balance Amount</span>
                    <span className={`text-base sm:text-lg font-bold ${outstandingBalance > 0 ? 'text-coral-600' : 'text-gray-900'}`}>
                      {inr(outstandingBalance)}
                    </span>
                    <span className="text-[10px] text-coral-500 block">Remaining Due</span>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-2xs">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block">Payment Status</span>
                    <Badge tone={calculatedStatus === 'Paid' ? 'green' : calculatedStatus === 'Overdue' ? 'red' : 'amber'}>
                      {calculatedStatus}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 border-t border-gray-200 pt-2 px-1">
                  <div>
                    Paid Installments: <strong className="text-gray-900">{paidInstallmentsCount}</strong> of {paymentRows.length}
                  </div>
                  <div>
                    Remaining Installments: <strong className="text-gray-900">{remainingInstallmentsCount}</strong>
                  </div>
                  <div className="w-full mt-1 text-gray-700 font-medium">
                    Amount in Words: <span className="font-bold text-gray-900">{amountInWords}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Internal Notes / Terms</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes or remarks regarding this invoice..."
                  className="input text-xs"
                />
              </div>
            </form>
          ) : (
            /* Live PDF Master Preview */
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-2xl mx-auto space-y-4">
              {/* Document Header */}
              <div className="text-center border-b border-gray-200 pb-4 relative">
                <h1 className="text-xl font-bold tracking-wide text-gray-900">ECO FRIENDLY TECH SOLUTIONS</h1>
                <h2 className="text-base font-bold text-gray-800 tracking-wider">PAYMENT INVOICE</h2>
                <p className="text-xs italic text-gray-500">Education • Technology • Career Development</p>
              </div>

              {/* Invoice Meta Grid */}
              <div className="border border-gray-400 text-xs">
                <div className="grid grid-cols-4 border-b border-gray-300">
                  <div className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Invoice No.</div>
                  <div className="p-1.5 font-mono border-r border-gray-300">{formData.invoiceNo || 'EFTS-INV-/...'}</div>
                  <div className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Invoice Date</div>
                  <div className="p-1.5">{fmt(formData.invoiceDate)}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-300">
                  <div className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Customer / Student Name</div>
                  <div className="p-1.5 font-semibold border-r border-gray-300">{formData.customerName || '—'}</div>
                  <div className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Mobile No.</div>
                  <div className="p-1.5">{formData.customerPhone || '—'}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-300">
                  <div className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Program / Internship</div>
                  <div className="p-1.5 border-r border-gray-300">{formData.programName || '—'} ({formData.mode})</div>
                  <div className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Payment Date</div>
                  <div className="p-1.5">{fmt(formData.paymentDate)}</div>
                </div>
                <div className="grid grid-cols-4">
                  <div className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Payment Mode</div>
                  <div className="p-1.5 border-r border-gray-300">{formData.paymentMode}</div>
                  <div className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Payment Status</div>
                  <div className="p-1.5 font-bold text-teal-700">{calculatedStatus}</div>
                </div>
              </div>

              {/* Payment History Table */}
              <div className="border border-gray-400 text-xs mt-3">
                <div className="grid grid-cols-12 font-bold bg-gray-100 border-b border-gray-400 text-center">
                  <div className="col-span-1 p-1.5 border-r border-gray-300">S.No.</div>
                  <div className="col-span-6 p-1.5 border-r border-gray-300 text-left">Description</div>
                  <div className="col-span-2 p-1.5 border-r border-gray-300">Date</div>
                  <div className="col-span-1 p-1.5 border-r border-gray-300">EMI</div>
                  <div className="col-span-2 p-1.5 text-right">Amount (₹)</div>
                </div>

                {paymentRows.map((r, i) => (
                  <div key={r.id} className="grid grid-cols-12 border-b border-gray-300 text-gray-800">
                    <div className="col-span-1 p-1.5 border-r border-gray-300 text-center">{i + 1}</div>
                    <div className="col-span-6 p-1.5 border-r border-gray-300">{r.description || '—'}</div>
                    <div className="col-span-2 p-1.5 border-r border-gray-300 text-center">{fmt(r.date)}</div>
                    <div className="col-span-1 p-1.5 border-r border-gray-300 text-center">{r.emiNumber || (i + 1)}</div>
                    <div className="col-span-2 p-1.5 text-right font-medium">{Number(r.amount || 0).toLocaleString('en-IN')}</div>
                  </div>
                ))}

                {/* Summary rows */}
                {subtotal !== totalAmount && (
                  <>
                    <div className="grid grid-cols-12 border-b border-gray-300">
                      <div className="col-span-10 p-1.5 border-r border-gray-300 pl-4 text-gray-600">Subtotal</div>
                      <div className="col-span-2 p-1.5 text-right font-medium">{inr(subtotal)}</div>
                    </div>
                    {discountAmount > 0 && (
                      <div className="grid grid-cols-12 border-b border-gray-300 text-coral-600">
                        <div className="col-span-10 p-1.5 border-r border-gray-300 pl-4">Discount ({discountRate}%)</div>
                        <div className="col-span-2 p-1.5 text-right font-medium">− {inr(discountAmount)}</div>
                      </div>
                    )}
                    {taxAmount > 0 && (
                      <div className="grid grid-cols-12 border-b border-gray-300 text-teal-700">
                        <div className="col-span-10 p-1.5 border-r border-gray-300 pl-4">GST ({taxRate}%)</div>
                        <div className="col-span-2 p-1.5 text-right font-medium">+ {inr(taxAmount)}</div>
                      </div>
                    )}
                  </>
                )}
                <div className="grid grid-cols-12 border-b border-gray-300 font-bold bg-gray-50">
                  <div className="col-span-10 p-1.5 border-r border-gray-300 pl-4">Total Amount</div>
                  <div className="col-span-2 p-1.5 text-right">{inr(totalAmount)}/-</div>
                </div>
                <div className="grid grid-cols-12 border-b border-gray-300">
                  <div className="col-span-10 p-1.5 border-r border-gray-300 pl-4 font-medium">Amount Paid</div>
                  <div className="col-span-2 p-1.5 text-right font-bold text-green-700">
                    {outstandingBalance <= 0 && totalReceived >= totalAmount ? 'YES' : `${inr(totalReceived)}/-`}
                  </div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-10 p-1.5 border-r border-gray-300 pl-4 font-medium">Balance Amount</div>
                  <div className="col-span-2 p-1.5 text-right font-bold text-coral-700">
                    {outstandingBalance <= 0 ? 'NO' : `${inr(outstandingBalance)}/-`}
                  </div>
                </div>
              </div>

              {/* Amount In Words & Terms */}
              <div className="text-xs space-y-2 pt-2">
                <p><strong>Amount in Words:</strong> {amountInWords}</p>
                <div className="pt-1">
                  <p className="font-bold">Terms & Conditions</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-gray-600">
                    <li>This invoice is issued against the payment received by Eco Friendly Tech Solutions.</li>
                    <li>All payments are subject to verification and applicable company terms.</li>
                    <li>For partial payments, the balance amount must be settled as per the agreed payment schedule.</li>
                    <li>Any refund, cancellation, or adjustment will be handled according to the applicable company policy.</li>
                    <li>Please retain this invoice as proof of payment.</li>
                  </ul>
                </div>
                <p className="text-center font-bold pt-2 text-[11px]">Thank you for choosing Eco Friendly Tech Solutions.</p>
                <div className="border-t border-teal-500 pt-1 text-center text-[10px] text-gray-500">
                  www.ecofriendlytechsolutions.tech | info@eco-friendly.tech | +91 9043 538 838
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3.5 shrink-0 bg-gray-50">
          <div className="text-xs text-gray-500">
            {calculatedStatus === 'Paid' ? (
              <span className="text-green-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Ready to finalize: Full payment recorded
              </span>
            ) : (
              <span>Balance of {inr(outstandingBalance)} remaining</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="new-invoice-form"
              className="btn btn-primary px-5"
              disabled={submitting || (!isEdit && loadingNumber)}
            >
              {submitting
                ? (isEdit ? 'Saving Changes...' : 'Saving & Generating...')
                : (isEdit ? 'Save Changes' : 'Save & Generate Invoice')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
