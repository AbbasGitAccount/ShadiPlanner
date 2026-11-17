import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useResource } from '../../lib/useResource';
import { request } from '../../lib/api';
import type { SubscriptionCatalogue, SubscriptionPlan } from '../../types';
import { Badge, Button, Card, Loading, Problem, Screen, currency, colors, s } from '../../components/ui';

export default function Plans() {
  const r = useResource<SubscriptionCatalogue>('/subscriptions/plans');
  const [busy, setBusy] = useState<string | null>(null);

  const handleUpgrade = (p: SubscriptionPlan) => {
    Alert.alert(
      `Upgrade to ${p.name}`,
      `Simulate Razorpay payment of ${currency(p.pricePaise)} for ${p.durationDays || 30} days of ${p.name} access?\n\n(Test Mode: No real money will be charged)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Pay ${currency(p.pricePaise)} (Razorpay Test)`,
          onPress: async () => {
            setBusy(p.id);
            try {
              const checkout = await request<{ orderId: string }>('/subscriptions/checkout', { planId: p.id }, 'POST');
              const mockPaymentId = `pay_test_mob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              await request('/subscriptions/verify', { orderId: checkout.orderId, paymentId: mockPaymentId }, 'POST');
              Alert.alert(
                'Payment Successful!',
                `Congratulations! Your account is now upgraded to ${p.name} Membership. Mutual contact details and higher interest allowances are active immediately.`
              );
              await r.reload();
            } catch (e: any) {
              Alert.alert('Payment Failed', e.message || 'Could not complete test payment.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <Text style={s.eyebrow}>A LITTLE MORE POSSIBILITY</Text>
      <Text style={s.title}>Room for your{'\n'}next chapter.</Text>
      <Text style={s.muted}>
        Prices and features come from the same catalogue as your ShadiPlanner account.
      </Text>

      {r.loading && <Loading />}
      {r.error && <Problem message={r.error} retry={() => void r.reload()} />}

      {r.data && (
        <Card style={{ borderColor: '#E5D6DE', backgroundColor: '#FDFBFD' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.wine }}>
            ⚡ Razorpay Payment Gateway (Test Mode)
          </Text>
          <Text style={s.muted}>
            Test payments are enabled. Select Gold or Platinum below to test instant plan activation on your mobile device.
          </Text>
        </Card>
      )}

      {r.data?.plans.map((p) => (
        <Card key={p.id}>
          <Badge>{p.id.toUpperCase()}</Badge>
          <Text style={s.title}>{p.name}</Text>
          <Text style={s.title}>{currency(p.pricePaise)}</Text>
          <Text style={s.muted}>
            {p.id === 'free' ? 'Free access' : p.durationDays ? `${p.durationDays} days of access` : 'Billing duration is not configured'}
          </Text>
          <Text style={s.text}>{p.interestLimit ?? 'Unlimited'} interests / month</Text>
          <Text style={s.text}>{p.browseLimit ?? 'Unlimited'} discoverable profiles</Text>
          <Text style={s.text}>
            {p.advancedSearch ? '✓ Advanced search' : 'Basic search'}
            {p.contactDetails ? '\n✓ Contacts after mutual consent' : '\nPrivate direct contacts'}
            {p.premiumBadge ? '\n✓ Premium badge' : ''}
            {p.enhancedVisibility ? '\n✓ Enhanced visibility' : ''}
            {p.compatibleFirst ? '\n✓ Compatible matches first' : ''}
          </Text>
          <Text style={s.muted}>{p.support} support</Text>

          <Button
            title={
              p.id === 'free'
                ? 'Included with your account'
                : busy === p.id
                ? 'Authorizing with Razorpay...'
                : `Subscribe to ${p.name} (Razorpay Test)`
            }
            disabled={p.id === 'free' || Boolean(busy)}
            onPress={() => handleUpgrade(p)}
          />
        </Card>
      ))}

      <Text style={s.muted}>
        Paid access never bypasses profile approval or mutual consent. Your current subscription is verified on the server.
      </Text>
    </Screen>
  );
}
