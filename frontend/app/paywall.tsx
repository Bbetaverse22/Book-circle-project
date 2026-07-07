import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AGENT_LIST } from '../constants/agents';
import {
  getSubscriptionPackages,
  purchasePackage,
  purchasesAvailable,
  restorePurchases,
  SubscriptionPackage,
} from '../utils/purchases';

const PERKS = [
  'Unlimited daily questions',
  'All 7 club members, every time',
  'Voice replies in every character’s own voice',
  'New books and members as the club grows',
];

export default function PaywallScreen() {
  const router = useRouter();
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSubscriptionPackages()
      .then(setPackages)
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (pkg: SubscriptionPackage) => {
    setBusy(true);
    try {
      const subscribed = await purchasePackage(pkg);
      if (subscribed) {
        Alert.alert('Welcome to the club! 🎉', 'You now have unlimited discussions.');
        router.back();
      }
    } catch {
      Alert.alert('Purchase failed', 'Something went wrong. You were not charged — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert('Restored', 'Your subscription is active again.');
        router.back();
      } else {
        Alert.alert('Nothing to restore', 'No previous subscription was found for this device.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Close */}
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#888" />
        </TouchableOpacity>

        {/* Club avatars */}
        <View style={styles.avatarRow}>
          {AGENT_LIST.map((agent) => (
            <View
              key={agent.id}
              style={[styles.avatar, { backgroundColor: agent.color }]}
            >
              <Text style={styles.avatarInitial}>
                {agent.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.title}>Keep the conversation going</Text>
        <Text style={styles.subtitle}>
          You’ve used your free questions for today. Join BookCircle Plus for
          unlimited discussions with the whole club.
        </Text>

        {/* Perks */}
        <View style={styles.perks}>
          {PERKS.map((perk) => (
            <View key={perk} style={styles.perkRow}>
              <Ionicons name="checkmark-circle" size={20} color="#7c6af7" />
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>

        {/* Purchase options */}
        {loading ? (
          <ActivityIndicator color="#7c6af7" style={styles.spinner} />
        ) : packages.length > 0 ? (
          packages.map((pkg) => (
            <TouchableOpacity
              key={pkg.identifier}
              style={[styles.purchaseButton, busy && styles.disabled]}
              disabled={busy}
              onPress={() => handlePurchase(pkg)}
            >
              <Text style={styles.purchaseButtonText}>
                Subscribe — {pkg.priceString}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.unavailableBox}>
            <Text style={styles.unavailableText}>
              {purchasesAvailable()
                ? 'Subscriptions are loading slowly — please try again shortly.'
                : 'Subscriptions are available in the App Store version of BookCircle. Your free questions reset tomorrow.'}
            </Text>
          </View>
        )}

        {/* Restore */}
        <TouchableOpacity disabled={busy} onPress={handleRestore}>
          <Text style={styles.restoreText}>Restore purchases</Text>
        </TouchableOpacity>

        <Text style={styles.legalText}>
          Payment is charged to your Apple ID. Subscriptions renew automatically
          unless cancelled at least 24 hours before the end of the period.
          Manage or cancel anytime in App Store settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121f',
  },
  scroll: {
    padding: 24,
    paddingTop: 16,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -4,
    borderWidth: 2,
    borderColor: '#12121f',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  title: {
    color: '#e0e0e0',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#999',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  perks: {
    gap: 12,
    marginBottom: 28,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  perkText: {
    color: '#ccc',
    fontSize: 15,
  },
  spinner: {
    marginVertical: 20,
  },
  purchaseButton: {
    backgroundColor: '#7c6af7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  unavailableBox: {
    backgroundColor: '#1e1e30',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  unavailableText: {
    color: '#999',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  restoreText: {
    color: '#7c6af7',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 14,
  },
  legalText: {
    color: '#555',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});
