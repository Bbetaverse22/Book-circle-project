export interface Agent {
  id: string;
  name: string;
  role: string;
  voiceId: string;
  color: string;
}

// Agent list mirrors backend prompts.ts — voiceId must be set to real ElevenLabs IDs
export const AGENTS: Record<string, Agent> = {
  james: {
    id: 'james',
    name: 'James',
    role: 'ER Nurse',
    voiceId: 'ELEVENLABS_VOICE_ID_HERE',
    color: '#e07b54',
  },
  maya: {
    id: 'maya',
    name: 'Maya',
    role: 'Teacher',
    voiceId: 'ELEVENLABS_VOICE_ID_HERE',
    color: '#54a0e0',
  },
  lily: {
    id: 'lily',
    name: 'Lily',
    role: 'Student',
    voiceId: 'ELEVENLABS_VOICE_ID_HERE',
    color: '#e054a0',
  },
  margaret: {
    id: 'margaret',
    name: 'Margaret',
    role: 'Housewife',
    voiceId: 'ELEVENLABS_VOICE_ID_HERE',
    color: '#a0e054',
  },
  ahmed: {
    id: 'ahmed',
    name: 'Ahmed',
    role: 'English Learner',
    voiceId: 'ELEVENLABS_VOICE_ID_HERE',
    color: '#e0c454',
  },
  drchen: {
    id: 'drchen',
    name: 'Dr. Chen',
    role: 'Literary Critic',
    voiceId: 'ELEVENLABS_VOICE_ID_HERE',
    color: '#9b54e0',
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus',
    role: 'Philosopher',
    voiceId: 'ELEVENLABS_VOICE_ID_HERE',
    color: '#54e0c4',
  },
};

export const AGENT_LIST = Object.values(AGENTS);
