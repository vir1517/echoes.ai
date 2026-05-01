
export interface LovedOne {
  id: string;
  name: string;
  birthYear: number;
  passingYear: number;
  relation: string;
  avatarUrl: string;
  summary: string;
  traits: string[];
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
  }
];
