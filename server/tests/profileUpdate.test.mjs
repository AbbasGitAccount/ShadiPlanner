import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfilePatch } from '../dist/models/profileUpdate.js';
import { buildRegistrationProfile } from '../dist/models/registration.js';

const signup = {
  fullName:'Test Member',gender:'Other',dateOfBirth:'1997-03-19',height:'175',maritalStatus:'Divorced',motherTongue:'Kannada',religion:'No religious affiliation',community:'Community',subCommunity:'Sub-community',languagesKnown:'Kannada, Hindi',manglik:'Prefer not to say',gothram:'Optional',rashi:'Optional',nakshatra:'Optional',highestEducation:'Diploma',collegeUniversity:'College',profession:'Designer',company:'Company',annualIncome:'0',workLocation:'Remote',city:'Mysuru',state:'Karnataka',country:'India',citizenship:'Indian',familyType:'Joint',familyStatus:'Prefer not to say',fatherOccupation:'Retired',motherOccupation:'Retired',brothersCount:'0',sistersCount:'2',familyLocation:'Mysuru',aboutFamily:'Our family.',diet:'Vegan',smoking:'No',drinking:'Occasionally',hobbies:'Reading, Music',aboutMe:'My introduction.',phone:'+91 90000 00000',minAge:'22',maxAge:'35',minHeight:'140',maxHeight:'200',minIncome:'0',preferredMaritalStatus:'Never Married',preferredReligions:'Any',preferredCommunities:'Any',preferredMotherTongues:'Kannada',preferredEducation:'Diploma',preferredOccupations:'Any',preferredLocations:'Mysuru',preferredDiet:'Vegan',
};
test('accepts every signup biodata field and derives display values on the server',()=>{
  const registered = buildRegistrationProfile(signup);
  const patch = validateProfilePatch({...registered,height:180,dateOfBirth:'1996-02-29',annualIncome:5.5});
  for(const key of Object.keys(registered)) if(!['phone','galleryPhotos','isVerified','phoneVerified','govtIdVerified','premiumMember'].includes(key)) assert.ok(key in patch,`editable ${key}`);
  assert.equal(patch.heightFormatted,'5 ft 11 in (180 cm)');
  assert.equal(patch.annualIncomeFormatted,'₹5.5 Lakhs / yr');
  assert.equal(patch.dateOfBirth,'1996-02-29');
  assert.ok(patch.age>=29);
  assert.equal(patch.brothersCount,0);
});
test('validates new personal fields, dates, units and sibling counts',()=>{
  for(const value of [{height:5.5},{brothersCount:1.5},{sistersCount:-1},{dateOfBirth:'2001-02-29'},{dateOfBirth:'2099-01-01'},{dateOfBirth:'1900-01-01'},{gender:'invalid'},{smoking:'invalid'},{country:''},{citizenship:''},{languagesKnown:['x'.repeat(501)]}]) assert.throws(()=>validateProfilePatch(value),error=>error.status===400 && !!error.field);
});
test('clears optional fields, normalizes lists and preserves multi-choice preferences',()=>{
  const current=buildRegistrationProfile(signup);
  const patch=validateProfilePatch({community:'',aboutFamily:'',fatherOccupation:'',hobbies:[],languagesKnown:['Hindi','Hindi',' Kannada '],partnerPreferences:{...current.partnerPreferences,maritalStatus:['Never Married','Divorced'],diet:['Vegan','Vegetarian']}});
  assert.equal(patch.aboutFamily,''); assert.deepEqual(patch.hobbies,[]); assert.deepEqual(patch.languagesKnown,['Hindi','Kannada']);
  assert.deepEqual(patch.partnerPreferences.maritalStatus,['Never Married','Divorced']);
});
test('never accepts ownership, account, verification, premium or derived-field overrides',()=>{
  const patch=validateProfilePatch({fullName:'New name',id:'other',userId:'other',email:'other@example.com',phone:'+16505550100',password:'changed',isVerified:true,phoneVerified:true,govtIdVerified:true,premiumMember:true,age:99,heightFormatted:'fake',annualIncomeFormatted:'fake',subscription:'platinum'});
  assert.deepEqual(patch,{fullName:'New name'});
});
