import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  CreditCard,
  Smartphone,
  Building,
  Zap,
  ArrowLeft,
  Sparkles,
  Lock,
  Clock,
  ArrowRight,
  Crown,
  Heart,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Membership } from '../types/subscriptions';

interface OrderData {
  orderId: string;
  planId: string;
  planName: string;
  amountPaise: number;
  currency: string;
  durationDays: number;
  status: string;
  providerOrderId: string;
  createdAt: string;
  keyId: string;
  testMode: boolean;
}

export const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState<Membership | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'oneclick' | 'upi' | 'card' | 'netbanking'>('oneclick');
  const [upiId, setUpiId] = useState('success@razorpay');
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardHolder, setCardHolder] = useState(user?.email || 'Farha Rizvi');
  const [selectedBank, setSelectedBank] = useState('HDFC');

  useEffect(() => {
    if (!orderId) {
      setError('No order ID provided. Please select a plan from the subscriptions page.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    api
      .getSubscriptionOrder(orderId)
      .then((data) => {
        if (active) {
          setOrder(data);
          if (data.status === 'paid') {
            api.getSubscription().then((sub) => {
              if (active) setCompleted(sub);
            });
          }
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load order details');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6C233E', '#B28A4D', '#D97F76', '#427B5F'],
      });
    } catch {
      // ignore
    }
  };

  const handleSimulatePayment = async (fail = false) => {
    if (!orderId || processing) return;
    setProcessing(true);
    setError('');

    if (fail) {
      setTimeout(() => {
        setError('Payment was declined or cancelled. You can retry with another test option.');
        setProcessing(false);
      }, 700);
      return;
    }

    try {
      const mockPaymentId = `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const result = await api.verifySubscriptionPayment(orderId, mockPaymentId);
      setCompleted(result);
      triggerConfetti();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment verification failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleOfficialRazorpay = () => {
    if (!order || processing) return;
    const win = window as any;
    if (!win.Razorpay) {
      setError('Official Razorpay SDK is not loaded. Use the Test Mode options below.');
      return;
    }

    setProcessing(true);
    try {
      const options = {
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || 'INR',
        name: 'ShadiPlanner Matrimony',
        description: `${order.planName} Membership Upgrade`,
        order_id: order.providerOrderId,
        prefill: {
          email: user?.email || '',
        },
        theme: {
          color: '#6C233E',
        },
        handler: async (response: any) => {
          try {
            const result = await api.verifySubscriptionPayment(
              order.orderId,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            setCompleted(result);
            triggerConfetti();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Payment verification failed');
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
      };

      const rzp = new win.Razorpay(options);
      rzp.open();
    } catch (e) {
      setProcessing(false);
      setError(e instanceof Error ? e.message : 'Could not open Razorpay checkout');
    }
  };

  if (loading) {
    return (
      <div className="site-container py-16 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-700 rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium text-sm">Preparing secure Razorpay checkout...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="site-container py-16 max-w-xl mx-auto text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto text-2xl">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold font-playfair text-slate-900">Checkout Unavailable</h1>
        <p className="text-slate-600 text-sm">{error}</p>
        <div className="pt-4">
          <Link
            to="/subscriptions"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-700 text-white rounded-xl text-sm font-semibold hover:bg-rose-800 transition"
          >
            <ArrowLeft size={16} /> Return to Membership Plans
          </Link>
        </div>
      </div>
    );
  }

  const amountRupees = order ? (order.amountPaise / 100).toFixed(2) : '0.00';

  return (
    <div className="site-container py-10 max-w-3xl mx-auto px-4">
      {/* Top Breadcrumb & Trust */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/subscriptions')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft size={14} /> Back to plans
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Razorpay Test Gateway (Sandbox)
        </div>
      </div>

      {completed ? (
        /* Success Screen */
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Payment Confirmed & Verified
            </span>
            <h1 className="text-3xl font-playfair font-bold text-slate-900 mt-3">
              Welcome to {completed.plan.name} Membership!
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
              Your payment has been verified with Razorpay and your premium privileges are active immediately.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 max-w-md mx-auto text-left space-y-3 text-xs border border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>Plan Name:</span>
              <strong className="text-slate-900">{completed.plan.name}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Amount Paid:</span>
              <strong className="text-slate-900">₹{amountRupees} INR</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Active Until:</span>
              <strong className="text-slate-900">
                {completed.expiresAt ? new Date(completed.expiresAt).toLocaleDateString() : 'Active'}
              </strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Interests Allowance:</span>
              <strong className="text-emerald-700">
                {completed.plan.interestLimit === null ? 'Unlimited' : `${completed.plan.interestLimit} / month`}
              </strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Contact Unlocking:</span>
              <strong className="text-emerald-700">Enabled on mutual connection</strong>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              to="/matches"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-700 to-rose-800 text-white font-semibold text-sm rounded-xl shadow-lg shadow-rose-200 hover:shadow-rose-300 transition"
            >
              Browse Matches with {completed.plan.name} <ArrowRight size={16} />
            </Link>
            <Link
              to="/my-profile"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-50 transition"
            >
              View My Biodata
            </Link>
          </div>
        </div>
      ) : (
        /* Checkout Box */
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xl overflow-hidden">
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold tracking-wider uppercase">
                <Sparkles size={14} /> ShadiPlanner Membership Upgrade
              </div>
              <h1 className="text-2xl sm:text-3xl font-playfair font-bold mt-1">
                {order?.planName} Plan Checkout
              </h1>
              <p className="text-rose-200 text-xs mt-1">
                {order?.durationDays} days of enhanced matchmaking and mutual contact access
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm px-5 py-3 rounded-2xl border border-white/20 text-right sm:self-center">
              <span className="text-[10px] text-rose-200 uppercase tracking-wider block">Total Amount</span>
              <span className="text-2xl sm:text-3xl font-bold font-playfair text-white">
                ₹{amountRupees}
              </span>
            </div>
          </div>

          {/* Test Notice */}
          <div className="bg-amber-50/90 border-b border-amber-200 px-6 py-3 flex items-start sm:items-center gap-2.5 text-xs text-amber-900">
            <ShieldCheck size={18} className="text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <strong>Testing Mode Active:</strong> No real bank charges will occur. Select any payment option below to simulate Razorpay payment authorization and test instant plan activation.
            </div>
          </div>

          {error && (
            <div className="m-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800">
              <span>{error}</span>
              <button onClick={() => setError('')} className="underline text-rose-700 font-medium">Dismiss</button>
            </div>
          )}

          {/* Payment Interface */}
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Method Selector */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
                Select Payment Mode
              </span>

              <button
                type="button"
                onClick={() => setPaymentMethod('oneclick')}
                className={`w-full text-left p-3.5 rounded-2xl border flex items-center gap-3 transition ${
                  paymentMethod === 'oneclick'
                    ? 'bg-rose-50 border-rose-600 text-rose-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Zap size={18} className={paymentMethod === 'oneclick' ? 'text-rose-700' : 'text-slate-400'} />
                <div>
                  <div className="text-xs font-bold">1-Click Fast Test</div>
                  <div className="text-[10px] text-slate-500">Instant test approval</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`w-full text-left p-3.5 rounded-2xl border flex items-center gap-3 transition ${
                  paymentMethod === 'upi'
                    ? 'bg-rose-50 border-rose-600 text-rose-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Smartphone size={18} className={paymentMethod === 'upi' ? 'text-rose-700' : 'text-slate-400'} />
                <div>
                  <div className="text-xs font-bold">UPI / QR Code</div>
                  <div className="text-[10px] text-slate-500">GPay, PhonePe, Paytm</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`w-full text-left p-3.5 rounded-2xl border flex items-center gap-3 transition ${
                  paymentMethod === 'card'
                    ? 'bg-rose-50 border-rose-600 text-rose-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard size={18} className={paymentMethod === 'card' ? 'text-rose-700' : 'text-slate-400'} />
                <div>
                  <div className="text-xs font-bold">Credit / Debit Card</div>
                  <div className="text-[10px] text-slate-500">Visa, Mastercard, RuPay</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('netbanking')}
                className={`w-full text-left p-3.5 rounded-2xl border flex items-center gap-3 transition ${
                  paymentMethod === 'netbanking'
                    ? 'bg-rose-50 border-rose-600 text-rose-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Building size={18} className={paymentMethod === 'netbanking' ? 'text-rose-700' : 'text-slate-400'} />
                <div>
                  <div className="text-xs font-bold">Netbanking</div>
                  <div className="text-[10px] text-slate-500">All Indian Banks</div>
                </div>
              </button>
            </div>

            {/* Right Column: Payment Form details */}
            <div className="md:col-span-2 bg-slate-50/70 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
              {paymentMethod === 'oneclick' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <Zap size={16} className="text-rose-600" />
                    Instant 1-Click Razorpay Simulator
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    This simulates a completed Razorpay payment transaction with a valid test reference. Clicking below will verify the payment on the server and activate your {order?.planName} plan immediately.
                  </p>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Order ID:</span>
                      <code className="text-slate-800">{order?.orderId}</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Razorpay Receipt:</span>
                      <code className="text-slate-800">{order?.providerOrderId}</code>
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'upi' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <Smartphone size={16} className="text-rose-600" />
                    UPI Payment Simulation
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Virtual Payment Address (VPA / UPI ID)
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. yourname@okhdfcbank"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Tip: Use <code>success@razorpay</code> to test successful payment
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {['success@razorpay', 'upi@paytm', 'member@okhdfc'].map((id) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setUpiId(id)}
                        className="px-2.5 py-1 text-[10px] bg-white border border-slate-300 rounded-lg text-slate-700 hover:border-rose-400 transition"
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <CreditCard size={16} className="text-rose-600" />
                    Test Card Details (Pre-filled)
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">Expiry</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">CVV</label>
                      <input
                        type="text"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">Name on Card</label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'netbanking' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <Building size={16} className="text-rose-600" />
                    Select Test Bank
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['HDFC', 'ICICI', 'SBI', 'Axis Bank', 'Kotak', 'Punjab National'].map((bank) => (
                      <button
                        type="button"
                        key={bank}
                        onClick={() => setSelectedBank(bank)}
                        className={`p-2.5 rounded-xl text-xs font-semibold border text-left transition ${
                          selectedBank === bank
                            ? 'bg-rose-50 border-rose-600 text-rose-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {bank}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleSimulatePayment(false)}
                  className="w-full py-3 bg-gradient-to-r from-rose-700 to-rose-800 hover:from-rose-800 hover:to-rose-900 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-200 hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authorizing with Razorpay...
                    </>
                  ) : (
                    <>
                      <Lock size={14} /> Pay ₹{amountRupees} INR (Simulate Success)
                    </>
                  )}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handleSimulatePayment(true)}
                    className="flex-1 py-2 bg-white border border-slate-300 text-slate-600 hover:text-rose-700 hover:bg-rose-50 text-[11px] font-semibold rounded-xl transition disabled:opacity-50"
                  >
                    Simulate Payment Failure
                  </button>

                  {order?.keyId && order.keyId.startsWith('rzp_') && order.keyId !== 'rzp_test_mock' && (
                    <button
                      type="button"
                      disabled={processing}
                      onClick={handleOfficialRazorpay}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      Official Razorpay Popup
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Safeguards */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>256-Bit SSL Encrypted Payment Simulation</span>
            </div>
            <div>
              <span>Powered by <strong>Razorpay</strong> Payment Engine</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
