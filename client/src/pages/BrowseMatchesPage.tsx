import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { MatrimonialProfile } from '../types';
import { ProfileCard } from '../components/ProfileCard';
import { useAuth } from '../context/AuthContext';
import { Membership } from '../types/subscriptions';

export const BrowseMatchesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile: currentUserProfile } = useAuth();
  const [membership, setMembership] = useState<Membership>();
  const [searchError, setSearchError] = useState('');
  const [resetRevision, setResetRevision] = useState(0);
  const advancedAllowed = user?.role === 'admin' || !!membership?.plan.advancedSearch;
  useEffect(() => { let active = true; if (user?.role !== 'admin') api.getSubscription().then(value => { if (active) setMembership(value); }).catch(() => {}); return () => { active = false; }; }, [user?.id]);

  const [profiles, setProfiles] = useState<MatrimonialProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Filter States initialized from query params or sensible defaults
  const [gender, setGender] = useState<string>(
    searchParams.get('gender') || (currentUserProfile?.gender === 'Male' ? 'Female' : 'Male')
  );
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [minAge, setMinAge] = useState(searchParams.get('minAge') || '21');
  const [maxAge, setMaxAge] = useState(searchParams.get('maxAge') || '36');
  const [religion, setReligion] = useState(searchParams.get('religion') || 'all');
  const [motherTongue, setMotherTongue] = useState(searchParams.get('motherTongue') || 'all');
  const [diet, setDiet] = useState(searchParams.get('diet') || 'all');
  const [maritalStatus, setMaritalStatus] = useState(searchParams.get('maritalStatus') || 'all');
  const [profession, setProfession] = useState(searchParams.get('profession') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [manglik, setManglik] = useState(searchParams.get('manglik') || 'all');
  const [sortBy, setSortBy] = useState('recommended');

  const fetchProfiles = async () => {
    setLoading(true);
    setSearchError('');
    try {
      const params: Record<string, string> = {};
      if (gender) params.gender = gender;
      if (query) params.query = query;
      if (minAge) params.minAge = minAge;
      if (maxAge) params.maxAge = maxAge;
      if (religion && religion !== 'all') params.religion = religion;
      if (motherTongue && motherTongue !== 'all') params.motherTongue = motherTongue;
      if (diet && diet !== 'all') params.diet = diet;
      if (maritalStatus && maritalStatus !== 'all') params.maritalStatus = maritalStatus;
      if (profession) params.profession = profession;
      if (city) params.city = city;
      if (manglik && manglik !== 'all') params.manglik = manglik;
      if (sortBy) params.sortBy = sortBy;

      const data = await api.getProfiles(params);
      if (data?.profiles) {
        setProfiles(data.profiles);
      }
    } catch (err) {
      setProfiles([]);
      setSearchError(err instanceof Error ? err.message : 'Could not load matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [gender, religion, motherTongue, diet, maritalStatus, manglik, sortBy, resetRevision]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProfiles();
  };

  const handleResetFilters = () => {
    setQuery('');
    setMinAge('21');
    setMaxAge('36');
    setReligion('all');
    setMotherTongue('all');
    setDiet('all');
    setMaritalStatus('all');
    setProfession('');
    setCity('');
    setManglik('all');
    setSortBy('recommended');
    setResetRevision(value => value + 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {membership?.plan.id === 'free' && <p className="pricing-notice">Your Free plan includes up to {membership.plan.browseLimit} discoverable profiles and basic filters. <Link to="/subscriptions" className="underline font-semibold">Compare plans</Link></p>}
      {searchError && <p role="alert" className="pricing-notice pricing-error">{searchError} <button onClick={handleResetFilters} className="underline">Clear filters</button> <Link to="/subscriptions" className="underline">View plans</Link></p>}
      {/* Header & Controls bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-slate-900">
            {gender === 'Female' ? 'Brides' : 'Grooms'} Matching Your Criteria
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Displaying <span className="font-semibold text-rose-600">{profiles.length}</span> verified matrimonial biodatas with compatibility analysis
          </p>
        </div>

        {/* Gender Toggle & Sort by */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setGender('Female')}
              className={`px-3 py-1.5 rounded-lg transition ${
                gender === 'Female'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Brides (Women)
            </button>
            <button
              onClick={() => setGender('Male')}
              className={`px-3 py-1.5 rounded-lg transition ${
                gender === 'Male'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grooms (Men)
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="recommended">Best Compatibility Score</option>
              <option value="age_asc">Age: Youngest First</option>
              <option value="age_desc">Age: Oldest First</option>
              <option value="income_desc" disabled={!advancedAllowed}>Highest Income (Gold+)</option>
            </select>
          </div>

          <button
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="md:hidden flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-8">
        {/* Filters Sidebar */}
        <aside
          className={`space-y-6 md:block ${
            mobileFilterOpen ? 'block' : 'hidden'
          } bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-fit sticky top-24`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
              <Filter className="w-4 h-4 text-rose-600" />
              <span>Refine Preferences</span>
            </div>
            <button
              onClick={handleResetFilters}
              className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick search input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Keywords (Name, Company, College)
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                disabled={!advancedAllowed}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchProfiles()}
                placeholder="e.g. Doctor, IIT, Google, Bandra"
                className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Age range */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Age Range: {minAge} - {maxAge} years
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="18"
                max="60"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                className="w-1/2 p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-center"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="number"
                min="18"
                max="60"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                className="w-1/2 p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-center"
              />
            </div>
          </div>

          {/* Religion */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Religion
            </label>
            <select
              value={religion}
              onChange={(e) => setReligion(e.target.value)}
              className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none"
            >
              <option value="all">All Religions</option>
              <option value="Hindu">Hindu</option>
              <option value="Muslim">Muslim</option>
              <option value="Sikh">Sikh</option>
              <option value="Christian">Christian</option>
              <option value="Jain">Jain</option>
            </select>
          </div>

          {/* Mother tongue */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mother Tongue
            </label>
            <select
              value={motherTongue}
              onChange={(e) => setMotherTongue(e.target.value)}
              className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none"
            >
              <option value="all">All Mother Tongues</option>
              <option value="Hindi">Hindi</option>
              <option value="Punjabi">Punjabi</option>
              <option value="Tamil">Tamil</option>
              <option value="Telugu">Telugu</option>
              <option value="Gujarati">Gujarati</option>
              <option value="Marathi">Marathi</option>
              <option value="Bengali">Bengali</option>
              <option value="Malayalam">Malayalam</option>
              <option value="Urdu">Urdu</option>
            </select>
          </div>

          {/* Diet */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Dietary Preference
            </label>
            <select
              value={diet}
              disabled={!advancedAllowed}
              onChange={(e) => setDiet(e.target.value)}
              className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none"
            >
              <option value="all">Any Diet</option>
              <option value="Vegetarian">Pure Vegetarian</option>
              <option value="Eggetarian">Eggetarian</option>
              <option value="Non-Vegetarian">Non-Vegetarian</option>
              <option value="Jain">Jain</option>
            </select>
          </div>

          {/* Manglik status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Manglik (Kundali)
            </label>
            <select
              value={manglik}
              disabled={!advancedAllowed}
              onChange={(e) => setManglik(e.target.value)}
              className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none"
            >
              <option value="all">Does Not Matter</option>
              <option value="No">Non-Manglik</option>
              <option value="Yes">Manglik</option>
              <option value="Do not believe">Do Not Believe</option>
            </select>
          </div>

          {/* City / Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              City
            </label>
            <input
              type="text"
              value={city}
              disabled={!advancedAllowed}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Mumbai, Bengaluru, Delhi"
              className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none"
            />
          </div>

          <button
            onClick={fetchProfiles}
            className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 text-white text-xs font-semibold rounded-xl shadow-md shadow-rose-200 hover:shadow-lg transition"
          >
            Apply Filters
          </button>
        </aside>

        {/* Profile Results Grid */}
        <div className="md:col-span-3 space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse space-y-4"
                >
                  <div className="aspect-[4/3] bg-slate-200 rounded-xl" />
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-8 bg-slate-200 rounded-xl" />
                </div>
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 mx-auto flex items-center justify-center text-2xl">
                💍
              </div>
              <h3 className="font-playfair text-xl font-bold text-slate-800">
                No matching profiles found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try widening your age, location, or religion filters to see more wonderful profiles.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-rose-700 transition"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onInterestChange={fetchProfiles}
                  onShortlistChange={fetchProfiles}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

