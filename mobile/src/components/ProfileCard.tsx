import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { MatrimonialProfile } from '../types';
import { Avatar, Badge, Card, colors, s } from './ui';
export function ProfileCard({ profile }: { profile: MatrimonialProfile }) {
  const isPhotoLocked = profile.isPhotoUnlocked === false;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${profile.fullName}'s profile`}
      onPress={() => router.push({ pathname: '/profile/[id]', params: { id: profile.id } })}
    >
      <Card>
        <View style={s.row}>
          <View style={{ position: 'relative' }}>
            <Avatar name={profile.fullName} photo={isPhotoLocked ? undefined : profile.profilePhoto} size={76} />
            {isPhotoLocked && (
              <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.wine, borderRadius: 12, padding: 4 }}>
                <Ionicons name="lock-closed" size={11} color={colors.white} />
              </View>
            )}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.h2}>{profile.fullName}</Text>
            <Text style={s.muted}>{profile.age} yrs · {profile.heightFormatted}</Text>
            <Text style={s.muted}>{profile.city} · {profile.religion}</Text>
          </View>
          <Ionicons name="chevron-forward" color={colors.coral} size={20} />
        </View>
        <Text style={s.text}>{profile.profession} · {profile.highestEducation}</Text>
        <View style={s.wrap}>
          {profile.isVerified && <Badge>✓ Reviewed profile</Badge>}
          {isPhotoLocked && <Badge>🔒 Photo Locked</Badge>}
          {!profile.isContactUnlocked && <Badge>🔒 Phone Locked</Badge>}
          {profile.matchScore !== undefined && <Badge>{profile.matchScore}% compatibility</Badge>}
        </View>
      </Card>
    </Pressable>
  );
}
