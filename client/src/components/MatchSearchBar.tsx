import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, Search } from 'lucide-react';

const ages = Array.from({ length: 83 }, (_, index) => index + 18);
const religions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Other'];
const languages = ['Hindi', 'English', 'Urdu', 'Punjabi', 'Marathi', 'Gujarati', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Odia', 'Assamese'];

export const MatchSearchBar: React.FC<{ signedIn: boolean }> = ({ signedIn }) => {
  const navigate = useNavigate();
  const [gender, setGender] = useState('');
  const [minAge, setMinAge] = useState('21');
  const [maxAge, setMaxAge] = useState('35');
  const [religion, setReligion] = useState('');
  const [motherTongue, setMotherTongue] = useState('');
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!gender) { setError('Choose who you would like to meet.'); document.getElementById('match-gender')?.focus(); return; }
    if (Number(minAge) > Number(maxAge)) { setError('The oldest age must be the same as or older than the youngest age.'); document.getElementById('match-max-age')?.focus(); return; }
    setError('');
    const params = new URLSearchParams({ gender, minAge, maxAge });
    if (religion) params.set('religion', religion);
    if (motherTongue) params.set('motherTongue', motherTongue);
    // The existing route guard preserves these filters through login.
    navigate(`/matches?${params}`);
  };
  return <form id="home-match-search" onSubmit={submit} noValidate className="match-search-glass" aria-label="Find a life partner">
    <div className="match-search-caption"><span><Heart size={14} aria-hidden="true" /> A little about your person</span><span>{signedIn ? 'Make room for a meaningful connection' : 'Choose your preferences. Log in to see your matches.'}</span></div>
    <div className="match-search-fields">
      <div className="match-search-field"><label htmlFor="match-gender">I’m looking for</label><select id="match-gender" value={gender} onChange={event => { setGender(event.target.value); setError(''); }} aria-invalid={!!error && !gender} aria-describedby={error ? 'match-search-error' : undefined} required><option value="" disabled>Select gender</option><option value="Female">Woman / Bride</option><option value="Male">Man / Groom</option><option value="Other">Other</option></select></div>
      <fieldset className="match-search-field match-age-field"><legend>Age range</legend><div><label htmlFor="match-min-age" className="sr-only">Youngest age</label><select id="match-min-age" value={minAge} onChange={event => { setMinAge(event.target.value); setError(''); }}>{ages.map(age => <option key={age}>{age}</option>)}</select><span aria-hidden="true">to</span><label htmlFor="match-max-age" className="sr-only">Oldest age</label><select id="match-max-age" value={maxAge} onChange={event => { setMaxAge(event.target.value); setError(''); }} aria-invalid={Number(minAge) > Number(maxAge)} aria-describedby={error ? 'match-search-error' : undefined}>{ages.map(age => <option key={age}>{age}</option>)}</select></div></fieldset>
      <div className="match-search-field"><label htmlFor="match-religion">Religion</label><select id="match-religion" value={religion} onChange={event => setReligion(event.target.value)}><option value="">Any religion</option>{religions.map(value => <option key={value}>{value}</option>)}</select></div>
      <div className="match-search-field"><label htmlFor="match-language">Mother tongue</label><select id="match-language" value={motherTongue} onChange={event => setMotherTongue(event.target.value)}><option value="">Any language</option>{languages.map(value => <option key={value}>{value}</option>)}</select></div>
      <button type="submit" className="match-find-button"><Search size={17} aria-hidden="true" />Find Matches<ArrowRight size={17} aria-hidden="true" /></button>
    </div>
    {error && <p id="match-search-error" role="alert" className="mt-3 text-sm text-white font-medium">{error}</p>}
  </form>;
};
