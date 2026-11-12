import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  CalendarCheck,
  Calculator,
  Store,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Phone,
  Mail,
  Star,
  MapPin,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { WeddingChecklistItem, WeddingBudgetItem, Vendor } from '../types';

export const ShadiPlannerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'checklist' | 'budget' | 'vendors'>(requestedTab === 'vendors' || requestedTab === 'budget' ? requestedTab : 'checklist');

  // Checklist state
  const [checklist, setChecklist] = useState<WeddingChecklistItem[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoCategory, setNewTodoCategory] = useState<any>('Ceremony & Rituals');
  const [newTodoCost, setNewTodoCost] = useState('');

  // Budget state
  const [budgetItems, setBudgetItems] = useState<WeddingBudgetItem[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newAllocated, setNewAllocated] = useState('');
  const [newActual, setNewActual] = useState('');

  // Vendors state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorCategory, setVendorCategory] = useState(searchParams.get('category') || 'all');
  const [vendorCity, setVendorCity] = useState(searchParams.get('city') || '');

  useEffect(() => {
    const tab = searchParams.get('tab');
    setActiveTab(tab === 'vendors' || tab === 'budget' ? tab : 'checklist');
    setVendorCategory(searchParams.get('category') || 'all');
    setVendorCity(searchParams.get('city') || '');
  }, [searchParams]);

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [checkData, budgetData, vendorData] = await Promise.all([
        api.getChecklist(),
        api.getBudget(),
        api.getVendors(),
      ]);
      setChecklist(checkData);
      setBudgetItems(budgetData);
      setVendors(vendorData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Checklist handlers
  const handleToggleChecklist = async (id: string, currentCompleted: boolean) => {
    try {
      await api.toggleChecklistItem(id, !currentCompleted);
      setChecklist((prev) =>
        prev.map((item) => (item.id === id ? { ...item, completed: !currentCompleted } : item))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    try {
      const created = await api.addChecklistItem({
        title: newTodoTitle.trim(),
        category: newTodoCategory,
        dueDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0],
        estimatedCost: Number(newTodoCost) || 0,
      });
      setChecklist((prev) => [...prev, created]);
      setNewTodoTitle('');
      setNewTodoCost('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    try {
      await api.deleteChecklistItem(id);
      setChecklist((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Budget handlers
  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !newAllocated) return;

    try {
      const created = await api.addBudgetItem({
        category: newCategoryName.trim(),
        allocatedAmount: Number(newAllocated),
        actualAmount: Number(newActual) || 0,
      });
      setBudgetItems((prev) => [...prev, created]);
      setNewCategoryName('');
      setNewAllocated('');
      setNewActual('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await api.deleteBudgetItem(id);
      setBudgetItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Budget summaries
  const totalAllocated = budgetItems.reduce((acc, curr) => acc + (curr.allocatedAmount || 0), 0);
  const totalActual = budgetItems.reduce((acc, curr) => acc + (curr.actualAmount || 0), 0);
  const remainingBudget = totalAllocated - totalActual;

  const filteredVendors = vendors.filter(vendor =>
    (vendorCategory === 'all' || vendor.category.toLowerCase() === vendorCategory.toLowerCase()) &&
    (!vendorCity.trim() || vendor.city.toLowerCase().includes(vendorCity.trim().toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-amber-700 via-rose-700 to-rose-900 p-8 sm:p-10 text-white shadow-xl overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-amber-200">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Interactive Wedding Suite</span>
          </div>
          <h1 className="font-playfair text-3xl sm:text-4xl font-extrabold tracking-tight">
            Plan Your Grand Dream Wedding
          </h1>
          <p className="text-xs sm:text-sm text-rose-100 font-light leading-relaxed">
              Bring your celebration together: organise your checklist, keep track of your budget, and explore wedding vendors.
          </p>
        </div>

        {/* Ambient motif */}
        <div className="absolute right-6 -bottom-6 text-9xl opacity-10 select-none">
          💐
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex border-b border-slate-200 pb-3">
        <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
              activeTab === 'checklist'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Wedding Checklist</span>
          </button>

          <button
            onClick={() => setActiveTab('budget')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
              activeTab === 'budget'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Budget Calculator</span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
              activeTab === 'vendors'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Curated Vendors Directory</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CHECKLIST */}
      {activeTab === 'checklist' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-2">
              <h3 className="font-playfair text-xl font-bold text-slate-800">
                To-Do Milestone Tracker
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {checklist.filter((c) => c.completed).length} of {checklist.length} Completed
              </span>
            </div>

            {/* Checklist progress bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-rose-500 to-emerald-500 h-full transition-all duration-500"
                style={{
                  width: `${checklist.length > 0 ? (checklist.filter((c) => c.completed).length / checklist.length) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="space-y-3 pt-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    item.completed
                      ? 'bg-slate-50/70 border-slate-200 text-slate-400'
                      : 'bg-white border-rose-100 shadow-sm text-slate-800 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleChecklist(item.id, item.completed)}
                      className="mt-0.5 text-rose-600 hover:scale-110 transition shrink-0"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </button>
                    <div>
                      <h4
                        className={`text-xs font-semibold ${
                          item.completed ? 'line-through text-slate-400' : 'text-slate-800'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span className="text-rose-700 font-medium">{item.category}</span>
                        <span>•</span>
                        <span>Due: {item.dueDate}</span>
                        {item.estimatedCost ? (
                          <>
                            <span>•</span>
                            <span>Est: ₹{item.estimatedCost.toLocaleString()}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteChecklist(item.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add Item Card */}
          <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm space-y-4 h-fit">
            <h3 className="font-playfair text-lg font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-rose-600" />
              <span>Add Custom Task</span>
            </h3>

            <form onSubmit={handleAddChecklist} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  placeholder="e.g. Sangeet Choreography rehearsal"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Category
                </label>
                <select
                  value={newTodoCategory}
                  onChange={(e) => setNewTodoCategory(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none"
                >
                  <option value="Ceremony & Rituals">Ceremony & Rituals</option>
                  <option value="Venue & Food">Venue & Food</option>
                  <option value="Attire & Jewelry">Attire & Jewelry</option>
                  <option value="Invitations & Gifts">Invitations & Gifts</option>
                  <option value="Photography & Music">Photography & Music</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Estimated Cost (₹ Optional)
                </label>
                <input
                  type="number"
                  value={newTodoCost}
                  onChange={(e) => setNewTodoCost(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 text-white text-xs font-semibold rounded-xl shadow-md transition hover:shadow-lg"
              >
                Add To Checklist
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: BUDGET CALCULATOR */}
      {activeTab === 'budget' && (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Total Planned Budget</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                ₹{totalAllocated.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Across all ceremony departments</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Actual Committed Spent</span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                ₹{totalActual.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {Math.round((totalActual / (totalAllocated || 1)) * 100)}% of total budget used
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Remaining Surplus</span>
              <div
                className={`text-2xl font-black mt-1 ${
                  remainingBudget >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                ₹{remainingBudget.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {remainingBudget >= 0 ? 'Safe & on-track' : 'Over allocated threshold'}
              </div>
            </div>
          </div>

          {/* Breakdown table & Add item */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="font-playfair text-xl font-bold text-slate-900">
                Department Budget Allocations
              </h3>

              <div className="space-y-4 pt-2">
                {budgetItems.map((item) => {
                  const percent = Math.min(100, Math.round((item.actualAmount / (item.allocatedAmount || 1)) * 100));

                  return (
                    <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{item.category}</span>
                        <div className="flex items-center space-x-3">
                          <span className="text-slate-500">
                            Spent: <strong className="text-slate-800">₹{item.actualAmount.toLocaleString()}</strong> / ₹{item.allocatedAmount.toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleDeleteBudget(item.id)}
                            className="text-slate-300 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            percent > 100 ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {item.notes && <p className="text-[11px] text-slate-400 italic">{item.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add Budget Category */}
            <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm space-y-4 h-fit">
              <h3 className="font-playfair text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-rose-600" />
                <span>Add Budget Category</span>
              </h3>

              <form onSubmit={handleAddBudget} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Honeymoon in Maldives"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Allocated Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={newAllocated}
                    onChange={(e) => setNewAllocated(e.target.value)}
                    placeholder="e.g. 250000"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Committed / Spent (₹)
                  </label>
                  <input
                    type="number"
                    value={newActual}
                    onChange={(e) => setNewActual(e.target.value)}
                    placeholder="e.g. 180000"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 text-white text-xs font-semibold rounded-xl shadow-md transition hover:shadow-lg"
                >
                  Save Category
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VENDORS DIRECTORY */}
      {activeTab === 'vendors' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div>
              <h3 className="font-playfair text-xl font-bold text-slate-900">
                Wedding Vendor Directory
              </h3>
              <p className="text-xs text-slate-500">
                Explore wedding services by category and city
              </p>
            </div>

            <div className="grid w-full sm:w-auto grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-xs items-center">
              <label htmlFor="planner-vendor-city" className="sr-only">Wedding city</label>
              <input id="planner-vendor-city" value={vendorCity} onChange={event => setVendorCity(event.target.value)} placeholder="Filter by city" className="min-w-0 w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5" />
              <label htmlFor="planner-vendor-category" className="sr-only">Vendor category</label>
              <select
                id="planner-vendor-category"
                value={vendorCategory}
                onChange={(e) => setVendorCategory(e.target.value)}
                className="min-w-0 w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium text-slate-700 outline-none"
              >
                <option value="all">All Vendors</option>
                <option value="Venue">Venues & Banquets</option>
                <option value="Photographer">Photographers</option>
                <option value="Catering">Caterers</option>
                <option value="Decorator">Decorators</option>
                <option value="Makeup & Mehndi">Makeup & Mehndi</option>
                <option value="DJ & Music">DJ & Music</option>
              </select>
            </div>
          </div>

          {!loading && !filteredVendors.length && <div role="status" className="rounded-2xl bg-white border border-slate-200 p-6 text-sm text-slate-600">No vendors match this category and city yet. <button onClick={() => { setVendorCity(''); setVendorCategory('all'); }} className="font-semibold text-rose-700 underline">View all vendors</button></div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors.map((vendor) => (
              <div
                key={vendor.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 relative">
                    <img
                      src={vendor.image}
                      alt={vendor.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      {vendor.category}
                    </div>
                    <div className="absolute top-3 right-3 bg-amber-500 text-slate-900 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <Star className="w-3 h-3 fill-slate-900" />
                      <span>{vendor.rating}</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div>
                      <h4 className="font-playfair text-base font-bold text-slate-900">
                        {vendor.name}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{vendor.city}</span>
                        <span>•</span>
                        <span>{vendor.reviewsCount} Reviews</span>
                      </p>
                    </div>

                    <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit">
                      Pricing: {vendor.priceRange}
                    </div>

                    <div className="space-y-1 pt-1">
                      {vendor.features?.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="text-slate-500 text-[10px]">Contact Direct:</div>
                    <div className="font-semibold text-slate-800">{vendor.phone}</div>
                  </div>
                  <a
                    href={`tel:${vendor.phone}`}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition flex items-center gap-1 shadow-sm"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Inquire</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

