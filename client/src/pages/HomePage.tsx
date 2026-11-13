import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Building2, Camera, Check, ClipboardCheck, Flower2, Heart, IndianRupee, MapPin, Music2, Palette, Search, ShieldCheck, Sparkles, UtensilsCrossed, Smartphone, Download } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MatrimonialProfile, Vendor } from '../types';
import { ProfileCard } from '../components/ProfileCard';
import { MatchSearchBar } from '../components/MatchSearchBar';

const categories = [
  { value: 'Venue', label: 'Wedding venues', description: 'A place for your forever', Icon: Building2, color: 'bg-[#f2e8dc] text-[#947247]' },
  { value: 'Photographer', label: 'Photography', description: 'Every feeling, captured', Icon: Camera, color: 'bg-[#f8e4e6] text-[#b16a77]' },
  { value: 'Makeup & Mehndi', label: 'Makeup & mehndi', description: 'Your kind of bridal glow', Icon: Palette, color: 'bg-[#f2e9f4] text-[#92709f]' },
  { value: 'Decorator', label: 'Decor & flowers', description: 'Bring your vision to life', Icon: Flower2, color: 'bg-[#e8eee3] text-[#7b8b65]' },
  { value: 'Catering', label: 'Wedding catering', description: 'A celebration of flavour', Icon: UtensilsCrossed, color: 'bg-[#faedda] text-[#b3884c]' },
  { value: 'DJ & Music', label: 'Music & entertainment', description: 'Make a little more noise', Icon: Music2, color: 'bg-[#e8edf3] text-[#6b8196]' },
];
const vendorLink = (category = 'all', city = '') => `/shadi-planner?${new URLSearchParams({ tab: 'vendors', category, ...(city.trim() ? { city: city.trim() } : {}) })}`;

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState('all');
  const [city, setCity] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [vendorsError, setVendorsError] = useState(false);
  const [featuredProfiles, setFeaturedProfiles] = useState<MatrimonialProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState(false);

  const loadVendors = async () => {
    setVendorsLoading(true); setVendorsError(false);
    try { setVendors(await api.getVendors()); }
    catch { setVendorsError(true); }
    finally { setVendorsLoading(false); }
  };
  useEffect(() => { void loadVendors(); }, []);
  useEffect(() => {
    let active = true;
    setFeaturedProfiles([]); setProfilesError(false);
    if (!user) { setProfilesLoading(false); return; }
    setProfilesLoading(true);
    api.getProfiles({ sortBy: 'recommended' })
      .then(data => { if (active) setFeaturedProfiles(data.profiles.slice(0, 3)); })
      .catch(() => { if (active) setProfilesError(true); })
      .finally(() => { if (active) setProfilesLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  return (
    <div className="wedding-home bg-[#fffcf8] text-[#352629] pb-14">
      <section className="matrimonial-hero" aria-labelledby="wedding-hero-title">
        <picture><source media="(max-width: 639px)" srcSet="/images/matrimonial-hero-mobile.webp" /><img src="/images/matrimonial-hero.webp" alt="An Indian couple smiling at each other in a garden courtyard" width={1672} height={941} fetchPriority="high" decoding="async" className="matrimonial-hero-image" /></picture>
        <div className="matrimonial-hero-overlay" aria-hidden="true" />
        <div className="matrimonial-hero-inner">
          <div className="matrimonial-hero-copy">
            <p className="matrimonial-kicker"><span aria-hidden="true" />YOUR STORY. YOUR PERSON. YOUR FOREVER.</p>
            <h1 id="wedding-hero-title">A connection that<br />feels like <em>forever.</em></h1>
            <p className="matrimonial-hero-description">Meet someone who shares your values, your dreams,<br className="hidden sm:block" /> and your idea of home. Your next chapter starts here.</p>
            <div className="matrimonial-hero-actions">
              <Link to={user ? '/matches' : '/register'} className="matrimonial-primary">{user ? 'Explore my matches' : 'Create your free profile'}<ArrowRight size={17} aria-hidden="true" /></Link>
              <a href="#how-matching-works" className="matrimonial-secondary">See how it works <ArrowUpRight size={16} aria-hidden="true" /></a>
            </div>
            <div className="matrimonial-assurances"><span><ShieldCheck size={15} aria-hidden="true" />Reviewed profiles</span><span><Heart size={15} aria-hidden="true" />Meaningful connections</span><span><Check size={15} aria-hidden="true" />Contact privacy</span></div>
          </div>
          <MatchSearchBar signedIn={!!user} />
        </div>
        <span className="matrimonial-image-note">A new beginning, together.</span>
      </section>

      <section id="how-matching-works" className="scroll-mt-32 max-w-7xl mx-auto px-5 sm:px-8 pt-16 sm:pt-20 pb-8" aria-labelledby="matching-title">
        <div className="text-center max-w-2xl mx-auto"><p className="wedding-eyebrow">FIND A LIFE PARTNER, YOUR WAY</p><h2 id="matching-title" className="wedding-section-title">From the first hello to <span className="italic text-[#92556a]">a shared tomorrow.</span></h2><p className="mt-4 text-sm leading-7 text-[#735e65]">ShadiPlanner brings matrimonial profiles and wedding planning together. Start by finding someone you want to build a life with.</p></div>
        <div className="grid md:grid-cols-3 gap-7 sm:gap-10 mt-10">
          {[{ number: '01', title: 'Tell your story', text: 'Create your biodata with your education, interests, family background, and what matters to you.', Icon: Heart }, { number: '02', title: 'Discover your possibilities', text: 'Log in to explore approved profiles and narrow your search by your partner preferences.', Icon: Search }, { number: '03', title: 'Connect when it feels right', text: 'Send an interest. Gold and Platinum unlock contact details after a mutual connection.', Icon: ShieldCheck }].map(({ number, title, text, Icon }) => <div key={number} className="border-t border-[#e8d9d2] pt-5"><div className="flex items-center justify-between"><span className="font-playfair text-3xl italic text-[#c3a7a0]">{number}</span><Icon className="w-5 h-5 text-[#996778]" strokeWidth={1.4} /></div><h3 className="font-playfair text-xl sm:text-2xl mt-4">{title}</h3><p className="mt-3 text-sm leading-7 text-[#735e65]">{text}</p></div>)}
        </div>
        <div className="text-center mt-8"><Link to="/matches" className="inline-flex items-center gap-2 text-sm font-semibold text-[#8b4259] hover:underline">{user ? 'Find a meaningful match' : 'Already a member? Log in to find matches'}<ArrowRight className="w-4 h-4" /></Link></div>
      </section>

      {user && <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-8 pb-12" aria-labelledby="member-profiles-title"><div className="flex flex-wrap items-end justify-between gap-4 mb-7"><div><p className="wedding-eyebrow">YOUR NEXT CHAPTER</p><h2 id="member-profiles-title" className="wedding-section-title">Make a meaningful connection.</h2></div><Link to="/matches" className="text-sm font-semibold text-[#8b4259] flex items-center gap-2">Browse matches<ArrowRight className="w-4 h-4" /></Link></div>{profilesLoading ? <p role="status" className="text-sm text-[#735e65]">Loading member profiles...</p> : profilesError ? <p role="status" className="text-sm text-[#735e65]">Profiles couldn't be loaded right now. You can try again from Search Matches.</p> : featuredProfiles.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{featuredProfiles.map(profile => <ProfileCard key={profile.id} profile={profile} />)}</div> : <p className="text-sm text-[#735e65]">Explore Search Matches to find profiles that suit your preferences.</p>}</section>}

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 text-center"><p className="wedding-eyebrow">AND WHEN YOU'VE FOUND YOUR PERSON...</p><h2 className="wedding-section-title">Let's plan your <span className="italic text-[#92556a]">next chapter.</span></h2><p className="mt-3 text-sm text-[#735e65]">Wedding vendors, checklists, and budgets for the celebration ahead.</p></div>
      <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-6">
        <div className="rounded-2xl bg-white border border-[#eee2d8] shadow-[0_12px_45px_-15px_rgba(77,35,43,0.2)] p-5 sm:p-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4"><h2 className="text-sm font-semibold flex items-center gap-2"><Search className="w-4 h-4 text-[#8f4056]" /> Let's find your wedding team</h2><Link to="/matches" className="text-xs text-[#945064] hover:underline flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" />{user ? 'Looking for your life partner? Search matches' : 'Looking for your life partner? Log in'}<ArrowUpRight className="w-3.5 h-3.5" /></Link></div>
          <form onSubmit={event => { event.preventDefault(); navigate(vendorLink(category, city)); }} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div><label htmlFor="home-vendor-category" className="block text-[11px] font-medium text-[#735e65] mb-1.5">What are you looking for?</label><select id="home-vendor-category" value={category} onChange={event => setCategory(event.target.value)} className="w-full bg-[#fffcf9] border border-[#e8ddd5] rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#9f5368]"><option value="all">All wedding vendors</option>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div><label htmlFor="home-wedding-city" className="block text-[11px] font-medium text-[#735e65] mb-1.5">Where is the celebration?</label><div className="relative"><MapPin className="absolute left-3 top-3.5 w-4 h-4 text-[#a38b8e]" /><input id="home-wedding-city" value={city} onChange={event => setCity(event.target.value)} placeholder="Enter a city" maxLength={100} className="w-full bg-[#fffcf9] border border-[#e8ddd5] rounded-lg p-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-[#9f5368]" /></div></div>
            <button type="submit" className="self-end inline-flex justify-center items-center gap-2 rounded-lg bg-[#7d3048] text-white px-7 py-3.5 text-sm font-semibold hover:bg-[#642239] transition"><Search className="w-4 h-4" />Find vendors</button>
          </form>
        </div>
      </div>

      <section id="wedding-categories" className="scroll-mt-32 max-w-7xl mx-auto px-5 sm:px-8 pt-16 sm:pt-20 pb-14" aria-labelledby="wedding-categories-title">
        <div className="text-center mb-9"><p className="wedding-eyebrow">THE DETAILS MAKE THE DAY</p><h2 id="wedding-categories-title" className="wedding-section-title">Everything for your <span className="italic text-[#92556a]">“I do.”</span></h2><p className="mt-3 text-sm text-[#735e65]">Find the people who'll turn your wedding vision into a celebration.</p></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-7">{categories.map(({ value, label, description, Icon, color }) => <Link key={value} to={vendorLink(value)} className="group text-center rounded-xl focus-visible:ring-2 focus-visible:ring-[#9f5368] outline-none"><div className={`mx-auto h-[86px] w-[86px] sm:h-[94px] sm:w-[94px] rounded-[2rem] flex items-center justify-center transition group-hover:-translate-y-1 ${color}`}><Icon className="h-8 w-8" strokeWidth={1.3} /></div><h3 className="mt-4 text-sm font-semibold group-hover:text-[#963f5b]">{label}</h3><p className="mt-1 text-[11px] leading-relaxed text-[#735e65]">{description}</p></Link>)}</div>
      </section>

      <section id="planning-tools" className="scroll-mt-32 border-y border-[#eee4da] bg-[#f6f0e8] py-14 sm:py-16" aria-labelledby="planning-title">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-20 items-center">
          <div className="relative max-w-lg"><div className="aspect-[4/3] rounded-t-[7rem] rounded-b-2xl overflow-hidden"><img src="/images/wedding-venue.jpg" alt="A wedding reception venue arranged for a celebration" loading="lazy" className="w-full h-full object-cover" /></div><div className="absolute -bottom-5 right-3 sm:-right-5 bg-[#fffcf8] border border-[#eadfd5] rounded-xl p-4 sm:p-5 shadow-lg flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-[#ececdf] flex items-center justify-center"><Check className="w-5 h-5 text-[#788263]" /></span><div><p className="font-playfair text-lg">Less stress. More celebration.</p><p className="text-[11px] text-[#735e65] mt-1">One beautiful plan at a time.</p></div></div></div>
          <div className="pt-5 lg:pt-0"><p className="wedding-eyebrow">YOUR BIG DAY, A LITTLE EASIER</p><h2 id="planning-title" className="wedding-section-title">Enjoy the journey.<br /><span className="italic text-[#92556a]">We'll help with the details.</span></h2><p className="text-sm leading-7 text-[#735e65] mt-4 max-w-md">Keep the to-dos, the budget, and your vendor shortlist close. Give every little detail a place, so you can make room for the moments that matter.</p>
            <div className="mt-6 space-y-1">{[{ title: 'Your wedding checklist', text: 'Make a plan and tick off each little milestone.', Icon: ClipboardCheck, tab: 'checklist' }, { title: 'A budget that makes sense', text: 'See what is planned, spent, and still available.', Icon: IndianRupee, tab: 'budget' }, { title: 'Your people, in one place', text: 'Explore the vendor directory by city and category.', Icon: Building2, tab: 'vendors' }].map(({ title, text, Icon, tab }) => <Link key={tab} to={`/shadi-planner?tab=${tab}`} className="group flex items-center gap-4 py-3 border-b border-[#e4d9ce] last:border-0"><span className="w-10 h-10 rounded-full border border-[#e1d3c6] flex items-center justify-center text-[#9a6c67] shrink-0"><Icon className="w-4 h-4" strokeWidth={1.5} /></span><span className="flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-[#735e65] mt-1">{text}</span></span><ArrowUpRight className="w-4 h-4 text-[#b49e96] group-hover:text-[#7d3048]" /></Link>)}</div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20" aria-labelledby="vendor-directory-title">
        <div className="flex flex-wrap gap-4 justify-between items-end mb-8"><div><p className="wedding-eyebrow">GOOD PEOPLE. BEAUTIFUL CELEBRATIONS.</p><h2 id="vendor-directory-title" className="wedding-section-title">Meet your <span className="italic text-[#92556a]">wedding team.</span></h2></div><Link to={vendorLink()} className="text-sm text-[#8b4259] font-semibold flex items-center gap-2 hover:underline">Explore the directory <ArrowRight className="w-4 h-4" /></Link></div>
        {vendorsLoading ? <div role="status" className="py-10 text-center text-sm text-[#735e65]">Finding the wedding directory...</div> : vendorsError ? <div role="alert" className="rounded-xl border border-[#e8ddd5] p-7 text-sm text-[#735e65]">The directory couldn't be loaded. <button onClick={() => void loadVendors()} className="text-[#7d3048] underline font-semibold">Try again</button></div> : vendors.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{vendors.slice(0, 3).map(vendor => <Link key={vendor.id} to={vendorLink(vendor.category, vendor.city)} className="group overflow-hidden rounded-2xl border border-[#eae1d8] bg-white hover:shadow-lg transition"><div className="aspect-[16/10] overflow-hidden relative"><img src={vendor.image} alt={vendor.name} loading="lazy" className="w-full h-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-4 bottom-4 rounded-full bg-white/95 px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#78564f]">{vendor.category}</span></div><div className="p-5"><div className="flex justify-between items-start gap-3"><h3 className="font-playfair text-xl font-semibold">{vendor.name}</h3><ArrowUpRight className="w-4 h-4 shrink-0 text-[#9f7b7e] mt-1" /></div><p className="mt-2 flex items-center gap-1 text-xs text-[#735e65]"><MapPin className="w-3 h-3" />{vendor.city}</p><div className="border-t border-[#f0e8e1] mt-4 pt-4 text-sm text-[#855a62]">{vendor.priceRange}</div></div></Link>)}</div> : <p className="rounded-xl border border-[#e8ddd5] p-7 text-sm text-[#735e65]">New vendor listings will appear here when they are added to the directory.</p>}
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8" aria-labelledby="together-title"><div className="grid lg:grid-cols-2 rounded-[1.75rem] overflow-hidden bg-[#783046]"><div className="p-7 sm:p-12 lg:p-14 text-white"><p className="wedding-eyebrow !text-[#dfbaa6]">BEFORE THE WEDDING, THERE'S YOUR STORY</p><h2 id="together-title" className="font-playfair text-3xl sm:text-4xl leading-tight mt-4">Find your person.<br /><span className="italic text-[#ebccb8]">Then plan your forever.</span></h2><p className="mt-5 text-sm leading-7 text-[#ead7dc] max-w-md">Build your biodata, share what matters to you, and discover people with a shared vision for life. Explore matches after signing in.</p><div className="flex flex-wrap gap-3 mt-7"><Link to={user ? '/matches' : '/register'} className="rounded-lg bg-[#fff9ef] px-5 py-3 text-sm font-semibold text-[#783046] inline-flex items-center gap-2">{user ? 'Search matches' : 'Create your profile'}<ArrowRight className="w-4 h-4" /></Link>{!user && <Link to="/matches" className="inline-flex items-center gap-2 px-4 py-3 text-sm text-[#f4e5e3] hover:underline">Already a member? Log in</Link>}</div><p className="mt-6 flex items-center gap-2 text-xs text-[#dcbac1]"><ShieldCheck className="w-4 h-4" />Contact details unlock after an accepted connection.</p></div><div className="relative min-h-[260px] lg:min-h-full"><img src="/images/wedding-details.jpg" alt="Flowers and warm details at a wedding reception table" loading="lazy" className="absolute inset-0 w-full h-full object-cover" /></div></div></section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-12" aria-labelledby="mobile-app-banner">
        <div className="rounded-[1.75rem] border border-[#e8d9d2] bg-gradient-to-r from-[#fff5f2] to-[#fbf0ec] p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-200 shrink-0">
              <Smartphone className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-wider text-rose-700 uppercase">ShadiPlanner for Android</span>
              <h3 id="mobile-app-banner" className="font-playfair text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">Take your search & wedding planning with you.</h3>
              <p className="text-xs sm:text-sm text-[#735e65] mt-1 max-w-xl">Download the standalone APK directly to your phone. Browse biodatas, chat with matches, and keep checklists handy.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
            <Link to="/download" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 text-sm font-semibold shadow-sm transition">
              <Download className="w-4 h-4" />
              <span>Download APK</span>
            </Link>
          </div>
        </div>
      </section>



      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 flex flex-col sm:flex-row gap-3 justify-between items-center text-center text-[11px] text-[#735e65]"><span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-[#b79360]" />Made for the journey, from the first hello to the big day.</span><span>Thoughtful planning. Meaningful connections.</span></div>
    </div>
  );
};
