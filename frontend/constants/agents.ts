export interface Agent {
  id: string;
  name: string;
  role: string;
  voiceId: string;
  color: string;
  // One line shown in the member picker.
  bio: string;
}

// Voice IDs mirror backend/src/prompts.ts
export const AGENTS: Record<string, Agent> = {
  james: {
    id: 'james',
    name: 'James',
    role: 'ER Nurse',
    voiceId: 'Gubgw9l4dtIoQA9YZHgx',
    color: '#e07b54',
    bio: 'Ties every story back to the real people he meets on night shifts.',
  },
  maya: {
    id: 'maya',
    name: 'Maya',
    role: 'Teacher',
    voiceId: 'AXdMgz6evoL7OPd7eU12',
    color: '#54a0e0',
    bio: 'Loves the big lessons in a book and always asks what you think.',
  },
  lily: {
    id: 'lily',
    name: 'Lily',
    role: 'Student',
    voiceId: 'lLgB6ZeIe84FSJa9pO1a',
    color: '#e054a0',
    bio: 'Wears her heart on her sleeve — first reactions, big feelings.',
  },
  margaret: {
    id: 'margaret',
    name: 'Margaret',
    role: 'Housewife',
    voiceId: 'roYauZ4bOLAKvVZTPLre',
    color: '#a0e054',
    bio: 'Reads for the characters, their families and their hearts.',
  },
  ahmed: {
    id: 'ahmed',
    name: 'Ahmed',
    role: 'English Learner',
    voiceId: '3gsg3cxXyFLcGIfNbM6C',
    color: '#e0c454',
    bio: 'Savours the language and what books teach about culture.',
  },
  drchen: {
    id: 'drchen',
    name: 'Dr. Chen',
    role: 'Literary Critic',
    voiceId: 'GKDaBI8TKSBJVhsCLD6n',
    color: '#9b54e0',
    bio: 'Sharp on structure, themes and how a book fits its era.',
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus',
    role: 'Philosopher',
    voiceId: '6lbtrJXRylVZ6EqIQQPT',
    color: '#54e0c4',
    bio: 'Finds the big questions — freedom, meaning, what makes us human.',
  },
};

export const AGENT_LIST = Object.values(AGENTS);
