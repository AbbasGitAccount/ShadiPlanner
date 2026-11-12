import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { MatrimonialProfile } from '../types';
import { Avatar, Badge, Card, colors, s } from './ui';
export function ProfileCard({ profile }: { profile: MatrimonialProfile }) { return <Pressable accessibilityRole="button" accessibilityLabel={`View ${profile.fullName}'s profile`} onPress={() => router.push({ pathname: '/profile/[id]', params: { id: profile.id } })}><Card><View style={s.row}><Avatar name={profile.fullName} photo={profile.profilePhoto} size={76} /><View style={{ flex: 1, gap: 6 }}><Text style={s.h2}>{profile.fullName}</Text><Text style={s.muted}>{profile.age} yrs · {profile.heightFormatted}</Text><Text style={s.muted}>{profile.city} · {profile.religion}</Text></View><Ionicons name="chevron-forward" color={colors.coral} size={20} /></View><Text style={s.text}>{profile.profession} · {profile.highestEducation}</Text><View style={s.wrap}>{profile.isVerified && <Badge>✓ Reviewed profile</Badge>}{profile.premiumMember && <Badge>Premium</Badge>}{profile.matchScore !== undefined && <Badge>{profile.matchScore}% compatibility</Badge>}</View></Card></Pressable>; }
