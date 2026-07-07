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
    voiceId: 'Gubgw9l4dtIoQA9YZHgx',
    color: '#e07b54',
  },
  maya: {
    id: 'maya',
    name: 'Maya',
    role: 'Teacher',
    voiceId: 'AXdMgz6evoL7OPd7eU12',
    color: '#54a0e0',
  },
  lily: {
    id: 'lily',
    name: 'Lily',
    role: 'Student',
    voiceId: 'lLgB6ZeIe84FSJa9pO1a',
    color: '#e054a0',
  },
  margaret: {
    id: 'margaret',
    name: 'Margaret',
    role: 'Housewife',
    voiceId: 'roYauZ4bOLAKvVZTPLre',
    color: '#a0e054',
  },
  ahmed: {
    id: 'ahmed',
    name: 'Ahmed',
    role: 'English Learner',
    voiceId: '3gsg3cxXyFLcGIfNbM6C',
    color: '#e0c454',
  },
  drchen: {
    id: 'drchen',
    name: 'Dr. Chen',
    role: 'Literary Critic',
    voiceId: 'GKDaBI8TKSBJVhsCLD6n',
    color: '#9b54e0',
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus',
    role: 'Philosopher',
    voiceId: '6lbtrJXRylVZ6EqIQQPT',
    color: '#54e0c4',
  },
};

export const AGENT_LIST = Object.values(AGENTS);
