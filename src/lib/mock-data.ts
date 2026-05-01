export interface LovedOne {
  id: string;
  name: string;
  birthYear: number;
  passingYear: number;
  relation: string;
  avatarUrl: string;
  summary: string;
  traits: string[];
  birthPlace: string;
  languages: string[];
  occupation: string;
  phrases: string[];
  beliefs: string[];
  events: { year: number; title: string; description: string }[];
}

export const MOCK_LOVED_ONES: LovedOne[] = [
  {
    id: 'grandfather-joe',
    name: 'Joseph Miller',
    birthYear: 1934,
    passingYear: 2018,
    relation: 'Grandfather',
    avatarUrl: 'https://picsum.photos/seed/grandfather/400/400',
    summary: 'A lover of old clocks and long walks in the woods. Joseph was known for his dry wit and countless stories from his time as a railway engineer.',
    traits: ['Witty', 'Patient', 'Storyteller'],
    birthPlace: 'Manchester, UK',
    languages: ['English'],
    occupation: 'Railway Engineer',
    phrases: ["Right as rain", "Keep your chin up", "Tick-tock, let's get a move on"],
    beliefs: ['Hard work is its own reward', 'Nature provides the best answers', 'Family comes before everything'],
    events: [
      { year: 1952, title: 'Joined the Railway', description: 'Started as an apprentice engineer.' },
      { year: 1958, title: 'Married Ellen', description: 'The start of a 60-year journey together.' },
      { year: 1982, title: 'Chief Engineer', description: 'Retired from the Western Line.' }
    ]
  },
  {
    id: 'grandmother-ellen',
    name: 'Ellen Thorne',
    birthYear: 1941,
    passingYear: 2022,
    relation: 'Grandmother',
    avatarUrl: 'https://picsum.photos/seed/grandmother/400/400',
    summary: 'An artist at heart, Ellen filled her home with watercolors and the smell of freshly baked bread. She believed in the kindness of strangers.',
    traits: ['Artistic', 'Warm', 'Optimistic'],
    birthPlace: 'Dublin, Ireland',
    languages: ['English', 'Irish'],
    occupation: 'Secondary School Teacher',
    phrases: ["Life is for living", "Have a cup of tea first", "Everything happens for a reason"],
    beliefs: ['Art is essential for the soul', 'Kindness costs nothing', 'Education is the greatest gift'],
    events: [
      { year: 1965, title: 'Moved to London', description: 'Started teaching at St. Mary\'s.' },
      { year: 1978, title: 'First Exhibition', description: 'Showcased her watercolors at the local gallery.' }
    ]
  }
];
