import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AGENT_LIST, AGENTS } from '../constants/agents';
import { CLUB_SIZE } from '../utils/clubMembers';

interface MemberDropdownProps {
  value: string[];
  open: boolean;
  onToggle: () => void;
  onChange: (ids: string[]) => void;
}

// A dropdown field for choosing exactly CLUB_SIZE members.
export function MemberDropdown({ value, open, onToggle, onChange }: MemberDropdownProps) {
  const toggleMember = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((m) => m !== id));
    } else if (value.length < CLUB_SIZE) {
      onChange([...value, id]);
    }
  };

  const chosen = value.map((id) => AGENTS[id]).filter(Boolean);
  const summary =
    chosen.length === 0
      ? `Pick ${CLUB_SIZE} members`
      : chosen.length < CLUB_SIZE
        ? `${chosen.map((a) => a.name).join(', ')} · pick ${CLUB_SIZE - chosen.length} more`
        : `${chosen[0].name}, ${chosen[1].name} and ${chosen[2].name}`;

  return (
    <View style={[styles.field, open && styles.fieldOpen]}>
      <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.8}>
        {chosen.length > 0 && (
          <View style={styles.avatars}>
            {chosen.map((agent, i) => (
              <View
                key={agent.id}
                style={[
                  styles.avatarSmall,
                  { backgroundColor: agent.color, marginLeft: i === 0 ? 0 : -10 },
                ]}
              >
                <Text style={styles.avatarSmallInitial}>{agent.name.charAt(0)}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.label}>Your club</Text>
          <Text
            style={chosen.length === CLUB_SIZE ? styles.value : styles.placeholder}
            numberOfLines={1}
          >
            {summary}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {AGENT_LIST.map((agent) => {
            const isSelected = value.includes(agent.id);
            const isFull = !isSelected && value.length >= CLUB_SIZE;
            return (
              <TouchableOpacity
                key={agent.id}
                style={[styles.row, isFull && styles.rowDimmed]}
                onPress={() => toggleMember(agent.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.avatar, { backgroundColor: agent.color }]}>
                  <Text style={styles.avatarInitial}>{agent.name.charAt(0)}</Text>
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{agent.name}</Text>
                    <Text style={styles.role}>{agent.role}</Text>
                  </View>
                  <Text style={styles.bio}>{agent.bio}</Text>
                </View>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isSelected ? agent.color : '#555'}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: '#1e1e30',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d2d44',
    overflow: 'hidden',
  },
  fieldOpen: {
    borderColor: '#7c6af7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1e1e30',
  },
  avatarSmallInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  info: {
    flex: 1,
  },
  label: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  value: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  placeholder: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 2,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  rowDimmed: {
    opacity: 0.45,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  name: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '700',
  },
  role: {
    color: '#888',
    fontSize: 12,
  },
  bio: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
});
